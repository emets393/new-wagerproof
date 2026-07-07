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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.AgentCreateScreen
import com.wagerproof.app.features.agents.AgentDetailScreen
import com.wagerproof.app.features.agents.AgentSettingsScreen
import com.wagerproof.app.features.agents.AgentsScreen
import com.wagerproof.app.features.chat.WagerBotChatScreen
import com.wagerproof.app.features.featurerequests.FeatureRequestsScreen
import com.wagerproof.app.features.games.GameDetailScreen
import com.wagerproof.app.features.games.GamesScreen
import com.wagerproof.app.features.learn.LearnWagerProofSheet
import com.wagerproof.app.features.outliers.OutliersScreen
import com.wagerproof.app.features.props.PropsScreen
import com.wagerproof.app.features.roast.RoastScreen
import com.wagerproof.app.features.scoreboard.ScoreboardScreen
import com.wagerproof.app.features.search.SearchScreen
import com.wagerproof.app.features.settings.SettingsScreen
import com.wagerproof.app.features.sidemenu.SideMenuSheet
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.MainTabStore

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

    // Re-tapping the active tab (scrollToTopTrigger bump) pops that tab to root.
    LaunchedEffect(tabStore.scrollToTopTrigger) {
        backStacks.popToRoot(visibleTab)
    }

    CompositionLocalProvider(LocalAppNavigator provides navigator) {
        Scaffold(
            modifier = modifier.fillMaxSize(),
            containerColor = AppColors.appSurface,
            bottomBar = { WagerBottomBar(tabStore) },
        ) { insets ->
            TabNavHost(
                tab = visibleTab,
                backStacks = backStacks,
                modifier = Modifier.fillMaxSize().padding(insets),
            )
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

    if (tabStore.isSettingsPresented) {
        FullScreenOverlay(onDismiss = { tabStore.isSettingsPresented = false }) {
            SettingsScreen()
        }
    }
    if (tabStore.isChatPresented) {
        FullScreenOverlay(onDismiss = { tabStore.isChatPresented = false }) {
            WagerBotChatScreen()
        }
    }
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

/** Renders one tab's back stack, animating push (forward slide) vs pop (back slide). */
@OptIn(ExperimentalAnimationApi::class)
@Composable
private fun TabNavHost(
    tab: MainTabStore.Tab,
    backStacks: TabBackStacks,
    modifier: Modifier = Modifier,
) {
    val stack = backStacks.stackFor(tab)
    val depth = stack.size
    val top = stack.last()

    AnimatedContent(
        targetState = top,
        transitionSpec = {
            // A deeper stack = push (enter from right); shallower = pop (enter from left).
            val forward = depth >= 1 && targetState != initialState &&
                stack.indexOf(targetState) >= stack.indexOf(initialState)
            val dir = if (forward) 1 else -1
            (slideInHorizontally(tween(260)) { w -> dir * w } + fadeIn(tween(260))) togetherWith
                (slideOutHorizontally(tween(260)) { w -> -dir * w } + fadeOut(tween(260)))
        },
        modifier = modifier,
        label = "tab-nav-$tab",
    ) { route ->
        RouteContent(route)
    }
}

/** AppRoute → screen composable dispatch. Later agents wire real nav callbacks. */
@Composable
private fun RouteContent(route: AppRoute) {
    when (route) {
        AppRoute.GamesFeed -> GamesScreen()
        AppRoute.PropsFeed -> PropsScreen()
        AppRoute.AgentsList -> AgentsScreen()
        AppRoute.OutliersFeed -> OutliersScreen()
        AppRoute.SearchHome -> SearchScreen()
        AppRoute.Scoreboard -> ScoreboardScreen()
        AppRoute.AgentCreate -> AgentCreateScreen()
        is AppRoute.GameDetail -> GameDetailScreen(route.sport, route.gameId)
        is AppRoute.AgentDetail -> AgentDetailScreen(route.agentId, route.isPublic)
        is AppRoute.AgentEdit -> AgentSettingsScreen(route.agentId)
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
    NavigationBar(containerColor = AppColors.appSurfaceElevated) {
        BAR_ITEMS.forEach { item ->
            val selected = tabStore.selected == item.tab
            NavigationBarItem(
                selected = selected,
                onClick = { tabStore.select(item.tab) },
                icon = { Icon(item.icon.imageVector, contentDescription = item.label) },
                label = { Text(item.label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = AppColors.appTextInverse,
                    selectedTextColor = AppColors.brandGreenBright,
                    indicatorColor = AppColors.brandGreenBright,
                    unselectedIconColor = AppColors.appTextSecondary,
                    unselectedTextColor = AppColors.appTextSecondary,
                ),
            )
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

/** Shared ModalBottomSheet wrapper for shell sheets. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShellBottomSheet(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurfaceElevated,
    ) {
        content()
    }
}
