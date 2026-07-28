package com.wagerproof.core.services

import com.wagerproof.core.models.GamePredictions
import com.wagerproof.core.models.LiveGame
import com.wagerproof.core.models.LiveScoreRow
import com.wagerproof.core.models.PredictionStatus
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.min

/**
 * Live scores service (port of iOS LiveScoresService.swift, itself a port of
 * RN `liveScoresService.ts`). Two-step:
 *
 *   1. Fetch `live_scores` rows from the Main Supabase project.
 *   2. Fetch the latest model predictions per league from the CFB project,
 *      merge into the games, and compute hitting/missing badges.
 *
 * Only step 1 hard-fails — every per-league prediction fetch swallows its own
 * errors and returns empty, so a single league outage never blanks the board.
 */
class LiveScoresService {

    companion object {
        val shared: LiveScoresService = LiveScoresService()
    }

    /** Public entry point. Throws only if the `live_scores` fetch itself fails. */
    suspend fun getLiveScores(): List<LiveGame> {
        val games = fetchLiveScores()
        return enrichGamesWithPredictions(games)
    }

    // region Live scores fetch

    private suspend fun fetchLiveScores(): List<LiveGame> {
        val rows = SupabaseClients.main.from("live_scores")
            .select {
                filter { eq("is_live", true) }
                order("league", Order.ASCENDING)
                order("away_abbr", Order.ASCENDING)
            }
            .decodeList<LiveScoreRow>()

        // Normalize wire row -> LiveGame; RN defaults game_id to id, period to "".
        return rows.map { row ->
            LiveGame(
                id = row.id,
                gameId = row.gameId ?: row.id,
                league = row.league,
                homeTeam = row.homeTeam,
                awayTeam = row.awayTeam,
                homeAbbr = row.homeAbbr,
                awayAbbr = row.awayAbbr,
                homeScore = row.homeScore,
                awayScore = row.awayScore,
                quarter = row.period ?: "",
                period = row.period ?: "",
                timeRemaining = row.timeRemaining ?: "",
                isLive = row.isLive,
                gameStatus = row.status ?: "",
                // truncatedTo(SECONDS) matches iOS ISO8601DateFormatter (no fractional seconds)
                lastUpdated = row.lastUpdated
                    ?: Instant.now().truncatedTo(ChronoUnit.SECONDS).toString(),
            )
        }
    }

    // endregion

    // region Prediction enrichment

    private suspend fun enrichGamesWithPredictions(games: List<LiveGame>): List<LiveGame> {
        if (games.isEmpty()) return games

        // Fan out the four prediction fetches concurrently (RN Promise.all).
        // Each fetch swallows its own errors and returns empty.
        return coroutineScope {
            val nflDeferred = async { fetchNFLPredictions() }
            val cfbDeferred = async { fetchCFBPredictions() }
            val nbaDeferred = async { fetchNBAPredictions() }
            val ncaabDeferred = async { fetchNCAABPredictions() }

            val nfl = nflDeferred.await()
            val cfb = cfbDeferred.await()
            val nba = nbaDeferred.await()
            val ncaab = ncaabDeferred.await()

            games.map { game ->
                when (game.league.uppercase()) {
                    "NFL" -> nfl.firstOrNull { gamesMatch(game, it.homeTeam, it.awayTeam) }
                        ?.let { game.copy(predictions = computePredictions(game, PredictionSource.NFL(it))) }
                        ?: game

                    "CFB", "NCAAF" -> cfb.firstOrNull { gamesMatch(game, it.homeTeam, it.awayTeam) }
                        ?.let { game.copy(predictions = computePredictions(game, PredictionSource.CFB(it))) }
                        ?: game

                    "NBA" -> matchNBA(game, nba)
                        ?.let { game.copy(predictions = computePredictions(game, PredictionSource.NBA(it))) }
                        ?: game

                    "NCAAB" -> matchNCAAB(game, ncaab)
                        ?.let { game.copy(predictions = computePredictions(game, PredictionSource.NCAAB(it))) }
                        ?: game

                    else -> game
                }
            }
        }
    }

    // endregion

    // region NFL

