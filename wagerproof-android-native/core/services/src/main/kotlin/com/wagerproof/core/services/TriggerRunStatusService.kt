package com.wagerproof.core.services

import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Trigger.dev run status as returned by the `trigger-run-status` edge function.
 * Local to the service (mirrors its Swift home in TriggerRunStatusService.swift).
 */
@Serializable
data class TriggerV3RunStatus(
    val id: String,
    val status: String,
    val metadata: TriggerV3RunMetadata = TriggerV3RunMetadata(),
    val updatedAt: String? = null,
    val startedAt: String? = null,
    val finishedAt: String? = null,
) {
    val isTerminal: Boolean get() = status.uppercase() in TERMINAL_STATUSES

    val isSuccessful: Boolean get() = status.uppercase() == "COMPLETED"

    // Not private: the @Serializable plugin generates serializer() on this companion.
    companion object {
        // Trigger.dev's real terminal set (RunStatus in @trigger.dev/core).
        // TIMED_OUT + SYSTEM_FAILURE were bug fixes — dropping them let a
        // genuinely-dead run poll for its full ~11 min budget. Do not remove.
        val TERMINAL_STATUSES = setOf(
            "COMPLETED", "CANCELED", "FAILED", "CRASHED",
            "INTERRUPTED", "EXPIRED", "TIMED_OUT", "SYSTEM_FAILURE",
        )
    }
}

/**
 * Run metadata the worker publishes for live progress. Keys are camelCase on
 * the wire (Trigger.dev metadata, not a Postgres row). Ints decode lossily
 * (int|double|string) because the worker's metadata typing has drifted.
 */
@Serializable
data class TriggerV3RunMetadata(
    val phase: String? = null,
    val phaseDetail: String? = null,
    val currentTool: String? = null,
    val currentToolDetail: String? = null,
    @Serializable(with = FlexibleIntSerializer::class) val turn: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val maxTurns: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val toolCalls: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val picksAccepted: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val picksRejected: Int? = null,
    @Serializable(with = FlexibleIntSerializer::class) val submitAttempt: Int? = null,
    val note: String? = null,
)

/**
 * Polls a Trigger.dev run via the `trigger-run-status` edge function (Main
 * project). We deliberately do NOT hit Trigger.dev directly: its run-retrieve
 * API 401s hand-rolled public-access tokens; the edge function holds the
 * Trigger SECRET key server-side and returns just the fields we render.
 */
object TriggerRunStatusService {

    /** Fetch a run's live status + metadata. Throws [EdgeFunctions.NoSessionException] when signed out. */
    suspend fun fetch(runId: String): TriggerV3RunStatus {
        val token = EdgeFunctions.requireAccessToken()
        val body = buildJsonObject { put("run_id", runId) }
        val response = EdgeFunctions.post("trigger-run-status", body.toString(), token)
        if (!response.isSuccess) {
            val message = runCatching {
                ((WagerproofJson.parseToJsonElement(response.body) as? JsonObject)
                    ?.get("error") as? JsonPrimitive)?.takeIf { it.isString }?.content
            }.getOrNull()
            throw IllegalStateException(message ?: "Run status request failed (${response.status})")
        }
        return WagerproofJson.decodeFromString(TriggerV3RunStatus.serializer(), response.body)
    }
}
