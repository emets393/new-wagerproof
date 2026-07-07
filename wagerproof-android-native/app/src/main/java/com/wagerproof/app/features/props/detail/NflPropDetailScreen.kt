package com.wagerproof.app.features.props.detail

import android.graphics.Paint
import android.graphics.Typeface
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.PropsFormatting
import com.wagerproof.app.features.props.nflTeamColors
import com.wagerproof.app.features.props.SportsbookLogo
import com.wagerproof.app.features.props.components.NFLPlayerHeadshot
import com.wagerproof.app.features.props.components.NFLPropSignalDetailSheet
import com.wagerproof.app.features.props.components.NFLPropSignalGroup
import com.wagerproof.app.features.props.teamGlassDisc
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropBestQuote
import com.wagerproof.core.models.NFLPropMarket
import com.wagerproof.core.models.NFLPropRecentGame
import com.wagerproof.core.models.NFLPropSignalDefinition
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.SignalPerformance
import com.wagerproof.core.services.SignalPerformanceService
import com.wagerproof.core.services.SignalSport
import kotlinx.coroutines.delay
import java.util.Locale

/**
 * Full-page NFL player-prop detail — a collapsing hero over a two-team aura, one
 * collapsing widget per market. Each market is a trend board: consensus close +
 * flags, season game-log bar chart vs the close line, best-book quotes, season
 * stat tiles, and the open→close line move. Each section header has an info (ⓘ)
 * button opening a metric-help sheet; tapping a Posted-Line signal opens the
 * signal sheet keyed by short P-code. Port of iOS `NFLPropDetailView.swift`.
 */
@Composable
fun NflPropDetailScreen(
    selection: NFLPlayerPropSelection,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    val player = selection.player
    val markets = player.markets
    val listState = rememberLazyListState()

    var selectedSignal by remember { mutableStateOf<NFLPropSignalDefinition?>(null) }
    var metricHelp by remember { mutableStateOf<NFLPropMetricHelp?>(null) }
    var propPerfByCode by remember { mutableStateOf<Map<String, SignalPerformance>>(emptyMap()) }

    val headlineMarket = remember(selection.id) {
        selection.preferredMarket?.let { m -> markets.firstOrNull { it.market == m } }
            ?: markets.firstOrNull { it.flags.isNotEmpty() }
            ?: markets.firstOrNull()
    }

    val (teamColor, _) = nflTeamColors(player.team ?: "")
    val (oppColor, _) = nflTeamColors(player.opponent ?: "")

    LaunchedEffect(selection.id) {
        val season = player.season ?: 2025
        val perf = SignalPerformanceService.shared.performances(SignalSport.NFL, season)
        propPerfByCode = perf.entries.associate { (key, value) ->
            (key.substringBefore("_")).uppercase(Locale.US) to value
        }
    }

    // Land on the feed card's headline market when the page opens.
    LaunchedEffect(selection.id) {
        val target = headlineMarket?.market ?: return@LaunchedEffect
        if (markets.size <= 1) return@LaunchedEffect
        delay(380)
        val idx = markets.indexOfFirst { it.market == target }
        if (idx > 0) listState.animateScrollToItem(idx)
    }

    Box(Modifier.fillMaxSize().background(AppColors.appSurface)) {
        PropsCollapsingScaffold(
            heroMax = 88.dp,
            heroMin = 72.dp,
            listState = listState,
            aura = { progress -> TeamAuraBackground(teamColor, oppColor, progress) },
            hero = { progress -> NflHero(selection, progress, teamColor, oppColor) },
        ) {
            items(markets.size, key = { markets[it].market }) { i ->
                MarketTrendBoard(
                    market = markets[i],
                    opponent = player.opponent,
                    onSignalTap = { selectedSignal = it },
                    onMetricHelp = { metricHelp = it },
                )
            }
            item { Footnote() }
            item { Spacer(Modifier.height(80.dp)) }
        }

        Box(
            Modifier
                .windowInsetsPadding(WindowInsets.statusBars)
                .padding(8.dp)
                .size(36.dp)
                .clip(CircleShape)
                .background(AppColors.appSurfaceElevated.copy(alpha = 0.85f))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.CHEVRON_LEFT.imageVector, "Back", tint = AppColors.appTextPrimary, modifier = Modifier.size(18.dp))
        }
    }

    selectedSignal?.let { signal ->
        NFLPropSignalDetailSheet(
            signal = signal,
            seasonRecord = propPerfByCode[signal.id.uppercase(Locale.US)],
            onDismiss = { selectedSignal = null },
        )
    }
    metricHelp?.let { help ->
        NFLPropMetricHelpSheet(help = help, onDismiss = { metricHelp = null })
    }
}

