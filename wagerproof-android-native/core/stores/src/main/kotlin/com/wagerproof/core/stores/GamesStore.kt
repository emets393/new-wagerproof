package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.CFBDryRunFlag
import com.wagerproof.core.models.CFBPredictedScore
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.MLBGame
import com.wagerproof.core.models.MLBSignalItem
import com.wagerproof.core.models.MLBTeamMapping
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.NBAGame
import com.wagerproof.core.models.NCAABGame
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.CFBSignalDefinitionsService
import com.wagerproof.core.services.CFBTeamsService
import com.wagerproof.core.services.NFLTeamsService
import com.wagerproof.core.services.ServiceDates
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.put
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * `GamesStore` mirrors the RN `(tabs)/index.tsx` data layer end-to-end (port of
 * iOS `GamesStore.swift`, the largest store).
 *
 * It owns five per-sport caches (`nfl`, `cfb`, `nba`, `ncaab`, `mlb`), each with
 * its own games array + `lastFetched` timestamp. Cache TTL is 5 minutes (matches
 * RN: `Date.now() - cached.lastFetch < 5 * 60 * 1000`).
 *
 * `refresh(sport, force)` runs the matching per-sport query against the CFB
 * (sports-data) Supabase project. NFL is a dryrun-first path (`nfl_dryrun_games`)
 * falling back to a 4-way legacy merge; CFB is dryrun-only (`cfb_dryrun_games` +
 * flags, hardcoded week 7); NBA/NCAAB/MLB are per-sport merges. All queries are
 * byte-identical to RN — do NOT change select strings / table names.
 *
 * NFL note: `NFLPrediction` (models) has private serialization backing fields, so
 * it can't be constructed field-by-field from this module. Both NFL paths instead
 * assemble a `JsonObject` with the derived wire keys and decode it through
 * `WagerproofJson` — this also inherits the model's fully-tolerant decode.
 */
@Stable
class GamesStore {

    enum class Sport(val label: String) {
        mlb("MLB"), nba("NBA"), ncaab("NCAAB"), nfl("NFL"), cfb("CFB");

        val id: String get() = name

        companion object {
            // Seasonal sport ordering keys off ET, matching the app's sports-date logic.
            private val GAMES_ET: ZoneId = ZoneId.of("America/New_York")

            /**
             * Picker display order, seasonal: football-first from Sept 1 through
             * Feb 15 (kickoff → Super Bowl), MLB-first the rest of the year. Uses
             * ET to match the rest of the app's sports-date logic.
             */
            fun displayOrder(date: LocalDate = LocalDate.now(GAMES_ET)): List<Sport> {
                val month = date.monthValue
                val day = date.dayOfMonth
                val footballSeason = month >= 9 || month == 1 || (month == 2 && day <= 15)
                return if (footballSeason) listOf(nfl, cfb, mlb, nba, ncaab)
                else listOf(mlb, nfl, cfb, nba, ncaab)
            }
        }
    }

    enum class SortMode(val raw: String) { TIME("time"), SPREAD("spread"), OU("ou") }

    /** Per-sport cached games. Mirrors RN `cachedData: {nfl: {games,...}, ...}`. */
    data class SportFeed(
        val nfl: List<NFLPrediction> = emptyList(),
        val cfb: List<CFBPrediction> = emptyList(),
        val nba: List<NBAGame> = emptyList(),
        val ncaab: List<NCAABGame> = emptyList(),
        val mlb: List<MLBGame> = emptyList(),
    )

    // Store-owned scope; refreshes are awaited by the screen, but the scope keeps
    // parity with the architecture contract and is cancelled by close().
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    fun close() = scope.cancel()

    // MARK: - Observable state

    var games: SportFeed by mutableStateOf(SportFeed()); private set
    // Explicit generic: without it the delegate infers Map<Sport, LoadState.Idle>,
    // whose setter would reject a Map<Sport, LoadState> (invariant value type).
    var loadState: Map<Sport, LoadState> by mutableStateOf<Map<Sport, LoadState>>(Sport.entries.associateWith { LoadState.Idle }); private set
    var lastFetched: Map<Sport, Long> by mutableStateOf(emptyMap()); private set

    /** Currently-selected sport. Defaults to the first sport in the seasonal picker order. */
    var selectedSport: Sport by mutableStateOf(Sport.displayOrder().firstOrNull() ?: Sport.mlb)

    /** Per-sport sort mode. Mirrors RN `sortModes` record. */
    var sortModes: Map<Sport, SortMode> by mutableStateOf(Sport.entries.associateWith { SortMode.TIME })

    /** Per-sport search text. Mirrors RN `searchTexts` record. */
    var searchTexts: Map<Sport, String> by mutableStateOf(Sport.entries.associateWith { "" })

    /**
     * When true, NFL/CFB load from dry-run staging tables. Set by the tab shell
     * from `AdminModeStore.dryRunPreviewEnabled`. (Kept for parity; the fetch
     * paths already prefer dry-run tables when present.)
     */
    var dryRunPreviewEnabled: Boolean by mutableStateOf(false)

    private val cacheTTL: Long = 5 * 60 * 1000

    fun nflGames(): List<NFLPrediction> = games.nfl
    fun cfbGames(): List<CFBPrediction> = games.cfb
    fun mlbGames(): List<MLBGame> = games.mlb

    fun isLoading(sport: Sport): Boolean = (loadState[sport] ?: LoadState.Idle).isLoading

    fun errorMessage(sport: Sport): String? = (loadState[sport] ?: LoadState.Idle).errorMessage

    // MARK: - Refresh entry points

    /**
     * Refresh a single sport. Honors the 5-minute cache TTL unless `force` is
     * true (pull-to-refresh path). Errors are surfaced via `loadState`.
     *
     * The iOS DEBUG "Dummy Data Mode" branch (captured offseason slates) has no
     * Android equivalent (no `DummyData` harness ported) — see [debugSet].
     */
    suspend fun refresh(sport: Sport, force: Boolean = false) {
        // Mirror RN: skip if cached + within TTL + not forced.
        if (!force) {
            val last = lastFetched[sport]
            if (last != null && System.currentTimeMillis() - last < cacheTTL) return
        }
        loadState = loadState + (sport to LoadState.Loading)
        try {
            when (sport) {
                Sport.nfl -> fetchNFL()
                Sport.cfb -> fetchCFB()
                Sport.nba -> fetchNBA()
                Sport.ncaab -> fetchNCAAB()
                Sport.mlb -> fetchMLB()
            }
            loadState = loadState + (sport to LoadState.Loaded)
            lastFetched = lastFetched + (sport to System.currentTimeMillis())
        } catch (e: Throwable) {
            loadState = loadState + (sport to LoadState.Failed("Failed to fetch ${sport.label} games"))
        }
    }

    /** Refresh every available sport in parallel. Mirrors RN's mount-time loop. */
    suspend fun refreshAll(force: Boolean = false) {
        coroutineScope {
            Sport.entries.map { sport -> async { refresh(sport, force) } }.awaitAll()
        }
    }

    // MARK: - Filtered + sorted accessors

    fun sortedNFL(): List<NFLPrediction> {
        val q = (searchTexts[Sport.nfl] ?: "").lowercase()
        val filtered = if (q.isEmpty()) games.nfl else games.nfl.filter {
            it.homeTeam.lowercase().contains(q) || it.awayTeam.lowercase().contains(q)
        }
        return sortNFL(filtered, sortModes[Sport.nfl] ?: SortMode.TIME)
    }

    fun sortedCFB(): List<CFBPrediction> {
        val q = (searchTexts[Sport.cfb] ?: "").lowercase()
        val filtered = if (q.isEmpty()) games.cfb else games.cfb.filter {
            it.homeTeam.lowercase().contains(q) || it.awayTeam.lowercase().contains(q)
        }
        return sortCFB(filtered, sortModes[Sport.cfb] ?: SortMode.TIME)
    }

    fun sortedNBA(): List<NBAGame> {
        val q = (searchTexts[Sport.nba] ?: "").lowercase()
        val filtered = if (q.isEmpty()) games.nba else games.nba.filter {
            it.homeTeam.lowercase().contains(q) || it.awayTeam.lowercase().contains(q)
        }
        return sortNBA(filtered, sortModes[Sport.nba] ?: SortMode.TIME)
    }

    fun sortedNCAAB(): List<NCAABGame> {
        val q = (searchTexts[Sport.ncaab] ?: "").lowercase()
        val filtered = if (q.isEmpty()) games.ncaab else games.ncaab.filter {
            it.homeTeam.lowercase().contains(q) || it.awayTeam.lowercase().contains(q)
        }
        return sortNCAAB(filtered, sortModes[Sport.ncaab] ?: SortMode.TIME)
    }

