package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBGameTrends
import com.wagerproof.core.models.MLBSituationalTrendRow
import com.wagerproof.core.models.MLBTrendsSortMode
import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.OffsetDateTime
import kotlin.math.abs

/**
 * Loads + caches the MLB situational betting trends slate. 1:1 port of iOS
 * `MLBBettingTrendsStore.swift` (mirrors RN `hooks/useMLBBettingTrends.ts`):
 *   1. `mlb_situational_trends_today` (sorted date asc, game_pk asc)
 *   2. Fallback to `mlb_situational_trends` when today's table is empty
 *   3. Join `mlb_games_today.game_time_et` by `game_pk`
 * Sorting modes (time | ou-consensus | ml-dominance) reuse the same
 * percentages-pairs algorithm as the web app.
 */
@Stable
class MLBBettingTrendsStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var games by mutableStateOf<List<MLBGameTrends>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var lastFetched by mutableStateOf<Long?>(null); private set

    fun close() = scope.cancel()

    /** Per-game lookup for the MLB game-sheet widget. */
    fun trends(gamePk: Int): MLBGameTrends? = games.firstOrNull { it.gamePk == gamePk }

    /**
     * Idempotent hydrate — skips the network while a fetch is in flight or when
     * the slate is fresh, so carousel swipes don't refetch the trends view.
     * [maxAge] is in seconds (default 600), matching the Swift TimeInterval.
     */
    suspend fun refreshIfNeeded(maxAge: Long = 600) {
        if (loading) return
        val last = lastFetched
        if (last != null && System.currentTimeMillis() - last < maxAge * 1000) return
        refresh()
    }

    suspend fun refresh() {
        loading = true
        errorMessage = null
        try {
            val cfb = SupabaseClients.cfb
            // Primary: today's slate.
            var rows: List<MLBSituationalTrendRow> = runCatching {
                cfb.from("mlb_situational_trends_today")
                    .select {
                        order("game_date_et", Order.ASCENDING)
                        order("game_pk", Order.ASCENDING)
                    }
                    .decodeList<MLBSituationalTrendRow>()
            }.getOrDefault(emptyList())

            if (rows.isEmpty()) {
                rows = runCatching {
                    cfb.from("mlb_situational_trends")
                        .select {
                            order("game_date_et", Order.ASCENDING)
                            order("game_pk", Order.ASCENDING)
                        }
                        .decodeList<MLBSituationalTrendRow>()
                }.getOrDefault(emptyList())
            }

            if (rows.isEmpty()) {
                games = emptyList()
                lastFetched = System.currentTimeMillis()
                return
            }

            // Bucket by game_pk, picking the right side per row.
            val buckets = LinkedHashMap<Int, Bucket>()
            for (r in rows) {
                if (r.teamSide != "away" && r.teamSide != "home") continue
                val entry = buckets.getOrPut(r.gamePk) { Bucket(gameDate = r.gameDateEt) }
                entry.gameDate = r.gameDateEt
                if (r.teamSide == "away") entry.away = r else entry.home = r
            }

            var combined = mutableListOf<MLBGameTrends>()
            for ((pk, entry) in buckets) {
                val away = entry.away ?: continue
                val home = entry.home ?: continue
                if (away.teamName.isEmpty() || home.teamName.isEmpty()) continue
                combined.add(
                    MLBGameTrends(
                        gamePk = pk,
                        gameDateEt = entry.gameDate,
                        gameTimeEt = null,
                        awayTeam = away,
                        homeTeam = home,
                    ),
                )
            }

            // Pull game_time_et from `mlb_games_today` for the trends slate.
            val pks = combined.map { it.gamePk }
            if (pks.isNotEmpty()) {
                val timeRows: List<TimeRow> = runCatching {
                    cfb.from("mlb_games_today")
                        .select(columns = Columns.raw("game_pk, game_time_et")) {
                            filter { isIn("game_pk", pks) }
                        }
                        .decodeList<TimeRow>()
                }.getOrDefault(emptyList())
                val timeByPk = timeRows.associate { it.gamePk to it.gameTimeEt }
                combined.forEach { it.gameTimeEt = timeByPk[it.gamePk] }
            }

            // Compute consensus scores per game (same algorithm as RN).
            combined.forEach { game ->
                game.ouConsensusScore = calculateOUConsensus(game)
                game.mlDominanceScore = calculateMLDominance(game)
            }

            games = sortGames(combined, MLBTrendsSortMode.TIME)
            lastFetched = System.currentTimeMillis()
        } finally {
            loading = false
        }
    }

    private class Bucket(
        var gameDate: String,
        var away: MLBSituationalTrendRow? = null,
        var home: MLBSituationalTrendRow? = null,
    )

    @Serializable
    private data class TimeRow(
        @Serializable(with = FlexibleIntOrZeroSerializer::class)
        @SerialName("game_pk") val gamePk: Int = 0,
        @SerialName("game_time_et") val gameTimeEt: String? = null,
    )

    fun debugSet(games: List<MLBGameTrends>) {
        if (!BuildFlags.isDebugBuild) return
        this.games = games
        this.lastFetched = System.currentTimeMillis()
    }

    // MARK: - Scoring + sorting (byte-identical to RN)

    companion object {
        private const val MIN_DIFF: Double = 10.0

        private fun toPct(value: Double?): Double? {
            val v = value ?: return null
            if (v > 0 && v < 1) return v * 100
            return v
        }

        private fun winPctPairs(g: MLBGameTrends): List<Pair<Double?, Double?>> = listOf(
            toPct(g.awayTeam.winPctLastGame) to toPct(g.homeTeam.winPctLastGame),
            toPct(g.awayTeam.winPctHomeAway) to toPct(g.homeTeam.winPctHomeAway),
            toPct(g.awayTeam.winPctFavDog) to toPct(g.homeTeam.winPctFavDog),
            toPct(g.awayTeam.winPctRestBucket) to toPct(g.homeTeam.winPctRestBucket),
            toPct(g.awayTeam.winPctRestComp) to toPct(g.homeTeam.winPctRestComp),
            toPct(g.awayTeam.winPctLeague) to toPct(g.homeTeam.winPctLeague),
            toPct(g.awayTeam.winPctDivision) to toPct(g.homeTeam.winPctDivision),
        )

        private fun overPctPairs(g: MLBGameTrends): List<Pair<Double?, Double?>> = listOf(
            toPct(g.awayTeam.overPctLastGame) to toPct(g.homeTeam.overPctLastGame),
            toPct(g.awayTeam.overPctHomeAway) to toPct(g.homeTeam.overPctHomeAway),
            toPct(g.awayTeam.overPctFavDog) to toPct(g.homeTeam.overPctFavDog),
            toPct(g.awayTeam.overPctRestBucket) to toPct(g.homeTeam.overPctRestBucket),
            toPct(g.awayTeam.overPctRestComp) to toPct(g.homeTeam.overPctRestComp),
            toPct(g.awayTeam.overPctLeague) to toPct(g.homeTeam.overPctLeague),
            toPct(g.awayTeam.overPctDivision) to toPct(g.homeTeam.overPctDivision),
        )

        fun calculateOUConsensus(game: MLBGameTrends): Double {
            var total = 0.0
            for ((a, h) in overPctPairs(game)) {
                if (a != null && h != null) {
                    if (a > 55 && h > 55) total += a + h
                    if (a < 45 && h < 45) total += 200 - a - h
                }
            }
            return total
        }

        fun calculateMLDominance(game: MLBGameTrends): Double {
            var total = 0.0
            for ((a, h) in winPctPairs(game)) {
                if (a != null && h != null && abs(a - h) >= MIN_DIFF) {
                    total += abs(a - h)
                }
            }
            return total
        }

        fun sortGames(list: List<MLBGameTrends>, mode: MLBTrendsSortMode): List<MLBGameTrends> =
            when (mode) {
                MLBTrendsSortMode.OU_CONSENSUS ->
                    list.sortedWith(compareByDescending { it.ouConsensusScore })
                MLBTrendsSortMode.ML_DOMINANCE ->
                    list.sortedWith(compareByDescending { it.mlDominanceScore })
                MLBTrendsSortMode.TIME -> list.sortedWith(TimeComparator)
            }

        private val TimeComparator = Comparator<MLBGameTrends> { a, b ->
            val la = a.gameTimeEt
            val lb = b.gameTimeEt
            when {
                la != null && lb != null -> parseDate(la).compareTo(parseDate(lb))
                la != null && lb == null -> -1 // some-before-none
                la == null && lb != null -> 1
                else -> a.gameDateEt.compareTo(b.gameDateEt)
            }
        }

        private fun parseDate(s: String): Double =
            runCatching { OffsetDateTime.parse(s).toEpochSecond().toDouble() }
                .getOrDefault(Double.MAX_VALUE)
    }
}
