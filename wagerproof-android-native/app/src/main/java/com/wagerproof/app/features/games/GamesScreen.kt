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
import com.wagerproof.app.features.components.QuickFilterEmptyState
import com.wagerproof.app.features.components.QuickFilterField
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
    var isPullRefreshing by remember { mutableStateOf(false) }

    // Model-accuracy reports back the NBA/NCAAB tool banners (hidden when
    // empty). Shell-scoped: a per-screen `remember` was thrown away on every
    // tab switch, so the banner vanished and refetched on each return.
    val nbaAccuracy = graph.nbaModelAccuracy
    val ncaabAccuracy = graph.ncaabModelAccuracy
    var selectedTool by remember { mutableStateOf<SportTool?>(null) }

    // No refreshAll here — MainScaffold hydrates the slate once at the shell
    // (iOS deleted GamesView's duplicate `.task` in 7166b538). Running both
    // fired all five sports' pipelines twice on cold start. Only the sports
    // that FAILED that hydrate get another try: unforced and empty-handed on
    // the happy path, but without it one blip at launch hides a sport from
    // Search/Outliers/WagerBot for the rest of the process.
    LaunchedEffect(Unit) { store.retryFailed() }

    LaunchedEffect(store.selectedSport) {
        when (store.selectedSport) {
            // needsInitialLoad, not `is Idle`: these stores are shell-scoped now,
            // so one failed fetch would otherwise hide the tool banner for good
            // (visibleTools drops it when the cache is empty) with no error row
            // and no retry affordance anywhere.
            GamesStore.Sport.nba -> if (nbaAccuracy.loadState.needsInitialLoad) nbaAccuracy.refresh()
            GamesStore.Sport.ncaab -> if (ncaabAccuracy.loadState.needsInitialLoad) ncaabAccuracy.refresh()
            else -> Unit
        }
    }

    val sport = store.selectedSport

    // Quick Filter is per-sport (`GamesStore.searchTexts`), so switching sports
    // restores whatever that sport was filtered to rather than clearing — same
    // as iOS, whose binding reads/writes the same keyed map. `activeQuickFilter`
    // is the trimmed form the store also filters on; the raw value stays in the
    // field so a trailing space the user just typed isn't eaten.
    val quickFilter = store.searchTexts[sport] ?: ""
    val activeQuickFilter = quickFilter.trim()

    // Agent consensus is fetched ONCE per slate, never per card: the flag
    // threshold scales with the whole day's pick volume, so it can't be derived
    // inside a per-sport adapter. MLB's feed spans today AND tomorrow, so every
    // distinct date goes into the same call or the next day's cards stay bare.
    // See .claude/docs/18_agent_consensus.md.
    val consensusDates = remember(sport, store.games) { slateDates(store, sport) }
    LaunchedEffect(sport, consensusDates) { graph.agentConsensus.refresh(sport, consensusDates) }
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

        // Quick Filter + sport + sort on ONE row, matching iOS
        // `GamesView.pickerBar`. The five-way segmented picker used to own a
        // second row below the field; collapsing the sport into a pull-down icon
        // menu buys back that row's vertical space on a page where the game
        // cards are what matter (owner request, 2026-08-17).
        PickerBar(
            store = store,
            quickFilter = quickFilter,
            sport = sport,
        )

        PullToRefreshBox(
            // Only a gesture-driven refresh should show Material's pull
            // indicator. Tying this to the store's background refresh painted
            // a large spinner over the regression banner on every cold launch.
            isRefreshing = isPullRefreshing,
            onRefresh = {
                scope.launch {
                    isPullRefreshing = true
                    try {
                        store.refresh(sport, force = true)
                        // Force past the consensus TTL too, and recompute dates
                        // after the slate refresh so a new day's games are covered.
                        graph.agentConsensus.refresh(sport, slateDates(store, sport), force = true)
                    } finally {
                        isPullRefreshing = false
                    }
                }
            },
            modifier = Modifier.weight(1f),
        ) {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 32.dp),
            ) {
                // Tool banners are slate-wide shortcuts, not games — they'd sit
                // above a two-card result and read as noise, so iOS drops them
                // while a Quick Filter is active (GamesView.swift:158-160).
                if (visibleTools.isNotEmpty() && activeQuickFilter.isEmpty()) {
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
                    // Distinct from the season EmptyTile below: the board HAS
                    // games, the query just excluded them all. Says so, and
                    // offers the one-tap way back (iOS ContentUnavailableView).
                    activeQuickFilter.isNotEmpty() && filteredGamesAreEmpty(store, sport) -> item {
                        QuickFilterEmptyState(
                            title = "No Matching Games",
                            message = "No ${sport.label} teams match “$activeQuickFilter”.",
                            onClear = { store.searchTexts = store.searchTexts + (sport to "") },
                        )
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

/**
 * Distinct ET dates present in the current sport's slate. Uses the same
 * [GameDateGrouping.dateKey] normalization as the feed's date sections so the
 * dates handed to the consensus RPC line up with what the user actually sees.
 */
private fun slateDates(store: GamesStore, sport: GamesStore.Sport): List<String> = when (sport) {
    GamesStore.Sport.nfl -> store.games.nfl.map { GameDateGrouping.dateKey(it.gameDate) }
    GamesStore.Sport.cfb -> store.games.cfb.map { GameDateGrouping.dateKey(it.gameDate) }
    GamesStore.Sport.nba -> store.games.nba.map { GameDateGrouping.dateKey(it.gameDate) }
    GamesStore.Sport.ncaab -> store.games.ncaab.map { GameDateGrouping.dateKey(it.gameDate) }
    GamesStore.Sport.mlb -> store.games.mlb.map { GameDateGrouping.dateKey(it.officialDate) }
}.filter { it.isNotBlank() }.distinct().sorted()

private fun noCachedGames(store: GamesStore, sport: GamesStore.Sport): Boolean = when (sport) {
    GamesStore.Sport.nfl -> store.games.nfl.isEmpty()
    GamesStore.Sport.cfb -> store.games.cfb.isEmpty()
    GamesStore.Sport.nba -> store.games.nba.isEmpty()
    GamesStore.Sport.ncaab -> store.games.ncaab.isEmpty()
    GamesStore.Sport.mlb -> store.games.mlb.isEmpty()
}

/**
 * True when the sorted+filtered list is empty. Reads the same memoized
 * `sortedX()` the feed renders, so it can't disagree with what's on screen.
 * iOS `GamesView.filteredGamesAreEmpty`.
 */
private fun filteredGamesAreEmpty(store: GamesStore, sport: GamesStore.Sport): Boolean = when (sport) {
    GamesStore.Sport.nfl -> store.sortedNFL().isEmpty()
    GamesStore.Sport.cfb -> store.sortedCFB().isEmpty()
    GamesStore.Sport.nba -> store.sortedNBA().isEmpty()
    GamesStore.Sport.ncaab -> store.sortedNCAAB().isEmpty()
    GamesStore.Sport.mlb -> store.sortedMLB().isEmpty()
}

/**
 * Inline Quick Filter + sport + sort controls. iOS `GamesView.pickerBar`: the
 * field takes the remaining width and the two pull-down menus sit beside it as
 * fixed 44dp glass circles.
 *
 * The field must stay `weight(1f)` rather than `fillMaxWidth` — it is the only
 * flexible child, and the icons measure at a fixed size, so this is what keeps
 * NCAAB's wider label from pushing the sort menu off-screen.
 */
@Composable
private fun PickerBar(store: GamesStore, quickFilter: String, sport: GamesStore.Sport) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        QuickFilterField(
            value = quickFilter,
            onValueChange = { store.searchTexts = store.searchTexts + (sport to it) },
            accessibilityLabel = "Quick filter games",
            modifier = Modifier.weight(1f),
        )
        SportMenu(store)
        SortMenu(store)
    }
}

/**
 * 44dp glass circle wrapping a pull-down menu. Port of iOS `menuIconLabel` —
 * same diameter as [QuickFilterField]'s height so the three controls share one
 * seam, and the same `liquidGlassCapsule` material so they read as one row.
 */
@Composable
private fun MenuIconButton(
    systemName: String,
    contentDescription: String,
    isActive: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(44.dp)
            .liquidGlassCapsule(null)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            (AppIcon.fromSystemName(systemName) ?: AppIcon.SPORTSCOURT_FILL).imageVector,
            contentDescription = contentDescription,
            tint = if (isActive) AppColors.appPrimary else AppColors.appTextPrimary,
            modifier = Modifier.size(20.dp),
        )
    }
}