    fun sortedMLB(): List<MLBGame> {
        val q = (searchTexts[Sport.mlb] ?: "").lowercase()
        val filtered = if (q.isEmpty()) games.mlb else games.mlb.filter {
            (it.homeTeamName ?: "").lowercase().contains(q) ||
                (it.awayTeamName ?: "").lowercase().contains(q) ||
                it.homeAbbr.lowercase().contains(q) ||
                it.awayAbbr.lowercase().contains(q)
        }
        return sortMLB(filtered, sortModes[Sport.mlb] ?: SortMode.TIME)
    }

    private fun sortNFL(list: List<NFLPrediction>, mode: SortMode): List<NFLPrediction> = when (mode) {
        SortMode.TIME -> list.sortedBy { parseEpoch(it.gameDate) ?: Double.MAX_VALUE }
        // RN uses confidence-based sorting for NFL.
        SortMode.SPREAD -> list.sortedByDescending { confidence(it.homeAwaySpreadCoverProb) }
        SortMode.OU -> list.sortedByDescending { confidence(it.ouResultProb) }
    }

    private fun sortCFB(list: List<CFBPrediction>, mode: SortMode): List<CFBPrediction> =
        // All modes sort by conviction tier rank asc then kickoff asc.
        list.sortedWith(
            compareBy<CFBPrediction> { it.convictionTier.sortRank }
                .thenBy { parseEpoch(it.kickoff ?: it.gameTime) ?: Double.MAX_VALUE },
        )

    private fun sortNBA(list: List<NBAGame>, mode: SortMode): List<NBAGame> = when (mode) {
        // gameTime string asc, falling back to gameDate when tipoff is missing.
        SortMode.TIME -> list.sortedBy { it.gameTime.ifEmpty { it.gameDate } }
        SortMode.SPREAD -> list.sortedByDescending { confidence(it.homeAwaySpreadCoverProb) }
        SortMode.OU -> list.sortedByDescending { confidence(it.ouResultProb) }
    }

    private fun sortNCAAB(list: List<NCAABGame>, mode: SortMode): List<NCAABGame> = when (mode) {
        SortMode.TIME -> list.sortedBy { it.gameTime.ifEmpty { it.gameDate } }
        SortMode.SPREAD -> list.sortedByDescending { confidence(it.homeAwaySpreadCoverProb) }
        SortMode.OU -> list.sortedByDescending { confidence(it.ouResultProb) }
    }

    private fun sortMLB(list: List<MLBGame>, mode: SortMode): List<MLBGame> = when (mode) {
        SortMode.TIME -> list.sortedBy { parseEpoch(it.gameTimeEt ?: it.officialDate) ?: Double.MAX_VALUE }
        SortMode.SPREAD -> list.sortedByDescending {
            max(abs(it.homeMlEdgePct ?: 0.0), abs(it.awayMlEdgePct ?: 0.0))
        }
        SortMode.OU -> list.sortedByDescending { abs(it.ouEdge ?: 0.0) }
    }

    // MARK: - NFL fetch (dryrun-first, then legacy 4-way merge)

    private suspend fun fetchNFL() {
        val cfb = SupabaseClients.cfb

        val dryrun = fetchNFLDryrun(cfb)
        if (dryrun.isNotEmpty()) {
            games = games.copy(nfl = dryrun)
            return
        }

        // Step 1: input view (no filters — matches RN exactly).
        val viewRows: List<NFLViewRow> = cfb.from("v_input_values_with_epa").select().decodeList()
        if (viewRows.isEmpty()) return

        // Step 2: predictions, latest run_id only (lexicographically largest).
        val predictionRows: List<NFLPredictionRow> = runCatching {
            cfb.from("nfl_predictions_epa")
                .select(columns = Columns.raw("training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id"))
                .decodeList<NFLPredictionRow>()
        }.getOrDefault(emptyList())
        val predictionsMap = HashMap<String, NFLPredictionRow>()
        if (predictionRows.isNotEmpty()) {
            val latestRunId = predictionRows.mapNotNull { it.runId }.maxOrNull()
            for (row in predictionRows) if (row.runId == latestRunId) predictionsMap[row.trainingKey] = row
        }

        // Step 3: betting lines, most-recent as_of_ts per training_key.
        val bettingRows: List<NFLBettingRow> = runCatching {
            cfb.from("nfl_betting_lines")
                .select(columns = Columns.raw("training_key, home_ml, away_ml, over_line, home_spread, spread_splits_label, ml_splits_label, total_splits_label, as_of_ts, game_date, game_time, home_ml_handle, away_ml_handle, home_ml_bets, away_ml_bets, home_spread_handle, away_spread_handle, home_spread_bets, away_spread_bets, over_handle, under_handle, over_bets, under_bets"))
                .decodeList<NFLBettingRow>()
        }.getOrDefault(emptyList())
        val bettingMap = HashMap<String, NFLBettingRow>()
        for (row in bettingRows) {
            val existing = bettingMap[row.trainingKey]
            when {
                existing == null -> bettingMap[row.trainingKey] = row
                row.asOfTs != null && existing.asOfTs != null && row.asOfTs > existing.asOfTs ->
                    bettingMap[row.trainingKey] = row
                existing.asOfTs == null -> bettingMap[row.trainingKey] = row
            }
        }

        // Step 4: weather.
        val weatherRows: List<WeatherRow> = runCatching {
            cfb.from("production_weather").select().decodeList<WeatherRow>()
        }.getOrDefault(emptyList())
        val weatherMap = HashMap<String, WeatherRow>()
        for (row in weatherRows) row.trainingKey?.let { weatherMap[it] = row }

        // Step 5: merge — match on view.home_away_unique == prediction.training_key.
        val merged = viewRows.map { row ->
            val matchKey = row.homeAwayUnique ?: ""
            val prediction = predictionsMap[matchKey]
            val bet = bettingMap[matchKey]
            val weather = weatherMap[matchKey]
            val homeSpread = row.homeSpread ?: bet?.homeSpread
            val awaySpread = row.homeSpread?.let { -it } ?: bet?.homeSpread?.let { -it }
            val obj = buildJsonObject {
                put("id", row.id ?: matchKey)
                put("away_team", row.awayTeam ?: "")
                put("home_team", row.homeTeam ?: "")
                put("home_ml", bet?.homeMl)
                put("away_ml", bet?.awayMl)
                put("home_spread", homeSpread)
                put("away_spread", awaySpread)
                put("over_line", row.overUnder ?: bet?.overLine)
                put("game_date", row.gameDate ?: "")
                put("game_time", bet?.gameTime ?: row.gameTime ?: "")
                put("training_key", matchKey)
                put("unique_id", row.uniqueId ?: matchKey)
                put("home_away_ml_prob", prediction?.homeAwayMlProb)
                put("home_away_spread_cover_prob", prediction?.homeAwaySpreadCoverProb)
                put("ou_result_prob", prediction?.ouResultProb)
                put("run_id", prediction?.runId)
                put("temperature", weather?.temperature)
                put("precipitation", weather?.precipitationPct)
                put("wind_speed", weather?.windSpeed)
                put("icon", weather?.icon)
                put("spread_splits_label", bet?.spreadSplitsLabel)
                put("total_splits_label", bet?.totalSplitsLabel)
                put("ml_splits_label", bet?.mlSplitsLabel)
                put("home_ml_handle", bet?.homeMlHandle)
                put("away_ml_handle", bet?.awayMlHandle)
                put("home_ml_bets", bet?.homeMlBets)
                put("away_ml_bets", bet?.awayMlBets)
                put("home_spread_handle", bet?.homeSpreadHandle)
                put("away_spread_handle", bet?.awaySpreadHandle)
                put("home_spread_bets", bet?.homeSpreadBets)
                put("away_spread_bets", bet?.awaySpreadBets)
                put("over_handle", bet?.overHandle)
                put("under_handle", bet?.underHandle)
                put("over_bets", bet?.overBets)
                put("under_bets", bet?.underBets)
            }
            WagerproofJson.decodeFromJsonElement(NFLPrediction.serializer(), obj)
        }
        games = games.copy(nfl = merged)
    }

    private val nflSlotLabels = mapOf(
        "thu_fri" to "Thu/Fri", "sun_early" to "Sun Early",
        "sun_late_sat" to "Sun Late", "snf" to "SNF", "monday" to "MNF",
    )

    /** Dry-run slate mapped onto the card model. Spreads are home-relative. */
    private suspend fun fetchNFLDryrun(cfb: io.github.jan.supabase.SupabaseClient): List<NFLPrediction> {
        // Team logos/abbrs come from `nfl_teams` — warm the cache first.
        NFLTeamsService.ensureLoaded()
        val rows: List<JsonObject> = runCatching {
            cfb.from("nfl_dryrun_games")
                .select { order("kickoff", Order.ASCENDING) }
                .decodeList<JsonObject>()
        }.getOrDefault(emptyList())
        return rows.map { nflPredictionFromDryrun(it) }
            .sortedWith(compareBy({ it.topConvictionRank }, { it.kickoff ?: it.gameDate }))
    }

