package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FallbackEnumSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.util.UUID

/**
 * Mirror of the RN `AgentDetailSnapshotV2` interface in
 * `services/agentPicksService.ts:35-43`. Returned by the
 * `agent-authorized-action-v1` edge function with action `detail_snapshot`.
 *
 * The `agent` field is the full `Agent` row (includes JSONB), `performance`
 * is the cached row from `avatar_performance_cache`, `todaysPicks` is the
 * pre-filtered slice for today, and `todaysGenerationRun` is the most recent
 * successful generation run so the UI can distinguish "hasn't run" from
 * "ran and skipped".
 */
@Serializable
data class AgentDetailSnapshot(
    @SerialName("api_version") val apiVersion: String = "v3",
    val agent: Agent? = null,
    val performance: AgentPerformance? = null,
    @SerialName("todays_picks")
    @Serializable(with = AgentPickLossyListSerializer::class)
    val todaysPicks: List<AgentPick> = emptyList(),
    /** Today's parlay tickets. `[]` until the RPC migration that adds `todays_parlays` is live. */
    @SerialName("todays_parlays")
    @Serializable(with = AgentParlayLossyListSerializer::class)
    val todaysParlays: List<AgentParlay> = emptyList(),
    @SerialName("weekly_parlays")
    @Serializable(with = AgentParlayLossyListSerializer::class)
    val weeklyParlays: List<AgentParlay> = emptyList(),
    @SerialName("weekly_generations_remaining") val weeklyGenerationsRemaining: Int? = null,
    @SerialName("week_key") val weekKey: String? = null,
    @SerialName("todays_generation_run") val todaysGenerationRun: AgentGenerationRunSummary? = null,
    /**
     * A LIVE run (queued/processing, started in the last ~12 min). Non-null
     * means a generation is in flight right now — the client resumes polling
     * it instead of offering a fresh trigger (which would race).
     */
    @SerialName("active_generation_run") val activeGenerationRun: AgentGenerationRunSummary? = null,
    @SerialName("can_view_agent_picks") val canViewAgentPicks: Boolean = false,
    @SerialName("is_following") val isFollowing: Boolean? = null,
)

/** Page response for the agent pick history endpoint. Mirrors RN `AgentPicksPageV2`. */
@Serializable
data class AgentPicksPage(
    @SerialName("api_version") val apiVersion: String = "v3",
    @Serializable(with = AgentPickLossyListSerializer::class)
    val picks: List<AgentPick> = emptyList(),
    /**
     * Parlay tickets — the RPC returns them on the FIRST page only (tickets
     * are few; they don't join the pick cursor). `[]` on cursor pages.
     */
    @Serializable(with = AgentParlayLossyListSerializer::class)
    val parlays: List<AgentParlay> = emptyList(),
    @SerialName("next_cursor") val nextCursor: String? = null,
    @SerialName("has_more") val hasMore: Boolean = false,
)

/**
 * Mirror of `agent_generation_runs` row projection used by the snapshot.
 * Used to detect "ran and chose not to publish" outcomes so the detail
 * screen can render an empathetic terminal-style "Analysis complete" tile.
 */
@Serializable
data class AgentGenerationRunSummary(
    val id: String,
    @SerialName("avatar_id") val avatarId: String = "",
    @SerialName("generation_type") val generationType: String? = null,
    @SerialName("target_date") val targetDate: String? = null,
    val status: String? = null,
    @SerialName("weak_slate") val weakSlate: Boolean = false,
    @SerialName("no_games") val noGames: Boolean = false,
    @SerialName("picks_generated") val picksGenerated: Int = 0,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("slate_note") val slateNote: String? = null,
    /**
     * Trigger.dev run id — set on `active_generation_run` rows so the client
     * can resume live polling of an in-flight run.
     */
    @SerialName("trigger_run_id") val triggerRunId: String? = null,
    /** `daily` or `weekly`; controls which generation surface resumes. */
    @SerialName("run_scope") val runScope: String? = null,
)

/**
 * Returned by `request_generation`. Mirrors the structured response from the
 * V2 enqueue + worker pipeline.
 */
@Serializable
data class GenerationRequestResult(
    val queued: Boolean = false,
    @SerialName("job_id") val jobId: String? = null,
    @SerialName("ledger_run_id") val ledgerRunId: String? = null,
    @SerialName("run_id") val runId: String? = null,
    @SerialName("public_access_token") val publicAccessToken: String? = null,
    val status: String? = null,
    val result: GenerationResult? = null,
)

