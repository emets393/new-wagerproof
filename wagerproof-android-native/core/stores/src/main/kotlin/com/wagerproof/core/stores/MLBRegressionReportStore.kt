package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBRegressionReport
import com.wagerproof.core.models.MLBSuggestedPick
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import java.time.LocalDate
import java.time.ZoneId

/**
 * Loads + caches the daily `mlb_regression_report` row. Port of iOS
 * `MLBRegressionReportStore.swift` (mirrors RN `hooks/useMLBRegressionReport.ts`).
 * One row per day in ET timezone; the cache is re-keyed by the current ET date.
 * 5-minute stale window.
 *
 * Owns a scope purely to coalesce overlapping refresh calls (the equivalent of
 * the Swift `inFlightRefresh: Task`) — call [close] when the store is discarded.
 */
@Stable
class MLBRegressionReportStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var report by mutableStateOf<MLBRegressionReport?>(null); private set
    var loading by mutableStateOf(false); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var lastFetchedKey by mutableStateOf<String?>(null); private set

    /** 5-minute stale window — matches RN `staleTime: 5 * 60 * 1000`. */
    private val staleWindowMs: Long = 5 * 60 * 1000
    private var lastFetched: Long? = null

    /** Coalesces overlapping load / pull-to-refresh / toolbar refresh calls. */
    private var inFlightRefresh: Deferred<Unit>? = null

    fun close() = scope.cancel()

    suspend fun refreshIfStale(force: Boolean = false) {
        val today = todayInET()
        val last = lastFetched
        if (!force && lastFetchedKey == today && last != null &&
            System.currentTimeMillis() - last < staleWindowMs
        ) {
            return
        }
        refresh()
    }

    suspend fun refresh() {
        inFlightRefresh?.let {
            it.await()
            return
        }
        val task = scope.async { performRefresh() }
        inFlightRefresh = task
        try {
            task.await()
        } finally {
            inFlightRefresh = null
        }
    }

    private suspend fun performRefresh() {
        loading = true
        errorMessage = null
        val today = todayInET()
        try {
            val cfb = SupabaseClients.cfb
            // RN uses `maybeSingle()` — fetch as a list and take the first row so
            // a missing report returns null instead of throwing.
            val rows: List<MLBRegressionReport> = cfb
                .from("mlb_regression_report")
                .select {
                    filter { eq("report_date", today) }
                    limit(1)
                }
                .decodeList()
            report = rows.firstOrNull()
            lastFetchedKey = today
            lastFetched = System.currentTimeMillis()
            errorMessage = null
        } catch (e: Exception) {
            // Preserve a previously loaded report (matches the other MLB stores)
            // so a stale-window re-fetch doesn't wipe a good payload.
            if (report == null) {
                errorMessage = "Failed to load regression report."
            }
        } finally {
            loading = false
        }
    }

    /**
     * Picks generated for the given `game_pk`. Mirrors the
     * `MLBRegressionPicksSection` filter in RN.
     */
    fun suggestedPicks(gamePk: Int): List<MLBSuggestedPick> =
        (report?.suggestedPicks ?: emptyList()).filter { it.gamePk == gamePk }

    fun debugSet(report: MLBRegressionReport) {
        if (!BuildFlags.isDebugBuild) return
        this.report = report
        this.lastFetchedKey = todayInET()
        this.lastFetched = System.currentTimeMillis()
    }

    companion object {
        private val ET: ZoneId = ZoneId.of("America/New_York")

        fun todayInET(): String = LocalDate.now(ET).toString()
    }
}
