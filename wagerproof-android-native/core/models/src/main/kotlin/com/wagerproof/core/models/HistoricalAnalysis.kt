package com.wagerproof.core.models

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.roundToInt

enum class HistoricalAnalysisSport(val raw: String) {
    NFL("nfl"), CFB("cfb"), MLB("mlb");

    val title: String get() = "${raw.uppercase()} Historical Analysis"
    val shortTitle: String get() = raw.uppercase()
    val analysisRPC: String get() = "${raw}_analysis"
    val upcomingRPC: String get() = "${raw}_analysis_upcoming"
    val savedFiltersTable: String get() = "${raw}_analysis_saved_filters"
    val defaultSeasonFloor: Int get() = when (this) {
        NFL -> 2018
        CFB -> 2016
        MLB -> 2023
    }

    // Per-sport caps (iOS `seasonMax`): football warehouse ends 2025, MLB is in-season 2026.
    val seasonMax: Int get() = if (this == MLB) 2026 else 2025

    companion object {
        /** Best-effort sport from a saved `bet_type` when the filters blob won't decode. */
        fun inferFromBetType(betType: String): HistoricalAnalysisSport {
            val mlb = setOf("ml", "rl", "total", "f5_ml", "f5_rl", "f5_total", "team_total_runs")
            return if (betType in mlb) MLB else NFL
        }
    }
}

enum class HistoricalAnalysisBetType(val raw: String, val label: String, val group: String) {
    // Football
    FG_SPREAD("fg_spread", "Spread", "Full Game"),
    FG_ML("fg_ml", "Moneyline", "Full Game"),
    FG_TOTAL("fg_total", "Total", "Full Game"),
    TEAM_TOTAL("team_total", "Team Total", "Full Game"),
    H1_SPREAD("h1_spread", "1H Spread", "First Half"),
    H1_ML("h1_ml", "1H ML", "First Half"),
    H1_TOTAL("h1_total", "1H Total", "First Half"),

    // MLB
    ML("ml", "Moneyline", "Full Game"),
    RL("rl", "Run Line", "Full Game"),
    TOTAL("total", "Total", "Full Game"),
    F5_ML("f5_ml", "F5 ML", "First Five"),
    F5_RL("f5_rl", "F5 RL", "First Five"),
    F5_TOTAL("f5_total", "F5 Total", "First Five");

    companion object {
        val limitedHistory = setOf("h1_spread", "h1_ml", "h1_total", "team_total")
        val moneylineMarkets = setOf("fg_ml", "h1_ml")

        /** MLB markets without ROI (mirrors iOS `noROIMarkets`). */
        val noROIMarkets = setOf("f5_ml")

        fun casesFor(sport: HistoricalAnalysisSport): List<HistoricalAnalysisBetType> = when (sport) {
            HistoricalAnalysisSport.NFL, HistoricalAnalysisSport.CFB ->
                listOf(FG_SPREAD, FG_ML, FG_TOTAL, TEAM_TOTAL, H1_SPREAD, H1_ML, H1_TOTAL)
            HistoricalAnalysisSport.MLB ->
                listOf(ML, RL, TOTAL, F5_ML, F5_RL, F5_TOTAL)
        }

        fun from(raw: String): HistoricalAnalysisBetType = entries.firstOrNull { it.raw == raw } ?: FG_SPREAD

        fun showsROI(betType: String, sport: HistoricalAnalysisSport): Boolean =
            if (sport == HistoricalAnalysisSport.MLB) betType !in noROIMarkets else true
    }
}

@Serializable
data class MlbPitcherOption(
    val id: Int,
    val name: String,
    val hand: String? = null,
    val team: String? = null,
)

@Serializable
data class HistoricalAnalysisCoverage(
    @SerialName("season_min") val seasonMin: Int = 0,
    @SerialName("season_max") val seasonMax: Int = 0,
    @SerialName("n_bets") val nBets: Int = 0,
    @SerialName("n_games") val nGames: Int = 0,
)

@Serializable
data class HistoricalAnalysisOverall(
    val n: Int = 0,
    val wins: Int = 0,
    @SerialName("hit_pct") val hitPct: Double = 0.0,
    val roi: Double? = null,
)

@Serializable
data class HistoricalAnalysisBarOption(
    val side: String,
    val n: Int = 0,
    val wins: Int = 0,
    @SerialName("hit_pct") val hitPct: Double = 0.0,
    val roi: Double? = null,
)

@Serializable
data class HistoricalAnalysisBar(
    val dimension: String,
    val options: List<HistoricalAnalysisBarOption>,
)

@Serializable
data class HistoricalAnalysisBreakdownRow(
    val team: String? = null,
    val coach: String? = null,
    val referee: String? = null,
    val conference: String? = null,
    val venue: String? = null,
    /** Venue rows only (MLB): the venue's resident team, for the row logo. */
    @SerialName("home_team") val homeTeam: String? = null,
    val n: Int = 0,
    @SerialName("hit_pct") val hitPct: Double = 0.0,
    val roi: Double? = null,
) {
    val id: String get() = team ?: coach ?: referee ?: conference ?: venue ?: "$n-$hitPct"
    val label: String get() = team ?: coach ?: referee ?: conference ?: venue ?: "—"
}

@Serializable
data class HistoricalAnalysisResponse(
    @SerialName("bet_type") val betType: String = "",
    val coverage: HistoricalAnalysisCoverage,
    @SerialName("baseline_pct") val baselinePct: Double = 50.0,
    val overall: HistoricalAnalysisOverall,
    val bars: List<HistoricalAnalysisBar> = emptyList(),
    @SerialName("by_team") val byTeam: List<HistoricalAnalysisBreakdownRow> = emptyList(),
    @SerialName("by_coach") val byCoach: List<HistoricalAnalysisBreakdownRow>? = null,
    @SerialName("by_referee") val byReferee: List<HistoricalAnalysisBreakdownRow>? = null,
    @SerialName("by_conference") val byConference: List<HistoricalAnalysisBreakdownRow>? = null,
    @SerialName("by_venue") val byVenue: List<HistoricalAnalysisBreakdownRow>? = null,
)

