package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NBAGameTrendsData
import com.wagerproof.core.models.NBASituationalTrendRow
import com.wagerproof.core.models.parseNBARecord
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
import kotlin.math.abs
import kotlin.math.min

/**
 * Port of iOS `NBABettingTrendsStore.swift` (doc §12.1).
 *
 * NBA situational betting trends. Fetches from
 * `nba_game_situational_trends_today`; falls back to
 * `nba_game_situational_trends` when the today view is empty (matches RN).
 * After loading rows it pairs them by `team_side`, joins tipoff times from
 * `nba_input_values_view`, and computes the O/U consensus + ATS dominance
 * scores used for sorting.
 *
 * Backend queries are byte-identical to RN — select clauses, table names,
 * and post-fetch joins must NOT diverge. NBA/NCAAB tables live on the
 * CFB/sports-data project → `SupabaseClients.cfb`.
 */
@Stable
class NBABettingTrendsStore {
    enum class SortMode { time, ouConsensus, atsDominance }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var games by mutableStateOf<List<NBAGameTrendsData>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set

    /**
     * Set on every successful refresh. Drives both the TTL guard below and
     * the game sheets' first-hydrate skeleton rule (`loading && lastFetched
     * == null`). Epoch millis (matches AuthStore's `System.currentTimeMillis`).
     */
    var lastFetched by mutableStateOf<Long?>(null); private set

    private val minGamesThreshold: Int = 5
    private val minPercentage: Double = 55.0
    private val minATSDifference: Double = 10.0

    fun close() = scope.cancel()

    /** Lookup a single game by id. Mirrors RN's `useNBABettingTrendsForGame`. */
    fun trends(forGameId: Int): NBAGameTrendsData? =
        games.firstOrNull { it.gameId == forGameId }

    /**
     * Idempotent hydrate for sheet-local stores — skips the network while a
     * fetch is in flight or the slate is fresh. Mirrors
     * `MLBBettingTrendsStore.refreshIfNeeded`.
     */
    suspend fun refreshIfNeeded(maxAgeSeconds: Long = 600) {
        if (loadState is LoadState.Loading || loadState is LoadState.Refreshing) return
        lastFetched?.let {
            if (System.currentTimeMillis() - it < maxAgeSeconds * 1000L) return
        }
        refresh()
    }

    suspend fun refresh() {
        // FIDELITY-WAIVER #101: iOS DummyDataMode branch (synthesized offseason
        // trends) has no Android DummyData equivalent — skip straight to live.
        loadState = LoadState.Loading
        val cfb = SupabaseClients.cfb

        // Step 1: situational trends (today's table → fallback).
        val trendsRows: List<NBASituationalTrendRow> = try {
            val primary = runCatching {
                cfb.from("nba_game_situational_trends_today")
                    .select {
                        order("game_date", Order.ASCENDING)
                        order("game_id", Order.ASCENDING)
                    }
                    .decodeList<NBASituationalTrendRow>()
            }.getOrDefault(emptyList())
            if (primary.isNotEmpty()) {
                primary
            } else {
                // Fallback path mirrors RN.
                cfb.from("nba_game_situational_trends")
                    .select {
                        order("game_date", Order.ASCENDING)
                        order("game_id", Order.ASCENDING)
                    }
                    .decodeList<NBASituationalTrendRow>()
            }
        } catch (e: Exception) {
            loadState = LoadState.Failed("Failed to fetch NBA trends: ${e.message}")
            return
        }
        if (trendsRows.isEmpty()) {
            games = emptyList()
            loadState = LoadState.Loaded
            lastFetched = System.currentTimeMillis()
            return
        }

        // Step 2: group rows by game_id using team_side.
        val partial = LinkedHashMap<Int, Partial>()
        for (row in trendsRows) {
            val side = row.teamSide.lowercase()
            if (side != "away" && side != "home") continue
            val existing = partial.getOrPut(row.gameId) { Partial(gameDate = row.gameDate) }
            if (side == "away") existing.away = row else existing.home = row
        }

        val built: List<NBAGameTrendsData> = partial.mapNotNull { (gameId, slots) ->
            val away = slots.away ?: return@mapNotNull null
            val home = slots.home ?: return@mapNotNull null
            NBAGameTrendsData(
                gameId = gameId,
                gameDate = slots.gameDate,
                tipoffTime = null,
                awayTeam = away,
                homeTeam = home,
            )
        }

        // Step 3: tipoff times from nba_input_values_view for today's game ids.
        if (built.isNotEmpty()) {
            val gameIds = built.map { it.gameId }
            val timeRows = runCatching {
                cfb.from("nba_input_values_view")
                    .select(Columns.raw("game_id, tipoff_time_et")) {
                        filter { isIn("game_id", gameIds) }
                    }
                    .decodeList<TipoffRow>()
            }.getOrDefault(emptyList())
            val timesMap = HashMap<Int, String>()
            for (row in timeRows) { row.tipoffTimeEt?.let { timesMap[row.gameId] = it } }
            built.forEach { it.tipoffTime = timesMap[it.gameId] }
        }

        games = sortGames(built, SortMode.time)
        loadState = LoadState.Loaded
        lastFetched = System.currentTimeMillis()
    }

    // MARK: - Sort scoring (mirrors RN logic byte-for-byte)

