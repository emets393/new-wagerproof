package com.wagerproof.app.features.props

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.props.components.NflPropPlayerCard
import com.wagerproof.app.features.props.components.PropCardShimmer
import com.wagerproof.app.features.props.components.PropPlayerCard
import com.wagerproof.app.features.props.detail.NflPropDetailScreen
import com.wagerproof.app.features.props.detail.PlayerPropDetailScreen
import com.wagerproof.app.features.navigation.WagerProofTopBar
import com.wagerproof.app.features.components.InsetGroupedDivider
import com.wagerproof.app.features.components.InsetGroupedSection
import com.wagerproof.app.features.components.QuickFilterField
import com.wagerproof.app.features.components.SheetSearchField
import com.wagerproof.app.features.parlaygod.ParlayGodAccessState
import com.wagerproof.app.features.parlaygod.ParlayGodDetailSheet
import com.wagerproof.app.features.parlaygod.ParlayGodRail
import com.wagerproof.app.features.paywall.PaywallDialogHost
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.ParlaySport
import com.wagerproof.core.models.ParlayTicket
import com.wagerproof.core.services.RevenueCatService
import com.wagerproof.core.stores.MLBPlayerPropPicksStore
import com.wagerproof.core.stores.ParlayGodStore
import com.wagerproof.core.stores.PropsStore
import com.wagerproof.core.stores.SportSeason
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

/**
 * Props tab root — port of iOS `PropsView.swift`. A pinned filter pill row
 * (Sport / Matchup / Market / Sort) over a date-grouped player-prop feed. MLB
 * and NFL have live feeds; other sports show a "coming soon" state. Detail pages
 * + the Best Picks hub are managed internally (the tab back stack has no
 * prop-detail routes) and swapped via [AnimatedContent].
 */
private enum class PropSortMode(val label: String, val icon: ImageVector) {
    TIME("Game Time", AppIcon.CLOCK.imageVector),
    HIT_RATE("L10 Hit Rate", AppIcon.FLAME_FILL.imageVector);