    // NFL live-score enrichment reads the NEW model's weekly table `nfl_dryrun_games`
    // (Odds-API lines + fg_* model probabilities). The pipeline delete-then-inserts per
    // (season, week), so the latest (season, week) row = current week: anchor on it, then
    // filter to that week. Mirrors the web repoint (src/services/liveScoresService.ts).
    // Legacy nfl_predictions_epa + nfl_betting_lines retired.
    private suspend fun fetchNFLPredictions(): List<NFLLivePrediction> = runCatching {
        val client = SupabaseClients.cfb

        val anchor = client.from("nfl_dryrun_games")
            .select(columns = Columns.raw("season, week")) {
                order("season", Order.DESCENDING)
                order("week", Order.DESCENDING)
                limit(1)
            }
            .decodeList<SlateWeekRow>()
        val slate = anchor.firstOrNull() ?: return@runCatching emptyList()

        val rows = client.from("nfl_dryrun_games")
            .select(
                columns = Columns.raw(
                    "game_id, home_team, away_team, fg_home_win_prob, fg_home_cover_prob, " +
                        "fg_spread_close, fg_total_close"
                )
            ) {
                filter {
                    eq("season", slate.season)
                    eq("week", slate.week)
                }
            }
            .decodeList<NFLDryrunPredRow>()

        rows.map { r ->
            val homeSpread = r.fgSpreadClose
            NFLLivePrediction(
                trainingKey = r.gameId ?: "",
                homeTeam = r.homeTeam ?: "",
                awayTeam = r.awayTeam ?: "",
                homeAwayMlProb = r.fgHomeWinProb,
                homeAwaySpreadCoverProb = r.fgHomeCoverProb,
                ouResultProb = null,
                homeSpread = homeSpread,
                awaySpread = homeSpread?.let { -it },
                overLine = r.fgTotalClose,
            )
        }
    }.getOrDefault(emptyList())

    // endregion

    // region CFB

    // CFB live-score enrichment reads the NEW model's weekly table `cfb_dryrun_games`
    // (Odds-API lines + fg_* model preds). Latest (season, week) = current week (the
    // pipeline delete-then-inserts per week). Mirrors the web repoint
    // (src/services/liveScoresService.ts). Legacy cfb_live_weekly_inputs +
    // cfb_api_predictions retired.
    private suspend fun fetchCFBPredictions(): List<CFBLivePrediction> = runCatching {
        val client = SupabaseClients.cfb

        val anchor = client.from("cfb_dryrun_games")
            .select(columns = Columns.raw("season, week")) {
                order("season", Order.DESCENDING)
                order("week", Order.DESCENDING)
                limit(1)
            }
            .decodeList<SlateWeekRow>()
        val slate = anchor.firstOrNull() ?: return@runCatching emptyList()

        val rows = client.from("cfb_dryrun_games")
            .select(
                columns = Columns.raw(
                    "home_team, away_team, fg_home_win_prob, fg_home_cover_prob, " +
                        "fg_spread_close, fg_total_close, fg_spread_edge, fg_total_edge, " +
                        "fg_pred_home_pts, fg_pred_away_pts, fg_pred_total, fg_pred_margin"
                )
            ) {
                filter {
                    eq("season", slate.season)
                    eq("week", slate.week)
                }
            }
            .decodeList<CFBDryrunPredRow>()

        rows.map { row ->
            val hasScore = row.fgPredTotal != null && row.fgPredMargin != null
            val homeScore = row.fgPredHomePts
                ?: if (hasScore) (row.fgPredTotal!! + row.fgPredMargin!!) / 2 else null
            val awayScore = row.fgPredAwayPts
                ?: if (hasScore) (row.fgPredTotal!! - row.fgPredMargin!!) / 2 else null
            CFBLivePrediction(
                homeTeam = row.homeTeam ?: "",
                awayTeam = row.awayTeam ?: "",
                predMlProba = row.fgHomeWinProb,
                predSpreadProba = row.fgHomeCoverProb,
                predTotalProba = null,
                apiSpread = row.fgSpreadClose,
                apiOverLine = row.fgTotalClose,
                homeSpreadDiff = row.fgSpreadEdge,
                overLineDiff = row.fgTotalEdge,
                predHomeScore = homeScore,
                predAwayScore = awayScore,
            )
        }
    }.getOrDefault(emptyList())

    // endregion

    // region NBA / NCAAB

