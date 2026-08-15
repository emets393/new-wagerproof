package com.wagerproof.core.design.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.abs

/**
 * What a moneyline price needs to be true, versus what the model thinks is
 * true.
 *
 * Port of iOS `WagerproofDesign/Components/MoneylineEdgeBar.swift`
 * (`MoneylineOutcome`). A price IS a required win rate — `+180` needs the bet
 * to land 35.7% of the time to break even; `-198` needs 66.4%. So a moneyline
 * card asks the same question as [SpreadCoverBar] — "what has to happen, and
 * where does the model land" — just measured in win probability instead of
 * points.
 *
 * Deliberately NO de-vigging: the break-even rate at a price is exactly that
 * price's RAW implied probability. De-vigging would answer a different
 * question ("what does the market think") and would no longer be the bar
 * this bet has to clear, reintroducing the reconciliation problem where a
 * marginally more "correct" number visibly contradicts the headline above it.
 */
class MoneylineOutcome(
    /** American odds for the side being bet. */
    val price: Int,
    /** The model's win probability for that side, 0...1. */
    val modelProbability: Double,
    private val scale: EdgeScale = EdgeScale.nfl,
) {
    /**
     * The win rate this price has to clear to be profitable, as a
     * percentage. Negative odds: risk `|price|` to win 100. Positive: risk
     * 100 to win `price`. Both reduce to stake / (stake + profit).
     */
    val breakEvenPercent: Double
        get() = if (price < 0) {
            (-price).toDouble() / (-price + 100) * 100
        } else {
            100.0 / (price + 100) * 100
        }

    val modelPercent: Double get() = modelProbability * 100

    /** Percentage points of edge. Positive = the model says this price is worth taking. */
    val edge: Double get() = modelPercent - breakEvenPercent

    val isPositiveValue: Boolean get() = edge > 0

    /** 0 = strongly negative … 2 = no edge … 4 = strong value. */
    val zoneIndex: Int
        get() {
            val magnitude = abs(edge)
            if (magnitude < scale.moneylineLean) return 2
            val strong = magnitude >= scale.moneylineStrong
            return if (edge < 0) (if (strong) 0 else 1) else (if (strong) 4 else 3)
        }

    val zoneTitle: String
        get() = listOf("Strong Fade", "Slight Overlay", "No Edge", "Value", "Strong Value")[zoneIndex]
}

/**
 * Break-even win rate against the model's win rate on a 0–100% axis, with a
 * coin-flip reference at the centre. Anchored at 50% for the same reason
 * [SpreadCoverBar] anchors at a tie: the axis needs a real-world reference a
 * reader already understands, not a betting abstraction. Everything right of
 * the break-even marker is +EV.
 */
@Composable
fun MoneylineEdgeBar(
    price: Int,
    modelProbability: Double,
    scale: EdgeScale = EdgeScale.nfl,
    teamAbbrev: String? = null,
    modifier: Modifier = Modifier,
) {
    val outcome = MoneylineOutcome(price, modelProbability, scale)
    val barHeight = 14.dp
    val gradations = listOf(25.0, 50.0, 75.0)
    val tone = if (outcome.isPositiveValue) AppColors.appWin else AppColors.appLoss

    fun fraction(percent: Double): Float = (percent / 100.0).coerceIn(0.008, 0.992).toFloat()

    val breakEvenFrac = fraction(outcome.breakEvenPercent)
    val modelFrac = fraction(outcome.modelPercent)

    val priceText = if (price > 0) "+$price" else "$price"
    val accessibilityText = "Break-even ${"%.1f".format(outcome.breakEvenPercent)} percent, " +
        "model ${"%.1f".format(outcome.modelPercent)} percent. ${outcome.zoneTitle}. Priced at $priceText."

    Box(modifier.semantics { contentDescription = accessibilityText }) {
        Column2(spacing = 8.dp) {
            MarkerCaptionsRow(
                leftLabel = "BREAK-EVEN",
                leftValue = "%.1f%%".format(outcome.breakEvenPercent),
                leftColor = AppColors.appTextPrimary,
                rightLabel = teamAbbrev?.let { "$it MODEL" } ?: "MODEL",
                rightValue = "%.1f%%".format(outcome.modelPercent),
                rightColor = tone,
                leftFrac = breakEvenFrac,
                rightFrac = modelFrac,
            )
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val w = maxWidth
                Box(Modifier.fillMaxWidth().height(barHeight + 18.dp)) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(barHeight)
                            .align(Alignment.CenterStart)
                            .background(AppColors.appLoss.copy(alpha = 0.20f), RoundedCornerShape(percent = 50)),
                    )
                    // Everything past the required win rate is profitable at this price.
                    Box(
                        Modifier
                            .width(max(w - w * breakEvenFrac, 0.dp))
                            .height(barHeight)
                            .offset(x = w * breakEvenFrac)
                            .background(AppColors.appWin.copy(alpha = 0.85f), RoundedCornerShape(percent = 50)),
                    )
                    gradations.forEach { mark ->
                        Box(
                            Modifier
                                .width(if (mark == 50.0) 1.5.dp else 1.dp)
                                .height(barHeight)
                                .offset(x = w * fraction(mark) - 0.75.dp)
                                .background(AppColors.appTextPrimary.copy(alpha = if (mark == 50.0) 0.45f else 0.16f)),
                        )
                    }
                    Tick(x = w * breakEvenFrac, width = 3.dp, height = barHeight + 12.dp, color = AppColors.appTextPrimary)
                    Tick(x = w * modelFrac, width = 3.5.dp, height = barHeight + 16.dp, color = tone)
                }
            }
            GradationScale(gradations, { fraction(it) })
            CushionBracketPercent(tone, outcome.isPositiveValue, "%.1f".format(abs(outcome.edge)), breakEvenFrac, modelFrac)
            ZoneCaptionsPercent(outcome.breakEvenPercent, outcome.zoneTitle)
        }
    }
}