@Composable
private fun NflHero(selection: NFLPlayerPropSelection, progress: Float, teamColor: Color, oppColor: Color) {
    val player = selection.player
    val headSize = lerp(50f, 32f, progress).dp
    val detail = (1f - progress * 1.9f).coerceIn(0f, 1f)

    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(lerp(8f, 6f, progress).dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            player.week?.let {
                Text("Week $it", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.width(8.dp))
            }
            if (player.opponentLabel.isNotEmpty()) {
                Text(player.opponentLabel, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            Text(heroDateLabel(player.gameDate, player.slotLabel), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(headSize + 8.dp).teamGlassDisc(teamColor, oppColor), contentAlignment = Alignment.Center) {
                NFLPlayerHeadshot(player.playerName, player.playerId, player.headshotUrl, headSize)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(player.playerName, color = AppColors.appTextPrimary, fontSize = lerp(19f, 16f, progress).sp, fontWeight = FontWeight.Black, maxLines = 1)
                if (detail > 0.04f) {
                    Text(subtitle(selection), color = AppColors.appTextSecondary.copy(alpha = detail), fontSize = 11.sp, maxLines = 1)
                }
            }
        }
    }
}

private fun heroDateLabel(gameDate: String, slot: String?): String {
    val date = PropsFormatting.dateLabel(gameDate)
    return if (slot != null) "$date · $slot" else date
}

private fun subtitle(selection: NFLPlayerPropSelection): String {
    val p = selection.player
    val parts = mutableListOf<String>()
    p.position?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    p.team?.let { parts.add(it) }
    p.reportStatus?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    return parts.joinToString(" · ")
}

@Composable
private fun MarketTrendBoard(
    market: NFLPropMarket,
    opponent: String?,
    onSignalTap: (NFLPropSignalDefinition) -> Unit,
    onMetricHelp: (NFLPropMetricHelp) -> Unit,
) {
    WidgetCollapsingSection(title = market.label, systemImage = "chart.bar.fill") {
        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
            PropSectionBlock("Posted Line", "posted_line", showsDivider = false, onMetricHelp) {
                Text(lineSummary(market), color = AppColors.appTextPrimary, fontSize = 13.sp)
                if (market.flags.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    NFLPropSignalGroup(market.flags, onSignalTap)
                }
            }
            PropSectionBlock("Game Log", "game_log", showsDivider = true, onMetricHelp) {
                NFLPropTrendChart(market.recentGames, market.clearThreshold, market.isYesNo)
            }
            if (market.hasBestBooks) {
                PropSectionBlock("Best Lines", "book_odds", showsDivider = true, onMetricHelp) {
                    BestBooksSection(market)
                }
            }
            PropSectionBlock("Season Stats", "season_stats", showsDivider = true, onMetricHelp) {
                StatTiles(market, opponent, onMetricHelp)
            }
            if (hasLineMovement(market)) {
                PropSectionBlock("Line Movement", "line_movement", showsDivider = true, onMetricHelp) {
                    Text(lineMovementText(market), color = AppColors.appTextSecondary, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun PropSectionBlock(
    title: String,
    helpKey: String,
    showsDivider: Boolean,
    onMetricHelp: (NFLPropMetricHelp) -> Unit,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (showsDivider) {
                Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.55f)))
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(title.uppercase(), color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Box(
                    Modifier.size(22.dp).clickable { NFLPropMetricHelp.all[helpKey]?.let(onMetricHelp) },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp))
                }
            }
        }
        content()
    }
}

