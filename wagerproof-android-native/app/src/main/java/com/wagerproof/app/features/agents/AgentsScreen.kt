package com.wagerproof.app.features.agents

import android.app.Activity
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.rounded.Badge
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.BuildConfig
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.components.AgencyStatsPill
import com.wagerproof.app.features.agents.components.AgentLeaderboard
import com.wagerproof.app.features.agents.components.AgentRowCard
import com.wagerproof.app.features.agents.components.AgentsOfficeHero
import com.wagerproof.app.features.agents.components.RowSwipeAction
import com.wagerproof.app.features.agents.components.TopAgentPicksFeed
import com.wagerproof.app.features.agents.creation.AgentBuilderScreen
import com.wagerproof.app.features.agents.creation.AgentCreationPreflight
import com.wagerproof.app.features.agents.creation.runAgentCreationPreflight
import com.wagerproof.app.features.components.GlassSegmentedPicker
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.app.features.navigation.WagerProofTopBar
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.pixeloffice.pixelOfficeIsNight
import com.wagerproof.core.design.pixeloffice.rememberPixelOfficeTimeMode
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.stores.AgentCreationStore
import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.AgentPicksSeenStore
import com.wagerproof.core.stores.AgentsStore
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.FavoriteAgentsStore
import com.wagerproof.core.stores.FollowedAgentsStore
import com.wagerproof.core.stores.LeaderboardStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.StorePrefs
import com.wagerproof.core.stores.TopAgentPicksFeedStore
import com.wagerproof.core.services.AgentChatService
import com.wagerproof.core.services.AgentPerformanceService
import com.wagerproof.core.services.runCatchingCancellable
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Sort orders for the My Agents list, surfaced by the filter pill above it. */
private enum class AgentSortOption(val label: String, val icon: String) {
    WinRate("Win %", "percent"),
    Units("Units", "dollarsign.circle"),
    Streak("Streak", "flame"),
    Name("Name", "textformat"),
    Newest("Newest", "clock"),
}

private const val PINNED_IDS_KEY = "agents-pinned-ids"

/** Left of the row when a full trailing swipe should fire the destructive action. */
private const val FULL_SWIPE_FRACTION = 0.5f

/**
 * True while the hub's copy-build builder is up. `MainScaffold` reads it to hide
 * `WagerBottomBar`, the same way iOS presents that builder in a `fullScreenCover`
 * with `.toolbar(.hidden, for: .tabBar)` (AgentsView.swift:307-321).
 *
 * A shared flag rather than an `AppRoute`: the builder is seeded with a copied
 * `AgentCreationStore.Draft` that a route would have to serialize, and the
 * overlay has to stay inside this screen to keep that draft hand-off intact.
 */
internal object AgentCopyBuildPresentation {
    var isPresented by mutableStateOf(false)
        private set

    // Not a property setter: `isPresented`'s generated JVM setter is already `setPresented`.
    fun update(value: Boolean) {
        isPresented = value
    }
}

/**
 * Agents tab landing screen. Ports iOS `AgentsView`: an inner tab picker (My
 * Agents / Leaderboard / Top Picks) with a contextual filter menu, the pixel
 * "Agent HQ" office hero, a swipe-action agent list, and empty/loading/error
 * states. The Search-tab deep link (`pendingAgentRoute`) is consumed centrally
 * by MainScaffold, so this screen doesn't re-consume it.
 *
 * FIDELITY-WAIVER #231: Compose has no native large-title collapse — the
 * "Agents" title is a static header above the sticky tab picker rather than a
 * scroll-collapsing large title.
 */