/**
 * Sport pull-down, replacing the five-way segmented control. Icon reflects the
 * current sport so the row still says which slate you are on without spending a
 * label's worth of width on it.
 */
@Composable
private fun SportMenu(store: GamesStore) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        MenuIconButton(
            systemName = sportSymbol(store.selectedSport),
            contentDescription = "Choose sport shown",
        ) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            GamesStore.Sport.displayOrder().forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.label) },
                    leadingIcon = {
                        Icon(
                            (AppIcon.fromSystemName(sportSymbol(option)) ?: AppIcon.SPORTSCOURT_FILL).imageVector,
                            contentDescription = null,
                        )
                    },
                    trailingIcon = if (option == store.selectedSport) {
                        { Icon(AppIcon.CHECKMARK.imageVector, contentDescription = null, tint = AppColors.appPrimary) }
                    } else null,
                    onClick = { store.selectedSport = option; expanded = false },
                )
            }
        }
    }
}

/** Android has no SF Symbol for a generic ball, so each sport carries its own. */
private fun sportSymbol(sport: GamesStore.Sport): String = when (sport) {
    GamesStore.Sport.mlb -> "baseball"
    GamesStore.Sport.nba, GamesStore.Sport.ncaab -> "basketball"
    GamesStore.Sport.nfl -> "football"
    GamesStore.Sport.cfb -> "graduationcap"
}

