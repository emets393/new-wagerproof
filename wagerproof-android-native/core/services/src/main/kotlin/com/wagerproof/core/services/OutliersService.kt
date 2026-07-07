package com.wagerproof.core.services

import com.wagerproof.core.models.OutlierFadeAlert
import com.wagerproof.core.models.OutlierGame
import com.wagerproof.core.models.OutlierValueAlert
import com.wagerproof.core.models.SportLeague
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.OffsetDateTime
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Ports iOS `OutliersService.swift` (itself a byte-identical port of RN's
 * `outliersService.ts`). Three entry points:
 *
 * - [fetchWeekGames] — NFL / CFB / NBA / NCAAB game rows from the CFB Supabase
 *   project, filtered to the next 7 days in America/New_York, predictions merged in.
 * - [fetchValueAlerts] — joins games against the cached `polymarket_markets`
 *   table on the Main project and applies the spread/total/moneyline thresholds.
 * - [fetchFadeAlerts] — per-sport confidence/edge thresholds against the
 *   predictions already merged into each game.
 *
 * MLB is intentionally absent — the RN/iOS services have no MLB branch either;
 * MLB trends come from a separate service.
 */
class OutliersService {

    suspend fun fetchWeekGames(): List<OutlierGame> {
        val window = getDateWindow()
        val games = mutableListOf<OutlierGame>()
        val cfb = SupabaseClients.cfb

        // Each sport is best-effort: one sport's outage must not blank the feed.

        // 1. NFL ----------------------------------------------------------
        runCatching {
            val nflRows = cfb.from("v_input_values_with_epa")
                .select {
                    order("game_date", Order.ASCENDING)
                    order("game_time", Order.ASCENDING)
                }
                .decodeList<OutlierNFLInputRow>()

            // Wide 21-col projection kept verbatim from RN/iOS even though we
            // only decode a subset — the request shape is part of the contract.
            val bettingLines = runCatching {
                cfb.from("nfl_betting_lines")
                    .select(
                        columns = Columns.raw(
                            "training_key, home_ml, away_ml, home_spread, over_line, game_time_et, " +
                                "home_ml_handle, away_ml_handle, home_ml_bets, away_ml_bets, ml_splits_label, " +
                                "home_spread_handle, away_spread_handle, home_spread_bets, away_spread_bets, " +
                                "spread_splits_label, over_handle, under_handle, over_bets, under_bets, total_splits_label"
                        )
                    ) {
                        order("as_of_ts", Order.DESCENDING)
                    }
                    .decodeList<OutlierNFLBettingLine>()
            }.getOrDefault(emptyList())

            // First row per training_key after the as_of_ts desc sort = freshest line.
            val lineMap = HashMap<String, OutlierNFLBettingLine>()
            for (line in bettingLines) if (line.trainingKey !in lineMap) lineMap[line.trainingKey] = line

            for (game in nflRows) {
                val date = game.gameDate ?: continue
                if (date < window.today || date > window.weekFromNow) continue
                val line = lineMap[game.homeAwayUnique]
                val gameTime = line?.gameTimeEt
                    ?: if (game.gameDate != null && game.gameTime != null) "${game.gameDate}T${game.gameTime}" else null
                val homeSpread = line?.homeSpread ?: game.homeSpread
                games += OutlierGame(
                    gameId = game.homeAwayUnique,
                    sport = SportLeague.NFL,
                    awayTeam = game.awayTeam.orEmpty(),
                    homeTeam = game.homeTeam.orEmpty(),
                    gameTime = gameTime,
                    awaySpread = homeSpread?.let { -it },
                    homeSpread = homeSpread,
                    totalLine = line?.overLine ?: game.ouVegasLine,
                    awayMl = line?.awayMl,
                    homeMl = line?.homeMl,
                )
            }
        }

        // 2. CFB ----------------------------------------------------------
        runCatching {
            val rows = cfb.from("cfb_live_weekly_inputs").select().decodeList<OutlierCFBInputRow>()
            for (game in rows) {
                val raw = game.startDate ?: game.startTime ?: game.gameDatetime ?: game.datetime ?: game.date
                    ?: continue
                val etDate = formatETDate(raw) ?: continue
                if (etDate < window.today || etDate > window.weekFromNow) continue
                games += OutlierGame(
                    gameId = game.trainingKey ?: "${game.id ?: 0}",
                    sport = SportLeague.CFB,
                    awayTeam = game.awayTeam.orEmpty(),
                    homeTeam = game.homeTeam.orEmpty(),
                    gameTime = raw,
                    awaySpread = game.awaySpread ?: game.apiSpread?.let { -it },
                    homeSpread = game.homeSpread ?: game.apiSpread,
                    totalLine = game.totalLine ?: game.apiOverLine,
                    awayMl = game.awayMoneyline ?: game.awayMl,
                    homeMl = game.homeMoneyline ?: game.homeMl,
                )
            }
        }

        // 3. NBA ----------------------------------------------------------
        runCatching {
            val rows = cfb.from("nba_input_values_view")
                .select { order("game_date", Order.ASCENDING) }
                .decodeList<OutlierNBAInputRow>()

            for (game in rows) {
                var gameDate = game.gameDate
                game.tipoffTimeEt?.let { tip -> formatETDate(tip)?.let { gameDate = it } }
                val date = gameDate ?: continue
                if (date < window.today || date > window.weekFromNow) continue
                val homeML = game.homeMoneyline
                // Prefer the explicit away_moneyline column; complement formula is fallback.
                val awayML = game.awayMoneyline
                    ?: homeML?.let { ml -> if (ml > 0) -(ml + 100) else 100 - ml }
                val homeSpread = game.homeSpread
                games += OutlierGame(
                    gameId = game.trainingKey ?: game.uniqueId ?: "${game.gameId}",
                    sport = SportLeague.NBA,
                    awayTeam = game.awayTeam.orEmpty(),
                    homeTeam = game.homeTeam.orEmpty(),
                    gameTime = game.tipoffTimeEt ?: game.gameDate,
                    awaySpread = homeSpread?.let { -it },
                    homeSpread = homeSpread,
                    totalLine = game.totalLine,
                    awayMl = awayML,
                    homeMl = homeML,
                    awayTeamAbbrev = game.awayAbbr?.takeIf { it.trim().isNotEmpty() } ?: game.awayTeam,
                    homeTeamAbbrev = game.homeAbbr?.takeIf { it.trim().isNotEmpty() } ?: game.homeTeam,
                )
            }
        }

        // 4. NCAAB --------------------------------------------------------
        runCatching {
            val (rows, mappings) = coroutineScope {
                val rowsTask = async {
                    cfb.from("v_cbb_input_values")
                        .select { order("game_date_et", Order.ASCENDING) }
                        .decodeList<OutlierNCAABInputRow>()
                }
                val mappingTask = async {
                    cfb.from("ncaab_team_mapping")
                        .select(columns = Columns.raw("api_team_id, espn_team_id, team_abbrev"))
                        .decodeList<OutlierNCAABTeamMapping>()
                }
                rowsTask.await() to mappingTask.await()
            }

            val teamMap = HashMap<String, Pair<String?, String?>>() // apiTeamId -> (logo, abbrev)
            for (m in mappings) {
                val logo = m.espnTeamId?.let { "https://a.espncdn.com/i/teamlogos/ncaa/500/$it.png" }
                teamMap["${m.apiTeamId}"] = logo to m.teamAbbrev
            }

            for (game in rows) {
                var gameDate = game.gameDateEt
                val dtSource = game.startUtc ?: game.tipoffTimeEt
                dtSource?.let { src -> formatETDate(src)?.let { gameDate = it } }
                val date = gameDate ?: continue
                if (date < window.today || date > window.weekFromNow) continue
                val homeMap = game.homeTeamId?.let { teamMap["$it"] }
                val awayMap = game.awayTeamId?.let { teamMap["$it"] }
                val homeSpread = game.spread
                games += OutlierGame(
                    gameId = game.trainingKey ?: game.uniqueId ?: "${game.gameId}",
                    sport = SportLeague.NCAAB,
                    awayTeam = game.awayTeam.orEmpty(),
                    homeTeam = game.homeTeam.orEmpty(),
                    gameTime = game.startUtc ?: game.tipoffTimeEt ?: game.gameDateEt,
                    awaySpread = homeSpread?.let { -it },
                    homeSpread = homeSpread,
                    totalLine = game.overUnder,
                    awayMl = game.awayMoneyline,
                    homeMl = game.homeMoneyline,
                    awayTeamLogo = awayMap?.first,
                    homeTeamLogo = homeMap?.first,
                    awayTeamAbbrev = awayMap?.second,
                    homeTeamAbbrev = homeMap?.second,
                )
            }
        }

        // Hydrate predictions so fade alerts can run their thresholds.
        return hydratePredictions(games)
    }

