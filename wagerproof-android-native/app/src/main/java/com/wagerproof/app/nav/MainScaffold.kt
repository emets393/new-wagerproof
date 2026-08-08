package com.wagerproof.app.nav

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.wagerproof.app.AppGraph
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.AgentCopyBuildPresentation
import com.wagerproof.app.features.agents.AgentCreateScreen
import com.wagerproof.app.features.agents.AgentDetailScreen
import com.wagerproof.app.features.agents.AgentSettingsScreen
import com.wagerproof.app.features.agents.AgentsScreen
import com.wagerproof.app.features.chat.WagerBotChatScreen
import com.wagerproof.app.features.featurerequests.FeatureRequestsScreen
import com.wagerproof.app.features.games.GameDetailScreen
import com.wagerproof.app.features.games.GamesScreen
import com.wagerproof.app.features.learn.LearnWagerProofSheet
import com.wagerproof.app.features.navigation.OfflineBanner
import com.wagerproof.app.features.outliers.OutliersScreen
import com.wagerproof.app.features.props.PropsScreen
import com.wagerproof.app.features.roast.RoastScreen
import com.wagerproof.app.features.scoreboard.ScoreboardScreen
import com.wagerproof.app.features.search.SearchScreen
import com.wagerproof.app.features.settings.SettingsScreen
import com.wagerproof.app.features.sidemenu.SideMenuSheet
import com.wagerproof.core.design.components.AppModalBottomSheet
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppLayout
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.PropsStore
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.yield

