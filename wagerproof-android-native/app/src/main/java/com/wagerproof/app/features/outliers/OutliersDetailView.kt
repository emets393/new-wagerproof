package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.games.tools.ToolRouter
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.OutliersStore

/**
 * Per-category Outliers detail view. Port of iOS `OutliersDetailView.swift`.
 *
 * The `.value` / `.fade` categories share [OutliersStore] and render inline
 * (explainer banner + sport filter pills + alert cards / shimmer / empty). The
 * deeper categories delegate to the shared [ToolRouter] used by Games banners.
 */
@Composable
fun OutliersDetailView(
    category: OutliersStore.Category,
    modifier: Modifier = Modifier,
) {
    val store = appGraph().outliers

    when (category) {
        OutliersStore.Category.`value`, OutliersStore.Category.fade ->
            InlineAlertsBody(store, category, modifier)
        else -> ToolRouter.LeafView(category, modifier)
    }
}

@Composable
private fun InlineAlertsBody(
    store: OutliersStore,
    category: OutliersStore.Category,
    modifier: Modifier,
) {
    // Shared store is loaded by the hub; refresh on entry if it was never run.
    LaunchedEffect(Unit) {
        if (store.loadState is LoadState.Idle) store.refresh()
    }

    Column(
        modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.lg)
            .padding(bottom = Spacing.xxl),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(Modifier.size(Spacing.lg))
        ExplainerBanner(category)
        if (category == OutliersStore.Category.`value`) {
            ValueAlertsList(store)
        } else {
            FadeAlertsList(store)
        }
    }
}

// MARK: - Banners

@Composable
private fun ExplainerBanner(category: OutliersStore.Category) {
    when (category) {
        OutliersStore.Category.`value` -> ToolExplainerBanner(
            accentColor = hexColor(0x22C55E),
            title = "Prediction Market Alerts",
            titleIcon = "chart.line.uptrend.xyaxis",
            headline = "Follow the smart money.",
            description = "Prediction markets move faster than sportsbooks. When Polymarket consensus diverges from the line, the book may not have adjusted yet — that's your window.",
            examples = listOf(
                ToolExplainerExample("chart.line.uptrend.xyaxis", "Polymarket has Chiefs ML at 67%", "Book: -150", hexColor(0x22C55E)),
                ToolExplainerExample("arrow.left.arrow.right", "Consensus says Over but line hasn't moved", "62% Over", hexColor(0x22C55E)),
                ToolExplainerExample("exclamationmark.circle.fill", "Spread divergence: market vs book", "+3.5 gap", hexColor(0xF59E0B)),
            ),
        )
        OutliersStore.Category.fade -> ToolExplainerBanner(
            accentColor = hexColor(0xF59E0B),
            title = "Model Fade Alerts",
            titleIcon = "bolt.fill",
            headline = "When confidence backfires.",
            description = "When our model is extremely confident, backtesting shows betting the opposite side has been more profitable. These are contrarian opportunities hiding in plain sight.",
            examples = listOf(
                ToolExplainerExample("bolt.fill", "Model says Bills -7 at 92% confidence", "Fade", hexColor(0xEF4444)),
                ToolExplainerExample("arrow.up.arrow.down", "Backtest: fading 90%+ picks hits 61%", "61% win", hexColor(0x22C55E)),
                ToolExplainerExample("gauge.high", "Extreme NBA spread confidence", "Fade", hexColor(0xEF4444)),
            ),
        )
        else -> Unit
    }
}

// MARK: - Alert lists

@Composable
private fun ValueAlertsList(store: OutliersStore) {
    val graph = appGraph()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SportFilterPills(
            current = store.valueAlertsSportFilter,
            countProvider = store::valueAlertsCount,
            onSelect = { store.valueAlertsSportFilter = it },
        )
        val alerts = store.filteredValueAlerts
        when {
            store.isLoading && alerts.isEmpty() -> ShimmerRows(OutliersStore.Category.`value`)
            alerts.isEmpty() -> EmptyState("No value alerts found for this week.")
            else -> alerts.forEachIndexed { index, alert ->
                OutlierAlertCard(
                    kind = OutlierAlertKind.Value(alert),
                    onTap = { openOutlierGame(graph, alert.sport, alert.gameId, store) },
                    modifier = Modifier.staggeredAppear(index),
                )
            }
        }
    }
}

@Composable
private fun FadeAlertsList(store: OutliersStore) {
    val graph = appGraph()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SportFilterPills(
            current = store.fadeAlertsSportFilter,
            countProvider = store::fadeAlertsCount,
            onSelect = { store.fadeAlertsSportFilter = it },
        )
        val alerts = store.filteredFadeAlerts
        when {
            store.isLoading && alerts.isEmpty() -> ShimmerRows(OutliersStore.Category.fade)
            alerts.isEmpty() -> EmptyState("No model fade alerts found for today.")
            else -> alerts.forEachIndexed { index, alert ->
                OutlierAlertCard(
                    kind = OutlierAlertKind.Fade(alert),
                    onTap = { openOutlierGame(graph, alert.sport, alert.gameId, store) },
                    modifier = Modifier.staggeredAppear(index),
                )
            }
        }
    }
}

/** Resolve the lightweight alert id through the hoisted slate and open the same
 * per-sport sheet used by Games/Search before switching tabs. */