    suspend fun fetchValueAlerts(weekGames: List<OutlierGame>): List<OutlierValueAlert> {
        if (weekGames.isEmpty()) return emptyList()
        val main = SupabaseClients.main

        // RN groups by league because the polymarket query takes (league + game_keys[]).
        val byLeague = weekGames.groupBy { it.sport }
        val marketsByGameKey = HashMap<String, MutableList<PolymarketOutlierRow>>()

        for ((league, games) in byLeague) {
            val gameKeys = games.map { "${league.raw}_${it.awayTeam}_${it.homeTeam}" }.distinct()
            if (gameKeys.isEmpty()) continue
            val markets = runCatching {
                main.from("polymarket_markets")
                    .select(columns = Columns.raw("game_key, market_type, current_away_odds, current_home_odds")) {
                        filter {
                            eq("league", league.raw)
                            isIn("game_key", gameKeys)
                        }
                    }
                    .decodeList<PolymarketOutlierRow>()
            }.getOrNull() ?: continue
            for (m in markets) marketsByGameKey.getOrPut(m.gameKey) { mutableListOf() } += m
        }

        val alerts = mutableListOf<OutlierValueAlert>()
        for (game in weekGames) {
            val markets = marketsByGameKey["${game.sport.raw}_${game.awayTeam}_${game.homeTeam}"] ?: continue
            for (market in markets) {
                val awayOdds = market.currentAwayOdds ?: 0.0
                val homeOdds = market.currentHomeOdds ?: 0.0
                // Skip stale / resolved / no-liquidity markets.
                if (awayOdds >= 95 || homeOdds >= 95 || awayOdds <= 5 || homeOdds <= 5 || awayOdds + homeOdds < 80) {
                    continue
                }

                fun add(marketType: OutlierValueAlert.MarketType, side: String, percentage: Double) {
                    alerts += OutlierValueAlert(
                        gameId = game.gameId, sport = game.sport,
                        awayTeam = game.awayTeam, homeTeam = game.homeTeam,
                        marketType = marketType, side = side,
                        percentage = percentage, game = game,
                    )
                }

                when (market.marketType) {
                    "spread" -> {
                        if (awayOdds > 57) add(OutlierValueAlert.MarketType.SPREAD, game.awayTeam, awayOdds)
                        if (homeOdds > 57) add(OutlierValueAlert.MarketType.SPREAD, game.homeTeam, homeOdds)
                    }
                    "total" -> {
                        // Polymarket total rows store Over on the away column, Under on home.
                        if (awayOdds > 57) add(OutlierValueAlert.MarketType.TOTAL, "Over", awayOdds)
                        if (homeOdds > 57) add(OutlierValueAlert.MarketType.TOTAL, "Under", homeOdds)
                    }
                    "moneyline" -> {
                        // Skip if book odds are -200 or worse (heavy favorite = no value).
                        val awayHasValue = (game.awayMl ?: 0) == 0 || (game.awayMl ?: 0) > -200
                        if (awayOdds >= 85 && awayHasValue) add(OutlierValueAlert.MarketType.MONEYLINE, game.awayTeam, awayOdds)
                        val homeHasValue = (game.homeMl ?: 0) == 0 || (game.homeMl ?: 0) > -200
                        if (homeOdds >= 85 && homeHasValue) add(OutlierValueAlert.MarketType.MONEYLINE, game.homeTeam, homeOdds)
                    }
                }
            }
        }
        return alerts
    }