    private fun nflPredictionFromDryrun(row: JsonObject): NFLPrediction {
        val gameId = jsonString(row, "game_id") ?: ""
        val season = jsonInt(row, "season")
        val week = jsonInt(row, "week")
        val kickoff = jsonString(row, "kickoff")
        val gameday = jsonString(row, "gameday")
        val slot = jsonString(row, "slot")
        val fgSpreadClose = jsonDouble(row, "fg_spread_close")
        val fgTotalClose = jsonDouble(row, "fg_total_close")
        val homeMl = jsonDouble(row, "fg_ml_home_close")?.roundToInt()
        val awayMl = jsonDouble(row, "fg_ml_away_close")?.roundToInt()
        val gameDate = kickoff ?: gameday ?: ""
        val gameTime = kickoff ?: slot?.let { nflSlotLabels[it] } ?: ""

        // Start from the raw row (fg_/tt_/h1_/wx_/conviction_ keys already match
        // NFLPrediction's SerialNames) and override the derived generic keys.
        val m = row.toMutableMap()
        m["id"] = JsonPrimitive(gameId)
        homeMl?.let { m["home_ml"] = JsonPrimitive(it) }
        awayMl?.let { m["away_ml"] = JsonPrimitive(it) }
        fgSpreadClose?.let {
            m["home_spread"] = JsonPrimitive(it)
            m["away_spread"] = JsonPrimitive(-it)
        }
        fgTotalClose?.let { m["over_line"] = JsonPrimitive(it) }
        m["game_date"] = JsonPrimitive(gameDate)
        m["game_time"] = JsonPrimitive(gameTime)
        m["training_key"] = JsonPrimitive(gameId)
        m["unique_id"] = JsonPrimitive(gameId)
        jsonDouble(row, "fg_home_win_prob")?.let { m["home_away_ml_prob"] = JsonPrimitive(it) }
        jsonDouble(row, "fg_home_cover_prob")?.let { m["home_away_spread_cover_prob"] = JsonPrimitive(it) }
        m.remove("ou_result_prob") // iOS sets nil for the dryrun path.
        jsonDouble(row, "fg_pred_total")?.let { m["pred_total"] = JsonPrimitive(it) }
        m["run_id"] = JsonPrimitive("nfl-dryrun-${season ?: 2025}-${week ?: 12}")
        jsonDouble(row, "wx_temp_f")?.let { m["temperature"] = JsonPrimitive(it) }
        jsonDouble(row, "wx_precip_mm")?.let { m["precipitation"] = JsonPrimitive(it) }
        jsonDouble(row, "wx_wind_mph")?.let { m["wind_speed"] = JsonPrimitive(it) }
        jsonString(row, "wx_icon")?.let { m["icon"] = JsonPrimitive(it) }
        return WagerproofJson.decodeFromJsonElement(NFLPrediction.serializer(), JsonObject(m))
    }

    // MARK: - CFB fetch (dryrun-only; legacy kept but unreferenced)

    private suspend fun fetchCFB() = fetchCFBDryrun()

    private suspend fun fetchCFBDryrun() {
        val cfb = SupabaseClients.cfb
        CFBTeamsService.ensureLoaded()
        coroutineScope {
            // week 7 is hardcoded (dry-run slate). Failures propagate → refresh() marks .failed.
            val gameRowsD = async {
                cfb.from("cfb_dryrun_games").select { filter { eq("week", 7) } }.decodeList<CFBDryrunGameRow>()
            }
            val flagRowsD = async {
                cfb.from("cfb_dryrun_flags").select { filter { eq("week", 7) } }.decodeList<CFBDryrunFlagRow>()
            }
            val defsD = async { CFBSignalDefinitionsService.shared.definitionsBySource() }

            val rows = gameRowsD.await()
            val flags = flagRowsD.await()
            val definitionsBySource = defsD.await()

            val flagModels = flags.map { r ->
                val flag = r.toModel()
                flag.withSignalDefinition(CFBSignalDefinitionsService.definition(flag.source, definitionsBySource))
            }
            val flagsByGame = flagModels.groupBy { it.gameId }
            games = games.copy(cfb = rows.map { mapCFBDryrun(it, flagsByGame) })
        }
    }

    private fun mapCFBDryrun(row: CFBDryrunGameRow, flagsByGame: Map<String, List<CFBDryRunFlag>>): CFBPrediction {
        val gameId = row.gameId ?: ""
        val away = row.awayTeam ?: "Away"
        val home = row.homeTeam ?: "Home"
        val attachedFlags = (flagsByGame[gameId] ?: emptyList()).sortedWith(
            compareByDescending<CFBDryRunFlag> { it.isActive }
                .thenBy { it.convictionTier.sortRank }
                .thenByDescending { it.stakeUnits ?: 0.0 },
        )
        val score = cfbPredictedScore(row.fgPredHomePts, row.fgPredAwayPts, row.fgPredTotal, row.fgPredMargin)
        return CFBPrediction(
            id = gameId,
            awayTeam = away,
            homeTeam = home,
            homeMl = row.fgMlHomeClose?.roundToInt(),
            awayMl = row.fgMlAwayClose?.roundToInt(),
            homeSpread = row.fgSpreadClose,
            awaySpread = row.fgSpreadClose?.let { -it },
            overLine = row.fgTotalClose,
            gameDate = row.kickoff ?: "",
            gameTime = row.kickoff ?: "",
            trainingKey = gameId,
            uniqueId = gameId,
            homeAwayMlProb = row.fgHomeWinProb,
            homeAwaySpreadCoverProb = row.fgHomeCoverProb,
            ouResultProb = null,
            runId = "cfb-dryrun-wk7-2025",
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
            conference = listOfNotNull(row.awayConf, row.homeConf).joinToString(" / "),
            predAwayScore = score?.away,
            predHomeScore = score?.home,
            predAwayPoints = score?.away,
            predHomePoints = score?.home,
            predSpread = row.fgPredSpread,
            homeSpreadDiff = row.fgSpreadEdge,
            predTotal = row.fgPredTotal,
            totalDiff = row.fgTotalEdge,
            predOverLine = row.fgPredTotal,
            overLineDiff = row.fgTotalEdge,
            openingSpread = row.fgSpreadOpen,
            openingTotal = row.fgTotalOpen,
            gameId = gameId,
            season = row.season,
            week = row.week,
            kickoff = row.kickoff,
            neutralSite = row.neutralSite,
            homeConf = row.homeConf,
            awayConf = row.awayConf,
            homeRank = row.homeRank,
            awayRank = row.awayRank,
            homeClassification = CFBTeamAssets.team(home)?.classification ?: row.classification,
            awayClassification = CFBTeamAssets.team(away)?.classification ?: row.classification,
            homeTeamRef = CFBTeamAssets.team(home),
            awayTeamRef = CFBTeamAssets.team(away),
            fgSpreadOpen = row.fgSpreadOpen,
            fgSpreadClose = row.fgSpreadClose,
            fgTotalOpen = row.fgTotalOpen,
            fgTotalClose = row.fgTotalClose,
            fgMlHomeClose = row.fgMlHomeClose?.roundToInt(),
            fgMlAwayClose = row.fgMlAwayClose?.roundToInt(),
            ttHomeClose = row.ttHomeClose,
            ttAwayClose = row.ttAwayClose,
            ttHomeBestUnder = row.ttHomeBestUnder,
            ttHomeBestOver = row.ttHomeBestOver,
            ttAwayBestUnder = row.ttAwayBestUnder,
            ttAwayBestOver = row.ttAwayBestOver,
            h1SpreadClose = row.h1SpreadClose,
            h1TotalClose = row.h1TotalClose,
            h1MlHomeClose = row.h1MlHomeClose?.roundToInt(),
            h1MlAwayClose = row.h1MlAwayClose?.roundToInt(),
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
            fgHomeCoverProb = row.fgHomeCoverProb,
            fgHomeWinProb = row.fgHomeWinProb,
            convictionTierRaw = row.convictionTier ?: "none",
            stakeUnits = row.stakeUnits,
            nFlagsActive = row.nFlagsActive,
            nFlagsTracking = row.nFlagsTracking,
            mammoth = row.mammoth ?: false,
            flags = attachedFlags,
        )
    }