@Serializable
data class HistoricalAnalysisUpcomingGame(
    val team: String,
    val opponent: String,
    @SerialName("is_home") val isHome: Boolean = true,
    /** Null when odds are missing / pick'em — MLB `mlb_analysis_upcoming` returns null `is_favorite`. */
    @SerialName("is_favorite") val isFavorite: Boolean? = null,
    val matchup: String = "",
    /** Football kickoff ISO; null on MLB rows (game_date / time_et instead). */
    val kickoff: String? = null,
    @SerialName("team_spread") val teamSpread: Double? = null,
    val total: Double? = null,
    @SerialName("tt_line") val ttLine: Double? = null,
    @SerialName("h1_spread") val h1Spread: Double? = null,
    @SerialName("h1_total") val h1Total: Double? = null,
    val referee: String? = null,
    // MLB
    @SerialName("game_pk") val gamePk: Int? = null,
    @SerialName("game_date") val gameDate: String? = null,
    @SerialName("time_et") val timeEt: String? = null,
    val ml: Double? = null,
    @SerialName("f5_total") val f5Total: Double? = null,
    @SerialName("series_game") val seriesGame: Int? = null,
    @SerialName("trip_series_index") val tripSeriesIndex: Int? = null,
    @SerialName("is_switch_game") val isSwitchGame: Boolean? = null,
    @SerialName("prev_result") val prevResult: String? = null,
    @SerialName("days_rest") val daysRest: Int? = null,
    @SerialName("day_of_week") val dayOfWeek: String? = null,
    @SerialName("is_doubleheader") val isDoubleheader: Boolean? = null,
    @SerialName("sp_hand") val spHand: String? = null,
    @SerialName("opp_sp_hand") val oppSpHand: String? = null,
    @SerialName("sp_id") val spId: Int? = null,
    @SerialName("sp_name") val spName: String? = null,
    @SerialName("opp_sp_id") val oppSpId: Int? = null,
    @SerialName("opp_sp_name") val oppSpName: String? = null,
    val venue: String? = null,
) {
    val id: String get() = gamePk?.let { "$it-$team" } ?: "$team-${kickoff ?: gameDate ?: ""}"
}

@Serializable
data class HistoricalAnalysisSavedFilter(
    val id: String,
    @SerialName("user_id") val userId: String,
    val name: String,
    @SerialName("bet_type") val betType: String,
    val filters: HistoricalAnalysisUISnapshot,
    @SerialName("created_at") val createdAt: String? = null,
)

/**
 * UI-shaped filter snapshot — stored in saved-filters tables and restored verbatim.
 * Field names and defaults mirror iOS `HistoricalAnalysisUISnapshot` exactly; the
 * custom serializer below tolerates both web canonical pair fields and iOS flat
 * fields so cross-platform restores work.
 */
