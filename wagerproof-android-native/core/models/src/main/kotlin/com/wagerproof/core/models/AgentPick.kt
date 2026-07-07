package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FallbackEnumSerializer
import com.wagerproof.core.models.serialization.FlexibleDoubleOrOneSerializer
import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import com.wagerproof.core.models.serialization.LossyListSerializer
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.models.serialization.decodeLossyList
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/**
 * Mirror of an `avatar_picks` row (RN `AgentPick`). The `archived_*` JSONB
 * columns are decoded loosely; only fields the UI reads are typed explicitly.
 * Tolerant decode: only id/avatarId/gameId are required.
 */
@Serializable
data class AgentPick(
    val id: String,
    @SerialName("avatar_id") val avatarId: String,
    @SerialName("game_id") val gameId: String,
    val sport: AgentSport = AgentSport.NFL,
    val matchup: String = "",
    @SerialName("game_date") val gameDate: String = "",
    @SerialName("bet_type") val betType: String = "",
    @SerialName("pick_selection") val pickSelection: String = "",
    val odds: String? = null,
    @Serializable(with = FlexibleDoubleOrOneSerializer::class)
    val units: Double = 1.0,
    val confidence: Int = 3,
    @SerialName("reasoning_text") val reasoningText: String = "",
    @SerialName("key_factors") val keyFactors: List<String>? = null,
    val result: PickResultStatus = PickResultStatus.PENDING,
    @SerialName("actual_result") val actualResult: String? = null,
    @SerialName("graded_at") val gradedAt: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    /**
     * Raw `ai_decision_trace` JSONB (leaned metrics, rationale, alignment).
     * Loosely typed — schema drifts across generation versions (v2/v3).
     */
    @SerialName("ai_decision_trace") val aiDecisionTrace: JsonElement? = null,
    /** Raw `ai_audit_payload` JSONB (V3 run_id, steering, decision_trace, overrides). */
    @SerialName("ai_audit_payload") val aiAuditPayload: JsonElement? = null,
) {
    @Serializable(with = PickResultStatusSerializer::class)
    enum class PickResultStatus(val raw: String) {
        WON("won"),
        LOST("lost"),
        PUSH("push"),
        PENDING("pending"),
    }

    companion object {
        /**
         * Decode a pick array from raw PostgREST JSON, skipping rows that fail
         * to parse instead of failing the whole batch — one bad row used to
         * blank all of history + performance charts.
         */
        fun decodeLossyArray(json: Json = WagerproofJson, raw: String): List<AgentPick> =
            json.decodeLossyList(serializer(), raw)

        fun decodeLossyArray(json: Json = WagerproofJson, element: JsonElement?): List<AgentPick> =
            json.decodeLossyList(serializer(), element)
    }
}

object PickResultStatusSerializer : FallbackEnumSerializer<AgentPick.PickResultStatus>(
    serialName = "PickResultStatus",
    rawToValue = AgentPick.PickResultStatus.entries.associateBy { it.raw },
    valueToRaw = { it.raw },
    default = AgentPick.PickResultStatus.PENDING,
)

/** Field-level lossy list for embedding pick arrays inside other payloads. */
object AgentPickLossyListSerializer : LossyListSerializer<AgentPick>(AgentPick.serializer())

/**
 * Row returned by the `get_top_agent_picks_feed_v2` RPC — an `avatar_picks`
 * row joined with the agent's identity + cached perf snapshot (RN
 * `TopAgentPickFeedV2Row`). Required: id/avatarId/gameId/createdAt.
 */
@Serializable
data class TopAgentPickFeedRow(
    val id: String,
    @SerialName("avatar_id") val avatarId: String,
    @SerialName("game_id") val gameId: String,
    val sport: AgentSport = AgentSport.NFL,
    val matchup: String = "",
    @SerialName("game_date") val gameDate: String = "",
    @SerialName("bet_type") val betType: String = "",
    @SerialName("pick_selection") val pickSelection: String = "",
    val odds: String? = null,
    @Serializable(with = FlexibleDoubleOrOneSerializer::class)
    val units: Double = 1.0,
    val confidence: Int = 3,
    @SerialName("reasoning_text") val reasoningText: String = "",
    val result: AgentPick.PickResultStatus = AgentPick.PickResultStatus.PENDING,
    @SerialName("created_at") val createdAt: String,
    @SerialName("agent_name") val agentName: String = "Agent",
    @SerialName("agent_avatar_emoji") val agentAvatarEmoji: String = "🤖",
    @SerialName("agent_avatar_color") val agentAvatarColor: String = "#6366f1",
    @SerialName("agent_wins") val agentWins: Int = 0,
    @SerialName("agent_losses") val agentLosses: Int = 0,
    @SerialName("agent_pushes") val agentPushes: Int = 0,
    @SerialName("agent_net_units")
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val agentNetUnits: Double = 0.0,
    @SerialName("agent_rank") val agentRank: Int? = null,
    /** Snapshot of the agent's personality at pick time — drives feed-card strategy chips. */
    @SerialName("archived_personality") val archivedPersonality: AgentPersonalityParams? = null,
    /** 0 until the feed RPC is extended to return it; form chart degrades to a blank streak. */
    @SerialName("agent_current_streak") val agentCurrentStreak: Int = 0,
) {
    /**
     * Adapt a feed row into the `AgentPick` shape the ticket views consume.
     * The feed RPC omits `key_factors`/`actual_result`/`graded_at` (not shown
     * on the mini ticket), so those stay null.
     */
    val asAgentPick: AgentPick
        get() = AgentPick(
            id = id, avatarId = avatarId, gameId = gameId, sport = sport,
            matchup = matchup, gameDate = gameDate, betType = betType,
            pickSelection = pickSelection, odds = odds, units = units,
            confidence = confidence, reasoningText = reasoningText,
            keyFactors = null, result = result, actualResult = null,
            gradedAt = null, createdAt = createdAt,
        )
}
