package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// MARK: - `nfl_player_prop_trends` row (detail-page columns)
//
// Mirrors iOS `NFLPropTrendsDetail.swift`. The Outliers feature reads this
// table's `splits`/`matchups` through its own decoder; this model is the
// player-analysis contract, adding `recent_game_log` and the
// `nfl_player_game_logs` actuals enrichment ported from the web
// (`src/features/propBreakdown/hooks.ts`).

/** One entry of `recent_game_log`, newest-first as stored. */
data class NFLPropTrendGame(
    val season: Int,
    val week: Int,
    val opp: String,
    val isHome: Boolean? = null,
    val isDiv: Boolean? = null,
    val isPrimetime: Boolean? = null,
    /**
     * Served grade letters per market: O/U/P (over/under/push) or Y/N (ATD).
     * Decoded for tooltips; the Last-10 chart grades vs TODAY's line instead.
     */
    val markets: Map<String, String> = emptyMap(),
    /** Actual stat totals keyed by market — merged from `nfl_player_game_logs`. */
    val actuals: Map<String, Double> = emptyMap(),
    /** Historical closing line used to grade each result (unused for bar color). */
    val lines: Map<String, Double> = emptyMap(),
)

/** Career H2H record vs one opponent: meeting count + per-market hit rates. */
data class NFLPropTrendMatchup(
    val meetings: Int,
    val byMarket: Map<String, NFLPropHitRate>,
)

/** One situational record: `n = h + l` (pushes excluded from n). */
data class NFLPropSituationRecord(val h: Int, val n: Int, val pct: Double)

data class NFLPropTrendsDetail(
    val playerId: String,
    /** Newest-first, ≤10 entries. */
    val recentGameLog: List<NFLPropTrendGame>,
    /** Opponent abbreviation → career matchup record. */
    val matchups: Map<String, NFLPropTrendMatchup>,
    /**
     * marketKey → bucket (overall/home/away/division/non_division/primetime/
     * regular) → window ("3"/"5"/"7") → record.
     */
    val splits: Map<String, Map<String, Map<String, NFLPropSituationRecord>>>,
) {
    companion object {
        /**
         * The window record the UI shows for one bucket: 5-game, else 7, else 3
         * (mirrors the web's `windows['5'] ?? windows['7'] ?? windows['3']`).
         */
        fun preferredWindow(windows: Map<String, NFLPropSituationRecord>): NFLPropSituationRecord? =
            windows["5"] ?: windows["7"] ?: windows["3"]

        // MARK: JSONB mapping (exposed for decode-fixture tests)

        fun mapGameLog(json: JsonElement?): List<NFLPropTrendGame> {
            val items = json.asArr ?: return emptyList()
            return items.mapNotNull { item ->
                val o = item.asObj ?: return@mapNotNull null
                val season = o["season"].asInt ?: return@mapNotNull null
                val week = o["week"].asInt ?: return@mapNotNull null
                NFLPropTrendGame(
                    season = season,
                    week = week,
                    opp = o["opp"].asString ?: "",
                    isHome = o["is_home"].asBool,
                    isDiv = o["is_div"].asBool,
                    isPrimetime = o["is_primetime"].asBool,
                    markets = mapStringMap(o["markets"]),
                    actuals = mapDoubleMap(o["actuals"]),
                    lines = mapDoubleMap(o["lines"]),
                )
            }
        }

        fun mapMatchups(json: JsonElement?): Map<String, NFLPropTrendMatchup> {
            val byOpp = json.asObj ?: return emptyMap()
            val out = mutableMapOf<String, NFLPropTrendMatchup>()
            for ((opp, raw) in byOpp) {
                val o = raw.asObj ?: continue
                val meetings = o["meetings"].asInt ?: continue
                val byMarket = o.entries
                    .filter { it.key != "meetings" }
                    .mapNotNull { (key, value) -> NFLPropPlayerPage.mapHitRate(value)?.let { key to it } }
                    .toMap()
                out[opp] = NFLPropTrendMatchup(meetings = meetings, byMarket = byMarket)
            }
            return out
        }

        fun mapSplits(json: JsonElement?): Map<String, Map<String, Map<String, NFLPropSituationRecord>>> {
            val byMarket = json.asObj ?: return emptyMap()
            val out = mutableMapOf<String, Map<String, Map<String, NFLPropSituationRecord>>>()
            for ((market, rawBuckets) in byMarket) {
                val byBucket = rawBuckets.asObj ?: continue
                val buckets = mutableMapOf<String, Map<String, NFLPropSituationRecord>>()
                for ((bucket, rawWindows) in byBucket) {
                    val byWindow = rawWindows.asObj ?: continue
                    val windows = byWindow.mapNotNull { (window, rec) ->
                        val o = rec.asObj ?: return@mapNotNull null
                        val h = o["h"].asInt ?: return@mapNotNull null
                        val n = o["n"].asInt ?: return@mapNotNull null
                        val pct = o["pct"].asDouble ?: return@mapNotNull null
                        window to NFLPropSituationRecord(h = h, n = n, pct = pct)
                    }.toMap()
                    if (windows.isNotEmpty()) buckets[bucket] = windows
                }
                if (buckets.isNotEmpty()) out[market] = buckets
            }
            return out
        }

        private fun mapStringMap(json: JsonElement?): Map<String, String> =
            json.asObj?.mapNotNull { (key, value) -> value.asString?.let { key to it } }?.toMap()
                ?: emptyMap()

        private fun mapDoubleMap(json: JsonElement?): Map<String, Double> =
            json.asObj?.mapNotNull { (key, value) -> value.asDouble?.let { key to it } }?.toMap()
                ?: emptyMap()
    }
}

