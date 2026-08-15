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
import androidx.compose.ui.graphics.Brush
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

/**
 * One centred rail that answers "which way does our model disagree with the
 * market, and by how much" before a single number is read.
 *
 * Port of iOS `WagerproofDesign/Components/ModelEdgeRail.swift`. The market
 * number is ALWAYS the centre reference point; the model rides at an offset
 * whose direction is the lean and whose distance is the magnitude, and only
 * the span *between* the two markers is coloured. Replaces a plain two-box
 * "Market → Model" grid, which printed both numbers but left the reader to
 * subtract them and judge whether the answer was a lot.
 *
 * The gap shown in the header is `model − market`, computed from the two
 * values this composable is already rendering, so the header can never
 * disagree with the bar under it.
 *
 * Zone widths are equal (not proportional to points) so labels stay legible;
 * the gap → x mapping is piecewise-linear across the five zones. A marker
 * always lands inside the zone its label names, but pixel distance is only
 * comparable *within* a zone — acceptable because the exact number is
 * printed twice (header + marker caption).
 */
@Composable
fun ModelEdgeRail(
    market: Double,
    model: Double,
    lowWord: String = "Under",
    highWord: String = "Over",
    marketCaption: String = "Market",
    modelCaption: String = "Model",
    scale: EdgeScale = EdgeScale.nfl,
    format: (Double) -> String = ::defaultEdgeFormat,
    modifier: Modifier = Modifier,
) {
    // Clamp in ascending order so a caller can't invert the bands and produce
    // a rail whose zones read backwards or divide by zero.
    val leanThreshold = maxOf(scale.totalLean, 0.1)
    val strongThreshold = maxOf(scale.totalStrong, leanThreshold + 0.1)
    val railCap = maxOf(scale.totalCap, strongThreshold + 0.1)

    val gap = model - market
    val magnitude = abs(gap)

    // 0 = strong low … 2 = no edge … 4 = strong high.
    val zoneIndex = when {
        magnitude < leanThreshold -> 2
        gap < 0 -> if (magnitude >= strongThreshold) 0 else 1
        else -> if (magnitude >= strongThreshold) 4 else 3
    }
    val zoneTitles = listOf(
        "Strong $lowWord",
        "$lowWord Lean",
        "No Edge",
        "$highWord Lean",
        "Strong $highWord",
    )
    val accent = when (zoneIndex) {
        0, 1 -> AppColors.appAccentBlue
        3, 4 -> AppColors.appPrimary
        else -> AppColors.appTextMuted
    }
    val hasEdge = zoneIndex != 2

    // Always signed, including inside "No Edge" — the direction is real
    // there, it's just not big enough to act on.
    val signedGapText = (if (gap < 0) "−" else "+") + "%.1f".format(magnitude)

    // Signed gap → 0…1 across the rail, piecewise-linear so each of the five
    // equal-width zones spans exactly the point range its label claims.
    val modelFraction: Float = run {
        val m = minOf(magnitude, railCap)
        val half = when {
            m <= leanThreshold -> (m / leanThreshold) * 0.10
            m <= strongThreshold -> 0.10 + (m - leanThreshold) / (strongThreshold - leanThreshold) * 0.20
            else -> 0.30 + (m - strongThreshold) / (railCap - strongThreshold) * 0.20
        }
        (0.5 + (if (gap < 0) -half else half)).coerceIn(0.015, 0.985).toFloat()
    }

    val accessibilityText = if (!hasEdge) {
        "No edge. Market ${format(market)}, model ${format(model)}."
    } else {
        val word = if (gap >= 0) highWord else lowWord
        "${zoneTitles[zoneIndex]}. Market ${format(market)}, model ${format(model)} — " +
            "%.1f".format(magnitude) + " toward the $word."
    }

    Column2(spacing = 10.dp, modifier = modifier.semantics { contentDescription = accessibilityText }) {
        Header(zoneTitles[zoneIndex], signedGapText, accent)
        ZoneLabels(zoneTitles, zoneIndex, accent)
        Rail(gap, modelFraction, accent)
        Captions(marketCaption, format(market), modelCaption, format(model), modelFraction, accent)
    }
}

