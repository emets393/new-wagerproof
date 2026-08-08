package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.OptionalFallbackEnumSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Saved analysis **systems** — a filter snapshot plus an explicit bet-side, graded
 * nightly by `grade-analysis-systems` and ranked on the public Systems Leaderboard.
 * Port of iOS `WagerproofModels/HistoricalAnalysis.swift:467-804`.
 *
 * See `.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md`. The grader replays
 * `rpc_bet_type` / `rpc_filters` against the warehouse, so a row written WITHOUT
 * those columns can never be scored — it is a plain bookmark, not a system.
 */

/**
 * Which side a saved system bets. Never surface these raw values in UI — use the
 * [AnalysisSystemCopy] plain-English helpers instead.
 */
enum class AnalysisSystemVerdict(val raw: String) {
    TEAM("team"),
    FADE("fade"),
    OVER("over"),
    UNDER("under"),
}

/**
 * Unknown / absent verdict decodes to null (legacy bookmark rows have no verdict).
 * Applied at the property site — a nullable serializer can't be a class default.
 */
object AnalysisSystemVerdictSerializer : OptionalFallbackEnumSerializer<AnalysisSystemVerdict>(
    serialName = "AnalysisSystemVerdict",
    rawToValue = AnalysisSystemVerdict.entries.associateBy { it.raw },
    valueToRaw = { it.raw },
)

/** Grader-computed record: `{n,wins,losses,pushes,hit_pct,roi,units}`. */
@Serializable
data class AnalysisSystemRecord(
    val n: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val pushes: Int = 0,
    @SerialName("hit_pct") val hitPct: Double? = null,
    val roi: Double? = null,
    val units: Double? = null,
)

/** Newest-first last-10 form: `results` holds 1 = win, 0 = loss. */
@Serializable
data class AnalysisSystemLast10(
    val n: Int = 0,
    val wins: Int = 0,
    val results: List<Int> = emptyList(),
)

/** Current run: `kind` is "win" or "loss", `len` its length. */
@Serializable
data class AnalysisSystemStreak(
    val kind: String = "win",
    val len: Int = 0,
)

/**
 * Row from the anon-callable `analysis_systems_leaderboard` RPC. Every number is
 * grader-computed — never recompute client-side, the page and the grader must
 * agree exactly.
 */
@Serializable
data class AnalysisSystemsLeaderboardRow(
    val sport: String = "",
    @SerialName("system_id") val systemId: String = "",
    val name: String = "Untitled",
    @Serializable(with = AnalysisSystemVerdictSerializer::class)
    val verdict: AnalysisSystemVerdict? = null,
    @SerialName("bet_type") val betType: String = "",
    @SerialName("rpc_bet_type") val rpcBetType: String? = null,
    /** Raw UI snapshot; decoded into [filters] so a bad blob can't blank the board. */
    @SerialName("filters") val filtersRaw: JsonElement? = null,
    val username: String = "user",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("since_saved") val sinceSaved: AnalysisSystemRecord? = null,
    @SerialName("all_time") val allTime: AnalysisSystemRecord? = null,
    @SerialName("current_season") val currentSeason: AnalysisSystemRecord? = null,
    @SerialName("season_label") val seasonLabel: Int? = null,
    val last10: AnalysisSystemLast10? = null,
    val streak: AnalysisSystemStreak? = null,
    @SerialName("graded_at") val gradedAt: String? = null,
) {
    /**
     * Stable list key. Falls back to the row's identity fields rather than "" —
     * two ungraded rows sharing an empty `system_id` would crash a keyed LazyColumn.
     */
    val id: String get() = systemId.ifEmpty { "$sport|$username|$name|$betType" }

    /**
     * Null when the row carries no usable snapshot — the detail view then disables
     * "Use This System" instead of applying an all-defaults search (iOS soft-decode).
     */
    @Transient
    val filters: HistoricalAnalysisUISnapshot? = (filtersRaw as? JsonObject)?.let { obj ->
        runCatching {
            val ownerSport = HistoricalAnalysisSport.entries
                .firstOrNull { it.raw.equals(sport, ignoreCase = true) }
                ?: HistoricalAnalysisSport.inferFromBetType(betType)
            HistoricalAnalysisUISnapshotSerializer.decodeWithDefaults(
                element = obj,
                defaults = HistoricalAnalysisUISnapshot.defaults(ownerSport).also { defaults ->
                    if (betType.isNotEmpty()) defaults.betType = betType
                },
            )
        }.getOrNull()
    }

    /** Displayed verdict; legacy rows without one still read as "bets the team". */
    val effectiveVerdict: AnalysisSystemVerdict get() = verdict ?: AnalysisSystemVerdict.TEAM
}

/** Card-level hot/cold signal for leaderboard accents + badge. */
enum class SystemTemperature { FIRE, ICE, NEUTRAL }

/** Sample-size badge tier (10–29 Early / 30–99 Established / 100+ Proven). */
enum class SystemSampleBadge(val label: String) {
    EARLY("Early"),
    ESTABLISHED("Established"),
    PROVEN("Proven"),
}

/**
 * Plain-English copy for the systems surfaces — never expose verdict / RPC jargon
 * to users. Port of iOS `AnalysisSystemCopy`; thresholds must stay in sync with
 * web `src/features/analysis/systems/analysisSystemsService.ts`.
 */