private fun lineSummary(market: NFLPropMarket): String = if (market.isYesNo) {
    "Anytime TD pays ${NFLPlayerProps.formatOdds(market.overPrice)} — ${NFLPlayerProps.formatPct(market.closeYesProb)} implied at close across ${market.nBooks ?: 0} books."
} else {
    "Consensus close ${NFLPlayerProps.formatLine(market.closeLine)} across ${market.nBooks ?: 0} books — Over ${NFLPlayerProps.formatOdds(market.overPrice)} / Under ${NFLPlayerProps.formatOdds(market.underPrice)}."
}

@Composable
private fun BestBooksSection(market: NFLPropMarket) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (market.isYesNo) {
            if (!market.bestOver.isEmpty) BestBookRow("Yes", market.bestOver, showLine = false)
        } else {
            if (!market.bestOver.isEmpty) BestBookRow("Over", market.bestOver, showLine = true)
            if (!market.bestUnder.isEmpty) BestBookRow("Under", market.bestUnder, showLine = true)
        }
    }
}

@Composable
private fun BestBookRow(sideLabel: String, quote: NFLPropBestQuote, showLine: Boolean) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.35f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.45f), shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(sideLabel, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black)
            Text(bestBookLineValue(quote, showLine), color = AppColors.appPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
        }
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("@", color = AppColors.appTextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            SportsbookLogo(quote.bookLogoUrl, quote.bookKey, quote.bookName)
            Text(quote.bookName ?: quote.bookKey ?: "Book", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        }
    }
}

private fun bestBookLineValue(quote: NFLPropBestQuote, showLine: Boolean): String {
    val odds = NFLPlayerProps.formatOdds(quote.price)
    val line = quote.line
    return if (showLine && line != null) "${NFLPlayerProps.formatLine(line)} $odds" else odds
}

