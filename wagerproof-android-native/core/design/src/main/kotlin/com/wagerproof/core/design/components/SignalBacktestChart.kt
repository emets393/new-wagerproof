package com.wagerproof.core.design.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.max
import kotlin.math.min

/**
 * A signal's backtest, drawn against the break-even it has to clear.
 *
 * Port of `Wagerproof/Features/GameWidgets/SignalBacktestChart.swift` and
 * `src/features/games/detail/signals/SignalBacktestChart.tsx`.
 *
 * A signal's whole claim is "this hits often enough to beat the vig", so the
 * chart is a rate measured against that threshold, not a bare percentage.
 * `SignalPerformanceStatsSection` printed `12-8 • 60.0% • +3.2u` as one
 * bullet-joined line, which is exactly what WIDGET_DESIGN rule 5 forbids.
 */

/** -110 both ways. A signal below this loses money even "winning". */
const val SIGNAL_BREAK_EVEN_RATE = 0.524

private val WIN_GREEN = Color(0xFF22C55E)
private val LOSS_RED = Color(0xFFEF4444)

/**
 * Percentage pulled out of a free-text `typical_hit`, as a 0–1 fraction.
 *
 * The column is prose written by hand — real values include `58%`, `57-60%`,
 * and `~61% vs open wk1 (2024-25, n=83 — tracking)`.
 *
 * Only digits carrying a `%` count. A naive scrape that averaged the first two
 * numbers whenever it saw a dash read that last example as the range 61–1 and
 * rendered a 61% signal as **31%** — a winner shown as a loser. Seasons, sample
 * sizes and years all look like hit rates, so `%` is the only safe anchor.
 * Returns null when there is nothing to chart; callers print the raw string.
 */
object SignalHitRate {
    private const val NUM = "([0-9]+(?:\\.[0-9]+)?)"
    private val RANGE = Regex("$NUM\\s*[-–—]\\s*$NUM\\s*%")
    private val SINGLE = Regex("$NUM\\s*%")

    fun fraction(raw: String?): Double? {
        if (raw.isNullOrEmpty()) return null

        // A true range must END in the percent sign: "57-60%". `2024-25,` fails
        // because a comma follows, not a `%`.
        RANGE.find(raw)?.let { m ->
            val a = m.groupValues[1].toDoubleOrNull() ?: return@let
            val b = m.groupValues[2].toDoubleOrNull() ?: return@let
            return clamp((a + b) / 2)
        }
        SINGLE.find(raw)?.let { m ->
            return clamp(m.groupValues[1].toDoubleOrNull() ?: return@let)
        }
        return null
    }

    private fun clamp(percent: Double): Double? =
        if (percent > 0 && percent <= 100) percent / 100 else null

    /**
     * The meter's axis. Signals live in a narrow band around the vig, so a
     * 0–100% axis puts a 58% and a 52% signal on top of each other. The window
     * widens when a value falls outside it, so nothing is clamped onto an edge.
     */
    fun window(rate: Double): ClosedFloatingPointRange<Double> =
        min(0.35, rate - 0.04)..max(0.70, rate + 0.04)

    fun position(value: Double, window: ClosedFloatingPointRange<Double>): Double {
        val span = window.endInclusive - window.start
        if (span <= 0) return 0.0
        return min(max((value - window.start) / span, 0.0), 1.0)
    }
}

/**
 * One rate on a losing→winning track with the break-even between the zones.
 *
 * A zone chart, not a fill bar: a fill growing from the window's left edge
 * implied 35% was "zero" and left a losing signal as a sliver that read as a
 * rendering fault. Same grammar as [SpreadCoverBar].
 */
