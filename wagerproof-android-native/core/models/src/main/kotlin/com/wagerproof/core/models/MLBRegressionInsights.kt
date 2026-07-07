package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import kotlinx.datetime.DayOfWeek
import kotlin.time.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atTime
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.round

// Models behind the regression report's RN-parity sections (model breakdown
// by team/day-of-week, Perfect Storm tier records, series-position signals,
// and the per-pick alignment engine). Port of iOS MLBRegressionInsights.swift,
// which mirrors:
//   wagerproof-mobile/hooks/useMLBModelBreakdownAccuracy.ts
//   wagerproof-mobile/hooks/useMLBPerfectStormRecords.ts
//   wagerproof-mobile/hooks/useMLBSeriesSignals.ts
//   wagerproof-mobile/utils/mlbPickAlignment.ts

// Model breakdown (mlb_model_breakdown_accuracy) --------------------------------

@Serializable
data class MLBModelBreakdownRow(
    /** full_ml | full_ou | f5_ml | f5_ou */
    @SerialName("bet_type") val betType: String,
    /** "team" | "dow" */
    @SerialName("breakdown_type") val breakdownType: String,
    @SerialName("breakdown_value") val breakdownValue: String,
    val games: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val pushes: Int = 0,
    // PostgREST numeric columns can drift between number and string.
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    @SerialName("units_won") val unitsWon: Double = 0.0,
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    @SerialName("win_pct") val winPct: Double = 0.0,
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    @SerialName("roi_pct") val roiPct: Double = 0.0,
)

// Perfect Storm tier records (mlb_graded_picks aggregation) ---------------------

enum class MLBPerfectStormTier(val raw: String) {
    HAMMER("hammer"),
    PS("ps"),
    LEAN("lean"),
    WATCH("watch"),
}

/** Mutable tally per tier. */
data class MLBPerfectStormRecord(
    val tier: MLBPerfectStormTier,
    var picks: Int = 0,
    var wins: Int = 0,
    var losses: Int = 0,
    var pushes: Int = 0,
    var winPct: Double? = null,
    var units: Double = 0.0,
    var roiPct: Double? = null,
) {
    val recordString: String
        get() = if (pushes > 0) "$wins-$losses-$pushes" else "$wins-$losses"
}

data class MLBPerfectStormRecords(
    var hammer: MLBPerfectStormRecord = MLBPerfectStormRecord(MLBPerfectStormTier.HAMMER),
    var ps: MLBPerfectStormRecord = MLBPerfectStormRecord(MLBPerfectStormTier.PS),
    var lean: MLBPerfectStormRecord = MLBPerfectStormRecord(MLBPerfectStormTier.LEAN),
    var watch: MLBPerfectStormRecord = MLBPerfectStormRecord(MLBPerfectStormTier.WATCH),
) {
    fun record(tier: MLBPerfectStormTier): MLBPerfectStormRecord = when (tier) {
        MLBPerfectStormTier.HAMMER -> hammer
        MLBPerfectStormTier.PS -> ps
        MLBPerfectStormTier.LEAN -> lean
        MLBPerfectStormTier.WATCH -> watch
    }

    data class Combined(
        val wins: Int,
        val losses: Int,
        val pushes: Int,
        val units: Double,
        val roiPct: Double,
    )

    /**
     * Combined record across all 4 tiers — drives the recap "ALL-TIME"
     * hero (RN deliberately ignores report.cumulative_record here).
     */
    val combined: Combined
        get() {
            var w = 0
            var l = 0
            var p = 0
            var u = 0.0
            for (tier in MLBPerfectStormTier.entries) {
                val r = record(tier)
                w += r.wins; l += r.losses; p += r.pushes; u += r.units
            }
            val graded = w + l
            // Round ROI to 1dp exactly like the Swift/RN `* 10 rounded / 10` dance.
            val roi = if (graded > 0) round(100 * u / graded * 10) / 10 else 0.0
            return Combined(w, l, p, u, roi)
        }
}

// Series-position signals (mlb_game_signals, category == "series") --------------