    /** Legacy 2-way merge (`cfb_live_weekly_inputs` + `cfb_api_predictions`). Currently unreferenced. */
    @Suppress("unused")
    private suspend fun fetchCFBLegacy() {
        val cfb = SupabaseClients.cfb
        val inputs: List<CFBInputRow> = cfb.from("cfb_live_weekly_inputs").select().decodeList()
        val preds: List<CFBAPIRow> = runCatching {
            cfb.from("cfb_api_predictions").select().decodeList<CFBAPIRow>()
        }.getOrDefault(emptyList())
        val predsById = preds.associateBy { it.id }

        val merged = inputs.map { input ->
            val api = predsById[input.id]
            val homeSpread = input.apiSpread ?: input.homeSpread
            val awaySpread = input.apiSpread?.let { -it } ?: input.awaySpread
            CFBPrediction(
                id = input.id.toString(),
                awayTeam = input.awayTeam ?: "",
                homeTeam = input.homeTeam ?: "",
                homeMl = input.homeMoneyline ?: input.homeMl,
                awayMl = input.awayMoneyline ?: input.awayMl,
                homeSpread = homeSpread,
                awaySpread = awaySpread,
                overLine = input.apiOverLine ?: input.totalLine,
                gameDate = input.startTime ?: input.startDate ?: input.gameDate ?: "",
                gameTime = input.startTime ?: input.startDate ?: input.gameTime ?: "",
                trainingKey = input.trainingKey ?: "",
                uniqueId = input.uniqueId ?: "${input.awayTeam ?: ""}_${input.homeTeam ?: ""}_${input.startTime ?: ""}",
                homeAwayMlProb = input.predMlProba ?: input.homeAwayMlProb,
                homeAwaySpreadCoverProb = input.predSpreadProba ?: input.homeAwaySpreadCoverProb,
                ouResultProb = input.predTotalProba ?: input.ouResultProb,
                runId = input.runId,
                temperature = input.weatherTempF ?: input.temperature,
                precipitation = input.precipitation,
                windSpeed = input.weatherWindspeedMph ?: input.windSpeed,
                icon = input.weatherIconText ?: input.icon,
                spreadSplitsLabel = input.spreadSplitsLabel,
                totalSplitsLabel = input.totalSplitsLabel,
                mlSplitsLabel = input.mlSplitsLabel,
                conference = input.conference,
                predAwayScore = api?.predAwayScore ?: input.predAwayScore,
                predHomeScore = api?.predHomeScore ?: input.predHomeScore,
                predAwayPoints = api?.predAwayPoints ?: api?.awayPoints,
                predHomePoints = api?.predHomePoints ?: api?.homePoints,
                predSpread = api?.predSpread ?: api?.runLinePrediction ?: api?.spreadPrediction,
                homeSpreadDiff = api?.homeSpreadDiff ?: api?.spreadDiff ?: api?.edge,
                predTotal = api?.predTotal ?: api?.totalPrediction ?: api?.ouPrediction,
                totalDiff = api?.totalDiff ?: api?.totalEdge,
                predOverLine = api?.predOverLine,
                overLineDiff = api?.overLineDiff,
                openingSpread = input.spread,
                openingTotal = input.totalLine,
                convictionTierRaw = "none",
                mammoth = false,
                flags = emptyList(),
            )
        }
        games = games.copy(cfb = merged)
    }

    // MARK: - NBA fetch

    /** Compute away ML from home ML when missing. Mirrors RN `calculateAwayML`. */
    private fun calculateAwayML(homeML: Int?): Int? {
        if (homeML == null) return null
        return if (homeML > 0) -(homeML + 100) else 100 - homeML
    }

    private suspend fun fetchNBA() {
        val cfb = SupabaseClients.cfb

        val inputRows: List<NBAInputRow> = cfb.from("nba_input_values_view").select().decodeList()
        if (inputRows.isEmpty()) {
            games = games.copy(nba = emptyList())
            return
        }

        val predictionRows: List<NBAPredictionRow> = runCatching {
            cfb.from("nba_predictions")
                .select(columns = Columns.raw("game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc"))
                .decodeList<NBAPredictionRow>()
        }.getOrDefault(emptyList())
        val predictionsByGame = HashMap<Int, NBAPredictionRow>()
        for (row in predictionRows) {
            val existing = predictionsByGame[row.gameId]
            if (existing == null) {
                predictionsByGame[row.gameId] = row
            } else if ((row.asOfTsUtc ?: "") > (existing.asOfTsUtc ?: "")) {
                predictionsByGame[row.gameId] = row
            }
        }

        games = games.copy(
            nba = inputRows.map { input ->
                val pred = predictionsByGame[input.gameId]
                var spreadCoverProb: Double? = null
                val modelFairSpread = pred?.modelFairHomeSpread
                val hs = input.homeSpread
                if (modelFairSpread != null && hs != null) {
                    val diff = abs(modelFairSpread - hs)
                    spreadCoverProb = if (modelFairSpread < hs) 0.5 + minOf(diff * 0.05, 0.35)
                    else 0.5 - minOf(diff * 0.05, 0.35)
                } else if (pred?.homeWinProb != null) {
                    spreadCoverProb = pred.homeWinProb
                }
                var ouProb: Double? = null
                val modelFairTotal = pred?.modelFairTotal
                if (modelFairTotal != null && input.totalLine != null) {
                    val totalDiff = modelFairTotal - input.totalLine
                    ouProb = if (totalDiff > 0) 0.5 + minOf(abs(totalDiff) * 0.02, 0.35)
                    else 0.5 - minOf(abs(totalDiff) * 0.02, 0.35)
                }
                val gameIdStr = input.gameId.toString()
                val awayAbbr = input.awayAbbr?.takeIf { it.trim().isNotEmpty() } ?: (input.awayTeam ?: "AWAY")
                val homeAbbr = input.homeAbbr?.takeIf { it.trim().isNotEmpty() } ?: (input.homeTeam ?: "HOME")
                NBAGame(
                    id = gameIdStr,
                    gameId = input.gameId,
                    awayTeam = input.awayTeam ?: "",
                    homeTeam = input.homeTeam ?: "",
                    awayAbbr = awayAbbr,
                    homeAbbr = homeAbbr,
                    homeMl = input.homeMoneyline,
                    awayMl = input.awayMoneyline ?: calculateAwayML(input.homeMoneyline),
                    homeSpread = input.homeSpread,
                    awaySpread = input.homeSpread?.let { -it },
                    overLine = input.totalLine,
                    gameDate = input.gameDate ?: "",
                    gameTime = input.tipoffTimeEt ?: "",
                    trainingKey = gameIdStr,
                    uniqueId = gameIdStr,
                    homeAdjOffense = input.homeAdjOffRtgPregame,
                    awayAdjOffense = input.awayAdjOffRtgPregame,
                    homeAdjDefense = input.homeAdjDefRtgPregame,
                    awayAdjDefense = input.awayAdjDefRtgPregame,
                    homeAdjPace = input.homeAdjPacePregame,
                    awayAdjPace = input.awayAdjPacePregame,
                    homeAtsPct = input.homeAtsPct,
                    awayAtsPct = input.awayAtsPct,
                    homeOverPct = input.homeOverPct,
                    awayOverPct = input.awayOverPct,
                    homeAwayMlProb = pred?.homeWinProb,
                    homeAwaySpreadCoverProb = spreadCoverProb,
                    ouResultProb = ouProb,
                    runId = pred?.runId,
                    homeScorePred = pred?.homeScorePred,
                    awayScorePred = pred?.awayScorePred,
                    modelFairHomeSpread = pred?.modelFairHomeSpread,
                    modelFairTotal = pred?.modelFairTotal,
                )
            },
        )
    }

    // MARK: - NCAAB fetch (3-way merge)