@Serializable
data class GenerationResult(
    @SerialName("picks_generated") val picksGenerated: Int = 0,
    @SerialName("slate_note") val slateNote: String? = null,
    @Serializable(with = AgentPickLossyListSerializer::class)
    val picks: List<AgentPick> = emptyList(),
)

/**
 * Per-pick "audit payload" the agent-pick audit widget renders. Derived
 * client-side from the pick's `ai_decision_trace` / `ai_audit_payload` JSONB
 * (see [from]); NOT serialized. Kept loosely typed since the schema drifts
 * across model versions.
 */
data class AgentPickAuditPayload(
    val leanedMetrics: List<LeanedMetric> = emptyList(),
    val rationaleText: String = "",
    val personalityAlignmentText: String = "",
    val modelInputGameJSON: String = "{}",
    val modelInputPersonalityJSON: String = "{}",
    val modelResponseJSON: String = "{}",
    val payloadIsFormatted: Boolean = false,
    /**
     * The COMPLETE audit dump (pick fields + ai_decision_trace +
     * ai_audit_payload) as one pretty-printed JSON string — what the
     * "Copy Full Trace" button puts on the clipboard for debugging.
     */
    val fullTraceJSON: String = "{}",
    /**
     * V3 only: the generation loop's tool calls (name, timing, result excerpt)
     * embedded in `ai_audit_payload.tool_trace`. Empty for V2/legacy picks.
     */
    val toolTrace: List<ToolTraceEntry> = emptyList(),
    /** Raw `tool_trace` array pretty-printed for the section copy button. */
    val toolTraceJSON: String = "[]",
) {
    data class ToolTraceEntry(
        val seq: Int,
        val name: String,
        val ms: Int,
        val ok: Boolean,
        val resultExcerpt: String,
        // Fresh id per parse, matching Swift's `let id = UUID()` list identity.
        val id: String = UUID.randomUUID().toString(),
    )

    data class LeanedMetric(
        val metricKey: String,
        val metricValue: String,
        val whyItMattered: String,
        val personalityTrait: String,
        val id: String = UUID.randomUUID().toString(),
    )

    companion object {
        /**
         * Builds the audit payload from the REAL `ai_decision_trace` /
         * `ai_audit_payload` JSONB when present (both V2 and V3 generation
         * payloads), falling back to the public pick fields for legacy rows
         * where the trace is missing. Port of iOS `AgentPickAuditStore.buildPayload`.
         */
        fun from(pick: AgentPick): AgentPickAuditPayload {
            val trace = pick.aiDecisionTrace
            val audit = pick.aiAuditPayload

            // Leaned metrics: real trace first, key_factors fallback.
            var leaned: List<LeanedMetric> = (trace.child("leaned_metrics").arr() ?: emptyList()).mapNotNull { m ->
                // V3 tool-schema uses metric_key; lenient Zod also lets "metric" through.
                val key = m.child("metric_key").str() ?: m.child("metric").str() ?: return@mapNotNull null
                LeanedMetric(
                    metricKey = key,
                    metricValue = m.child("metric_value").str() ?: "",
                    whyItMattered = m.child("why_it_mattered").str() ?: "",
                    personalityTrait = m.child("personality_trait").str()
                        ?: m.child("source_tool_call_id")?.let { "source: ${it.str() ?: "?"}" }
                        ?: "",
                )
            }
            if (leaned.isEmpty()) {
                leaned = (pick.keyFactors ?: emptyList()).mapIndexed { idx, factor ->
                    LeanedMetric(
                        metricKey = "key_factor_${idx + 1}",
                        metricValue = factor,
                        whyItMattered = factor,
                        personalityTrait = "fallback_from_key_factors",
                    )
                }
            }

            val rationale = trace.child("rationale_summary").str()
                ?: pick.reasoningText.ifEmpty { "No rationale text available." }
            val alignment = trace.child("personality_alignment").str()
                ?: "No personality-alignment trace stored for this pick."

            // Model input/response panes. V2 stores model_input_*; V3 stores the
            // resolved steering instead of a stuffed input payload (the input was
            // the agentic tool loop — see the run-level v3_tool_trace).
            val gameJson = audit.child("model_input_game_payload")?.pretty() ?: "{}"
            val personalityJson = audit.child("model_input_personality_payload")?.pretty()
                ?: audit.child("steering")?.pretty()
                ?: "{}"
            val responseJson = audit.child("model_response_payload")?.pretty() ?: "{}"
            val isV3 = audit.child("generation_version").str() == "v3"

            // V3 embeds the loop's tool calls in ai_audit_payload.tool_trace
            // (seq 0 = the slate the model was shown). Empty for V2/legacy picks.
            val toolTraceValue = audit.child("tool_trace")
            val toolTrace: List<ToolTraceEntry> = (toolTraceValue.arr() ?: emptyList())
                .mapNotNull { entry ->
                    val name = entry.child("name").str() ?: return@mapNotNull null
                    ToolTraceEntry(
                        seq = entry.child("seq").int() ?: 0,
                        name = name,
                        ms = entry.child("ms").int() ?: 0,
                        ok = entry.child("ok").bool() ?: false,
                        resultExcerpt = entry.child("result_excerpt").str()
                            ?: entry.child("result_summary").str()
                            ?: "",
                    )
                }
                .sortedBy { it.seq }

            // Full export: every audit artifact in one copyable JSON document.
            val full = buildJsonObject {
                putJsonObject("pick") {
                    put("id", pick.id)
                    put("game_id", pick.gameId)
                    put("sport", pick.sport.raw)
                    put("matchup", pick.matchup)
                    put("game_date", pick.gameDate)
                    put("bet_type", pick.betType)
                    put("pick_selection", pick.pickSelection)
                    put("odds", pick.odds ?: "")
                    put("units", pick.units)
                    put("confidence", pick.confidence)
                    put("result", pick.result.raw)
                    put("reasoning_text", pick.reasoningText)
                    putJsonArray("key_factors") { (pick.keyFactors ?: emptyList()).forEach { add(it) } }
                    put("created_at", pick.createdAt)
                }
                put("ai_decision_trace", trace ?: JsonNull)
                put("ai_audit_payload", audit ?: JsonNull)
            }

            return AgentPickAuditPayload(
                leanedMetrics = leaned,
                rationaleText = rationale,
                personalityAlignmentText = alignment,
                modelInputGameJSON = gameJson,
                modelInputPersonalityJSON = personalityJson,
                modelResponseJSON = responseJson,
                payloadIsFormatted = isV3 || audit.child("model_input_game_payload") != null,
                fullTraceJSON = full.pretty(),
                toolTrace = toolTrace,
                toolTraceJSON = toolTraceValue?.pretty() ?: "[]",
            )
        }

        // JSONValue-accessor ports (JSONValue.swift), scoped here to avoid
        // clashing with the shared JsonElement extensions.
        private fun JsonElement?.child(key: String): JsonElement? = (this as? JsonObject)?.get(key)

        private fun JsonElement?.str(): String? =
            (this as? JsonPrimitive)?.takeIf { it.isString }?.content

        private fun JsonElement?.arr(): List<JsonElement>? = this as? JsonArray

        private fun JsonElement?.int(): Int? {
            val prim = (this as? JsonPrimitive)?.takeIf { !it.isString } ?: return null
            return prim.intOrNull ?: prim.doubleOrNull?.toInt()
        }

        private fun JsonElement?.bool(): Boolean? =
            (this as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull

        private val prettyJson = Json { prettyPrint = true }

        // Swift pretty-prints with sortedKeys for stable copy/paste output —
        // kotlinx has no flag for that, so sort recursively before encoding.
        private fun sortedKeys(element: JsonElement): JsonElement = when (element) {
            is JsonObject -> JsonObject(
                element.entries.sortedBy { it.key }.associate { it.key to sortedKeys(it.value) },
            )
            is JsonArray -> JsonArray(element.map { sortedKeys(it) })
            else -> element
        }

        private fun JsonElement.pretty(): String =
            runCatching { prettyJson.encodeToString(JsonElement.serializer(), sortedKeys(this)) }
                .getOrDefault("{}")
    }
}

/**
 * One message in the per-agent chat thread (user ↔ agent). Stored in
 * `agent_chat_messages` on main Supabase. Mirrors RN `AgentChatMessage`
 * from `services/agentChatService.ts`.
 */
@Serializable
data class AgentChatMessage(
    val id: String,
    @SerialName("avatar_id") val avatarId: String = "",
    @SerialName("user_id") val userId: String = "",
    val role: Role = Role.USER,
    val content: String = "",
    @SerialName("created_at") val createdAt: String = "",
) {
    @Serializable(with = AgentChatMessageRoleSerializer::class)
    enum class Role(val raw: String) {
        USER("user"),
        ASSISTANT("assistant"),
        SYSTEM("system"),
    }
}

/** Unknown roles decode as USER (Swift `?? .user`). */
object AgentChatMessageRoleSerializer : FallbackEnumSerializer<AgentChatMessage.Role>(
    serialName = "AgentChatMessage.Role",
    rawToValue = AgentChatMessage.Role.entries.associateBy { it.raw },
    valueToRaw = { it.raw },
    default = AgentChatMessage.Role.USER,
)