@Serializable(with = HistoricalAnalysisUISnapshotSerializer::class)
data class HistoricalAnalysisUISnapshot(
    var betType: String = "fg_spread",
    var seasonMin: Int = 2018,
    var seasonMax: Int = 2025,
    var weekMin: Int = 1,
    var weekMax: Int = 18,
    var side: String = "any",
    var favDog: String = "any",
    /**
     * MLB: the ACTUAL posted run-line side ("minus" = laying −1.5, "plus" =
     * getting +1.5). Distinct from favDog — books post the ML favorite at +1.5
     * in ~7% of games, so "getting +1.5" and "underdog" are different questions.
     */
    var rlSide: String = "any",
    var spreadSide: String = "any",
    var spreadMin: Double = 0.0,
    var spreadMax: Double = 20.0,
    var lineMin: Double = 30.0,
    var lineMax: Double = 60.0,
    var mlMin: String = "",
    var mlMax: String = "",
    // Cross-market football line filters — separate from the selected result market
    // so a spread analysis can still be narrowed by 1H/TT pricing.
    var h1SpreadSide: String = "any",
    var h1SpreadMin: Double = 0.0,
    var h1SpreadMax: Double = 14.0,
    var h1MlMin: String = "",
    var h1MlMax: String = "",
    var h1TotalMin: Double = 15.0,
    var h1TotalMax: Double = 35.0,
    var ttLineMin: Double = 10.0,
    var ttLineMax: Double = 40.0,
    var oppSpreadSide: String = "any",
    var oppSpreadMin: Double = 0.0,
    var oppSpreadMax: Double = 20.0,
    var oppMlMin: String = "",
    var oppMlMax: String = "",
    var oppTtLineMin: Double = 10.0,
    var oppTtLineMax: Double = 40.0,
    var primetime: Boolean? = null,
    var tempMin: Int = -10,
    var tempMax: Int = 110,
    var windMax: Int = 60,

    // NFL-only
    var seasonType: String = "any",
    var playoffRound: String = "any",
    var division: Boolean? = null,
    var dome: String = "any",
    var precip: String = "any",
    var restBye: String = "any",
    var coach: String = "any",
    var referee: String = "any",

    // CFB-only
    var gameType: String = "any",
    var rankedMatchup: String = "any",
    var conferenceGame: Boolean? = null,
    var neutralSite: Boolean? = null,
    var conference: String = "any",
    var selectedConferences: List<String> = emptyList(),
    /** CFB actual weather (CFBD weatherCondition): any | clear | cloudy | rain | snow. */
    var weather: String = "any",

    // Football + MLB "last game" filters — each describes the team's PREVIOUS game.
    var lastAts: String = "any",       // any | covered | not
    var lastTotal: String = "any",     // any | over | under
    var lastRole: String = "any",      // any | favorite | underdog
    var lastOt: Boolean? = null,
    var lastBlowout: String = "any",   // legacy CFB field, decode-only (never emitted)

    // "As-of" season record (team's situation at time of game)
    var winPct: List<Double> = listOf(0.0, 100.0),
    var winStreak: List<Int> = listOf(0, 16),
    var lossStreak: List<Int> = listOf(0, 16),
    var above500: Boolean? = null,
    var winPctGtOpp: Boolean? = null,
    var ppg: List<Double> = listOf(0.0, 40.0),
    var paPg: List<Double> = listOf(0.0, 40.0),
    var pointDiffPg: List<Double> = listOf(-20.0, 20.0),
    var minGames: Int = 0,

    // Cover profile
    var atsWinPct: List<Double> = listOf(0.0, 100.0),
    var atsWinStreak: List<Int> = listOf(0, 16),
    var avgCoverMargin: List<Double> = listOf(-15.0, 15.0),

    // Total profile
    var overPct: List<Double> = listOf(0.0, 100.0),
    var overStreak: List<Int> = listOf(0, 16),
    var underStreak: List<Int> = listOf(0, 16),

    // Prior year
    var prevWins: List<Int> = listOf(0, 16),
    var prevWinPct: List<Double> = listOf(0.0, 100.0),
    var madePlayoffsPrev: Boolean? = null,
    var moreWinsThanOppPrev: Boolean? = null,

    // Head-to-head (last meeting)
    var h2hLastWin: String = "any",    // any | yes | no
    var h2hLastAts: String = "any",
    var h2hLastOver: String = "any",
    var h2hLastHome: Boolean? = null,
    var h2hLastFav: Boolean? = null,
    var h2hSameSeason: Boolean? = null,
    var h2hSpreadCmp: String = "any",  // any | lower | higher

    // Opponent record
    var oppWinPct: List<Double> = listOf(0.0, 100.0),
    var oppOverPct: List<Double> = listOf(0.0, 100.0),
    var oppWinStreak: List<Int> = listOf(0, 16),
    var oppLossStreak: List<Int> = listOf(0, 16),
    var oppPpg: List<Double> = listOf(0.0, 40.0),
    var oppPaPg: List<Double> = listOf(0.0, 40.0),
    var oppPrevWinPct: List<Double> = listOf(0.0, 100.0),

    // Opponent last game
    var oppLastResult: String = "any", // any | won | lost
    var oppLastAts: String = "any",
    var oppLastTotal: String = "any",
    var oppLastRole: String = "any",
    var oppLastOt: Boolean? = null,
    var oppLastMargin: List<Int> = listOf(-60, 60),

    // Signed last-game margin (+ = won by, − = lost by)
    var lastMargin: List<Int> = listOf(-60, 60),

    // Multi-selects
    var daysOfWeek: List<String> = emptyList(),
    var teamDivisions: List<String> = emptyList(),

    // MLB-only (tolerant decode — missing keys use defaults so old football JSON still works)
    var monthMin: Int = 3,
    var monthMax: Int = 11,
    var teams: List<String> = emptyList(),
    var opponents: List<String> = emptyList(),
    var interleague: Boolean? = null,
    /** Legacy single-day value; `daysOfWeek` (multi) is canonical. */
    var dayOfWeek: String = "any",
    var doubleheader: Boolean? = null,
    /**
     * Multi-select of specific series game numbers (1–6). Legacy min/max range
     * saves migrate into this set at decode; the range fields survive only so an
     * old snapshot round-trips.
     */
    var seriesGames: List<Int> = emptyList(),
    var seriesGameMin: Int? = null,
    var seriesGameMax: Int? = null,
    var tripMin: Int? = null,
    var tripMax: Int? = null,
    var switchGame: Boolean? = null,
    var restMin: Int? = null,
    var restMax: Int? = null,
    var streakMin: String = "",
    var streakMax: String = "",
    var lastResult: String = "any",    // MLB last-game W/L (football maps to last_won)
    var lastMarginMin: String = "",
    var lastMarginMax: String = "",
    var sp: List<MlbPitcherOption> = emptyList(),
    var oppSp: List<MlbPitcherOption> = emptyList(),
    var spHand: String = "any",
    var oppSpHand: String = "any",
    var windMin: Int? = null,
    var windDir: String = "any",
    var pfRunsMin: Double? = null,
    var pfRunsMax: Double? = null,
    var f5TotalMin: Double = 2.0,
    var f5TotalMax: Double = 8.0,
    var timeMin: String = "",
    var timeMax: String = "",
    var spXfipMin: Double = 2.0,
    var spXfipMax: Double = 7.0,
    var oppSpXfipMin: Double = 2.0,
    var oppSpXfipMax: Double = 7.0,
    var bpIpMin: Double = 0.0,
    var bpIpMax: Double = 20.0,
    var bpXfipMin: Double = 2.0,
    var bpXfipMax: Double = 7.0,
    var spEraMin: Double = 0.0,
    var spEraMax: Double = 10.0,
    var oppSpEraMin: Double = 0.0,
    var oppSpEraMax: Double = 10.0,
    var rpg: List<Double> = listOf(0.0, 10.0),
    var rapg: List<Double> = listOf(0.0, 10.0),
    var runDiffPg: List<Double> = listOf(-4.0, 4.0),
    var rlCoverPct: List<Double> = listOf(0.0, 100.0),
    var rlStreak: List<Int> = listOf(0, 25),
    var h2hLastMargin: List<Int> = listOf(-30, 30),
    var oppRlCoverPct: List<Double> = listOf(0.0, 100.0),
    var oppRpg: List<Double> = listOf(0.0, 10.0),
    var oppRapg: List<Double> = listOf(0.0, 10.0),
) {
    companion object {
        /** Two-sided football markets that contribute mirror rows per game. */
        val sideMarkets = setOf("fg_spread", "fg_ml", "h1_spread", "h1_ml")

        /** MLB two-sided markets — mirrors web `MLB_SIDE_MARKETS`. */
        val mlbSideMarkets = setOf("ml", "rl", "f5_ml", "f5_rl")

        fun defaults(sport: HistoricalAnalysisSport): HistoricalAnalysisUISnapshot = when (sport) {
            HistoricalAnalysisSport.MLB -> HistoricalAnalysisUISnapshot(
                betType = "ml",
                seasonMin = maxOf(sport.defaultSeasonFloor, sport.seasonMax - 1),
                seasonMax = sport.seasonMax,
                lineMin = 5.0,
                lineMax = 14.0,
                tempMin = -10,
                tempMax = 110,
                windMax = 60,
                // MLB reuses football fields with wider/shifted default ranges (web
                // MLB_SNAPSHOT_DEFAULTS) — must match the builder's narrowed-from-default
                // comparisons or an untouched slider would emit an RPC key.
                winStreak = listOf(0, 25),
                lossStreak = listOf(0, 25),
                overStreak = listOf(0, 25),
                underStreak = listOf(0, 25),
                prevWins = listOf(0, 120),
                oppWinStreak = listOf(0, 25),
                oppLossStreak = listOf(0, 25),
                oppLastMargin = listOf(-30, 30),
                lastMargin = listOf(-30, 30),
            )
            HistoricalAnalysisSport.NFL, HistoricalAnalysisSport.CFB -> {
                val isCfb = sport == HistoricalAnalysisSport.CFB
                HistoricalAnalysisUISnapshot(
                    betType = "fg_spread",
                    // Web-parity default windows (NFL last 3 seasons, CFB current) —
                    // deep-history default scans are the statement-timeout risk.
                    seasonMin = if (isCfb) sport.seasonMax else maxOf(sport.defaultSeasonFloor, sport.seasonMax - 2),
                    seasonMax = sport.seasonMax,
                    weekMax = if (isCfb) 16 else 18,
                    spreadMax = if (isCfb) 50.0 else 20.0,
                    lineMin = 30.0,
                    lineMax = if (isCfb) 80.0 else 60.0,
                    h1SpreadMax = if (isCfb) 28.0 else 14.0,
                    h1TotalMax = if (isCfb) 45.0 else 35.0,
                    ttLineMax = if (isCfb) 55.0 else 40.0,
                    oppSpreadMax = if (isCfb) 50.0 else 20.0,
                    oppTtLineMax = if (isCfb) 55.0 else 40.0,
                    tempMax = if (isCfb) 110 else 100,
                    // As-of range defaults MUST match the builder's per-sport defaultRange
                    // comparisons — CFB scoring runs higher than NFL.
                    ppg = if (isCfb) listOf(0.0, 60.0) else listOf(0.0, 40.0),
                    paPg = if (isCfb) listOf(0.0, 60.0) else listOf(0.0, 40.0),
                    pointDiffPg = if (isCfb) listOf(-40.0, 40.0) else listOf(-20.0, 20.0),
                    avgCoverMargin = if (isCfb) listOf(-30.0, 30.0) else listOf(-15.0, 15.0),
                    prevWins = if (isCfb) listOf(0, 15) else listOf(0, 16),
                    oppPpg = if (isCfb) listOf(0.0, 60.0) else listOf(0.0, 40.0),
                    oppPaPg = if (isCfb) listOf(0.0, 60.0) else listOf(0.0, 40.0),
                    oppLastMargin = if (isCfb) listOf(-80, 80) else listOf(-60, 60),
                    lastMargin = if (isCfb) listOf(-80, 80) else listOf(-60, 60),
                )
            }
        }
    }
}

