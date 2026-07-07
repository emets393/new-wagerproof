package com.wagerproof.core.services

import com.wagerproof.core.models.WagerBotAppComponent
import com.wagerproof.core.models.WagerBotChatGameCard
import com.wagerproof.core.models.WagerBotChatWidget
import com.wagerproof.core.models.WagerBotContentBlock
import com.wagerproof.core.models.WagerBotMessage
import com.wagerproof.core.models.WagerBotThreadSummary
import com.wagerproof.core.models.WagerBotToolStatus
import com.wagerproof.core.models.serialization.WagerproofJson
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.util.UUID
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement

/**
 * Read/list/delete operations on `chat_threads` + `chat_messages` (Main
 * project). The edge function writes new messages itself — the client only
 * lists threads for the history sheet and rehydrates messages when the user
 * reopens an existing thread. Never write chat_messages from here.
 */
object WagerBotThreadService {

    suspend fun listThreads(userId: String): List<WagerBotThreadSummary> =
        SupabaseClients.main
            .from("chat_threads")
            .select(columns = Columns.raw("id, title, created_at, updated_at, message_count")) {
                filter { eq("user_id", userId) }
                order("updated_at", Order.DESCENDING)
            }
            .decodeList<WagerBotThreadSummary>()

    suspend fun deleteThread(threadId: String) {
        SupabaseClients.main
            .from("chat_threads")
            .delete { filter { eq("id", threadId) } }
    }

    suspend fun deleteAllThreads(userId: String) {
        SupabaseClients.main
            .from("chat_threads")
            .delete { filter { eq("user_id", userId) } }
    }

    @Serializable
    private data class MessageRow(
        val id: String,
        val role: String,
        val content: String? = null,
        val blocks: JsonElement? = null,
        @SerialName("created_at") val createdAt: String,
    )

    /**
     * Hydrate the message list for a thread. Mirrors iOS/RN `loadMessages` —
     * converts persisted `blocks` JSON back into [WagerBotContentBlock] values
     * and drops `tool` role messages (internal to the agent loop, never
     * user-facing).
     */
    suspend fun loadMessages(threadId: String): List<WagerBotMessage> {
        val rows = SupabaseClients.main
            .from("chat_messages")
            .select(columns = Columns.raw("id, role, content, blocks, created_at")) {
                filter { eq("thread_id", threadId) }
                order("created_at", Order.ASCENDING)
            }
            .decodeList<MessageRow>()

        val messages = mutableListOf<WagerBotMessage>()
        for (row in rows) {
            if (row.role == "tool") continue
            val role = WagerBotMessage.Role.entries.firstOrNull { it.raw == row.role } ?: continue

            val entries = normalizeBlocks(row.blocks)
            val blocks = mutableListOf<WagerBotContentBlock>()
            if (entries != null) {
                for (entry in entries) {
                    val type = entry.string("type") ?: continue
                    val blockId = entry.string("id") ?: "b_${UUID.randomUUID().toString().uppercase()}"
                    when (type) {
                        "text" -> {
                            val text = entry.string("text") ?: continue
                            blocks += WagerBotContentBlock.Text(id = blockId, text = text)
                        }

                        "game_cards" -> blocks += WagerBotContentBlock.GameCards(
                            id = blockId,
                            cards = decodeArrayOrEmpty<WagerBotChatGameCard>(entry["cards"]),
                        )

                        "chat_widgets" -> blocks += WagerBotContentBlock.ChatWidgets(
                            id = blockId,
                            widgets = decodeArrayOrEmpty<WagerBotChatWidget>(entry["widgets"]),
                        )

                        "app_components" -> blocks += WagerBotContentBlock.AppComponents(
                            id = blockId,
                            summary = entry.string("summary"),
                            components = decodeArrayOrEmpty<WagerBotAppComponent>(entry["components"]),
                        )

                        "tool_use" -> {
                            val argsEl = entry["arguments"]
                            val argsString = when {
                                argsEl is JsonPrimitive && argsEl.isString -> argsEl.content
                                argsEl != null && argsEl !is JsonNull -> argsEl.toString()
                                else -> "{}"
                            }
                            // Historic tool blocks lack live status — render as
                            // completed with no timing.
                            blocks += WagerBotContentBlock.ToolUse(
                                id = blockId,
                                name = entry.string("name") ?: "",
                                argumentsJson = argsString,
                                status = WagerBotToolStatus.Done(ms = 0, ok = true, summary = ""),
                            )
                        }

                        // Unknown block types skipped (forward compat).
                        else -> continue
                    }
                }
            } else if (!row.content.isNullOrEmpty()) {
                // Pre-blocks rows persisted plain text in `content`.
                blocks += WagerBotContentBlock.Text(id = "legacy_${row.id}", text = row.content)
            }

            if (blocks.isEmpty()) continue
            messages += WagerBotMessage(
                id = row.id,
                role = role,
                blocks = blocks,
                timestamp = row.createdAt,
            )
        }
        return messages
    }

    /**
     * The blocks JSONB may arrive structured OR as a JSON string (some
     * deployments persist it stringified) — re-parse before walking. Returns
     * null when there's no walkable array of objects, which routes the row to
     * the legacy `content` fallback (matches Swift's all-or-nothing
     * `as? [[String: Any]]` cast).
     */
    private fun normalizeBlocks(el: JsonElement?): List<JsonObject>? {
        val resolved: JsonElement = when {
            el == null || el is JsonNull -> return null
            el is JsonPrimitive && el.isString ->
                runCatching { WagerproofJson.parseToJsonElement(el.content) }.getOrNull() ?: return null
            else -> el
        }
        val arr = resolved as? JsonArray ?: return null
        return arr.map { it as? JsonObject ?: return null }
    }

    // Whole-array decode with empty fallback — mirrors Swift's `try? decode … ?? []`.
    private inline fun <reified T> decodeArrayOrEmpty(el: JsonElement?): List<T> {
        if (el == null || el is JsonNull) return emptyList()
        return runCatching { WagerproofJson.decodeFromJsonElement<List<T>>(el) }.getOrDefault(emptyList())
    }
}
