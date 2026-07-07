package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.CFBDryRunFlag
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import com.wagerproof.core.services.CFBSignalDefinitionsService
import com.wagerproof.core.services.CFBTeamsService
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import kotlin.math.roundToInt
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Port of iOS `CFBDryRunPicksStore.swift`. Admin CFB dry-run picks screen. Runs
 * the SAME week-7 trio as GamesStore's CFB dry-run path (`cfb_dryrun_games` +
 * `cfb_dryrun_flags` both `week=7`, plus the signal glossary) in parallel, then
 * attaches signal definitions, groups flags by game, and maps rows into
 * [CFBPrediction] using slightly smaller private row decoders than GamesStore's.
 */
@Stable
class CFBDryRunPicksStore {

    var games by mutableStateOf<List<CFBPrediction>>(emptyList()); private set
    var flags by mutableStateOf<List<CFBDryRunFlag>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set

    /** Active flags, sorted conviction rank asc → stakeUnits desc. */
    val activeFlags: List<CFBDryRunFlag>
        get() = flags.filter { it.isActive }.sortedWith(FLAG_ORDER)

    /** Tracking (non-active) flags, same sort. */
    val trackingFlags: List<CFBDryRunFlag>
        get() = flags.filter { !it.isActive }.sortedWith(FLAG_ORDER)

    val mammothGames: List<CFBPrediction>
        get() = games.filter { it.mammoth }

    fun game(forId: String): CFBPrediction? =
        games.firstOrNull { it.gameId == forId || it.id == forId }

    suspend fun refresh() {
        loadState = LoadState.Loading
        try {
            CFBTeamsService.ensureLoaded()
            coroutineScope {
                val gamesRowsDeferred = async {
                    SupabaseClients.cfb
                        .from("cfb_dryrun_games")
                        .select { filter { eq("week", 7) } }
                        .decodeList<GameRow>()
                }
                val flagRowsDeferred = async {
                    SupabaseClients.cfb
                        .from("cfb_dryrun_flags")
                        .select { filter { eq("week", 7) } }
                        .decodeList<FlagRow>()
                }
                val signalDefsDeferred = async {
                    CFBSignalDefinitionsService.shared.definitionsBySource()
                }

                val gRows = gamesRowsDeferred.await()
                val fRows = flagRowsDeferred.await()
                val definitionsBySource = signalDefsDeferred.await()

                val flagModels = fRows.map { row ->
                    val flag = row.toModel()
                    val definition = CFBSignalDefinitionsService.definition(flag.source, definitionsBySource)
                    flag.withSignalDefinition(definition)
                }
                val flagsByGame = flagModels.groupBy { it.gameId }
                flags = flagModels
                games = gRows.map { prediction(it, flagsByGame) }
            }
            loadState = LoadState.Loaded
        } catch (e: Throwable) {
            loadState = LoadState.Failed(e.message ?: "Failed to load CFB dry-run picks")
        }
    }