@Composable
private fun StatTiles(market: NFLPropMarket, opponent: String?, onMetricHelp: (NFLPropMetricHelp) -> Unit) {
    val tiles = listOf(
        StatTileData("last_game", "Last Game", statValue(market.lastGame), AppColors.appTextPrimary),
        StatTileData("l3_avg", "L3 Avg", statValue(market.l3Avg), AppColors.appTextPrimary),
        StatTileData("l5_avg", "L5 Avg", statValue(market.l5Avg), AppColors.appTextPrimary),
        StatTileData("szn_avg", "Season Avg", statValue(market.sznAvg), AppColors.appTextPrimary),
        StatTileData("szn_high", "Season High", statValue(market.sznMax), AppColors.appTextPrimary),
        StatTileData("opp_defense", "Opp Defense", matchupValue(market.defMatchupIdx, opponent), matchupColor(market.defMatchupIdx)),
    )
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(3).forEach { rowTiles ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                rowTiles.forEach { t ->
                    StatTile(t, Modifier.weight(1f), onMetricHelp)
                }
                repeat(3 - rowTiles.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

private data class StatTileData(val helpKey: String, val title: String, val value: String, val color: Color)

@Composable
private fun StatTile(t: StatTileData, modifier: Modifier, onMetricHelp: (NFLPropMetricHelp) -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.35f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .clickable { NFLPropMetricHelp.all[t.helpKey]?.let(onMetricHelp) }
            .padding(horizontal = 4.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(t.title.uppercase(), color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1)
            Icon(AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appTextSecondary.copy(alpha = 0.85f), modifier = Modifier.size(8.dp))
        }
        Text(t.value, color = t.color, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, maxLines = 2, textAlign = TextAlign.Center)
    }
}

private fun statValue(v: Double?): String {
    if (v == null || !v.isFinite()) return "-"
    return if (v == Math.rint(v)) v.toInt().toString() else String.format(Locale.US, "%.1f", v)
}

private fun matchupValue(idx: Double?, opponent: String?): String {
    if (idx == null || !idx.isFinite()) return "—"
    val pct = (idx - 1) * 100
    return if (!opponent.isNullOrEmpty()) {
        String.format(Locale.US, "%s %+.0f%%", NFLTeamAssets.abbr(opponent), pct)
    } else {
        String.format(Locale.US, "%+.0f%% vs avg", pct)
    }
}

private fun matchupColor(idx: Double?): Color {
    if (idx == null) return AppColors.appTextPrimary
    return when {
        idx >= 1.08 -> AppColors.appPrimary
        idx <= 0.92 -> AppColors.appLoss
        else -> AppColors.appTextPrimary
    }
}

private fun hasLineMovement(market: NFLPropMarket): Boolean = if (market.isYesNo) {
    market.openYesProb != null && market.closeYesProb != null
} else {
    market.openLine != null && market.closeLine != null
}

private fun lineMovementText(market: NFLPropMarket): String {
    if (market.isYesNo) {
        val open = market.openYesProb
        val close = market.closeYesProb
        if (open != null && close != null) {
            return "Implied probability moved ${NFLPlayerProps.formatPct(open)} → ${NFLPlayerProps.formatPct(close)} from open to close."
        }
        return ""
    }
    val open = market.openLine
    val close = market.closeLine
    if (open != null && close != null) {
        val delta = market.lineDelta ?: (close - open)
        val deltaText = if (delta == 0.0) "held steady from open" else String.format(Locale.US, "moved %+.1f from the open", delta)
        val range = market.lineRange?.let { r ->
            if (r > 0) " Books were spread across a ${NFLPlayerProps.formatLine(r)}-point range." else ""
        } ?: ""
        return "Line ${NFLPlayerProps.formatLine(open)} → ${NFLPlayerProps.formatLine(close)} — $deltaText.$range"
    }
    return ""
}

@Composable
private fun Footnote() {
    Text(
        "Lines are the consensus close (median across books). Trends are point-in-time season game logs.",
        color = AppColors.appTextMuted, fontSize = 10.sp, fontStyle = FontStyle.Italic,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
    )
}

// MARK: - Trend chart

/**
 * Season game-log bar chart against the consensus close line — hand-drawn with
 * Compose [Canvas] (no external chart lib). Week-number + opponent-logo labels
 * sit below the plot. Port of iOS `NFLPropTrendChart`.
 */
@Composable
fun NFLPropTrendChart(games: List<NFLPropRecentGame>, line: Double, isYesNo: Boolean) {
    data class Bar(val week: Int?, val opp: String?, val value: Double, val cleared: Boolean)
    val bars = games.mapNotNull { g -> g.actual?.let { Bar(g.week, g.opp, it, it > line) } }
    if (bars.isEmpty()) {
        Text("No prior games this season", color = AppColors.appTextMuted, fontStyle = FontStyle.Italic, fontSize = 13.sp, modifier = Modifier.fillMaxWidth())
        return
    }
    val maxVal = maxOf(line * 1.5, bars.maxOf { it.value }, line + 1, 1.0)
    val primary = AppColors.appPrimary
    val loss = AppColors.appLoss

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Canvas(Modifier.fillMaxWidth().height(176.dp)) {
            val n = bars.size
            val slot = size.width / n
            val barW = slot * 0.62f
            val topInset = 16.dp.toPx()
            val valuePaint = Paint().apply {
                isAntiAlias = true
                textSize = 9.sp.toPx()
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.CENTER
            }
            bars.forEachIndexed { i, bar ->
                val h = (bar.value / maxVal).toFloat() * (size.height - topInset)
                val cx = slot * i + slot / 2f
                val left = cx - barW / 2f
                val top = size.height - h
                drawRoundRect(
                    color = if (bar.cleared) primary else loss.copy(alpha = 0.7f),
                    topLeft = Offset(left, top),
                    size = Size(barW, h),
                    cornerRadius = CornerRadius(2.dp.toPx()),
                )
                valuePaint.color = if (bar.cleared) primary.toArgb() else loss.toArgb()
                drawContext.canvas.nativeCanvas.drawText(barLabel(bar.value), cx, top - 4.dp.toPx(), valuePaint)
            }
            val ty = size.height - (line / maxVal).toFloat() * (size.height - topInset)
            drawLine(
                color = primary.copy(alpha = 0.85f),
                start = Offset(0f, ty), end = Offset(size.width, ty),
                strokeWidth = 1.2.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())),
            )
            val labelPaint = Paint().apply {
                isAntiAlias = true
                textSize = 9.sp.toPx()
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                textAlign = Paint.Align.LEFT
                color = primary.toArgb()
            }
            drawContext.canvas.nativeCanvas.drawText(if (isYesNo) "TD" else "Line ${NFLPlayerProps.formatLine(line)}", 4.dp.toPx(), ty - 3.dp.toPx(), labelPaint)
        }
        // Logo + week labels below the plot.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(0.dp)) {
            bars.forEach { bar ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    val opp = bar.opp
                    if (!opp.isNullOrEmpty()) {
                        val initials = NFLTeamAssets.abbr(opp)
                        Box(Modifier.size(20.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
                            RemoteImage(
                                url = NFLTeamAssets.logo(opp),
                                contentDescription = opp,
                                modifier = Modifier.size(20.dp),
                                contentScale = ContentScale.Fit,
                                error = { InitialsDisc(initials.take(2), 20.dp) },
                            )
                        }
                    } else {
                        Box(Modifier.size(20.dp).clip(CircleShape).background(AppColors.appSurfaceElevated))
                    }
                    Text(bar.week?.let { "W$it" } ?: "—", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                }
            }
        }
        Text("Season game log · oldest left → most recent right", color = AppColors.appTextMuted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

private fun barLabel(v: Double): String =
    if (v == Math.rint(v)) v.toInt().toString() else String.format(Locale.US, "%.1f", v)

// MARK: - Metric help

data class NFLPropMetricHelp(val id: String, val title: String, val body: String) {
    companion object {
        val all: Map<String, NFLPropMetricHelp> = listOf(
            Triple("posted_line", "Posted Line", "The consensus closing line and prices across sportsbooks for this prop market. For anytime TD, the price is the yes-side implied probability — there is no yardage line."),
            Triple("game_log", "Game Log", "Each bar is one prior game this season (oldest left, most recent right). Green cleared the posted line; red missed. The dashed line is today's consensus close. Opponent logos and week numbers sit below each bar."),
            Triple("book_odds", "Best Lines", "The best-shop over and under at the actionable close (T-60 before kickoff), precomputed in the props loader using the same logic as game picks and Outliers. For anytime TD, only the best yes price is shown."),
            Triple("season_stats", "Season Stats", "Point-in-time season form through last week — stats and averages before this game. Tap any tile's info icon for what that specific number means."),
            Triple("last_game", "Last Game", "The player's actual stat total in his most recent game before this week."),
            Triple("l3_avg", "Last 3 Average", "Average stat over the player's prior three games this season."),
            Triple("l5_avg", "Last 5 Average", "Average stat over the player's prior five games this season."),
            Triple("szn_avg", "Season Average", "Average stat across every game the player played this season before this week."),
            Triple("szn_high", "Season High", "The player's single-game high for this stat this season before this week."),
            Triple("opp_defense", "Opponent Defense", "How much this week's opponent allows to players at this position for this prop stat, compared to league average entering the week. Positive (green) = softer matchup (defense allows more than average). Negative (red) = tough matchup."),
            Triple("line_movement", "Line Movement", "How the consensus line moved from the open to the close across books. A rising line often means money came in on the over; a drop often means the under. The cross-book range shows how far apart the tightest and loosest books were at the close."),
        ).associate { it.first to NFLPropMetricHelp(it.first, it.second, it.third) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NFLPropMetricHelpSheet(help: NFLPropMetricHelp, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = AppColors.appSurface) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(20.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(help.title, color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text(help.body, color = AppColors.appTextSecondary, fontSize = 15.sp)
        }
    }
}