    companion object {
        fun modes(sport: PropsStore.Sport): List<PropSortMode> =
            if (sport == PropsStore.Sport.MLB || sport == PropsStore.Sport.NFL) entries else listOf(TIME)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PropsScreen(
    modifier: Modifier = Modifier,
    onFullScreenChanged: (Boolean) -> Unit = {},
) {
    val graph = appGraph()
    val store = graph.props
    val parlayGod = graph.parlayGod
    val tabStore = graph.mainTab
    // iOS creates the Best Picks store locally in PropsView (@State).
    val bestPicksStore = remember { MLBPlayerPropPicksStore() }
    val scope = rememberCoroutineScope()

    var sortMode by remember { mutableStateOf(PropSortMode.TIME) }
    var mlbFilters by remember { mutableStateOf(MLBPropFeedFilters()) }
    var nflFilters by remember { mutableStateOf(NFLPropFeedFilters()) }
    // Screen-local (unlike Games, which keys the query per sport in its store):
    // the MLB and NFL prop boards share no vocabulary, so iOS clears the field
    // on every sport switch rather than restoring a stale one.
    var quickFilterText by remember { mutableStateOf("") }

    var showSportSheet by remember { mutableStateOf(false) }
    var showMLBMatchupSheet by remember { mutableStateOf(false) }
    var showMLBMarketSheet by remember { mutableStateOf(false) }
    var showNFLMatchupSheet by remember { mutableStateOf(false) }
    var showNFLMarketSheet by remember { mutableStateOf(false) }

    var selectedProp by remember { mutableStateOf<PlayerPropSelection?>(null) }
    var selectedNFLProp by remember { mutableStateOf<NFLPlayerPropSelection?>(null) }
    var showBestPicks by remember { mutableStateOf(false) }
    var selectedParlay by remember { mutableStateOf<ParlayTicket?>(null) }
    var showParlayPaywall by remember { mutableStateOf(false) }
    // Detail opened from within Best Picks — back returns to Best Picks.
    var bestPicksDetail by remember { mutableStateOf<Pair<PlayerPropSelection, Double?>?>(null) }

    // Screen-entry + sport-switch load, mirroring iOS `.task(id: selectedSport)`.
    LaunchedEffect(store.selectedSport) {
        quickFilterText = ""
        if (store.selectedSport != PropsStore.Sport.MLB) mlbFilters = MLBPropFeedFilters()
        if (store.selectedSport != PropsStore.Sport.NFL) nflFilters = NFLPropFeedFilters()
        if (sortMode !in PropSortMode.modes(store.selectedSport)) sortMode = PropSortMode.TIME
        store.refresh()
        if (store.selectedSport == PropsStore.Sport.MLB) {
            bestPicksStore.refreshSummaryOnly()
            parlayGod.refreshIfNeeded()
        }
    }

    // Reactive filter rules (ported exactly).
    LaunchedEffect(mlbFilters.market) {
        val market = mlbFilters.market
        if (market == "batter_home_runs") {
            mlbFilters = mlbFilters.copy(market = null)
        } else if (market != null && store.selectedSport == PropsStore.Sport.MLB) {
            sortMode = PropSortMode.HIT_RATE
        }
    }
    LaunchedEffect(nflFilters.market) {
        val market = nflFilters.market
        if (market != null) {
            if (nflFilters.signalsOnly) nflFilters = nflFilters.copy(signalsOnly = false)
            if (store.selectedSport == PropsStore.Sport.NFL) sortMode = PropSortMode.HIT_RATE
        }
    }
    LaunchedEffect(nflFilters.signalsOnly) {
        if (store.selectedSport == PropsStore.Sport.NFL && nflFilters.signalsOnly) {
            sortMode = PropSortMode.HIT_RATE
            val gameId = nflFilters.gameId
            if (gameId != null && !NFLPropFeedFilters.hasFlaggedPlayers(store.nflPlayers, gameId)) {
                nflFilters = nflFilters.copy(gameId = null)
            }
        }
    }
    LaunchedEffect(store.nflPlayers) {
        val market = nflFilters.market ?: return@LaunchedEffect
        if (market !in NFLPropFeedFilters.sheetMarkets(store.nflPlayers).allKeys) {
            nflFilters = nflFilters.copy(market = null)
        }
    }

    // --- Internal navigation ------------------------------------------------
    val dest: String = when {
        bestPicksDetail != null -> "bestPickDetail"
        selectedProp != null -> "mlbDetail"
        selectedNFLProp != null -> "nflDetail"
        showBestPicks -> "bestPicks"
        else -> "feed"
    }

    LaunchedEffect(dest) { onFullScreenChanged(dest != "feed") }
    DisposableEffect(Unit) {
        onDispose { onFullScreenChanged(false) }
    }

    AnimatedContent(
        targetState = dest,
        transitionSpec = {
            (scaleIn(tween(240), initialScale = 0.92f) + fadeIn(tween(240))) togetherWith
                (scaleOut(tween(240), targetScale = 0.96f) + fadeOut(tween(240)))
        },
        modifier = modifier.fillMaxSize(),
        label = "props-nav",
    ) { target ->
        when (target) {
            "mlbDetail" -> selectedProp?.let { sel ->
                PlayerPropDetailScreen(selection = sel, onBack = { selectedProp = null })
            }
            "nflDetail" -> selectedNFLProp?.let { sel ->
                NflPropDetailScreen(selection = sel, onBack = { selectedNFLProp = null })
            }
            "bestPickDetail" -> bestPicksDetail?.let { (sel, line) ->
                PlayerPropDetailScreen(selection = sel, initialLine = line, onBack = { bestPicksDetail = null })
            }
            "bestPicks" -> MlbBestPicksScreen(
                store = bestPicksStore,
                propsStore = store,
                onOpenDetail = { sel, line -> bestPicksDetail = sel to line },
                onBack = { showBestPicks = false },
            )
            else -> FeedContent(
                store = store,
                tabStore = graph.mainTab,
                bestPicksStore = bestPicksStore,
                parlayGod = parlayGod,
                parlayAccess = when {
                    graph.proAccess.isLoading -> ParlayGodAccessState.Resolving
                    graph.proAccess.isPro -> ParlayGodAccessState.Granted
                    else -> ParlayGodAccessState.Locked
                },
                sortMode = sortMode,
                onSortMode = { sortMode = it },
                mlbFilters = mlbFilters,
                nflFilters = nflFilters,
                quickFilterText = quickFilterText,
                onQuickFilterText = { quickFilterText = it },
                onOpenSportSheet = { showSportSheet = true },
                onOpenMlbMatchup = { showMLBMatchupSheet = true },
                onOpenMlbMarket = { showMLBMarketSheet = true },
                onOpenNflMatchup = { showNFLMatchupSheet = true },
                onOpenNflMarket = { showNFLMarketSheet = true },
                onSelectMlb = { selectedProp = it },
                onSelectNfl = { selectedNFLProp = it },
                onOpenBestPicks = { showBestPicks = true },
                onSelectParlay = { selectedParlay = it },
                onRequestParlayPro = { showParlayPaywall = true },
            )
        }
    }

    // --- Sheets -------------------------------------------------------------
    if (showSportSheet) {
        PropSportPickerSheet(
            selection = store.selectedSport,
            onSelect = { store.selectedSport = it },
            onDismiss = { showSportSheet = false },
        )
    }
    if (showMLBMatchupSheet) {
        MLBMatchupPickerSheet(
            options = MLBPropGameFilterOptions.build(store.sortedMatchups()),
            selection = mlbFilters.gamePk,
            onSelect = { mlbFilters = mlbFilters.copy(gamePk = it) },
            onDismiss = { showMLBMatchupSheet = false },
        )
    }
    if (showMLBMarketSheet) {
        MLBMarketFilterSheet(
            selected = mlbFilters.market,
            onSelect = { mlbFilters = mlbFilters.copy(market = it) },
            onDismiss = { showMLBMarketSheet = false },
        )
    }
    if (showNFLMatchupSheet) {
        NFLMatchupPickerSheet(
            options = NFLPropGameFilterOptions.build(store.nflPlayers, nflFilters.signalsOnly),
            selection = nflFilters.gameId,
            onSelect = { nflFilters = nflFilters.copy(gameId = it) },
            onDismiss = { showNFLMatchupSheet = false },
        )
    }
    if (showNFLMarketSheet) {
        NFLMarketFilterSheet(
            filters = nflFilters,
            players = store.nflPlayers,
            onSelectMarket = { nflFilters = nflFilters.copy(signalsOnly = false, market = it) },
            onSelectSignals = { nflFilters = nflFilters.copy(market = null, signalsOnly = true) },
            onDismiss = { showNFLMarketSheet = false },
        )
    }

    selectedParlay?.let { ticket ->
        ParlayGodDetailSheet(ticket = ticket, onDismiss = { selectedParlay = null })
    }

    PaywallDialogHost(
        show = showParlayPaywall,
        placementId = RevenueCatService.Placement.GENERIC_FEATURE,
        onDismiss = { showParlayPaywall = false },
    )
}

// MARK: - Feed

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun FeedContent(
    store: PropsStore,
    tabStore: com.wagerproof.core.stores.MainTabStore,
    bestPicksStore: MLBPlayerPropPicksStore,
    parlayGod: ParlayGodStore,
    parlayAccess: ParlayGodAccessState,
    sortMode: PropSortMode,
    onSortMode: (PropSortMode) -> Unit,
    mlbFilters: MLBPropFeedFilters,
    nflFilters: NFLPropFeedFilters,
    quickFilterText: String,
    onQuickFilterText: (String) -> Unit,
    onOpenSportSheet: () -> Unit,
    onOpenMlbMatchup: () -> Unit,
    onOpenMlbMarket: () -> Unit,
    onOpenNflMatchup: () -> Unit,
    onOpenNflMarket: () -> Unit,
    onSelectMlb: (PlayerPropSelection) -> Unit,
    onSelectNfl: (NFLPlayerPropSelection) -> Unit,
    onOpenBestPicks: () -> Unit,
    onSelectParlay: (ParlayTicket) -> Unit,
    onRequestParlayPro: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }
    val sport = store.selectedSport
    val activeQuickFilter = quickFilterText.trim()
    val query = activeQuickFilter.lowercase()

    // iOS caches these behind PropsPresentationCache (PropsView.swift:53-82) —
    // "far too expensive to re-run on every body pass". Everything below used to
    // run inside the LazyColumn content lambda, i.e. once per recomposition of a
    // 250-350 card board, on the main thread. `remember` keyed on the same
    // inputs as iOS's presentation key is the Compose equivalent; the store's
    // `sortedMatchups()` is already identity-stable (Wave 1, AND-045).
    val matchups = store.sortedMatchups()
    val mlbOptions = remember(matchups) { MLBPropGameFilterOptions.build(matchups) }
    val nflOptions = remember(store.nflPlayers, nflFilters.signalsOnly) {
        NFLPropGameFilterOptions.build(store.nflPlayers, nflFilters.signalsOnly)
    }
    val mlbSections = remember(matchups, mlbFilters, sortMode, query) {
        val items = sortedMlbItems(
            quickFilteredMlbItems(PlayerPropFeed.items(matchups, mlbFilters), query),
            sortMode,
        )
        groupByDate(
            items,
            key = { PropsFormatting.dateKey(it.sortDate) },
            label = { PropsFormatting.dateLabel(it.selection.officialDate) },
        )
    }
    val nflSections = remember(store.nflPlayers, nflFilters, sortMode, query) {
        val items = sortedNflItems(
            quickFilteredNflItems(NFLPropFeed.items(store.nflPlayers, nflFilters), query),
            sortMode,
            nflFilters,
        )
        groupByDate(
            items,
            key = { PropsFormatting.dateKey(it.sortDate) },
            label = { PropsFormatting.dateLabel(it.player.gameDate) },
        )
    }

    Column(Modifier.fillMaxSize().background(AppColors.appSurface)) {
        WagerProofTopBar(
            tabStore = tabStore,
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.statusBars),
        )
        Text(
            "Props",
            color = AppColors.appTextPrimary,
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .padding(horizontal = Spacing.lg, vertical = 2.dp),
        )

        // Quick Filter + pill row pin together, matching iOS `propsHeader`.
        QuickFilterField(
            value = quickFilterText,
            onValueChange = onQuickFilterText,
            accessibilityLabel = "Quick filter player props",
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp),
        )