    private fun prediction(row: GameRow, flagsByGame: Map<String, List<CFBDryRunFlag>>): CFBPrediction {
        val id = row.gameId.orEmpty()
        val home = row.homeTeam ?: "Home"
        val away = row.awayTeam ?: "Away"
        val score = score(home = row.fgPredHomePts, away = row.fgPredAwayPts, total = row.fgPredTotal, margin = row.fgPredMargin)
        val gameDate = row.kickoff ?: ""
        val homeRef = CFBTeamAssets.team(home)
        val awayRef = CFBTeamAssets.team(away)
        return CFBPrediction(
            id = id,
            awayTeam = away,
            homeTeam = home,
            homeMl = row.fgMlHomeClose?.roundToInt(),
            awayMl = row.fgMlAwayClose?.roundToInt(),
            homeSpread = row.fgSpreadClose,
            awaySpread = row.fgSpreadClose?.let { -it },
            overLine = row.fgTotalClose,
            gameDate = gameDate,
            gameTime = gameDate,
            trainingKey = id,
            uniqueId = id,
            homeAwaySpreadCoverProb = row.fgHomeCoverProb,
            temperature = row.wxTempF,
            precipitation = row.wxPrecipMm,
            windSpeed = row.wxWindMph,
            icon = row.wxIcon,
            wxTempF = row.wxTempF,
            wxWindMph = row.wxWindMph,
            wxPrecipMm = row.wxPrecipMm,
            wxIndoors = row.wxIndoors,
            wxIcon = row.wxIcon,
            wxSummary = row.wxSummary,
            predAwayScore = score?.away,
            predHomeScore = score?.home,
            predSpread = row.fgPredSpread,
            homeSpreadDiff = row.fgSpreadEdge,
            predTotal = row.fgPredTotal,
            overLineDiff = row.fgTotalEdge,
            gameId = id,
            season = row.season,
            week = row.week,
            kickoff = row.kickoff,
            homeConf = row.homeConf,
            awayConf = row.awayConf,
            homeRank = row.homeRank,
            awayRank = row.awayRank,
            homeTeamRef = homeRef,
            awayTeamRef = awayRef,
            fgSpreadClose = row.fgSpreadClose,
            fgTotalClose = row.fgTotalClose,
            ttHomeClose = row.ttHomeClose,
            ttAwayClose = row.ttAwayClose,
            ttHomeBestUnder = row.ttHomeBestUnder,
            ttHomeBestOver = row.ttHomeBestOver,
            ttAwayBestUnder = row.ttAwayBestUnder,
            ttAwayBestOver = row.ttAwayBestOver,
            h1SpreadClose = row.h1SpreadClose,
            h1TotalClose = row.h1TotalClose,
            fgPredMargin = row.fgPredMargin,
            fgPredSpread = row.fgPredSpread,
            fgSpreadEdge = row.fgSpreadEdge,
            fgSpreadPick = row.fgSpreadPick,
            fgSpreadCapped = row.fgSpreadCapped,
            fgPredTotal = row.fgPredTotal,
            fgTotalEdge = row.fgTotalEdge,
            fgTotalPick = row.fgTotalPick,
            ttHomePred = row.ttHomePred,
            ttAwayPred = row.ttAwayPred,
            ttHomePick = row.ttHomePick,
            ttAwayPick = row.ttAwayPick,
            h1PredMargin = row.h1PredMargin,
            h1PredTotal = row.h1PredTotal,
            h1SpreadPick = row.h1SpreadPick,
            h1TotalPick = row.h1TotalPick,
            h1MlPick = row.h1MlPick,
            convictionTierRaw = row.convictionTier ?: "none",
            stakeUnits = row.stakeUnits,
            nFlagsActive = row.nFlagsActive,
            nFlagsTracking = row.nFlagsTracking,
            mammoth = row.mammoth ?: false,
            flags = flagsByGame[id] ?: emptyList(),
        )
    }

    // Model-predicted final score. Prefer explicit home/away pts; else derive
    // from total ± margin (Swift `score(home:away:total:margin:)`).
    private fun score(home: Double?, away: Double?, total: Double?, margin: Double?): PredictedScore? {
        if (home != null && away != null) return PredictedScore(home, away)
        if (total == null || margin == null) return null
        return PredictedScore(home = (total + margin) / 2, away = (total - margin) / 2)
    }

    private data class PredictedScore(val home: Double, val away: Double)

    // MARK: - Private row decoders

