package com.wagerproof.app.features.agents

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.components.AgentGlassHero
import com.wagerproof.app.features.agents.components.AgentLockedPicksRail
import com.wagerproof.app.features.agents.components.AgentPerformanceChartSkeleton
import com.wagerproof.app.features.agents.components.AgentPerformanceCharts
import com.wagerproof.app.features.agents.components.AgentPickFocusView
import com.wagerproof.app.features.agents.components.AgentPickFolderCard
import com.wagerproof.app.features.agents.components.AgentTimeline
import com.wagerproof.app.features.agents.components.AgentTodaysPicksRail
import com.wagerproof.app.features.agents.components.AgentTodaysPicksRailSkeleton
import com.wagerproof.app.features.agents.components.PickHistorySheet
import com.wagerproof.core.design.backgrounds.GlyphRippleEmitter
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.services.AgentChatService
import com.wagerproof.core.stores.AgentDetailStore
import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.AgentPickAuditStore
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch

/**
 * Read-only public agent detail with a Follow / Unfollow CTA + responsible-
 * gambling disclaimer. iOS `PublicAgentDetailView`. Mirrors the owner detail
 * layout exactly minus the generation / autopilot / settings chrome.
 */
@Composable
fun PublicAgentDetailScreen(agentId: String, modifier: Modifier = Modifier) {
    val graph = appGraph()
    val auth = graph.auth
    val proAccess = graph.proAccess
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    val entitlements = AgentEntitlementsStore(proAccess)
    val store = remember(agentId) { AgentDetailStore(agentId) }
    val auditStore = remember { AgentPickAuditStore() }
    val rippleEmitter = remember { GlyphRippleEmitter() }

    var isFollowing by remember { mutableStateOf(false) }
    var followBusy by remember { mutableStateOf(false) }
    var showHistorySheet by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var focusStartIndex by remember { mutableStateOf<Int?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }

    val currentUserId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId?.lowercase()
    val agent: Agent? = store.snapshot?.agent
    val isOwnAgent = currentUserId != null && agent?.userId?.lowercase() == currentUserId
    val canSeePicks = entitlements.canViewAgentPicks || isOwnAgent
    val agentTint = agent?.let { AgentColorPalette.primary(it.avatarColor) } ?: AppColors.brandGreenBright

    val historyReloadKey = "$agentId-$canSeePicks-$isOwnAgent-${currentUserId ?: ""}"
    LaunchedEffect(historyReloadKey) {
        if (store.snapshot == null) store.refreshSnapshot()
        store.isFollowingFromSnapshot?.let { isFollowing = it }
        if (canSeePicks) {
            store.loadHistory(isOwner = isOwnAgent)
            store.loadPerformancePicks(isOwner = isOwnAgent)
        }
    }

    suspend fun toggleFollow() {
        val userId = currentUserId
        if (userId == null) {
            errorMessage = "Sign in to follow agents."
            return
        }
        followBusy = true
        val next = !isFollowing
        isFollowing = next
        try {
            AgentChatService.setFollow(userId, agentId, next)
        } catch (e: Throwable) {
            isFollowing = !next
            errorMessage = e.message ?: "Something went wrong."
        } finally {
            followBusy = false
        }
    }

    suspend fun refreshDetail() {
        isRefreshing = true
        try {
            store.refreshSnapshot()
            store.isFollowingFromSnapshot?.let { isFollowing = it }
            if (canSeePicks) {
                store.loadHistory(isOwner = isOwnAgent)
                store.loadPerformancePicks(isOwner = isOwnAgent)
            }
        } finally {
            isRefreshing = false
        }
    }

    Box(modifier.fillMaxSize().background(AgentDetailBase)) {
        when {
            agent != null -> AgentDetailScaffold(
                avatarColorRaw = agent.avatarColor,
                rippleEmitter = rippleEmitter,
                topBar = { AgentDetailTopBar(title = agent.name) },
                isRefreshing = isRefreshing,
                onRefresh = { scope.launch { refreshDetail() } },
                hero = { progress ->
                    AgentGlassHero(
                        agent = agent,
                        performance = store.snapshot?.performance,
                        lockedNetUnits = !canSeePicks,
                        subtitleSystemImage = "globe",
                        subtitle = "Public Agent",
                        progress = progress,
                        onAvatarTap = { offset: Offset ->
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            rippleEmitter.emit(offset)
                        },
                        modifier = Modifier.padding(horizontal = 16.dp).padding(top = 6.dp),
                    )
                },
            ) {
                // Follow CTA / own-agent banner.
                Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 12.dp)) {
                    if (isOwnAgent) OwnAgentBanner() else FollowButton(isFollowing, followBusy) { scope.launch { toggleFollow() } }
                }
                // Today's Picks.
                PublicPicksSection(store, canSeePicks, agentTint) { idx -> focusStartIndex = idx }
                // Performance.
                PublicPerformanceSection(store, canSeePicks, agentTint, agent.preferredSports)
                // Recent Activity.
                AgentTimeline(
                    agent = agent,
                    performance = store.snapshot?.performance,
                    todaysPicks = store.todaysPicks,
                    todaysParlays = store.todaysParlays,
                    todaysRun = store.todaysGenerationRun,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 28.dp),
                )
                // Pick History.
                AgentPickFolderCard(
                    recentItems = if (canSeePicks) store.fullBetHistory else emptyList(),
                    totalCount = store.fullBetHistory.size,
                    loading = canSeePicks && isHistoryLoading(store) && store.fullBetHistory.isEmpty(),
                    locked = !canSeePicks,
                    agentColor = agentTint,
                    onTap = { showHistorySheet = true },
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 28.dp),
                )
                Disclaimer(Modifier.padding(horizontal = 16.dp).padding(bottom = 12.dp))
            }

            store.snapshotLoadState is LoadState.Loading || store.snapshotLoadState is LoadState.Idle ->
                AgentDetailStateScaffold { CircularProgressIndicator(color = AppColors.appPrimary) }

            else -> AgentDetailStateScaffold {
                NotFoundView(
                    message = (store.snapshotLoadState as? LoadState.Failed)?.message,
                    onRetry = { scope.launch { refreshDetail() } },
                )
            }
        }

        focusStartIndex?.let { start ->
            AgentPickFocusView(
                items = store.activeBetItems,
                accent = agentTint,
                startIndex = start,
                printIntro = false,
                onAudit = { pick -> auditStore.present(pick) },
                onClose = { focusStartIndex = null },
            )
        }
    }

    if (auditStore.isPresented) {
        auditStore.selectedPick?.let { pick ->
            AgentPickPayloadAuditSheet(pick = pick, payload = auditStore.payload, onDismiss = { auditStore.dismiss() })
        }
    }

    if (showHistorySheet) {
        PickHistorySheet(
            items = store.fullBetHistory,
            agentName = agent?.name ?: "Agent",
            agentColor = agentTint,
            onDismiss = { showHistorySheet = false },
        )
    }

    errorMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { errorMessage = null },
            title = { Text("Error") },
            text = { Text(msg) },
            confirmButton = { TextButton(onClick = { errorMessage = null }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}

@Composable
private fun PublicPicksSection(store: AgentDetailStore, canSeePicks: Boolean, accent: Color, onTapItem: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 28.dp)) {
        AgentSectionHeader(title = "Today's Picks", systemImage = "checklist")
        Spacer(Modifier.height(12.dp))
        when {
            !canSeePicks -> AgentLockedPicksRail(accent = accent)
            store.snapshotLoadState is LoadState.Loading && store.activeBetItems.isEmpty() -> AgentTodaysPicksRailSkeleton()
            store.activeBetItems.isEmpty() -> Column(
                Modifier.fillMaxWidth().padding(vertical = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(agentSymbol("calendar.badge.exclamationmark"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.height(28.dp))
                Spacer(Modifier.height(10.dp))
                Text("No picks yet today", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
            }
            else -> AgentTodaysPicksRail(
                items = store.activeBetItems,
                accent = accent,
                onTapPick = { pick -> store.activeBetItems.indexOfFirst { it.id == AgentBetItem.Pick(pick).id }.takeIf { it >= 0 }?.let(onTapItem) },
                onTapParlay = { parlay -> store.activeBetItems.indexOfFirst { it.id == AgentBetItem.Parlay(parlay).id }.takeIf { it >= 0 }?.let(onTapItem) },
            )
        }
    }
}

@Composable
private fun PublicPerformanceSection(
    store: AgentDetailStore,
    canSeePicks: Boolean,
    agentColor: Color,
    preferredSports: List<com.wagerproof.core.models.AgentSport>,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 28.dp)) {
        AgentSectionHeader(title = "Performance", systemImage = "chart.line.uptrend.xyaxis")
        Spacer(Modifier.height(12.dp))
        when {
            !canSeePicks -> Column(
                Modifier.fillMaxWidth().padding(vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(agentSymbol("lock.fill"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.height(26.dp))
                Spacer(Modifier.height(8.dp))
                Text("Upgrade to view pick charts", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
            }
            isPerformanceSettling(store) -> AgentPerformanceChartSkeleton()
            else -> AgentPerformanceCharts(
                items = store.performancePicks.map { AgentBetItem.Pick(it) } + store.performanceParlays.map { AgentBetItem.Parlay(it) },
                preferredSports = preferredSports,
                agentColor = agentColor,
                showsTitle = false,
            )
        }
    }
}

@Composable
private fun FollowButton(isFollowing: Boolean, busy: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (isFollowing) AppColors.appBorder.copy(alpha = 0.5f) else AppColors.brandGreenBright, shape)
            .border(if (isFollowing) 2.dp else 0.dp, if (isFollowing) AppColors.brandGreenBright else Color.Transparent, shape)
            .clickable(enabled = !busy, onClick = onClick)
            .padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val fg = if (isFollowing) AppColors.brandGreenBright else Color.White
        if (busy) {
            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.height(18.dp).width(18.dp))
        } else {
            Icon(agentSymbol(if (isFollowing) "checkmark" else "plus"), contentDescription = null, tint = fg, modifier = Modifier.height(18.dp))
        }
        Spacer(Modifier.width(8.dp))
        Text(if (isFollowing) "Following" else "Follow", color = fg, fontSize = 15.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun OwnAgentBanner() {
    Row(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appWin.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(agentSymbol("person.crop.circle.badge.checkmark"), contentDescription = null, tint = AppColors.appWin, modifier = Modifier.height(18.dp))
        Spacer(Modifier.width(8.dp))
        Text("This is your agent", color = AppColors.appWin, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun Disclaimer(modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().padding(top = 0.dp), verticalAlignment = Alignment.Top) {
        Icon(agentSymbol("info.circle"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.height(12.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            "AI agents analyze data — they do not constitute betting advice. Verify independently and wager responsibly.",
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
        )
    }
}

@Composable
private fun NotFoundView(message: String?, onRetry: () -> Unit) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(agentSymbol("person.crop.circle.badge.exclamationmark"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.height(36.dp))
        Spacer(Modifier.height(12.dp))
        Text(if (message == null) "Agent not found" else "Couldn't load this agent", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        message?.let {
            Spacer(Modifier.height(4.dp))
            Text(it, color = AppColors.appTextSecondary, fontSize = 13.sp)
            TextButton(onClick = onRetry) { Text("Try Again") }
        }
    }
}
