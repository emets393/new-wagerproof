package com.wagerproof.app.features.mlb.props

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamewidgets.InsightExpandFooter
import com.wagerproof.app.features.gamewidgets.InsightVerdictLine
import com.wagerproof.app.features.gamewidgets.MiniHitStrip
import com.wagerproof.app.features.props.PlayerPropFeed
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.props.components.PlayerHeadshot
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPropChartBar
import com.wagerproof.core.models.MLBPropComputedAtLine
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBPropsInsight
import com.wagerproof.core.models.PropSignal
import kotlin.math.max

/**
 * "Player Props" insight widget for the MLB detail sheet — port of iOS
 * `MLBMatchupPropsWidget`.
 *
 * Reading order matches iOS: the finding sentence, then the explainer that
 * defines what a percentage means, then ONE featured evidence card for the
 * strongest qualified recent-form signal (ringed headshot, batting-order
 * context, OVER pill, a 10-game bar chart with the posted line drawn across it,
 * RECENT/SEASON cells), then the remaining signals as compact rows. Full
 * team-grouped depth stays one tap away in `MatchupPropsDetailSheet`.
 *
 * FIDELITY-WAIVER #240: iOS composes with `InsightWidgetSection`, which isn't
 * ported — this is the same self-contained digest card the sibling insight
 * widgets use (header + verdict + rows + expand footer).
 */
@Composable
fun MLBMatchupPropsWidget(
    matchup: MLBPropMatchup,
    onSelect: (PlayerPropSelection) -> Unit,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val summary = MLBPropsInsight.summary(matchup) ?: return
    val items = PlayerPropFeed.items(listOf(matchup))
    val itemsById = items.associateBy { it.selection.playerId }

    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                AppIcon.fromSystemName("figure.baseball")?.imageVector ?: AppIcon.CHART_BAR_FILL.imageVector,
                null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp),
            )
            Text("Player Props", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            Box(Modifier.weight(1f))
            summary.badge?.let { badge ->
                val badgeColor = hexColor(badge.tintHex)
                Text(
                    badge.text, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp, color = badgeColor,
                    modifier = Modifier.clip(CircleShape).background(badgeColor.copy(alpha = 0.16f)).padding(horizontal = 8.dp, vertical = 3.dp),
                )
            }
        }

        Text(
            summary.headline,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.Bold,
            color = AppColors.appTextPrimary,
            modifier = Modifier.semantics { contentDescription = "Player props summary: ${summary.headline}" },
        )

        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
            Icon(
                AppIcon.CHART_BAR_FILL.imageVector, null,
                tint = AppColors.appTextSecondary,
                modifier = Modifier.size(12.dp).padding(top = 2.dp),
            )
            Text(
                summary.explainer,
                fontSize = 11.sp,
                lineHeight = 15.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.appTextSecondary,
            )
        }

        InsightVerdictLine(listOf(summary.verdict))

        val featured = summary.featuredPlayerId?.let { id -> summary.signals.firstOrNull { it.playerId == id } }
        val featuredItem = featured?.let { itemsById[it.playerId] }
        if (featured != null && featuredItem != null) {
            FeaturedPropSignalCard(
                signal = featured,
                teamPrimaryHex = featuredItem.teamPrimaryHex,
                onTap = { onSelect(featuredItem.selection) },
            )
        }

        // Anything not featured stays a compact row. When nothing qualified the
        // header drops "OTHER", because there is no featured card above it.
        val secondary = summary.signals.filter { it.playerId != featured?.playerId }
        if (secondary.isNotEmpty()) {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    if (featured == null) "POSTED PROP SIGNALS" else "OTHER POSTED PROP SIGNALS",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.7.sp,
                    color = AppColors.appTextMuted,
                )
                Column(Modifier.fillMaxWidth()) {
                    secondary.forEachIndexed { idx, signal ->
                        if (idx > 0) Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
                        itemsById[signal.playerId]?.let { item ->
                            PropSignalRow(signal, item.teamPrimaryHex, onTap = { onSelect(item.selection) })
                        }
                    }
                }
            }
        }

        InsightExpandFooter(label = "All ${summary.totalProps} props", onTap = onExpand)
    }
}

// MARK: - Featured signal

/**
 * The one signal that earns real estate: identity + posted line + a 10-game
 * evidence chart. Everything here reads off the SAME [MLBPropComputedAtLine]
 * the headline was built from, so the card cannot contradict the sentence.
 */