    fun fetchFadeAlerts(weekGames: List<OutlierGame>): List<OutlierFadeAlert> {
        val alerts = mutableListOf<OutlierFadeAlert>()

        fun add(game: OutlierGame, pickType: OutlierFadeAlert.PickType, predictedTeam: String, confidence: Int) {
            alerts += OutlierFadeAlert(
                gameId = game.gameId, sport = game.sport,
                awayTeam = game.awayTeam, homeTeam = game.homeTeam,
                pickType = pickType, predictedTeam = predictedTeam,
                confidence = confidence, game = game,
            )
        }

        for (game in weekGames) {
            when (game.sport) {
                SportLeague.NFL -> {
                    // NFL thresholds are probability-based (model prob >= 80% either side).
                    game.homeAwaySpreadCoverProb?.let { p ->
                        val isHome = p > 0.5
                        val conf = ((if (isHome) p else 1 - p) * 100).roundToInt()
                        if (conf >= 80) add(game, OutlierFadeAlert.PickType.SPREAD, if (isHome) game.homeTeam else game.awayTeam, conf)
                    }
                    game.ouResultProb?.let { p ->
                        val isOver = p > 0.5
                        val conf = ((if (isOver) p else 1 - p) * 100).roundToInt()
                        if (conf >= 80) add(game, OutlierFadeAlert.PickType.TOTAL, if (isOver) "Over" else "Under", conf)
                    }
                }
                SportLeague.CFB -> {
                    // CFB thresholds are point-edge-based; confidence = rounded |edge|.
                    game.homeSpreadDiff?.takeIf { abs(it) > 10 }?.let { edge ->
                        add(game, OutlierFadeAlert.PickType.SPREAD, if (edge > 0) game.homeTeam else game.awayTeam, abs(edge).roundToInt())
                    }
                    game.overLineDiff?.takeIf { abs(it) > 10 }?.let { edge ->
                        add(game, OutlierFadeAlert.PickType.TOTAL, if (edge > 0) "Over" else "Under", abs(edge).roundToInt())
                    }
                }
                SportLeague.NBA -> {
                    // RN: NBA only spread fades, threshold 9.5.
                    game.homeSpreadDiff?.takeIf { abs(it) >= 9.5 }?.let { edge ->
                        add(game, OutlierFadeAlert.PickType.SPREAD, if (edge > 0) game.homeTeam else game.awayTeam, abs(edge).roundToInt())
                    }
                }
                SportLeague.NCAAB -> {
                    game.homeSpreadDiff?.takeIf { abs(it) > 5 }?.let { edge ->
                        add(game, OutlierFadeAlert.PickType.SPREAD, if (edge > 0) game.homeTeam else game.awayTeam, abs(edge).roundToInt())
                    }
                    game.overLineDiff?.takeIf { abs(it) > 5 }?.let { edge ->
                        add(game, OutlierFadeAlert.PickType.TOTAL, if (edge > 0) "Over" else "Under", abs(edge).roundToInt())
                    }
                }
                SportLeague.MLB -> Unit // no MLB fade alerts in RN/iOS either
            }
        }
        return alerts
    }