object AnalysisSystemCopy {

    /** e.g. "Bets the Under" / "Bets ON matching teams" / "Fades matching teams". */
    fun verdictLabel(verdict: AnalysisSystemVerdict?): String = when (verdict) {
        AnalysisSystemVerdict.OVER -> "Bets the Over"
        AnalysisSystemVerdict.UNDER -> "Bets the Under"
        AnalysisSystemVerdict.TEAM -> "Bets ON matching teams"
        AnalysisSystemVerdict.FADE -> "Fades matching teams"
        null -> "Filters only (save again to track as a System)"
    }

    /** Fragment for "We'll track … as if you bet X". */
    fun betPhrase(verdict: AnalysisSystemVerdict): String = when (verdict) {
        AnalysisSystemVerdict.OVER -> "the Over"
        AnalysisSystemVerdict.UNDER -> "the Under"
        AnalysisSystemVerdict.TEAM -> "on these teams"
        AnalysisSystemVerdict.FADE -> "against these teams"
    }

    /** Short "bets {side}" for the viewing banner. */
    fun sideWord(verdict: AnalysisSystemVerdict?): String = when (verdict) {
        AnalysisSystemVerdict.OVER -> "the Over"
        AnalysisSystemVerdict.UNDER -> "the Under"
        AnalysisSystemVerdict.TEAM -> "on matching teams"
        AnalysisSystemVerdict.FADE -> "against matching teams"
        null -> ""
    }

    /** "2-1 since you saved" / "0-0 so far" / null → still waiting on matching games. */
    fun sinceSavedLabel(record: AnalysisSystemRecord?): String = when {
        record == null -> "Waiting on matching games"
        record.n == 0 -> "0-0 so far"
        else -> "${record.wins}-${record.losses} since you saved"
    }

    fun recordText(record: AnalysisSystemRecord?): String = when {
        record == null -> "—"
        record.n == 0 -> "0-0 so far"
        record.pushes > 0 -> "${record.wins}-${record.losses}-${record.pushes}"
        else -> "${record.wins}-${record.losses}"
    }

    fun sampleBadge(n: Int?): SystemSampleBadge? = when {
        n == null -> null
        n >= 100 -> SystemSampleBadge.PROVEN
        n >= 30 -> SystemSampleBadge.ESTABLISHED
        n >= 10 -> SystemSampleBadge.EARLY
        else -> null
    }

    /** Signed metric with a typographic minus, "—" when absent (iOS `formatSystemNumber`). */
    fun signedNumber(value: Double?): String {
        if (value == null) return "—"
        val magnitude = abs(value)
        val body = if (magnitude.roundToLong().toDouble() == magnitude) {
            magnitude.roundToLong().toString()
        } else {
            String.format(Locale.US, "%.1f", magnitude)
        }
        return (if (value >= 0) "+" else "−") + body
    }

    // Fire / ice thresholds — keep native + web in sync:
    //   🔥 win streak len ≥ 3, OR last-10 with n ≥ 10 and wins ≥ 7
    //   ❄️ loss streak len ≥ 3, OR last-10 with n ≥ 10 and wins ≤ 3
    // Streak wins when both speak.

    fun isHotStreak(streak: AnalysisSystemStreak?): Boolean =
        streak != null && streak.kind == "win" && streak.len >= 3

    fun isColdStreak(streak: AnalysisSystemStreak?): Boolean =
        streak != null && streak.kind == "loss" && streak.len >= 3

    fun isHotLast10(last10: AnalysisSystemLast10?): Boolean =
        last10 != null && last10.n >= 10 && last10.wins >= 7

    fun isColdLast10(last10: AnalysisSystemLast10?): Boolean =
        last10 != null && last10.n >= 10 && last10.wins <= 3

    fun temperature(
        streak: AnalysisSystemStreak?,
        last10: AnalysisSystemLast10?,
    ): SystemTemperature = when {
        isHotStreak(streak) -> SystemTemperature.FIRE
        isColdStreak(streak) -> SystemTemperature.ICE
        isHotLast10(last10) -> SystemTemperature.FIRE
        isColdLast10(last10) -> SystemTemperature.ICE
        else -> SystemTemperature.NEUTRAL
    }

    fun isSideMarket(betType: String, sport: HistoricalAnalysisSport): Boolean = when (sport) {
        HistoricalAnalysisSport.MLB -> betType in HistoricalAnalysisUISnapshot.mlbSideMarkets
        HistoricalAnalysisSport.NFL, HistoricalAnalysisSport.CFB ->
            betType in HistoricalAnalysisUISnapshot.sideMarkets
    }

    fun isTotalMarket(betType: String, sport: HistoricalAnalysisSport): Boolean = when (sport) {
        HistoricalAnalysisSport.MLB -> betType in setOf("total", "f5_total")
        HistoricalAnalysisSport.NFL, HistoricalAnalysisSport.CFB ->
            betType in setOf("fg_total", "h1_total", "team_total")
    }

    /**
     * True when a side market's filters don't pick a team side — the Save flow then
     * forces a Home/Away/Favorite/Underdog choice so the system is a repeatable rule
     * instead of a forced ~50% tautology.
     */
    fun isSideSymmetric(
        snapshot: HistoricalAnalysisUISnapshot,
        sport: HistoricalAnalysisSport,
    ): Boolean = snapshot.isSideSymmetricFor(sport)
}