    private suspend fun fetchNCAAB() {
        val cfb = SupabaseClients.cfb

        // This is the authoritative slate query. Let transport/decoding errors
        // propagate so refresh() keeps the prior cached list and reports
        // Failed; converting an outage to `emptyList()` erased good data for
        // the full five-minute TTL.
        val inputs: List<NCAABInputRow> =
            cfb.from("v_cbb_input_values").select().decodeList<NCAABInputRow>()
        if (inputs.isEmpty()) {
            games = games.copy(ncaab = emptyList())
            return
        }

        val allPreds: List<NCAABPredictionRow> = runCatching {
            cfb.from("ncaab_predictions")
                .select(columns = Columns.raw("game_id, run_id, as_of_ts_utc, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, home_win_prob, away_win_prob, pred_home_margin, pred_total_points, home_score_pred, away_score_pred, model_fair_home_spread, vegas_home_spread, vegas_total"))
                .decodeList<NCAABPredictionRow>()
        }.getOrDefault(emptyList())
        // Prefer the run with the newest as_of_ts_utc; fall back to lexicographic run_id.
        val latestRunId: String? = run {
            val dated = allPreds.mapNotNull { p ->
                val r = p.runId
                val ts = p.asOfTsUtc
                if (r != null && ts != null) r to ts else null
            }
            dated.maxByOrNull { it.second }?.first ?: allPreds.mapNotNull { it.runId }.maxOrNull()
        }
        val predictionMap = HashMap<Int, NCAABPredictionRow>()
        for (row in allPreds) if (row.runId == latestRunId) predictionMap[row.gameId] = row

        val mappingRows: List<NCAABMappingRow> = runCatching {
            cfb.from("ncaab_team_mapping")
                .select(columns = Columns.raw("api_team_id, team_abbrev, espn_team_id"))
                .decodeList<NCAABMappingRow>()
        }.getOrDefault(emptyList())
        val mappingMap = HashMap<Int, Pair<String?, String?>>() // apiTeamId -> (abbrev, logo)
        for (row in mappingRows) {
            val espnId = row.espnTeamId?.let { it.toIntOrNull() ?: it.toDoubleOrNull()?.toInt() }
            val logo = espnId?.let { "https://a.espncdn.com/i/teamlogos/ncaa/500/$it.png" }
            mappingMap[row.apiTeamId] = row.teamAbbrev to logo
        }

        games = games.copy(
            ncaab = inputs.map { row ->
                val pred = predictionMap[row.gameId]
                val awayMap = row.awayTeamId?.let { mappingMap[it] }
                val homeMap = row.homeTeamId?.let { mappingMap[it] }
                NCAABGame(
                    id = row.gameId.toString(),
                    gameId = row.gameId,
                    awayTeam = row.awayTeam ?: "",
                    homeTeam = row.homeTeam ?: "",
                    homeMl = row.homeMl,
                    awayMl = row.awayMl,
                    homeSpread = row.homeSpread ?: pred?.vegasHomeSpread,
                    awaySpread = row.awaySpread,
                    overLine = row.overUnder ?: pred?.vegasTotal,
                    gameDate = row.gameDateEt ?: "",
                    gameTime = row.startUtc ?: row.tipoffTimeEt ?: "",
                    trainingKey = row.gameId.toString(),
                    uniqueId = row.gameId.toString(),
                    homeAdjOffense = row.homeAdjOffense,
                    awayAdjOffense = row.awayAdjOffense,
                    homeAdjDefense = row.homeAdjDefense,
                    awayAdjDefense = row.awayAdjDefense,
                    homeAdjPace = row.homeAdjPace,
                    awayAdjPace = row.awayAdjPace,
                    homeRanking = row.homeRanking,
                    awayRanking = row.awayRanking,
                    conferenceGame = row.conferenceGame,
                    neutralSite = row.neutralSite,
                    homeAwayMlProb = pred?.homeAwayMlProb,
                    homeAwaySpreadCoverProb = pred?.homeAwaySpreadCoverProb,
                    ouResultProb = pred?.ouResultProb,
                    predHomeMargin = pred?.predHomeMargin,
                    predTotalPoints = pred?.predTotalPoints,
                    runId = pred?.runId,
                    homeScorePred = pred?.homeScorePred,
                    awayScorePred = pred?.awayScorePred,
                    modelFairHomeSpread = pred?.modelFairHomeSpread,
                    homeTeamLogo = homeMap?.second,
                    awayTeamLogo = awayMap?.second,
                    homeTeamAbbrev = homeMap?.first,
                    awayTeamAbbrev = awayMap?.first,
                )
            },
        )
    }

    // MARK: - MLB fetch

    private suspend fun fetchMLB() {
        val cfb = SupabaseClients.cfb
        // today..today+2d in ET (matches RN window).
        val startDate = ServiceDates.todayET()
        val endDate = ServiceDates.etDate(2L)

        // Preserve a previously loaded slate on a primary-query failure. An
        // actual successful empty response still clears the list below.
        val gamesRows: List<MLBGamesTodayRow> = cfb.from("mlb_games_today")
            .select {
                filter {
                    gte("official_date", startDate)
                    lte("official_date", endDate)
                }
            }
            .decodeList<MLBGamesTodayRow>()
        if (gamesRows.isEmpty()) {
            games = games.copy(mlb = emptyList())
            return
        }
        val pks = gamesRows.mapNotNull { it.gamePk }

        val predRows: List<MLBPredictionsCurrentRow> = runCatching {
            cfb.from("mlb_predictions_current")
                .select { filter { isIn("game_pk", pks) } }
                .decodeList<MLBPredictionsCurrentRow>()
        }.getOrDefault(emptyList())
        val predsByPk = HashMap<Int, MLBPredictionsCurrentRow>()
        for (row in predRows) row.gamePk?.let { if (!predsByPk.containsKey(it)) predsByPk[it] = row }

        val mappingRows: List<MLBTeamMapping> = runCatching {
            cfb.from("mlb_team_mapping").select().decodeList<MLBTeamMapping>()
        }.getOrDefault(emptyList())
        val mappingByName = HashMap<String, MLBTeamMapping>()
        val mappingById = HashMap<Int, MLBTeamMapping>()
        for (m in mappingRows) {
            val key = MLBTeams.normalize(m.teamName)
            if (!mappingByName.containsKey(key)) mappingByName[key] = m
            if (!mappingById.containsKey(m.mlbApiId)) mappingById[m.mlbApiId] = m
        }

        // Signals: jsonb array | text[] of JSON strings | JSON string, with
        // case-variant keys. Decode as JsonObject and parse defensively.
        val signalRows: List<JsonObject> = runCatching {
            cfb.from("mlb_game_signals").select().decodeList<JsonObject>()
        }.getOrDefault(emptyList())
        val signalsByPk = HashMap<Int, List<MLBSignalItem>>()
        for (o in signalRows) {
            val pk = jsonInt(o, "game_pk") ?: continue
            if (signalsByPk.containsKey(pk)) continue
            // Combine in spec order: game → home → away.
            val combined = parseSignalList(o["game_signals"]) +
                parseSignalList(o["home_signals"]) +
                parseSignalList(o["away_signals"])
            signalsByPk[pk] = combined
        }

        val merged = gamesRows.mapNotNull { row ->
            val pk = row.gamePk ?: return@mapNotNull null
            val pred = predsByPk[pk]
            val awayName = row.awayTeamName ?: row.awayTeam ?: ""
            val homeName = row.homeTeamName ?: row.homeTeam ?: ""

            // Resolve mapping by mlb_api_id first, then normalized name.
            val awayMapping = row.awayTeamId?.let { mappingById[it] } ?: mappingByName[MLBTeams.normalize(awayName)]
            val homeMapping = row.homeTeamId?.let { mappingById[it] } ?: mappingByName[MLBTeams.normalize(homeName)]

            // Static fallback when the mapping table can't resolve the team.
            val awayFallback = MLBTeams.info(awayName)
            val homeFallback = MLBTeams.info(homeName)

            val awayAbbr = awayMapping?.team ?: awayFallback?.team ?: fallbackMLBAbbrev(awayName)
            val homeAbbr = homeMapping?.team ?: homeFallback?.team ?: fallbackMLBAbbrev(homeName)

            MLBGame(
                id = pk.toString(),
                gamePk = pk,
                officialDate = row.officialDate ?: "",
                gameTimeEt = row.gameTimeEt,
                awayTeamName = row.awayTeamName,
                homeTeamName = row.homeTeamName,
                awayTeam = row.awayTeam,
                homeTeam = row.homeTeam,
                awayTeamFullName = row.awayTeamFullName,
                homeTeamFullName = row.homeTeamFullName,
                awayTeamId = row.awayTeamId,
                homeTeamId = row.homeTeamId,
                awayAbbr = awayAbbr,
                homeAbbr = homeAbbr,
                awayLogoUrl = awayMapping?.logoUrl ?: awayFallback?.logoUrl,
                homeLogoUrl = homeMapping?.logoUrl ?: homeFallback?.logoUrl,
                status = row.status,
                isPostponed = row.isPostponed,
                isCompleted = row.isCompleted,
                isActive = row.isActive,
                awayMl = row.awayMl,
                homeMl = row.homeMl,
                awaySpread = row.awaySpread,
                homeSpread = row.homeSpread,
                totalLine = row.totalLine,
                mlHomeWinProb = pred?.mlHomeWinProb,
                mlAwayWinProb = pred?.mlAwayWinProb,
                homeImpliedProb = pred?.homeImpliedProb,
                awayImpliedProb = pred?.awayImpliedProb,
                homeMlEdgePct = pred?.homeMlEdgePct,
                awayMlEdgePct = pred?.awayMlEdgePct,
                homeMlStrongSignal = pred?.homeMlStrongSignal,
                awayMlStrongSignal = pred?.awayMlStrongSignal,
                ouEdge = pred?.ouEdge,
                ouDirection = pred?.ouDirection,
                ouFairTotal = pred?.ouFairTotal,
                ouStrongSignal = pred?.ouStrongSignal,
                ouModerateSignal = pred?.ouModerateSignal,
                f5HomeMl = pred?.f5HomeMl,
                f5AwayMl = pred?.f5AwayMl,
                f5FairTotal = pred?.f5FairTotal,
                f5PredMargin = pred?.f5PredMargin,
                f5TotalLine = pred?.f5TotalLine,
                f5HomeSpread = pred?.f5HomeSpread,
                f5AwaySpread = pred?.f5AwaySpread,
                f5OuEdge = pred?.f5OuEdge,
                f5HomeWinProb = pred?.f5HomeWinProb,
                f5AwayWinProb = pred?.f5AwayWinProb,
                f5HomeImpliedProb = pred?.f5HomeImpliedProb,
                f5AwayImpliedProb = pred?.f5AwayImpliedProb,
                f5HomeMlEdgePct = pred?.f5HomeMlEdgePct,
                f5AwayMlEdgePct = pred?.f5AwayMlEdgePct,
                f5HomeMlStrongSignal = pred?.f5HomeMlStrongSignal,
                f5AwayMlStrongSignal = pred?.f5AwayMlStrongSignal,
                homeSpName = row.homeSpName,
                awaySpName = row.awaySpName,
                homeSpConfirmed = row.homeSpConfirmed,
                awaySpConfirmed = row.awaySpConfirmed,
                isFinalPrediction = pred?.isFinalPrediction,
                projectionLabel = pred?.projectionLabel,
                weatherConfirmed = row.weatherConfirmed,
                weatherImputed = row.weatherImputed,
                temperatureF = row.temperatureF,
                windSpeedMph = row.windSpeedMph,
                windDirection = row.windDirection,
                sky = row.sky,
                venueName = row.venueName,
                signals = signalsByPk[pk] ?: emptyList(),
            )
        }

        games = games.copy(mlb = merged)
    }