@Composable
fun AgentsScreen(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val auth = graph.auth
    val proAccess = graph.proAccess
    val nav = LocalAppNavigator.current
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    // Tab visibility, the way iOS reads `tabStore.selected == .agents`
    // (AgentsView.swift:545, 588). Composition presence is nearly the same
    // signal here — MainScaffold's AnimatedContent only composes the visible
    // tab's top route — but it keeps the OUTGOING screen composed through the
    // 260ms switch animation, which is exactly when the office sim and every
    // row's glyph field should already be stopping.
    val animationsActive = graph.mainTab.selected == MainTabStore.Tab.Agents

    val currentUserId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId?.lowercase()
    // Per-render facade — reads live ProAccessStore state (matches iOS).
    val entitlements = AgentEntitlementsStore(proAccess)

    // Shell-scoped (iOS hoisted AgentsStore to MainTabView in 7166b538). A
    // `remember` here died with the composable on every tab switch, so the
    // agents list, its inner-tab selection and the leaderboard all reset and
    // refetched — and each dead instance leaked its SupervisorJob.
    val store = graph.agents
    val leaderboardStore = graph.agentsLeaderboard
    val topPicksStore = graph.topAgentPicks
    val topPicksFavorites = graph.favoriteAgents
    // Same instance PublicAgentDetailScreen's Follow toggle writes to, so a
    // follow/unfollow there is reflected in this rail without a manual refresh.
    val followedAgents = graph.followedAgents

    var sortOption by remember { mutableStateOf(AgentSortOption.WinRate) }
    var pendingDeleteId by remember { mutableStateOf<String?>(null) }
    var pendingLongPress by remember { mutableStateOf<AgentWithPerformance?>(null) }
    var activeCapAlert by remember { mutableStateOf(false) }
    var unreadRefreshToken by remember { mutableIntStateOf(0) }
    var showFollowingSheet by remember { mutableStateOf(false) }
    var followingActionError by remember { mutableStateOf<String?>(null) }
    var copyBuildDraft by remember { mutableStateOf<AgentCreationStore.Draft?>(null) }
    var copyBuildPreflightBusy by remember { mutableStateOf(false) }

    var pinnedIdsRaw by remember {
        mutableStateOf(StorePrefs.standard.getString(PINNED_IDS_KEY, "") ?: "")
    }
    val pinnedIds = remember(pinnedIdsRaw) {
        pinnedIdsRaw.split(",").filter { it.isNotBlank() }.toSet()
    }
    fun togglePin(id: String) {
        val next = if (pinnedIds.contains(id)) pinnedIds - id else pinnedIds + id
        pinnedIdsRaw = next.sorted().joinToString(",")
        StorePrefs.standard.edit().putString(PINNED_IDS_KEY, pinnedIdsRaw).apply()
    }

    // Bind + first refresh; rebind whenever the signed-in user changes. The
    // guard matters now that the store outlives this screen: without it every
    // return to the tab refetched a list we already have. `bind` resets to Idle
    // on a user change, so a real account switch still refreshes — and
    // `needsInitialLoad` also retries a store the shell prefetch left Failed.
    LaunchedEffect(currentUserId) {
        store.bind(currentUserId)
        if (store.loadState.needsInitialLoad) store.refresh()
        topPicksStore.bind(currentUserId)
        followedAgents.bind(currentUserId)
        // Unconditional, unlike the agents list above: the rail has to pick up a
        // follow/unfollow made on a public detail page, and iOS refreshes it on
        // every appear for the same reason. The store coalesces concurrent calls.
        followedAgents.refresh()
        unreadRefreshToken += 1
    }
    // DEBUG-only forced inner tab so a screenshot harness can land straight on a
    // branch — Android equivalent of iOS's `-agentsTab` launch argument
    // (AgentsView.swift:167-182), read from the launching Intent.
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        if (!BuildConfig.DEBUG) return@LaunchedEffect
        val forced = (context as? Activity)?.intent?.getStringExtra("agentsTab")?.lowercase()
            ?: return@LaunchedEffect
        store.activeTab = when (forced) {
            "leaderboard" -> AgentsStore.InnerTab.Leaderboard
            "toppicks", "top-picks", "picks" -> AgentsStore.InnerTab.TopPicks
            else -> AgentsStore.InnerTab.MyAgents
        }
    }

    // Lazily refresh the Top Picks feed the first time that tab is opened.
    LaunchedEffect(store.activeTab) {
        if (store.activeTab == AgentsStore.InnerTab.TopPicks &&
            topPicksStore.loadState is LoadState.Idle
        ) {
            topPicksStore.refresh()
        }
    }

    val canCreate = entitlements.canCreateAnotherAgent(store.activeCount, store.totalCount)

    fun toggleActive(row: AgentWithPerformance) {
        val willActivate = !row.agent.isActive
        if (willActivate && store.activeCount >= AgentEntitlementsStore.MAX_CONCURRENT_ACTIVE_AGENTS) {
            activeCapAlert = true
            return
        }
        scope.launch { store.setActive(row.id, willActivate) }
    }

    fun unfollowAgent(agentId: String) {
        val userId = currentUserId
        if (userId == null) {
            followingActionError = "Sign in to unfollow agents."
            return
        }
        scope.launch {
            // Optimistic drop first so the row leaves under the finger; the
            // refresh below is the authority if the call fails.
            followedAgents.removeLocally(agentId)
            runCatchingCancellable { AgentChatService.setFollow(userId, agentId, follow = false) }
                .onFailure { followingActionError = it.message ?: "Couldn't unfollow that agent." }
            followedAgents.refresh()
            if (followedAgents.follows.isEmpty()) showFollowingSheet = false
        }
    }

    fun copyFollowedAgent(agentId: String) {
        if (copyBuildPreflightBusy) return
        scope.launch {
            copyBuildPreflightBusy = true
            try {
                when (val preflight = runAgentCreationPreflight(currentUserId, store, entitlements)) {
                    AgentCreationPreflight.Allowed -> Unit
                    is AgentCreationPreflight.Blocked -> {
                        followingActionError = preflight.message
                        return@launch
                    }
                }
            // The rail row carries only display columns — the full build
            // (personality + insights) needs the detail snapshot.
                val detail = graph.agentDetailStores.store(agentId)
                if (detail.snapshot?.agent == null) detail.refreshSnapshot()
                val source = detail.snapshot?.agent
                if (source == null) {
                    followingActionError = "That agent's build couldn't be loaded."
                    return@launch
                }
                showFollowingSheet = false
                copyBuildDraft = AgentCreationStore.Draft.copying(fromPublicAgent = source)
            } finally {
                copyBuildPreflightBusy = false
            }
        }
    }

    // The tab picker (sticky under the title). Its filter menu is contextual.
    val tabPicker: @Composable () -> Unit = {
        TabPicker(
            selected = store.activeTab,
            onSelect = { store.activeTab = it },
            filterMenuContent = { onClose ->
                FilterMenuContent(
                    tab = store.activeTab,
                    sortOption = sortOption,
                    onSortOption = { sortOption = it },
                    leaderboardStore = leaderboardStore,
                    topPicksStore = topPicksStore,
                    onClose = onClose,
                )
            },
        )
    }

    // Box, not a bare Column: the copy-build builder renders as a full-screen
    // overlay ON TOP of the tab, and a Column parent would stack it below.
    Box(modifier.fillMaxSize().background(AppColors.appSurface)) {
        Column(Modifier.fillMaxSize()) {
            WagerProofTopBar(tabStore = graph.mainTab, modifier = Modifier.fillMaxWidth()) {
                IconButton(
                    onClick = {
                        if (!canCreate) return@IconButton
                        // iOS .sensoryFeedback(.impact(weight: .medium)) (AgentsView.swift:1180).
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        nav.openAgentCreate()
                    },
                    enabled = canCreate,
                ) {
                    Icon(
                        imageVector = if (canCreate) Icons.Filled.Add else Icons.Filled.Lock,
                        contentDescription = if (canCreate) "Create new agent" else "Agent limit reached",
                        tint = if (canCreate) AppColors.appTextPrimary else AppColors.appTextSecondary,
                    )
                }
            }
            Text(
                "Agents",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )

            when (store.activeTab) {
                AgentsStore.InnerTab.MyAgents -> MyAgentsBody(
                    store = store,
                    sortedAgents = sortedAgents(store.agents, sortOption, pinnedIds),
                    sortOption = sortOption,
                    onSortOption = { sortOption = it },
                    animationsActive = animationsActive,
                    tabPicker = tabPicker,
                    pinnedIds = pinnedIds,
                    unreadToken = unreadRefreshToken,
                    follows = followedAgents.follows,
                    onOpenFollowed = { nav.openAgentDetail(it, isPublic = true) },
                    onSeeAllFollowing = { showFollowingSheet = true },
                    onOpenDetail = { nav.openAgentDetail(it, isPublic = false) },
                    onLongPress = { pendingLongPress = it },
                    onCreate = { nav.openAgentCreate() },
                    onRetry = { scope.launch { store.refresh() } },
                    onRefresh = { scope.launch { store.refresh() } },
                    leadingActions = { row ->
                        leadingSwipeActions(
                            row = row,
                            isPinned = pinnedIds.contains(row.agent.id),
                            onToggleActive = { toggleActive(row) },
                            onTogglePin = { togglePin(row.agent.id) },
                            onEdit = { nav.openAgentEdit(row.agent.id) },
                            onDetails = { nav.openAgentDetail(row.agent.id, isPublic = false) },
                        )
                    },
                    trailingActions = { row ->
                        listOf(
                            RowSwipeAction(
                                id = "delete", title = "Delete", systemImage = "trash.fill",
                                tint = AppColors.appLoss,
                            ) { pendingDeleteId = row.id },
                        )
                    },
                )

                AgentsStore.InnerTab.Leaderboard -> AgentLeaderboard(
                    store = leaderboardStore,
                    entitlements = entitlements,
                    showsFilters = false,
                    pinnedHeader = tabPicker,
                    onRowTap = { entry -> nav.openAgentDetail(entry.avatarId, isPublic = true) },
                )

                AgentsStore.InnerTab.TopPicks -> TopAgentPicksFeed(
                    store = topPicksStore,
                    favorites = topPicksFavorites,
                    showsFilters = false,
                    pinnedHeader = tabPicker,
                    onAgentTap = { id -> nav.openAgentDetail(id, isPublic = true) },
                    // No public pick-detail sheet yet — open the picking agent.
                    onPickTap = { row -> nav.openAgentDetail(row.avatarId, isPublic = true) },
                )
            }
        }

        // Copy build renders full-screen over the tab (same treatment as public
        // detail) because the builder owns its own chrome + pixelwave background.
        copyBuildDraft?.let { seed ->
            // Tell the shell to drop the bottom bar for the duration — iOS's
            // fullScreenCover hides the tab bar, and leaving it visible under
            // the builder is the whole of AND-parity item "copy-build overlay".
            DisposableEffect(Unit) {
                AgentCopyBuildPresentation.update(true)
                onDispose { AgentCopyBuildPresentation.update(false) }
            }
            AgentBuilderScreen(
                modifier = Modifier.fillMaxSize(),
                initialDraft = seed,
                onCreated = { created ->
                    copyBuildDraft = null
                    nav.openAgentDetail(created.id, isPublic = false)
                },
                onCancel = { copyBuildDraft = null },
            )
        }
    }

    // --- Following sheet -----------------------------------------------------

    if (showFollowingSheet) {
        FollowingSheet(
            follows = followedAgents.follows,
            unreadToken = unreadRefreshToken,
            animationsActive = animationsActive,
            onOpenAgent = { id ->
                showFollowingSheet = false
                nav.openAgentDetail(id, isPublic = true)
            },
            onCopyBuild = ::copyFollowedAgent,
            onUnfollow = ::unfollowAgent,
            onDismiss = { showFollowingSheet = false },
        )
    }

    followingActionError?.let { message ->
        AlertDialog(
            onDismissRequest = { followingActionError = null },
            title = { Text("Error") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = { followingActionError = null }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    // --- Dialogs -----------------------------------------------------------

    pendingLongPress?.let { row ->
        LongPressActionSheet(
            agent = row,
            // iOS's "Settings" action pushes the agent DETAIL page, not the
            // editor (AgentsView.swift:1203-1206) — the detail is where the
            // owner controls live.
            onSettings = {
                nav.openAgentDetail(row.agent.id, isPublic = false)
                pendingLongPress = null
            },
            onToggleAutopilot = {
                scope.launch { store.setAutoGenerate(row.id, !row.agent.autoGenerate) }
                pendingLongPress = null
            },
            onDelete = {
                pendingDeleteId = row.id
                pendingLongPress = null
            },
            onDismiss = { pendingLongPress = null },
        )
    }

    pendingDeleteId?.let { id ->
        val name = store.agents.firstOrNull { it.id == id }?.agent?.name ?: "Agent"
        AlertDialog(
            onDismissRequest = { pendingDeleteId = null },
            title = { Text("Delete agent?") },
            text = { Text("“$name” and its picks will be permanently removed. This can't be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    pendingDeleteId = null
                    scope.launch { store.delete(id) }
                }) { Text("Delete", color = AppColors.appLoss) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteId = null }) { Text("Cancel") }
            },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    if (activeCapAlert) {
        AlertDialog(
            onDismissRequest = { activeCapAlert = false },
            title = { Text("Active limit reached") },
            text = {
                Text(
                    "You can have up to ${AgentEntitlementsStore.MAX_CONCURRENT_ACTIVE_AGENTS} " +
                        "agents active at once. Pause one to activate another.",
                )
            },
            confirmButton = { TextButton(onClick = { activeCapAlert = false }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}

// ---------------------------------------------------------------------------
// Tab picker + filter menu
// ---------------------------------------------------------------------------

@Composable
private fun TabPicker(
    selected: AgentsStore.InnerTab,
    onSelect: (AgentsStore.InnerTab) -> Unit,
    filterMenuContent: @Composable (onClose: () -> Unit) -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    val tabs = AgentsStore.InnerTab.entries
    // No opaque full-width bar: iOS floats this as a Liquid Glass capsule over
    // the content, with the filter menu INSIDE the capsule
    // (AgentsView.swift:352-372).
    GlassSegmentedPicker(
        labels = tabs.map { it.label },
        selectedIndex = tabs.indexOf(selected),
        onSelect = { onSelect(tabs[it]) },
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp),
        trailing = {
            Box {
                IconButton(onClick = { menuOpen = true }, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Filled.FilterList, contentDescription = "Filter", tint = AppColors.appTextPrimary)
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    filterMenuContent { menuOpen = false }
                }
            }
        },
    )
}

@Composable
private fun FilterMenuContent(
    tab: AgentsStore.InnerTab,
    sortOption: AgentSortOption,
    onSortOption: (AgentSortOption) -> Unit,
    leaderboardStore: LeaderboardStore,
    topPicksStore: TopAgentPicksFeedStore,
    onClose: () -> Unit,
) {
    when (tab) {
        AgentsStore.InnerTab.MyAgents -> {
            AgentSortOption.entries.forEach { opt ->
                DropdownMenuItem(
                    text = { Text(opt.label) },
                    leadingIcon = { Icon(agentSymbol(opt.icon), contentDescription = null, modifier = Modifier.size(18.dp)) },
                    trailingIcon = { if (opt == sortOption) Icon(agentSymbol("checkmark"), contentDescription = null, modifier = Modifier.size(16.dp)) },
                    onClick = { onSortOption(opt); onClose() },
                )
            }
        }
        AgentsStore.InnerTab.Leaderboard -> {
            AgentPerformanceService.LeaderboardSortMode.entries.forEach { mode ->
                DropdownMenuItem(
                    text = { Text(mode.label) },
                    trailingIcon = { if (mode == leaderboardStore.sortMode) Icon(agentSymbol("checkmark"), contentDescription = null, modifier = Modifier.size(16.dp)) },
                    onClick = { leaderboardStore.setSortMode(mode); onClose() },
                )
            }
            HorizontalDivider(color = AppColors.appBorder)
            AgentPerformanceService.LeaderboardTimeframe.entries.forEach { tf ->
                DropdownMenuItem(
                    text = { Text(tf.label) },
                    trailingIcon = { if (tf == leaderboardStore.timeframe) Icon(agentSymbol("checkmark"), contentDescription = null, modifier = Modifier.size(16.dp)) },
                    onClick = { leaderboardStore.setTimeframe(tf); onClose() },
                )
            }
            HorizontalDivider(color = AppColors.appBorder)
            DropdownMenuItem(
                text = { Text("10+ picks only") },
                trailingIcon = {
                    Checkbox(
                        checked = leaderboardStore.excludeUnder10Picks,
                        onCheckedChange = null,
                    )
                },
                onClick = { leaderboardStore.setExcludeUnder10Picks(!leaderboardStore.excludeUnder10Picks) },
            )
        }
        AgentsStore.InnerTab.TopPicks -> {
            TopAgentPicksFeedStore.FilterMode.entries.forEach { mode ->
                DropdownMenuItem(
                    text = { Text(mode.label) },
                    trailingIcon = { if (mode == topPicksStore.filterMode) Icon(agentSymbol("checkmark"), contentDescription = null, modifier = Modifier.size(16.dp)) },
                    onClick = { topPicksStore.filterMode = mode; onClose() },
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// My Agents body
// ---------------------------------------------------------------------------

internal enum class MyAgentsBodyMode {
    INITIAL_LOADING,
    FAILED_EMPTY,
    TRUE_EMPTY,
    FOLLOWING_ONLY,
    OWNED_AGENTS,
}

/**
 * Keeps the followed-agent rail independent from ownership: following public
 * agents is valid even before the viewer creates an agent of their own.
 */
internal fun myAgentsBodyMode(
    loadState: LoadState,
    ownedAgentsEmpty: Boolean,
    hasFollows: Boolean,
): MyAgentsBodyMode = when {
    (loadState is LoadState.Idle || loadState is LoadState.Loading) && ownedAgentsEmpty ->
        MyAgentsBodyMode.INITIAL_LOADING
    loadState is LoadState.Failed && ownedAgentsEmpty -> MyAgentsBodyMode.FAILED_EMPTY
    loadState is LoadState.Loaded && ownedAgentsEmpty && hasFollows -> MyAgentsBodyMode.FOLLOWING_ONLY
    loadState is LoadState.Loaded && ownedAgentsEmpty -> MyAgentsBodyMode.TRUE_EMPTY
    else -> MyAgentsBodyMode.OWNED_AGENTS
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun MyAgentsBody(
    store: AgentsStore,
    sortedAgents: List<AgentWithPerformance>,
    sortOption: AgentSortOption,
    onSortOption: (AgentSortOption) -> Unit,
    animationsActive: Boolean,
    tabPicker: @Composable () -> Unit,
    pinnedIds: Set<String>,
    unreadToken: Int,
    follows: List<FollowedAgentsStore.FollowedAgent>,
    onOpenFollowed: (String) -> Unit,
    onSeeAllFollowing: () -> Unit,
    onOpenDetail: (String) -> Unit,
    onLongPress: (AgentWithPerformance) -> Unit,
    onCreate: () -> Unit,
    onRetry: () -> Unit,
    onRefresh: () -> Unit,
    leadingActions: (AgentWithPerformance) -> List<RowSwipeAction>,
    trailingActions: (AgentWithPerformance) -> List<RowSwipeAction>,
) {
    val state = store.loadState
    val empty = store.agents.isEmpty()
    val bodyMode = myAgentsBodyMode(
        loadState = state,
        ownedAgentsEmpty = empty,
        hasFollows = follows.isNotEmpty(),
    )

    PullToRefreshBox(
        isRefreshing = state is LoadState.Loading && !empty,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(Modifier.fillMaxSize()) {
            stickyHeader { tabPicker() }

            when (bodyMode) {
                MyAgentsBodyMode.INITIAL_LOADING -> {
                    item {
                        Column(
                            Modifier.padding(horizontal = 12.dp, vertical = Spacing.sm),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            AgentHQShimmer()
                            repeat(4) { AgentRowCardShimmer() }
                        }
                    }
                }

                MyAgentsBodyMode.FAILED_EMPTY -> {
                    item { ErrorState(message = (state as LoadState.Failed).message, onRetry = onRetry) }
                }

                MyAgentsBodyMode.TRUE_EMPTY -> {
                    item { EmptyState(onCreate = onCreate) }
                }

                MyAgentsBodyMode.FOLLOWING_ONLY -> {
                    item {
                        FollowingRail(
                            follows = follows,
                            unreadToken = unreadToken,
                            onOpenAgent = onOpenFollowed,
                            onSeeAll = onSeeAllFollowing,
                            modifier = Modifier.padding(top = 4.dp, bottom = 4.dp),
                            animationsActive = animationsActive,
                        )
                    }
                    // Still explain how to create the viewer's first owned agent;
                    // following someone else does not replace that empty state.
                    item { EmptyState(onCreate = onCreate) }
                }

                MyAgentsBodyMode.OWNED_AGENTS -> {
                    item {
                        Box(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                            OfficeHero(store.agents, animationsActive)
                        }
                    }
                    // Following rail sits between the HQ hero and the sort row,
                    // and hides itself when nothing is followed (iOS AgentsView:572).
                    if (follows.isNotEmpty()) {
                        item {
                            FollowingRail(
                                follows = follows,
                                unreadToken = unreadToken,
                                onOpenAgent = onOpenFollowed,
                                onSeeAll = onSeeAllFollowing,
                                modifier = Modifier.padding(bottom = 4.dp),
                                animationsActive = animationsActive,
                            )
                        }
                    }
                    item { SortRow(sortOption, onSortOption) }
                    itemsIndexed(sortedAgents, key = { _, a -> a.id }) { index, row ->
                        // animateItem: sort/pin changes reorder these keys, and
                        // iOS springs the cards to their new slots rather than
                        // snapping (AgentsView.swift:634-635).
                        Column(Modifier.animateItem()) {
                            AgentSwipeRow(
                                leadingActions = leadingActions(row),
                                trailingActions = trailingActions(row),
                                modifier = Modifier
                                    .padding(horizontal = 12.dp)
                                    .staggeredAppear(index),
                            ) {
                                AgentRowCard(
                                    agent = row,
                                    hasUnreadPicks = run {
                                        @Suppress("UNUSED_EXPRESSION") unreadToken
                                        AgentPicksSeenStore.hasUnread(row.id, row.agent.lastGeneratedAt)
                                    },
                                    animationsActive = animationsActive,
                                    onTap = { onOpenDetail(row.id) },
                                    onLongPress = { onLongPress(row) },
                                )
                            }
                            Spacer(Modifier.height(10.dp))
                        }
                    }
                    item { Spacer(Modifier.height(96.dp)) }
                }
            }
        }
    }
}

/**
 * The My Agents section label and its active sort control share one row
 * (iOS `sortRow` / `sortIndicator` — AgentsView.swift:889-925).
 */
@Composable
private fun SortRow(sortOption: AgentSortOption, onSortOption: (AgentSortOption) -> Unit) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Inlined rather than AgentSectionHeader: iOS's glyph
        // ("person.crop.square.filled.and.at.rectangle") has no entry in the
        // shared agentSymbol map, and that map lives outside this feature.
        Icon(
            Icons.Rounded.Badge,
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.size(13.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            "MY AGENTS",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextSecondary,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        Box {
            Row(
                Modifier
                    .clip(CircleShape)
                    .clickable { menuOpen = true }
                    .semantics { contentDescription = "Sort My Agents, ${sortOption.label}" }
                    .padding(horizontal = 4.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    agentSymbol("arrow.up.arrow.down"),
                    contentDescription = null,
                    tint = AppColors.appTextMuted,
                    modifier = Modifier.size(12.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    sortOption.label,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.appTextMuted,
                )
                Spacer(Modifier.width(3.dp))
                Icon(
                    agentSymbol("chevron.down"),
                    contentDescription = null,
                    tint = AppColors.appTextMuted,
                    modifier = Modifier.size(10.dp),
                )
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                AgentSortOption.entries.forEach { opt ->
                    DropdownMenuItem(
                        text = { Text(opt.label) },
                        leadingIcon = {
                            Icon(agentSymbol(opt.icon), contentDescription = null, modifier = Modifier.size(18.dp))
                        },
                        trailingIcon = {
                            if (opt == sortOption) {
                                Icon(agentSymbol("checkmark"), contentDescription = null, modifier = Modifier.size(16.dp))
                            }
                        },
                        onClick = { onSortOption(opt); menuOpen = false },
                    )
                }
            }
        }
    }
}

@Composable
private fun OfficeHero(agents: List<AgentWithPerformance>, isActive: Boolean) {
    Box {
        AgentsOfficeHero(agents = agents, isActive = isActive, modifier = Modifier.fillMaxWidth())
        AgentHQStatusPill(Modifier.align(Alignment.TopStart).padding(10.dp))
        AgencyStatsPill(agents = agents, modifier = Modifier.align(Alignment.TopEnd).padding(10.dp))
    }
}

@Composable
private fun AgentHQStatusPill(modifier: Modifier = Modifier) {
    // Reads the office's OWN persisted toggle through the shared observable, so
    // tapping its Auto/Day/Night chip flips this label too. A keyless `remember`
    // over a different prefs file used to latch whatever was true at first
    // composition (iOS reads the same @AppStorage per render — AgentsView:929-954).
    val night = pixelOfficeIsNight(rememberPixelOfficeTimeMode())
    Row(
        modifier
            .liquidGlassBackground(CircleShape)
            .padding(horizontal = 11.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(Color(0xFF22C55E)))
        Spacer(Modifier.width(5.dp))
        Text(
            "Agent HQ — ${if (night) "Night Shift" else "Live"}",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
    }
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

@Composable
private fun EmptyState(onCreate: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Both headers wrap on narrow screens; iOS centers them
        // (.multilineTextAlignment(.center) — AgentsView.swift:1100, 1105).
        Text(
            "Your AI Picks Expert",
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            color = AppColors.appTextPrimary,
            textAlign = TextAlign.Center,
        )
        Text(
            "Build a virtual analyst that thinks the way you bet.",
            fontSize = 15.sp,
            color = AppColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        JourneyStep("slider.horizontal.3", "Build Your Strategy", "Choose risk level, bet types, and sports. Pick a preset archetype or go fully custom.")
        JourneyStep("brain.head.profile", "AI Analyzes Every Game", "Your agent scans today's slate using WagerProof model data, odds, and market signals.")
        JourneyStep("bolt.fill", "Get Daily Picks", "Picks generate automatically each morning with reasoning and confidence levels.")
        Row(
            Modifier
                .padding(top = 8.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF00E676))
                .clickable(onClick = onCreate)
                .padding(horizontal = 24.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Create Your First Agent", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}

@Composable
private fun JourneyStep(icon: String, title: String, desc: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appBorder.copy(alpha = 0.25f))
            .border(1.dp, Color(0xFF00E676).copy(alpha = 0.12f), RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(Color(0xFF00E676).copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(agentSymbol(icon), contentDescription = null, tint = Color(0xFF00E676), modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
            Text(desc, fontSize = 13.sp, color = AppColors.appTextSecondary)
        }
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(agentSymbol("exclamationmark.triangle"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(32.dp))
        Text("Couldn't load agents", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
        Text(message, fontSize = 13.sp, color = AppColors.appTextSecondary)
        Row(
            Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF00E676))
                .clickable(onClick = onRetry)
                .padding(horizontal = 20.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(agentSymbol("arrow.clockwise"), contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("Retry", color = Color.White, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ---------------------------------------------------------------------------
// Long-press action sheet
// ---------------------------------------------------------------------------

/**
 * Long-press menu for a hub row. iOS presents a bottom `confirmationDialog`
 * with a destructive Delete and a Cancel role (AgentsView.swift:272-280,
 * 1201-1218) — a centered AlertDialog with an empty confirm button was neither
 * the right affordance nor a valid Material dialog.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LongPressActionSheet(
    agent: AgentWithPerformance,
    onSettings: () -> Unit,
    onToggleAutopilot: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = AppColors.appSurfaceElevated,
    ) {
        Text(
            agent.agent.name,
            color = AppColors.appTextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        )
        HorizontalDivider(color = AppColors.appBorder.copy(alpha = 0.5f))
        SheetActionRow("Settings", onSettings)
        SheetActionRow(
            if (agent.agent.autoGenerate) "Turn Autopilot Off" else "Turn Autopilot On",
            onToggleAutopilot,
        )
        SheetActionRow("Delete Agent", onDelete, tint = AppColors.appLoss)
        HorizontalDivider(color = AppColors.appBorder.copy(alpha = 0.5f))
        SheetActionRow("Cancel", onDismiss, tint = AppColors.appTextSecondary)
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SheetActionRow(label: String, onClick: () -> Unit, tint: Color = AppColors.appTextPrimary) {
    Text(
        label,
        color = tint,
        fontSize = 16.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 15.dp),
    )
}

// ---------------------------------------------------------------------------
// Swipe row (leading multi-action + trailing delete)
// ---------------------------------------------------------------------------

internal val SWIPE_BUTTON_WIDTH = 76.dp

/**
 * Hand-rolled swipe row standing in for SwiftUI's `.swipeActions`. Buttons grow
 * out from under the card in step with the finger, match the card's real height,
 * and — on the trailing edge — a hard swipe past [FULL_SWIPE_FRACTION] of the
 * row fires the first action outright, which is iOS's `allowsFullSwipe: true`
 * (AgentsView.swift:603-610). The action itself still routes through whatever
 * confirmation the caller wired up.
 */
@Composable
internal fun AgentSwipeRow(
    leadingActions: List<RowSwipeAction>,
    trailingActions: List<RowSwipeAction>,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val density = androidx.compose.ui.platform.LocalDensity.current
    val offsetX = remember { Animatable(0f) }
    var rowWidthPx by remember { mutableFloatStateOf(0f) }
    val leadingWidthPx = with(density) { (SWIPE_BUTTON_WIDTH * leadingActions.size).toPx() }
    val trailingWidthPx = with(density) { (SWIPE_BUTTON_WIDTH * trailingActions.size).toPx() }
    // Trailing drags run past the button strip so a full swipe is reachable;
    // leading ones stop at the strip (iOS uses allowsFullSwipe: false there).
    val maxTrailingPx = if (trailingActions.isEmpty()) 0f else maxOf(trailingWidthPx, rowWidthPx)

    fun reset() {
        scope.launch { offsetX.animateTo(0f) }
    }

    Box(
        modifier
            .fillMaxWidth()
            .onSizeChanged { rowWidthPx = it.width.toFloat() },
    ) {
        val revealed = offsetX.value
        if (revealed > 0f && leadingActions.isNotEmpty()) {
            // matchParentSize takes the height the card measured, so the buttons
            // stop being a hardcoded 96dp that clipped or floated on real rows.
            Row(Modifier.matchParentSize().clipToBounds()) {
                val buttonWidth = with(density) { (revealed / leadingActions.size).toDp() }
                leadingActions.forEach { a ->
                    SwipeButton(a, buttonWidth) { a.action(); reset() }
                }
            }
        }
        if (revealed < 0f && trailingActions.isNotEmpty()) {
            Row(
                Modifier.matchParentSize().clipToBounds(),
                horizontalArrangement = Arrangement.End,
            ) {
                val buttonWidth = with(density) { (-revealed / trailingActions.size).toDp() }
                trailingActions.forEach { a ->
                    SwipeButton(a, buttonWidth) { a.action(); reset() }
                }
            }
        }
        Box(
            Modifier
                .offset { androidx.compose.ui.unit.IntOffset(offsetX.value.roundToInt(), 0) }
                .pointerInput(leadingActions, trailingActions, maxTrailingPx) {
                    detectHorizontalDragGestures(
                        onHorizontalDrag = { _, dragAmount ->
                            // Read + coerce inside the launch — two pointer events can fire
                            // before the first coroutine dispatches, and reading .value out
                            // here would let the second overwrite the first's delta.
                            scope.launch {
                                val next = (offsetX.value + dragAmount).coerceIn(-maxTrailingPx, leadingWidthPx)
                                offsetX.snapTo(next)
                            }
                        },
                        onDragEnd = {
                            val v = offsetX.value
                            val fullSwipe = rowWidthPx > 0f &&
                                trailingActions.isNotEmpty() &&
                                v <= -rowWidthPx * FULL_SWIPE_FRACTION
                            scope.launch {
                                when {
                                    fullSwipe -> {
                                        offsetX.animateTo(-rowWidthPx)
                                        trailingActions.first().action()
                                        // Snap home: the action opens a confirm
                                        // step, so the row must not stay parked
                                        // off-screen while that is answered.
                                        offsetX.snapTo(0f)
                                    }
                                    v > leadingWidthPx * 0.5f -> offsetX.animateTo(leadingWidthPx)
                                    v < -trailingWidthPx * 0.5f -> offsetX.animateTo(-trailingWidthPx)
                                    else -> offsetX.animateTo(0f)
                                }
                            }
                        },
                    )
                },
        ) { content() }
    }
}

@Composable
private fun SwipeButton(
    action: RowSwipeAction,
    width: androidx.compose.ui.unit.Dp,
    onClick: () -> Unit,
) {
    Column(
        Modifier
            .width(width)
            .fillMaxHeight()
            .clip(RoundedCornerShape(16.dp))
            .background(action.tint)
            .clickable(onClick = onClick)
            .clipToBounds()
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(agentSymbol(action.systemImage), contentDescription = action.title, tint = Color.White, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(4.dp))
        Text(action.title, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

// ---------------------------------------------------------------------------
// Swipe action builders
// ---------------------------------------------------------------------------

private fun leadingSwipeActions(
    row: AgentWithPerformance,
    isPinned: Boolean,
    onToggleActive: () -> Unit,
    onTogglePin: () -> Unit,
    onEdit: () -> Unit,
    onDetails: () -> Unit,
): List<RowSwipeAction> {
    val a = row.agent
    return listOf(
        RowSwipeAction(
            id = "active",
            title = if (a.isActive) "Pause" else "Activate",
            systemImage = if (a.isActive) "pause.circle.fill" else "play.circle.fill",
            tint = if (a.isActive) Color(0xFFF97316) else AppColors.appWin,
        ) { onToggleActive() },
        RowSwipeAction(
            id = "pin",
            title = if (isPinned) "Unpin" else "Pin",
            systemImage = if (isPinned) "pin.slash.fill" else "pin.fill",
            tint = Color(0xFFEAB308),
        ) { onTogglePin() },
        RowSwipeAction(
            id = "edit", title = "Edit", systemImage = "slider.horizontal.3",
            tint = AppColors.appAccentBlue,
        ) { onEdit() },
        RowSwipeAction(
            id = "details", title = "Details", systemImage = "info.circle.fill",
            tint = Color(0xFF6366F1),
        ) { onDetails() },
    )
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

private fun sortedAgents(
    agents: List<AgentWithPerformance>,
    option: AgentSortOption,
    pinnedIds: Set<String>,
): List<AgentWithPerformance> {
    fun winPct(x: AgentWithPerformance): Double {
        val p = x.performance ?: return -1.0
        val settled = p.wins + p.losses
        if (settled <= 0) return -1.0
        return p.wins.toDouble() / settled
    }
    val base = when (option) {
        AgentSortOption.WinRate -> agents.sortedByDescending { winPct(it) }
        AgentSortOption.Units -> agents.sortedByDescending { it.performance?.netUnits ?: 0.0 }
        AgentSortOption.Streak -> agents.sortedByDescending { it.performance?.currentStreak ?: 0 }
        AgentSortOption.Name -> agents.sortedBy { it.agent.name.lowercase() }
        AgentSortOption.Newest -> agents.sortedByDescending { it.agent.createdAt }
    }
    if (pinnedIds.isEmpty()) return base
    return base.filter { pinnedIds.contains(it.agent.id) } + base.filter { !pinnedIds.contains(it.agent.id) }
}

// ---------------------------------------------------------------------------
// Shimmers
// ---------------------------------------------------------------------------

/** Skeleton plate for the Agent HQ office hero (864:800 aspect, corner pills). */
@Composable
internal fun AgentHQShimmer(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .aspectRatio(864f / 800f)
            .clip(RoundedCornerShape(20.dp))
            .background(AppColors.appSkeleton.copy(alpha = 0.55f))
            .shimmering(),
    ) {
        SkeletonCapsule(height = 20.dp, width = 112.dp, modifier = Modifier.align(Alignment.TopStart).padding(10.dp))
        SkeletonCapsule(height = 20.dp, width = 92.dp, modifier = Modifier.align(Alignment.TopEnd).padding(10.dp))
    }
}

/** Skeleton placeholder mirroring `AgentRowCard`'s chrome + layout. */
@Composable
internal fun AgentRowCardShimmer(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(26.dp)
    Box(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.4f), shape),
    ) {
        Column(
            Modifier
                .padding(horizontal = 14.dp)
                .padding(top = 12.dp, bottom = 9.dp)
                .shimmering(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SkeletonBlock(height = 52.dp, width = 52.dp, cornerRadius = 14.dp)
                Spacer(Modifier.width(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SkeletonBlock(height = 14.dp, width = 120.dp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        SkeletonCapsule(height = 16.dp, width = 56.dp)
                        SkeletonCapsule(height = 16.dp, width = 44.dp)
                    }
                }
                Spacer(Modifier.weight(1f))
                Column(
                    Modifier.width(96.dp),
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    SkeletonCapsule(height = 16.dp, width = 58.dp)
                    Row(
                        Modifier.height(28.dp),
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                        verticalAlignment = Alignment.Bottom,
                    ) {
                        listOf(14, 22, 10, 26, 18, 12).forEach { h ->
                            SkeletonBlock(height = h.dp, width = 8.dp, cornerRadius = 2.dp)
                        }
                    }
                }
            }
            HorizontalDivider(color = AppColors.appBorder.copy(alpha = 0.5f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                SkeletonCapsule(height = 18.dp, width = 40.dp)
                Spacer(Modifier.width(4.dp))
                SkeletonCapsule(height = 18.dp, width = 40.dp)
                Spacer(Modifier.weight(1f))
                SkeletonBlock(height = 12.dp, width = 88.dp)
            }
        }
    }
}