@Composable
private fun FeaturedPropSignalCard(
    signal: PropSignal,
    teamPrimaryHex: Long,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val computed = signal.headline.computed
    val market = MLBPlayerProps.marketLabel(signal.headline.row.market)
    val tint = propRateTint(computed)
    val shape = RoundedCornerShape(14.dp)

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.30f))
            .border(0.75.dp, AppColors.appBorder.copy(alpha = 0.50f), shape)
            .clickable(onClick = onTap)
            .padding(12.dp)
            .semantics {
                contentDescription = "${signal.playerName}, $market, over " +
                    "${MLBPlayerProps.formatLine(computed.line)}, ${computed.l10.fractionLabel} recent games over, " +
                    "${computed.l10.pctLabel} recent over rate, ${computed.season.pctLabel} season over rate"
            },
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(40.dp).clip(CircleShape)
                    .border(1.5.dp, hexColor(teamPrimaryHex).copy(alpha = 0.85f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PlayerHeadshot(playerId = signal.playerId, size = 40.dp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    signal.playerName,
                    fontSize = 15.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 1,
                )
                Text(
                    playerContext(signal),
                    fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary, maxLines = 1,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    computed.l10.pctLabel,
                    fontSize = 24.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, color = tint,
                )
                Text(
                    "${computed.l10.fractionLabel} over",
                    fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted,
                )
            }
            Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(11.dp))
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(market, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 1)
            Text(
                "OVER ${MLBPlayerProps.formatLine(computed.line)}",
                fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.35.sp, color = tint,
                modifier = Modifier.clip(CircleShape).background(tint.copy(alpha = 0.13f)).padding(horizontal = 7.dp, vertical = 3.dp),
            )
            Spacer(Modifier.weight(1f))
            val overOdds = MLBPlayerProps.formatOdds(computed.overOdds)
            if (overOdds != "-") {
                Text(
                    overOdds,
                    fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
                    color = AppColors.appTextSecondary,
                )
            }
        }

        PropEvidenceChart(bars = computed.chartGames.takeLast(10), line = computed.line)

        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            PropStat("RECENT", computed.l10.pctLabel, tint)
            PropStat("SEASON", computed.season.pctLabel, AppColors.appTextPrimary)
            Spacer(Modifier.weight(1f))
            ChartLegend()
        }
    }
}

/** "NYY · Batting #3" / "LAD · Starting pitcher" — mirrors iOS `playerContext`. */
internal fun playerContext(signal: PropSignal): String {
    val role = if (signal.isPitcher) "Starting pitcher" else signal.battingOrder?.let { "Batting #$it" }
    return listOfNotNull(signal.teamAbbr.takeIf { it.isNotEmpty() }, role).joinToString(" · ")
}

@Composable
private fun PropStat(label: String, value: String, tint: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(label, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = AppColors.appTextMuted)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = tint)
    }
}

@Composable
private fun ChartLegend() {
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
        LegendItem("Above", AppColors.appWin)
        LegendItem("At/below", AppColors.appAccentBlue)
    }
}

@Composable
private fun LegendItem(text: String, color: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(RoundedCornerShape(2.dp)).background(color))
        Text(text, fontSize = 8.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
    }
}

/**
 * The last 10 results at the posted line, on a Compose [Canvas] — port of iOS's
 * Swift-Charts `PropEvidenceChart`. Green bars cleared the line, blue bars did
 * not, and the dashed amber rule IS the posted line, so "5 of 10 over" is
 * countable rather than asserted.
 *
 * Y domain matches iOS exactly (`max(line * 1.5, maxBar, line + 1, 1)`) so the
 * rule never lands on the very top edge of a flat series.
 */