    private fun ouConsensusStrength(game: NBAGameTrendsData): Double {
        var total = 0.0
        val a = game.awayTeam
        val h = game.homeTeam
        val buckets = listOf(
            OuBucket(a.ouLastGameOverPct, a.ouLastGameUnderPct, a.ouLastGameRecord,
                h.ouLastGameOverPct, h.ouLastGameUnderPct, h.ouLastGameRecord),
            OuBucket(a.ouFavDogOverPct, a.ouFavDogUnderPct, a.ouFavDogRecord,
                h.ouFavDogOverPct, h.ouFavDogUnderPct, h.ouFavDogRecord),
            OuBucket(a.ouSideFavDogOverPct, a.ouSideFavDogUnderPct, a.ouSideFavDogRecord,
                h.ouSideFavDogOverPct, h.ouSideFavDogUnderPct, h.ouSideFavDogRecord),
            OuBucket(a.ouRestBucketOverPct, a.ouRestBucketUnderPct, a.ouRestBucketRecord,
                h.ouRestBucketOverPct, h.ouRestBucketUnderPct, h.ouRestBucketRecord),
            OuBucket(a.ouRestCompOverPct, a.ouRestCompUnderPct, a.ouRestCompRecord,
                h.ouRestCompOverPct, h.ouRestCompUnderPct, h.ouRestCompRecord),
        )
        for (b in buckets) {
            val bothOver = (b.awayOver ?: 0.0) > minPercentage && (b.homeOver ?: 0.0) > minPercentage
            val bothUnder = (b.awayUnder ?: 0.0) > minPercentage && (b.homeUnder ?: 0.0) > minPercentage
            if (bothOver) {
                val aGames = parseNBARecord(b.awayRec).total
                val hGames = parseNBARecord(b.homeRec).total
                if (aGames >= minGamesThreshold && hGames >= minGamesThreshold) {
                    val totalGames = (aGames + hGames).toDouble()
                    val avgPct = ((b.awayOver ?: 0.0) * aGames + (b.homeOver ?: 0.0) * hGames) / totalGames
                    total += avgPct * min(aGames, hGames)
                }
            }
            if (bothUnder) {
                val aGames = parseNBARecord(b.awayRec).total
                val hGames = parseNBARecord(b.homeRec).total
                if (aGames >= minGamesThreshold && hGames >= minGamesThreshold) {
                    val totalGames = (aGames + hGames).toDouble()
                    val avgPct = ((b.awayUnder ?: 0.0) * aGames + (b.homeUnder ?: 0.0) * hGames) / totalGames
                    total += avgPct * min(aGames, hGames)
                }
            }
        }
        return total
    }

    private fun atsDominance(game: NBAGameTrendsData): Double {
        var total = 0.0
        val a = game.awayTeam
        val h = game.homeTeam
        val buckets = listOf(
            AtsBucket(a.atsLastGameCoverPct, a.atsLastGameRecord, h.atsLastGameCoverPct, h.atsLastGameRecord),
            AtsBucket(a.atsFavDogCoverPct, a.atsFavDogRecord, h.atsFavDogCoverPct, h.atsFavDogRecord),
            AtsBucket(a.atsSideFavDogCoverPct, a.atsSideFavDogRecord, h.atsSideFavDogCoverPct, h.atsSideFavDogRecord),
            AtsBucket(a.atsRestBucketCoverPct, a.atsRestBucketRecord, h.atsRestBucketCoverPct, h.atsRestBucketRecord),
            AtsBucket(a.atsRestCompCoverPct, a.atsRestCompRecord, h.atsRestCompCoverPct, h.atsRestCompRecord),
        )
        for (b in buckets) {
            val aPct = b.awayPct ?: continue
            val hPct = b.homePct ?: continue
            val aGames = parseNBARecord(b.awayRec).total
            val hGames = parseNBARecord(b.homeRec).total
            val minGames = min(aGames, hGames)
            if (minGames >= minGamesThreshold) {
                val diff = abs(aPct - hPct)
                if (diff > minATSDifference) {
                    total += diff * minGames
                }
            }
        }
        return total
    }

    private fun sortGames(list: List<NBAGameTrendsData>, mode: SortMode): List<NBAGameTrendsData> =
        when (mode) {
            // NBA computes scores on demand at sort time (NOT cached on the model,
            // unlike the NCAAB/MLB siblings).
            SortMode.ouConsensus -> list.sortedByDescending { ouConsensusStrength(it) }
            SortMode.atsDominance -> list.sortedByDescending { atsDominance(it) }
            SortMode.time -> list.sortedWith(TIME_COMPARATOR)
        }

    private class Partial(
        var away: NBASituationalTrendRow? = null,
        var home: NBASituationalTrendRow? = null,
        val gameDate: String,
    )

    private data class OuBucket(
        val awayOver: Double?, val awayUnder: Double?, val awayRec: String?,
        val homeOver: Double?, val homeUnder: Double?, val homeRec: String?,
    )

    private data class AtsBucket(
        val awayPct: Double?, val awayRec: String?, val homePct: Double?, val homeRec: String?,
    )

    @Serializable
    private data class TipoffRow(
        @SerialName("game_id") val gameId: Int,
        @SerialName("tipoff_time_et") val tipoffTimeEt: String? = null,
    )

    companion object {
        /** some-tipoff-before-none, else compare tipoff string, else gameDate. */
        private val TIME_COMPARATOR = Comparator<NBAGameTrendsData> { a, b ->
            val aT = a.tipoffTime
            val bT = b.tipoffTime
            when {
                aT != null && bT != null -> aT.compareTo(bT)
                aT != null && bT == null -> -1
                aT == null && bT != null -> 1
                else -> a.gameDate.compareTo(b.gameDate)
            }
        }
    }
}
