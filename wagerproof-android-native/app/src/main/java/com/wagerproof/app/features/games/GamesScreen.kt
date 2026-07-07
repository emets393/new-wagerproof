package com.wagerproof.app.features.games

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.cfb.CFBGameCard
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardShimmer
import com.wagerproof.app.features.games.tools.SportTool
import com.wagerproof.app.features.games.tools.ToolBannerCard
import com.wagerproof.app.features.games.tools.ToolRouter
import com.wagerproof.app.features.mlb.MLBGameCard
import com.wagerproof.app.features.nba.NBAGameCard
import com.wagerproof.app.features.ncaab.NCAABGameCard
import com.wagerproof.app.features.nfl.NFLGameCard
import com.wagerproof.app.features.navigation.SettingsToolbarButton
import com.wagerproof.app.features.navigation.WagerProofWordmark
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.NBAModelAccuracyStore
import com.wagerproof.core.stores.NCAABModelAccuracyStore
import com.wagerproof.core.stores.SportSeason
import kotlinx.coroutines.launch

/**
 * Home "Games" tab. iOS `Games/GamesView`. One feed for all 5 sports: segmented
 * sport picker + per-sport sort, swipeable analytics tool banners, per-date
 * sections of sport game cards, pull-to-refresh. Card tap sets the per-sport
 * sheet store's selectedGame and pushes the detail carousel.
 *
 * FIDELITY-WAIVER #231: no native large-title collapse — "Games" is a static
 * header above the picker, matching AgentsScreen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamesScreen(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val store = graph.games
    val tabStore = graph.mainTab
    val nav = LocalAppNavigator.current
    val scope = rememberCoroutineScope()

    // Model-accuracy reports back the NBA/NCAAB tool banners (hidden when empty).
    val nbaAccuracy = remember { NBAModelAccuracyStore() }
    val ncaabAccuracy = remember { NCAABModelAccuracyStore() }
    var selectedTool by remember { mutableStateOf<SportTool?>(null) }

    LaunchedEffect(Unit) { store.refreshAll() }
    LaunchedEffect(store.selectedSport) {
        when (store.selectedSport) {
            GamesStore.Sport.nba -> if (nbaAccuracy.loadState is LoadState.Idle) nbaAccuracy.refresh()
            GamesStore.Sport.ncaab -> if (ncaabAccuracy.loadState is LoadState.Idle) ncaabAccuracy.refresh()
            else -> Unit
        }
    }

    val sport = store.selectedSport
    val visibleTools = SportTool.tools(sport).filter { tool ->
        when (tool.category) {
            com.wagerproof.core.stores.OutliersStore.Category.nbaAccuracy -> nbaAccuracy.games.isNotEmpty()
            com.wagerproof.core.stores.OutliersStore.Category.ncaabAccuracy -> ncaabAccuracy.games.isNotEmpty()
            else -> true
        }
    }

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        // Header: wordmark + settings gear (WagerBot hidden here, matching iOS).
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WagerProofWordmark(Modifier.weight(1f))
            SettingsToolbarButton(tabStore)
        }
        Text(
            "Games",
            color = AppColors.appTextPrimary,
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 16.dp, top = 2.dp, bottom = 4.dp),
        )

        // Pinned picker + sort bar.
        PickerBar(store)

        PullToRefreshBox(
            isRefreshing = store.isLoading(sport) && !noCachedGames(store, sport),
            onRefresh = { scope.launch { store.refresh(sport, force = true) } },
            modifier = Modifier.weight(1f),
        ) {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 32.dp),
            ) {
                if (visibleTools.isNotEmpty()) {
                    item(key = "tools") { ToolBanners(visibleTools) { selectedTool = it } }
                }

                when {
                    store.isLoading(sport) && noCachedGames(store, sport) -> item {
                        Column(
                            Modifier.padding(horizontal = 12.dp, vertical = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) { repeat(5) { GameCardShimmer() } }
                    }
                    store.errorMessage(sport) != null && noCachedGames(store, sport) -> item {
                        ErrorState(store.errorMessage(sport)!!) {
                            scope.launch { store.refresh(sport, force = true) }
                        }
                    }
                    else -> sportDateSections(store, sport, nav, graph)
                }
            }
        }
    }

    // Tool leaf page as a full-screen overlay (iOS pushes it onto the stack).
    selectedTool?.let { tool ->
        BackHandler(enabled = true) { selectedTool = null }
        Box(Modifier.fillMaxSize().background(AppColors.appSurface)) {
            ToolRouter.LeafView(tool.category)
        }
    }
}

private fun noCachedGames(store: GamesStore, sport: GamesStore.Sport): Boolean = when (sport) {
    GamesStore.Sport.nfl -> store.games.nfl.isEmpty()
    GamesStore.Sport.cfb -> store.games.cfb.isEmpty()
    GamesStore.Sport.nba -> store.games.nba.isEmpty()
    GamesStore.Sport.ncaab -> store.games.ncaab.isEmpty()
    GamesStore.Sport.mlb -> store.games.mlb.isEmpty()
}

@Composable
private fun PickerBar(store: GamesStore) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 8.dp)
            .liquidGlassCapsule(null)
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // Segmented sport picker.
        Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            GamesStore.Sport.displayOrder().forEach { s ->
                val active = store.selectedSport == s
                Box(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (active) AppColors.appPrimary.copy(alpha = 0.2f) else Color.Transparent)
                        .clickable { store.selectedSport = s }
                        .padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        s.label,
                        color = if (active) AppColors.appTextPrimary else AppColors.appTextSecondary,
                        fontSize = 12.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                    )
                }
            }
        }
        SortMenu(store)
    }
}

@Composable
private fun SortMenu(store: GamesStore) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { expanded = true }, modifier = Modifier.size(32.dp)) {
            Icon(
                (AppIcon.fromSystemName("arrow.up.arrow.down") ?: AppIcon.CHEVRON_RIGHT).imageVector,
                contentDescription = "Sort games",
                tint = AppColors.appTextPrimary,
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Sort by Time") },
                onClick = { store.sortModes = store.sortModes + (store.selectedSport to GamesStore.SortMode.TIME); expanded = false },
            )
            DropdownMenuItem(
                text = { Text("Sort by Spread Value") },
                onClick = { store.sortModes = store.sortModes + (store.selectedSport to GamesStore.SortMode.SPREAD); expanded = false },
            )
            DropdownMenuItem(
                text = { Text("Sort by O/U Value") },
                onClick = { store.sortModes = store.sortModes + (store.selectedSport to GamesStore.SortMode.OU); expanded = false },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ToolBanners(tools: List<SportTool>, onTap: (SportTool) -> Unit) {
    val pagerState = rememberPagerState(pageCount = { tools.size })
    Column(
        Modifier.padding(top = 4.dp, bottom = 6.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxWidth().height(64.dp)) { page ->
            ToolBannerCard(tools[page], onTap = { onTap(tools[page]) }, modifier = Modifier.padding(horizontal = 12.dp))
        }
        if (tools.size > 1) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            ) {
                tools.indices.forEach { i ->
                    Box(
                        Modifier.size(6.dp).clip(CircleShape)
                            .background(if (i == pagerState.currentPage) AppColors.appPrimary else AppColors.appBorder),
                    )
                }
            }
        }
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(top = 40.dp, start = 24.dp, end = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            (AppIcon.fromSystemName("exclamationmark.triangle") ?: AppIcon.SPORTSCOURT_FILL).imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(44.dp),
        )
        Text("Failed to load games", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        Text(
            "Retry",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(AppColors.appPrimary)
                .clickable { onRetry() }
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
}

/** Section header above a per-date group. Scrolls inline (not pinned). */
@Composable
private fun DateSectionHeader(label: String) {
    Text(
        label.uppercase(),
        color = AppColors.appTextSecondary,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp,
        modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 6.dp, bottom = 6.dp),
    )
}

