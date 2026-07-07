package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBPlayerPropBestPick
import com.wagerproof.core.models.MLBPlayerPropGrade
import com.wagerproof.core.models.MLBPlayerPropGradeSummary
import com.wagerproof.core.models.MLBPlayerPropPerformanceTotals
import com.wagerproof.core.models.MLBPlayerPropPickKind
import com.wagerproof.core.models.MLBPlayerPropPickTier
import com.wagerproof.core.models.MLBPlayerPropTierSummary
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.MLBPlayerPropPicksService
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

/**
 * Best Picks Report state — today's locked picks + graded performance archive.
 * Port of iOS `MLBPlayerPropPicksStore.swift` (mirrors web `/mlb/picks-report`
 * + `/mlb/picks-performance`). 5-minute cache TTL.
 *
 * No coroutine scope — `refresh()` is a suspend fn called from the view.
 */
@Stable
class MLBPlayerPropPicksStore(
    private val service: MLBPlayerPropPicksService = MLBPlayerPropPicksService.shared,
) {
    var todaysPicks by mutableStateOf<List<MLBPlayerPropBestPick>>(emptyList()); private set
    var summary by mutableStateOf<List<MLBPlayerPropGradeSummary>>(emptyList()); private set
    var history by mutableStateOf<List<MLBPlayerPropGrade>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var lastFetched by mutableStateOf<Long?>(null); private set

    private val cacheTtlMs: Long = 5 * 60 * 1000

    val overall: MLBPlayerPropPerformanceTotals
        get() = MLBPlayerPropPerformanceTotals.aggregate(summary)

    val tierGroups: List<MLBPlayerPropTierSummary>
        get() {
            val order = MLBPlayerPropPickTier.entries
            val map = LinkedHashMap<MLBPlayerPropPickTier, MutableList<MLBPlayerPropGradeSummary>>()
            for (row in summary) {
                map.getOrPut(row.tier) { mutableListOf() }.add(row)
            }
            return order.mapNotNull { tier ->
                val rows = map[tier]
                if (rows.isNullOrEmpty()) return@mapNotNull null
                val sorted = rows.sortedByDescending { it.unitsWon ?: 0.0 }
                MLBPlayerPropTierSummary(
                    tier = tier,
                    totals = MLBPlayerPropPerformanceTotals.aggregate(sorted),
                    markets = sorted,
                )
            }
        }

    val batterPicks: List<MLBPlayerPropBestPick>
        get() = todaysPicks.filter { it.kind == MLBPlayerPropPickKind.BATTER }

    val pitcherPicks: List<MLBPlayerPropBestPick>
        get() = todaysPicks.filter { it.kind == MLBPlayerPropPickKind.PITCHER }

    /** Most recent graded picks (newest first, capped at 10). */
    val recentHistory: List<MLBPlayerPropGrade>
        get() = history.take(10)

    suspend fun refreshIfStale(force: Boolean = false) {
        val last = lastFetched
        if (!force && last != null &&
            System.currentTimeMillis() - last < cacheTtlMs &&
            loadState is LoadState.Loaded
        ) {
            return
        }
        refresh(force = force)
    }

    suspend fun refreshSummaryOnly(force: Boolean = false) {
        val last = lastFetched
        if (!force && last != null &&
            System.currentTimeMillis() - last < cacheTtlMs &&
            summary.isNotEmpty()
        ) {
            return
        }
        try {
            summary = service.fetchGradeSummary()
            lastFetched = System.currentTimeMillis()
        } catch (e: Exception) {
            // Non-fatal for the banner — full page shows errors.
        }
    }

    suspend fun refresh(force: Boolean = false) {
        val last = lastFetched
        if (!force && last != null &&
            System.currentTimeMillis() - last < cacheTtlMs &&
            loadState is LoadState.Loaded
        ) {
            return
        }
        loadState = LoadState.Loading
        val reportDate = MLBPlayerPropPicksService.todayET()
        try {
            coroutineScope {
                val picksTask = async { service.fetchTodaysPicks(reportDate) }
                val summaryTask = async { service.fetchGradeSummary() }
                val historyTask = async { service.fetchGradeHistory(limit = 10) }
                val picks = picksTask.await()
                val summaryRows = summaryTask.await()
                val historyRows = historyTask.await()
                todaysPicks = picks.sortedWith(
                    compareBy<MLBPlayerPropBestPick> { it.tier.sortRank }
                        .thenByDescending { it.score },
                )
                summary = summaryRows
                history = historyRows
            }
            lastFetched = System.currentTimeMillis()
            loadState = LoadState.Loaded
        } catch (e: Exception) {
            loadState = LoadState.Failed("Couldn't load Best Picks data.")
        }
    }

    fun debugSet(
        picks: List<MLBPlayerPropBestPick>,
        summary: List<MLBPlayerPropGradeSummary>,
        history: List<MLBPlayerPropGrade>,
    ) {
        if (!BuildFlags.isDebugBuild) return
        this.todaysPicks = picks
        this.summary = summary
        this.history = history
        this.loadState = LoadState.Loaded
        this.lastFetched = System.currentTimeMillis()
    }
}
