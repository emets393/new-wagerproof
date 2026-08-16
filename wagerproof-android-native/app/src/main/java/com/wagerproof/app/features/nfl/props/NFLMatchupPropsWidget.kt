package com.wagerproof.app.features.nfl.props

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
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
import com.wagerproof.app.features.nfl.NFLTeamColors
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.NFLPropFeed
import com.wagerproof.app.features.props.NFLPropFeedItem
import com.wagerproof.app.features.props.components.NFLPlayerHeadshot
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.InsightThresholds
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropMarket
import com.wagerproof.core.models.NFLPropRecentGame
import com.wagerproof.core.models.NFLPropSignal
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.stores.PropsStore
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Player-props digest for the NFL game-detail sheet — port of iOS
 * `NFLMatchupPropsWidget`.
 *
 * Live 2026 path: `nfl_prop_player_pages` + trend game logs. The strongest
 * qualified L10 signal gets a values-vs-line chart; remaining signals stay
 * compact and tappable. Full team-grouped depth is [NFLMatchupPropsDetailSheet].
 */
@Composable
fun NFLMatchupPropsWidget(
    awayTeam: String,
    homeTeam: String,
    propsStore: PropsStore,
    onSelect: (NFLPlayerPropSelection) -> Unit,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val summary = propsStore.nflPropsInsight(awayTeam, homeTeam) ?: return
    val itemsById = remember(awayTeam, homeTeam, propsStore.nflPlayers) {
        val players = propsStore.nflPlayers(awayTeam, homeTeam)
        NFLPropFeed.items(players).associateBy { it.player.playerId ?: it.player.playerName }
    }

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
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                AppIcon.FOOTBALL_FILL.imageVector,
                null,
                tint = AppColors.appPrimary,
                modifier = Modifier.size(16.dp),
            )
            Text("Player Props", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
            Box(Modifier.weight(1f))
            summary.badge?.let { badge ->
                val badgeColor = hexColor(badge.tintHex)
                Text(
                    badge.text,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.4.sp,
                    color = badgeColor,
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(badgeColor.copy(alpha = 0.16f))
                        .padding(horizontal = 8.dp, vertical = 3.dp),
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
                AppIcon.CHART_BAR_FILL.imageVector,
                null,
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

        val featured = summary.featuredPlayerId?.let { id -> summary.signals.firstOrNull { it.playerId == id } }
        val featuredItem = featured?.let { itemsById[it.playerId] }
        if (featured != null && featuredItem != null) {
            FeaturedNFLPropSignalCard(
                signal = featured,
                onTap = { onSelect(selection(featuredItem, featured.market.market)) },
            )
        }

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
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    secondary.forEach { signal ->
                        itemsById[signal.playerId]?.let { item ->
                            NFLPropSignalRow(
                                signal = signal,
                                onTap = { onSelect(selection(item, signal.market.market)) },
                            )
                        }
                    }
                }
            }
        }

        InsightExpandFooter(label = "All ${summary.totalProps} props", onTap = onExpand)
    }
}

private fun selection(item: NFLPropFeedItem, market: String) = NFLPlayerPropSelection(
    player = item.player,
    preferredMarket = market,
    transitionID = item.selection.transitionID,
)