    private suspend fun fetchNBAPredictions(): List<NBALivePrediction> = runCatching {
        val client = SupabaseClients.cfb
        val runs = client.from("nba_predictions")
            .select(columns = Columns.raw("run_id, as_of_ts_utc")) {
                order("as_of_ts_utc", Order.DESCENDING)
                limit(1)
            }
            .decodeList<RunIdRow>()
        val runId = runs.firstOrNull()?.runId ?: return@runCatching emptyList()

        val preds = client.from("nba_predictions")
            .select(
                columns = Columns.raw(
                    "game_id, home_team, away_team, home_win_prob, away_win_prob, " +
                        "model_fair_home_spread, model_fair_total, run_id"
                )
            ) {
                filter { eq("run_id", runId) }
            }
            .decodeList<NBAPredictionRow>()

        val inputs = runCatching {
            client.from("nba_input_values_view")
                .select(columns = Columns.raw("game_id, home_spread, total_line"))
                .decodeList<NBAInputRow>()
        }.getOrDefault(emptyList())
        val inputById = inputs.associateBy { it.gameId }

        preds.map { pred ->
            val input = inputById[pred.gameId]

            // RN heuristic: derive spread cover prob from |modelFair vs vegas|,
            // capped at 0.85/0.15. Falls back to home_win_prob if model spread missing.
            val modelSpread = pred.modelFairHomeSpread
            val vegasSpread = input?.homeSpread
            val spreadCoverProb: Double? = if (modelSpread != null && vegasSpread != null) {
                val diff = vegasSpread - modelSpread
                if (modelSpread < vegasSpread) {
                    0.5 + min(abs(diff) * 0.05, 0.35)
                } else {
                    0.5 - min(abs(diff) * 0.05, 0.35)
                }
            } else {
                pred.homeWinProb
            }

            val modelTotal = pred.modelFairTotal
            val vegasTotal = input?.totalLine
            val ouProb: Double? = if (modelTotal != null && vegasTotal != null) {
                val diff = modelTotal - vegasTotal
                if (diff > 0) {
                    0.5 + min(abs(diff) * 0.02, 0.35)
                } else {
                    0.5 - min(abs(diff) * 0.02, 0.35)
                }
            } else {
                null
            }

            NBALivePrediction(
                gameId = pred.gameId,
                homeTeam = pred.homeTeam,
                awayTeam = pred.awayTeam,
                homeWinProb = pred.homeWinProb,
                homeSpread = input?.homeSpread,
                overLine = input?.totalLine,
                homeAwaySpreadCoverProb = spreadCoverProb,
                ouResultProb = ouProb,
                modelFairHomeSpread = pred.modelFairHomeSpread,
                predTotalPoints = pred.modelFairTotal,
            )
        }
    }.getOrDefault(emptyList())

    private suspend fun fetchNCAABPredictions(): List<NCAABLivePrediction> = runCatching {
        val client = SupabaseClients.cfb
        val runs = client.from("ncaab_predictions")
            .select(columns = Columns.raw("run_id, as_of_ts_utc")) {
                order("as_of_ts_utc", Order.DESCENDING)
                limit(1)
            }
            .decodeList<RunIdRow>()
        val runId = runs.firstOrNull()?.runId ?: return@runCatching emptyList()

        val preds = client.from("ncaab_predictions")
            .select(
                columns = Columns.raw(
                    "game_id, home_team, away_team, home_win_prob, away_win_prob, " +
                        "vegas_home_spread, vegas_total, pred_total_points, " +
                        "model_fair_home_spread, run_id"
                )
            ) {
                filter { eq("run_id", runId) }
            }
            .decodeList<NCAABPredictionRow>()

        preds.map { pred ->
            val ouProb: Double? =
                if (pred.predTotalPoints != null && pred.vegasTotal != null) {
                    if (pred.predTotalPoints > pred.vegasTotal) 0.6 else 0.4
                } else {
                    null
                }
            NCAABLivePrediction(
                gameId = pred.gameId,
                homeTeam = pred.homeTeam,
                awayTeam = pred.awayTeam,
                homeWinProb = pred.homeWinProb,
                vegasHomeSpread = pred.vegasHomeSpread,
                vegasTotal = pred.vegasTotal,
                // no dedicated cover model for NCAAB — home_win_prob is the proxy
                homeAwaySpreadCoverProb = pred.homeWinProb,
                ouResultProb = ouProb,
                predTotalPoints = pred.predTotalPoints,
                modelFairHomeSpread = pred.modelFairHomeSpread,
            )
        }
    }.getOrDefault(emptyList())

    // endregion

    // region Matching helpers

