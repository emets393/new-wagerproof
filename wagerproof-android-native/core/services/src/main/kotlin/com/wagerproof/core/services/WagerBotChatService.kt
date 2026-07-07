package com.wagerproof.core.services

import com.wagerproof.core.models.WagerBotAppComponent
import com.wagerproof.core.models.WagerBotChatGameCard
import com.wagerproof.core.models.WagerBotChatWidget
import com.wagerproof.core.models.WagerBotStreamEvent
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources

/** Non-2xx chat response — message format is part of the iOS/RN parity contract. */
class WagerBotChatException(val statusCode: Int, message: String) : Exception(message)

/**
 * SSE streaming client for the `wagerbot-chat` Supabase Edge Function
 * (iOS WagerBotChatService.swift, RN wagerBotChatService.ts).
 *
 * The edge function streams two interleaved kinds of SSE events on a single
 * response body:
 *   1. Raw OpenAI `data:` chunks with no `event:` header — assistant text via
 *      `choices[0].delta.content`. okhttp-sse surfaces these with a null (or
 *      spec-default "message") event type.
 *   2. Custom `event: wagerbot.*` events (tool_start / tool_end / thread /
 *      follow_ups / etc.) followed by a `data:` JSON line.
 *
 * Both flavors are folded into one typed [WagerBotStreamEvent] flow.
 */
class WagerBotChatService {

    companion object {
        val shared = WagerBotChatService()

        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
    }

    /**
     * Start a streaming chat run. The flow completes when the server closes
     * the connection (after a final [WagerBotStreamEvent.Done]) and finishes
     * silently on collector cancellation.
     */
    fun startRun(userMessage: String, threadId: String? = null): Flow<WagerBotStreamEvent> = callbackFlow {
        // The edge function requires a logged-in user.
        val accessToken = EdgeFunctions.requireAccessToken()

        // Model selection is DEBUG-only: `current` returns the production
        // default (wagerbot-chat) on release builds, so behavior is untouched.
        // A non-default debug pick routes to the parallel wagerbot-agent
        // function with the chosen model.
        val option = WagerBotModelSelection.current

        // Body byte-identical to the RN/iOS clients for the default option —
        // thread_id/model omitted entirely when null (never sent as JSON null).
        val body = buildJsonObject {
            put("user_message", userMessage)
            threadId?.let { put("thread_id", it) }
            option.model?.let { put("model", it) }
        }

        val request = Request.Builder()
            .url("${SupabaseConfig.Main.URL}/functions/v1/${option.functionName}")
            .header("Authorization", "Bearer $accessToken")
            .header("Content-Type", "application/json")
            .header("Accept", "text/event-stream")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        val listener = object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                // No `event:` header → raw OpenAI delta chunk; named → wagerbot.*.
                val event = if (type.isNullOrEmpty() || type == "message") {
                    parseOpenAIChunk(data)
                } else {
                    parseCustomEvent(type.trim(), data)
                }
                // Blocking send applies backpressure on OkHttp's reader thread
                // instead of dropping deltas when the collector is briefly busy.
                if (event != null) trySendBlocking(event)
            }

