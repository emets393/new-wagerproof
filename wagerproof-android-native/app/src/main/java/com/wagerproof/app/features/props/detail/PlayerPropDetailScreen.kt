package com.wagerproof.app.features.props.detail

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.props.PropsFormatting
import com.wagerproof.app.features.props.RollingNumber
import com.wagerproof.app.features.props.teamGlassDisc
import com.wagerproof.app.features.props.components.PlayerHeadshot
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPitcherArchetypes
import com.wagerproof.core.models.MLBPlayerPropRow
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBTeams
import kotlinx.coroutines.launch

/**
 * Full-page MLB player-prop detail — collapsing hero over a two-team aura glow,
 * one collapsing widget per posted market. A segmented market picker pinned in
 * the hero scroll-spies whichever market is in view; tapping a segment scrolls
 * that widget flush under the collapsed hero. Each market keeps its own selected
 * line; the bottom scrubber + hero hit-rate track the market in view.
 * Port of iOS `PlayerPropDetailView.swift`.
 */
@Composable
fun PlayerPropDetailScreen(
    selection: PlayerPropSelection,
    initialLine: Double? = null,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    val scope = rememberCoroutineScope()
    val markets = selection.props
    val listState = rememberLazyListState()

    val initialMarket = remember(selection.id) {
        val preferred = selection.preferredMarket?.let { m -> markets.firstOrNull { it.market == m } }
        (preferred ?: markets.firstOrNull())?.market ?: ""
    }
    var activeMarket by remember(selection.id) { mutableStateOf(initialMarket) }
    var suppressSpyUntil by remember { mutableLongStateOf(0L) }

    val selectedLines = remember(selection.id) {
        mutableStateMapOf<String, Double>().apply {
            val firstRow = markets.firstOrNull { it.market == initialMarket }
            if (firstRow != null && initialLine != null && firstRow.lines.any { it.line == initialLine }) {
                this[initialMarket] = initialLine
            }
        }
    }

    fun lineFor(market: String): Double {
        selectedLines[market]?.let { return it }
        val row = markets.firstOrNull { it.market == market } ?: return 0.0
        return MLBPlayerProps.defaultLine(row.lines) ?: 0.0
    }

    val activeRow = markets.firstOrNull { it.market == activeMarket } ?: markets.firstOrNull()
    val teamColor = hexColor(MLBTeams.colors(selection.teamName).primary)
    val oppColor = hexColor(MLBTeams.colors(selection.opponentName).primary)

    // Scroll-spy: the topmost visible market widget is the active market.
    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex }.collect { idx ->
            if (System.currentTimeMillis() < suppressSpyUntil) return@collect
            markets.getOrNull(idx)?.market?.let { m -> if (m != activeMarket) activeMarket = m }
        }
    }

    Column(Modifier.fillMaxSize().background(AppColors.appSurface)) {
        Box(Modifier.weight(1f)) {
            PropsCollapsingScaffold(
                heroMax = 134.dp,
                heroMin = 116.dp,
                listState = listState,
                aura = { progress -> TeamAuraBackground(teamColor, oppColor, progress) },
                hero = { progress ->
                    Hero(
                        selection = selection,
                        progress = progress,
                        markets = markets,
                        activeMarket = activeMarket,
                        computed = activeRow?.let { MLBPlayerProps.computePropAtLine(it, lineFor(it.market)) },
                        onSelectMarket = { m, index ->
                            activeMarket = m
                            suppressSpyUntil = System.currentTimeMillis() + 450
                            scope.launch { listState.animateScrollToItem(index) }
                        },
                    )
                },
            ) {
                items(markets.size, key = { markets[it].market }) { i ->
                    val row = markets[i]
                    MarketWidget(row = row, line = lineFor(row.market))
                }
                item { Spacer(Modifier.height(120.dp)) }
            }

            // Back affordance (nav bar hidden; name lives in the hero).
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

        // Bottom scrubber for the in-view market.
        activeRow?.let { row ->
            PropLineScrubber(
                lines = row.lines,
                selectedLine = lineFor(row.market),
                onLineChange = { selectedLines[row.market] = it },
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }
    }
}

@Composable
private fun Hero(
    selection: PlayerPropSelection,
    progress: Float,
    markets: List<MLBPlayerPropRow>,
    activeMarket: String,
    computed: com.wagerproof.core.models.MLBPropComputedAtLine?,
    onSelectMarket: (String, Int) -> Unit,
) {
    val headSize = lerp(50f, 32f, progress).dp
    val detail = (1f - progress * 1.9f).coerceIn(0f, 1f)
    val pct = computed?.l10?.pct
    val teamColor = hexColor(MLBTeams.colors(selection.teamName).primary)
    val oppColor = hexColor(MLBTeams.colors(selection.opponentName).primary)

    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(lerp(8f, 6f, progress).dp)) {
        // Top row.
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(if (selection.gameIsDay) "☀️ Day" else "🌙 Night", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            if (selection.opponentAbbr.isNotEmpty()) {
                Spacer(Modifier.size(8.dp))
                Text("vs ${selection.opponentAbbr}", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            Text(PropsFormatting.gameTime(selection.gameTimeEt), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(headSize + 8.dp).teamGlassDisc(teamColor, oppColor), contentAlignment = Alignment.Center) {
                PlayerHeadshot(selection.playerId, size = headSize)
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(selection.playerName, color = AppColors.appTextPrimary, fontSize = lerp(19f, 16f, progress).sp, fontWeight = FontWeight.Black, maxLines = 1)
                if (detail > 0.04f) {
                    Text(subtitle(selection), color = AppColors.appTextSecondary.copy(alpha = detail), fontSize = 11.sp, maxLines = 1)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.Top) {
                    RollingNumber(
                        value = pct?.toString() ?: "—",
                        fontSize = lerp(27f, 21f, progress).sp,
                        color = AppColors.appPrimary,
                        fontWeight = FontWeight.Black,
                    )
                    if (pct != null) {
                        Text("%", color = AppColors.appPrimary, fontSize = lerp(16f, 13f, progress).sp, fontWeight = FontWeight.Black)
                    }
                }
                if (detail > 0.04f && computed != null) {
                    Text("${computed.l10.over}/${computed.l10.games} L10", color = AppColors.appTextSecondary.copy(alpha = detail), fontSize = 10.sp)
                }
            }
        }
        if (markets.size > 1) {
            SegmentedMarketPicker(markets, activeMarket, onSelectMarket)
        }
    }
}

@Composable
private fun SegmentedMarketPicker(
    markets: List<MLBPlayerPropRow>,
    activeMarket: String,
    onSelect: (String, Int) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        markets.forEachIndexed { index, row ->
            val selected = row.market == activeMarket
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (selected) AppColors.appSurfaceElevated else Color.Transparent)
                    .clickable { onSelect(row.market, index) }
                    .padding(vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    MLBPlayerProps.marketLabel(row.market),
                    color = if (selected) AppColors.appTextPrimary else AppColors.appTextSecondary,
                    fontSize = 11.sp,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun MarketWidget(row: MLBPlayerPropRow, line: Double) {
    val c = MLBPlayerProps.computePropAtLine(row, line) ?: return
    WidgetCollapsingSection(title = MLBPlayerProps.marketLabel(row.market), systemImage = "chart.bar.fill") {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(MLBPlayerProps.buildVerdict(row, c), color = AppColors.appTextPrimary, fontSize = 14.sp)
            RecentPropBarChart(bars = c.chartGames, line = line)
            Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.5f)))
            PropContextTiles(row, c)
            if (!row.isPitcher && c.contextualArchetype != null) {
                Text(
                    "Archetype split is based on the opposing starting pitcher only — relievers are not counted.",
                    color = AppColors.appTextMuted, fontSize = 10.sp, fontStyle = FontStyle.Italic,
                )
            }
            Text(
                "${MLBPlayerProps.marketLabel(row.market)} · O ${MLBPlayerProps.formatLine(line)} · ${MLBPlayerProps.formatOdds(c.overOdds)} / ${MLBPlayerProps.formatOdds(c.underOdds)}",
                color = AppColors.appTextSecondary, fontSize = 12.sp,
            )
        }
    }
}

private fun subtitle(selection: PlayerPropSelection): String {
    val parts = mutableListOf<String>()
    selection.position?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    selection.batSide?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    if (!selection.isPitcher) {
        parts.add("vs ${selection.opposingStarterName} (${selection.opposingStarterHand}HP)")
    }
    val meta = MLBPitcherArchetypes.displayMeta(selection.opposingArchetypeName)
    if (meta != null && !selection.isPitcher) {
        parts.add("${meta.icon} ${meta.label}")
    }
    return parts.joinToString(" · ")
}