        // Pinned filter pills.
        FilterPills(
            sport = sport,
            sortMode = sortMode,
            onSortMode = onSortMode,
            mlbFilters = mlbFilters,
            nflFilters = nflFilters,
            mlbOptions = mlbOptions,
            nflOptions = nflOptions,
            onOpenSportSheet = onOpenSportSheet,
            onOpenMlbMatchup = onOpenMlbMatchup,
            onOpenMlbMarket = onOpenMlbMarket,
            onOpenNflMatchup = onOpenNflMatchup,
            onOpenNflMarket = onOpenNflMarket,
        )

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = {
                scope.launch {
                    refreshing = true
                    val feed = async { store.refresh(force = true) }
                    val parlays = async { parlayGod.refreshIfNeeded(force = true) }
                    val bestPicks = if (sport == PropsStore.Sport.MLB) {
                        async { bestPicksStore.refreshSummaryOnly(force = true) }
                    } else {
                        null
                    }
                    feed.await()
                    parlays.await()
                    bestPicks?.await()
                    refreshing = false
                }
            },
            modifier = Modifier.weight(1f),
        ) {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Best Picks is a slate-wide shortcut, not a search result — iOS
                // drops it while a Quick Filter is active (PropsView.swift:148).
                if (sport == PropsStore.Sport.MLB && activeQuickFilter.isEmpty()) {
                    item {
                        com.wagerproof.app.features.props.components.MlbBestPicksBanner(
                            store = bestPicksStore,
                            onTap = onOpenBestPicks,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        )
                    }
                }
                if ((sport == PropsStore.Sport.MLB || sport == PropsStore.Sport.NFL) && activeQuickFilter.isEmpty()) {
                    item(key = "props-cheats-${sport.raw}") {
                        val cheatSport = if (sport == PropsStore.Sport.NFL) ParlaySport.NFL else ParlaySport.MLB
                        ParlayGodRail(
                            title = "Props Cheats",
                            icon = AppIcon.SCOPE,
                            tickets = parlayGod.propsTickets(cheatSport),
                            isLoading = parlayGod.isLoading,
                            sports = parlayGod.propsSports(cheatSport),
                            emptyMessage = if (cheatSport == ParlaySport.NFL) {
                                "NFL prop cheats are waiting for more Week 1 markets. Cards will appear when enough posted props have a qualifying perfect streak."
                            } else {
                                "No perfect-streak props on the board right now — cheats reload when the day's props post each morning."
                            },
                            errorMessage = parlayGod.errorMessage,
                            onRetry = { scope.launch { parlayGod.refreshIfNeeded(force = true) } },
                            onTicketClick = onSelectParlay,
                            accessState = parlayAccess,
                            onRequestPro = onRequestParlayPro,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp)
                                .padding(bottom = 4.dp),
                            contentPadding = PaddingValues(0.dp),
                        )
                    }
                }
                feedBody(
                    store = store,
                    sport = sport,
                    mlbFeedSections = mlbSections,
                    nflFeedSections = nflSections,
                    mlbEmptyLabel = mlbFilteredEmptyLabel(store, mlbFilters, activeQuickFilter),
                    nflEmptyLabel = nflFilteredEmptyLabel(store, nflFilters, activeQuickFilter),
                    onSelectMlb = onSelectMlb,
                    onSelectNfl = onSelectNfl,
                )
            }
        }
    }
}