/**
 * Lenient JSON codec for [HistoricalAnalysisUISnapshot]. Ports the iOS tolerant
 * decoder: iOS flat fields decode 1:1, and older Expo/web saves that use pair
 * aliases (`seasons`, `spreadSize`, `tempRange`, `months`, `spXfip`… as `[lo,hi]`
 * arrays or `{min,max}` objects), `totalMin/Max` for `lineMin/Max`, or a boolean
 * `dome` still restore. A malformed blob never throws — it falls back per-field
 * to defaults so a bad snapshot can't blank the saved-filters list.
 */
object HistoricalAnalysisUISnapshotSerializer : KSerializer<HistoricalAnalysisUISnapshot> {
    override val descriptor: SerialDescriptor =
        buildClassSerialDescriptor("com.wagerproof.core.models.HistoricalAnalysisUISnapshot")

    private val pitcherListSerializer = ListSerializer(MlbPitcherOption.serializer())
    private val lenientJson = Json { ignoreUnknownKeys = true }

    override fun deserialize(decoder: Decoder): HistoricalAnalysisUISnapshot {
        val input = decoder as? JsonDecoder
            ?: error("HistoricalAnalysisUISnapshot supports JSON only")
        val o = (input.decodeJsonElement() as? JsonObject) ?: JsonObject(emptyMap())
        val d = HistoricalAnalysisUISnapshot()

        fun prim(key: String): JsonPrimitive? = (o[key] as? JsonPrimitive)?.takeIf { it !is JsonNull }
        fun str(key: String, def: String): String = prim(key)?.contentOrNull ?: def
        fun int(key: String): Int? = prim(key)?.let { it.intOrNull ?: it.doubleOrNull?.roundToInt() }
        fun dbl(key: String): Double? = prim(key)?.doubleOrNull
        fun bool(key: String): Boolean? = prim(key)?.booleanOrNull
        fun strList(key: String): List<String>? = (o[key] as? JsonArray)
            ?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
        fun dblList(key: String, def: List<Double>): List<Double> {
            val a = (o[key] as? JsonArray) ?: return def
            val v = a.mapNotNull { (it as? JsonPrimitive)?.doubleOrNull }
            return if (v.size >= 2) v.take(2) else def
        }
        fun intList(key: String, def: List<Int>): List<Int> {
            val a = (o[key] as? JsonArray) ?: return def
            val v = a.mapNotNull { (it as? JsonPrimitive)?.let { p -> p.intOrNull ?: p.doubleOrNull?.roundToInt() } }
            return if (v.size >= 2) v.take(2) else def
        }

        // Web pair aliases arrive as [lo, hi] arrays or {min, max} objects.
        fun altPair(key: String): Pair<Double?, Double?>? {
            when (val el = o[key]) {
                is JsonArray -> {
                    if (el.size >= 2) {
                        val lo = (el[0] as? JsonPrimitive)?.doubleOrNull
                        val hi = (el[1] as? JsonPrimitive)?.doubleOrNull
                        return lo to hi
                    }
                    return null
                }
                is JsonObject -> {
                    val lo = (el["min"] as? JsonPrimitive)?.doubleOrNull
                    val hi = (el["max"] as? JsonPrimitive)?.doubleOrNull
                    return lo to hi
                }
                else -> return null
            }
        }

        // Series game numbers: the multi-select is canonical, but pre-5c0acd91 saves
        // (and web) only carry a min/max range — expand it into the set so a restored
        // system filters on the same games it did on the platform that saved it.
        var seriesGameMinValue = altPair("seriesGame")?.first?.roundToInt() ?: int("seriesGameMin")
        var seriesGameMaxValue = altPair("seriesGame")?.second?.roundToInt() ?: int("seriesGameMax")
        var seriesGamesValue = (o["seriesGames"] as? JsonArray)
            ?.mapNotNull { (it as? JsonPrimitive)?.let { p -> p.intOrNull ?: p.doubleOrNull?.roundToInt() } }
            ?: emptyList()
        if (seriesGamesValue.isEmpty() && (seriesGameMinValue != null || seriesGameMaxValue != null)) {
            val lo = seriesGameMinValue ?: 1
            seriesGamesValue = (lo..maxOf(lo, seriesGameMaxValue ?: 6)).toList()
            seriesGameMinValue = null
            seriesGameMaxValue = null
        }

        return HistoricalAnalysisUISnapshot(
            betType = str("betType", d.betType),
            seasonMin = altPair("seasons")?.first?.roundToInt() ?: int("seasonMin") ?: d.seasonMin,
            seasonMax = altPair("seasons")?.second?.roundToInt() ?: int("seasonMax") ?: d.seasonMax,
            weekMin = altPair("weeks")?.first?.roundToInt() ?: int("weekMin") ?: d.weekMin,
            weekMax = altPair("weeks")?.second?.roundToInt() ?: int("weekMax") ?: d.weekMax,
            side = str("side", d.side),
            favDog = str("favDog", d.favDog),
            rlSide = str("rlSide", d.rlSide),
            spreadSide = str("spreadSide", d.spreadSide),
            spreadMin = altPair("spreadSize")?.first ?: dbl("spreadMin") ?: d.spreadMin,
            spreadMax = altPair("spreadSize")?.second ?: dbl("spreadMax") ?: d.spreadMax,
            // Expo MLB uses totalMin/totalMax for game totals; web football uses lineRange.
            lineMin = altPair("lineRange")?.first ?: dbl("lineMin") ?: dbl("totalMin") ?: 5.0,
            lineMax = altPair("lineRange")?.second ?: dbl("lineMax") ?: dbl("totalMax") ?: 14.0,
            mlMin = str("mlMin", d.mlMin),
            mlMax = str("mlMax", d.mlMax),
            h1SpreadSide = str("h1SpreadSide", d.h1SpreadSide),
            h1SpreadMin = altPair("h1SpreadSize")?.first ?: dbl("h1SpreadMin") ?: d.h1SpreadMin,
            h1SpreadMax = altPair("h1SpreadSize")?.second ?: dbl("h1SpreadMax") ?: d.h1SpreadMax,
            h1MlMin = str("h1MlMin", d.h1MlMin),
            h1MlMax = str("h1MlMax", d.h1MlMax),
            h1TotalMin = altPair("h1TotalRange")?.first ?: dbl("h1TotalMin") ?: d.h1TotalMin,
            h1TotalMax = altPair("h1TotalRange")?.second ?: dbl("h1TotalMax") ?: d.h1TotalMax,
            ttLineMin = altPair("ttLineRange")?.first ?: dbl("ttLineMin") ?: d.ttLineMin,
            ttLineMax = altPair("ttLineRange")?.second ?: dbl("ttLineMax") ?: d.ttLineMax,
            oppSpreadSide = str("oppSpreadSide", d.oppSpreadSide),
            oppSpreadMin = altPair("oppSpreadSize")?.first ?: dbl("oppSpreadMin") ?: d.oppSpreadMin,
            oppSpreadMax = altPair("oppSpreadSize")?.second ?: dbl("oppSpreadMax") ?: d.oppSpreadMax,
            oppMlMin = str("oppMlMin", d.oppMlMin),
            oppMlMax = str("oppMlMax", d.oppMlMax),
            oppTtLineMin = altPair("oppTtLineRange")?.first ?: dbl("oppTtLineMin") ?: d.oppTtLineMin,
            oppTtLineMax = altPair("oppTtLineRange")?.second ?: dbl("oppTtLineMax") ?: d.oppTtLineMax,
            primetime = bool("primetime"),
            tempMin = altPair("tempRange")?.first?.roundToInt() ?: int("tempMin") ?: d.tempMin,
            tempMax = altPair("tempRange")?.second?.roundToInt() ?: int("tempMax") ?: d.tempMax,
            windMax = altPair("windRange")?.second?.roundToInt() ?: int("windMax") ?: d.windMax,
            seasonType = str("seasonType", d.seasonType),
            playoffRound = str("playoffRound", d.playoffRound),
            division = bool("division"),
            // iOS string enum vs Expo MLB bool tristate.
            dome = prim("dome")?.let { p ->
                p.booleanOrNull?.let { if (it) "dome" else "outdoor" } ?: p.contentOrNull
            } ?: "any",
            precip = str("precip", d.precip),
            restBye = str("restBye", d.restBye),
            coach = str("coach", d.coach),
            referee = str("referee", d.referee),
            gameType = str("gameType", d.gameType),
            rankedMatchup = str("rankedMatchup", d.rankedMatchup),
            conferenceGame = bool("conferenceGame"),
            neutralSite = bool("neutralSite"),
            conference = str("conference", d.conference),
            selectedConferences = strList("selectedConferences") ?: emptyList(),
            weather = str("weather", d.weather),
            lastAts = str("lastAts", d.lastAts),
            lastTotal = str("lastTotal", d.lastTotal),
            lastRole = str("lastRole", d.lastRole),
            lastOt = bool("lastOt"),
            lastBlowout = str("lastBlowout", d.lastBlowout),
            winPct = dblList("winPct", d.winPct),
            winStreak = intList("winStreak", d.winStreak),
            lossStreak = intList("lossStreak", d.lossStreak),
            above500 = bool("above500"),
            winPctGtOpp = bool("winPctGtOpp"),
            ppg = dblList("ppg", d.ppg),
            paPg = dblList("paPg", d.paPg),
            pointDiffPg = dblList("pointDiffPg", d.pointDiffPg),
            minGames = int("minGames") ?: d.minGames,
            atsWinPct = dblList("atsWinPct", d.atsWinPct),
            atsWinStreak = intList("atsWinStreak", d.atsWinStreak),
            avgCoverMargin = dblList("avgCoverMargin", d.avgCoverMargin),
            overPct = dblList("overPct", d.overPct),
            overStreak = intList("overStreak", d.overStreak),
            underStreak = intList("underStreak", d.underStreak),
            prevWins = intList("prevWins", d.prevWins),
            prevWinPct = dblList("prevWinPct", d.prevWinPct),
            madePlayoffsPrev = bool("madePlayoffsPrev"),
            moreWinsThanOppPrev = bool("moreWinsThanOppPrev"),
            h2hLastWin = str("h2hLastWin", d.h2hLastWin),
            h2hLastAts = str("h2hLastAts", d.h2hLastAts),
            h2hLastOver = str("h2hLastOver", d.h2hLastOver),
            h2hLastHome = bool("h2hLastHome"),
            h2hLastFav = bool("h2hLastFav"),
            h2hSameSeason = bool("h2hSameSeason"),
            h2hSpreadCmp = str("h2hSpreadCmp", d.h2hSpreadCmp),
            oppWinPct = dblList("oppWinPct", d.oppWinPct),
            oppOverPct = dblList("oppOverPct", d.oppOverPct),
            oppWinStreak = intList("oppWinStreak", d.oppWinStreak),
            oppLossStreak = intList("oppLossStreak", d.oppLossStreak),
            oppPpg = dblList("oppPpg", d.oppPpg),
            oppPaPg = dblList("oppPaPg", d.oppPaPg),
            oppPrevWinPct = dblList("oppPrevWinPct", d.oppPrevWinPct),
            oppLastResult = str("oppLastResult", d.oppLastResult),
            oppLastAts = str("oppLastAts", d.oppLastAts),
            oppLastTotal = str("oppLastTotal", d.oppLastTotal),
            oppLastRole = str("oppLastRole", d.oppLastRole),
            oppLastOt = bool("oppLastOt"),
            oppLastMargin = intList("oppLastMargin", d.oppLastMargin),
            lastMargin = intList("lastMargin", d.lastMargin),
            daysOfWeek = strList("daysOfWeek") ?: emptyList(),
            teamDivisions = strList("teamDivisions") ?: emptyList(),
            monthMin = altPair("months")?.first?.roundToInt() ?: int("monthMin") ?: d.monthMin,
            monthMax = altPair("months")?.second?.roundToInt() ?: int("monthMax") ?: d.monthMax,
            teams = strList("teams") ?: emptyList(),
            opponents = strList("opponents") ?: emptyList(),
            interleague = bool("interleague"),
            dayOfWeek = str("dayOfWeek", d.dayOfWeek),
            doubleheader = bool("doubleheader"),
            seriesGames = seriesGamesValue,
            seriesGameMin = seriesGameMinValue,
            seriesGameMax = seriesGameMaxValue,
            tripMin = altPair("trip")?.first?.roundToInt() ?: int("tripMin"),
            tripMax = altPair("trip")?.second?.roundToInt() ?: int("tripMax"),
            switchGame = bool("switchGame"),
            restMin = altPair("restRange")?.first?.roundToInt() ?: int("restMin"),
            restMax = altPair("restRange")?.second?.roundToInt() ?: int("restMax"),
            streakMin = str("streakMin", d.streakMin),
            streakMax = str("streakMax", d.streakMax),
            lastResult = str("lastResult", d.lastResult),
            lastMarginMin = str("lastMarginMin", d.lastMarginMin),
            lastMarginMax = str("lastMarginMax", d.lastMarginMax),
            sp = (o["sp"] as? JsonArray)?.let { arr ->
                runCatching { lenientJson.decodeFromJsonElement(pitcherListSerializer, arr) }.getOrNull()
            } ?: emptyList(),
            oppSp = (o["oppSp"] as? JsonArray)?.let { arr ->
                runCatching { lenientJson.decodeFromJsonElement(pitcherListSerializer, arr) }.getOrNull()
            } ?: emptyList(),
            spHand = str("spHand", d.spHand),
            oppSpHand = str("oppSpHand", d.oppSpHand),
            windMin = altPair("windRange")?.first?.roundToInt()?.takeIf { it > 0 } ?: int("windMin"),
            windDir = str("windDir", d.windDir),
            pfRunsMin = altPair("pfRuns")?.first ?: dbl("pfRunsMin"),
            pfRunsMax = altPair("pfRuns")?.second ?: dbl("pfRunsMax"),
            f5TotalMin = altPair("f5TotalRange")?.first ?: dbl("f5TotalMin") ?: d.f5TotalMin,
            f5TotalMax = altPair("f5TotalRange")?.second ?: dbl("f5TotalMax") ?: d.f5TotalMax,
            timeMin = str("timeMin", d.timeMin),
            timeMax = str("timeMax", d.timeMax),
            spXfipMin = altPair("spXfip")?.first ?: dbl("spXfipMin") ?: d.spXfipMin,
            spXfipMax = altPair("spXfip")?.second ?: dbl("spXfipMax") ?: d.spXfipMax,
            oppSpXfipMin = altPair("oppSpXfip")?.first ?: dbl("oppSpXfipMin") ?: d.oppSpXfipMin,
            oppSpXfipMax = altPair("oppSpXfip")?.second ?: dbl("oppSpXfipMax") ?: d.oppSpXfipMax,
            bpIpMin = altPair("bpIp")?.first ?: dbl("bpIpMin") ?: d.bpIpMin,
            bpIpMax = altPair("bpIp")?.second ?: dbl("bpIpMax") ?: d.bpIpMax,
            bpXfipMin = altPair("bpXfip")?.first ?: dbl("bpXfipMin") ?: d.bpXfipMin,
            bpXfipMax = altPair("bpXfip")?.second ?: dbl("bpXfipMax") ?: d.bpXfipMax,
            spEraMin = altPair("spEra")?.first ?: dbl("spEraMin") ?: d.spEraMin,
            spEraMax = altPair("spEra")?.second ?: dbl("spEraMax") ?: d.spEraMax,
            oppSpEraMin = altPair("oppSpEra")?.first ?: dbl("oppSpEraMin") ?: d.oppSpEraMin,
            oppSpEraMax = altPair("oppSpEra")?.second ?: dbl("oppSpEraMax") ?: d.oppSpEraMax,
            rpg = dblList("rpg", d.rpg),
            rapg = dblList("rapg", d.rapg),
            runDiffPg = dblList("runDiffPg", d.runDiffPg),
            rlCoverPct = dblList("rlCoverPct", d.rlCoverPct),
            rlStreak = intList("rlStreak", d.rlStreak),
            h2hLastMargin = intList("h2hLastMargin", d.h2hLastMargin),
            oppRlCoverPct = dblList("oppRlCoverPct", d.oppRlCoverPct),
            oppRpg = dblList("oppRpg", d.oppRpg),
            oppRapg = dblList("oppRapg", d.oppRapg),
        )
    }