private fun openOutlierGame(
    graph: com.wagerproof.app.AppGraph,
    sport: SportLeague,
    gameId: String,
    outliers: OutliersStore,
) {
    outliers.loadingGameId = gameId
    val opened = when (sport) {
        SportLeague.NFL -> graph.games.games.nfl.firstOrNull { it.id == gameId || it.gameId == gameId }?.let {
            graph.games.selectedSport = com.wagerproof.core.stores.GamesStore.Sport.nfl
            graph.nflGameSheet.openGameSheet(it); true
        } ?: false
        SportLeague.CFB -> graph.games.games.cfb.firstOrNull { it.id == gameId || it.gameId == gameId }?.let {
            graph.games.selectedSport = com.wagerproof.core.stores.GamesStore.Sport.cfb
            graph.cfbGameSheet.openGameSheet(it); true
        } ?: false
        SportLeague.NBA -> graph.games.games.nba.firstOrNull { it.id == gameId || it.gameId.toString() == gameId }?.let {
            graph.games.selectedSport = com.wagerproof.core.stores.GamesStore.Sport.nba
            graph.nbaGameSheet.openGameSheet(it); true
        } ?: false
        SportLeague.NCAAB -> graph.games.games.ncaab.firstOrNull { it.id == gameId || it.gameId.toString() == gameId }?.let {
            graph.games.selectedSport = com.wagerproof.core.stores.GamesStore.Sport.ncaab
            graph.ncaabGameSheet.openGameSheet(it); true
        } ?: false
        SportLeague.MLB -> graph.games.games.mlb.firstOrNull { it.id == gameId || it.gamePk.toString() == gameId }?.let {
            graph.games.selectedSport = com.wagerproof.core.stores.GamesStore.Sport.mlb
            graph.mlbGameSheet.openGameSheet(it); true
        } ?: false
    }
    if (opened) graph.mainTab.select(MainTabStore.Tab.Games)
    outliers.loadingGameId = null
}

// MARK: - Sport filter pills

/**
 * "All (n) / NFL (n) / CFB (n) …" pill row. Pills hide when their count is 0;
 * tapping the active sport pill toggles back to All. Mirrors iOS
 * `sportFilterPills`.
 */
@Composable
private fun SportFilterPills(
    current: SportLeague?,
    countProvider: (SportLeague) -> Int,
    onSelect: (SportLeague?) -> Unit,
) {
    val total = SportLeague.entries.sumOf { countProvider(it) }
    Row(
        Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterPill(label = "All ($total)", isActive = current == null, sport = null) { onSelect(null) }
        listOf(SportLeague.NFL, SportLeague.CFB, SportLeague.NBA, SportLeague.NCAAB).forEach { sport ->
            val count = countProvider(sport)
            if (count > 0) {
                FilterPill(
                    label = "${sport.raw.uppercase()} ($count)",
                    isActive = current == sport,
                    sport = sport,
                ) { onSelect(if (current == sport) null else sport) }
            }
        }
    }
}

@Composable
private fun FilterPill(
    label: String,
    isActive: Boolean,
    sport: SportLeague?,
    onTap: () -> Unit,
) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(if (isActive) AppColors.appPrimary else AppColors.appSurfaceMuted)
            .clickable(onClick = onTap)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val fg = if (isActive) Color.White else AppColors.appTextPrimary
        if (sport != null) {
            Icon(outlierSymbol(sport.sfSymbol), null, tint = fg, modifier = Modifier.size(11.dp))
        }
        Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

// MARK: - Loading / empty

/** 3 accent-tinted skeleton cards mirroring [OutlierAlertCard]'s footprint. */
@Composable
private fun ShimmerRows(category: OutliersStore.Category) {
    val accent = if (category == OutliersStore.Category.`value`) hexColor(0x22C55E) else hexColor(0xF59E0B)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(3) { OutlierCardShimmerRow(accent) }
    }
}

/** Single skeleton row reproducing [OutlierAlertCard]'s layout. */
@Composable
private fun OutlierCardShimmerRow(accent: Color) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(accent.copy(alpha = 0.1f))
            .border(1.dp, accent.copy(alpha = 0.3f), shape)
            .shimmering()
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SkeletonCapsule(height = 22.dp, width = 56.dp)
                SkeletonCapsule(height = 22.dp, width = 70.dp)
                SkeletonCapsule(height = 22.dp, width = 48.dp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SkeletonCapsule(height = 20.dp, width = 72.dp)
                SkeletonCapsule(height = 20.dp, width = 60.dp)
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                SkeletonCircle(28.dp)
                SkeletonBlock(height = 13.dp, width = 32.dp)
            }
            SkeletonBlock(height = 13.dp, width = 10.dp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                SkeletonCircle(28.dp)
                SkeletonBlock(height = 13.dp, width = 32.dp)
            }
        }
        SkeletonBlock(height = 13.dp, modifier = Modifier.padding(end = 40.dp))
    }
}

@Composable
private fun EmptyState(text: String) {
    Column(
        Modifier.fillMaxWidth().heightIn(min = 220.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            outlierSymbol("magnifyingglass"),
            null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(44.dp),
        )
        Spacer(Modifier.size(12.dp))
        Text("No outliers", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.size(4.dp))
        Text(text, color = AppColors.appTextSecondary, fontSize = 14.sp, textAlign = TextAlign.Center)
    }
}