@Composable
private fun FeaturedNFLPropSignalCard(
    signal: NFLPropSignal,
    onTap: () -> Unit,
) {
    val market = signal.market
    val tint = nflPropRateTint(market)
    val ring = NFLTeamColors.colorPair(signal.teamAbbr).primary
    val shape = RoundedCornerShape(14.dp)

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.30f))
            .border(0.75.dp, AppColors.appBorder.copy(alpha = 0.50f), shape)
            .clickable(onClick = onTap)
            .padding(12.dp)
            .semantics {
                contentDescription = "${signal.playerName}, ${market.label}, ${sidePill(market)}, " +
                    "${fractionLabel(market)} recent games over, ${pctLabel(market)}"
            },
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(40.dp).clip(CircleShape).border(1.5.dp, ring.copy(alpha = 0.85f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                NFLPlayerHeadshot(signal.playerName, signal.playerId, signal.headshotUrl, 40.dp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(signal.playerName, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 1)
                Text(playerContext(signal), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary, maxLines = 1)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(pctLabel(market), fontSize = 24.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, color = tint)
                Text("${fractionLabel(market)} over", fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
            }
            Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(11.dp))
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(market.label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 1)
            Text(
                sidePill(market),
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.35.sp,
                color = tint,
                modifier = Modifier.clip(CircleShape).background(tint.copy(alpha = 0.13f)).padding(horizontal = 7.dp, vertical = 3.dp),
            )
            Spacer(Modifier.weight(1f))
            val odds = NFLPlayerProps.formatOdds(market.overPrice)
            if (odds != "-") {
                Text(odds, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = AppColors.appTextSecondary)
            }
        }

        NFLPropEvidenceChart(
            games = market.recentGames.takeLast(10),
            line = market.closeLine ?: if (market.isYesNo) 0.5 else market.clearThreshold,
            isYesNo = market.isYesNo,
        )

        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            NFLPropStat("RECENT", pctLabel(market), tint)
            NFLPropStat("L10", fractionLabel(market), AppColors.appTextPrimary)
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                LegendItem("Above", AppColors.appWin)
                LegendItem("At/below", AppColors.appAccentBlue)
            }
        }
    }
}

@Composable
private fun NFLPropSignalRow(
    signal: NFLPropSignal,
    onTap: () -> Unit,
) {
    val market = signal.market
    val tint = nflPropRateTint(market)
    val ring = NFLTeamColors.colorPair(signal.teamAbbr).primary
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.24f))
            .border(0.75.dp, AppColors.appBorder.copy(alpha = 0.42f), shape)
            .clickable(onClick = onTap)
            .padding(10.dp)
            .semantics {
                contentDescription = "${signal.playerName}, ${market.label}, ${rowSubtitle(market)}, " +
                    "${fractionLabel(market)} recent games over, ${pctLabel(market)}"
            },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                Modifier.size(30.dp).clip(CircleShape).border(1.5.dp, ring.copy(alpha = 0.8f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                NFLPlayerHeadshot(signal.playerName, signal.playerId, signal.headshotUrl, 30.dp)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(signal.playerName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 1)
                Text(rowSubtitle(market), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary, maxLines = 1)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(pctLabel(market), fontSize = 17.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, color = tint)
                Text("${fractionLabel(market)} over", fontSize = 8.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
            }
            Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(10.dp))
        }
        NFLPropRecentOutcomeTrack(market.miniStrip.map { it.cleared })
    }
}

@Composable
private fun NFLPropRecentOutcomeTrack(cleared: List<Boolean>) {
    if (cleared.isEmpty()) return
    val win = AppColors.appWin
    val miss = AppColors.appAccentBlue.copy(alpha = 0.66f)
    Canvas(Modifier.fillMaxWidth().height(7.dp)) {
        val count = cleared.size
        val gap = 3.dp.toPx()
        val width = max(2f, (size.width - gap * (count - 1)) / count)
        cleared.forEachIndexed { index, hit ->
            val x = index * (width + gap)
            drawRoundRect(
                color = if (hit) win else miss,
                topLeft = Offset(x, 0f),
                size = Size(width, size.height),
                cornerRadius = CornerRadius(3.dp.toPx(), 3.dp.toPx()),
            )
        }
    }
}

private data class NFLPropChartBar(val id: Int, val opp: String, val value: Double, val cleared: Boolean)