    private fun fallbackMLBAbbrev(teamName: String): String {
        val trimmed = teamName.trim()
        if (trimmed.isEmpty()) return "MLB"
        return trimmed.split(" ")
            .mapNotNull { it.firstOrNull() }
            .take(3)
            .joinToString("") { it.toString().uppercase() }
    }

    // MARK: - Debug helpers (screenshot harness)

    fun debugSet(
        nfl: List<NFLPrediction> = emptyList(),
        cfb: List<CFBPrediction> = emptyList(),
        nba: List<NBAGame> = emptyList(),
        ncaab: List<NCAABGame> = emptyList(),
        mlb: List<MLBGame> = emptyList(),
        sport: Sport = Sport.mlb,
        state: LoadState = LoadState.Loaded,
    ) {
        if (!BuildFlags.isDebugBuild) return
        games = SportFeed(nfl = nfl, cfb = cfb, nba = nba, ncaab = ncaab, mlb = mlb)
        selectedSport = sport
        loadState = Sport.entries.associateWith { state }
        lastFetched = if (state == LoadState.Loaded) {
            val now = System.currentTimeMillis()
            Sport.entries.associateWith { now }
        } else {
            emptyMap()
        }
    }

    private companion object {
        private val FMT_DATETIME: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

        private fun confidence(prob: Double?): Double {
            val p = prob ?: return 0.0
            return max(p, 1 - p)
        }

        /**
         * ISO8601 (with/without fractional seconds) → `yyyy-MM-dd HH:mm:ss` (UTC)
         * → `yyyy-MM-dd` (UTC). Returns epoch seconds, or null when unparseable.
         */
        private fun parseEpoch(raw: String): Double? {
            if (raw.isEmpty()) return null
            runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
                ?.let { return it.epochSecond + it.nano / 1_000_000_000.0 }
            runCatching { Instant.parse(raw) }.getOrNull()
                ?.let { return it.epochSecond + it.nano / 1_000_000_000.0 }
            runCatching { LocalDateTime.parse(raw, FMT_DATETIME).toEpochSecond(ZoneOffset.UTC) }.getOrNull()
                ?.let { return it.toDouble() }
            runCatching { LocalDate.parse(raw).atStartOfDay(ZoneOffset.UTC).toEpochSecond() }.getOrNull()
                ?.let { return it.toDouble() }
            return null
        }

        // JSON coercion helpers (raw rows for NFL dryrun + MLB signals).
        private fun jsonPrimitive(o: JsonObject, key: String): JsonPrimitive? {
            val el = o[key] ?: return null
            if (el is JsonNull) return null
            return el as? JsonPrimitive
        }

        private fun jsonDouble(o: JsonObject, key: String): Double? {
            val p = jsonPrimitive(o, key) ?: return null
            return if (p.isString) p.content.toDoubleOrNull() else p.doubleOrNull
        }

        private fun jsonInt(o: JsonObject, key: String): Int? {
            val p = jsonPrimitive(o, key) ?: return null
            if (p.isString) return p.content.toDoubleOrNull()?.toInt()
            return p.intOrNull ?: p.doubleOrNull?.toInt()
        }

        private fun jsonString(o: JsonObject, key: String): String? {
            val p = jsonPrimitive(o, key) ?: return null
            return p.content
        }

        // --- MLB signal parsing ---

        private fun parseSignalList(el: JsonElement?): List<MLBSignalItem> {
            if (el == null || el is JsonNull) return emptyList()
            return when (el) {
                is JsonArray -> el.mapNotNull { item ->
                    when (item) {
                        is JsonObject -> signalFromObject(item)
                        is JsonPrimitive -> if (item.isString) parseSignalString(item.content) else null
                        else -> null
                    }
                }
                is JsonPrimitive -> if (el.isString) {
                    // The whole field is a JSON array encoded as a string.
                    runCatching { WagerproofJson.parseToJsonElement(el.content) }.getOrNull()
                        ?.let { parseSignalList(it) } ?: emptyList()
                } else {
                    emptyList()
                }
                else -> emptyList()
            }
        }

        private fun parseSignalString(raw: String): MLBSignalItem? {
            val obj = runCatching { WagerproofJson.parseToJsonElement(raw) }.getOrNull() as? JsonObject ?: return null
            return signalFromObject(obj)
        }

        private fun signalFromObject(o: JsonObject): MLBSignalItem? {
            val category = firstString(o, "category", "Category", "type")
            val severity = firstString(o, "severity", "Severity", "level")
            val message = firstString(o, "message", "Message", "text", "body", "summary")
            if (message.isNullOrEmpty()) return null
            return MLBSignalItem(category = category ?: "", severity = severity ?: "", message = message)
        }

        private fun firstString(o: JsonObject, vararg keys: String): String? {
            for (key in keys) {
                val p = o[key] as? JsonPrimitive ?: continue
                if (p is JsonNull) continue
                if (p.isString) return p.content
            }
            return null
        }

        private fun cfbPredictedScore(home: Double?, away: Double?, total: Double?, margin: Double?): CFBPredictedScore? {
            if (home != null && away != null) return CFBPredictedScore(home, away)
            if (total == null || margin == null) return null
            return CFBPredictedScore(home = (total + margin) / 2, away = (total - margin) / 2)
        }
    }

    // MARK: - Private row decoders

    @Serializable
    private data class NFLViewRow(
        @Serializable(with = FlexibleStringSerializer::class) val id: String? = null,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("home_away_unique") val homeAwayUnique: String? = null,
        @SerialName("unique_id") val uniqueId: String? = null,
        @SerialName("home_spread") val homeSpread: Double? = null,
        @SerialName("over_under") val overUnder: Double? = null,
        @SerialName("game_date") val gameDate: String? = null,
        @SerialName("game_time") val gameTime: String? = null,
    )

    @Serializable
    private data class NFLPredictionRow(
        @SerialName("training_key") val trainingKey: String,
        @SerialName("home_away_ml_prob") val homeAwayMlProb: Double? = null,
        @SerialName("home_away_spread_cover_prob") val homeAwaySpreadCoverProb: Double? = null,
        @SerialName("ou_result_prob") val ouResultProb: Double? = null,
        @SerialName("run_id") val runId: String? = null,
    )

    @Serializable
    private data class NFLBettingRow(
        @SerialName("training_key") val trainingKey: String,
        @SerialName("home_ml") val homeMl: Int? = null,
        @SerialName("away_ml") val awayMl: Int? = null,
        @SerialName("over_line") val overLine: Double? = null,
        @SerialName("home_spread") val homeSpread: Double? = null,
        @SerialName("spread_splits_label") val spreadSplitsLabel: String? = null,
        @SerialName("ml_splits_label") val mlSplitsLabel: String? = null,
        @SerialName("total_splits_label") val totalSplitsLabel: String? = null,
        @SerialName("as_of_ts") val asOfTs: String? = null,
        @SerialName("game_date") val gameDate: String? = null,
        @SerialName("game_time") val gameTime: String? = null,
        @SerialName("home_ml_handle") val homeMlHandle: String? = null,
        @SerialName("away_ml_handle") val awayMlHandle: String? = null,
        @SerialName("home_ml_bets") val homeMlBets: String? = null,
        @SerialName("away_ml_bets") val awayMlBets: String? = null,
        @SerialName("home_spread_handle") val homeSpreadHandle: String? = null,
        @SerialName("away_spread_handle") val awaySpreadHandle: String? = null,
        @SerialName("home_spread_bets") val homeSpreadBets: String? = null,
        @SerialName("away_spread_bets") val awaySpreadBets: String? = null,
        @SerialName("over_handle") val overHandle: String? = null,
        @SerialName("under_handle") val underHandle: String? = null,
        @SerialName("over_bets") val overBets: String? = null,
        @SerialName("under_bets") val underBets: String? = null,
    )

