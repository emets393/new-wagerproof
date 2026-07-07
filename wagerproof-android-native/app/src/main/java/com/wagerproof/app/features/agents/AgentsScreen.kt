package com.wagerproof.app.features.agents

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
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.components.AgencyStatsPill
import com.wagerproof.app.features.agents.components.AgentLeaderboard
import com.wagerproof.app.features.agents.components.AgentRowCard
import com.wagerproof.app.features.agents.components.AgentsOfficeHero
import com.wagerproof.app.features.agents.components.RowSwipeAction
import com.wagerproof.app.features.agents.components.TopAgentPicksFeed
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.core.design.components.LiquidGlassCapsule
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.AgentPicksSeenStore
import com.wagerproof.core.stores.AgentsStore
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.FavoriteAgentsStore
import com.wagerproof.core.stores.LeaderboardStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.StorePrefs
import com.wagerproof.core.stores.TopAgentPicksFeedStore
import com.wagerproof.core.services.AgentPerformanceService
import kotlinx.coroutines.launch
import java.util.Calendar
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
private const val OFFICE_TIME_MODE_KEY = "pixel-office-time-mode"

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

    val currentUserId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId?.lowercase()
    // Per-render facade — reads live ProAccessStore state (matches iOS).
    val entitlements = AgentEntitlementsStore(proAccess)

    val store = remember { AgentsStore() }
    val leaderboardStore = remember { LeaderboardStore() }
    val topPicksStore = remember { TopAgentPicksFeedStore() }
    val topPicksFavorites = remember { FavoriteAgentsStore() }

    var sortOption by remember { mutableStateOf(AgentSortOption.WinRate) }
    var pendingDeleteId by remember { mutableStateOf<String?>(null) }
    var pendingLongPress by remember { mutableStateOf<AgentWithPerformance?>(null) }
    var activeCapAlert by remember { mutableStateOf(false) }
    var unreadRefreshToken by remember { mutableIntStateOf(0) }

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

    // Bind + first refresh; rebind whenever the signed-in user changes.
    LaunchedEffect(currentUserId) {
        store.bind(currentUserId)
        store.refresh()
        topPicksStore.bind(currentUserId)
        unreadRefreshToken += 1
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

    Column(
        modifier
            .fillMaxSize()
            .background(AppColors.appSurface),
    ) {
        AgentsTopBar(
            canCreate = canCreate,
            onCreate = { nav.openAgentCreate() },
            onSettings = { nav.openSettings() },
        )
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
                sortLabel = sortOption.label,
                tabPicker = tabPicker,
                pinnedIds = pinnedIds,
                unreadToken = unreadRefreshToken,
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

    // --- Dialogs -----------------------------------------------------------

    pendingLongPress?.let { row ->
        LongPressDialog(
            agent = row,
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
// Top bar
// ---------------------------------------------------------------------------

@Composable
private fun AgentsTopBar(
    canCreate: Boolean,
    onCreate: () -> Unit,
    onSettings: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Wager", fontSize = 18.sp, fontWeight = FontWeight.Black, color = AppColors.appTextPrimary)
            Text("Proof", fontSize = 18.sp, fontWeight = FontWeight.Black, color = AppColors.appPrimary)
        }
        Spacer(Modifier.weight(1f))
        if (canCreate) {
            IconButton(onClick = onCreate) {
                Icon(Icons.Filled.Add, contentDescription = "Create new agent", tint = AppColors.appTextPrimary)
            }
        } else {
            IconButton(onClick = {}, enabled = false) {
                Icon(Icons.Filled.Lock, contentDescription = "Agent limit reached", tint = AppColors.appTextSecondary)
            }
        }
        IconButton(onClick = onSettings) {
            Icon(Icons.Filled.Settings, contentDescription = "Settings", tint = AppColors.appTextPrimary)
        }
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
    Row(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appSurface)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LiquidGlassCapsule(modifier = Modifier.weight(1f)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                AgentsStore.InnerTab.entries.forEach { tab ->
                    val active = tab == selected
                    Box(
                        Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .background(if (active) AppColors.appPrimary.copy(alpha = 0.20f) else Color.Transparent)
                            .clickable { onSelect(tab) }
                            .padding(vertical = 7.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            tab.label,
                            fontSize = 13.sp,
                            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                            color = if (active) AppColors.appPrimary else AppColors.appTextSecondary,
                        )
                    }
                }
            }
        }
        Spacer(Modifier.width(8.dp))
        Box {
            IconButton(onClick = { menuOpen = true }, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Filled.FilterList, contentDescription = "Filter", tint = AppColors.appTextPrimary)
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                filterMenuContent { menuOpen = false }
            }
        }
    }
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

@Composable
private fun MyAgentsBody(
    store: AgentsStore,
    sortedAgents: List<AgentWithPerformance>,
    sortLabel: String,
    tabPicker: @Composable () -> Unit,
    pinnedIds: Set<String>,
    unreadToken: Int,
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

    LazyColumn(Modifier.fillMaxSize()) {
        stickyHeader { tabPicker() }

        when {
            (state is LoadState.Idle || state is LoadState.Loading) && empty -> {
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

            state is LoadState.Failed && empty -> {
                item { ErrorState(message = state.message, onRetry = onRetry) }
            }

            state is LoadState.Loaded && empty -> {
                item { EmptyState(onCreate = onCreate) }
            }

            else -> {
                item {
                    Box(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                        OfficeHero(store.agents)
                    }
                }
                item { SortRow(sortLabel) }
                itemsIndexed(sortedAgents, key = { _, a -> a.id }) { index, row ->
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
                            onTap = { onOpenDetail(row.id) },
                            onLongPress = { onLongPress(row) },
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                }
                item { Spacer(Modifier.height(96.dp)) }
            }
        }
    }
}

@Composable
private fun SortRow(label: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.AutoMirrored.Filled.Sort,
            contentDescription = null,
            tint = AppColors.appTextMuted,
            modifier = Modifier.size(12.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
    }
}

@Composable
private fun OfficeHero(agents: List<AgentWithPerformance>) {
    Box {
        AgentsOfficeHero(agents = agents, isActive = true, modifier = Modifier.fillMaxWidth())
        AgentHQStatusPill(Modifier.align(Alignment.TopStart).padding(10.dp))
        AgencyStatsPill(agents = agents, modifier = Modifier.align(Alignment.TopEnd).padding(10.dp))
    }
}

@Composable
private fun AgentHQStatusPill(modifier: Modifier = Modifier) {
    val night = remember {
        when (StorePrefs.standard.getString(OFFICE_TIME_MODE_KEY, "auto")) {
            "day" -> false
            "night" -> true
            else -> {
                val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
                hour >= 19 || hour < 6
            }
        }
    }
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
        Text(
            "Your AI Picks Expert",
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            color = AppColors.appTextPrimary,
        )
        Text(
            "Build a virtual analyst that thinks the way you bet.",
            fontSize = 15.sp,
            color = AppColors.appTextSecondary,
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
// Long-press dialog
// ---------------------------------------------------------------------------

@Composable
private fun LongPressDialog(
    agent: AgentWithPerformance,
    onSettings: () -> Unit,
    onToggleAutopilot: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(agent.agent.name) },
        text = {
            Column {
                DialogRow("Settings", onSettings)
                DialogRow(
                    if (agent.agent.autoGenerate) "Turn Autopilot Off" else "Turn Autopilot On",
                    onToggleAutopilot,
                )
                DialogRow("Delete Agent", onDelete, tint = AppColors.appLoss)
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        containerColor = AppColors.appSurfaceElevated,
    )
}

@Composable
private fun DialogRow(label: String, onClick: () -> Unit, tint: Color = AppColors.appTextPrimary) {
    Text(
        label,
        color = tint,
        fontSize = 16.sp,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
    )
}

// ---------------------------------------------------------------------------
// Swipe row (leading multi-action + trailing delete)
// ---------------------------------------------------------------------------

private val SWIPE_BUTTON_WIDTH = 76.dp

@Composable
private fun AgentSwipeRow(
    leadingActions: List<RowSwipeAction>,
    trailingActions: List<RowSwipeAction>,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val density = androidx.compose.ui.platform.LocalDensity.current
    val offsetX = remember { Animatable(0f) }
    val leadingWidthPx = with(density) { (SWIPE_BUTTON_WIDTH * leadingActions.size).toPx() }
    val trailingWidthPx = with(density) { (SWIPE_BUTTON_WIDTH * trailingActions.size).toPx() }

    fun reset() {
        scope.launch { offsetX.animateTo(0f) }
    }

    Box(modifier.fillMaxWidth()) {
        // Leading action buttons (revealed on right-swipe).
        Row(Modifier.align(Alignment.CenterStart).height(if (offsetX.value > 0f) androidx.compose.ui.unit.Dp.Unspecified else 0.dp)) {}
        if (offsetX.value > 0f) {
            Row(Modifier.align(Alignment.CenterStart)) {
                leadingActions.forEach { a ->
                    SwipeButton(a) { a.action(); reset() }
                }
            }
        }
        if (offsetX.value < 0f) {
            Row(Modifier.align(Alignment.CenterEnd)) {
                trailingActions.forEach { a ->
                    SwipeButton(a) { a.action(); reset() }
                }
            }
        }
        Box(
            Modifier
                .offset { androidx.compose.ui.unit.IntOffset(offsetX.value.roundToInt(), 0) }
                .pointerInput(leadingActions, trailingActions) {
                    detectHorizontalDragGestures(
                        onHorizontalDrag = { _, dragAmount ->
                            val next = (offsetX.value + dragAmount).coerceIn(-trailingWidthPx, leadingWidthPx)
                            scope.launch { offsetX.snapTo(next) }
                        },
                        onDragEnd = {
                            val v = offsetX.value
                            scope.launch {
                                when {
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
private fun SwipeButton(action: RowSwipeAction, onClick: () -> Unit) {
    Column(
        Modifier
            .width(SWIPE_BUTTON_WIDTH)
            .fillMaxHeightSafe()
            .clip(RoundedCornerShape(16.dp))
            .background(action.tint)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(agentSymbol(action.systemImage), contentDescription = action.title, tint = Color.White, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(4.dp))
        Text(action.title, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

private fun Modifier.fillMaxHeightSafe(): Modifier = this.height(96.dp)

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