data class MLBSeriesSignal(
    val gamePk: Int,
    val matchup: String,
    val teamName: String,
    /** "home" | "away" */
    val teamSide: String,
    /** "positive" | "negative" */
    val severity: String,
    val message: String,
) {
    // Deliberate deviation from iOS: Swift used message.hashValue (process-random).
    // Identity is only used for list keys, so the raw message string is both
    // stable and unique enough.
    val id: String get() = "$gamePk-$teamSide-$message"

    val isPositive: Boolean get() = severity == "positive"
}

// Per-pick model alignment (port of utils/mlbPickAlignment.ts) ------------------

enum class MLBPickAlignmentLevel(val raw: String) {
    STRONG("strong"),
    ALIGNED("aligned"),
    NEUTRAL("neutral"),
    MIXED("mixed"),
    CONCERN("concern"),
}

data class MLBPickAlignmentResult(
    val level: MLBPickAlignmentLevel,
    val dow: MLBModelBreakdownRow?,
    /** ML/spread: 1 entry (the pick's subject team). O/U: up to 2 (both teams). */
    val teams: List<MLBModelBreakdownRow>,
    val dowLabel: String?,
)

object MLBPickAlignment {
    /**
     * Full team name → game_log abbr (mlb_game_log uses AZ/ATH for ARI/OAK).
     * Copied verbatim from RN's NAME_TO_ABBR.
     */
    val nameToAbbr: Map<String, String> = mapOf(
        "arizona diamondbacks" to "AZ",
        "atlanta braves" to "ATL",
        "baltimore orioles" to "BAL",
        "boston red sox" to "BOS",
        "chicago cubs" to "CHC",
        "chicago white sox" to "CWS",
        "cincinnati reds" to "CIN",
        "cleveland guardians" to "CLE",
        "colorado rockies" to "COL",
        "detroit tigers" to "DET",
        "houston astros" to "HOU",
        "kansas city royals" to "KC",
        "los angeles angels" to "LAA",
        "los angeles dodgers" to "LAD",
        "miami marlins" to "MIA",
        "milwaukee brewers" to "MIL",
        "minnesota twins" to "MIN",
        "new york mets" to "NYM",
        "new york yankees" to "NYY",
        "oakland athletics" to "ATH",
        "las vegas athletics" to "ATH",
        "athletics" to "ATH",
        "philadelphia phillies" to "PHI",
        "pittsburgh pirates" to "PIT",
        "san diego padres" to "SD",
        "san francisco giants" to "SF",
        "seattle mariners" to "SEA",
        "st louis cardinals" to "STL",
        "tampa bay rays" to "TB",
        "texas rangers" to "TEX",
        "toronto blue jays" to "TOR",
        "washington nationals" to "WSH",
    )

    fun teamNameToGameLogAbbr(name: String?): String? {
        if (name.isNullOrEmpty()) return null
        val key = name.lowercase().replace(".", "").trim()
        return nameToAbbr[key]
    }

    /**
     * Sun..Sat label in ET. Date-only strings anchor to noon so they never
     * flip a day across the UTC boundary (same hack as RN/iOS).
     */
    fun dowLabel(raw: String?): String? {
        if (raw.isNullOrEmpty()) return null
        val et = TimeZone.of("America/New_York")
        val instant: Instant = if (raw.length == 10) {
            runCatching { LocalDate.parse(raw).atTime(12, 0).toInstant(et) }.getOrNull() ?: return null
        } else {
            // Instant.parse handles both with- and without-fractional-seconds ISO-8601.
            runCatching { Instant.parse(raw) }.getOrNull() ?: return null
        }
        return when (instant.toLocalDateTime(et).dayOfWeek) {
            DayOfWeek.SUNDAY -> "Sun"
            DayOfWeek.MONDAY -> "Mon"
            DayOfWeek.TUESDAY -> "Tue"
            DayOfWeek.WEDNESDAY -> "Wed"
            DayOfWeek.THURSDAY -> "Thu"
            DayOfWeek.FRIDAY -> "Fri"
            DayOfWeek.SATURDAY -> "Sat"
        }
    }