            override fun onClosed(eventSource: EventSource) {
                trySendBlocking(WagerBotStreamEvent.Done)
                close()
            }

            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
                if (response != null && response.code !in 200..299) {
                    // The edge function returns a small `{"error": string}` body on failure.
                    val bodyText = runCatching { response.peekBody(1024).string() }.getOrDefault("")
                    close(WagerBotChatException(response.code, "Chat request failed (${response.code}): ${bodyText.take(200)}"))
                } else {
                    // Client-side cancel also lands here — the channel is already
                    // closed then, so this close() is a no-op and the flow ends silently.
                    close(t ?: WagerBotChatException(0, "Chat stream failed"))
                }
            }
        }

        // ServiceHttp.client's 600s readTimeout covers long tool-running streams.
        val eventSource = EventSources.createFactory(ServiceHttp.client).newEventSource(request, listener)
        awaitClose { eventSource.cancel() }
    }

    // MARK: - OpenAI delta parsing

    /**
     * Parse a raw OpenAI SSE chunk and extract content deltas. Returns null
     * for chunks without useful content (role-only deltas, finish_reason
     * chunks, the `[DONE]` sentinel).
     */
    private fun parseOpenAIChunk(data: String): WagerBotStreamEvent? {
        if (data == "[DONE]") return null
        val obj = parseJsonObject(data) ?: return null
        val firstChoice = (obj["choices"] as? JsonArray)?.firstOrNull() as? JsonObject ?: return null
        val content = (firstChoice["delta"] as? JsonObject)?.string("content") ?: return null
        if (content.isEmpty()) return null
        return WagerBotStreamEvent.ContentDelta(content)
    }

    // MARK: - Custom event parsing

    /**
     * Parse a `wagerbot.*` SSE event by name + JSON data line. Unknown event
     * names are dropped silently — the server may add new events the client
     * doesn't know about yet.
     */
    private fun parseCustomEvent(name: String, dataJson: String): WagerBotStreamEvent? {
        val obj = parseJsonObject(dataJson) ?: JsonObject(emptyMap())
        return when (name) {
            "wagerbot.thread" -> {
                val threadId = obj.string("thread_id") ?: return null
                WagerBotStreamEvent.Thread(id = threadId, created = obj.boolean("created") ?: false)
            }

            "wagerbot.tool_start" -> {
                val id = obj.string("id") ?: return null
                val toolName = obj.string("name") ?: return null
                // arguments arrives as an arbitrary JSON value — re-encode to a
                // string so the tool chip can display a summary.
                WagerBotStreamEvent.ToolStart(id = id, name = toolName, argumentsJson = argumentsToString(obj["arguments"]))
            }

            "wagerbot.tool_end" -> {
                val id = obj.string("id") ?: return null
                val toolName = obj.string("name") ?: return null
                val msPrim = obj["ms"] as? JsonPrimitive
                WagerBotStreamEvent.ToolEnd(
                    id = id,
                    name = toolName,
                    ms = msPrim?.intOrNull ?: msPrim?.doubleOrNull?.toInt() ?: 0,
                    ok = obj.boolean("ok") ?: false,
                    summary = obj.string("result_summary") ?: "",
                )
            }

            "wagerbot.follow_ups" -> WagerBotStreamEvent.FollowUps(questions = obj.stringList("questions"))

            "wagerbot.thread_titled" -> {
                val id = obj.string("thread_id") ?: return null
                val title = obj.string("title") ?: return null
                WagerBotStreamEvent.ThreadTitled(id = id, title = title)
            }

            "wagerbot.message_persisted" -> WagerBotStreamEvent.MessagePersisted(role = obj.string("role") ?: "")

            "wagerbot.thinking_delta" -> WagerBotStreamEvent.ThinkingDelta(text = obj.string("text") ?: "")

            "wagerbot.thinking_done" -> WagerBotStreamEvent.ThinkingDone(summary = obj.string("summary") ?: "")

            "wagerbot.game_cards" -> WagerBotStreamEvent.GameCards(cards = decodeListOrEmpty(obj["cards"]))

            "wagerbot.chat_widgets" -> WagerBotStreamEvent.ChatWidgets(widgets = decodeListOrEmpty(obj["widgets"]))

            // V2 chat (wagerbot-agent) rich, tappable components.
            "wagerbot.app_components" -> WagerBotStreamEvent.AppComponents(
                summary = obj.string("summary"),
                components = decodeListOrEmpty<WagerBotAppComponent>(obj["components"]),
            )

            "wagerbot.error" -> WagerBotStreamEvent.Error(
                code = obj.string("code") ?: "unknown",
                message = obj.string("message") ?: "Unknown error",
            )

            else -> null
        }
    }

    private fun parseJsonObject(raw: String): JsonObject? =
        runCatching { WagerproofJson.parseToJsonElement(raw) }.getOrNull() as? JsonObject

    private fun argumentsToString(el: JsonElement?): String = when {
        el == null || el is JsonNull -> "{}"
        // A pre-stringified arguments value passes through unquoted (same as
        // the loadMessages tool_use path).
        el is JsonPrimitive && el.isString -> el.content
        else -> el.toString()
    }

    // Whole-array decode with empty fallback — mirrors Swift's `try? decode … ?? []`
    // (not per-item lossy).
    private inline fun <reified T> decodeListOrEmpty(el: JsonElement?): List<T> {
        if (el == null || el is JsonNull) return emptyList()
        return runCatching { WagerproofJson.decodeFromJsonElement<List<T>>(el) }.getOrDefault(emptyList())
    }
}

// Field accessors matching Swift's strict `as? String` / `as? Bool` casts —
// no lenient number→string coercion.
internal fun JsonObject.string(key: String): String? =
    (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

internal fun JsonObject.boolean(key: String): Boolean? =
    (this[key] as? JsonPrimitive)?.booleanOrNull

internal fun JsonObject.stringList(key: String): List<String> {
    val arr = this[key] as? JsonArray ?: return emptyList()
    // All-or-nothing like Swift's `as? [String]` — any non-string element voids the list.
    return arr.map { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content ?: return emptyList() }
}
