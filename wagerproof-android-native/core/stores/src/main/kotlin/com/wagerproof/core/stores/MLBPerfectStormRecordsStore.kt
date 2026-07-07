package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBPerfectStormRecord
import com.wagerproof.core.models.MLBPerfectStormRecords
import com.wagerproof.core.models.MLBPerfectStormTier
import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.ceil
import kotlin.math.floor

/**
 * Season-to-date W-L + ROI per Perfect Storm tier (hammer / ps / lean /
 * watch), aggregated client-side from `mlb_graded_picks`. Port of iOS
 * `MLBPerfectStormRecordsStore.swift` (mirrors RN `hooks/useMLBPerfectStormRecords.ts`)
 * — same rounding, same null win% when a tier has no graded picks.
 * 10-minute stale window.
 *
 * No coroutine scope — `refresh()` is a suspend fn called from the view.
 */
@Stable
class MLBPerfectStormRecordsStore {
    var records by mutableStateOf<MLBPerfectStormRecords?>(null); private set
    var loading by mutableStateOf(false); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var lastFetched by mutableStateOf<Long?>(null); private set

    /** 10-minute stale window — matches RN `staleTime: 10 * 60 * 1000`. */
    private val staleWindowMs: Long = 10 * 60 * 1000

    @Serializable
    private data class GradedPickRow(
        @SerialName("perfect_storm_tier") val perfectStormTier: String? = null,
        val result: String? = null,
        @Serializable(with = FlexibleDoubleSerializer::class)
        @SerialName("units_won") val unitsWon: Double? = null,
    )

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
            val rows: List<GradedPickRow> = cfb
                .from("mlb_graded_picks")
                .select(columns = Columns.raw("perfect_storm_tier, result, units_won")) {
                    filter { isIn("perfect_storm_tier", listOf("hammer", "ps", "lean", "watch")) }
                }
                .decodeList()
            records = aggregate(rows)
            lastFetched = System.currentTimeMillis()
        } catch (e: Exception) {
            errorMessage = "Failed to load Perfect Storm records."
        }
        loading = false
    }

    fun debugSet(records: MLBPerfectStormRecords) {
        if (!BuildFlags.isDebugBuild) return
        this.records = records
        this.lastFetched = System.currentTimeMillis()
    }

    private companion object {
        fun aggregate(rows: List<GradedPickRow>): MLBPerfectStormRecords {
            val out = MLBPerfectStormRecords()

            for (row in rows) {
                val raw = row.perfectStormTier ?: continue
                val tier = MLBPerfectStormTier.entries.firstOrNull { it.raw == raw } ?: continue
                val r: MLBPerfectStormRecord = out.record(tier)
                r.picks += 1
                when (row.result) {
                    "won" -> r.wins += 1
                    "lost" -> r.losses += 1
                    "push" -> r.pushes += 1
                }
                r.units += row.unitsWon ?: 0.0
            }

            for (tier in MLBPerfectStormTier.entries) {
                val r = out.record(tier)
                val graded = r.wins + r.losses
                // Same rounding as RN: 1 dp on pct, 2 dp on units.
                r.winPct = if (graded > 0) roundTiesAway(100.0 * r.wins / graded * 10) / 10 else null
                r.roiPct = if (graded > 0) roundTiesAway(100.0 * r.units / graded * 10) / 10 else null
                r.units = roundTiesAway(r.units * 100) / 100
            }
            return out
        }

        // Swift Double.rounded() is ties-away-from-zero; kotlin.math.round is ties-to-even.
        fun roundTiesAway(v: Double): Double = if (v >= 0) floor(v + 0.5) else ceil(v - 0.5)
    }
}
