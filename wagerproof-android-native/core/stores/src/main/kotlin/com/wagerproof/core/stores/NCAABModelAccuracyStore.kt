package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NCAABAccuracyBucket
import com.wagerproof.core.models.NCAABModelAccuracyGame
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Port of iOS `NCAABModelAccuracyStore.swift`.
 *
 * Reads the single `ncaab_todays_games_predictions_with_accuracy` view (same
 * shape/decoder as the NBA accuracy view). The view carries no team ids or
 * logo columns, so ESPN logos + abbreviations are resolved best-effort via
 * `v_cbb_input_values` (game_id → team ids) + `ncaab_team_mapping` — a mapping
 * failure degrades to initials, never to a load error. NCAAB tables live on
 * the CFB/sports-data project → `SupabaseClients.cfb`.
 */
@Stable
class NCAABModelAccuracyStore {
    enum class SortMode { time, spread, moneyline, ou }

    var games by mutableStateOf<List<NCAABModelAccuracyGame>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set

    // Side-effecting setter (Swift `didSet` re-sorts). Backing field + explicit
    // setter avoids the JVM `private set`/`setSortMode` platform clash.
    private var _sortMode by mutableStateOf(SortMode.time)
    val sortMode: SortMode get() = _sortMode
    fun setSortMode(mode: SortMode) {
        _sortMode = mode
        games = sortGames(games, mode)
    }

    suspend fun refresh() {
        // FIDELITY-WAIVER #101: iOS DummyDataMode branch has no Android
        // equivalent — go straight to live.
        loadState = LoadState.Loading
        val cfb = SupabaseClients.cfb

        val rows: List<AccuracyRow> = try {
            cfb.from("ncaab_todays_games_predictions_with_accuracy")
                .select {
                    order("game_date", Order.ASCENDING)
                    order("tipoff_time_et", Order.ASCENDING)
                }
                .decodeList<AccuracyRow>()
        } catch (e: Exception) {
            loadState = LoadState.Failed("Failed to fetch NCAAB model accuracy")
            return
        }

        if (rows.isEmpty()) {
            games = emptyList()
            loadState = LoadState.Loaded
            return
        }

        val teamLookup = fetchTeamLookup(rows.map { it.gameId })

        val merged = rows.map { row ->
            val homeSpreadDiff: Double? =
                if (row.vegasHomeSpread != null && row.modelFairHomeSpread != null)
                    row.vegasHomeSpread - row.modelFairHomeSpread else null
            val overLineDiff: Double? =
                if (row.vegasTotal != null && row.predTotalPoints != null)
                    row.predTotalPoints - row.vegasTotal else null
            // Prefer the view's explicit winner; fall back to comparing probs
            // (the old hand-join's behavior) so the ML pick never blanks out.
            val mlPickIsHome: Boolean? = when (row.modelMlWinner) {
                "home" -> true
                "away" -> false
                else -> {
                    val h = row.homeWinProb
                    val a = row.awayWinProb
                    if (h != null && a != null) h >= a else null
                }
            }

            val awayInfo = teamLookup[row.gameId]?.away
            val homeInfo = teamLookup[row.gameId]?.home
            NCAABModelAccuracyGame(
                gameId = row.gameId,
                awayTeam = row.awayTeam ?: "",
                homeTeam = row.homeTeam ?: "",
                awayAbbr = awayInfo?.abbrev ?: initials(row.awayTeam ?: ""),
                homeAbbr = homeInfo?.abbrev ?: initials(row.homeTeam ?: ""),
                gameDate = row.gameDate ?: "",
                tipoffTime = row.tipoffTimeEt,
                homeSpread = row.vegasHomeSpread,
                homeSpreadDiff = homeSpreadDiff,
                spreadAccuracy = bucket(row.spreadAccuracyPct, row.spreadBucketGames),
                homeWinProb = row.homeWinProb,
                awayWinProb = row.awayWinProb,
                mlPickIsHome = mlPickIsHome,
                mlPickProbRounded = row.mlBucket,
                mlAccuracy = bucket(row.mlAccuracyPct, row.mlBucketGames),
                overLine = row.vegasTotal,
                overLineDiff = overLineDiff,
                ouAccuracy = bucket(row.ouAccuracyPct, row.ouBucketGames),
                awayTeamLogo = awayInfo?.logoUrl,
                homeTeamLogo = homeInfo?.logoUrl,
            )
        }

        games = sortGames(merged, _sortMode)
        loadState = LoadState.Loaded
    }

    /** Single-row lookup for the in-sheet widget. Mirrors RN `useNCAABModelAccuracyForGame`. */
    fun accuracy(forGameId: Int): NCAABModelAccuracyGame? =
        games.firstOrNull { it.gameId == forGameId }

    // MARK: - Team logo/abbrev resolution

    private data class TeamInfo(val abbrev: String?, val logoUrl: String?)
    private data class TeamPair(val away: TeamInfo?, val home: TeamInfo?)