/**
 * Signed-in tab shell — the Android port of iOS `MainTabView` (doc 08 §3.1).
 *
 * Structure:
 * - bottom [NavigationBar]: Games / Props / Agents / Outliers / Search (iOS bar
 *   order + icons, brand-green tint). Scoreboard + Settings are NOT bar tabs.
 * - the active tab's per-tab back stack ([TabBackStacks]) rendered through an
 *   [AnimatedContent] with push/pop slide animations.
 * - [BackHandler] pops the active tab's stack; at a tab root it falls back to the
 *   Games tab, then lets the system exit.
 * - shell-level modal hosts driven by `MainTabStore` booleans: Settings + Chat as
 *   full-screen overlays (iOS pushes them per-tab; a single overlay is the clean
 *   Android equivalent — doc 08 §3.2 note), Side Menu / Feature Requests / Learn
 *   as bottom sheets, Roast as a full-screen cover.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalAnimationApi::class)
@Composable
fun MainScaffold(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val tabStore = graph.mainTab
    val learnStore = graph.learn
    val backStacks = rememberTabBackStacks()
    val navigator = remember(backStacks, tabStore) { AppNavigator(backStacks, tabStore) }

    val selectedTab = tabStore.selected
    // Settings is presented as an overlay, not a bar tab — keep the visible bar
    // selection on a real tab even while the flag routes elsewhere.
    val visibleTab = if (selectedTab in TabBackStacks.BAR_TABS) selectedTab else MainTabStore.Tab.Games
    val activeRoute = backStacks.top(visibleTab)
    var propsHasInternalDestination by remember { mutableStateOf(false) }
    var searchHasInternalDestination by remember { mutableStateOf(false) }
    val hasInternalDestination = when (visibleTab) {
        MainTabStore.Tab.Props -> propsHasInternalDestination
        MainTabStore.Tab.Search -> searchHasInternalDestination
        else -> false
    }
    val isFullScreenRoute = hasInternalDestination ||
        // Copy-build isn't a route — the Agents hub keeps it as an in-tab
        // overlay so the copied draft never has to survive serialization — but
        // it IS full-screen, and iOS hides the tab bar under it.
        AgentCopyBuildPresentation.isPresented ||
        activeRoute is AppRoute.GameDetail ||
        activeRoute is AppRoute.AgentDetail ||
        activeRoute is AppRoute.AgentEdit ||
        activeRoute == AppRoute.AgentCreate ||
        activeRoute == AppRoute.Settings ||
        activeRoute == AppRoute.WagerBotChat

    // Match MainTabView's shell work: hydrate the game slate ONCE, before any
    // tab needs to resolve a cross-surface result. Unforced — GamesStore's
    // 5-minute TTL plus its per-sport in-flight coalescing then make every
    // other caller (Games tab, Search) a no-op instead of a second full run of
    // all five multi-query pipelines.
    LaunchedEffect(Unit) {
        syncDryRunPreview(graph)
        graph.games.refreshAll()
    }

    // force=true belongs to an ACTUAL admin transition — the Secret Settings
    // toggle, or the has_role RPC resolving — because dry-run flips which
    // tables the slate reads. drop(1) skips the value that is already live at
    // subscribe time so first composition doesn't redo the hydrate above.
    LaunchedEffect(Unit) {
        snapshotFlow { graph.adminMode.adminModeEnabled to graph.adminMode.isAdmin }
            .drop(1)
            .collect { (_, isAdmin) ->
                syncDryRunPreview(graph)
                graph.games.refreshAll(force = true)
                if (isAdmin) graph.props.refreshNFL(force = true)
            }
    }

    // Agents data is cheap next to the pixel-office UI, so prefetch it at the
    // shell (iOS MainTabView:258-265). The first Agents tap then only mounts
    // presentation work, and Search reuses the same owned-agent results.
    val currentUserId = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId?.lowercase()
    LaunchedEffect(currentUserId) {
        graph.agents.bind(currentUserId)
        if (currentUserId == null || !graph.agents.loadState.needsInitialLoad) return@LaunchedEffect
        // Let the first Games frame commit before starting the request.
        yield()
        graph.agents.refresh()
    }

    // Games and Props mirror their sport selector when the user changes a
    // PICKER, never on tab selection: a tab-keyed effect fires on first
    // composition too, which stamped Props' hardcoded MLB over the Games
    // seasonal default (NFL from Sep 1 to Feb 15) on every cold start.
    // Port of MainTabView.swift:234-249 — drop(1) gives SwiftUI onChange
    // semantics (no emission for the value already in place).
    LaunchedEffect(Unit) {
        snapshotFlow { graph.games.selectedSport }
            .drop(1)
            .collect { sport ->
                if (tabStore.selected != MainTabStore.Tab.Games) return@collect
                val matching = PropsStore.Sport.matching(sport)
                if (graph.props.selectedSport != matching) graph.props.selectedSport = matching
            }
    }
    LaunchedEffect(Unit) {
        snapshotFlow { graph.props.selectedSport }
            .drop(1)
            .collect { sport ->
                if (tabStore.selected != MainTabStore.Tab.Props) return@collect
                val matching = sport.gamesSport
                if (graph.games.selectedSport != matching) graph.games.selectedSport = matching
            }
    }

    // Search → Agents handoff: push the pending agent route, then clear it.
    LaunchedEffect(tabStore.pendingAgentRoute) {
        tabStore.pendingAgentRoute?.let { route ->
            tabStore.selected = MainTabStore.Tab.Agents
            backStacks.push(
                MainTabStore.Tab.Agents,
                AppRoute.AgentDetail(route.agentId, route.isPublic),
            )
            tabStore.pendingAgentRoute = null
        }
    }

    // Legacy store signals are still emitted by shared toolbars and sheets.
    // Convert them immediately into typed pushes on the originating tab.
    LaunchedEffect(tabStore.isSettingsPresented) {
        if (tabStore.isSettingsPresented) {
            backStacks.push(visibleTab, AppRoute.Settings)
            tabStore.isSettingsPresented = false
        }
    }
    LaunchedEffect(tabStore.isChatPresented) {
        if (tabStore.isChatPresented) {
            backStacks.push(visibleTab, AppRoute.WagerBotChat)
            tabStore.isChatPresented = false
        }
    }

    // Every surface opens a game through the same sheet-store contract. Games
    // cards also push directly; TabBackStacks de-duplicates that identical top.
    // Search/Outliers only set selectedGame + switch tabs, so these observers
    // supply the missing cross-tab push.
    LaunchedEffect(graph.nflGameSheet.selectedGame?.id) {
        graph.nflGameSheet.selectedGame?.let {
            tabStore.selected = MainTabStore.Tab.Games
            backStacks.push(MainTabStore.Tab.Games, AppRoute.GameDetail("nfl", it.id))
        }
    }
    LaunchedEffect(graph.cfbGameSheet.selectedGame?.gameId) {
        graph.cfbGameSheet.selectedGame?.let {
            tabStore.selected = MainTabStore.Tab.Games
            backStacks.push(MainTabStore.Tab.Games, AppRoute.GameDetail("cfb", it.gameId))
        }
    }
    LaunchedEffect(graph.nbaGameSheet.selectedGame?.id) {
        graph.nbaGameSheet.selectedGame?.let {
            tabStore.selected = MainTabStore.Tab.Games
            backStacks.push(MainTabStore.Tab.Games, AppRoute.GameDetail("nba", it.id))
        }
    }
    LaunchedEffect(graph.ncaabGameSheet.selectedGame?.id) {
        graph.ncaabGameSheet.selectedGame?.let {
            tabStore.selected = MainTabStore.Tab.Games
            backStacks.push(MainTabStore.Tab.Games, AppRoute.GameDetail("ncaab", it.id))
        }
    }
    LaunchedEffect(graph.mlbGameSheet.selectedGame?.id) {
        graph.mlbGameSheet.selectedGame?.let {
            tabStore.selected = MainTabStore.Tab.Games
            backStacks.push(MainTabStore.Tab.Games, AppRoute.GameDetail("mlb", it.id))
        }
    }

    // Re-tapping the active tab (scrollToTopTrigger bump) pops that tab to root.
    LaunchedEffect(tabStore.scrollToTopTrigger) {
        backStacks.popToRoot(visibleTab)
    }

    CompositionLocalProvider(LocalAppNavigator provides navigator) {
        // No app-wide LiquidGlassScene: hazeEffect pills can't sample a source
        // they're nested inside (the whole Scaffold was the source, so every
        // pill under it rendered with NO fill at all). Screens that want real
        // blur declare their own scene with the source on a background layer;
        // everything else gets liquidGlassBackground's opaque-enough fallback.
        run {
            Scaffold(
                modifier = modifier.fillMaxSize(),
                containerColor = AppColors.appSurface,
                // Every screen owns its top/cutout inset. Scaffold only contributes
                // the measured bottom-bar height through its content padding.
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
                bottomBar = {
                    if (!isFullScreenRoute) WagerBottomBar(tabStore)
                },
            ) { insets ->
                // consumeWindowInsets is what makes a nested imePadding() land on
                // the keyboard instead of a bar-height above it. Without it the
                // Search screen's imePadding() re-applies the FULL ime inset to a
                // node already lifted by the bottom bar, so results collapse into a
                // strip with ~98dp of dead space between them and the keyboard.
                Box(Modifier.fillMaxSize().padding(insets).consumeWindowInsets(insets)) {
                    TabNavHost(
                        tab = visibleTab,
                        backStacks = backStacks,
                        isFullScreen = isFullScreenRoute,
                        onPropsFullScreenChanged = { propsHasInternalDestination = it },
                        onSearchFullScreenChanged = { searchHasInternalDestination = it },
                        modifier = Modifier.fillMaxSize(),
                    )
                    if (!isFullScreenRoute) {
                        OfflineBanner(
                            Modifier
                                .align(Alignment.TopCenter)
                                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)),
                        )
                    }
                }
            }
        }
    }

    // System back: pop the active tab, else drop to Games, else exit (enabled=false).
    val atTabRoot = !backStacks.canPop(visibleTab)
    BackHandler(enabled = !atTabRoot || visibleTab != MainTabStore.Tab.Games) {
        if (backStacks.canPop(visibleTab)) {
            backStacks.pop(visibleTab)
        } else {
            tabStore.select(MainTabStore.Tab.Games)
        }
    }

    // --- Shell-level modal hosts (single source of truth) --------------------

    if (tabStore.isRoastPresented) {
        FullScreenOverlay(onDismiss = { tabStore.isRoastPresented = false }) {
            RoastScreen()
        }
    }

    if (tabStore.isSideMenuPresented) {
        ShellBottomSheet(onDismiss = { tabStore.isSideMenuPresented = false }) { SideMenuSheet() }
    }
    if (tabStore.isFeatureRequestsPresented) {
        ShellBottomSheet(onDismiss = { tabStore.isFeatureRequestsPresented = false }) {
            FeatureRequestsScreen()
        }
    }
    if (learnStore.activeTopic != null) {
        ShellBottomSheet(onDismiss = { learnStore.closeSheet() }) { LearnWagerProofSheet() }
    }
}

/** Keep dry-run table routing in sync with Secret Settings admin mode. */
private fun syncDryRunPreview(graph: AppGraph) {
    val enabled = graph.adminMode.dryRunPreviewEnabled
    graph.games.dryRunPreviewEnabled = enabled
    graph.props.dryRunPreviewEnabled = enabled
}

