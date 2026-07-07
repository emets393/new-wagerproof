package com.wagerproof.core.models

import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Which metric the Agents "Platform Statistics" screen is distributing. Win
 * rate is available overall AND per sport (derived from `stats_by_sport`); net
 * units only exists at the overall level in `avatar_performance_cache`, so the
 * per-sport section is win-rate only.
 */
enum class StatMetric(val raw: String) {
    WIN_RATE("winRate"),
    NET_UNITS("netUnits");

    val label: String
        get() = when (this) {
            WIN_RATE -> "Win Rate"
            NET_UNITS -> "Net Units"
        }
}

/**
 * A fitted normal (bell) curve: the sample mean + SD of a cohort's metric
 * values, in the metric's own units (win rate is 0…1, net units is signed u).
 * [isEstimated] flags a synthetic fit (the NFL placeholder) so the UI can
 * badge it rather than present it as observed.
 */
data class NormalFit(
    val mean: Double,
    val sd: Double,
    val count: Int,
    val isEstimated: Boolean = false,
) {
    /**
     * Normal probability density at [x]. Returns 0 for a degenerate fit
     * (SD ≤ 0) so callers can safely map it across a domain.
     */
    fun pdf(x: Double): Double {
        if (sd <= 0) return 0.0
        val z = (x - mean) / sd
        return (1.0 / (sd * sqrt(2.0 * PI))) * exp(-0.5 * z * z)
    }

    /**
     * Curve height on the SAME axis as a *share* histogram (fraction of the
     * cohort per bin): the continuous density × bin width ≈ the share expected
     * in a bin of that width. Lets the bell curve overlay share-scaled bars.
     */
    fun share(x: Double, binWidth: Double): Double = pdf(x) * binWidth

    /**
     * Curve height normalized so the peak (at the mean) is 1. Used by the
     * multi-sport overlay where only shape + spread matter, not cohort size.
     */
    fun normalizedDensity(x: Double): Double {
        if (sd <= 0) return if (x == mean) 1.0 else 0.0
        val z = (x - mean) / sd
        return exp(-0.5 * z * z)
    }
}

/**
 * One histogram bar. [share] is the fraction of the cohort (0…1) that fell in
 * `[lower, upper)` — NOT a raw count. The screen never surfaces population
 * sizes, so bars and axes are expressed as share of agents.
 */
data class DistributionBucket(
    val lower: Double,
    val upper: Double,
    val share: Double,
) {
    val mid: Double get() = (lower + upper) / 2
    val id: Double get() = lower
}

/** A sampled point on a fitted curve, ready to feed a chart line series. */
data class CurvePoint(
    val x: Double,
    val y: Double,
) {
    val id: Double get() = x
}

/**
 * Pure, dependency-free distribution math shared by the stats screen and its
 * unit tests. No platform types beyond Double/ClosedFloatingPointRange.
 */
object DistributionStatistics {
    /**
     * Sample mean + SD (÷ n−1) over finite values. Null for an empty input.
     * SD is 0 when there are fewer than 2 values (a single point has no spread).
     */
    fun fit(values: List<Double>, isEstimated: Boolean = false): NormalFit? {
        val finite = values.filter { it.isFinite() }
        if (finite.isEmpty()) return null
        val n = finite.size
        val mean = finite.sum() / n
        val sd = if (n < 2) {
            0.0
        } else {
            val ss = finite.fold(0.0) { acc, v -> acc + (v - mean) * (v - mean) }
            sqrt(ss / (n - 1))
        }
        return NormalFit(mean = mean, sd = sd, count = n, isEstimated = isEstimated)
    }

    /**
     * Fixed-width bucketing over [domain]. Every bin in the domain is emitted
     * (including empties) so the bars are contiguous. Values outside the domain
     * are clamped into the edge bins so nothing is silently dropped. Heights are
     * shares (bin count ÷ total count).
     */
    fun histogram(
        values: List<Double>,
        domain: ClosedFloatingPointRange<Double>,
        binWidth: Double,
    ): List<DistributionBucket> {
        if (binWidth <= 0 || domain.endInclusive <= domain.start) return emptyList()
        val finite = values.filter { it.isFinite() }
        if (finite.isEmpty()) return emptyList()

        val span = domain.endInclusive - domain.start
        val binCount = max(1, ceil(span / binWidth).toInt())
        val counts = IntArray(binCount)
        for (v in finite) {
            val idx = floor((v - domain.start) / binWidth).toInt().coerceIn(0, binCount - 1)
            counts[idx] += 1
        }

        val total = finite.size.toDouble()
        return (0 until binCount).map { i ->
            val lower = domain.start + i * binWidth
            val upper = min(lower + binWidth, domain.endInclusive)
            DistributionBucket(lower = lower, upper = upper, share = counts[i] / total)
        }
    }

    /**
     * Smooth curve points across [domain], scaled to a share histogram of the
     * given bin width (so it overlays the bars). [samples] points, evenly spaced.
     */
    fun curvePoints(
        fit: NormalFit,
        domain: ClosedFloatingPointRange<Double>,
        binWidth: Double,
        samples: Int = 120,
    ): List<CurvePoint> = sampled(domain, samples) { fit.share(it, binWidth) }

    /**
     * Smooth curve points normalized so the peak is 1 — for the multi-sport
     * overlay comparison (shape + spread, cohort-size independent).
     */
    fun normalizedCurvePoints(
        fit: NormalFit,
        domain: ClosedFloatingPointRange<Double>,
        samples: Int = 160,
    ): List<CurvePoint> = sampled(domain, samples) { fit.normalizedDensity(it) }

    private fun sampled(
        domain: ClosedFloatingPointRange<Double>,
        samples: Int,
        f: (Double) -> Double,
    ): List<CurvePoint> {
        if (samples <= 1 || domain.endInclusive <= domain.start) return emptyList()
        val step = (domain.endInclusive - domain.start) / (samples - 1)
        return (0 until samples).map { i ->
            val x = domain.start + i * step
            CurvePoint(x = x, y = f(x))
        }
    }
}
