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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.roundToInt

/**
 * Everything a spread pick needs in order to explain itself, derived from two
 * numbers: the pick team's line and the model's projected margin for them.
 *
 * Port of iOS `WagerproofDesign/Components/SpreadCoverBar.swift`
 * (`SpreadCoverOutcome`). See that file for the full "why" — short version:
 * a spread card used to show "+4.5" beside "−2.1" and let the reader
 * reconcile a LINE against a MARGIN, whose sign convention flips between the
 * two. Everything here works in MARGIN — pick team's final points minus their
 * opponent's — so nothing is ever the negative of a negative.
 *
 * Half points can't happen, whole points can push: a final margin is always a
 * whole number, so a half-point line (+4.5) never lands on the threshold (no
 * push possible) while a whole-point line (+4) can (push = stake returned).
 */
class SpreadCoverOutcome(
    /**
     * The pick team's line from ITS OWN perspective: `+4.5` = receiving 4.5,
     * `-10` = laying 10. This is `best_line ?? vegas_line` on an NFL/CFB
     * slate pick row, which is already stored pick-side.
     */
    val line: Double,
    /**
     * The pick team's projected final margin — positive means the model has
     * them winning. On a slate row this is `-model_line`, because
     * `model_line` is the team's fair *spread*.
     */
    val modelMargin: Double,
) {
    /** The margin the game has to beat for the bet to cover. */
    val threshold: Double get() = -line

    /** Smallest whole margin that COVERS. */
    val coverMin: Int get() = floor(threshold).toInt() + 1

    /** Largest whole margin that LOSES. */
    val loseMax: Int get() = ceil(threshold).toInt() - 1

    /** The one margin that pushes, or null on a half-point line. */
    val pushMargin: Int? get() = if (threshold == floor(threshold)) threshold.roundToInt() else null

    val hasPush: Boolean get() = pushMargin != null

    /** Points of margin for error the bet has if the model is right. */
    val cushion: Double get() = modelMargin - threshold

    val covers: Boolean get() = cushion > 0

    val coverCondition: String
        get() = when {
            coverMin > 0 -> "Win by $coverMin+"
            coverMin == 0 -> "Win or tie"
            else -> "Lose by ${-coverMin} or less, tie, or win"
        }

    val loseCondition: String
        get() = when {
            loseMax < 0 -> "Lose by ${-loseMax}+"
            loseMax == 0 -> "Tie or lose"
            else -> "Win by $loseMax or less, tie, or lose"
        }

    val pushCondition: String?
        get() {
            val push = pushMargin ?: return null
            return when {
                push > 0 -> "Win by exactly $push"
                push == 0 -> "Tie"
                else -> "Lose by exactly ${-push}"
            }
        }

    /** What the model thinks the final margin is, in win/lose language. */
    val modelCondition: String
        get() {
            val magnitude = format(abs(modelMargin))
            return when {
                modelMargin > 0 -> "Win by $magnitude"
                modelMargin < 0 -> "Lose by $magnitude"
                else -> "Dead even"
            }
        }

    /** The line as a signed line (not a margin) — half values are legitimate here. */
    val signedLine: String
        get() {
            val magnitude = format(abs(line))
            return if (line >= 0) "+$magnitude" else "−$magnitude"
        }

    companion object {
        fun format(value: Double): String =
            if (value == value.roundToInt().toDouble()) value.roundToInt().toString() else "%.1f".format(value)
    }
}

/**
 * The spread pick drawn on a score-differential axis anchored at a TIE, not
 * the betting threshold — a tied game is a reference every reader already
 * understands, and on a dog it makes visible that the cover zone starts on
 * the LOSING side of zero. Port of iOS `SpreadCoverBar`.
 */
