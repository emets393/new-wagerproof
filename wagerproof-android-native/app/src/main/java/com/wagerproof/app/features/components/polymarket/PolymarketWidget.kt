package com.wagerproof.app.features.components.polymarket

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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.app.features.gamecards.TeamColorPair
import com.wagerproof.app.features.gamecards.teamVisible
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.PolymarketGameMarkets
import com.wagerproof.core.models.PolymarketMarket
import com.wagerproof.core.models.PolymarketMarketType
import com.wagerproof.core.services.PolymarketService
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Full market-odds widget for every game sheet — port of iOS
 * `Polymarket/PolymarketWidget.swift`. One fetch loads all three markets; the
 * toggle re-slices. "Spread" reads "Run Line" for MLB.
 */
@Composable
fun PolymarketWidget(
    league: String,
    awayTeam: String,
    homeTeam: String,
    awayColors: TeamColorPair,
    homeColors: TeamColorPair,
    awayAbbr: String,
    homeAbbr: String,
    modifier: Modifier = Modifier,
) {
    var markets by remember(league, awayTeam, homeTeam) { mutableStateOf<PolymarketGameMarkets?>(null) }
    var loaded by remember(league, awayTeam, homeTeam) { mutableStateOf(false) }
    var selected by remember(league, awayTeam, homeTeam) { mutableStateOf(PolymarketMarketType.MONEYLINE) }

    LaunchedEffect(league, awayTeam, homeTeam) {
        markets = PolymarketService.shared.markets(league, awayTeam, homeTeam)
        loaded = true
    }

    val available = markets?.markets?.keys?.toList().orEmpty()
    if (selected !in available) available.firstOrNull()?.let { selected = it }
    val market = markets?.markets?.get(selected)

    Column(modifier.fillMaxWidth()) {
        when {
            !loaded -> Column(Modifier.shimmering(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SkeletonBlock(height = 28.dp, width = 200.dp, cornerRadius = 14.dp)
                Row { SkeletonBlock(height = 60.dp); Spacer(Modifier.width(10.dp)); SkeletonBlock(height = 60.dp) }
                SkeletonBlock(height = 170.dp, cornerRadius = 16.dp)
            }
            available.isEmpty() -> Text("No market odds yet", color = AppColors.appTextMuted, fontSize = 13.sp)
            else -> {
                MarketToggle(available, selected, league) { selected = it }
                Spacer(Modifier.height(12.dp))
                market?.let {
                    OddsRow(it, selected, awayColors, homeColors, awayAbbr, homeAbbr)
                    Spacer(Modifier.height(12.dp))
                    PolymarketChartCard(it, selected, awayColors, homeColors, awayAbbr, homeAbbr)
                }
            }
        }
    }
}

@Composable
private fun MarketToggle(
    available: List<PolymarketMarketType>,
    selected: PolymarketMarketType,
    league: String,
    onSelect: (PolymarketMarketType) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        available.forEach { type ->
            val label = if (type == PolymarketMarketType.SPREAD && league.lowercase() == "mlb") "Run Line" else type.displayLabel
            val active = type == selected
            Box(
                Modifier
                    .clip(CircleShape)
                    .background(if (active) AppColors.appPrimary.copy(alpha = 0.20f) else Color.Transparent)
                    .then(if (active) Modifier.border(0.5.dp, AppColors.appPrimary.copy(alpha = 0.55f), CircleShape) else Modifier)
                    .clickable { onSelect(type) }
                    .padding(horizontal = 14.dp, vertical = 6.dp),
            ) {
                Text(label, color = if (active) AppColors.appPrimary else AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun OddsRow(
    market: PolymarketMarket,
    type: PolymarketMarketType,
    awayColors: TeamColorPair,
    homeColors: TeamColorPair,
    awayAbbr: String,
    homeAbbr: String,
) {
    val history = market.priceHistory
    val awayNow = market.currentAwayOdds ?: history.lastOrNull()?.p
    val homeNow = market.currentHomeOdds ?: history.lastOrNull()?.let { 1 - it.p }
    val prev = if (history.size >= 2) history[history.size - 2].p else null
    val awayDelta = if (awayNow != null && prev != null) (awayNow - prev) * 100 else null

    val (awayTint, homeTint) = if (type == PolymarketMarketType.TOTAL) {
        AppColors.appWin to AppColors.appLoss
    } else {
        awayColors.primary.teamVisible(0.6f) to homeColors.primary.teamVisible(0.6f)
    }
    val awayLabel = if (type == PolymarketMarketType.TOTAL) "Over" else awayAbbr
    val homeLabel = if (type == PolymarketMarketType.TOTAL) "Under" else homeAbbr

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OddsCard(awayLabel, awayNow, awayDelta, awayTint, Modifier.weight(1f))
        OddsCard(homeLabel, homeNow, awayDelta?.let { -it }, homeTint, Modifier.weight(1f))
    }
}

@Composable
private fun OddsCard(label: String, odds: Double?, delta: Double?, tint: Color, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(tint.copy(alpha = 0.10f))
            .padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(tint))
            Spacer(Modifier.width(6.dp))
            Text(label, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(4.dp))
        Text(
            odds?.let { "${(it * 100).toInt()}%" } ?: "—",
            color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
        )
        delta?.takeIf { abs(it) >= 1 }?.let {
            Text(
                "${if (it >= 0) "↗ +" else "↘ "}${it.toInt()}%",
                color = if (it >= 0) AppColors.appWin else AppColors.appLoss, fontSize = 11.sp, fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun PolymarketChartCard(
    market: PolymarketMarket,
    type: PolymarketMarketType,
    awayColors: TeamColorPair,
    homeColors: TeamColorPair,
    awayAbbr: String,
    homeAbbr: String,
) {
    val points = market.priceHistory.takeLast(60)
    Box(
        Modifier
            .fillMaxWidth()
            .height(170.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF0F131C).copy(alpha = 0.5f))
            .border(0.5.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
            .padding(12.dp),
    ) {
        if (points.size < 2) {
            Text("—", color = AppColors.appTextMuted, fontSize = 13.sp, modifier = Modifier.align(Alignment.Center))
        } else {
            val awayTint = if (type == PolymarketMarketType.TOTAL) AppColors.appWin else awayColors.primary.teamVisible(0.72f)
            val homeTint = if (type == PolymarketMarketType.TOTAL) AppColors.appLoss else homeColors.primary.teamVisible(0.72f)
            Canvas(Modifier.fillMaxWidth().height(146.dp)) {
                val ps = points.map { it.p.toFloat() }
                val minP = ps.min()
                val maxP = ps.max()
                val pad = max((maxP - minP) * 0.15f, 0.04f)
                val lo = (minP - pad).coerceAtLeast(0f)
                val hi = (maxP + pad).coerceAtMost(1f)
                val range = max(hi - lo, 0.01f)
                fun path(values: List<Float>) = androidx.compose.ui.graphics.Path().apply {
                    values.forEachIndexed { i, v ->
                        val x = size.width * i / (values.size - 1)
                        val y = size.height * (1f - (v - lo) / range)
                        if (i == 0) moveTo(x, y) else lineTo(x, y)
                    }
                }
                drawPath(path(ps), awayTint, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round))
                drawPath(path(ps.map { 1f - it }), homeTint, style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round))
            }
            Row(Modifier.align(Alignment.TopEnd), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LegendDot(if (type == PolymarketMarketType.TOTAL) "Over" else awayAbbr, if (type == PolymarketMarketType.TOTAL) AppColors.appWin else awayColors.primary.teamVisible(0.72f))
                LegendDot(if (type == PolymarketMarketType.TOTAL) "Under" else homeAbbr, if (type == PolymarketMarketType.TOTAL) AppColors.appLoss else homeColors.primary.teamVisible(0.72f))
            }
        }
    }
}

@Composable
private fun LegendDot(label: String, tint: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(5.dp).clip(CircleShape).background(tint))
        Spacer(Modifier.width(3.dp))
        Text(label, color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
    }
}