@Composable
private fun SortMenu(store: GamesStore) {
    var expanded by remember { mutableStateOf(false) }
    val active = store.sortModes[store.selectedSport] ?: GamesStore.SortMode.TIME
    Box {
        MenuIconButton(
            systemName = "arrow.up.arrow.down",
            contentDescription = "Sort games",
            // Tinted only when sorting differs from the default, so the row
            // shows at a glance that a non-obvious order is in effect (iOS
            // sortMenu's `isActive`).
            isActive = active != GamesStore.SortMode.TIME,
        ) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            listOf(
                GamesStore.SortMode.TIME to "Sort by Time",
                GamesStore.SortMode.SPREAD to "Sort by Spread Value",
                GamesStore.SortMode.OU to "Sort by O/U Value",
            ).forEach { (mode, label) ->
                DropdownMenuItem(
                    text = { Text(label) },
                    trailingIcon = if (mode == active) {
                        { Icon(AppIcon.CHECKMARK.imageVector, contentDescription = null, tint = AppColors.appPrimary) }
                    } else null,
                    onClick = {
                        store.sortModes = store.sortModes + (store.selectedSport to mode)
                        expanded = false
                    },
                )
            }
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
 *
 * Consensus is a LEFT JOIN onto the slate — most games have no row, and that is
 * normal rather than an error (picks exist before predictions populate). The
 * lookup happens inside each item's composable body so a late-arriving RPC
 * recomposes only the affected cards.
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
                        }, modifier = Modifier.padding(horizontal = 12.dp).padding(bottom = 8.dp).staggeredAppear(index),
                            consensus = graph.agentConsensus.consensus(sport, GameConsensusKey.of(game)))
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
                        }, modifier = Modifier.padding(horizontal = 12.dp).padding(bottom = 8.dp).staggeredAppear(index),
                            consensus = graph.agentConsensus.consensus(sport, GameConsensusKey.of(game)))
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
                        }, modifier = Modifier.padding(horizontal = 12.dp).padding(bottom = 8.dp).staggeredAppear(index),
                            consensus = graph.agentConsensus.consensus(sport, GameConsensusKey.of(game)))
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
                        }, modifier = Modifier.padding(horizontal = 12.dp).padding(bottom = 8.dp).staggeredAppear(index),
                            consensus = graph.agentConsensus.consensus(sport, GameConsensusKey.of(game)))
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
                        }, modifier = Modifier.padding(horizontal = 12.dp).padding(bottom = 8.dp).staggeredAppear(index),
                            consensus = graph.agentConsensus.consensus(sport, GameConsensusKey.of(game)))
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