@Composable
fun SignalHitRateMeter(
    label: String,
    caption: String,
    /** 0–1. */
    rate: Double,
    modifier: Modifier = Modifier,
    lowConfidence: Boolean = false,
) {
    val window = SignalHitRate.window(rate)
    val breakEven = SignalHitRate.position(SIGNAL_BREAK_EVEN_RATE, window)
    val marker = SignalHitRate.position(rate, window)
    val beats = rate >= SIGNAL_BREAK_EVEN_RATE
    val tone = if (beats) WIN_GREEN else LOSS_RED

    var trackWidth by remember { mutableIntStateOf(0) }
    val density = LocalDensity.current

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(
                label.uppercase(),
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.weight(1f),
            )
            Text(
                String.format("%.1f%%", rate * 100),
                color = tone,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            Text(
                if (beats) "beats the vig" else "loses to the vig",
                color = tone.copy(alpha = 0.85f),
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
        }

        Box(
            Modifier
                .fillMaxWidth()
                .height(26.dp)
                .onSizeChanged { trackWidth = it.width },
            contentAlignment = Alignment.CenterStart,
        ) {
            val widthDp = with(density) { trackWidth.toDp() }

            // Flat zone fills: every rate inside a zone means the same thing.
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(14.dp)
                    .clip(CircleShape)
                    .background(LOSS_RED.copy(alpha = 0.22f))
            )
            Box(
                Modifier
                    .offset(x = widthDp * breakEven.toFloat())
                    .width((widthDp * (1 - breakEven).toFloat()).coerceAtLeast(0.dp))
                    .height(14.dp)
                    .clip(CircleShape)
                    .background(WIN_GREEN.copy(alpha = 0.30f))
            )
            Box(
                Modifier
                    .offset(x = widthDp * breakEven.toFloat() - 1.dp)
                    .width(2.dp)
                    .height(22.dp)
                    .background(AppColors.appTextPrimary.copy(alpha = 0.85f))
            )
            Box(
                Modifier
                    .offset(
                        x = (widthDp * marker.toFloat() - 2.5.dp)
                            .coerceIn(0.dp, (widthDp - 5.dp).coerceAtLeast(0.dp))
                    )
                    .width(5.dp)
                    .height(26.dp)
                    .clip(CircleShape)
                    .background(tone.copy(alpha = if (lowConfidence) 0.65f else 1f))
            )
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                "Break-even 52.4%",
                color = AppColors.appTextMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                caption,
                color = AppColors.appTextMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/** Wins / pushes / losses as one divided bar (WIDGET_DESIGN rule 5). */
@Composable
fun SignalRecordBar(wins: Int, losses: Int, pushes: Int, modifier: Modifier = Modifier) {
    val total = max(wins + losses + pushes, 1)

    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth().height(12.dp).clip(CircleShape)) {
            if (wins > 0) {
                Box(Modifier.weight(wins.toFloat() / total).fillMaxWidth().height(12.dp).background(WIN_GREEN))
            }
            if (pushes > 0) {
                Box(
                    Modifier.weight(pushes.toFloat() / total).fillMaxWidth().height(12.dp)
                        .background(AppColors.appTextSecondary.copy(alpha = 0.55f))
                )
            }
            if (losses > 0) {
                Box(Modifier.weight(losses.toFloat() / total).fillMaxWidth().height(12.dp).background(LOSS_RED))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Legend(WIN_GREEN, "${wins}W")
            if (pushes > 0) Legend(AppColors.appTextSecondary.copy(alpha = 0.55f), "${pushes}P")
            Legend(LOSS_RED, "${losses}L")
        }
    }
}

@Composable
private fun Legend(color: Color, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
        Text(
            label,
            color = AppColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
        )
    }
}

/**
 * Backtest meter, live-season meter, and the season record bar.
 *
 * Takes primitives rather than `SignalPerformance` so `core:design` stays
 * independent of `core:models`, the same way the edge charts do.
 */
@Composable
fun SignalBacktestChart(
    backtestRaw: String?,
    modifier: Modifier = Modifier,
    seasonN: Int = 0,
    seasonWins: Int = 0,
    seasonLosses: Int = 0,
    seasonPushes: Int = 0,
    seasonHitRate: Double = 0.0,
) {
    val backtestRate = SignalHitRate.fraction(backtestRaw)
    val graded = seasonN > 0

    if (backtestRate == null && backtestRaw.isNullOrEmpty() && !graded) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(18.dp)) {
        if (backtestRate != null) {
            SignalHitRateMeter(
                label = "Historical backtest",
                caption = "Multi-season, not this year",
                rate = backtestRate,
            )
        } else if (!backtestRaw.isNullOrEmpty()) {
            // Unparseable prose — show it rather than dropping the only
            // backtest figure the signal has.
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "HISTORICAL BACKTEST",
                    color = AppColors.appTextSecondary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    backtestRaw,
                    color = AppColors.appTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        // Nothing when the season has no graded picks — offseason and early
        // weeks are the common case, and an empty-state line there is noise
        // under a chart that already answered the question.
        if (graded) {
            SignalHitRateMeter(
                label = "This season",
                caption = if (seasonN < 10) "Only $seasonN graded — too few to trust" else "$seasonN graded picks",
                rate = seasonHitRate,
                lowConfidence = seasonN < 10,
            )
            SignalRecordBar(wins = seasonWins, losses = seasonLosses, pushes = seasonPushes)
        }
    }
}
