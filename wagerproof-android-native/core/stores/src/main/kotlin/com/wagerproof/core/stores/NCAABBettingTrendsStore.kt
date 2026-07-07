package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NCAABGameTrendsData
import com.wagerproof.core.models.NCAABSituationalTrendRow
import com.wagerproof.core.models.parseNCAABRecord
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
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
 * Port of iOS `NCAABBettingTrendsStore.swift`. Near-twin of
 * [NBABettingTrendsStore] — see it for the shared structure. NCAAB adds team
 * logos (joined from `ncaab_team_mapping`), pulls tipoff from
 * `v_cbb_input_values` (`start_utc ?? tipoff_time_et`), and pre-computes the
 * two sort scores onto the model (NBA computes them on demand).
 *
 * Fetches from `ncaab_game_situational_trends_today`; falls back to
 * `ncaab_game_situational_trends` when the today view is empty (matches RN).
 *
 * The O/U-consensus + ATS-dominance scoring math must produce identical scores
 * to iOS — transcribed byte-for-byte from the Swift store. NCAAB tables live on
 * the CFB/sports-data project → `SupabaseClients.cfb`.
 */
@Stable
class NCAABBettingTrendsStore {
    enum class SortMode { time, ouConsensus, atsDominance }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var games by mutableStateOf<List<NCAABGameTrendsData>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set

    /**
     * Set on every successful refresh. Drives the TTL guard below and the game
     * sheets' first-hydrate skeleton rule (`loading && lastFetched == null`).
     * Epoch millis (matches sibling stores' `System.currentTimeMillis`).
     */
    var lastFetched by mutableStateOf<Long?>(null); private set

    private val minGamesThreshold: Int = 5
    private val minPercentage: Double = 55.0
    private val minATSDifference: Double = 10.0

    fun close() = scope.cancel()

    /** Lookup a single game by id. Mirrors RN `useNCAABBettingTrendsForGame`. */
    fun trends(forGameId: Int): NCAABGameTrendsData? =
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
        // FIDELITY-WAIVER #101: iOS DummyDataMode branch has no Android
        // equivalent — go straight to live.
        loadState = LoadState.Loading
        val cfb = SupabaseClients.cfb

        // Step 1: situational trends (today's table → fallback).
        val trendsRows: List<NCAABSituationalTrendRow> = try {
            val primary = runCatching {
                cfb.from("ncaab_game_situational_trends_today")
                    .select {
                        order("game_date", Order.ASCENDING)
                        order("game_id", Order.ASCENDING)
                    }
                    .decodeList<NCAABSituationalTrendRow>()
            }.getOrDefault(emptyList())
            if (primary.isNotEmpty()) {
                primary
            } else {
                cfb.from("ncaab_game_situational_trends")
                    .select {
                        order("game_date", Order.ASCENDING)
                        order("game_id", Order.ASCENDING)
                    }
                    .decodeList<NCAABSituationalTrendRow>()
            }
        } catch (e: Exception) {
            loadState = LoadState.Failed("Failed to fetch NCAAB trends: ${e.message}")
            return
        }
        if (trendsRows.isEmpty()) {
            games = emptyList()
            loadState = LoadState.Loaded
            lastFetched = System.currentTimeMillis()
            return
        }

        // Step 2: team logos.
        val mappingRows = runCatching {
            cfb.from("ncaab_team_mapping")
                .select(Columns.raw("api_team_id, espn_team_id"))
                .decodeList<MappingRow>()
        }.getOrDefault(emptyList())
        val teamLogoMap = HashMap<Int, String?>()
        for (row in mappingRows) {
            val espnId = row.espnTeamId
            val logo = espnId?.let { "https://a.espncdn.com/i/teamlogos/ncaa/500/$it.png" }
            teamLogoMap[row.apiTeamId] = logo
        }

        // Step 3: group rows by game_id using team_side.
        val partial = LinkedHashMap<Int, Partial>()
        for (row in trendsRows) {
            val side = row.teamSide.lowercase()
            if (side != "away" && side != "home") continue
            val logo = teamLogoMap[row.apiTeamId]
            val existing = partial.getOrPut(row.gameId) { Partial(gameDate = row.gameDate) }
            if (side == "away") {
                existing.away = row
                existing.awayLogo = logo
            } else {
                existing.home = row
                existing.homeLogo = logo
            }
        }