/**
 * Sections are built (and memoized) by the caller — `remember` cannot be called
 * from inside a LazyListScope extension, and rebuilding a 300-card prop board
 * per recomposition is exactly what iOS's PropsPresentationCache exists to stop.
 */
@OptIn(ExperimentalFoundationApi::class)
private fun androidx.compose.foundation.lazy.LazyListScope.feedBody(
    store: PropsStore,
    sport: PropsStore.Sport,
    mlbFeedSections: List<PropDateSection<PlayerPropFeedItem>>,
    nflFeedSections: List<PropDateSection<NFLPropFeedItem>>,
    mlbEmptyLabel: String,
    nflEmptyLabel: String,
    onSelectMlb: (PlayerPropSelection) -> Unit,
    onSelectNfl: (NFLPlayerPropSelection) -> Unit,
) {
    when {
        !sport.hasProps -> item { ComingSoonState(sport) }
        store.isLoading && !store.hasCachedMatchups -> item { LoadingSkeleton() }
        store.errorMessage != null && !store.hasCachedMatchups -> item { ErrorState(store.errorMessage!!) }
        sport == PropsStore.Sport.NFL ->
            nflSections(nflFeedSections, store.nflPlayers.isEmpty(), nflEmptyLabel, onSelectNfl)
        else ->
            mlbSections(mlbFeedSections, store.sortedMatchups().isEmpty(), mlbEmptyLabel, onSelectMlb)
    }
}