    /**
     * Fuzzy team-name match (RN `utils/teamMatching.gamesMatch`): exact
     * normalized names, else first-token containment in either direction on
     * both home and away sides.
     */
    private fun gamesMatch(game: LiveGame, homeTeam: String, awayTeam: String): Boolean {
        fun normalize(s: String) = s.lowercase().trim()
        val homeA = normalize(game.homeTeam)
        val awayA = normalize(game.awayTeam)
        val homeB = normalize(homeTeam)
        val awayB = normalize(awayTeam)

        if (homeA == homeB && awayA == awayB) return true

        fun looseMatch(a: String, b: String): Boolean {
            if (a == b) return true
            val aFirst = a.split(" ").firstOrNull { it.isNotEmpty() } ?: a
            val bFirst = b.split(" ").firstOrNull { it.isNotEmpty() } ?: b
            return a.contains(bFirst) || b.contains(aFirst)
        }
        return looseMatch(homeA, homeB) && looseMatch(awayA, awayB)
    }

    // NBA/NCAAB live rows carry prefixed numeric ids (e.g. "NBA-401704933") —
    // numeric match is authoritative; team-name fuzz is the fallback.
    private fun matchNBA(game: LiveGame, predictions: List<NBALivePrediction>): NBALivePrediction? {
        val raw = game.gameId ?: game.id
        val stripped = raw.removePrefix("NBA-")
        stripped.toIntOrNull()?.let { id ->
            predictions.firstOrNull { it.gameId == id }?.let { return it }
        }
        return predictions.firstOrNull { gamesMatch(game, it.homeTeam, it.awayTeam) }
    }

    private fun matchNCAAB(game: LiveGame, predictions: List<NCAABLivePrediction>): NCAABLivePrediction? {
        val raw = game.gameId ?: game.id
        val stripped = raw.removePrefix("NCAAB-")
        stripped.toIntOrNull()?.let { id ->
            predictions.firstOrNull { it.gameId == id }?.let { return it }
        }
        return predictions.firstOrNull { gamesMatch(game, it.homeTeam, it.awayTeam) }
    }

    // endregion

    // region Prediction status math