    @Serializable
    private data class WeatherRow(
        @SerialName("training_key") val trainingKey: String? = null,
        val temperature: Double? = null,
        @SerialName("precipitation_pct") val precipitationPct: Double? = null,
        @SerialName("wind_speed") val windSpeed: Double? = null,
        val icon: String? = null,
    )

    @Serializable
    private data class CFBInputRow(
        val id: Int,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("home_moneyline") val homeMoneyline: Int? = null,
        @SerialName("away_moneyline") val awayMoneyline: Int? = null,
        @SerialName("home_ml") val homeMl: Int? = null,
        @SerialName("away_ml") val awayMl: Int? = null,
        @SerialName("api_spread") val apiSpread: Double? = null,
        @SerialName("home_spread") val homeSpread: Double? = null,
        @SerialName("away_spread") val awaySpread: Double? = null,
        @SerialName("api_over_line") val apiOverLine: Double? = null,
        @SerialName("total_line") val totalLine: Double? = null,
        val spread: Double? = null,
        @SerialName("start_time") val startTime: String? = null,
        @SerialName("start_date") val startDate: String? = null,
        @SerialName("game_date") val gameDate: String? = null,
        @SerialName("game_time") val gameTime: String? = null,
        @SerialName("training_key") val trainingKey: String? = null,
        @SerialName("unique_id") val uniqueId: String? = null,
        @SerialName("run_id") val runId: String? = null,
        @SerialName("pred_ml_proba") val predMlProba: Double? = null,
        @SerialName("pred_spread_proba") val predSpreadProba: Double? = null,
        @SerialName("pred_total_proba") val predTotalProba: Double? = null,
        @SerialName("home_away_ml_prob") val homeAwayMlProb: Double? = null,
        @SerialName("home_away_spread_cover_prob") val homeAwaySpreadCoverProb: Double? = null,
        @SerialName("ou_result_prob") val ouResultProb: Double? = null,
        @SerialName("weather_temp_f") val weatherTempF: Double? = null,
        val temperature: Double? = null,
        val precipitation: Double? = null,
        @SerialName("weather_windspeed_mph") val weatherWindspeedMph: Double? = null,
        @SerialName("wind_speed") val windSpeed: Double? = null,
        @SerialName("weather_icon_text") val weatherIconText: String? = null,
        val icon: String? = null,
        @SerialName("spread_splits_label") val spreadSplitsLabel: String? = null,
        @SerialName("total_splits_label") val totalSplitsLabel: String? = null,
        @SerialName("ml_splits_label") val mlSplitsLabel: String? = null,
        val conference: String? = null,
        @SerialName("pred_away_score") val predAwayScore: Double? = null,
        @SerialName("pred_home_score") val predHomeScore: Double? = null,
    )

    @Serializable
    private data class CFBAPIRow(
        val id: Int,
        @SerialName("pred_away_score") val predAwayScore: Double? = null,
        @SerialName("pred_home_score") val predHomeScore: Double? = null,
        @SerialName("pred_away_points") val predAwayPoints: Double? = null,
        @SerialName("pred_home_points") val predHomePoints: Double? = null,
        @SerialName("away_points") val awayPoints: Double? = null,
        @SerialName("home_points") val homePoints: Double? = null,
        @SerialName("pred_spread") val predSpread: Double? = null,
        @SerialName("run_line_prediction") val runLinePrediction: Double? = null,
        @SerialName("spread_prediction") val spreadPrediction: Double? = null,
        @SerialName("home_spread_diff") val homeSpreadDiff: Double? = null,
        @SerialName("spread_diff") val spreadDiff: Double? = null,
        val edge: Double? = null,
        @SerialName("pred_total") val predTotal: Double? = null,
        @SerialName("total_prediction") val totalPrediction: Double? = null,
        @SerialName("ou_prediction") val ouPrediction: Double? = null,
        @SerialName("total_diff") val totalDiff: Double? = null,
        @SerialName("total_edge") val totalEdge: Double? = null,
        @SerialName("pred_over_line") val predOverLine: Double? = null,
        @SerialName("over_line_diff") val overLineDiff: Double? = null,
    )