    // -- Predictions hydration ------------------------------------------------
    //
    // Mirrors RN's hydratePredictions: per sport, pull the latest run and merge
    // win-prob / spread-diff / over-diff columns onto each game.

    private suspend fun hydratePredictions(games: List<OutlierGame>): List<OutlierGame> {
        val cfb = SupabaseClients.cfb
        val indexed = games.withIndex().associate { (i, g) -> g.gameId to i }
        val out = games.toMutableList()

        // NFL -------------------------------------------------------------
        val nflIds = games.filter { it.sport == SportLeague.NFL }.map { it.gameId }
        if (nflIds.isNotEmpty()) {
            val runId = runCatching {
                cfb.from("nfl_predictions_epa")
                    .select(columns = Columns.raw("run_id")) {
                        order("run_id", Order.DESCENDING)
                        limit(1)
                    }
                    .decodeList<OutlierRunRow>()
                    .firstOrNull()?.runId
            }.getOrNull()
            if (runId != null) {
                val preds = runCatching {
                    cfb.from("nfl_predictions_epa")
                        .select {
                            filter {
                                eq("run_id", runId)
                                isIn("training_key", nflIds)
                            }
                        }
                        .decodeList<OutlierNFLPredictionRow>()
                }.getOrDefault(emptyList())
                for (p in preds) {
                    val idx = indexed[p.trainingKey] ?: continue
                    out[idx] = out[idx].copy(
                        homeAwaySpreadCoverProb = p.homeAwaySpreadCoverProb,
                        ouResultProb = p.ouResultProb,
                        homeAwayMlProb = p.homeAwayMlProb,
                    )
                }
            }
        }

        // CFB -------------------------------------------------------------
        val cfbGames = games.filter { it.sport == SportLeague.CFB }
        if (cfbGames.isNotEmpty()) {
            val preds = runCatching {
                cfb.from("cfb_api_predictions").select().decodeList<OutlierCFBPredictionRow>()
            }.getOrDefault(emptyList())
            val predMap = preds.mapNotNull { p -> p.id?.let { it to p } }.toMap()
            for (game in cfbGames) {
                // CFB game ids are the numeric cfb_api_predictions ids.
                val p = game.gameId.toIntOrNull()?.let { predMap[it] } ?: continue
                val idx = indexed[game.gameId] ?: continue
                out[idx] = out[idx].copy(
                    homeAwaySpreadCoverProb = p.homeAwaySpreadCoverProb,
                    ouResultProb = p.ouResultProb,
                    homeAwayMlProb = p.homeAwayMlProb,
                    homeSpreadDiff = p.homeSpreadDiff,
                    overLineDiff = p.overLineDiff,
                )
            }
        }

        // NBA -------------------------------------------------------------
        val nbaGames = games.filter { it.sport == SportLeague.NBA }
        if (nbaGames.isNotEmpty()) {
            val preds = runCatching {
                cfb.from("nba_predictions")
                    .select(
                        columns = Columns.raw(
                            "game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, " +
                                "away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc"
                        )
                    )
                    .decodeList<OutlierNBAPredictionRow>()
            }.getOrDefault(emptyList())

            // Keep latest per game_id (ISO timestamps compare lexicographically).
            val predMap = HashMap<Int, OutlierNBAPredictionRow>()
            for (p in preds) {
                val existing = predMap[p.gameId]
                if (existing != null && existing.asOfTsUtc != null && p.asOfTsUtc != null) {
                    if (p.asOfTsUtc > existing.asOfTsUtc) predMap[p.gameId] = p
                } else if (existing == null) {
                    predMap[p.gameId] = p
                }
            }

            for (game in nbaGames) {
                // gameId might be a training_key — the numeric tail is the game_id.
                val gid = game.gameId.split("_").last().toIntOrNull() ?: game.gameId.toIntOrNull() ?: continue
                val p = predMap[gid] ?: continue
                val idx = indexed[game.gameId] ?: continue
                val g = out[idx]

                // Spread cover prob synthesized from fair-vs-vegas gap (same 0.05/cap-0.35
                // heuristic as LiveScores); falls back to raw win prob.
                val fairSpread = p.modelFairHomeSpread
                val coverProb: Double? = if (fairSpread != null && g.homeSpread != null) {
                    val diff = abs(fairSpread - g.homeSpread!!)
                    if (fairSpread < g.homeSpread!!) 0.5 + min(diff * 0.05, 0.35) else 0.5 - min(diff * 0.05, 0.35)
                } else {
                    p.homeWinProb
                }
                val fairTotal = p.modelFairTotal
                val ouProb: Double? = if (fairTotal != null && g.totalLine != null) {
                    val diff = fairTotal - g.totalLine!!
                    if (diff > 0) 0.5 + min(abs(diff) * 0.02, 0.35) else 0.5 - min(abs(diff) * 0.02, 0.35)
                } else {
                    null
                }
                out[idx] = g.copy(
                    homeAwaySpreadCoverProb = coverProb,
                    ouResultProb = ouProb,
                    homeAwayMlProb = p.homeWinProb,
                    homeSpreadDiff = if (fairSpread != null && g.homeSpread != null) fairSpread - g.homeSpread!! else null,
                    overLineDiff = if (fairTotal != null && g.totalLine != null) fairTotal - g.totalLine!! else null,
                )
            }
        }

        // NCAAB -----------------------------------------------------------
        val ncaabGames = games.filter { it.sport == SportLeague.NCAAB }
        if (ncaabGames.isNotEmpty()) {
            val runId = runCatching {
                cfb.from("ncaab_predictions")
                    .select(columns = Columns.raw("run_id")) {
                        order("as_of_ts_utc", Order.DESCENDING)
                        limit(1)
                    }
                    .decodeList<OutlierRunRow>()
                    .firstOrNull()?.runId
            }.getOrNull()
            if (runId != null) {
                val preds = runCatching {
                    cfb.from("ncaab_predictions")
                        .select { filter { eq("run_id", runId) } }
                        .decodeList<OutlierNCAABPredictionRow>()
                }.getOrDefault(emptyList())
                val predMap = HashMap<Int, OutlierNCAABPredictionRow>()
                for (p in preds) if (p.gameId !in predMap) predMap[p.gameId] = p

                for (game in ncaabGames) {
                    val gid = game.gameId.split("_").last().toIntOrNull() ?: game.gameId.toIntOrNull() ?: continue
                    val p = predMap[gid] ?: continue
                    val idx = indexed[game.gameId] ?: continue
                    val g = out[idx]

                    // NCAAB: home_win_prob doubles as the spread-cover proxy.
                    val coverProb = p.homeAwaySpreadCoverProb ?: p.homeWinProb
                    val vegasTotal = p.vegasTotal ?: g.totalLine
                    var ouProb = p.ouResultProb
                    if (ouProb == null && p.predTotalPoints != null && vegasTotal != null) {
                        ouProb = if (p.predTotalPoints > vegasTotal) 0.6 else 0.4
                    }
                    // Vegas lines on the pred row override the input-view lines.
                    out[idx] = g.copy(
                        awaySpread = p.vegasHomeSpread?.let { -it } ?: g.awaySpread,
                        homeSpread = p.vegasHomeSpread ?: g.homeSpread,
                        totalLine = p.vegasTotal ?: g.totalLine,
                        awayMl = p.vegasAwayMoneyline ?: g.awayMl,
                        homeMl = p.vegasHomeMoneyline ?: g.homeMl,
                        homeAwaySpreadCoverProb = coverProb,
                        ouResultProb = ouProb,
                        homeAwayMlProb = p.homeWinProb,
                        homeSpreadDiff = p.homeSpreadDiff,
                        overLineDiff = p.overLineDiff,
                    )
                }
            }
        }

        return out
    }