@OptIn(ExperimentalFoundationApi::class)
private fun androidx.compose.foundation.lazy.LazyListScope.mlbSections(
    sections: List<PropDateSection<PlayerPropFeedItem>>,
    slateIsEmpty: Boolean,
    emptyLabel: String,
    onSelect: (PlayerPropSelection) -> Unit,
) {
    if (sections.isEmpty()) {
        // Whole board empty → season-aware copy; board has props but the
        // filters/query excluded them all → the narrowed label.
        if (slateIsEmpty) {
            item { SeasonEmptyTile(PropsStore.Sport.MLB) }
        } else {
            item { EmptyTile(emptyLabel) }
        }
        return
    }
    sections.forEach { section ->
        stickyHeader(key = "mlb-${section.key}") { DateHeader(section.label) }
        itemsIndexedFeed(section.items) { index, item ->
            PropPlayerCard(item = item, onSelect = onSelect, modifier = Modifier.padding(horizontal = 12.dp).staggeredAppear(index))
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
private fun androidx.compose.foundation.lazy.LazyListScope.nflSections(
    sections: List<PropDateSection<NFLPropFeedItem>>,
    slateIsEmpty: Boolean,
    emptyLabel: String,
    onSelect: (NFLPlayerPropSelection) -> Unit,
) {
    if (sections.isEmpty()) {
        if (slateIsEmpty) {
            item { SeasonEmptyTile(PropsStore.Sport.NFL) }
        } else {
            item { EmptyTile(emptyLabel) }
        }
        return
    }
    sections.forEach { section ->
        stickyHeader(key = "nfl-${section.key}") { DateHeader(section.label) }
        itemsIndexedFeedNfl(section.items) { index, item ->
            NflPropPlayerCard(item = item, onSelect = onSelect, modifier = Modifier.padding(horizontal = 12.dp).staggeredAppear(index))
        }
    }
}

// Small typed helpers so `itemsIndexed` keys off the feed item id.
private fun androidx.compose.foundation.lazy.LazyListScope.itemsIndexedFeed(
    items: List<PlayerPropFeedItem>,
    content: @Composable (Int, PlayerPropFeedItem) -> Unit,
) = items(items.size, key = { items[it].id }) { i -> content(i, items[i]) }

private fun androidx.compose.foundation.lazy.LazyListScope.itemsIndexedFeedNfl(
    items: List<NFLPropFeedItem>,
    content: @Composable (Int, NFLPropFeedItem) -> Unit,
) = items(items.size, key = { items[it].id }) { i -> content(i, items[i]) }

private fun sortedMlbItems(items: List<PlayerPropFeedItem>, sortMode: PropSortMode): List<PlayerPropFeedItem> =
    when (sortMode) {
        PropSortMode.TIME -> items.sortedWith(compareBy({ it.sortTime }, { -it.hitRate }))
        PropSortMode.HIT_RATE -> items.sortedWith(compareByDescending<PlayerPropFeedItem> { it.hitRate }.thenBy { it.sortTime })
    }

private fun sortedNflItems(items: List<NFLPropFeedItem>, sortMode: PropSortMode, filters: NFLPropFeedFilters): List<NFLPropFeedItem> {
    val mode = if (filters.signalsOnly) PropSortMode.HIT_RATE else sortMode
    return when (mode) {
        PropSortMode.HIT_RATE -> items.sortedWith(compareByDescending<NFLPropFeedItem> { it.hitRate }.thenBy { it.sortTime })
        PropSortMode.TIME -> items.sortedWith(compareBy({ it.sortTime }, { it.player.playerName }))
    }
}

// MARK: - Quick Filter
//
// Free-text narrowing over the fields a user would actually type: who's playing,
// who they're playing, where they line up, and what the card is about. Ported
// field-for-field from iOS `quickFilteredMLBItems` / `quickFilteredNFLItems`
// (PropsView.swift:774-807) — adding or dropping a field here silently changes
// which cards a query reaches, so keep the two lists in sync.

internal fun quickFilteredMlbItems(
    items: List<PlayerPropFeedItem>,
    query: String,
): List<PlayerPropFeedItem> {
    if (query.isEmpty()) return items
    return items.filter { item ->
        val s = item.selection
        listOf(
            s.playerName,
            s.teamName,
            s.teamAbbr,
            s.opponentName,
            s.opponentAbbr,
            s.position ?: "",
            MLBPlayerProps.marketLabel(item.headline.row.market),
            item.metricLabel,
        ).any { it.lowercase().contains(query) }
    }
}

internal fun quickFilteredNflItems(
    items: List<NFLPropFeedItem>,
    query: String,
): List<NFLPropFeedItem> {
    if (query.isEmpty()) return items
    return items.filter { item ->
        listOf(
            item.player.playerName,
            item.player.team ?: "",
            item.player.opponent ?: "",
            item.player.position ?: "",
            NFLPlayerProps.marketLabel(item.displayMarket.market),
            item.metricLabel,
        ).any { it.lowercase().contains(query) }
    }
}

// MARK: - Empty labels

private fun nflFilteredEmptyLabel(
    store: PropsStore,
    filters: NFLPropFeedFilters,
    activeQuickFilter: String,
): String {
    if (store.nflPlayers.isEmpty()) return "No NFL player props posted today"
    // Query wins over the pill filters: it's the control the user just touched,
    // so echoing it back is what tells them why the board went blank.
    if (activeQuickFilter.isNotEmpty()) return "No NFL player props match “$activeQuickFilter”"
    val marketLabel = filters.market?.let { NFLPlayerProps.marketLabel(it) }
    val options = NFLPropGameFilterOptions.build(store.nflPlayers, filters.signalsOnly)
    val matchup = filters.gameId?.let { gid -> options.firstOrNull { it.gameId == gid } }?.let { "${it.awayAbbr} @ ${it.homeAbbr}" }
    if (filters.signalsOnly) {
        if (matchup != null) return if (marketLabel != null) "No $marketLabel prop signals for $matchup" else "No prop signals for $matchup"
        return if (marketLabel != null) "No $marketLabel prop signals posted today" else "No prop signals posted today"
    }
    if (matchup != null) return if (marketLabel != null) "No $marketLabel props for $matchup" else "No props posted for $matchup"
    return if (marketLabel != null) "No $marketLabel props posted today" else "No NFL player props match these filters"
}

private fun mlbFilteredEmptyLabel(
    store: PropsStore,
    filters: MLBPropFeedFilters,
    activeQuickFilter: String,
): String {
    if (store.sortedMatchups().isEmpty()) return "No MLB player props posted today"
    if (activeQuickFilter.isNotEmpty()) return "No MLB player props match “$activeQuickFilter”"
    val marketLabel = filters.market?.let { MLBPlayerProps.marketLabel(it) }
    val game = filters.gamePk?.let { pk -> store.sortedMatchups().firstOrNull { it.gamePk == pk } }
    if (game != null) {
        val matchup = "${game.awayAbbr} @ ${game.homeAbbr}"
        return if (marketLabel != null) "No $marketLabel props for $matchup" else "No props posted for $matchup"
    }
    return if (marketLabel != null) "No $marketLabel props posted today" else "No MLB player props match these filters"
}

// MARK: - Filter pills

@Composable
private fun FilterPills(
    sport: PropsStore.Sport,
    sortMode: PropSortMode,
    onSortMode: (PropSortMode) -> Unit,
    mlbFilters: MLBPropFeedFilters,
    nflFilters: NFLPropFeedFilters,
    mlbOptions: List<MLBPropGameFilterOption>,
    nflOptions: List<NFLPropGameFilterOption>,
    onOpenSportSheet: () -> Unit,
    onOpenMlbMatchup: () -> Unit,
    onOpenMlbMarket: () -> Unit,
    onOpenNflMatchup: () -> Unit,
    onOpenNflMarket: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = Spacing.lg, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PillLabel(sportIcon(sport), sport.label, dimmed = sportOffSeason(sport), onClick = onOpenSportSheet)

        if (sport.hasProps) {
            when (sport) {
                PropsStore.Sport.MLB -> {
                    val opt = mlbFilters.gamePk?.let { pk -> mlbOptions.firstOrNull { it.gamePk == pk } }
                    if (opt != null) {
                        PillContainer(onClick = onOpenMlbMatchup) {
                            MiniLogo(opt.awayLogoUrl, opt.awayAbbr)
                            MiniLogo(opt.homeLogoUrl, opt.homeAbbr)
                            Text("${opt.awayAbbr} @ ${opt.homeAbbr}", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            PillChevron()
                        }
                    } else {
                        PillLabel(AppIcon.SQUARE_GRID_2X2_FILL.imageVector, "All games", onClick = onOpenMlbMatchup)
                    }
                    PillLabel(AppIcon.fromSystemName("slider.horizontal.3")?.imageVector ?: AppIcon.CHART_BAR.imageVector, MLBPropFeedFilters.marketLabel(mlbFilters.market), onClick = onOpenMlbMarket)
                }
                PropsStore.Sport.NFL -> {
                    val opt = nflFilters.gameId?.let { gid -> nflOptions.firstOrNull { it.gameId == gid } }
                    if (opt != null) {
                        PillContainer(onClick = onOpenNflMatchup) {
                            MiniLogo(NFLTeamAssets.logo(opt.awayTeam), opt.awayAbbr)
                            MiniLogo(NFLTeamAssets.logo(opt.homeTeam), opt.homeAbbr)
                            Text("${opt.awayAbbr} @ ${opt.homeAbbr}", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            PillChevron()
                        }
                    } else {
                        PillLabel(AppIcon.SQUARE_GRID_2X2_FILL.imageVector, "All games", onClick = onOpenNflMatchup)
                    }
                    val marketIcon = if (nflFilters.signalsOnly) AppIcon.BOLT_FILL.imageVector else (AppIcon.fromSystemName("slider.horizontal.3")?.imageVector ?: AppIcon.CHART_BAR.imageVector)
                    PillLabel(marketIcon, NFLPropFeedFilters.filterLabel(nflFilters), onClick = onOpenNflMarket)
                }
                else -> Unit
            }
            if (PropSortMode.modes(sport).size > 1) {
                SortPill(sport, sortMode, onSortMode)
            }
        }
    }
}

@Composable
private fun SortPill(sport: PropsStore.Sport, sortMode: PropSortMode, onSelect: (PropSortMode) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        PillLabel(sortMode.icon, sortMode.label) { expanded = true }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            PropSortMode.modes(sport).forEach { mode ->
                DropdownMenuItem(
                    text = { Text(mode.label) },
                    leadingIcon = { Icon(mode.icon, null, modifier = Modifier.size(18.dp)) },
                    onClick = { onSelect(mode); expanded = false },
                )
            }
        }
    }
}

@Composable
private fun PillLabel(icon: ImageVector, text: String, dimmed: Boolean = false, onClick: () -> Unit) {
    PillContainer(onClick = onClick, alpha = if (dimmed) 0.5f else 1f) {
        Icon(icon, null, tint = Color.White, modifier = Modifier.size(14.dp))
        Text(text, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        PillChevron()
    }
}

@Composable
private fun PillContainer(onClick: () -> Unit, alpha: Float = 1f, content: @Composable () -> Unit) {
    Row(
        // Same capsule material as the QuickFilterField pinned directly above —
        // a heavier `appBorder` stroke here made the pill row read as a second,
        // darker material stacked under the search field.
        Modifier
            .alpha(alpha)
            .height(36.dp)
            .liquidGlassCapsule(null)
            .clickable { onClick() }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) { content() }
}

@Composable
private fun PillChevron() {
    Icon(AppIcon.CHEVRON_DOWN.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(9.dp))
}

@Composable
private fun MiniLogo(url: String?, abbr: String) {
    Box(Modifier.size(18.dp).clip(CircleShape), contentAlignment = Alignment.Center) {
        RemoteImage(
            url = url,
            contentDescription = abbr,
            modifier = Modifier.size(18.dp),
            contentScale = ContentScale.Fit,
            error = { InitialsDisc(abbr.take(2), 18.dp) },
        )
    }
}

private fun sportIcon(sport: PropsStore.Sport): ImageVector = when (sport) {
    PropsStore.Sport.MLB -> AppIcon.FIGURE_BASEBALL.imageVector
    PropsStore.Sport.NFL -> AppIcon.FOOTBALL_FILL.imageVector
    PropsStore.Sport.NBA -> AppIcon.BASKETBALL.imageVector
}

private fun sportOffSeason(sport: PropsStore.Sport): Boolean = !SportSeason.isInSeason(sport.gamesSport)

// MARK: - States

@Composable
private fun DateHeader(label: String) {
    Box(Modifier.fillMaxWidth().background(AppColors.appSurface)) {
        Text(
            label.uppercase(),
            color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 20.dp, end = 16.dp, top = 6.dp, bottom = 6.dp),
        )
    }
}

@Composable
private fun LoadingSkeleton() {
    Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(3) { PropCardShimmer() }
    }
}

@Composable
private fun ErrorState(message: String) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(AppIcon.EXCLAMATION_TRIANGLE.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(44.dp))
        Text("Failed to load props", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 24.dp))
    }
}