@Composable
private fun Header(title: String, gapText: String, accent: Color) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(title.uppercase(), color = accent, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp)
        Text(gapText, color = accent, fontSize = 17.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun ZoneLabels(zoneTitles: List<String>, zoneIndex: Int, accent: Color) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        zoneTitles.forEachIndexed { index, title ->
            Text(
                title.uppercase(),
                color = if (index == zoneIndex) accent else AppColors.appTextMuted.copy(alpha = 0.5f),
                fontSize = 8.sp,
                fontWeight = if (index == zoneIndex) FontWeight.Black else FontWeight.Bold,
                letterSpacing = 0.4.sp,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun Rail(gap: Double, modelFraction: Float, accent: Color) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        val marketX = w * 0.5f
        val modelX = w * modelFraction
        Box(Modifier.fillMaxWidth().height(24.dp)) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(7.dp)
                    .align(Alignment.CenterStart)
                    .background(AppColors.appTextMuted.copy(alpha = 0.16f), RoundedCornerShape(percent = 50)),
            )
            // Zone boundaries so the labels above are anchored to something.
            (1..4).forEach { boundary ->
                Box(
                    Modifier
                        .width(1.dp)
                        .height(7.dp)
                        .offset(x = w * boundary / 5 - 0.5.dp)
                        .background(AppColors.appBorderStrong.copy(alpha = 0.55f)),
                )
            }
            // The answer: only the span between market and model is coloured.
            val spanStart = min(marketX, modelX)
            val spanWidth = max(if (modelX >= marketX) modelX - marketX else marketX - modelX, 3.dp)
            Box(
                Modifier
                    .width(spanWidth)
                    .height(7.dp)
                    .offset(x = spanStart)
                    .background(
                        Brush.horizontalGradient(
                            if (gap >= 0) listOf(accent.copy(alpha = 0.55f), accent) else listOf(accent, accent.copy(alpha = 0.55f)),
                        ),
                        RoundedCornerShape(percent = 50),
                    ),
            )
            Tick(x = marketX, width = 2.5.dp, height = 17.dp, color = AppColors.appTextSecondary)
            Tick(x = modelX, width = 3.5.dp, height = 23.dp, color = accent)
        }
    }
}

/**
 * Captions are pushed apart when their markers nearly coincide, otherwise a
 * small edge renders "MARKET" and "MODEL" stacked. Only the labels move; the
 * markers on [Rail] stay truthful.
 */
@Composable
private fun Captions(
    marketLabel: String,
    marketValue: String,
    modelLabel: String,
    modelValue: String,
    modelFraction: Float,
    accent: Color,
) {
    val captionWidth = 78.dp
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val w = maxWidth
        var mkt = w * 0.5f
        var mdl = w * modelFraction
        val minSeparation = captionWidth + 6.dp
        val separation: Dp = if (mdl >= mkt) mdl - mkt else mkt - mdl
        if (w > captionWidth && separation < minSeparation) {
            val push = (minSeparation - separation) / 2
            if (mdl >= mkt) {
                mkt -= push
                mdl += push
            } else {
                mkt += push
                mdl -= push
            }
        }
        val lower = captionWidth / 2
        val upper = max(w - captionWidth / 2, lower)
        mkt = mkt.coerceIn(lower, upper)
        mdl = mdl.coerceIn(lower, upper)

        Box(Modifier.fillMaxWidth()) {
            Caption(marketLabel, marketValue, AppColors.appTextPrimary, Modifier.width(captionWidth).offset(x = mkt - captionWidth / 2))
            Caption(modelLabel, modelValue, accent, Modifier.width(captionWidth).offset(x = mdl - captionWidth / 2))
        }
    }
}

@Composable
private fun Caption(label: String, value: String, color: Color, modifier: Modifier) {
    Column2(spacing = 2.dp, horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Text(label.uppercase(), color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        Text(value, color = color, fontSize = 18.sp, fontWeight = FontWeight.Black)
    }
}

private fun defaultEdgeFormat(value: Double): String =
    if (value == value.toInt().toDouble()) value.toInt().toString() else "%.1f".format(value)
