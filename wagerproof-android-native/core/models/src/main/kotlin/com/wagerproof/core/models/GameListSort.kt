package com.wagerproof.core.models

/**
 * One game's signal standing for the list sort.
 * [bestRoi] is percentage points (`+43.2` → `43.2`). Null means the game's
 * signals have a count but no ROI we can read.
 */
data class SignalBoardRank(
    val bestRoi: Double? = null,
    val count: Int = 0,
) {
    companion object {
        val empty = SignalBoardRank()
    }
}

/** Shared list-sort maths. Each sport feeds its own edge into these helpers. */
object GameListSort {
    fun magnitude(value: Double?): Double? = value?.takeIf { it.isFinite() }?.let { kotlin.math.abs(it) }

    /** Absolute model-versus-market gap, in the market's own units. */
    fun gap(model: Double?, market: Double?): Double? {
        if (model == null || market == null || !model.isFinite() || !market.isFinite()) return null
        return kotlin.math.abs(model - market)
    }

    /**
     * Absolute size of the moneyline edge the list pill prints, in percentage points.
     * The side with the larger model-minus-market edge is the one on the card.
     */
    fun moneylineValue(homeProb: Double?, homeMl: Int?, awayMl: Int?): Double? {
        if (homeProb == null || !homeProb.isFinite() || homeProb <= 0.0 || homeProb >= 1.0) return null
        val homeEdge = (homeProb - (homeMl?.let(::implied) ?: (1 - homeProb))) * 100
        val awayEdge = ((1 - homeProb) - (awayMl?.let(::implied) ?: homeProb)) * 100
        val chosen = maxOf(homeEdge, awayEdge)
        return if (chosen.isFinite()) kotlin.math.abs(chosen) else null
    }

    /**
     * One signal's rating. A graded season row wins. Otherwise the season
     * prose, then the backtest prose. Returns percentage points.
     */
    fun rating(
        seasonRoiFraction: Double?,
        seasonSample: Int,
        seasonText: String?,
        backtestText: String?,
    ): Double? {
        if (seasonSample > 0 && seasonRoiFraction != null && seasonRoiFraction.isFinite()) {
            return seasonRoiFraction * 100
        }
        SignalRoi.percent(seasonText)?.let { return it }
        return SignalRoi.percent(backtestText)
    }

    fun boardRank(count: Int, ratings: List<Double?>): SignalBoardRank =
        SignalBoardRank(bestRoi = ratings.filterNotNull().maxOrNull(), count = count)

    /** Negative when [lhs] should come first. A missing number sorts after a real one. */
    fun higherFirst(lhs: Double?, rhs: Double?): Int = when {
        lhs != null && rhs != null && lhs != rhs -> rhs.compareTo(lhs)
        lhs != null && rhs == null -> -1
        lhs == null && rhs != null -> 1
        else -> 0
    }

    /**
     * Negative when [lhs] should come first. Highest-rated signal first.
     * When nothing on the board has an ROI, the signal count decides.
     * Two games with no signals compare equal so the caller keeps time order.
     */
    fun signalsFirst(lhs: SignalBoardRank, rhs: SignalBoardRank, anyRated: Boolean): Int {
        if (lhs.count == 0 && rhs.count == 0) return 0
        if (lhs.count == 0) return 1
        if (rhs.count == 0) return -1
        if (anyRated) {
            val roi = when {
                lhs.bestRoi != null && rhs.bestRoi != null && lhs.bestRoi != rhs.bestRoi ->
                    rhs.bestRoi.compareTo(lhs.bestRoi)
                lhs.bestRoi != null && rhs.bestRoi == null -> -1
                lhs.bestRoi == null && rhs.bestRoi != null -> 1
                else -> 0
            }
            if (roi != 0) return roi
        }
        if (lhs.count != rhs.count) return rhs.count.compareTo(lhs.count)
        return 0
    }

    private fun implied(ml: Int): Double =
        if (ml < 0) (-ml).toDouble() / (-ml + 100) else 100.0 / (ml + 100)
}