@Composable
private fun PropEvidenceChart(bars: List<MLBPropChartBar>, line: Double, modifier: Modifier = Modifier) {
    if (bars.isEmpty()) {
        Text(
            "No recent game results",
            fontSize = 11.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextMuted,
            modifier = modifier.fillMaxWidth().height(96.dp).padding(top = 40.dp),
        )
        return
    }

    val maxValue = propChartMaximum(bars.map { it.value }, line)
    val clearedColor = AppColors.appWin
    val missedColor = AppColors.appAccentBlue.copy(alpha = 0.72f)
    val ruleColor = AppColors.appAccentAmber
    val plotBackground = AppColors.appSurface.copy(alpha = 0.28f)
    val axisLabelColor = AppColors.appTextMuted
    // Only the first, middle and last bars get a date tick — iOS `dateLabelIds`.
    val labelIndices = setOf(0, bars.size / 2, bars.size - 1)

    Canvas(modifier.fillMaxWidth().height(112.dp)) {
        drawRoundRect(color = plotBackground, cornerRadius = CornerRadius(8.dp.toPx(), 8.dp.toPx()))

        val topGutter = 12.dp.toPx()
        val bottomGutter = 14.dp.toPx()
        val sideGutter = 6.dp.toPx()
        val plotWidth = (size.width - sideGutter * 2).coerceAtLeast(1f)
        val plotBottom = size.height - bottomGutter
        val plotHeight = (plotBottom - topGutter).coerceAtLeast(1f)
        val slot = plotWidth / bars.size
        val barWidth = max(2f, slot * 0.56f)

        val valuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 7.sp.toPx()
            textAlign = Paint.Align.CENTER
            isFakeBoldText = true
        }
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = axisLabelColor.toArgb()
            textSize = 8.sp.toPx()
            textAlign = Paint.Align.CENTER
        }
        val rulePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = ruleColor.toArgb()
            textSize = 7.sp.toPx()
            textAlign = Paint.Align.RIGHT
            isFakeBoldText = true
        }

        fun y(value: Double): Float = plotBottom - (plotHeight * (value / maxValue)).toFloat()

        bars.forEachIndexed { index, bar ->
            val centerX = sideGutter + slot * index + slot / 2f
            val barTop = y(bar.value).coerceIn(topGutter, plotBottom)
            val color = if (bar.cleared) clearedColor else missedColor
            drawRoundRect(
                color = color,
                topLeft = Offset(centerX - barWidth / 2f, barTop),
                size = Size(barWidth, (plotBottom - barTop).coerceAtLeast(0f)),
                cornerRadius = CornerRadius(3.dp.toPx(), 3.dp.toPx()),
            )
            valuePaint.color = color.toArgb()
            drawContext.canvas.nativeCanvas.drawText(
                MLBPlayerProps.formatBarValue(bar.value),
                centerX,
                (barTop - 2.dp.toPx()).coerceAtLeast(valuePaint.textSize),
                valuePaint,
            )
            if (index in labelIndices) {
                shortPropChartDate(bar.date)?.let {
                    drawContext.canvas.nativeCanvas.drawText(it, centerX, size.height - 4.dp.toPx(), datePaint)
                }
            }
        }

        val ruleY = y(line).coerceIn(topGutter, plotBottom)
        drawLine(
            color = ruleColor,
            start = Offset(sideGutter, ruleY),
            end = Offset(size.width - sideGutter, ruleY),
            strokeWidth = 1.25.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())),
        )
        drawContext.canvas.nativeCanvas.drawText(
            "LINE ${MLBPlayerProps.formatLine(line)}",
            size.width - sideGutter,
            (ruleY - 3.dp.toPx()).coerceAtLeast(rulePaint.textSize),
            rulePaint,
        )
    }
}

/** Y-axis maximum, extracted for tests. Mirrors iOS `PropEvidenceChart.maxValue`. */
internal fun propChartMaximum(values: List<Double>, line: Double): Double =
    maxOf(line * 1.5, values.maxOrNull() ?: 0.0, line + 1.0, 1.0)

/** "2026-07-14" → "7/14". Null when the row carries no parseable date. */
internal fun shortPropChartDate(iso: String?): String? {
    val parts = iso?.split("-") ?: return null
    if (parts.size < 3) return null
    val month = parts[1].toIntOrNull() ?: return null
    val day = parts[2].take(2).toIntOrNull() ?: return null
    return "$month/$day"
}

/** ≥70 green · ≤30 blue · ≥55 amber · else muted. Mirrors iOS `propRateTint`. */
private fun propRateTint(computed: MLBPropComputedAtLine): Color {
    val pct = computed.l10.pct
    if (computed.l10.lowConfidence || pct == null) return AppColors.appTextSecondary
    return when {
        pct >= 70 -> AppColors.appWin
        pct <= 30 -> AppColors.appAccentBlue
        pct >= 55 -> AppColors.appAccentAmber
        else -> AppColors.appTextSecondary
    }
}

/** One digest row: headshot ringed with team color · name + L10 strip · line + pct. */
@Composable
fun PropSignalRow(
    signal: PropSignal,
    teamPrimaryHex: Long,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val computed = signal.headline.computed
    val lowConfidence = computed.l10.lowConfidence
    val pct = computed.l10.pct
    val pctColor: Color = when {
        lowConfidence || pct == null -> AppColors.appTextSecondary
        pct >= 70 -> hexColor(0x22C55EL)
        pct >= 55 -> hexColor(0xEAB308L)
        pct <= 30 -> hexColor(0xEF4444L)
        else -> AppColors.appTextSecondary
    }
    Row(
        modifier.fillMaxWidth().clickable(onClick = onTap).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).border(1.5.dp, hexColor(teamPrimaryHex).copy(alpha = 0.8f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PlayerHeadshot(playerId = signal.playerId, size = 28.dp)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(signal.playerName, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary, maxLines = 1)
            if (computed.miniStrip.isEmpty()) {
                Text(
                    if (signal.isPitcher) "SP" else signal.battingOrder?.let { "#$it" } ?: "",
                    fontSize = 10.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextMuted,
                )
            } else {
                MiniHitStrip(computed.miniStrip.map { it.cleared })
            }
            if (lowConfidence) {
                Text("small sample", fontSize = 9.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextMuted)
            }
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                "${MLBPropsInsight.marketShort(signal.headline.row.market)} ${MLBPlayerProps.formatLine(computed.line)}",
                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, color = AppColors.appTextPrimary, maxLines = 1,
            )
            Text(
                computed.l10.pctLabel, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = pctColor,
                modifier = Modifier.clip(CircleShape).background(pctColor.copy(alpha = 0.13f)).padding(horizontal = 6.dp, vertical = 1.dp),
            )
        }
        Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(11.dp))
    }
}