@Composable
private fun NFLPropEvidenceChart(
    games: List<NFLPropRecentGame>,
    line: Double,
    isYesNo: Boolean,
    modifier: Modifier = Modifier,
) {
    val bars = games.mapIndexedNotNull { index, game ->
        val value = game.actual ?: return@mapIndexedNotNull null
        NFLPropChartBar(index, game.opp ?: "W${game.week ?: 0}", value, value > line)
    }
    if (bars.isEmpty()) {
        Text(
            "No recent game results",
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = AppColors.appTextMuted,
            modifier = modifier.fillMaxWidth().height(96.dp).padding(top = 40.dp),
        )
        return
    }

    val maxValue = maxOf(line * 1.5, bars.maxOf { it.value }, line + 1.0, 1.0)
    val clearedColor = AppColors.appWin
    val missedColor = AppColors.appAccentBlue.copy(alpha = 0.72f)
    val ruleColor = AppColors.appAccentAmber
    val plotBackground = AppColors.appSurface.copy(alpha = 0.28f)
    val axisLabelColor = AppColors.appTextMuted
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

        bars.forEach { bar ->
            val centerX = sideGutter + slot * bar.id + slot / 2f
            val barTop = y(bar.value).coerceIn(topGutter, plotBottom)
            val color = if (bar.cleared) clearedColor else missedColor
            drawRoundRect(
                color = color,
                topLeft = Offset(centerX - barWidth / 2f, barTop),
                size = Size(barWidth, (plotBottom - barTop).coerceAtLeast(0f)),
                cornerRadius = CornerRadius(3.dp.toPx(), 3.dp.toPx()),
            )
            valuePaint.color = color.toArgb()
            val label = if (isYesNo) {
                if (bar.value >= 1) "Y" else "N"
            } else if (bar.value == bar.value.roundToInt().toDouble()) {
                bar.value.toInt().toString()
            } else {
                String.format(java.util.Locale.US, "%.1f", bar.value)
            }
            drawContext.canvas.nativeCanvas.drawText(
                label,
                centerX,
                (barTop - 2.dp.toPx()).coerceAtLeast(valuePaint.textSize),
                valuePaint,
            )
            if (bar.id in labelIndices) {
                drawContext.canvas.nativeCanvas.drawText(bar.opp, centerX, size.height - 4.dp.toPx(), datePaint)
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
            if (isYesNo) "TD" else "LINE ${NFLPlayerProps.formatLine(line)}",
            size.width - sideGutter,
            (ruleY - 3.dp.toPx()).coerceAtLeast(rulePaint.textSize),
            rulePaint,
        )
    }
}

@Composable
private fun NFLPropStat(label: String, value: String, tint: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(label, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp, color = AppColors.appTextMuted)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = tint)
    }
}

@Composable
private fun LegendItem(text: String, color: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(RoundedCornerShape(2.dp)).background(color))
        Text(text, fontSize = 8.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
    }
}

private fun playerContext(signal: NFLPropSignal): String {
    val opp = signal.opponent?.let { opponent ->
        val prefix = if (signal.isHome == true) "vs" else "@"
        "$prefix ${NFLTeams.abbr(opponent)}"
    }
    return listOfNotNull(signal.teamAbbr, signal.position, opp)
        .filter { it.isNotEmpty() }
        .joinToString(" · ")
}

private fun pctLabel(market: NFLPropMarket): String {
    val rate = market.l10HitRate ?: return "—"
    return "${(rate * 100).roundToInt()}%"
}

private fun fractionLabel(market: NFLPropMarket): String {
    val (hits, n) = market.l10Hits
    if (n <= 0) return "—"
    return "$hits/$n"
}

private fun sidePill(market: NFLPropMarket): String {
    if (market.isYesNo) return "YES ${NFLPlayerProps.formatOdds(market.overPrice)}"
    return "OVER ${NFLPlayerProps.formatLine(market.closeLine)}"
}

private fun rowSubtitle(market: NFLPropMarket): String {
    if (market.isYesNo) return "${market.label} · Yes ${NFLPlayerProps.formatOdds(market.overPrice)}"
    return "${market.label} · Over ${NFLPlayerProps.formatLine(market.closeLine)}"
}

private fun nflPropRateTint(market: NFLPropMarket): Color {
    val n = market.l10Hits.n
    val rate = market.l10HitRate
    if (n < InsightThresholds.propSampleMin || rate == null) return AppColors.appTextSecondary
    val pct = rate * 100
    if (pct >= InsightThresholds.propHot) return AppColors.appWin
    if (pct <= InsightThresholds.propCold) return AppColors.appAccentBlue
    if (pct >= 55) return AppColors.appAccentAmber
    return AppColors.appTextSecondary
}