@Composable
fun SpreadCoverBar(
    line: Double,
    modelMargin: Double,
    scale: EdgeScale = EdgeScale.nfl,
    pickAbbrev: String? = null,
    opponentAbbrev: String? = null,
    modifier: Modifier = Modifier,
) {
    val outcome = SpreadCoverOutcome(line, modelMargin)
    val window = scale.spreadWindow
    val labelledTicks = listOf(3.0, 7.0, 10.0)
    val barHeight = 14.dp
    val tone = if (outcome.covers) AppColors.appWin else AppColors.appLoss

    fun fraction(margin: Double): Float =
        (margin / (window * 2) + 0.5).coerceIn(0.008, 0.992).toFloat()

    // A pushing margin is one whole number, so on a continuous axis it
    // occupies the half-point either side of itself; a half-point line has
    // no push, so the two zones meet at a hairline instead.
    val loseEnd = fraction(outcome.threshold - (if (outcome.hasPush) 0.5 else 0.0))
    val coverStart = fraction(outcome.threshold + (if (outcome.hasPush) 0.5 else 0.0))
    val breakEvenFrac = fraction(outcome.threshold)
    val modelFrac = fraction(outcome.modelMargin)
    val tieFrac = fraction(0.0)

    val accessibilityText = buildString {
        append("Covers if ${outcome.coverCondition}. Loses if ${outcome.loseCondition}.")
        outcome.pushCondition?.let { append(" $it pushes.") }
        append(" Model projects ${outcome.modelCondition.lowercase()},")
        val cushionText = SpreadCoverOutcome.format(abs(outcome.cushion))
        append(if (outcome.covers) " $cushionText points of room." else " $cushionText points short.")
    }

    Box(modifier.semantics { contentDescription = accessibilityText }) {
        Column2(spacing = 8.dp) {
            MarkerCaptions(outcome, breakEvenFrac, modelFrac, tone)
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val w = maxWidth
                Box(Modifier.fillMaxWidth().height(barHeight + 18.dp)) {
                    // Track: loss tint everywhere, win tint from coverStart, push band between.
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(barHeight)
                            .align(Alignment.CenterStart)
                            .background(AppColors.appLoss.copy(alpha = 0.20f), RoundedCornerShape(percent = 50)),
                    )
                    Box(
                        Modifier
                            .width(max(w * (1 - coverStart), 0.dp))
                            .height(barHeight)
                            .offset(x = w * coverStart)
                            .background(AppColors.appWin.copy(alpha = 0.85f), RoundedCornerShape(percent = 50)),
                    )
                    if (outcome.hasPush) {
                        Box(
                            Modifier
                                .width(max(w * (coverStart - loseEnd), 1.5.dp))
                                .height(barHeight)
                                .offset(x = w * loseEnd)
                                .background(AppColors.appPush.copy(alpha = 0.9f)),
                        )
                    }
                    labelledTicks.flatMap { listOf(-it, it) }.forEach { margin ->
                        Box(
                            Modifier
                                .width(1.dp)
                                .height(barHeight)
                                .offset(x = w * fraction(margin) - 0.5.dp)
                                .background(AppColors.appTextPrimary.copy(alpha = 0.16f)),
                        )
                    }
                    // Tie reference — part of the scale, not a third marker.
                    Box(
                        Modifier
                            .width(1.5.dp)
                            .height(barHeight)
                            .offset(x = w * tieFrac - 0.75.dp)
                            .background(AppColors.appTextPrimary.copy(alpha = 0.45f)),
                    )
                    Tick(x = w * breakEvenFrac, width = 3.dp, height = barHeight + 12.dp, color = AppColors.appTextPrimary)
                    Tick(x = w * modelFrac, width = 3.5.dp, height = barHeight + 16.dp, color = tone)
                }
            }
            Scale(labelledTicks, { fraction(it) }, pickAbbrev, opponentAbbrev)
            CushionBracket(
                tone = tone,
                covers = outcome.covers,
                magnitude = SpreadCoverOutcome.format(abs(outcome.cushion)),
                fractionA = breakEvenFrac,
                fractionB = modelFrac,
                unit = "PTS",
            )
            ZoneCaptions(loseCondition = outcome.loseCondition, coverCondition = outcome.coverCondition)
        }
    }
}

/**
 * Nudged apart only when the two markers nearly coincide, so the captions
 * never stack — mirrors iOS `captionPositions`. The ticks on the bar stay
 * truthful; only these labels move.
 */
@Composable
private fun MarkerCaptions(outcome: SpreadCoverOutcome, breakEvenFrac: Float, modelFrac: Float, tone: Color) {
    val captionWidth = 84.dp
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        var left = w * breakEvenFrac
        var right = w * modelFrac
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
            MarkerCaption(
                label = if (outcome.hasPush) "PUSH" else "BREAK-EVEN",
                value = outcome.pushCondition,
                color = AppColors.appTextPrimary,
                modifier = Modifier.width(captionWidth).offset(x = left - captionWidth / 2),
            )
            MarkerCaption(
                label = "MODEL",
                value = outcome.modelCondition,
                color = tone,
                modifier = Modifier.width(captionWidth).offset(x = right - captionWidth / 2),
            )
        }
    }
}

@Composable
private fun MarkerCaption(label: String, value: String?, color: Color, modifier: Modifier = Modifier) {
    Column2(spacing = 1.dp, horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Text(label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        value?.let { Text(it, color = color, fontSize = 12.sp, fontWeight = FontWeight.Black) }
    }
}

@Composable
private fun Scale(labelledTicks: List<Double>, fraction: (Double) -> Float, pickAbbrev: String?, opponentAbbrev: String?) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        Box(Modifier.fillMaxWidth()) {
            labelledTicks.flatMap { listOf(-it, it) }.forEach { margin ->
                Text(
                    "${if (margin < 0) "−" else "+"}${SpreadCoverOutcome.format(abs(margin))}",
                    color = AppColors.appTextMuted,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.width(28.dp).offset(x = w * fraction(margin) - 14.dp),
                )
            }
            Text(
                "TIE",
                color = AppColors.appTextSecondary,
                fontSize = 8.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.4.sp,
                modifier = Modifier.width(30.dp).offset(x = w * fraction(0.0) - 15.dp),
            )
            opponentAbbrev?.let {
                Text("← $it", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.CenterStart))
            }
            pickAbbrev?.let {
                Text("$it →", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.CenterEnd))
            }
        }
    }
}

/**
 * Anchored to two ticks and nothing else — its drawn length is the number
 * printed under it, measurable against the [Scale] above.
 */
@Composable
private fun CushionBracket(tone: Color, covers: Boolean, magnitude: String, fractionA: Float, fractionB: Float, unit: String) {
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
                if (covers) "$magnitude $unit OF ROOM" else "$magnitude $unit SHORT",
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
private fun ZoneCaptions(loseCondition: String, coverCondition: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Column2(spacing = 2.dp, horizontalAlignment = Alignment.Start) {
            Text("LOSES", color = AppColors.appLoss, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Text(loseCondition, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        Column2(spacing = 2.dp, horizontalAlignment = Alignment.End) {
            Text("COVERS", color = AppColors.appWin, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Text(coverCondition, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
internal fun Tick(x: Dp, width: Dp, height: Dp, color: Color) {
    Box(
        Modifier
            .width(width)
            .height(height)
            .offset(x = x - width / 2)
            .background(color, RoundedCornerShape(width / 2)),
    )
}

/** Small local stand-in for a spaced Column so this file has no cross-module UI dependency. */
@Composable
internal fun Column2(
    spacing: Dp = 0.dp,
    horizontalAlignment: Alignment.Horizontal = Alignment.Start,
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    androidx.compose.foundation.layout.Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(spacing),
        horizontalAlignment = horizontalAlignment,
        content = content,
    )
}