@Composable
private fun ComingSoonState(sport: PropsStore.Sport) {
    Column(
        Modifier.fillMaxWidth().heightIn(min = 320.dp).padding(top = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(AppIcon.HOURGLASS.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(48.dp))
        Text("${sport.label} player props coming soon", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(
            "MLB and NFL props are live — model-driven prop trends across more sports are on the way.",
            color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 40.dp),
        )
    }
}

@Composable
private fun EmptyTile(label: String) {
    Column(
        Modifier.fillMaxWidth().height(200.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) {
        Icon(AppIcon.MAGNIFYINGGLASS.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(44.dp))
        Text(label, color = AppColors.appTextSecondary, fontSize = 14.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
    }
}

@Composable
private fun SeasonEmptyTile(sport: PropsStore.Sport) {
    val copy = SportSeason.emptyCopy(sport.gamesSport, itemsNoun = "player props", dataNoun = "prop data")
    Column(
        Modifier.fillMaxWidth().heightIn(min = 220.dp).padding(horizontal = 32.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) {
        Icon(AppIcon.HOURGLASS.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(44.dp))
        Text(copy.title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(copy.message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
    }
}

// MARK: - Sheets

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PropSportPickerSheet(selection: PropsStore.Sport, onSelect: (PropsStore.Sport) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated, dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(bottom = 24.dp)) {
            Text("Select sport", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
            InsetGroupedSection {
                PropsStore.Sport.entries.forEachIndexed { index, sport ->
                    val offSeason = sport != PropsStore.Sport.NFL && !SportSeason.isInSeason(sport.gamesSport)
                    Row(
                        Modifier.fillMaxWidth().clickable { onSelect(sport); onDismiss() }.padding(vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(sportIcon(sport), null, tint = if (offSeason) AppColors.appTextMuted else AppColors.appPrimary, modifier = Modifier.size(20.dp))
                        Column(Modifier.weight(1f)) {
                            Text(sport.label, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                            if (offSeason) Text("Out of season", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }
                        if (selection == sport) Icon(AppIcon.CHECKMARK.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(18.dp))
                    }
                    if (index != PropsStore.Sport.entries.lastIndex) InsetGroupedDivider()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MLBMatchupPickerSheet(options: List<MLBPropGameFilterOption>, selection: Int?, onSelect: (Int?) -> Unit, onDismiss: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val games = options.filter { !it.isAllGames }
    val filtered = remember(query, games) {
        val t = query.trim()
        if (t.isEmpty()) games else games.filter { listOf(it.awayAbbr, it.homeAbbr, it.awayName, it.homeName).any { s -> s.contains(t, ignoreCase = true) } }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated, dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(bottom = 24.dp)) {
            Text("Select matchup", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
            SheetSearchField(query, { query = it }, "Search teams")
            Spacer(Modifier.height(12.dp))
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
                InsetGroupedSection {
                    PickerRow(selected = selection == null, onClick = { onSelect(null); onDismiss() }) {
                        Icon(AppIcon.SQUARE_GRID_2X2_FILL.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(20.dp))
                        Text("All games", color = AppColors.appTextPrimary, fontSize = 15.sp)
                    }
                    if (filtered.isNotEmpty()) InsetGroupedDivider()
                    filtered.forEachIndexed { index, opt ->
                        PickerRow(selected = selection == opt.gamePk, onClick = { onSelect(opt.gamePk); onDismiss() }) {
                            MiniLogo(opt.awayLogoUrl, opt.awayAbbr)
                            MiniLogo(opt.homeLogoUrl, opt.homeAbbr)
                            Column(Modifier.weight(1f)) {
                                Text(opt.awayName, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("@ ${opt.homeName}", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        if (index != filtered.lastIndex) InsetGroupedDivider()
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NFLMatchupPickerSheet(options: List<NFLPropGameFilterOption>, selection: String?, onSelect: (String?) -> Unit, onDismiss: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val games = options.filter { !it.isAllGames }
    val filtered = remember(query, games) {
        val t = query.trim()
        if (t.isEmpty()) games else games.filter { listOf(it.awayAbbr, it.homeAbbr, it.awayTeam, it.homeTeam).any { s -> s.contains(t, ignoreCase = true) } }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated, dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(bottom = 24.dp)) {
            Text("Select matchup", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
            SheetSearchField(query, { query = it }, "Search teams")
            Spacer(Modifier.height(12.dp))
            Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
                InsetGroupedSection {
                    PickerRow(selected = selection == null, onClick = { onSelect(null); onDismiss() }) {
                        Icon(AppIcon.SQUARE_GRID_2X2_FILL.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(20.dp))
                        Text("All games", color = AppColors.appTextPrimary, fontSize = 15.sp)
                    }
                    if (filtered.isNotEmpty()) InsetGroupedDivider()
                    filtered.forEachIndexed { index, opt ->
                        PickerRow(selected = selection == opt.gameId, onClick = { onSelect(opt.gameId); onDismiss() }) {
                            MiniLogo(NFLTeamAssets.logo(opt.awayTeam), opt.awayAbbr)
                            MiniLogo(NFLTeamAssets.logo(opt.homeTeam), opt.homeAbbr)
                            Column(Modifier.weight(1f)) {
                                Text(opt.awayTeam, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("@ ${opt.homeTeam}", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        if (index != filtered.lastIndex) InsetGroupedDivider()
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MLBMarketFilterSheet(selected: String?, onSelect: (String?) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated, dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(bottom = 24.dp).heightIn(max = 560.dp).verticalScroll(rememberScrollState())) {
            Text("Prop Market", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
            InsetGroupedSection {
                MarketRow("All Markets", selected == null) { onSelect(null); onDismiss() }
            }
            InsetGroupedSection(title = "Pitching") {
                MLBPropFeedFilters.sheetPitcherMarkets.forEachIndexed { index, key ->
                    MarketRow(MLBPlayerProps.marketLabel(key), selected == key) { onSelect(key); onDismiss() }
                    if (index != MLBPropFeedFilters.sheetPitcherMarkets.lastIndex) InsetGroupedDivider()
                }
            }
            InsetGroupedSection(title = "Hitting") {
                MLBPropFeedFilters.sheetBatterMarkets.forEachIndexed { index, key ->
                    MarketRow(MLBPlayerProps.marketLabel(key), selected == key) { onSelect(key); onDismiss() }
                    if (index != MLBPropFeedFilters.sheetBatterMarkets.lastIndex) InsetGroupedDivider()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NFLMarketFilterSheet(
    filters: NFLPropFeedFilters,
    players: List<com.wagerproof.core.models.NFLPropPlayer>,
    onSelectMarket: (String?) -> Unit,
    onSelectSignals: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetMarkets = NFLPropFeedFilters.sheetMarkets(players)
    val signalCount = NFLPropFeedFilters.flaggedPlayerCount(players, filters.gameId)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = AppColors.appSurfaceElevated, dragHandle = { BottomSheetDefaults.DragHandle() }) {
        Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.lg).padding(bottom = 24.dp).heightIn(max = 560.dp).verticalScroll(rememberScrollState())) {
            Text("Prop Market", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 8.dp))
            InsetGroupedSection {
                MarketRow("All Markets", !filters.signalsOnly && filters.market == null) { onSelectMarket(null); onDismiss() }
                InsetGroupedDivider()
                Row(
                    Modifier.fillMaxWidth().clickable { onSelectSignals(); onDismiss() }.padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(AppIcon.BOLT_FILL.imageVector, null, tint = Color(0xFFF97316), modifier = Modifier.size(16.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Prop Signals", color = AppColors.appTextPrimary, fontSize = 15.sp)
                        if (signalCount > 0) Text("$signalCount player${if (signalCount == 1) "" else "s"} with a signal", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }
                    if (filters.signalsOnly) Icon(AppIcon.CHECKMARK.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(18.dp))
                }
            }
            if (sheetMarkets.passing.isNotEmpty()) {
                MarketGroup("Passing", sheetMarkets.passing, filters, onSelectMarket, onDismiss)
            }
            if (sheetMarkets.rushing.isNotEmpty()) {
                MarketGroup("Rushing", sheetMarkets.rushing, filters, onSelectMarket, onDismiss)
            }
            if (sheetMarkets.receiving.isNotEmpty()) {
                MarketGroup("Receiving", sheetMarkets.receiving, filters, onSelectMarket, onDismiss)
            }
            if (sheetMarkets.other.isNotEmpty()) {
                MarketGroup("Other", sheetMarkets.other, filters, onSelectMarket, onDismiss)
            }
        }
    }
}

@Composable
private fun MarketGroup(
    title: String,
    keys: List<String>,
    filters: NFLPropFeedFilters,
    onSelectMarket: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    InsetGroupedSection(title = title) {
        keys.forEachIndexed { index, key ->
            MarketRow(NFLPlayerProps.marketLabel(key), !filters.signalsOnly && filters.market == key) {
                onSelectMarket(key)
                onDismiss()
            }
            if (index != keys.lastIndex) InsetGroupedDivider()
        }
    }
}

@Composable
private fun SheetSectionLabel(text: String) {
    Text(text.uppercase(), color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
}

@Composable
private fun MarketRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { onClick() }.padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = AppColors.appTextPrimary, fontSize = 15.sp)
        Spacer(Modifier.weight(1f))
        if (selected) Icon(AppIcon.CHECKMARK.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun PickerRow(selected: Boolean, onClick: () -> Unit, content: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { onClick() }.padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        content()
        Spacer(Modifier.weight(1f))
        if (selected) Icon(AppIcon.CHECKMARK.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(18.dp))
    }
}