    /**
     * Direct port of RN `calculatePredictionStatus` — drives the hitting/missing
     * badges, so the math here must not drift. Displayed probability is always
     * the picked side's (`prob` or `1 - prob`).
     */
    private fun computePredictions(game: LiveGame, prediction: PredictionSource): GamePredictions {
        val awayScore = game.awayScore.toDouble()
        val homeScore = game.homeScore.toDouble()
        val totalScore = awayScore + homeScore
        val scoreDiff = homeScore - awayScore

        val result = GamePredictions()

        // --- ML
        val mlProb: Double? = when (prediction) {
            is PredictionSource.NFL -> prediction.p.homeAwayMlProb
            is PredictionSource.CFB -> prediction.p.predMlProba
                ?: prediction.p.predHomeScore?.let { predHome ->
                    prediction.p.predAwayScore?.let { predAway ->
                        if (predHome > predAway) 0.6 else 0.4
                    }
                }
            is PredictionSource.NBA -> prediction.p.homeWinProb
            is PredictionSource.NCAAB -> prediction.p.homeWinProb
        }

        if (mlProb != null) {
            val pickedHome = mlProb > 0.5
            val isHitting = if (pickedHome) homeScore > awayScore else awayScore > homeScore
            result.moneyline = PredictionStatus(
                predicted = if (pickedHome) PredictionStatus.Pick.HOME else PredictionStatus.Pick.AWAY,
                isHitting = isHitting,
                probability = if (pickedHome) mlProb else 1 - mlProb,
                line = null,
                currentDifferential = scoreDiff,
            )
            if (isHitting) result.hasAnyHitting = true
        }

        // --- Spread
        var spreadProb: Double? = null
        var spreadLine: Double? = null
        when (prediction) {
            is PredictionSource.NFL -> {
                spreadProb = prediction.p.homeAwaySpreadCoverProb
                spreadLine = prediction.p.homeSpread
            }
            is PredictionSource.CFB -> {
                spreadProb = prediction.p.predSpreadProba
                spreadLine = prediction.p.apiSpread
                if (spreadProb == null) {
                    prediction.p.homeSpreadDiff?.let { diff ->
                        spreadProb = if (diff > 0) 0.6 else 0.4
                    }
                }
            }
            is PredictionSource.NBA -> {
                spreadProb = prediction.p.homeAwaySpreadCoverProb
                spreadLine = prediction.p.homeSpread
                if (spreadProb == null) {
                    val model = prediction.p.modelFairHomeSpread
                    val line = prediction.p.homeSpread
                    if (model != null && line != null) {
                        spreadProb = if ((line - model) < 0) 0.6 else 0.4
                    }
                }
            }
            is PredictionSource.NCAAB -> {
                spreadProb = prediction.p.homeAwaySpreadCoverProb
                spreadLine = prediction.p.vegasHomeSpread
                if (spreadProb == null) {
                    val model = prediction.p.modelFairHomeSpread
                    val line = prediction.p.vegasHomeSpread
                    if (model != null && line != null) {
                        spreadProb = if ((line - model) < 0) 0.6 else 0.4
                    }
                }
            }
        }

        val sProb = spreadProb
        val sLine = spreadLine
        if (sProb != null && sLine != null) {
            val pickedHome = sProb > 0.5
            // adjustedDiff = (home - away) + home line: positive means home covering
            val adjustedDiff = scoreDiff + sLine
            val isHitting = if (pickedHome) adjustedDiff > 0 else adjustedDiff < 0
            result.spread = PredictionStatus(
                predicted = if (pickedHome) PredictionStatus.Pick.HOME else PredictionStatus.Pick.AWAY,
                isHitting = isHitting,
                probability = if (pickedHome) sProb else 1 - sProb,
                line = sLine,
                currentDifferential = adjustedDiff,
            )
            if (isHitting) result.hasAnyHitting = true
        }

        // --- O/U
        var ouLine: Double? = null
        var ouProb: Double? = null
        when (prediction) {
            is PredictionSource.NFL -> {
                ouLine = prediction.p.overLine
                ouProb = prediction.p.ouResultProb
            }
            is PredictionSource.CFB -> {
                ouLine = prediction.p.apiOverLine
                ouProb = prediction.p.predTotalProba
                if (ouProb == null) {
                    prediction.p.overLineDiff?.let { diff ->
                        ouProb = if (diff > 0) 0.6 else 0.4
                    }
                }
            }
            is PredictionSource.NBA -> {
                ouLine = prediction.p.overLine
                ouProb = prediction.p.ouResultProb
                if (ouProb == null) {
                    val total = prediction.p.predTotalPoints
                    val line = prediction.p.overLine
                    if (total != null && line != null) {
                        ouProb = if (total > line) 0.6 else 0.4
                    }
                }
            }
            is PredictionSource.NCAAB -> {
                ouLine = prediction.p.vegasTotal
                ouProb = prediction.p.ouResultProb
                if (ouProb == null) {
                    val total = prediction.p.predTotalPoints
                    val line = prediction.p.vegasTotal
                    if (total != null && line != null) {
                        ouProb = if (total > line) 0.6 else 0.4
                    }
                }
            }
        }

        val oProb = ouProb
        val oLine = ouLine
        if (oProb != null && oLine != null) {
            val isOver = oProb > 0.5
            val isHitting = if (isOver) totalScore > oLine else totalScore < oLine
            result.overUnder = PredictionStatus(
                predicted = if (isOver) PredictionStatus.Pick.OVER else PredictionStatus.Pick.UNDER,
                isHitting = isHitting,
                probability = if (isOver) oProb else 1 - oProb,
                line = oLine,
                currentDifferential = totalScore - oLine,
            )
            if (isHitting) result.hasAnyHitting = true
        }

        return result
    }

    // endregion
}

// Wire DTOs below are file-private on purpose — they are the live-scores
// service's own slim projections, distinct from the full-row models in
// com.wagerproof.core.models (NFLPrediction/CFBPrediction serve the games pages).

/** Routes computePredictions per league (RN's discriminated union). */
private sealed interface PredictionSource {
    data class NFL(val p: NFLLivePrediction) : PredictionSource
    data class CFB(val p: CFBLivePrediction) : PredictionSource
    data class NBA(val p: NBALivePrediction) : PredictionSource
    data class NCAAB(val p: NCAABLivePrediction) : PredictionSource
}

/** Anchor row for NFL/CFB dry-run current-week resolution (season desc, week desc, limit 1). */
@Serializable
private data class SlateWeekRow(
    val season: Int = 0,
    val week: Int = 0,
)

/** Shared by NBA + NCAAB latest-run lookups (both key runs by as_of_ts_utc). */
@Serializable
private data class RunIdRow(
    @SerialName("run_id") val runId: Int? = null,
)

/** Slim projection of `nfl_dryrun_games` for live-score ML/spread/total badges. */
@Serializable
private data class NFLDryrunPredRow(
    @SerialName("game_id") val gameId: String? = null,
    @SerialName("home_team") val homeTeam: String? = null,
    @SerialName("away_team") val awayTeam: String? = null,
    @SerialName("fg_home_win_prob") val fgHomeWinProb: Double? = null,
    @SerialName("fg_home_cover_prob") val fgHomeCoverProb: Double? = null,
    @SerialName("fg_spread_close") val fgSpreadClose: Double? = null,
    @SerialName("fg_total_close") val fgTotalClose: Double? = null,
)