        var built: List<NCAABGameTrendsData> = partial.mapNotNull { (gameId, slots) ->
            val away = slots.away ?: return@mapNotNull null
            val home = slots.home ?: return@mapNotNull null
            NCAABGameTrendsData(
                gameId = gameId,
                gameDate = slots.gameDate,
                tipoffTime = null,
                awayTeam = away,
                homeTeam = home,
                awayTeamLogo = slots.awayLogo,
                homeTeamLogo = slots.homeLogo,
            )
        }

        // Step 4: tipoff times from v_cbb_input_values for today's game ids.
        if (built.isNotEmpty()) {
            val gameIds = built.map { it.gameId }
            val timeRows = runCatching {
                cfb.from("v_cbb_input_values")
                    .select(Columns.raw("game_id, start_utc, tipoff_time_et")) {
                        filter { isIn("game_id", gameIds) }
                    }
                    .decodeList<TimeRow>()
            }.getOrDefault(emptyList())
            val timesMap = HashMap<Int, String?>()
            for (row in timeRows) { timesMap[row.gameId] = row.startUtc ?: row.tipoffTimeEt }
            built = built.map { it.copy(tipoffTime = timesMap[it.gameId]) }
        }

        // Step 5: pre-compute sort scores per game.
        built = built.map {
            it.copy(
                ouConsensusScore = ouConsensusStrength(it),
                atsDominanceScore = atsDominance(it),
            )
        }

        games = sortGames(built, SortMode.time)
        loadState = LoadState.Loaded
        lastFetched = System.currentTimeMillis()
    }

    // MARK: - Sort scoring (mirrors RN logic byte-for-byte)

    private fun ouConsensusStrength(game: NCAABGameTrendsData): Double {
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
                val aGames = parseNCAABRecord(b.awayRec).total
                val hGames = parseNCAABRecord(b.homeRec).total
                if (aGames >= minGamesThreshold && hGames >= minGamesThreshold) {
                    val totalGames = (aGames + hGames).toDouble()
                    val avgPct = ((b.awayOver ?: 0.0) * aGames + (b.homeOver ?: 0.0) * hGames) / totalGames
                    total += avgPct * min(aGames, hGames)
                }
            }
            if (bothUnder) {
                val aGames = parseNCAABRecord(b.awayRec).total
                val hGames = parseNCAABRecord(b.homeRec).total
                if (aGames >= minGamesThreshold && hGames >= minGamesThreshold) {
                    val totalGames = (aGames + hGames).toDouble()
                    val avgPct = ((b.awayUnder ?: 0.0) * aGames + (b.homeUnder ?: 0.0) * hGames) / totalGames
                    total += avgPct * min(aGames, hGames)
                }
            }
        }
        return total
    }

    private fun atsDominance(game: NCAABGameTrendsData): Double {
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
            val aGames = parseNCAABRecord(b.awayRec).total
            val hGames = parseNCAABRecord(b.homeRec).total
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

    private fun sortGames(list: List<NCAABGameTrendsData>, mode: SortMode): List<NCAABGameTrendsData> =
        when (mode) {
            SortMode.ouConsensus -> list.sortedByDescending { it.ouConsensusScore ?: 0.0 }
            SortMode.atsDominance -> list.sortedByDescending { it.atsDominanceScore ?: 0.0 }
            SortMode.time -> list.sortedWith(TIME_COMPARATOR)
        }

    private class Partial(
        var away: NCAABSituationalTrendRow? = null,
        var home: NCAABSituationalTrendRow? = null,
        var awayLogo: String? = null,
        var homeLogo: String? = null,
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
    private data class MappingRow(
        @SerialName("api_team_id") val apiTeamId: Int,
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("espn_team_id") val espnTeamId: Int? = null,
    )

    @Serializable
    private data class TimeRow(
        @SerialName("game_id") val gameId: Int,
        @SerialName("start_utc") val startUtc: String? = null,
        @SerialName("tipoff_time_et") val tipoffTimeEt: String? = null,
    )

    companion object {
        /** some-tipoff-before-none, else compare tipoff string, else gameDate. */
        private val TIME_COMPARATOR = Comparator<NCAABGameTrendsData> { a, b ->
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