@Composable
private fun EmptyTile(sport: GamesStore.Sport, systemImage: String) {
    val copy = SportSeason.emptyCopy(sport)
    Column(
        Modifier.fillMaxWidth().height(220.dp).padding(horizontal = 32.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            (AppIcon.fromSystemName(systemImage) ?: AppIcon.SPORTSCOURT_FILL).imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(44.dp),
        )
        Text(copy.title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp))
        Text(copy.message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
    }
}

/**
 * Per-sport date sections. Kept as a LazyListScope extension so each card is its
 * own lazy item (staggered appearance + recycling). Card tap opens the sheet
 * store + pushes the detail carousel.
 */
private fun androidx.compose.foundation.lazy.LazyListScope.sportDateSections(
    store: GamesStore,
    sport: GamesStore.Sport,
    nav: com.wagerproof.app.nav.AppNavigator,
    graph: com.wagerproof.app.AppGraph,
) {
    when (sport) {
        GamesStore.Sport.nfl -> {
            val games = store.sortedNFL()
            if (games.isEmpty()) {
                item { EmptyTile(sport, "football") }
            } else {
                val sections = GameDateGrouping.group(games, { GameDateGrouping.dateKey(it.gameDate) }, { GameCardFormatting.formatCompactDate(it.gameDate) })
                sections.forEach { section ->
                    item(key = "hdr-${section.key}") { DateSectionHeader(section.label) }
                    itemsIndexedKeyed(section.items, { it.id }) { index, game ->
                        NFLGameCard(game = game, onPress = {
                            graph.nflGameSheet.openGameSheet(game)
                            nav.openGameDetail("nfl", game.id)
                        }, modifier = Modifier.padding(horizontal = 12.dp).staggeredAppear(index))
                    }
                }
            }
        }
        GamesStore.Sport.cfb -> {
            val games = store.sortedCFB()
            if (games.isEmpty()) {
                item { EmptyTile(sport, "graduationcap") }
            } else {
                val sections = GameDateGrouping.group(games, { GameDateGrouping.dateKey(it.gameDate) }, { GameCardFormatting.formatCompactDate(it.gameDate) })
                sections.forEach { section ->
                    item(key = "hdr-${section.key}") { DateSectionHeader(section.label) }
                    itemsIndexedKeyed(section.items, { it.id }) { index, game ->
                        CFBGameCard(game = game, onPress = {
                            graph.cfbGameSheet.openGameSheet(game)
                            nav.openGameDetail("cfb", game.id)
                        }, modifier = Modifier.padding(horizontal = 12.dp).staggeredAppear(index))
                    }
                }
            }
        }
        GamesStore.Sport.ncaab -> {
            val games = store.sortedNCAAB()
            if (games.isEmpty()) {
                item { EmptyTile(sport, "basketball") }
            } else {
                val sections = GameDateGrouping.group(games, { GameDateGrouping.dateKey(it.gameDate) }, { GameCardFormatting.formatCompactDate(it.gameDate) })
                sections.forEach { section ->
                    item(key = "hdr-${section.key}") { DateSectionHeader(section.label) }
                    itemsIndexedKeyed(section.items, { it.id }) { index, game ->
                        NCAABGameCard(game = game, onPress = {
                            graph.ncaabGameSheet.openGameSheet(game)
                            nav.openGameDetail("ncaab", game.id)
                        }, modifier = Modifier.padding(horizontal = 12.dp).staggeredAppear(index))
                    }
                }
            }
        }
        GamesStore.Sport.mlb -> {
            val games = store.sortedMLB()
            if (games.isEmpty()) {
                item { EmptyTile(sport, "baseball") }
            } else {
                val sections = GameDateGrouping.group(games, { GameDateGrouping.dateKey(it.officialDate) }, { GameCardFormatting.formatCompactDate(it.officialDate) })
                sections.forEach { section ->
                    item(key = "hdr-${section.key}") { DateSectionHeader(section.label) }
                    itemsIndexedKeyed(section.items, { it.id }) { index, game ->
                        MLBGameCard(game = game, onPress = {
                            graph.mlbGameSheet.openGameSheet(game)
                            nav.openGameDetail("mlb", game.id)
                        }, modifier = Modifier.padding(horizontal = 12.dp).staggeredAppear(index))
                    }
                }
            }
        }
        GamesStore.Sport.nba -> {
            val games = store.sortedNBA()
            if (games.isEmpty()) {
                item { EmptyTile(sport, "basketball") }
            } else {
                val sections = GameDateGrouping.group(games, { GameDateGrouping.dateKey(it.gameDate) }, { GameCardFormatting.formatCompactDate(it.gameDate) })
                sections.forEach { section ->
                    item(key = "hdr-${section.key}") { DateSectionHeader(section.label) }
                    itemsIndexedKeyed(section.items, { it.id }) { index, game ->
                        NBAGameCard(game = game, onPress = {
                            graph.nbaGameSheet.openGameSheet(game)
                            nav.openGameDetail("nba", game.id)
                        }, modifier = Modifier.padding(horizontal = 12.dp).staggeredAppear(index))
                    }
                }
            }
        }
    }
}

/** items() with a stable string key + zero-based index passed to the content. */
private inline fun <T> androidx.compose.foundation.lazy.LazyListScope.itemsIndexedKeyed(
    list: List<T>,
    crossinline key: (T) -> String,
    crossinline content: @Composable (index: Int, item: T) -> Unit,
) {
    list.forEachIndexed { index, item ->
        item(key = key(item)) { content(index, item) }
    }
}