    @Serializable
    private data class GameRow(
        @SerialName("game_id") @Serializable(with = FlexibleStringSerializer::class) val gameId: String? = null,
        val season: Int? = null,
        val week: Int? = null,
        val kickoff: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_conf") val homeConf: String? = null,
        @SerialName("away_conf") val awayConf: String? = null,
        @SerialName("home_rank") val homeRank: Int? = null,
        @SerialName("away_rank") val awayRank: Int? = null,
        @SerialName("fg_spread_close") val fgSpreadClose: Double? = null,
        @SerialName("fg_total_close") val fgTotalClose: Double? = null,
        @SerialName("fg_ml_home_close") val fgMlHomeClose: Double? = null,
        @SerialName("fg_ml_away_close") val fgMlAwayClose: Double? = null,
        @SerialName("fg_pred_margin") val fgPredMargin: Double? = null,
        @SerialName("fg_pred_home_pts") val fgPredHomePts: Double? = null,
        @SerialName("fg_pred_away_pts") val fgPredAwayPts: Double? = null,
        @SerialName("fg_pred_spread") val fgPredSpread: Double? = null,
        @SerialName("fg_spread_edge") val fgSpreadEdge: Double? = null,
        @SerialName("fg_spread_pick") val fgSpreadPick: String? = null,
        @SerialName("fg_spread_capped") val fgSpreadCapped: Boolean? = null,
        @SerialName("fg_pred_total") val fgPredTotal: Double? = null,
        @SerialName("fg_total_edge") val fgTotalEdge: Double? = null,
        @SerialName("fg_total_pick") val fgTotalPick: String? = null,
        @SerialName("tt_home_close") val ttHomeClose: Double? = null,
        @SerialName("tt_away_close") val ttAwayClose: Double? = null,
        @SerialName("tt_home_best_under") val ttHomeBestUnder: Double? = null,
        @SerialName("tt_home_best_over") val ttHomeBestOver: Double? = null,
        @SerialName("tt_away_best_under") val ttAwayBestUnder: Double? = null,
        @SerialName("tt_away_best_over") val ttAwayBestOver: Double? = null,
        @SerialName("tt_home_pred") val ttHomePred: Double? = null,
        @SerialName("tt_away_pred") val ttAwayPred: Double? = null,
        @SerialName("tt_home_pick") val ttHomePick: String? = null,
        @SerialName("tt_away_pick") val ttAwayPick: String? = null,
        @SerialName("h1_spread_close") val h1SpreadClose: Double? = null,
        @SerialName("h1_total_close") val h1TotalClose: Double? = null,
        @SerialName("h1_pred_margin") val h1PredMargin: Double? = null,
        @SerialName("h1_pred_total") val h1PredTotal: Double? = null,
        @SerialName("h1_spread_pick") val h1SpreadPick: String? = null,
        @SerialName("h1_total_pick") val h1TotalPick: String? = null,
        @SerialName("h1_ml_pick") val h1MlPick: String? = null,
        @SerialName("fg_home_cover_prob") val fgHomeCoverProb: Double? = null,
        @SerialName("wx_temp_f") val wxTempF: Double? = null,
        @SerialName("wx_wind_mph") val wxWindMph: Double? = null,
        @SerialName("wx_precip_mm") val wxPrecipMm: Double? = null,
        @SerialName("wx_indoors") val wxIndoors: Boolean? = null,
        @SerialName("wx_icon") val wxIcon: String? = null,
        @SerialName("wx_summary") val wxSummary: String? = null,
        @SerialName("conviction_tier") val convictionTier: String? = null,
        @SerialName("stake_units") val stakeUnits: Double? = null,
        @SerialName("n_flags_active") val nFlagsActive: Int? = null,
        @SerialName("n_flags_tracking") val nFlagsTracking: Int? = null,
        val mammoth: Boolean? = null,
    )

    @Serializable
    private data class FlagRow(
        @Serializable(with = FlexibleStringSerializer::class) val id: String? = null,
        @SerialName("game_id") @Serializable(with = FlexibleStringSerializer::class) val gameId: String? = null,
        val season: Int? = null,
        val week: Int? = null,
        val game: String? = null,
        val source: String? = null,
        val market: String? = null,
        val side: String? = null,
        val line: Double? = null,
        val price: Int? = null,
        val edge: Double? = null,
        val conviction: String? = null,
        val tier: String? = null,
        @SerialName("stake_units") val stakeUnits: Double? = null,
        @SerialName("grade_line") val gradeLine: String? = null,
        val mammoth: Boolean? = null,
    ) {
        fun toModel(): CFBDryRunFlag = CFBDryRunFlag(
            id = id.orEmpty(),
            gameId = gameId.orEmpty(),
            season = season,
            week = week,
            game = game,
            source = source ?: "Signal",
            market = market ?: "",
            side = side ?: "",
            line = line,
            price = price,
            edge = edge,
            conviction = conviction ?: "track",
            tier = tier ?: "tracking",
            stakeUnits = stakeUnits,
            gradeLine = gradeLine,
            mammoth = mammoth,
        )
    }

    private companion object {
        // Conviction rank asc, then stakeUnits desc (Swift `flagSort`).
        val FLAG_ORDER: Comparator<CFBDryRunFlag> =
            compareBy<CFBDryRunFlag> { it.convictionTier.sortRank }
                .thenByDescending { it.stakeUnits ?: 0.0 }
    }
}