    internal fun pickSubjectTeamAbbr(pick: String, homeTeam: String?, awayTeam: String?): String? {
        val lower = pick.lowercase()
        // Last word of the team name (e.g. "yankees") — away checked first.
        val awayKey = awayTeam?.lowercase()?.split(" ")?.filter { it.isNotEmpty() }?.lastOrNull()
        val homeKey = homeTeam?.lowercase()?.split(" ")?.filter { it.isNotEmpty() }?.lastOrNull()
        if (awayKey != null && lower.contains(awayKey)) return teamNameToGameLogAbbr(awayTeam)
        if (homeKey != null && lower.contains(homeKey)) return teamNameToGameLogAbbr(homeTeam)
        if (awayTeam != null && lower.contains(awayTeam.lowercase())) return teamNameToGameLogAbbr(awayTeam)
        if (homeTeam != null && lower.contains(homeTeam.lowercase())) return teamNameToGameLogAbbr(homeTeam)
        return null
    }

    fun compute(
        betType: String,
        pick: String,
        homeTeam: String?,
        awayTeam: String?,
        gameTimeEt: String?,
        rows: List<MLBModelBreakdownRow>,
    ): MLBPickAlignmentResult {
        val dowLabel = dowLabel(gameTimeEt)
        val dow = dowLabel?.let { label ->
            rows.firstOrNull { it.betType == betType && it.breakdownType == "dow" && it.breakdownValue == label }
        }

        fun findTeam(abbr: String?): MLBModelBreakdownRow? {
            if (abbr == null) return null
            return rows.firstOrNull { it.betType == betType && it.breakdownType == "team" && it.breakdownValue == abbr }
        }

        val teams = mutableListOf<MLBModelBreakdownRow>()
        if (betType == "full_ou" || betType == "f5_ou") {
            findTeam(teamNameToGameLogAbbr(awayTeam))?.let { teams += it }
            findTeam(teamNameToGameLogAbbr(homeTeam))?.let { teams += it }
        } else {
            findTeam(pickSubjectTeamAbbr(pick, homeTeam, awayTeam))?.let { teams += it }
        }

        // "Bad" includes meaningful negative ROI (<= -5%) even in the 45-55%
        // win zone — a team at 46% with -12% ROI is losing money, not neutral.
        fun isOk(w: Double, r: Double): Boolean = w >= 55 && r > 0
        fun isBad(w: Double, r: Double): Boolean = w < 45 || r <= -5
        val dowOk = dow?.let { isOk(it.winPct, it.roiPct) } ?: false
        val dowBad = dow?.let { isBad(it.winPct, it.roiPct) } ?: false
        val teamsAllOk = teams.isNotEmpty() && teams.all { isOk(it.winPct, it.roiPct) }
        val teamsAllBad = teams.isNotEmpty() && teams.all { isBad(it.winPct, it.roiPct) }
        val teamsAnyBad = teams.isNotEmpty() && teams.any { isBad(it.winPct, it.roiPct) }

        val level = when {
            dowOk && teamsAllOk -> MLBPickAlignmentLevel.STRONG
            (dowOk && !teamsAnyBad) || (teamsAllOk && !dowBad) -> MLBPickAlignmentLevel.ALIGNED
            dowBad && teamsAllBad -> MLBPickAlignmentLevel.CONCERN
            dowBad || teamsAnyBad -> MLBPickAlignmentLevel.MIXED
            else -> MLBPickAlignmentLevel.NEUTRAL
        }

        return MLBPickAlignmentResult(level = level, dow = dow, teams = teams, dowLabel = dowLabel)
    }
}

// ESPN logo URL from game_log abbr (port of utils/mlbAbbrLogo.ts) ---------------

object MLBAbbrLogo {
    internal val espnSlugByAbbr: Map<String, String> = mapOf(
        "az" to "ari", // mlb_game_log uses AZ; ESPN expects ari
        "ari" to "ari",
        "ath" to "ath", // Athletics
        "oak" to "ath",
        "lva" to "ath",
        "kan" to "kc",
        "kc" to "kc",
        "tam" to "tb",
        "tb" to "tb",
        "st." to "stl",
        "st" to "stl",
        "stl" to "stl",
        "sd" to "sd",
    )

    fun url(forAbbr: String?): String? {
        val raw = forAbbr?.trim()?.lowercase()
        if (raw.isNullOrEmpty()) return null
        val slug = espnSlugByAbbr[raw] ?: raw
        return "https://a.espncdn.com/i/teamlogos/mlb/500/$slug.png"
    }
}
