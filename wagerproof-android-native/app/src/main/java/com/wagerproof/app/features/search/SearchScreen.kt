package com.wagerproof.app.features.search

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.components.AgentRowCard
import com.wagerproof.app.features.cfb.CFBGameCard
import com.wagerproof.app.features.gamecards.GameCardShimmer
import com.wagerproof.app.features.mlb.MLBGameCard
import com.wagerproof.app.features.nba.NBAGameCard
import com.wagerproof.app.features.ncaab.NCAABGameCard
import com.wagerproof.app.features.nfl.NFLGameCard
import com.wagerproof.app.features.navigation.WagerProofTopBar
import com.wagerproof.app.features.outliers.OutliersTrendCard
import com.wagerproof.app.features.outliers.OutliersTrendCardShimmer
import com.wagerproof.app.features.outliers.OutliersTrendDetailSheet
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.NFLPropFeed
import com.wagerproof.app.features.props.NFLPropFeedItem
import com.wagerproof.app.features.props.PlayerPropFeed
import com.wagerproof.app.features.props.PlayerPropFeedItem
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.props.components.NflPropPlayerCard
import com.wagerproof.app.features.props.components.PropCardShimmer
import com.wagerproof.app.features.props.components.PropPlayerCard
import com.wagerproof.app.features.props.detail.NflPropDetailScreen
import com.wagerproof.app.features.props.detail.PlayerPropDetailScreen
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.AgentsStore
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.PropsStore
import com.wagerproof.core.stores.SearchStore
import kotlinx.coroutines.launch

/**
 * Cross-product Search tab. This is the Compose counterpart of iOS
 * `Features/Search/SearchView`: an Explore launchpad when the field is empty,
 * category browse modes, a 200 ms debounced scoped search, and imperative
 * handoffs into the owning Games/Agents tabs or local prop/trend details.
 *
 * Search deliberately reuses the exact feed cards instead of maintaining a
 * second set of result-row designs. The app-scoped [SearchStore] derives its
 * results from the same Games, Props, Outliers, and agent stores that power the
 * destination screens.
 */