/** Wire row for `nfl_player_prop_trends` (detail columns only). */
@Serializable
data class NFLPropTrendsDetailRow(
    @SerialName("player_id") val playerId: String,
    @SerialName("recent_game_log") val recentGameLog: JsonElement? = null,
    val matchups: JsonElement? = null,
    val splits: JsonElement? = null,
) {
    fun toDetail(): NFLPropTrendsDetail = NFLPropTrendsDetail(
        playerId = playerId,
        recentGameLog = NFLPropTrendsDetail.mapGameLog(recentGameLog),
        matchups = NFLPropTrendsDetail.mapMatchups(matchups),
        splits = NFLPropTrendsDetail.mapSplits(splits),
    )
}

// MARK: - `nfl_player_game_logs` enrichment

/** One row of `nfl_player_game_logs` — real stat totals per (player, season, week). */
@Serializable
data class NFLPlayerGameLogRow(
    @SerialName("player_id") val playerId: String,
    val season: Int,
    val week: Int,
    @SerialName("pass_yds") val passYds: Double? = null,
    @SerialName("pass_tds") val passTds: Double? = null,
    @SerialName("rush_yds") val rushYds: Double? = null,
    @SerialName("rush_tds") val rushTds: Double? = null,
    @SerialName("rec_yds") val recYds: Double? = null,
    @SerialName("rec_tds") val recTds: Double? = null,
    val receptions: Double? = null,
    @SerialName("pass_attempts") val passAttempts: Double? = null,
    val carries: Double? = null,
    val completions: Double? = null,
)

object NFLPropTrendsEnrichment {
    /**
     * Merge real stat totals into each game's `actuals`, keyed by market —
     * port of the web merge in `propBreakdown/hooks.ts`. ATD is synthesized as
     * rushing + receiving TDs (each defaulting to 0) whenever the stats row
     * exists.
     */
    fun enrich(
        log: List<NFLPropTrendGame>,
        gameLogs: List<NFLPlayerGameLogRow>,
    ): List<NFLPropTrendGame> {
        if (log.isEmpty() || gameLogs.isEmpty()) return log
        val statsByGame = gameLogs.associateBy { "${it.season}-${it.week}" }
        return log.map { game ->
            val stats = statsByGame["${game.season}-${game.week}"] ?: return@map game
            val actuals = game.actuals.toMutableMap()
            listOf(
                "player_pass_yds" to stats.passYds,
                "player_pass_tds" to stats.passTds,
                "player_receptions" to stats.receptions,
                "player_reception_yds" to stats.recYds,
                "player_rush_yds" to stats.rushYds,
                "player_pass_attempts" to stats.passAttempts,
                "player_rush_attempts" to stats.carries,
                "player_pass_completions" to stats.completions,
            ).forEach { (market, value) ->
                if (value != null && value.isFinite()) actuals[market] = value
            }
            actuals["player_anytime_td"] = (stats.rushTds ?: 0.0) + (stats.recTds ?: 0.0)
            game.copy(actuals = actuals)
        }
    }
}
