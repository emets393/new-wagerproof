package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FallbackEnumSerializer
import com.wagerproof.core.models.serialization.FlexibleDoubleOrOneSerializer
import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.LossyListSerializer
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.models.serialization.decodeLossyList
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * Sport tag on a parlay TICKET (`avatar_parlays.sport`). Deliberately a
 * separate enum from [AgentSport]: tickets can be `'multi'` (cross-sport),
 * but `AgentSport` is exhaustively switched across the creation wizard,
 * settings, and leaderboard where "multi" is never a selectable sport.
 * Individual legs always carry a concrete `AgentSport`.
 */
@Serializable(with = AgentParlaySportSerializer::class)
enum class AgentParlaySport(val raw: String) {
    NFL("nfl"),
    CFB("cfb"),
    NBA("nba"),
    NCAAB("ncaab"),
    MLB("mlb"),
    MULTI("multi");

    val label: String
        get() = when (this) {
            MULTI -> "Multi"
            else -> raw.uppercase()
        }

    /**
     * The concrete sport when the ticket is single-sport; null for `'multi'`.
     * Used by sport filters that only understand `AgentSport`.
     */
    val asAgentSport: AgentSport?
        get() = AgentSport.entries.firstOrNull { it.raw == raw }
}

/** Unknown ticket sports decode as MULTI (Swift `?? .multi`). */
object AgentParlaySportSerializer : FallbackEnumSerializer<AgentParlaySport>(
    serialName = "AgentParlaySport",
    rawToValue = AgentParlaySport.entries.associateBy { it.raw },
    valueToRaw = { it.raw },
    default = AgentParlaySport.MULTI,
)

/** Daily tickets expire with their target date; weekly tickets persist for the football week. */
@Serializable(with = AgentParlayScopeSerializer::class)
enum class AgentParlayScope(val raw: String) { DAILY("daily"), WEEKLY("weekly") }

object AgentParlayScopeSerializer : FallbackEnumSerializer<AgentParlayScope>(
    serialName = "AgentParlayScope",
    rawToValue = AgentParlayScope.entries.associateBy { it.raw },
    valueToRaw = { it.raw },
    default = AgentParlayScope.DAILY,
)

/**
 * Mirror of an `avatar_parlay_legs` row — one leg of a parlay ticket. Legs
 * are graded individually with the same result vocabulary as straight picks
 * ([AgentPick.PickResultStatus]); the ticket's roll-up lives on [AgentParlay].
 */
@Serializable
data class AgentParlayLeg(
    val id: String,
    @SerialName("parlay_id") val parlayId: String = "",
    @SerialName("game_id") val gameId: String = "",
    val sport: AgentSport = AgentSport.NFL,
    val matchup: String = "",
    @SerialName("game_date") val gameDate: String = "",
    @SerialName("bet_type") val betType: String = "",
    val period: String = "full",
    @SerialName("pick_selection") val pickSelection: String = "",
    val odds: String? = null,
    @SerialName("prop_player") val propPlayer: String? = null,
    @SerialName("prop_market") val propMarket: String? = null,
    @SerialName("prop_line")
    @Serializable(with = FlexibleDoubleSerializer::class)
    val propLine: Double? = null,
    @SerialName("prop_direction") val propDirection: String? = null,
    @SerialName("leg_result") val legResult: AgentPick.PickResultStatus = AgentPick.PickResultStatus.PENDING,
    @SerialName("graded_at") val gradedAt: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

/** Lossy nested decode — one malformed leg drops out instead of blanking the ticket. */
object AgentParlayLegLossyListSerializer : LossyListSerializer<AgentParlayLeg>(AgentParlayLeg.serializer())

/**
 * Mirror of an `avatar_parlays` row — one staked multi-leg ticket. Legs come
 * embedded under a `legs` key: direct client reads alias the PostgREST embed
 * (`legs:avatar_parlay_legs(*)`) and the v3 read RPCs jsonb_set the same key,
 * so both paths decode identically.
 */
@Serializable
data class AgentParlay(
    val id: String,
    @SerialName("avatar_id") val avatarId: String,
    val sport: AgentParlaySport = AgentParlaySport.MULTI,
    @SerialName("legs_count") val legsCount: Int = 0,
    @SerialName("combined_odds") val combinedOdds: String? = null,
    @Serializable(with = FlexibleDoubleOrOneSerializer::class)
    val units: Double = 1.0,
    val confidence: Int = 3,
    @SerialName("reasoning_text") val reasoningText: String = "",
    @SerialName("key_factors") val keyFactors: List<String>? = null,
    @SerialName("ai_decision_trace") val aiDecisionTrace: JsonElement? = null,
    @SerialName("ai_audit_payload") val aiAuditPayload: JsonElement? = null,
    @SerialName("archived_personality") val archivedPersonality: AgentPersonalityParams? = null,
    val result: AgentPick.PickResultStatus = AgentPick.PickResultStatus.PENDING,
    @SerialName("actual_result") val actualResult: String? = null,
    @SerialName("graded_at") val gradedAt: String? = null,
    @SerialName("target_date") val targetDate: String = "",
    val scope: AgentParlayScope = AgentParlayScope.DAILY,
    @SerialName("week_key") val weekKey: String? = null,
    @SerialName("is_auto_generated") val isAutoGenerated: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
    @Serializable(with = AgentParlayLegLossyListSerializer::class)
    val legs: List<AgentParlayLeg> = emptyList(),
) {
    val isWeekly: Boolean get() = scope == AgentParlayScope.WEEKLY
    /**
     * Legs count with a fallback to the embedded array (older rows or
     * partially-decoded payloads may miss the column).
     */
    val displayLegsCount: Int get() = maxOf(legsCount, legs.size)

    /**
     * The settled decimal odds the grader stashed in `ai_audit_payload` at
     * finalize time (drop-and-reprice: a pushed leg falls out and the ticket
     * re-prices on the surviving won legs, so this may differ from
     * `combined_odds`). Null until graded or when the payload is absent.
     */
    val settledDecimalOdds: Double?
        get() {
            // Accept JSON double or int only — a string/bool value means a
            // corrupt payload and reads as absent (Swift .double/.int cases).
            val prim = (aiAuditPayload as? JsonObject)?.get("settled_decimal") as? JsonPrimitive ?: return null
            if (prim.isString) return null
            return prim.doubleOrNull
        }

    /** The ticket's earliest leg date — used when `target_date` is missing. */
    val earliestLegDate: String?
        get() = legs.map { it.gameDate }.filter { it.isNotEmpty() }.minOrNull()

    /** Date used for "today / history" bucketing, mirroring `AgentPick.gameDate`. */
    val displayDate: String
        get() = targetDate.ifEmpty { earliestLegDate ?: "" }

    companion object {
        /** Element-wise decode that skips malformed tickets (Swift `decodeLossyArray(from: Data)`). */
        fun decodeLossyArray(jsonString: String, json: Json = WagerproofJson): List<AgentParlay> =
            json.decodeLossyList(serializer(), jsonString)

        fun decodeLossyArray(element: JsonElement?, json: Json = WagerproofJson): List<AgentParlay> =
            json.decodeLossyList(serializer(), element)
    }
}

/** Lossy ticket-array decode shared by snapshot/page envelopes. */
object AgentParlayLossyListSerializer : LossyListSerializer<AgentParlay>(AgentParlay.serializer())
