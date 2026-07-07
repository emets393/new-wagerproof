package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBBetTypeAccuracy
import com.wagerproof.core.models.MLBBucketAccuracy
import com.wagerproof.core.models.MLBBucketAccuracyRow
import com.wagerproof.core.models.MLBBucketBucket
import com.wagerproof.core.models.MLBBucketLookup
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor

/**
 * Loads + caches the `mlb_model_bucket_accuracy` aggregation. Port of iOS
 * `MLBBucketAccuracyStore.swift` (mirrors RN `hooks/useMLBBucketAccuracy.ts`).
 * 5-minute stale window.
 */
@Stable
class MLBBucketAccuracyStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var data by mutableStateOf<MLBBucketAccuracy?>(null); private set
    var loading by mutableStateOf(false); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var lastFetched by mutableStateOf<Long?>(null); private set

    /** 5-minute stale window — matches RN `staleTime: 5 * 60 * 1000`. */
    private val staleWindowMs: Long = 5 * 60 * 1000

    fun close() = scope.cancel()

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
            val rows: List<MLBBucketAccuracyRow> = cfb
                .from("mlb_model_bucket_accuracy")
                .select()
                .decodeList()
            data = aggregate(rows)
            lastFetched = System.currentTimeMillis()
        } catch (e: Exception) {
            errorMessage = "Failed to load model accuracy."
        }
        loading = false
    }

    companion object {
        /**
         * Aggregate raw rows the same way the web hook does. Sums games / wins
         * / units, then computes win% (1 dp) + roi%. Mirrors RN `aggregate`.
         */
        fun aggregate(rows: List<MLBBucketAccuracyRow>): MLBBucketAccuracy {
            val out = MLBBucketAccuracy()
            for (r in rows) {
                val bt: MLBBetTypeAccuracy = when (r.betType) {
                    "full_ml" -> out.fullMl
                    "full_ou" -> out.fullOu
                    "f5_ml" -> out.f5Ml
                    "f5_ou" -> out.f5Ou
                    "perfect_storm" -> out.perfectStorm
                    else -> continue
                }
                bt.overall.games += r.games
                bt.overall.wins += r.wins
                bt.overall.unitsWon += r.unitsWon
                bt.byBucket = bt.byBucket + MLBBucketBucket(
                    bucket = r.bucket,
                    side = r.side.ifEmpty { null },
                    favDog = r.favDog.ifEmpty { null },
                    direction = r.direction.ifEmpty { null },
                    games = r.games,
                    wins = r.wins,
                    winPct = r.winPct,
                    unitsWon = r.unitsWon,
                    roiPct = r.roiPct,
                )
            }
            finalize(out.fullMl)
            finalize(out.fullOu)
            finalize(out.f5Ml)
            finalize(out.f5Ou)
            finalize(out.perfectStorm)
            return out
        }

        private fun finalize(bt: MLBBetTypeAccuracy) {
            val g = bt.overall.games.toDouble()
            if (g > 0) {
                bt.overall.winPct = roundTiesAway(bt.overall.wins / g * 1000) / 10
                bt.overall.unitsWon = roundTiesAway(bt.overall.unitsWon * 100) / 100
                bt.overall.roiPct = roundTiesAway(bt.overall.unitsWon / g * 1000) / 10
            }
        }

        // Swift Double.rounded() is ties-away-from-zero; kotlin.math.round is ties-to-even.
        private fun roundTiesAway(v: Double): Double = if (v >= 0) floor(v + 0.5) else ceil(v - 0.5)
    }
}

// MARK: - Bucket lookup helpers

/** Port of the Swift `MLBBucketHelper` enum. */
object MLBBucketHelper {
    /** Same thresholds the web app + Python pipeline uses. */
    val mlBuckets: List<Pair<Double, String>> =
        listOf(7.0 to "7%+", 4.0 to "4-6.9%", 2.0 to "2-3.9%", 0.0 to "<2%")
    val ouBuckets: List<Pair<Double, String>> =
        listOf(1.5 to "1.5+", 1.0 to "1.0-1.49", 0.5 to "0.5-0.99", 0.0 to "<0.5")
    val f5MlBuckets: List<Pair<Double, String>> =
        listOf(20.0 to "20%+", 10.0 to "10-19.9%", 5.0 to "5-9.9%", 0.0 to "<5%")
    val f5OuBuckets: List<Pair<Double, String>> =
        listOf(1.0 to "1.0+", 0.5 to "0.5-0.99", 0.0 to "<0.5")

    fun bucketLabel(edge: Double, betType: String): String {
        val buckets = when (betType) {
            "full_ml" -> mlBuckets
            "full_ou" -> ouBuckets
            "f5_ml" -> f5MlBuckets
            "f5_ou" -> f5OuBuckets
            else -> mlBuckets
        }
        val absEdge = abs(edge)
        val prefix = if (edge < 0) "-" else "+"
        for ((threshold, label) in buckets) {
            if (absEdge >= threshold) return "$prefix$label"
        }
        return "$prefix${buckets.lastOrNull()?.second ?: ""}"
    }

    /**
     * Look up bucket accuracy for a given pick. Mirrors RN
     * `lookupBucketAccuracy(...)` including the `games < 3` cutoff.
     */
    fun lookup(
        accuracy: MLBBucketAccuracy?,
        betType: String,
        edge: Double,
        side: String? = null,
        favDog: String? = null,
        direction: String? = null,
    ): MLBBucketLookup? {
        if (accuracy == null) return null
        val bt = accuracy.betType(betType)
        val label = bucketLabel(edge, betType)
        for (b in bt.byBucket) {
            if (b.bucket != label) continue
            if (side != null && !b.side.isNullOrEmpty() && b.side != side) continue
            if (favDog != null && !b.favDog.isNullOrEmpty() && b.favDog != favDog) continue
            if (direction != null && !b.direction.isNullOrEmpty() && b.direction != direction) continue
            if (b.games < 3) continue
            return MLBBucketLookup(
                winPct = b.winPct,
                roiPct = b.roiPct,
                record = "${b.wins}-${b.games - b.wins}",
            )
        }
        return null
    }
}