/** Renders one tab's back stack, animating push (forward slide) vs pop (back slide). */
@OptIn(ExperimentalAnimationApi::class)
@Composable
private fun TabNavHost(
    tab: MainTabStore.Tab,
    backStacks: TabBackStacks,
    isFullScreen: Boolean,
    onPropsFullScreenChanged: (Boolean) -> Unit,
    onSearchFullScreenChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    // iOS's TabView retains every tab it has mounted. Compose composes only the
    // visible one, so without this holder a tab switch threw away scroll
    // offsets, pager pages and every other rememberSaveable in the destination
    // — the user came back to a feed scrolled to the top. The holder lives
    // above AnimatedContent so it outlives the content it is saving for.
    val stateHolder = rememberSaveableStateHolder()
    val stack = backStacks.stackFor(tab)
    val depth = stack.size
    val top = stack.last()
    var previousDepth by remember(tab) { mutableIntStateOf(depth) }
    val isPush = remember(tab, top, depth) { depth > previousDepth }
    SideEffect { previousDepth = depth }

    AnimatedContent(
        targetState = top,
        transitionSpec = {
            // Capture direction from the depth change. Looking routes up in the
            // already-mutated stack misclassified every pop as a forward push.
            val dir = if (isPush) 1 else -1
            (slideInHorizontally(tween(260)) { w -> dir * w } + fadeIn(tween(260))) togetherWith
                (slideOutHorizontally(tween(260)) { w -> -dir * w } + fadeOut(tween(260)))
        },
        modifier = modifier,
        label = "tab-nav-$tab",
    ) { route ->
        // Only the six tab roots get a saved slot: their keys are a closed set,
        // so nothing accumulates. Detail routes carry an id and would leak an
        // entry per visited game/agent with no pop hook to release it.
        val savedKey = route.tabRootStateKey
        if (savedKey != null) {
            stateHolder.SaveableStateProvider(savedKey) {
                RouteContent(
                    route = route,
                    isFullScreen = isFullScreen,
                    onPropsFullScreenChanged = onPropsFullScreenChanged,
                    onSearchFullScreenChanged = onSearchFullScreenChanged,
                )
            }
        } else {
            RouteContent(
                route = route,
                isFullScreen = isFullScreen,
                onPropsFullScreenChanged = onPropsFullScreenChanged,
                onSearchFullScreenChanged = onSearchFullScreenChanged,
            )
        }
    }
}