    // -- Date helpers (America/New_York window, 7 days forward) ----------------

    data class DateWindow(val today: String, val weekFromNow: String)

    companion object {
        val shared: OutliersService by lazy { OutliersService() }

        fun getDateWindow(): DateWindow =
            DateWindow(today = ServiceDates.todayET(), weekFromNow = ServiceDates.etDate(7))

        /**
         * Parse arbitrary date strings (ISO 8601, yyyy-MM-dd, space-separated ISO)
         * to yyyy-MM-dd in America/New_York. Mirrors RN's Intl.DateTimeFormat use.
         */
        internal fun formatETDate(raw: String): String? {
            // ISO 8601 with an offset, fractional seconds or not.
            runCatching { OffsetDateTime.parse(raw) }.getOrNull()?.let {
                return ServiceDates.etDateString(it.toInstant())
            }
            // Bare yyyy-MM-dd prefix: already an ET-day key, trust as-is.
            if (raw.length >= 10 && raw.take(10).contains("-")) return raw.take(10)
            // Space-separated ISO ("2026-05-20 19:00:00+00").
            runCatching { OffsetDateTime.parse(raw.replace(" ", "T")) }.getOrNull()?.let {
                return ServiceDates.etDateString(it.toInstant())
            }
            return null
        }
    }
}

