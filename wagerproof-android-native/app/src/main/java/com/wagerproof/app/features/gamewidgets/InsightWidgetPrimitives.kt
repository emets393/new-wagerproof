package com.wagerproof.app.features.gamewidgets

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.InsightVerdict
import com.wagerproof.core.models.SignalPerformance
import com.wagerproof.core.models.SignalSeasonRecordDisplay
import com.wagerproof.core.models.TrendsSignal
import kotlin.math.max

/**
 * Insight-widget design system — port of iOS `GameWidgets/InsightWidgetPrimitives.swift`.
 *
 * Color convention: OVER = green 0x22C55E, UNDER = **blue 0x3B82F6** (legacy
 * insight-badge convention — deliberately different from pick-card red).
 */

private val InsightOver = Color(0xFF22C55E)
private val InsightUnder = Color(0xFF3B82F6)

/** Verdict line: lean chip + text + strength dots. */
@Composable
fun InsightVerdictLine(verdicts: List<InsightVerdict>, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        verdicts.forEach { v ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                LeanChip(v.lean)
                Spacer(Modifier.width(8.dp))
                Text(v.text, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    repeat(v.strength.coerceIn(0, 3)) {
                        Box(Modifier.size(5.dp).clip(CircleShape).background(AppColors.appPrimary))
                    }
                }
            }
        }
    }
}

@Composable
private fun LeanChip(lean: InsightVerdict.Lean) {
    val (text, tint) = when (lean) {
        is InsightVerdict.Lean.Team -> lean.abbr to AppColors.appAccentBlue
        InsightVerdict.Lean.Over -> "OVER" to InsightOver
        InsightVerdict.Lean.Under -> "UNDER" to InsightUnder
        InsightVerdict.Lean.None -> return
    }
    Box(
        Modifier.clip(CircleShape).background(tint.copy(alpha = 0.18f)).padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(text, color = tint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

/**
 * Two-sided tug bar (h=8). Halves tinted proportional to value/(a+h); missing
 * side = gray dashed at 50/50. Numerals sit OUTSIDE the track.
 */
@Composable
fun SignalSplitBar(
    away: Double?,
    home: Double?,
    modifier: Modifier = Modifier,
    awayColor: Color = AppColors.appAccentBlue,
    homeColor: Color = AppColors.appPrimary,
) {
    val a = away ?: 0.0
    val h = home ?: 0.0
    val total = max(a + h, 0.0001)
    val awayFrac = if (away == null || home == null) 0.5f else (a / total).toFloat()
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        away?.let {
            Text("${(it).toInt()}", color = AppColors.appTextSecondary, fontSize = 11.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
            Spacer(Modifier.width(6.dp))
        }
        Row(Modifier.weight(1f).height(8.dp).clip(CircleShape)) {
            Box(Modifier.weight(awayFrac.coerceIn(0.01f, 0.99f)).fillMaxWidth().height(8.dp).background(awayColor.copy(alpha = 0.85f)))
            Box(Modifier.weight((1f - awayFrac).coerceIn(0.01f, 0.99f)).fillMaxWidth().height(8.dp).background(homeColor.copy(alpha = 0.85f)))
        }
        home?.let {
            Spacer(Modifier.width(6.dp))
            Text("${(it).toInt()}", color = AppColors.appTextSecondary, fontSize = 11.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
        }
    }
}

/** A `TrendsSignal` row: "Situation · Metric" + kind badge + split bar. */
@Composable
fun TrendSignalRow(signal: TrendsSignal, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${signal.situationTitle} · ${signal.metricLabel}",
                color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.weight(1f))
            KindBadge(signal.kind)
        }
        SignalSplitBar(signal.awayPct, signal.homePct)
    }
}

@Composable
private fun KindBadge(kind: TrendsSignal.Kind) {
    val (text, tint) = when (kind) {
        is TrendsSignal.Kind.Side -> "${kind.abbr} +${kind.gap.toInt()}" to AppColors.appAccentBlue
        is TrendsSignal.Kind.Over -> "OVER" to InsightOver
        is TrendsSignal.Kind.Under -> "UNDER" to InsightUnder
    }
    Box(Modifier.clip(CircleShape).background(tint.copy(alpha = 0.18f)).padding(horizontal = 8.dp, vertical = 2.dp)) {
        Text(text, color = tint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

/** Generic titled signal row (title + trailing badge + bar + optional subtext). */
@Composable
fun InsightSignalRow(
    title: String,
    badge: String?,
    away: Double?,
    home: Double?,
    modifier: Modifier = Modifier,
    subtext: String? = null,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            badge?.let {
                Box(Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted).padding(horizontal = 8.dp, vertical = 2.dp)) {
                    Text(it, color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        SignalSplitBar(away, home)
        subtext?.let { Text(it, color = AppColors.appAccentAmber, fontSize = 10.sp) }
    }
}

/** L10 dots — cleared = filled green, missed = hollow gray stroke. */
@Composable
fun MiniHitStrip(results: List<Boolean>, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        results.takeLast(10).forEach { hit ->
            Canvas(Modifier.size(5.dp)) {
                if (hit) drawCircle(InsightOver)
                else drawCircle(AppColors.appTextMuted, style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx()))
            }
        }
    }
}

/** Divider + "label ›" full-width footer button. */
@Composable
fun InsightExpandFooter(label: String, onTap: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder))
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onTap).padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("$label ›", color = AppColors.appPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** Verdict block + N rows + footer, shimmering. */
@Composable
fun InsightWidgetSkeleton(rows: Int = 3, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().shimmering(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SkeletonBlock(height = 20.dp, width = 200.dp)
        repeat(rows) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row {
                    SkeletonBlock(height = 12.dp, width = 120.dp)
                    Spacer(Modifier.weight(1f))
                    SkeletonCapsule(height = 16.dp, width = 44.dp)
                }
                SkeletonBlock(height = 8.dp)
            }
        }
    }
}

/**
 * "HISTORICAL BACKTEST" (typical_hit) + "THIS SEASON" (season-to-date). Kept
 * strictly separate per the memory rule — never conflate all-time vs season.
 */
@Composable
fun SignalPerformanceStatsSection(
    backtestHit: String?,
    seasonPerformance: SignalPerformance?,
    modifier: Modifier = Modifier,
) {
    val display = SignalSeasonRecordDisplay(seasonPerformance)
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        backtestHit?.let {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("HISTORICAL BACKTEST", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(it, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("THIS SEASON", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            val tone = when (display.tone) {
                SignalSeasonRecordDisplay.Tone.POSITIVE -> AppColors.appWin
                SignalSeasonRecordDisplay.Tone.NEGATIVE -> AppColors.appLoss
                SignalSeasonRecordDisplay.Tone.NEUTRAL -> AppColors.appTextPrimary
                SignalSeasonRecordDisplay.Tone.EMPTY -> AppColors.appTextMuted
            }
            Text(
                display.detail,
                color = if (display.isSmallSample) tone.copy(alpha = 0.6f) else tone,
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