    /**
     * Best-effort per-game team lookup: the accuracy view exposes only team
     * NAMES, so we join `v_cbb_input_values` for the api team ids and
     * `ncaab_team_mapping` for ESPN logo ids + abbreviations.
     */
    private suspend fun fetchTeamLookup(gameIds: List<Int>): Map<Int, TeamPair> {
        val cfb = SupabaseClients.cfb

        val idRows = runCatching {
            cfb.from("v_cbb_input_values")
                .select(Columns.raw("game_id, away_team_id, home_team_id")) {
                    filter { isIn("game_id", gameIds) }
                }
                .decodeList<InputIdRow>()
        }.getOrDefault(emptyList())
        if (idRows.isEmpty()) return emptyMap()

        val mappingRows = runCatching {
            cfb.from("ncaab_team_mapping")
                .select(Columns.raw("api_team_id, espn_team_id, team_abbrev"))
                .decodeList<MappingRow>()
        }.getOrDefault(emptyList())

        val teamMap = HashMap<Int, TeamInfo>()
        for (row in mappingRows) {
            val logoUrl = row.espnTeamId?.let { "https://a.espncdn.com/i/teamlogos/ncaa/500/$it.png" }
            teamMap[row.apiTeamId] = TeamInfo(abbrev = row.teamAbbrev, logoUrl = logoUrl)
        }

        val lookup = HashMap<Int, TeamPair>()
        for (row in idRows) {
            lookup[row.gameId] = TeamPair(
                away = row.awayTeamId?.let { teamMap[it] },
                home = row.homeTeamId?.let { teamMap[it] },
            )
        }
        return lookup
    }

    // MARK: - Helpers

    private fun sortGames(list: List<NCAABModelAccuracyGame>, mode: SortMode): List<NCAABModelAccuracyGame> {
        val byTime = Comparator<NCAABModelAccuracyGame> { a, b ->
            if (a.gameDate != b.gameDate) a.gameDate.compareTo(b.gameDate)
            else (a.tipoffTime ?: "").compareTo(b.tipoffTime ?: "")
        }
        return when (mode) {
            SortMode.time -> list.sortedWith(byTime)
            SortMode.spread -> list.sortedWith(
                compareByDescending<NCAABModelAccuracyGame> { it.spreadAccuracy?.accuracyPct ?: -1.0 }
                    .then(byTime)
            )
            SortMode.moneyline -> list.sortedWith(
                compareByDescending<NCAABModelAccuracyGame> { it.mlAccuracy?.accuracyPct ?: -1.0 }
                    .then(byTime)
            )
            SortMode.ou -> list.sortedWith(
                compareByDescending<NCAABModelAccuracyGame> { it.ouAccuracy?.accuracyPct ?: -1.0 }
                    .then(byTime)
            )
        }
    }

    companion object {
        private fun bucket(pct: Double?, games: Int?): NCAABAccuracyBucket? {
            if (pct == null || games == null) return null
            return NCAABAccuracyBucket(games = games, accuracyPct = pct)
        }

        /**
         * Display initials. Mirrors the Swift helper: two+ words → first char of
         * each of the first two words (case preserved); single word → first 3
         * chars uppercased.
         */
        private fun initials(team: String): String {
            val cleaned = team.replace("()", "").trim()
            val words = cleaned.split(" ").filter { it.isNotEmpty() }
            if (words.size >= 2) {
                return words.take(2).map { it.firstOrNull() ?: '?' }.joinToString("")
            }
            return cleaned.take(3).uppercase()
        }
    }

    // MARK: - Decoder structs

    /** One row of `ncaab_todays_games_predictions_with_accuracy`. */
    @Serializable
    private data class AccuracyRow(
        @SerialName("game_id") val gameId: Int,
        @SerialName("away_team") val awayTeam: String? = null,
        @SerialName("home_team") val homeTeam: String? = null,
        @SerialName("game_date") val gameDate: String? = null,
        @SerialName("tipoff_time_et") val tipoffTimeEt: String? = null,
        @SerialName("vegas_home_spread") val vegasHomeSpread: Double? = null,
        @SerialName("vegas_total") val vegasTotal: Double? = null,
        @SerialName("model_fair_home_spread") val modelFairHomeSpread: Double? = null,
        @SerialName("pred_total_points") val predTotalPoints: Double? = null,
        @SerialName("home_win_prob") val homeWinProb: Double? = null,
        @SerialName("away_win_prob") val awayWinProb: Double? = null,
        @SerialName("model_ml_winner") val modelMlWinner: String? = null,
        @SerialName("ml_bucket") val mlBucket: Double? = null,
        @SerialName("spread_accuracy_pct") val spreadAccuracyPct: Double? = null,
        @SerialName("spread_bucket_games") val spreadBucketGames: Int? = null,
        @SerialName("ou_accuracy_pct") val ouAccuracyPct: Double? = null,
        @SerialName("ou_bucket_games") val ouBucketGames: Int? = null,
        @SerialName("ml_accuracy_pct") val mlAccuracyPct: Double? = null,
        @SerialName("ml_bucket_games") val mlBucketGames: Int? = null,
    )

    @Serializable
    private data class InputIdRow(
        @SerialName("game_id") val gameId: Int,
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("away_team_id") val awayTeamId: Int? = null,
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("home_team_id") val homeTeamId: Int? = null,
    )

    @Serializable
    private data class MappingRow(
        @SerialName("api_team_id") val apiTeamId: Int,
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("espn_team_id") val espnTeamId: Int? = null,
        @SerialName("team_abbrev") val teamAbbrev: String? = null,
    )
}