    @Serializable
    private data class CFBDryrunGameRow(
        @SerialName("game_id") @Serializable(with = FlexibleStringSerializer::class) val gameId: String? = null,
        val season: Int? = null,
        val week: Int? = null,
        val kickoff: String? = null,
        @SerialName("neutral_site") val neutralSite: Boolean? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_conf") val homeConf: String? = null,
        @SerialName("away_conf") val awayConf: String? = null,
        @SerialName("home_rank") val homeRank: Int? = null,
        @SerialName("away_rank") val awayRank: Int? = null,
        val classification: String? = null,
        @SerialName("fg_spread_open") val fgSpreadOpen: Double? = null,
        @SerialName("fg_spread_close") val fgSpreadClose: Double? = null,
        @SerialName("fg_total_open") val fgTotalOpen: Double? = null,
        @SerialName("fg_total_close") val fgTotalClose: Double? = null,
        @SerialName("fg_ml_home_close") val fgMlHomeClose: Double? = null,
        @SerialName("fg_ml_away_close") val fgMlAwayClose: Double? = null,
        @SerialName("tt_home_close") val ttHomeClose: Double? = null,
        @SerialName("tt_away_close") val ttAwayClose: Double? = null,
        @SerialName("tt_home_best_under") val ttHomeBestUnder: Double? = null,
        @SerialName("tt_home_best_over") val ttHomeBestOver: Double? = null,
        @SerialName("tt_away_best_under") val ttAwayBestUnder: Double? = null,
        @SerialName("tt_away_best_over") val ttAwayBestOver: Double? = null,
        @SerialName("h1_spread_close") val h1SpreadClose: Double? = null,
        @SerialName("h1_total_close") val h1TotalClose: Double? = null,
        @SerialName("h1_ml_home_close") val h1MlHomeClose: Double? = null,
        @SerialName("h1_ml_away_close") val h1MlAwayClose: Double? = null,
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
        @SerialName("tt_home_pred") val ttHomePred: Double? = null,
        @SerialName("tt_away_pred") val ttAwayPred: Double? = null,
        @SerialName("tt_home_pick") val ttHomePick: String? = null,
        @SerialName("tt_away_pick") val ttAwayPick: String? = null,
        @SerialName("h1_pred_margin") val h1PredMargin: Double? = null,
        @SerialName("h1_pred_total") val h1PredTotal: Double? = null,
        @SerialName("h1_spread_pick") val h1SpreadPick: String? = null,
        @SerialName("h1_total_pick") val h1TotalPick: String? = null,
        @SerialName("h1_ml_pick") val h1MlPick: String? = null,
        @SerialName("fg_home_cover_prob") val fgHomeCoverProb: Double? = null,
        @SerialName("fg_home_win_prob") val fgHomeWinProb: Double? = null,
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
    private data class CFBDryrunFlagRow(
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

    @Serializable
    private data class NBAInputRow(
        @SerialName("game_id") val gameId: Int,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_abbr") val awayAbbr: String? = null,
        @SerialName("home_abbr") val homeAbbr: String? = null,
        @SerialName("home_moneyline") val homeMoneyline: Int? = null,
        @SerialName("away_moneyline") val awayMoneyline: Int? = null,
        @SerialName("home_spread") val homeSpread: Double? = null,
        @SerialName("total_line") val totalLine: Double? = null,
        @SerialName("game_date") val gameDate: String? = null,
        @SerialName("tipoff_time_et") val tipoffTimeEt: String? = null,
        @SerialName("home_adj_off_rtg_pregame") val homeAdjOffRtgPregame: Double? = null,
        @SerialName("away_adj_off_rtg_pregame") val awayAdjOffRtgPregame: Double? = null,
        @SerialName("home_adj_def_rtg_pregame") val homeAdjDefRtgPregame: Double? = null,
        @SerialName("away_adj_def_rtg_pregame") val awayAdjDefRtgPregame: Double? = null,
        @SerialName("home_adj_pace_pregame") val homeAdjPacePregame: Double? = null,
        @SerialName("away_adj_pace_pregame") val awayAdjPacePregame: Double? = null,
        @SerialName("home_ats_pct") val homeAtsPct: Double? = null,
        @SerialName("away_ats_pct") val awayAtsPct: Double? = null,
        @SerialName("home_over_pct") val homeOverPct: Double? = null,
        @SerialName("away_over_pct") val awayOverPct: Double? = null,
    )

    @Serializable
    private data class NBAPredictionRow(
        @SerialName("game_id") val gameId: Int,
        @SerialName("home_win_prob") val homeWinProb: Double? = null,
        @SerialName("away_win_prob") val awayWinProb: Double? = null,
        @SerialName("model_fair_total") val modelFairTotal: Double? = null,
        @SerialName("home_score_pred") val homeScorePred: Double? = null,
        @SerialName("away_score_pred") val awayScorePred: Double? = null,
        @SerialName("model_fair_home_spread") val modelFairHomeSpread: Double? = null,
        @SerialName("run_id") val runId: String? = null,
        @SerialName("as_of_ts_utc") val asOfTsUtc: String? = null,
    )

    @Serializable
    private data class NCAABInputRow(
        @SerialName("game_id") val gameId: Int,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_team_id") val awayTeamId: Int? = null,
        @SerialName("home_team_id") val homeTeamId: Int? = null,
        @SerialName("home_ml") val homeMl: Int? = null,
        @SerialName("away_ml") val awayMl: Int? = null,
        @SerialName("home_spread") val homeSpread: Double? = null,
        @SerialName("away_spread") val awaySpread: Double? = null,
        @SerialName("over_under") val overUnder: Double? = null,
        @SerialName("game_date_et") val gameDateEt: String? = null,
        @SerialName("tipoff_time_et") val tipoffTimeEt: String? = null,
        @SerialName("start_utc") val startUtc: String? = null,
        @SerialName("home_adj_offense") val homeAdjOffense: Double? = null,
        @SerialName("away_adj_offense") val awayAdjOffense: Double? = null,
        @SerialName("home_adj_defense") val homeAdjDefense: Double? = null,
        @SerialName("away_adj_defense") val awayAdjDefense: Double? = null,
        @SerialName("home_adj_pace") val homeAdjPace: Double? = null,
        @SerialName("away_adj_pace") val awayAdjPace: Double? = null,
        @SerialName("home_ranking") val homeRanking: Int? = null,
        @SerialName("away_ranking") val awayRanking: Int? = null,
        @SerialName("conference_game") val conferenceGame: Boolean? = null,
        @SerialName("neutral_site") val neutralSite: Boolean? = null,
    )

    @Serializable
    private data class NCAABPredictionRow(
        @SerialName("game_id") val gameId: Int,
        @SerialName("run_id") val runId: String? = null,
        @SerialName("as_of_ts_utc") val asOfTsUtc: String? = null,
        @SerialName("home_away_ml_prob") val homeAwayMlProb: Double? = null,
        @SerialName("home_away_spread_cover_prob") val homeAwaySpreadCoverProb: Double? = null,
        @SerialName("ou_result_prob") val ouResultProb: Double? = null,
        @SerialName("home_win_prob") val homeWinProb: Double? = null,
        @SerialName("away_win_prob") val awayWinProb: Double? = null,
        @SerialName("pred_home_margin") val predHomeMargin: Double? = null,
        @SerialName("pred_total_points") val predTotalPoints: Double? = null,
        @SerialName("home_score_pred") val homeScorePred: Double? = null,
        @SerialName("away_score_pred") val awayScorePred: Double? = null,
        @SerialName("model_fair_home_spread") val modelFairHomeSpread: Double? = null,
        @SerialName("vegas_home_spread") val vegasHomeSpread: Double? = null,
        @SerialName("vegas_total") val vegasTotal: Double? = null,
    )

    // espn_team_id may be Int or String — FlexibleString coerces both to String.
    @Serializable
    private data class NCAABMappingRow(
        @SerialName("api_team_id") val apiTeamId: Int,
        @SerialName("team_abbrev") @Serializable(with = FlexibleStringSerializer::class) val teamAbbrev: String? = null,
        @SerialName("espn_team_id") @Serializable(with = FlexibleStringSerializer::class) val espnTeamId: String? = null,
    )

    @Serializable
    private data class MLBGamesTodayRow(
        @SerialName("game_pk") val gamePk: Int? = null,
        @SerialName("official_date") val officialDate: String? = null,
        @SerialName("game_time_et") val gameTimeEt: String? = null,
        @SerialName("away_team_name") val awayTeamName: String? = null,
        @SerialName("home_team_name") val homeTeamName: String? = null,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("away_team_full_name") val awayTeamFullName: String? = null,
        @SerialName("home_team_full_name") val homeTeamFullName: String? = null,
        @SerialName("away_team_id") val awayTeamId: Int? = null,
        @SerialName("home_team_id") val homeTeamId: Int? = null,
        val status: String? = null,
        @SerialName("is_postponed") val isPostponed: Boolean? = null,
        @SerialName("is_completed") val isCompleted: Boolean? = null,
        @SerialName("is_active") val isActive: Boolean? = null,
        @SerialName("away_ml") val awayMl: Int? = null,
        @SerialName("home_ml") val homeMl: Int? = null,
        @SerialName("away_spread") val awaySpread: Double? = null,
        @SerialName("home_spread") val homeSpread: Double? = null,
        @SerialName("total_line") val totalLine: Double? = null,
        @SerialName("home_sp_name") val homeSpName: String? = null,
        @SerialName("away_sp_name") val awaySpName: String? = null,
        @SerialName("home_sp_confirmed") val homeSpConfirmed: Boolean? = null,
        @SerialName("away_sp_confirmed") val awaySpConfirmed: Boolean? = null,
        @SerialName("weather_confirmed") val weatherConfirmed: Boolean? = null,
        @SerialName("weather_imputed") val weatherImputed: Boolean? = null,
        @SerialName("temperature_f") val temperatureF: Double? = null,
        @SerialName("wind_speed_mph") val windSpeedMph: Double? = null,
        @SerialName("wind_direction") val windDirection: String? = null,
        val sky: String? = null,
        @SerialName("venue_name") val venueName: String? = null,
    )

    @Serializable
    private data class MLBPredictionsCurrentRow(
        @SerialName("game_pk") val gamePk: Int? = null,
        @SerialName("ml_home_win_prob") val mlHomeWinProb: Double? = null,
        @SerialName("ml_away_win_prob") val mlAwayWinProb: Double? = null,
        @SerialName("home_implied_prob") val homeImpliedProb: Double? = null,
        @SerialName("away_implied_prob") val awayImpliedProb: Double? = null,
        @SerialName("home_ml_edge_pct") val homeMlEdgePct: Double? = null,
        @SerialName("away_ml_edge_pct") val awayMlEdgePct: Double? = null,
        @SerialName("home_ml_strong_signal") val homeMlStrongSignal: Boolean? = null,
        @SerialName("away_ml_strong_signal") val awayMlStrongSignal: Boolean? = null,
        @SerialName("ou_edge") val ouEdge: Double? = null,
        @SerialName("ou_direction") val ouDirection: String? = null,
        @SerialName("ou_fair_total") val ouFairTotal: Double? = null,
        @SerialName("ou_strong_signal") val ouStrongSignal: Boolean? = null,
        @SerialName("ou_moderate_signal") val ouModerateSignal: Boolean? = null,
        @SerialName("f5_home_ml") val f5HomeMl: Int? = null,
        @SerialName("f5_away_ml") val f5AwayMl: Int? = null,
        @SerialName("f5_fair_total") val f5FairTotal: Double? = null,
        @SerialName("f5_pred_margin") val f5PredMargin: Double? = null,
        @SerialName("f5_total_line") val f5TotalLine: Double? = null,
        @SerialName("f5_home_spread") val f5HomeSpread: Double? = null,
        @SerialName("f5_away_spread") val f5AwaySpread: Double? = null,
        @SerialName("f5_ou_edge") val f5OuEdge: Double? = null,
        @SerialName("f5_home_win_prob") val f5HomeWinProb: Double? = null,
        @SerialName("f5_away_win_prob") val f5AwayWinProb: Double? = null,
        @SerialName("f5_home_implied_prob") val f5HomeImpliedProb: Double? = null,
        @SerialName("f5_away_implied_prob") val f5AwayImpliedProb: Double? = null,
        @SerialName("f5_home_ml_edge_pct") val f5HomeMlEdgePct: Double? = null,
        @SerialName("f5_away_ml_edge_pct") val f5AwayMlEdgePct: Double? = null,
        @SerialName("f5_home_ml_strong_signal") val f5HomeMlStrongSignal: Boolean? = null,
        @SerialName("f5_away_ml_strong_signal") val f5AwayMlStrongSignal: Boolean? = null,
        @SerialName("is_final_prediction") val isFinalPrediction: Boolean? = null,
        @SerialName("projection_label") val projectionLabel: String? = null,
    )
}