/**
 * Stable save slot for a tab root, or null for a pushed leaf. Strings only —
 * the holder's map is persisted through the parent SaveableStateRegistry.
 */
private val AppRoute.tabRootStateKey: String?
    get() = when (this) {
        AppRoute.GamesFeed -> "tab-root:games"
        AppRoute.PropsFeed -> "tab-root:props"
        AppRoute.AgentsList -> "tab-root:agents"
        AppRoute.OutliersFeed -> "tab-root:outliers"
        AppRoute.SearchHome -> "tab-root:search"
        AppRoute.Scoreboard -> "tab-root:scoreboard"
        else -> null
    }

/** AppRoute → screen composable dispatch. Later agents wire real nav callbacks. */
@Composable
private fun RouteContent(
    route: AppRoute,
    isFullScreen: Boolean,
    onPropsFullScreenChanged: (Boolean) -> Unit,
    onSearchFullScreenChanged: (Boolean) -> Unit,
) {
    val navigator = LocalAppNavigator.current
    when (route) {
        AppRoute.GamesFeed -> TabRootContent { GamesScreen() }
        AppRoute.PropsFeed -> TabRootContent(isFullScreen) {
            PropsScreen(onFullScreenChanged = onPropsFullScreenChanged)
        }
        AppRoute.AgentsList -> TabRootContent { AgentsScreen() }
        AppRoute.OutliersFeed -> TabRootContent { OutliersScreen() }
        AppRoute.SearchHome -> TabRootContent(isFullScreen) {
            SearchScreen(onFullScreenChanged = onSearchFullScreenChanged)
        }
        AppRoute.Scoreboard -> TabRootContent { ScoreboardScreen() }
        AppRoute.AgentCreate -> AgentCreateScreen()
        is AppRoute.GameDetail -> GameDetailScreen(route.sport, route.gameId)
        is AppRoute.AgentDetail -> AgentDetailScreen(route.agentId, route.isPublic)
        is AppRoute.AgentEdit -> AgentSettingsScreen(route.agentId)
        AppRoute.Settings -> SettingsScreen(onDismiss = navigator::popCurrent)
        AppRoute.WagerBotChat -> WagerBotChatScreen(
            onDismiss = navigator::popCurrent,
            onOpenSettings = navigator::openSettings,
        )
    }
}