    override fun serialize(encoder: Encoder, value: HistoricalAnalysisUISnapshot) {
        val output = encoder as? JsonEncoder
            ?: error("HistoricalAnalysisUISnapshot supports JSON only")
        val map = buildMap<String, JsonElement> {
            fun putStr(k: String, v: String) = put(k, JsonPrimitive(v))
            fun putInt(k: String, v: Int) = put(k, JsonPrimitive(v))
            fun putDbl(k: String, v: Double) = put(k, JsonPrimitive(v))
            fun putBoolOpt(k: String, v: Boolean?) { v?.let { put(k, JsonPrimitive(it)) } }
            fun putIntOpt(k: String, v: Int?) { v?.let { put(k, JsonPrimitive(it)) } }
            fun putDblOpt(k: String, v: Double?) { v?.let { put(k, JsonPrimitive(it)) } }
            fun putStrList(k: String, v: List<String>) = put(k, JsonArray(v.map(::JsonPrimitive)))
            fun putDblList(k: String, v: List<Double>) = put(k, JsonArray(v.map(::JsonPrimitive)))
            fun putIntList(k: String, v: List<Int>) = put(k, JsonArray(v.map(::JsonPrimitive)))

            putStr("betType", value.betType)
            putInt("seasonMin", value.seasonMin); putInt("seasonMax", value.seasonMax)
            putInt("weekMin", value.weekMin); putInt("weekMax", value.weekMax)
            putStr("side", value.side); putStr("favDog", value.favDog)
            putStr("rlSide", value.rlSide)
            putStr("spreadSide", value.spreadSide)
            putDbl("spreadMin", value.spreadMin); putDbl("spreadMax", value.spreadMax)
            putDbl("lineMin", value.lineMin); putDbl("lineMax", value.lineMax)
            putStr("mlMin", value.mlMin); putStr("mlMax", value.mlMax)
            putStr("h1SpreadSide", value.h1SpreadSide)
            putDbl("h1SpreadMin", value.h1SpreadMin); putDbl("h1SpreadMax", value.h1SpreadMax)
            putStr("h1MlMin", value.h1MlMin); putStr("h1MlMax", value.h1MlMax)
            putDbl("h1TotalMin", value.h1TotalMin); putDbl("h1TotalMax", value.h1TotalMax)
            putDbl("ttLineMin", value.ttLineMin); putDbl("ttLineMax", value.ttLineMax)
            putStr("oppSpreadSide", value.oppSpreadSide)
            putDbl("oppSpreadMin", value.oppSpreadMin); putDbl("oppSpreadMax", value.oppSpreadMax)
            putStr("oppMlMin", value.oppMlMin); putStr("oppMlMax", value.oppMlMax)
            putDbl("oppTtLineMin", value.oppTtLineMin); putDbl("oppTtLineMax", value.oppTtLineMax)
            putBoolOpt("primetime", value.primetime)
            putInt("tempMin", value.tempMin); putInt("tempMax", value.tempMax)
            putInt("windMax", value.windMax)
            putStr("seasonType", value.seasonType); putStr("playoffRound", value.playoffRound)
            putBoolOpt("division", value.division)
            putStr("dome", value.dome); putStr("precip", value.precip); putStr("restBye", value.restBye)
            putStr("coach", value.coach); putStr("referee", value.referee)
            putStr("gameType", value.gameType); putStr("rankedMatchup", value.rankedMatchup)
            putBoolOpt("conferenceGame", value.conferenceGame)
            putBoolOpt("neutralSite", value.neutralSite)
            putStr("conference", value.conference)
            putStrList("selectedConferences", value.selectedConferences)
            putStr("weather", value.weather)
            putStr("lastAts", value.lastAts); putStr("lastTotal", value.lastTotal)
            putStr("lastRole", value.lastRole)
            putBoolOpt("lastOt", value.lastOt)
            putStr("lastBlowout", value.lastBlowout)
            putDblList("winPct", value.winPct)
            putIntList("winStreak", value.winStreak); putIntList("lossStreak", value.lossStreak)
            putBoolOpt("above500", value.above500); putBoolOpt("winPctGtOpp", value.winPctGtOpp)
            putDblList("ppg", value.ppg); putDblList("paPg", value.paPg)
            putDblList("pointDiffPg", value.pointDiffPg)
            putInt("minGames", value.minGames)
            putDblList("atsWinPct", value.atsWinPct); putIntList("atsWinStreak", value.atsWinStreak)
            putDblList("avgCoverMargin", value.avgCoverMargin)
            putDblList("overPct", value.overPct)
            putIntList("overStreak", value.overStreak); putIntList("underStreak", value.underStreak)
            putIntList("prevWins", value.prevWins); putDblList("prevWinPct", value.prevWinPct)
            putBoolOpt("madePlayoffsPrev", value.madePlayoffsPrev)
            putBoolOpt("moreWinsThanOppPrev", value.moreWinsThanOppPrev)
            putStr("h2hLastWin", value.h2hLastWin); putStr("h2hLastAts", value.h2hLastAts)
            putStr("h2hLastOver", value.h2hLastOver)
            putBoolOpt("h2hLastHome", value.h2hLastHome); putBoolOpt("h2hLastFav", value.h2hLastFav)
            putBoolOpt("h2hSameSeason", value.h2hSameSeason)
            putStr("h2hSpreadCmp", value.h2hSpreadCmp)
            putDblList("oppWinPct", value.oppWinPct); putDblList("oppOverPct", value.oppOverPct)
            putIntList("oppWinStreak", value.oppWinStreak); putIntList("oppLossStreak", value.oppLossStreak)
            putDblList("oppPpg", value.oppPpg); putDblList("oppPaPg", value.oppPaPg)
            putDblList("oppPrevWinPct", value.oppPrevWinPct)
            putStr("oppLastResult", value.oppLastResult); putStr("oppLastAts", value.oppLastAts)
            putStr("oppLastTotal", value.oppLastTotal); putStr("oppLastRole", value.oppLastRole)
            putBoolOpt("oppLastOt", value.oppLastOt)
            putIntList("oppLastMargin", value.oppLastMargin)
            putIntList("lastMargin", value.lastMargin)
            putStrList("daysOfWeek", value.daysOfWeek)
            putStrList("teamDivisions", value.teamDivisions)
            putInt("monthMin", value.monthMin); putInt("monthMax", value.monthMax)
            putStrList("teams", value.teams); putStrList("opponents", value.opponents)
            putBoolOpt("interleague", value.interleague)
            putStr("dayOfWeek", value.dayOfWeek)
            putBoolOpt("doubleheader", value.doubleheader)
            putIntList("seriesGames", value.seriesGames)
            putIntOpt("seriesGameMin", value.seriesGameMin); putIntOpt("seriesGameMax", value.seriesGameMax)
            putIntOpt("tripMin", value.tripMin); putIntOpt("tripMax", value.tripMax)
            putBoolOpt("switchGame", value.switchGame)
            putIntOpt("restMin", value.restMin); putIntOpt("restMax", value.restMax)
            putStr("streakMin", value.streakMin); putStr("streakMax", value.streakMax)
            putStr("lastResult", value.lastResult)
            putStr("lastMarginMin", value.lastMarginMin); putStr("lastMarginMax", value.lastMarginMax)
            put("sp", lenientJson.encodeToJsonElement(pitcherListSerializer, value.sp))
            put("oppSp", lenientJson.encodeToJsonElement(pitcherListSerializer, value.oppSp))
            putStr("spHand", value.spHand); putStr("oppSpHand", value.oppSpHand)
            putIntOpt("windMin", value.windMin)
            putStr("windDir", value.windDir)
            putDblOpt("pfRunsMin", value.pfRunsMin); putDblOpt("pfRunsMax", value.pfRunsMax)
            putDbl("f5TotalMin", value.f5TotalMin); putDbl("f5TotalMax", value.f5TotalMax)
            putStr("timeMin", value.timeMin); putStr("timeMax", value.timeMax)
            putDbl("spXfipMin", value.spXfipMin); putDbl("spXfipMax", value.spXfipMax)
            putDbl("oppSpXfipMin", value.oppSpXfipMin); putDbl("oppSpXfipMax", value.oppSpXfipMax)
            putDbl("bpIpMin", value.bpIpMin); putDbl("bpIpMax", value.bpIpMax)
            putDbl("bpXfipMin", value.bpXfipMin); putDbl("bpXfipMax", value.bpXfipMax)
            putDbl("spEraMin", value.spEraMin); putDbl("spEraMax", value.spEraMax)
            putDbl("oppSpEraMin", value.oppSpEraMin); putDbl("oppSpEraMax", value.oppSpEraMax)
            putDblList("rpg", value.rpg); putDblList("rapg", value.rapg)
            putDblList("runDiffPg", value.runDiffPg)
            putDblList("rlCoverPct", value.rlCoverPct); putIntList("rlStreak", value.rlStreak)
            putIntList("h2hLastMargin", value.h2hLastMargin)
            putDblList("oppRlCoverPct", value.oppRlCoverPct)
            putDblList("oppRpg", value.oppRpg); putDblList("oppRapg", value.oppRapg)
        }
        output.encodeJsonElement(JsonObject(map))
    }
}