@Composable
private fun MarkerCaptionsRow(
    leftLabel: String,
    leftValue: String,
    leftColor: Color,
    rightLabel: String,
    rightValue: String,
    rightColor: Color,
    leftFrac: Float,
    rightFrac: Float,
) {
    val captionWidth = 84.dp
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        var left = w * leftFrac
        var right = w * rightFrac
        val minSeparation = captionWidth + 6.dp
        val separation = if (right >= left) right - left else left - right
        if (w > captionWidth && separation < minSeparation) {
            val shove = (minSeparation - separation) / 2
            if (right >= left) {
                left -= shove
                right += shove
            } else {
                left += shove
                right -= shove
            }
        }
        val lower = captionWidth / 2
        val upper = max(w - captionWidth / 2, lower)
        left = left.coerceIn(lower, upper)
        right = right.coerceIn(lower, upper)

        Box(Modifier.fillMaxWidth()) {
            SmallCaption(leftLabel, leftValue, leftColor, Modifier.width(captionWidth).offset(x = left - captionWidth / 2))
            SmallCaption(rightLabel, rightValue, rightColor, Modifier.width(captionWidth).offset(x = right - captionWidth / 2))
        }
    }
}

@Composable
private fun SmallCaption(label: String, value: String, color: Color, modifier: Modifier) {
    Column2(spacing = 1.dp, horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Text(label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        Text(value, color = color, fontSize = 13.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun GradationScale(gradations: List<Double>, fraction: (Double) -> Float) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        Box(Modifier.fillMaxWidth()) {
            gradations.forEach { mark ->
                Text(
                    if (mark == 50.0) "COIN FLIP" else "${mark.toInt()}%",
                    color = if (mark == 50.0) AppColors.appTextSecondary else AppColors.appTextMuted,
                    fontSize = 8.sp,
                    fontWeight = if (mark == 50.0) FontWeight.Black else FontWeight.Bold,
                    letterSpacing = if (mark == 50.0) 0.4.sp else 0.sp,
                    modifier = Modifier.width(54.dp).offset(x = w * fraction(mark) - 27.dp),
                )
            }
        }
    }
}

@Composable
private fun CushionBracketPercent(tone: Color, positive: Boolean, magnitude: String, fractionA: Float, fractionB: Float) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        val start = min(w * fractionA, w * fractionB)
        val end = max(w * fractionA, w * fractionB)
        val span = max(end - start, 1.dp)
        Column2(spacing = 3.dp) {
            Box(Modifier.fillMaxWidth().height(7.dp)) {
                Box(Modifier.width(span).height(1.dp).offset(x = start, y = 2.5.dp).background(tone.copy(alpha = 0.55f)))
                Box(Modifier.width(1.dp).height(6.dp).offset(x = start, y = 0.5.dp).background(tone.copy(alpha = 0.55f)))
                Box(Modifier.width(1.dp).height(6.dp).offset(x = end - 1.dp, y = 0.5.dp).background(tone.copy(alpha = 0.55f)))
            }
            Text(
                if (positive) "$magnitude PTS OF VALUE" else "$magnitude PTS SHORT",
                color = tone,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.5.sp,
                modifier = Modifier.offset(x = start),
            )
        }
    }
}

@Composable
private fun ZoneCaptionsPercent(breakEvenPercent: Double, zoneTitle: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Column2(spacing = 2.dp, horizontalAlignment = Alignment.Start) {
            Text("LOSES LONG-TERM", color = AppColors.appLoss, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Text(
                "Wins under ${"%.1f%%".format(breakEvenPercent)} of the time",
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Column2(spacing = 2.dp, horizontalAlignment = Alignment.End) {
            Text(zoneTitle.uppercase(), color = AppColors.appWin, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Text(
                "Wins over ${"%.1f%%".format(breakEvenPercent)} of the time",
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