@Composable
private fun TabRootContent(
    fullScreen: Boolean = false,
    content: @Composable () -> Unit,
) {
    val sides = if (fullScreen) {
        WindowInsetsSides.Top + WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal
    } else {
        WindowInsetsSides.Top + WindowInsetsSides.Horizontal
    }
    Box(
        Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing.only(sides)),
    ) {
        content()
    }
}

/** The five bar tabs (order + icons per doc 08 §3.1). */
private data class BarTab(val tab: MainTabStore.Tab, val label: String, val icon: AppIcon)

private val BAR_ITEMS = listOf(
    BarTab(MainTabStore.Tab.Games, "Games", AppIcon.TROPHY_FILL),
    BarTab(MainTabStore.Tab.Props, "Props", AppIcon.FIGURE_BASKETBALL),
    BarTab(MainTabStore.Tab.Agents, "Agents", AppIcon.BRAIN_HEAD_PROFILE),
    BarTab(MainTabStore.Tab.Outliers, "Outliers", AppIcon.BELL_BADGE_FILL),
    BarTab(MainTabStore.Tab.Search, "Search", AppIcon.MAGNIFYINGGLASS),
)

@Composable
private fun WagerBottomBar(tabStore: MainTabStore) {
    // SwiftUI's TabView uses a compact translucent bar with a tint-only
    // selection. Material3's stock navigation bar is substantially taller and
    // adds an opaque selection pill, so the shared shell renders the iOS
    // geometry directly instead.
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.appSurface.copy(alpha = 0.96f))
            .drawBehind {
                drawLine(
                    color = AppColors.appBorder,
                    start = androidx.compose.ui.geometry.Offset.Zero,
                    end = androidx.compose.ui.geometry.Offset(size.width, 0f),
                    strokeWidth = 0.5.dp.toPx(),
                )
            }
            .windowInsetsPadding(WindowInsets.navigationBars)
            .height(AppLayout.bottomBarContentHeight)
            .selectableGroup(),
    ) {
        BAR_ITEMS.forEach { item ->
            val selected = tabStore.selected == item.tab
            val tint = if (selected) AppColors.brandGreenBright else AppColors.appTextSecondary
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .selectable(
                        selected = selected,
                        onClick = { tabStore.select(item.tab) },
                        role = Role.Tab,
                    ),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(
                    imageVector = item.icon.imageVector,
                    contentDescription = item.label,
                    tint = tint,
                    modifier = Modifier.size(22.dp),
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = item.label,
                    style = AppTypography.micro,
                    color = tint,
                    maxLines = 1,
                )
            }
        }
    }
}

/** Full-screen overlay for pushed hosts (Settings/Chat/Roast). Back = dismiss. */
@Composable
private fun FullScreenOverlay(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    BackHandler(enabled = true, onBack = onDismiss)
    Box(Modifier.fillMaxSize()) { content() }
}

/** Shared modal wrapper for shell-owned sheets. */
@Composable
private fun ShellBottomSheet(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    AppModalBottomSheet(
        onDismissRequest = onDismiss,
    ) {
        content()
    }
}