// -- Wire-row DTOs (private in the iOS service too — not shared model types) ---

@Serializable
private data class OutlierNFLInputRow(
    @SerialName("home_away_unique") val homeAwayUnique: String,
    @SerialName("away_team") val awayTeam: String? = null,
    @SerialName("home_team") val homeTeam: String? = null,
    @SerialName("game_date") val gameDate: String? = null,
    @SerialName("game_time") val gameTime: String? = null,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("ou_vegas_line") val ouVegasLine: Double? = null,
    val id: String? = null,
    @SerialName("unique_id") val uniqueId: String? = null,
)

@Serializable
private data class OutlierNFLBettingLine(
    @SerialName("training_key") val trainingKey: String,
    @SerialName("home_ml") val homeMl: Int? = null,
    @SerialName("away_ml") val awayMl: Int? = null,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("over_line") val overLine: Double? = null,
    @SerialName("game_time_et") val gameTimeEt: String? = null,
)

@Serializable
private data class OutlierCFBInputRow(
    val id: Int? = null,
    @SerialName("training_key") val trainingKey: String? = null,
    @SerialName("away_team") val awayTeam: String? = null,
    @SerialName("home_team") val homeTeam: String? = null,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("start_time") val startTime: String? = null,
    @SerialName("game_datetime") val gameDatetime: String? = null,
    val datetime: String? = null,
    val date: String? = null,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("away_spread") val awaySpread: Double? = null,
    @SerialName("api_spread") val apiSpread: Double? = null,
    @SerialName("total_line") val totalLine: Double? = null,
    @SerialName("api_over_line") val apiOverLine: Double? = null,
    @SerialName("away_moneyline") val awayMoneyline: Int? = null,
    @SerialName("home_moneyline") val homeMoneyline: Int? = null,
    @SerialName("away_ml") val awayMl: Int? = null,
    @SerialName("home_ml") val homeMl: Int? = null,
)