/** Assembled live prediction the badge computation reads (built, not decoded). */
private data class NFLLivePrediction(
    val trainingKey: String,
    val homeTeam: String,
    val awayTeam: String,
    val homeAwayMlProb: Double? = null,
    val homeAwaySpreadCoverProb: Double? = null,
    val ouResultProb: Double? = null,
    val homeSpread: Double? = null,
    val awaySpread: Double? = null,
    val overLine: Double? = null,
)

/** Slim projection of `cfb_dryrun_games` for live-score badges. */
@Serializable
private data class CFBDryrunPredRow(
    @SerialName("home_team") val homeTeam: String? = null,
    @SerialName("away_team") val awayTeam: String? = null,
    @SerialName("fg_home_win_prob") val fgHomeWinProb: Double? = null,
    @SerialName("fg_home_cover_prob") val fgHomeCoverProb: Double? = null,
    @SerialName("fg_spread_close") val fgSpreadClose: Double? = null,
    @SerialName("fg_total_close") val fgTotalClose: Double? = null,
    @SerialName("fg_spread_edge") val fgSpreadEdge: Double? = null,
    @SerialName("fg_total_edge") val fgTotalEdge: Double? = null,
    @SerialName("fg_pred_home_pts") val fgPredHomePts: Double? = null,
    @SerialName("fg_pred_away_pts") val fgPredAwayPts: Double? = null,
    @SerialName("fg_pred_total") val fgPredTotal: Double? = null,
    @SerialName("fg_pred_margin") val fgPredMargin: Double? = null,
)

/** Assembled CFB live prediction from cfb_dryrun_games (api scores win). */
private data class CFBLivePrediction(
    val homeTeam: String,
    val awayTeam: String,
    val predMlProba: Double?,
    val predSpreadProba: Double?,
    val predTotalProba: Double?,
    val apiSpread: Double?,
    val apiOverLine: Double?,
    val homeSpreadDiff: Double?,
    val overLineDiff: Double?,
    val predHomeScore: Double?,
    val predAwayScore: Double?,
)

@Serializable
private data class NBAPredictionRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("away_team") val awayTeam: String,
    @SerialName("home_win_prob") val homeWinProb: Double? = null,
    @SerialName("away_win_prob") val awayWinProb: Double? = null,
    @SerialName("model_fair_home_spread") val modelFairHomeSpread: Double? = null,
    @SerialName("model_fair_total") val modelFairTotal: Double? = null,
)

@Serializable
private data class NBAInputRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("home_spread") val homeSpread: Double? = null,
    @SerialName("total_line") val totalLine: Double? = null,
)

/** nba_predictions joined with nba_input_values_view + derived probabilities. */
private data class NBALivePrediction(
    val gameId: Int,
    val homeTeam: String,
    val awayTeam: String,
    val homeWinProb: Double?,
    val homeSpread: Double?,
    val overLine: Double?,
    val homeAwaySpreadCoverProb: Double?,
    val ouResultProb: Double?,
    val modelFairHomeSpread: Double?,
    val predTotalPoints: Double?,
)

@Serializable
private data class NCAABPredictionRow(
    @SerialName("game_id") val gameId: Int,
    @SerialName("home_team") val homeTeam: String,
    @SerialName("away_team") val awayTeam: String,
    @SerialName("home_win_prob") val homeWinProb: Double? = null,
    @SerialName("away_win_prob") val awayWinProb: Double? = null,
    @SerialName("vegas_home_spread") val vegasHomeSpread: Double? = null,
    @SerialName("vegas_total") val vegasTotal: Double? = null,
    @SerialName("pred_total_points") val predTotalPoints: Double? = null,
    @SerialName("model_fair_home_spread") val modelFairHomeSpread: Double? = null,
)

private data class NCAABLivePrediction(
    val gameId: Int,
    val homeTeam: String,
    val awayTeam: String,
    val homeWinProb: Double?,
    val vegasHomeSpread: Double?,
    val vegasTotal: Double?,
    val homeAwaySpreadCoverProb: Double?,
    val ouResultProb: Double?,
    val predTotalPoints: Double?,
    val modelFairHomeSpread: Double?,
)
