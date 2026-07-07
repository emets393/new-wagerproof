package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBF5
import com.wagerproof.core.models.MLBF5Game
import com.wagerproof.core.models.MLBF5Matchup
import com.wagerproof.core.models.MLBF5SplitRow
import com.wagerproof.core.models.MLBTeamMapping
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Loads tonight's MLB First-Five (F5) splits slate. 1:1 port of iOS
 * `MLBF5SplitsStore.swift` (mirrors RN `hooks/useMLBF5Splits.ts`):
 *   1. `mlb_games_today` for today..+2 (drop postponed)
 *   2. `mlb_team_mapping` to resolve team name → abbreviation
 *   3. `mv_mlb_f5_team_splits` filtered to the slate's team abbreviations
 * All three live on the CFB (sports-data) Supabase, read anonymously.
 */
@Stable
class MLBF5SplitsStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var games by mutableStateOf<List<MLBF5Game>>(emptyList()); private set
    var splitLookup by mutableStateOf<Map<String, MLBF5SplitRow>>(emptyMap()); private set
    var lastRefreshedAt by mutableStateOf<String?>(null); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set

    // An EMPTY slate (off-day) is cached too — otherwise every carousel swipe /
    // search keystroke would re-fire the full two-query fetch. Public so the
    // game sheets can apply the first-hydrate skeleton rule
    // (`isLoading && lastFetched == null`).
    var lastFetched by mutableStateOf<Long?>(null); private set
    private val staleWindowMs: Long = 10 * 60 * 1000

    val isLoading: Boolean get() = loadState.isLoading
    val errorMessage: String? get() = loadState.errorMessage

    fun close() = scope.cancel()

    suspend fun refreshIfStale(force: Boolean = false) {
        val last = lastFetched
        if (!force && last != null && System.currentTimeMillis() - last < staleWindowMs) return
        refresh()
    }

    suspend fun refresh() {
        loadState = LoadState.Loading
        val cfb = SupabaseClients.cfb
        val today = todayET()
        val end = addDays(today, 2)

        // 1. Today's slate.
        val scheduleRows: List<ScheduleRow>
        try {
            scheduleRows = cfb
                .from("mlb_games_today")
                .select {
                    filter {
                        gte("official_date", today)
                        lte("official_date", end)
                    }
                    order("official_date", Order.ASCENDING)
                    order("game_time_et", Order.ASCENDING)
                }
                .decodeList<JsonObject>()
                .map { ScheduleRow.from(it) }
        } catch (e: Exception) {
            loadState = LoadState.Failed(e.message ?: "Failed to load F5 splits.")
            return
        }

        // 2. Team mapping (best-effort; the static MLBTeams map is the fallback).
        val mappingRows: List<MLBTeamMapping> = runCatching {
            cfb.from("mlb_team_mapping").select().decodeList<MLBTeamMapping>()
        }.getOrDefault(emptyList())
        val byName = HashMap<String, MLBTeamMapping>()
        val byId = HashMap<Int, MLBTeamMapping>()
        for (m in mappingRows) {
            if (m.teamName.isNotEmpty()) byName[MLBTeams.normalize(m.teamName)] = m
            if (m.mlbApiId != 0) byId[m.mlbApiId] = m
        }

        val builtGames: List<MLBF5Game> = scheduleRows
            .filter { it.isPostponed != true }
            .map { row ->
                val awayName = row.awayName
                val homeName = row.homeName
                val awayAbbr = MLBF5.toSplitTeamAbbr(resolveTeam(awayName, row.awayId, byName, byId))
                val homeAbbr = MLBF5.toSplitTeamAbbr(resolveTeam(homeName, row.homeId, byName, byId))
                MLBF5Game(
                    gamePk = row.gamePk,
                    officialDate = row.officialDate,
                    gameTimeEt = row.gameTimeEt,
                    awayTeamName = awayName,
                    homeTeamName = homeName,
                    venueName = row.venueName,
                    awayAbbr = awayAbbr,
                    homeAbbr = homeAbbr,
                    awaySpName = row.awaySpName,
                    homeSpName = row.homeSpName,
                    awaySpHand = MLBF5.normalizePitchHand(row.awaySpHand),
                    homeSpHand = MLBF5.normalizePitchHand(row.homeSpHand),
                    totalLine = row.totalLine,
                    f5AwayMl = row.f5AwayMl,
                    f5HomeMl = row.f5HomeMl,
                    f5TotalLine = row.f5TotalLine,
                )
            }

        // 3. Splits for the slate's teams.
        val abbrs = builtGames.flatMap { listOf(it.awayAbbr, it.homeAbbr) }.toSortedSet().toList()
        if (abbrs.isEmpty()) {
            games = builtGames
            splitLookup = emptyMap()
            lastFetched = System.currentTimeMillis()
            loadState = LoadState.Loaded
            return
        }

        val splitRows: List<MLBF5SplitRow> = runCatching {
            cfb.from("mv_mlb_f5_team_splits")
                .select { filter { isIn("team_abbr", abbrs) } }
                .decodeList<MLBF5SplitRow>()
        }.getOrDefault(emptyList())

        games = builtGames
        splitLookup = MLBF5.buildSplitLookup(splitRows)
        lastRefreshedAt = splitRows.firstNotNullOfOrNull { it.lastRefreshedAt }
        lastFetched = System.currentTimeMillis()
        loadState = LoadState.Loaded
    }

    fun debugSet(games: List<MLBF5Game>, splits: List<MLBF5SplitRow>) {
        if (!BuildFlags.isDebugBuild) return
        this.games = games
        this.splitLookup = MLBF5.buildSplitLookup(splits)
        this.lastFetched = System.currentTimeMillis()
        this.loadState = LoadState.Loaded
    }

    /**
     * Per-game lookup for the game-sheet F5 widget. Returns null only when the
     * game isn't on the slate.
     */
    fun matchup(gamePk: Int): MLBF5Matchup? {
        val game = games.firstOrNull { it.gamePk == gamePk } ?: return null
        return MLBF5Matchup(
            game = game,
            awaySplit = split(game, "away"),
            homeSplit = split(game, "home"),
        )
    }

    fun split(game: MLBF5Game, side: String): MLBF5SplitRow? =
        if (side == "away") {
            MLBF5.findSplitRow(splitLookup, game.awayAbbr, "away", game.homeSpHand)
        } else {
            MLBF5.findSplitRow(splitLookup, game.homeAbbr, "home", game.awaySpHand)
        }

    // MARK: - Team resolution (mirrors RN `resolveTeam`)

    private fun resolveTeam(
        teamName: String,
        teamId: Int?,
        byName: Map<String, MLBTeamMapping>,
        byId: Map<Int, MLBTeamMapping>,
    ): String {
        val nameKey = MLBTeams.normalize(teamName)
        byName[nameKey]?.let { if (it.team.isNotEmpty()) return it.team }
        if (teamId != null) byId[teamId]?.let { if (it.team.isNotEmpty()) return it.team }
        for ((key, mapping) in byName) {
            if (key.contains(nameKey) || nameKey.contains(key)) {
                if (mapping.team.isNotEmpty()) return mapping.team
            }
        }
        MLBTeams.info(teamName)?.let { return it.team }
        // Last-ditch: initials / first chars.
        val words = teamName.split(" ").filter { it.isNotEmpty() }
        if (words.size >= 2) {
            return words.takeLast(3).joinToString("") { it.take(1) }.uppercase()
        }
        return teamName.take(3).uppercase()
    }

    // MARK: - Date helpers (ET, mirrors RN getTodayET / addDaysYmd)

    companion object {
        private val ET: ZoneId = ZoneId.of("America/New_York")
        private val YMD: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")

        fun todayET(): String = LocalDate.now(ET).format(YMD)

        fun addDays(baseYmd: String, days: Int): String =
            runCatching { LocalDate.parse(baseYmd, YMD).plusDays(days.toLong()).format(YMD) }
                .getOrDefault(baseYmd)
    }

    // MARK: - Flexible schedule row decode

    /**
     * `mlb_games_today` is wide and column names drift across migrations, so we
     * read each field from the first present of several candidate keys — mirrors
     * the `||` fallbacks in the RN hook's `fetchF5Games`.
     */
    private data class ScheduleRow(
        val gamePk: Int,
        val officialDate: String,
        val gameTimeEt: String?,
        val awayName: String,
        val homeName: String,
        val venueName: String?,
        val awayId: Int?,
        val homeId: Int?,
        val awaySpName: String?,
        val homeSpName: String?,
        val awaySpHand: String?,
        val homeSpHand: String?,
        val totalLine: Double?,
        val f5AwayMl: Double?,
        val f5HomeMl: Double?,
        val f5TotalLine: Double?,
        val isPostponed: Boolean?,
    ) {
        companion object {
            fun from(o: JsonObject): ScheduleRow = ScheduleRow(
                gamePk = firstInt(o, listOf("game_pk", "gamePk")) ?: 0,
                officialDate = firstString(o, listOf("official_date", "officialDate", "game_date_et")) ?: "",
                gameTimeEt = firstString(o, listOf("game_time_et", "gameTimeEt")),
                awayName = firstString(o, listOf("away_team_name", "away_team", "away_team_full_name")) ?: "Away",
                homeName = firstString(o, listOf("home_team_name", "home_team", "home_team_full_name")) ?: "Home",
                venueName = firstString(o, listOf("venue_name", "venue")),
                awayId = firstInt(o, listOf("away_team_id", "away_mlb_team_id", "away_id")),
                homeId = firstInt(o, listOf("home_team_id", "home_mlb_team_id", "home_id")),
                awaySpName = firstString(o, listOf("away_sp_name")),
                homeSpName = firstString(o, listOf("home_sp_name")),
                awaySpHand = firstString(o, listOf("away_sp_hand")),
                homeSpHand = firstString(o, listOf("home_sp_hand")),
                totalLine = firstDouble(o, listOf("total_line", "game_total_line")),
                f5AwayMl = firstDouble(o, listOf("f5_away_ml")),
                f5HomeMl = firstDouble(o, listOf("f5_home_ml")),
                f5TotalLine = firstDouble(o, listOf("f5_total_line")),
                isPostponed = firstBool(o, listOf("is_postponed", "postponed")),
            )

            private fun prim(o: JsonObject, key: String): JsonPrimitive? {
                val el = o[key] ?: return null
                if (el is JsonNull) return null
                return el as? JsonPrimitive
            }

            private fun firstString(o: JsonObject, keys: List<String>): String? {
                for (k in keys) {
                    val p = prim(o, k) ?: continue
                    if (p.isString) {
                        if (p.content.isNotEmpty()) return p.content
                    } else {
                        p.intOrNull?.let { return it.toString() }
                        p.doubleOrNull?.let { return it.toString() }
                    }
                }
                return null
            }

            private fun firstInt(o: JsonObject, keys: List<String>): Int? {
                for (k in keys) {
                    val p = prim(o, k) ?: continue
                    if (p.isString) {
                        p.content.toIntOrNull()?.let { if (it != 0) return it }
                    } else {
                        p.intOrNull?.let { if (it != 0) return it }
                        p.doubleOrNull?.let { val i = it.toInt(); if (i != 0) return i }
                    }
                }
                return null
            }

            private fun firstDouble(o: JsonObject, keys: List<String>): Double? {
                for (k in keys) {
                    val p = prim(o, k) ?: continue
                    if (p.isString) {
                        p.content.toDoubleOrNull()?.let { return it }
                    } else {
                        p.doubleOrNull?.let { return it }
                        p.intOrNull?.let { return it.toDouble() }
                    }
                }
                return null
            }

            private fun firstBool(o: JsonObject, keys: List<String>): Boolean? {
                for (k in keys) {
                    val p = prim(o, k) ?: continue
                    if (p.isString) {
                        val s = p.content
                        return s == "true" || s == "t" || s == "1"
                    }
                    p.booleanOrNull?.let { return it }
                    p.intOrNull?.let { return it != 0 }
                }
                return null
            }
        }
    }
}