@Serializable
private data class OutlierNBAInputRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("training_key") val trainingKey: String? = null,
    @SerialName("unique_id") val uniqueId: String? = null,
    @SerialName("away_team") val awayTeam: String? = null,
    @SerialName("home_team") val homeTeam: String? = null,
    @SerialName("away_abbr") val awayAbbr: String? = null,
    @SerialName("home_abbr") val homeAbbr: String? = null,
    @SerialName("game_date") val gameDate: String? = null,
    @SerialName("tipoff_time_et") val tipoffTimeEt: String? = null,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("total_line") val totalLine: Double? = null,
    @SerialName("home_moneyline") val homeMoneyline: Int? = null,
    @SerialName("away_moneyline") val awayMoneyline: Int? = null,
)

@Serializable
private data class OutlierNCAABInputRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("training_key") val trainingKey: String? = null,
    @SerialName("unique_id") val uniqueId: String? = null,
    @SerialName("away_team") val awayTeam: String? = null,
    @SerialName("home_team") val homeTeam: String? = null,
    @SerialName("away_team_id") val awayTeamId: Int? = null,
    @SerialName("home_team_id") val homeTeamId: Int? = null,
    @SerialName("game_date_et") val gameDateEt: String? = null,
    @SerialName("start_utc") val startUtc: String? = null,
    @SerialName("tipoff_time_et") val tipoffTimeEt: String? = null,
    val spread: Double? = null,
    @SerialName("over_under") val overUnder: Double? = null,
    // The view really does expose camelCase ML columns (parity gotcha — do not snake_case).
    @SerialName("homeMoneyline") val homeMoneyline: Int? = null,
    @SerialName("awayMoneyline") val awayMoneyline: Int? = null,
)

