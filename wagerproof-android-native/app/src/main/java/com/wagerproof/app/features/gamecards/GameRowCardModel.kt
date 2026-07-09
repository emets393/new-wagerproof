package com.wagerproof.app.features.gamecards

import androidx.compose.ui.graphics.Color
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.abs

/**
 * Normalized feed-card model — port of iOS `GameRowCard.Model`. Every sport's
 * card adapter builds one of these; the row renderer knows nothing about a
 * league beyond what's captured here.
 */
data class GameRowCardModel(
    val id: String,
    val league: String,
    val dateLabel: String,
    val timeLabel: String,
    val away: TeamSide,
    val home: TeamSide,
    val overLine: Double?,
    val mlEdge: MLEdgeInfo? = null,
    val ouEdge: OUEdgeInfo? = null,
    val awayTeamFullName: String? = null,
    val homeTeamFullName: String? = null,
    val slatePicks: SlatePicks? = null,
    val oddsBreakdown: OddsBreakdown? = null,
    val isMammoth: Boolean = false,
) {
    data class TeamSide(
        val abbr: String,
        val initials: String,
        val moneyline: Int?,
        val spread: Double?,
        val logoURL: String?,
        val colors: TeamColorPair,
    )

    /** Larger-side ML edge in percentage points. */
    data class MLEdgeInfo(val abbr: String, val edgePoints: Double, val color: Color)

    /** O/U model edge: direction + fair-vs-market delta + chosen-side prob. */
    data class OUEdgeInfo(
        val isOver: Boolean,
        val delta: Double?,
        val probability: Double?,
        val color: Color,
    )

    /** NFL/CFB dry-run slate picks rendered on the bottom row. */
    data class SlatePicks(
        val totalIsOver: Boolean?,
        val totalLabel: String?,
        val spreadLogoURL: String?,
        val spreadLabel: String?,
        val hasMammoth: Boolean,
        val highCount: Int,
        val signalCount: Int,
    )

    /** Scan-line breakdown table cells (away/home rows × spread/ML/total). */
    data class OddsBreakdown(
        val awaySpread: String,
        val homeSpread: String,
        val awayML: String,
        val homeML: String,
        val awayTotal: String,
        val homeTotal: String,
    )
}

/**
 * Model-vs-market edge math — port of iOS `GameEdgeMath` (must stay exact:
 * these numbers drive the colored edge pills).
 */
object GameEdgeMath {

    /** American-odds implied probability (no vig removal). */
    fun impliedProb(ml: Int?): Double? {
        if (ml == null) return null
        return if (ml > 0) 100.0 / (ml + 100.0) else abs(ml.toDouble()) / (abs(ml.toDouble()) + 100.0)
    }

    /** Pick the larger-side ML edge (in pct points) vs the market implied prob. */
    fun mlEdge(
        modelHomeProb: Double?,
        homeMl: Int?,
        awayMl: Int?,
        homeAbbr: String,
        awayAbbr: String,
    ): GameRowCardModel.MLEdgeInfo? {
        val p = modelHomeProb ?: return null
        if (!p.isFinite()) return null
        // iOS deliberately falls back to the opposing model probability when
        // one side has no market line, and still surfaces the larger side when
        // both computed edges are negative.
        val homeImplied = impliedProb(homeMl) ?: (1.0 - p)
        val awayImplied = impliedProb(awayMl) ?: p
        val homeEdge = (p - homeImplied) * 100.0
        val awayEdge = ((1.0 - p) - awayImplied) * 100.0
        val best = if (homeEdge >= awayEdge) homeAbbr to homeEdge else awayAbbr to awayEdge
        if (!best.second.isFinite()) return null
        return GameRowCardModel.MLEdgeInfo(best.first, best.second, edgeColor(best.second))
    }

    /**
     * O/U edge: direction from `ouResultProb` (≥0.5 = over) when present, else
     * fair-vs-market. delta = fair − line; prob normalized to the chosen side.
     */
    fun ouEdge(
        modelFairTotal: Double?,
        marketLine: Double?,
        ouResultProb: Double?,
    ): GameRowCardModel.OUEdgeInfo? {
        val isOver = when {
            ouResultProb != null -> ouResultProb >= 0.5
            modelFairTotal != null && marketLine != null -> modelFairTotal >= marketLine
            else -> return null
        }
        val delta = if (modelFairTotal != null && marketLine != null) modelFairTotal - marketLine else null
        val prob = ouResultProb?.let { if (isOver) it else 1.0 - it }
        val magnitude = delta?.let(::abs) ?: prob?.let { (it - 0.5) * 20.0 } ?: 0.0
        return GameRowCardModel.OUEdgeInfo(isOver, delta, prob, edgeColor(magnitude))
    }

    /** 4-tier edge palette (matches `GameCardFormatting.confidenceColor` tiers). */
    fun edgeColor(magnitude: Double): Color = when {
        abs(magnitude) >= 5 -> Color(0.13f, 0.77f, 0.37f)
        abs(magnitude) >= 3 -> Color(0.52f, 0.80f, 0.09f)
        abs(magnitude) >= 2 -> Color(0.92f, 0.70f, 0.03f)
        else -> Color(0.98f, 0.45f, 0.09f)
    }
}

/** Mammoth = orange accent used across the electric border + pills. */
val MammothOrange = Color(0xFFF97316)
val MammothGold = Color(0xFFFACC15)

/** UNDER is red in pick cards (deliberate — differs from insight-widget blue). */
val PickUnderRed = AppColors.appAccentRed
val PickOverGreen = AppColors.appPrimary