@Composable
fun SearchScreen(
    modifier: Modifier = Modifier,
    onFullScreenChanged: (Boolean) -> Unit = {},
) {
    val graph = appGraph()
    val search = graph.search
    val navigator = LocalAppNavigator.current
    val keyboard = LocalSoftwareKeyboardController.current

    // AgentsScreen owns its store locally, while the other searchable stores
    // are app-scoped. Keep a search-local own-agent store and combine it with
    // SearchStore's public leaderboard cache, matching iOS's bound AgentsStore.
    val ownAgents = remember { AgentsStore() }
    val userId = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId

    var selectedMlbProp by remember { mutableStateOf<PlayerPropSelection?>(null) }
    var selectedNflProp by remember { mutableStateOf<NFLPlayerPropSelection?>(null) }
    var selectedTrend by remember { mutableStateOf<SearchStore.SearchResult.Trend?>(null) }
    val hasFullScreenDetail = selectedMlbProp != null || selectedNflProp != null

    LaunchedEffect(hasFullScreenDetail) { onFullScreenChanged(hasFullScreenDetail) }
    DisposableEffect(Unit) {
        onDispose { onFullScreenChanged(false) }
    }

    DisposableEffect(ownAgents) {
        onDispose { ownAgents.close() }
    }

    LaunchedEffect(Unit) {
        search.bind(
            games = graph.games,
            agents = ownAgents,
            trends = graph.outliersTrends,
            props = graph.props,
        )
        // Search spans every league, not just the sport last opened on Games.
        graph.games.refreshAll()
    }

    LaunchedEffect(userId) {
        ownAgents.bind(userId)
        if (userId != null) ownAgents.refresh()
    }

    // Lazy sources start only once the user searches or enters a browse mode.
    // Every call below is idempotent/TTL-guarded by its store.
    LaunchedEffect(search.debouncedQuery, search.browseScope) {
        val hasQuery = search.debouncedQuery.isNotBlank()
        val browse = search.browseScope
        if (hasQuery || browse == SearchStore.SearchScope.Agents) {
            launch { search.loadPublicAgentsIfNeeded() }
        }
        if (hasQuery || browse == SearchStore.SearchScope.Players) {
            launch { graph.props.refreshMLB() }
            launch { graph.props.refreshNFL() }
        }
        if (hasQuery || browse == SearchStore.SearchScope.Outliers) {
            launch { graph.outliersTrends.loadSearchIndexIfNeeded() }
        }
    }

    fun commitSearch() {
        search.flushDebounce()
        search.commitCurrentQueryToRecents()
        keyboard?.hide()
    }

    fun openGame(result: SearchStore.SearchResult.Game) {
        search.commitCurrentQueryToRecents()
        // Set the typed selected-game signal before pushing so GameDetailScreen
        // can append a cross-surface game that is not in the current sorted slate.
        when (result.sport) {
            SearchStore.GamesStoreSport.NFL -> {
                val game = graph.games.games.nfl.firstOrNull { it.uniqueId == result.resolvedId } ?: return
                graph.nflGameSheet.openGameSheet(game)
                navigator.openGameDetail("nfl", game.id)
            }
            SearchStore.GamesStoreSport.CFB -> {
                val game = graph.games.games.cfb.firstOrNull { it.uniqueId == result.resolvedId } ?: return
                graph.cfbGameSheet.openGameSheet(game)
                navigator.openGameDetail("cfb", game.gameId)
            }
            SearchStore.GamesStoreSport.NBA -> {
                val game = graph.games.games.nba.firstOrNull { it.id == result.resolvedId } ?: return
                graph.nbaGameSheet.openGameSheet(game)
                navigator.openGameDetail("nba", game.id)
            }
            SearchStore.GamesStoreSport.NCAAB -> {
                val game = graph.games.games.ncaab.firstOrNull { it.id == result.resolvedId } ?: return
                graph.ncaabGameSheet.openGameSheet(game)
                navigator.openGameDetail("ncaab", game.id)
            }
            SearchStore.GamesStoreSport.MLB -> {
                val game = graph.games.games.mlb.firstOrNull { it.id == result.resolvedId } ?: return
                graph.mlbGameSheet.openGameSheet(game)
                navigator.openGameDetail("mlb", game.id)
            }
        }
        graph.mainTab.select(MainTabStore.Tab.Games)
    }

    fun openAgent(result: SearchStore.SearchResult.Agent) {
        search.commitCurrentQueryToRecents()
        navigator.openAgentDetail(result.agentId, result.isPublic)
        graph.mainTab.select(MainTabStore.Tab.Agents)
    }

    // Prop details are local to the Search tab, just as they are local to the
    // iOS Search NavigationStack. Back returns to the exact query/browse state.
    BackHandler(enabled = selectedMlbProp != null || selectedNflProp != null) {
        selectedMlbProp = null
        selectedNflProp = null
    }
    selectedMlbProp?.let { selection ->
        PlayerPropDetailScreen(selection = selection, onBack = { selectedMlbProp = null })
        return
    }
    selectedNflProp?.let { selection ->
        NflPropDetailScreen(selection = selection, onBack = { selectedNflProp = null })
        return
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .imePadding(),
    ) {
        WagerProofTopBar(
            tabStore = graph.mainTab,
            modifier = Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars),
        )
        SearchHeader(
            store = search,
            onSubmit = ::commitSearch,
            onClear = {
                search.query = ""
                search.flushDebounce()
                search.exitBrowse()
            },
        )

        if (search.query.isNotBlank() || search.debouncedQuery.isNotBlank()) {
            SearchScopes(search)
        }

        SearchBody(
            store = search,
            games = graph.games,
            props = graph.props,
            ownAgentsState = ownAgents.loadState,
            trendsLoading = graph.outliersTrends.isLoadingSearchIndex,
            onBrowse = { scope ->
                search.commitCurrentQueryToRecents()
                search.browse(scope)
            },
            onExitBrowse = search::exitBrowse,
            onOpenGame = ::openGame,
            onOpenAgent = ::openAgent,
            onOpenMlbProp = {
                search.commitCurrentQueryToRecents()
                selectedMlbProp = it
            },
            onOpenNflProp = {
                search.commitCurrentQueryToRecents()
                selectedNflProp = it
            },
            onOpenTrend = {
                search.commitCurrentQueryToRecents()
                selectedTrend = it
            },
            onSelectTab = graph.mainTab::select,
        )
    }

    selectedTrend?.let { trend ->
        OutliersTrendDetailSheet(
            card = trend.card,
            sport = trend.sport,
            game = trend.game,
            onDismiss = { selectedTrend = null },
        )
    }
}