@Serializable
private data class OutlierNCAABTeamMapping(
    @SerialName("api_team_id") val apiTeamId: Int,
    @SerialName("espn_team_id") val espnTeamId: Int? = null,
    @SerialName("team_abbrev") val teamAbbrev: String? = null,
)

/** Slim projection over polymarket_markets — the shared PolymarketMarket model is the full row. */
@Serializable
private data class PolymarketOutlierRow(
    @SerialName("game_key") val gameKey: String,
    @SerialName("market_type") val marketType: String,
    @SerialName("current_away_odds") val currentAwayOdds: Double? = null,
    @SerialName("current_home_odds") val currentHomeOdds: Double? = null,
)

@Serializable
private data class OutlierRunRow(@SerialName("run_id") val runId: Int? = null)

@Serializable
private data class OutlierNFLPredictionRow(
    @SerialName("training_key") val trainingKey: String,
    @SerialName("home_away_spread_cover_prob") val homeAwaySpreadCoverProb: Double? = null,
    @SerialName("ou_result_prob") val ouResultProb: Double? = null,
    @SerialName("home_away_ml_prob") val homeAwayMlProb: Double? = null,
)

@Serializable
private data class OutlierCFBPredictionRow(
    val id: Int? = null,
    @SerialName("home_away_spread_cover_prob") val homeAwaySpreadCoverProb: Double? = null,
    @SerialName("ou_result_prob") val ouResultProb: Double? = null,
    @SerialName("home_away_ml_prob") val homeAwayMlProb: Double? = null,
    @SerialName("home_spread_diff") val homeSpreadDiff: Double? = null,
    @SerialName("over_line_diff") val overLineDiff: Double? = null,
)

@Serializable
private data class OutlierNBAPredictionRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("home_win_prob") val homeWinProb: Double? = null,
    @SerialName("model_fair_total") val modelFairTotal: Double? = null,
    @SerialName("model_fair_home_spread") val modelFairHomeSpread: Double? = null,
    @SerialName("as_of_ts_utc") val asOfTsUtc: String? = null,
)

@Serializable
private data class OutlierNCAABPredictionRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("home_win_prob") val homeWinProb: Double? = null,
    @SerialName("home_away_spread_cover_prob") val homeAwaySpreadCoverProb: Double? = null,
    @SerialName("ou_result_prob") val ouResultProb: Double? = null,
    @SerialName("pred_total_points") val predTotalPoints: Double? = null,
    @SerialName("model_fair_home_spread") val modelFairHomeSpread: Double? = null,
    @SerialName("home_spread_diff") val homeSpreadDiff: Double? = null,
    @SerialName("over_line_diff") val overLineDiff: Double? = null,
    @SerialName("vegas_home_spread") val vegasHomeSpread: Double? = null,
    @SerialName("vegas_total") val vegasTotal: Double? = null,
    @SerialName("vegas_home_moneyline") val vegasHomeMoneyline: Int? = null,
    @SerialName("vegas_away_moneyline") val vegasAwayMoneyline: Int? = null,
)
