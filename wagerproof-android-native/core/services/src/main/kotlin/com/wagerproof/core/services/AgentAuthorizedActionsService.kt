package com.wagerproof.core.services

import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentDetailSnapshot
import com.wagerproof.core.models.AgentPicksPage
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.serializer

/**
 * Generic client for the `agent-authorized-action-v1` edge function (Main
 * project). Every authenticated agent server action funnels through it; the
 * function enforces RLS-by-action and answers with a `{ success, data, error }`
 * envelope. Port of iOS `AgentAuthorizedActionsService.swift`.
 */
object AgentAuthorizedActionsService {

    /** Mirrors Swift `ActionError`: noSession / server(String) / malformedResponse. */
    sealed class ActionException(message: String) : Exception(message) {
        class NoSession : ActionException("Not signed in")
        class Server(message: String) : ActionException(message)
        class MalformedResponse : ActionException("Unexpected server response")
    }

    /**
     * Generic invoke. The bearer token is attached explicitly via
     * [EdgeFunctions.post] — SDK auto-auth sometimes drops the header on
     * `verify_jwt=false` functions.
     */
    suspend fun <T : Any> invoke(
        body: JsonObject,
        deserializer: KSerializer<T>,
        fallbackMessage: String = "Request failed",
    ): T {
        val token = EdgeFunctions.accessTokenOrNull() ?: throw ActionException.NoSession()

        // body.toString() keeps null-free JSON: callers build objects
        // conditionally, so absent fields are truly absent on the wire.
        val response = EdgeFunctions.post("agent-authorized-action-v1", body.toString(), token)

        val envelope = runCatching { WagerproofJson.parseToJsonElement(response.body) }
            .getOrNull() as? JsonObject
            ?: throw ActionException.MalformedResponse()

        // Lenient envelope decode (Swift ActionEnvelope): missing/invalid
        // `success` reads as false so a half-formed response still surfaces
        // the server error path instead of crashing decode.
        val success = (envelope["success"] as? JsonPrimitive)?.booleanOrNull ?: false
        val data = envelope["data"]?.takeUnless { it is JsonNull }
        if (success && data != null) {
            runCatching { WagerproofJson.decodeFromJsonElement(deserializer, data) }
                .getOrNull()
                ?.let { return it }
        }

        val error = (envelope["error"] as? JsonPrimitive)?.takeIf { it.isString }?.content
        throw ActionException.Server(error ?: fallbackMessage)
    }

    /** Reified convenience over [invoke]. */
    suspend inline fun <reified T : Any> invoke(
        body: JsonObject,
        fallbackMessage: String = "Request failed",
    ): T = invoke(body, serializer(), fallbackMessage)

    /**
     * Snapshot for the agent detail screen: agent + perf + today's picks +
     * today's generation run + can_view + is_following.
     */
    suspend fun detailSnapshot(agentId: String): AgentDetailSnapshot = invoke(
        body = buildJsonObject {
            put("action", "detail_snapshot")
            put("agent_id", agentId)
        },
        deserializer = AgentDetailSnapshot.serializer(),
        fallbackMessage = "Failed to load agent detail snapshot",
    )

    /** Create agent — full payload as a raw object (Swift `[String: AnyEncodable]`). */
    suspend fun createAgent(payload: JsonObject): Agent = invoke(
        body = buildJsonObject {
            put("action", "create_agent")
            put("data", payload)
        },
        deserializer = Agent.serializer(),
        fallbackMessage = "Failed to create agent",
    )

    /** Update agent — partial payload. */
    suspend fun updateAgent(agentId: String, payload: JsonObject): Agent = invoke(
        body = buildJsonObject {
            put("action", "update_agent")
            put("agent_id", agentId)
            put("data", payload)
        },
        deserializer = Agent.serializer(),
        fallbackMessage = "Failed to update agent",
    )

    /** Paginated pick history (cursor pagination). */
    suspend fun picksPage(
        agentId: String,
        filter: String = "all",
        pageSize: Int = 20,
        cursor: String? = null,
        includeOverlap: Boolean = false,
        gameDate: String? = null,
    ): AgentPicksPage = invoke(
        body = buildJsonObject {
            put("action", "picks_page")
            put("agent_id", agentId)
            put("filter", filter)
            put("page_size", pageSize)
            cursor?.let { put("cursor", it) }
            put("include_overlap", includeOverlap)
            gameDate?.let { put("game_date", it) }
        },
        deserializer = AgentPicksPage.serializer(),
        fallbackMessage = "Failed to load agent picks",
    )

    @Serializable
    private data class DeleteAck(val deleted: Boolean? = null)

    /** Delete one pending straight pick and synchronously recalculate performance. */
    suspend fun deletePick(agentId: String, pickId: String) {
        invoke<DeleteAck>(
            body = buildJsonObject {
                put("action", "delete_pick")
                put("agent_id", agentId)
                put("data", buildJsonObject { put("pick_id", pickId) })
            },
            fallbackMessage = "Failed to delete pick",
        )
    }

    /** Delete a pending parlay; the server refuses tickets with settled legs. */
    suspend fun deleteParlay(agentId: String, parlayId: String) {
        invoke<DeleteAck>(
            body = buildJsonObject {
                put("action", "delete_parlay")
                put("agent_id", agentId)
                put("data", buildJsonObject { put("parlay_id", parlayId) })
            },
            fallbackMessage = "Failed to delete parlay",
        )
    }
}