@Composable
private fun SearchHeader(
    store: SearchStore,
    onSubmit: () -> Unit,
    onClear: () -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(top = 4.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "Search",
            color = AppColors.appTextPrimary,
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
        )
        TextField(
            value = store.query,
            onValueChange = { store.query = it },
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Search games, players, agents, and outliers" },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            placeholder = {
                Text(
                    "Search games, players, agents…",
                    color = AppColors.appTextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            },
            leadingIcon = {
                Icon(AppIcon.MAGNIFYINGGLASS.imageVector, null, tint = AppColors.appTextSecondary)
            },
            trailingIcon = {
                if (store.query.isNotEmpty()) {
                    IconButton(onClick = onClear) {
                        Icon(AppIcon.XMARK.imageVector, "Clear search", tint = AppColors.appTextSecondary)
                    }
                }
            },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = AppColors.appSurfaceElevated,
                unfocusedContainerColor = AppColors.appSurfaceElevated,
                focusedTextColor = AppColors.appTextPrimary,
                unfocusedTextColor = AppColors.appTextPrimary,
                focusedIndicatorColor = AppColors.appPrimary,
                unfocusedIndicatorColor = Color.Transparent,
                cursorColor = AppColors.appPrimary,
            ),
        )
    }
}

@Composable
private fun SearchScopes(store: SearchStore) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = Spacing.lg, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(SearchStore.SearchScope.entries, key = { it.name }) { scope ->
            val selected = store.scope == scope
            Text(
                text = scope.label,
                color = if (selected) Color.White else AppColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(if (selected) AppColors.appPrimary else AppColors.appSurfaceMuted)
                    .clickable { store.scope = scope }
                    .padding(horizontal = 13.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun SearchBody(
    store: SearchStore,
    games: GamesStore,
    props: PropsStore,
    ownAgentsState: LoadState,
    trendsLoading: Boolean,
    onBrowse: (SearchStore.SearchScope) -> Unit,
    onExitBrowse: () -> Unit,
    onOpenGame: (SearchStore.SearchResult.Game) -> Unit,
    onOpenAgent: (SearchStore.SearchResult.Agent) -> Unit,
    onOpenMlbProp: (PlayerPropSelection) -> Unit,
    onOpenNflProp: (NFLPlayerPropSelection) -> Unit,
    onOpenTrend: (SearchStore.SearchResult.Trend) -> Unit,
    onSelectTab: (MainTabStore.Tab) -> Unit,
) {
    val isActiveSearch = store.query.isNotBlank() || store.debouncedQuery.isNotBlank()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        when {
            isActiveSearch -> activeSearch(
                store = store,
                games = games,
                props = props,
                trendsLoading = trendsLoading,
                onOpenGame = onOpenGame,
                onOpenAgent = onOpenAgent,
                onOpenMlbProp = onOpenMlbProp,
                onOpenNflProp = onOpenNflProp,
                onOpenTrend = onOpenTrend,
            )
            store.browseScope != null -> {
                exploreRail(store, onBrowse)
                browseResults(
                    store = store,
                    props = props,
                    ownAgentsState = ownAgentsState,
                    trendsLoading = trendsLoading,
                    onExitBrowse = onExitBrowse,
                    onOpenAgent = onOpenAgent,
                    onOpenMlbProp = onOpenMlbProp,
                    onOpenNflProp = onOpenNflProp,
                    onOpenTrend = onOpenTrend,
                )
            }
            else -> launchpad(store, onBrowse, onSelectTab)
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.launchpad(
    store: SearchStore,
    onBrowse: (SearchStore.SearchScope) -> Unit,
    onSelectTab: (MainTabStore.Tab) -> Unit,
) {
    exploreRail(store, onBrowse)

    if (store.recentQueries.isNotEmpty()) {
        item(key = "recent-header") {
            SectionHeader(
                title = "Recent",
                icon = AppIcon.CLOCK_ARROW_CIRCLEPATH.imageVector,
                action = "Clear",
                onAction = store::clearRecentQueries,
            )
        }
        item(key = "recent-rail") {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = Spacing.lg, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                store.recentQueries.forEach { recent -> RecentChip(recent) { store.applyRecent(recent) } }
            }
        }
    }

    item(key = "suggestions-header") {
        SectionHeader("Suggestions", AppIcon.LIGHTBULB_FILL.imageVector)
    }
    item(key = "sports") { SportChips(store) }
    item(key = "trending-agents") {
        SuggestionRow(
            icon = AppIcon.BRAIN_HEAD_PROFILE.imageVector,
            tint = AppColors.appAccentPurple,
            title = "Trending agents",
            subtitle = "Browse the leaderboard",
        ) { onSelectTab(MainTabStore.Tab.Agents) }
    }
    item(key = "top-outliers") {
        SuggestionRow(
            icon = AppIcon.BELL_BADGE_FILL.imageVector,
            tint = AppColors.appAccentAmber,
            title = "Top outliers",
            subtitle = "Situational betting trends",
        ) { onSelectTab(MainTabStore.Tab.Outliers) }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.exploreRail(
    store: SearchStore,
    onBrowse: (SearchStore.SearchScope) -> Unit,
) {
    item(key = "explore-header") { SectionHeader("Explore", AppIcon.WAND_AND_STARS.imageVector) }
    item(key = "explore-rail") {
        LazyRow(
            contentPadding = PaddingValues(horizontal = Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "explore-props") {
                SearchToolCard(
                    title = "Props",
                    subtitle = "Player prop matchups",
                    isSelected = store.browseScope == SearchStore.SearchScope.Players,
                    onTap = { onBrowse(SearchStore.SearchScope.Players) },
                    modifier = Modifier.width(158.dp),
                ) {
                    AngledStatSheetGraphic(
                        rows = listOf(
                            "figure.baseball" to "Judge O 1.5 total bases",
                            "target" to "Has 4 hits in last 10",
                            "flame.fill" to "8+ K's in 3 straight",
                            "baseball.fill" to "Ohtani O 0.5 HR +320",
                            "chart.bar.fill" to "Hits prop cashing 70%",
                            "bolt.fill" to "Skenes 7+ K streak",
                        ),
                        startDelay = 800,
                    )
                }
            }
            item(key = "explore-agents") {
                SearchToolCard(
                    title = "Agents",
                    subtitle = "Top performing AI experts",
                    isSelected = store.browseScope == SearchStore.SearchScope.Agents,
                    onTap = { onBrowse(SearchStore.SearchScope.Agents) },
                    modifier = Modifier.width(158.dp),
                ) {
                    StackedStatCardsGraphic(
                        items = listOf("100%" to "10/10", "+12.4u" to "Last 30", "73%" to "ATS picks", "58-31" to "Season"),
                        startDelay = 400,
                    )
                }
            }
            item(key = "explore-outliers") {
                SearchToolCard(
                    title = "Outliers",
                    subtitle = "Situational betting trends",
                    isSelected = store.browseScope == SearchStore.SearchScope.Outliers,
                    onTap = { onBrowse(SearchStore.SearchScope.Outliers) },
                    modifier = Modifier.width(158.dp),
                ) { RadarSweepGraphic() }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.activeSearch(
    store: SearchStore,
    games: GamesStore,
    props: PropsStore,
    trendsLoading: Boolean,
    onOpenGame: (SearchStore.SearchResult.Game) -> Unit,
    onOpenAgent: (SearchStore.SearchResult.Agent) -> Unit,
    onOpenMlbProp: (PlayerPropSelection) -> Unit,
    onOpenNflProp: (NFLPlayerPropSelection) -> Unit,
    onOpenTrend: (SearchStore.SearchResult.Trend) -> Unit,
) {
    val count = visibleResultCount(store)
    val outlierLoadingForScope = trendsLoading &&
        (store.scope == SearchStore.SearchScope.All || store.scope == SearchStore.SearchScope.Outliers)

    if (store.isDebouncing && count == 0) {
        item(key = "search-loading-matchup-header") { SectionHeader("Matchup", AppIcon.SPORTSCOURT_FILL.imageVector) }
        item(key = "search-loading-game") { GameCardShimmer(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) }
        item(key = "search-loading-outliers-header") { SectionHeader("Outliers", AppIcon.CHART_LINE_UPTREND.imageVector) }
        item(key = "search-loading-outliers") { OutlierShimmerRail() }
        return
    }

    if (count == 0 && !outlierLoadingForScope && !store.isDebouncing) {
        item(key = "no-results") {
            SearchEmptyState(
                title = "No results for “${store.debouncedQuery}”",
                message = "Try a team, player, agent, matchup, or a broader search scope.",
            )
        }
        return
    }

    if (showsScope(store, SearchStore.SearchScope.Games) && store.gameResults.isNotEmpty()) {
        item(key = "game-header") {
            SectionHeader("Matchup", AppIcon.SPORTSCOURT_FILL.imageVector, store.gameResults.size)
        }
        items(store.gameResults, key = { it.id }) { result ->
            SearchGameCard(result, games, onOpenGame, Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
        }
    }

    if (showsScope(store, SearchStore.SearchScope.Players) && store.playerResults.isNotEmpty()) {
        item(key = "player-header") {
            SectionHeader("Props", AppIcon.FIGURE_BASKETBALL.imageVector, store.playerResults.size)
        }
        items(store.playerResults, key = { it.id }) { result ->
            SearchPlayerCard(result, props, onOpenMlbProp, onOpenNflProp)
        }
    }

    if (showsScope(store, SearchStore.SearchScope.Agents) && store.agentResults.isNotEmpty()) {
        item(key = "agent-header") {
            SectionHeader("Agents", AppIcon.BRAIN_HEAD_PROFILE.imageVector, store.agentResults.size)
        }
        items(store.agentResults, key = { it.id }) { result ->
            AgentRowCard(
                agent = result.model,
                onTap = { onOpenAgent(result) },
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            )
        }
    }

    if (showsScope(store, SearchStore.SearchScope.Outliers)) {
        when {
            store.trendResults.isNotEmpty() -> {
                item(key = "outlier-header") {
                    SectionHeader("Outliers", AppIcon.CHART_LINE_UPTREND.imageVector, store.trendResults.size)
                }
                item(key = "outlier-results") { OutlierRail(store.trendResults, onOpenTrend) }
            }
            trendsLoading -> {
                item(key = "outlier-loading-header") {
                    SectionHeader("Outliers", AppIcon.CHART_LINE_UPTREND.imageVector)
                }
                item(key = "outlier-loading") { OutlierShimmerRail() }
            }
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.browseResults(
    store: SearchStore,
    props: PropsStore,
    ownAgentsState: LoadState,
    trendsLoading: Boolean,
    onExitBrowse: () -> Unit,
    onOpenAgent: (SearchStore.SearchResult.Agent) -> Unit,
    onOpenMlbProp: (PlayerPropSelection) -> Unit,
    onOpenNflProp: (NFLPlayerPropSelection) -> Unit,
    onOpenTrend: (SearchStore.SearchResult.Trend) -> Unit,
) {
    when (store.browseScope) {
        SearchStore.SearchScope.Players -> {
            val results = store.browsePlayerResults
            item(key = "browse-props-header") {
                BrowseHeader("Props", AppIcon.FIGURE_BASKETBALL.imageVector, results.size, onExitBrowse)
            }
            when {
                results.isNotEmpty() -> items(results, key = { it.id }) { result ->
                    SearchPlayerCard(result, props, onOpenMlbProp, onOpenNflProp)
                }
                props.isLoadingMLB || props.isLoadingNFL -> items(4) { index ->
                    PropCardShimmer(Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
                }
                else -> item { BrowseEmpty("No props available", "Player props load in-season. Check back when games are on the board.", onExitBrowse) }
            }
        }
        SearchStore.SearchScope.Agents -> {
            val results = store.browseAgentResults
            item(key = "browse-agents-header") {
                BrowseHeader("Agents", AppIcon.BRAIN_HEAD_PROFILE.imageVector, results.size, onExitBrowse)
            }
            when {
                results.isNotEmpty() -> items(results, key = { it.id }) { result ->
                    AgentRowCard(
                        agent = result.model,
                        onTap = { onOpenAgent(result) },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
                ownAgentsState.isLoading || store.isLoadingPublicAgents -> items(4) { index ->
                    SearchAgentSkeleton(Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
                }
                else -> item { BrowseEmpty("No agents yet", "Create an agent or browse the leaderboard to find picks experts.", onExitBrowse) }
            }
        }
        SearchStore.SearchScope.Outliers -> {
            val results = store.browseTrendResults
            item(key = "browse-outliers-header") {
                BrowseHeader("Outliers", AppIcon.CHART_LINE_UPTREND.imageVector, results.size, onExitBrowse)
            }
            when {
                results.isNotEmpty() -> item(key = "browse-outliers") { OutlierRail(results, onOpenTrend) }
                trendsLoading -> item(key = "browse-outliers-loading") { OutlierShimmerRail() }
                else -> item { BrowseEmpty("No outliers available", "Situational trends load when games are scheduled.", onExitBrowse) }
            }
        }
        else -> item { BrowseEmpty("Nothing to browse", "Choose Props, Agents, or Outliers above.", onExitBrowse) }
    }
}

@Composable
private fun SearchGameCard(
    result: SearchStore.SearchResult.Game,
    games: GamesStore,
    onOpen: (SearchStore.SearchResult.Game) -> Unit,
    modifier: Modifier = Modifier,
) {
    when (result.sport) {
        SearchStore.GamesStoreSport.NFL -> games.games.nfl.firstOrNull { it.uniqueId == result.resolvedId }?.let {
            NFLGameCard(it, { onOpen(result) }, modifier)
        }
        SearchStore.GamesStoreSport.CFB -> games.games.cfb.firstOrNull { it.uniqueId == result.resolvedId }?.let {
            CFBGameCard(it, { onOpen(result) }, modifier)
        }
        SearchStore.GamesStoreSport.NBA -> games.games.nba.firstOrNull { it.id == result.resolvedId }?.let {
            NBAGameCard(it, { onOpen(result) }, modifier)
        }
        SearchStore.GamesStoreSport.NCAAB -> games.games.ncaab.firstOrNull { it.id == result.resolvedId }?.let {
            NCAABGameCard(it, { onOpen(result) }, modifier)
        }
        SearchStore.GamesStoreSport.MLB -> games.games.mlb.firstOrNull { it.id == result.resolvedId }?.let {
            MLBGameCard(it, { onOpen(result) }, modifier)
        }
    }
}

@Composable
private fun SearchPlayerCard(
    result: SearchStore.SearchResult.Player,
    props: PropsStore,
    onOpenMlb: (PlayerPropSelection) -> Unit,
    onOpenNfl: (NFLPlayerPropSelection) -> Unit,
) {
    when (val kind = result.kind) {
        is SearchStore.SearchResult.Player.Kind.Mlb -> {
            val item = mlbPropItem(kind, props) ?: return
            PropPlayerCard(item, onOpenMlb, Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
        }
        is SearchStore.SearchResult.Player.Kind.Nfl -> {
            val item = nflPropItem(kind, props) ?: return
            NflPropPlayerCard(item, onOpenNfl, Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
        }
    }
}

private fun mlbPropItem(kind: SearchStore.SearchResult.Player.Kind.Mlb, props: PropsStore): PlayerPropFeedItem? {
    val matchup = props.matchup(kind.gamePk) ?: return null
    return PlayerPropFeed.items(listOf(matchup)).firstOrNull { it.selection.playerId == kind.playerId }
}

private fun nflPropItem(kind: SearchStore.SearchResult.Player.Kind.Nfl, props: PropsStore): NFLPropFeedItem? {
    val player = props.nflPlayers.firstOrNull { it.id == kind.playerKey } ?: return null
    return NFLPropFeed.items(listOf(player)).firstOrNull()
}

@Composable
private fun OutlierRail(
    results: List<SearchStore.SearchResult.Trend>,
    onOpen: (SearchStore.SearchResult.Trend) -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = Spacing.lg, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(results, key = { it.id }) { result ->
            Box(Modifier.width(300.dp).clickable { onOpen(result) }) {
                OutliersTrendCard(card = result.card, sport = result.sport, game = result.game)
            }
        }
    }
}

@Composable
private fun OutlierShimmerRail() {
    LazyRow(
        contentPadding = PaddingValues(horizontal = Spacing.lg, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        userScrollEnabled = false,
    ) {
        items(4) { OutliersTrendCardShimmer(Modifier.width(300.dp)) }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    icon: ImageVector,
    count: Int? = null,
    action: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(top = 18.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp))
        Text(title.uppercase(), color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
        count?.let { Text(it.toString(), color = AppColors.appTextMuted, fontSize = 12.sp) }
        Spacer(Modifier.weight(1f))
        if (action != null && onAction != null) {
            Text(
                action,
                color = AppColors.appPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(onClick = onAction).padding(6.dp),
            )
        }
    }
}

@Composable
private fun BrowseHeader(title: String, icon: ImageVector, count: Int, onClear: () -> Unit) {
    SectionHeader(title = title, icon = icon, count = count.takeIf { it > 0 }, action = "Clear", onAction = onClear)
}

@Composable
private fun RecentChip(text: String, onTap: () -> Unit) {
    Row(
        Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted).clickable(onClick = onTap).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(AppIcon.CLOCK_ARROW_CIRCLEPATH.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(13.dp))
        Text(text, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
private fun SportChips(store: SearchStore) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = Spacing.lg, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        SearchStore.GamesStoreSport.entries.forEach { sport ->
            Row(
                Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted).clickable {
                    store.scope = SearchStore.SearchScope.Games
                    store.query = sport.label
                    store.flushDebounce()
                }.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(sportIcon(sport), null, tint = AppColors.appTextPrimary, modifier = Modifier.size(14.dp))
                Text(sport.label, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun SuggestionRow(
    icon: ImageVector,
    tint: Color,
    title: String,
    subtitle: String,
    onTap: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onTap).padding(horizontal = Spacing.lg, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).clip(RoundedCornerShape(8.dp)).background(tint.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(17.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = AppColors.appTextSecondary, fontSize = 13.sp)
        }
        Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(13.dp))
    }
}

@Composable
private fun SearchEmptyState(title: String, message: String) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 64.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(AppIcon.MAGNIFYINGGLASS.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(38.dp))
        Text(title, color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(message, color = AppColors.appTextSecondary, fontSize = 14.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun BrowseEmpty(title: String, message: String, onBack: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(AppIcon.MAGNIFYINGGLASS.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(34.dp))
        Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        Text(
            "Back to Explore",
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(AppColors.appPrimary).clickable(onClick = onBack).padding(horizontal = 16.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun SearchAgentSkeleton(modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(AppColors.appSurfaceElevated)
            .padding(14.dp)
            .shimmering(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonCircle(48.dp)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SkeletonBlock(width = 150.dp, height = 14.dp)
            SkeletonBlock(width = 96.dp, height = 11.dp)
        }
        Spacer(Modifier.weight(1f))
        SkeletonBlock(width = 52.dp, height = 28.dp, cornerRadius = 8.dp)
    }
}

private fun showsScope(store: SearchStore, scope: SearchStore.SearchScope): Boolean =
    store.scope == SearchStore.SearchScope.All || store.scope == scope

private fun visibleResultCount(store: SearchStore): Int = when (store.scope) {
    SearchStore.SearchScope.All -> store.totalResultCount
    SearchStore.SearchScope.Games -> store.gameResults.size
    SearchStore.SearchScope.Players -> store.playerResults.size
    SearchStore.SearchScope.Agents -> store.agentResults.size
    SearchStore.SearchScope.Outliers -> store.trendResults.size
}

private fun sportIcon(sport: SearchStore.GamesStoreSport): ImageVector = when (sport) {
    SearchStore.GamesStoreSport.NFL, SearchStore.GamesStoreSport.CFB -> AppIcon.FOOTBALL_FILL.imageVector
    SearchStore.GamesStoreSport.NBA, SearchStore.GamesStoreSport.NCAAB -> AppIcon.BASKETBALL.imageVector
    SearchStore.GamesStoreSport.MLB -> AppIcon.FIGURE_BASEBALL.imageVector
}
