package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBModelBreakdownRow
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns

/**
 * Loads `mlb_model_breakdown_accuracy` (refreshed nightly server-side): model
 * record/ROI per bet type split by team and by day-of-week. Port of iOS
 * `MLBModelBreakdownStore.swift` (mirrors RN `hooks/useMLBModelBreakdownAccuracy.ts`).
 * Feeds both the breakdown tables and the per-pick alignment boxes on the
 * regression report. 15-minute stale window.
 *
 * No coroutine scope — `refresh()` is a suspend fn called from the view.
 */
@Stable
class MLBModelBreakdownStore {
    var rows by mutableStateOf<List<MLBModelBreakdownRow>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var lastFetched by mutableStateOf<Long?>(null); private set

    /** 15-minute stale window — matches RN `staleTime: 15 * 60 * 1000`. */
    private val staleWindowMs: Long = 15 * 60 * 1000

    suspend fun refreshIfStale(force: Boolean = false) {
        val last = lastFetched
        if (!force && last != null && System.currentTimeMillis() - last < staleWindowMs) return
        refresh()
    }

    suspend fun refresh() {
        loading = true
        errorMessage = null
        try {
            val cfb = SupabaseClients.cfb
            val fetched: List<MLBModelBreakdownRow> = cfb
                .from("mlb_model_breakdown_accuracy")
                .select(
                    columns = Columns.raw(
                        "bet_type, breakdown_type, breakdown_value, games, wins, losses, " +
                            "pushes, units_won, win_pct, roi_pct",
                    ),
                )
                .decodeList()
            rows = fetched
            lastFetched = System.currentTimeMillis()
        } catch (e: Exception) {
            errorMessage = "Failed to load model breakdown."
        }
        loading = false
    }

    /** "By Team" rows for a bet type, ranked best ROI first (RN parity). */
    fun teamRows(betType: String): List<MLBModelBreakdownRow> =
        rows.filter { it.betType == betType && it.breakdownType == "team" }
            .sortedByDescending { it.roiPct }

    /** "By Day of Week" rows for a bet type, Mon..Sun (RN parity). */
    fun dowRows(betType: String): List<MLBModelBreakdownRow> {
        val order = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        return rows.filter { it.betType == betType && it.breakdownType == "dow" }
            .sortedBy { order.indexOf(it.breakdownValue).let { i -> if (i < 0) 7 else i } }
    }

    fun debugSet(rows: List<MLBModelBreakdownRow>) {
        if (!BuildFlags.isDebugBuild) return
        this.rows = rows
        this.lastFetched = System.currentTimeMillis()
    }
}
