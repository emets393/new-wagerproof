package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NBAAccuracyBucket
import com.wagerproof.core.models.NBAModelAccuracyData
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Port of iOS `NBAModelAccuracyStore.swift`.
 *
 * NBA model-accuracy store (RN `useNBAModelAccuracy` +
 * `useModelAccuracyForGame`). Pulls
 * `nba_todays_games_predictions_with_accuracy` once and caches the resulting
 * `Map<Int, NBAModelAccuracyData>` keyed by `game_id`. NBA tables live on the
 * CFB/sports-data project → `SupabaseClients.cfb`.
 */
@Stable
class NBAModelAccuracyStore {
    enum class SortMode { time, spread, moneyline, ou }

    var accuracyById by mutableStateOf<Map<Int, NBAModelAccuracyData>>(emptyMap()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var sortMode by mutableStateOf(SortMode.time)

    /** Sorted view of the cache; recomposes on both cache and [sortMode] change. */
    val games: List<NBAModelAccuracyData>
        get() = sorted(accuracyById.values.toList(), sortMode)

    fun accuracy(gameId: Int): NBAModelAccuracyData? = accuracyById[gameId]

    suspend fun refresh(force: Boolean = false) {
        if (loadState is LoadState.Loading) return
        if (loadState is LoadState.Loaded && !force && accuracyById.isNotEmpty()) return
        // FIDELITY-WAIVER #101: iOS DummyDataMode branch has no Android
        // equivalent — go straight to live.
        loadState = LoadState.Loading
        try {
            val cfb = SupabaseClients.cfb
            val rows: List<AccuracyRow> = cfb
                .from("nba_todays_games_predictions_with_accuracy")
                .select {
                    order("game_date", Order.ASCENDING)
                    order("tipoff_time_et", Order.ASCENDING)
                }
                .decodeList<AccuracyRow>()

            val map = LinkedHashMap<Int, NBAModelAccuracyData>()
            for (row in rows) {
                val vegasHomeSpread = row.vegasHomeSpread
                val vegasTotal = row.vegasTotal
                val modelFair = row.modelFairHomeSpread
                val predTotal = row.predTotalPoints
                val homeSpreadDiff: Double? =
                    if (vegasHomeSpread != null && modelFair != null) vegasHomeSpread - modelFair else null
                val overLineDiff: Double? =
                    if (vegasTotal != null && predTotal != null) predTotal - vegasTotal else null
                val mlPickIsHome: Boolean? = when (row.modelMlWinner) {
                    "home" -> true
                    "away" -> false
                    else -> null
                }
                val spreadAcc = bucket(row.spreadAccuracyPct, row.spreadBucketGames)
                val ouAcc = bucket(row.ouAccuracyPct, row.ouBucketGames)
                val mlAcc = bucket(row.mlAccuracyPct, row.mlBucketGames)

                map[row.gameId] = NBAModelAccuracyData(
                    gameId = row.gameId,
                    awayTeam = row.awayTeam ?: "",
                    homeTeam = row.homeTeam ?: "",
                    awayAbbr = row.awayTeam?.let { initials(it) } ?: "",
                    homeAbbr = row.homeTeam?.let { initials(it) } ?: "",
                    gameDate = row.gameDate ?: "",
                    tipoffTime = row.tipoffTimeEt,
                    homeSpread = vegasHomeSpread,
                    homeSpreadDiff = homeSpreadDiff,
                    spreadAccuracy = spreadAcc,
                    homeWinProb = row.homeWinProb,
                    awayWinProb = row.awayWinProb,
                    mlPickIsHome = mlPickIsHome,
                    mlPickProbRounded = row.mlBucket,
                    mlAccuracy = mlAcc,
                    overLine = vegasTotal,
                    overLineDiff = overLineDiff,
                    ouAccuracy = ouAcc,
                )
            }
            accuracyById = map
            loadState = LoadState.Loaded
        } catch (e: Exception) {
            loadState = LoadState.Failed("Failed to fetch NBA model accuracy")
        }
    }

    private fun sorted(list: List<NBAModelAccuracyData>, mode: SortMode): List<NBAModelAccuracyData> {
        val byTime = Comparator<NBAModelAccuracyData> { a, b ->
            if (a.gameDate != b.gameDate) a.gameDate.compareTo(b.gameDate)
            else (a.tipoffTime ?: "").compareTo(b.tipoffTime ?: "")
        }
        return when (mode) {
            SortMode.time -> list.sortedWith(byTime)
            SortMode.spread -> list.sortedByDescending { it.spreadAccuracy?.accuracyPct ?: -1.0 }
            SortMode.moneyline -> list.sortedByDescending { it.mlAccuracy?.accuracyPct ?: -1.0 }
            SortMode.ou -> list.sortedByDescending { it.ouAccuracy?.accuracyPct ?: -1.0 }
        }
    }

    companion object {
        private fun bucket(pct: Double?, games: Int?): NBAAccuracyBucket? {
            if (pct == null || games == null) return null
            return NBAAccuracyBucket(games = games, accuracyPct = pct)
        }

        /**
         * Display initials. Mirrors RN's `getNBATeamInitials(name)` — first
         * letter of the last word, or the first 3 letters for a single word.
         */
        private fun initials(team: String): String {
            val words = team.split(" ").filter { it.isNotEmpty() }
            if (words.size >= 2) return words.last().uppercase()
            return team.take(3).uppercase()
        }
    }

    /** One row of `nba_todays_games_predictions_with_accuracy`. */
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
}
