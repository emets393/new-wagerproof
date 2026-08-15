package com.wagerproof.app.features.agents

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
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
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.components.AgentGenerationCard
import com.wagerproof.app.features.agents.components.AgentGlassHero
import com.wagerproof.app.features.agents.components.AgentLockedPicksRail
import com.wagerproof.app.features.agents.components.AgentPixelWaveBackground
import com.wagerproof.app.features.agents.components.AgentPerformanceChartSkeleton
import com.wagerproof.app.features.agents.components.AgentPerformanceCharts
import com.wagerproof.app.features.agents.components.AgentPickFocusView
import com.wagerproof.app.features.agents.components.AgentPickFeedbackCard
import com.wagerproof.app.features.agents.components.AgentPickFolderCard
import com.wagerproof.app.features.agents.components.AgentPickPayloadAuditWidget
import com.wagerproof.app.features.agents.components.AgentTimeline
import com.wagerproof.app.features.agents.components.AgentTodaysPicksRail
import com.wagerproof.app.features.agents.components.AgentTodaysPicksRailSkeleton
import com.wagerproof.app.features.agents.components.PickHistorySheet
import com.wagerproof.app.features.agents.sheets.AgentRunSummaryRow
import com.wagerproof.app.features.agents.sheets.AutoPilotBottomSheet
import com.wagerproof.app.features.agents.sheets.AutoPilotControlButton
import com.wagerproof.app.features.agents.sheets.RegenerateBottomSheet
import com.wagerproof.app.features.agents.sheets.RegenerateControlButton
import com.wagerproof.app.features.components.WidgetCard
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.core.design.components.LiquidGlassScene
import com.wagerproof.core.design.backgrounds.GlyphRippleEmitter
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentPickAuditPayload
import com.wagerproof.core.services.NotificationService
import com.wagerproof.core.stores.AgentDetailStore
import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.AgentPicksSeenStore
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch

/** Near-black base under the animated pixelwave (matches iOS `0x0B1011`). */
internal val AgentDetailBase = Color(0xFF0B1011)

/** Wider gap between the container-less detail sections (iOS `sectionGap`). */
private val SectionGap = AgentTicketGeometry.SECTION_GAP

/** Horizontal inset for the inline sections (iOS `WidgetCard.hInset`). */
private val HInset = 16.dp

/**
 * Agent detail. iOS `AgentDetailView` (owner) / `PublicAgentDetailView` (public).
 * MainScaffold always calls this signature; `isPublic` selects the surface.
 *
 * FIDELITY-WAIVER #320: Compose has no `CollapsingWidgetScroll` primitive — the
 * 196→60 collapsing hero is approximated with a scroll-driven fixed hero height
 * over a scrolling content column (see [AgentDetailScaffold]).
 */
@Composable
fun AgentDetailScreen(agentId: String, isPublic: Boolean, modifier: Modifier = Modifier) {
    LiquidGlassScene { sourceModifier ->
        Box(modifier.fillMaxSize().then(sourceModifier)) {
            if (isPublic) {
                PublicAgentDetailScreen(agentId, Modifier.fillMaxSize())
            } else {
                OwnerAgentDetail(agentId, Modifier.fillMaxSize())
            }
        }
    }
}

@Composable
private fun OwnerAgentDetail(agentId: String, modifier: Modifier) {
    val graph = appGraph()
    val auth = graph.auth
    val proAccess = graph.proAccess
    val nav = LocalAppNavigator.current
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    val context = LocalContext.current

    var notificationDeniedAlert by remember { mutableStateOf(false) }
    // Bridges the launcher's callback (fires later, off the composition that
    // requested it) back to the suspend call the AutoPilot sheet is awaiting —
    // without this, onEnableNotifications returns the instant .launch() fires
    // and the sheet's busy spinner clears before the OS dialog is even answered.
    val pendingPermissionResult = remember { mutableStateOf<CompletableDeferred<Boolean>?>(null) }

    // POST_NOTIFICATIONS runtime request (Android 13+) for the AutoPilot sheet's
    // notifications card — mirrors SettingsScreen's launcher (the store only
    // reads the OS status; the actual request must come from the UI).
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        scope.launch {
            graph.settings.refreshNotificationPermission()
            if (granted) {
                (auth.phase as? AuthStore.Phase.Authenticated)?.userId?.let { graph.settings.enableNotifications(it) }
            } else {
                notificationDeniedAlert = true
            }
        }
        pendingPermissionResult.value?.complete(granted)
        pendingPermissionResult.value = null
    }
    LaunchedEffect(Unit) { graph.settings.refreshNotificationPermission() }

    val entitlements = AgentEntitlementsStore(proAccess)
    // App-scoped, NOT remembered: a generation run polls for minutes and must
    // survive this screen being disposed by a back-press or tab switch (AND-082).
    val store = remember(agentId) { graph.agentDetailStores.store(agentId) }
    // The app-graph store, NOT a local one: PickHistoryFolder presents through the
    // singleton, so a second instance here could hold a divergent selected pick.
    val auditStore = graph.agentPickAudit
    val rippleEmitter = remember { GlyphRippleEmitter() }

    var showHistorySheet by remember { mutableStateOf(false) }
    var showRegenSheet by remember { mutableStateOf(false) }
    var showAutoPilotSheet by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var focusStartIndex by remember { mutableStateOf<Int?>(null) }
    var focusPrintIntro by remember { mutableStateOf(false) }
    var lastGenerationResultItems by remember { mutableStateOf<List<AgentBetItem>>(emptyList()) }
    var pendingDeleteItem by remember { mutableStateOf<AgentBetItem?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }

    val currentUserId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId?.lowercase()
    val agent: Agent? = store.snapshot?.agent
    val isOwnAgent = currentUserId != null && agent?.userId?.lowercase() == currentUserId
    val canViewPicks = entitlements.canViewAgentPicks
    val canSeePicks = canViewPicks || isOwnAgent
    val canRegenerate = if (!canViewPicks) entitlements.isAdmin else store.regenerationsRemaining() > 0
    val agentTint = agent?.let { AgentColorPalette.primary(it.avatarColor) } ?: AppColors.brandGreenBright
    val isAnyGenerating = store.isGenerating || store.isGenerationRequested
    // The weekly pass hogs the agent: while it runs, a daily regenerate must stay
    // blocked even though the daily quota still has runs left (iOS AgentDetailView:175).
    val isWeeklyGenerating = store.isGenerating &&
        store.generatingWindow == AgentDetailStore.GenerationWindow.Week
    val hasFootball = agent?.preferredSports?.any {
        it == com.wagerproof.core.models.AgentSport.NFL || it == com.wagerproof.core.models.AgentSport.CFB
    } == true
    val canGenerateWeekly = (canViewPicks || entitlements.isAdmin) &&
        store.weeklyGenerationsRemaining() > 0 &&
        agent?.personalityParams?.weeklyParlayEnabled == true &&
        hasFootball

    fun markPicksSeen() {
        val newest = store.activeBetItems.mapNotNull { it.createdAt.ifEmpty { null } }.maxOrNull()
        val upTo = listOfNotNull(newest, agent?.lastGeneratedAt).maxOrNull()
        AgentPicksSeenStore.markSeen(agentId, upTo)
    }

    fun maybeAutoplayUnreadPicks() {
        if (!canSeePicks || focusStartIndex != null || isAnyGenerating) return
        val items = store.activeBetItems
        val newest = items.mapNotNull { it.createdAt.ifEmpty { null } }.maxOrNull()
        if (newest == null) {
            markPicksSeen()
            return
        }
        if (AgentPicksSeenStore.hasUnread(agentId, newest)) {
            lastGenerationResultItems = items
            focusPrintIntro = true
            focusStartIndex = 0
        }
        markPicksSeen()
    }

    // Fire-and-forget: the run lives on the app-scoped store, not on this
    // composition's scope, so it keeps polling (and still posts the "picks are
    // ready" notification) if the user backs out or switches tabs mid-run.
    // Outcome arrives via the store.generationCompletions effect below.
    fun startGeneration() = store.startGeneration(includeWeekly = canGenerateWeekly)

    fun finishFocusPresentation() {
        val viewedFreshGeneration = focusPrintIntro && lastGenerationResultItems.isNotEmpty()
        focusStartIndex = null
        focusPrintIntro = false
        // The audit store is app-scoped now, so leaving it presented would hand a
        // stale sheet to the next surface that reads it (PickHistoryFolder).
        auditStore.dismiss()
        if (viewedFreshGeneration) {
            graph.reviewPrompts.recordGeneratedPicksViewed()
        }
    }

    suspend fun refreshDetail() {
        isRefreshing = true
        try {
            store.refreshSnapshot()
            if (canSeePicks) {
                store.loadHistory(isOwner = isOwnAgent)
                store.loadPerformancePicks(isOwner = isOwnAgent)
            }
        } finally {
            isRefreshing = false
        }
    }

    // Sole loader — re-runs when picks-visibility / ownership / user identity flip.
    val historyReloadKey = "$agentId-$canSeePicks-$isOwnAgent-${currentUserId ?: ""}"
    LaunchedEffect(agentId) {
        graph.reviewPrompts.recordAgentDetailViewed(agentId)
    }
    LaunchedEffect(historyReloadKey) {
        // The store is app-scoped, so `snapshot` usually survives from a previous
        // visit — re-fetch on entry rather than showing stale picks. Skipped while
        // a run is live: that poll owns the snapshot until it finishes.
        if (!store.hasRunInFlight) store.refreshSnapshot()
        if (canSeePicks) {
            store.loadHistory(isOwner = isOwnAgent)
            store.loadPerformancePicks(isOwner = isOwnAgent)
        }
        store.startResumeIfNeeded()
        maybeAutoplayUnreadPicks()
    }

    // React to a run FINISHING while we happen to be on screen. Seeded from the
    // store's current value so re-entering after an off-screen completion doesn't
    // replay the printer overlay — `maybeAutoplayUnreadPicks` owns that case.
    var seenCompletions by remember(agentId) { mutableStateOf(store.generationCompletions) }
    LaunchedEffect(store.generationCompletions) {
        if (store.generationCompletions == seenCompletions) return@LaunchedEffect
        seenCompletions = store.generationCompletions
        val failure = store.lastGenerationError
        failure?.let { errorMessage = it }
        val fresh = store.activeBetItems
        // Only a SUCCESSFUL run earns the printer cinematic (iOS reveals inside the
        // `succeeded` branch). Otherwise a failed run replays the whole reveal over
        // pre-existing picks while the error dialog sits on top of it.
        if (failure == null && fresh.isNotEmpty()) {
            lastGenerationResultItems = fresh
            focusPrintIntro = true
            focusStartIndex = 0
        }
        markPicksSeen()
    }

    Box(modifier.fillMaxSize().background(AgentDetailBase)) {
        if (agent == null) {
            AgentDetailStateScaffold {
                when (val load = store.snapshotLoadState) {
                    is LoadState.Failed -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(agentSymbol("person.crop.circle.badge.exclamationmark"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.height(36.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("Couldn't load this agent", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(4.dp))
                        Text(load.message, color = AppColors.appTextSecondary, fontSize = 13.sp)
                        androidx.compose.material3.TextButton(onClick = { scope.launch { refreshDetail() } }) { Text("Try Again") }
                    }
                    else -> CircularProgressIndicator(color = AppColors.appPrimary)
                }
            }
        } else {
            AgentDetailScaffold(
                avatarColorRaw = agent.avatarColor,
                rippleEmitter = rippleEmitter,
                topBar = {
                    // No title — the hero already shows the agent name, so a bar title
                    // just duplicates it in the expanded state (iOS AgentDetailView:117-120).
                    AgentDetailTopBar(onSettings = { nav.openAgentEdit(agentId) })
                },
                isRefreshing = isRefreshing,
                onRefresh = { scope.launch { refreshDetail() } },
                hero = { progress ->
                    AgentGlassHero(
                        agent = agent,
                        performance = store.snapshot?.performance,
                        lockedNetUnits = !canSeePicks,
                        progress = progress,
                        isGenerating = store.isGenerating,
                        onAvatarTap = { offset: Offset ->
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            rippleEmitter.emit(offset)
                        },
                        modifier = Modifier.padding(horizontal = 16.dp).padding(top = 6.dp),
                    )
                },
            ) {
            // Today's Picks
            OwnerPicksSection(
                store = store,
                canSeePicks = canSeePicks,
                accent = agentTint,
                spriteIndex = agent.spriteIndex,
                isAnyGenerating = isAnyGenerating,
                canRegenerate = canRegenerate,
                generationLabel = when {
                    !canViewPicks -> "Generate Picks Locked"
                    isWeeklyGenerating -> "Agent is busy…"
                    store.regenerationsRemaining() == 0 -> "Daily limit reached"
                    else -> "Generate Today's Picks"
                },
                isOwnAgent = isOwnAgent,
                autoOn = agent.autoGenerate,
                onTapItem = { idx -> focusPrintIntro = false; focusStartIndex = idx },
                onGenerate = { startGeneration() },
                onAutoPilot = { showAutoPilotSheet = true },
                onRegenerate = { showRegenSheet = true },
            )
            // Performance
            PerformanceSection(store = store, canSeePicks = canSeePicks, agentColor = agentTint, preferredSports = agent.preferredSports)
            // Recent Activity
            AgentTimeline(
                agent = agent,
                performance = store.snapshot?.performance,
                todaysPicks = store.todaysPicks,
                todaysParlays = store.todaysParlays,
                todaysRun = store.todaysGenerationRun,
                modifier = Modifier.padding(horizontal = HInset).padding(bottom = SectionGap),
            )
            // Pick History
            AgentPickFolderCard(
                recentItems = if (canSeePicks) store.fullBetHistory else emptyList(),
                totalCount = store.fullBetHistory.size,
                loading = canSeePicks && isHistoryLoading(store) && store.fullBetHistory.isEmpty(),
                locked = !canSeePicks,
                agentColor = agentTint,
                onTap = { showHistorySheet = true },
                modifier = Modifier.padding(horizontal = HInset).padding(bottom = SectionGap),
            )
            AgentPickFeedbackCard(
                userId = currentUserId,
                agent = agent,
                items = store.activeBetItems.ifEmpty { store.fullBetHistory.take(20) },
                modifier = Modifier.padding(horizontal = HInset).padding(bottom = SectionGap),
            )
            }
        }

        // Full-screen focus / printer overlay.
        focusStartIndex?.let { start ->
            // The printer reveal freezes lastGenerationResultItems' order, but a ticket
            // deleted mid-overlay must still disappear — filter the snapshot against the
            // live store by id instead of trusting it outright.
            val items = if (focusPrintIntro) {
                val liveIds = store.activeBetItems.mapTo(HashSet()) { it.id }
                lastGenerationResultItems.filter { it.id in liveIds }
            } else {
                store.activeBetItems
            }
            AgentPickFocusView(
                items = items,
                accent = agentTint,
                startIndex = start,
                printIntro = focusPrintIntro,
                onAudit = { pick -> auditStore.present(pick) },
                onDelete = if (isOwnAgent) ({ item -> pendingDeleteItem = item }) else null,
                onClose = ::finishFocusPresentation,
            )
        }
    }

    // --- Sheets --------------------------------------------------------------

    // Scoped to the focus overlay, which is this screen's ONLY audit presenter (iOS
    // hangs the same sheet off the fullScreenCover). PickHistoryFolder renders its own
    // sheet from the shared store, so an unscoped one here would double up — also gate on
    // the history sheet being closed, since a generation can complete (arming the focus
    // overlay's audit) while the history sheet is still the one on screen.
    if (focusStartIndex != null && auditStore.isPresented && !showHistorySheet) {
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

    if (showRegenSheet) {
        RegenerateBottomSheet(
            remaining = store.regenerationsRemaining(),
            maxDaily = 3,
            accent = agentTint,
            canRegenerate = canRegenerate && !isWeeklyGenerating,
            onRequest = { showRegenSheet = false; startGeneration() },
            onDismiss = { showRegenSheet = false },
        )
    }

    if (showAutoPilotSheet) {
        val recentRuns = remember(store.performancePicks, store.todaysPicks, store.todaysGenerationRun) {
            val seen = HashSet<String>()
            val merged = (store.performancePicks + store.todaysPicks).filter { seen.add(it.id) }
            AgentRunSummaryRow.derive(picks = merged, todaysRun = store.todaysGenerationRun, todayStr = AgentRunSummaryRow.todayString())
        }
        AutoPilotBottomSheet(
            agentName = agent?.name ?: "This agent",
            accent = agentTint,
            canUseAutopilot = entitlements.canUseAutopilot,
            remaining = store.regenerationsRemaining(),
            maxDaily = 3,
            initialAutoOn = agent?.autoGenerate ?: false,
            initialTime = agent?.autoGenerateTime ?: "09:00",
            initialTimezone = agent?.autoGenerateTimezone ?: "America/New_York",
            notificationsEnabled = graph.settings.notificationPermission.isEnabled,
            recentRuns = recentRuns,
            onSetAuto = { value -> store.setAutoGenerate(value) },
            onSaveTime = { time, tz -> store.setAutoGenerateTime(time, tz) },
            onEnableNotifications = {
                val granted = NotificationService.permissionStatus() == NotificationService.PermissionStatus.GRANTED
                when {
                    granted -> currentUserId?.let { graph.settings.enableNotifications(it) }
                    Build.VERSION.SDK_INT >= 33 -> {
                        // Await the launcher's callback so the sheet's busy spinner stays up
                        // for the actual duration of the OS permission dialog.
                        val deferred = CompletableDeferred<Boolean>()
                        pendingPermissionResult.value = deferred
                        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        deferred.await()
                    }
                    else -> {
                        // Pre-13: nothing to request at runtime — blocked at the
                        // channel level, so send the user to system settings.
                        notificationDeniedAlert = true
                    }
                }
            },
            onDismiss = { showAutoPilotSheet = false },
        )
    }

    if (notificationDeniedAlert) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { notificationDeniedAlert = false },
            title = { Text("Notifications Disabled") },
            text = { Text("Push notifications are blocked. Open Settings to enable them.") },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = {
                    notificationDeniedAlert = false
                    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    runCatching { context.startActivity(intent) }
                }) { Text("Open Settings") }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { notificationDeniedAlert = false }) { Text("Cancel") }
            },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    errorMessage?.let { msg ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { errorMessage = null },
            title = { Text("Error") },
            text = { Text(msg) },
            confirmButton = { androidx.compose.material3.TextButton(onClick = { errorMessage = null }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    pendingDeleteItem?.let { item ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { pendingDeleteItem = null },
            title = { Text(if (item is AgentBetItem.Parlay) "Delete this parlay?" else "Delete this pick?") },
            text = { Text("It will be removed from ${agent?.name ?: "this agent"}'s record.") },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = {
                    pendingDeleteItem = null
                    // The focus overlay stays up on the remaining plays — deleting one
                    // ticket shouldn't eject the user from the pager (iOS:230-236).
                    scope.launch {
                        if (!store.deleteBetItem(item)) errorMessage = store.lastDeleteError
                    }
                }) { Text("Delete", color = AppColors.appLoss) }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { pendingDeleteItem = null }) { Text("Cancel") }
            },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}

@Composable
internal fun AgentDetailStateScaffold(content: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().background(AgentDetailBase)) {
        AgentDetailTopBar()
        Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { content() }
        Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.navigationBars))
    }
}

// ---------------------------------------------------------------------------
// Owner sections
// ---------------------------------------------------------------------------

@Composable
private fun OwnerPicksSection(
    store: AgentDetailStore,
    canSeePicks: Boolean,
    accent: Color,
    spriteIndex: Int,
    isAnyGenerating: Boolean,
    canRegenerate: Boolean,
    generationLabel: String,
    isOwnAgent: Boolean,
    autoOn: Boolean,
    onTapItem: (Int) -> Unit,
    onGenerate: () -> Unit,
    onAutoPilot: () -> Unit,
    onRegenerate: () -> Unit,
) {
    // No horizontal inset on the SECTION — the rails carry their own leading inset
    // as scroll content so tickets keep scrolling under the screen edge (iOS cancels
    // the section inset with `.padding(.horizontal, -WidgetCard.hInset)`). Everything
    // that isn't a rail re-applies [HInset] itself.
    Column(Modifier.fillMaxWidth().padding(bottom = SectionGap)) {
        // AutoPilot lives in the header, not the rail footer (iOS AgentDetailView:292-302).
        // The footer placement hid the schedule picker + Recent Runs behind "already has
        // picks", so a brand-new agent, one that passed on the slate, one mid-generation
        // or a locked non-Pro view could never reach autopilot. Owner-only: autopilot
        // configures the OWNER's daily runs, so it hides on someone else's agent.
        AgentSectionHeader(
            title = "Today's Picks",
            systemImage = "checklist",
            modifier = Modifier.padding(horizontal = HInset),
            trailing = if (isOwnAgent) ({ AutoPilotControlButton(isOn = autoOn, accent = accent, onClick = onAutoPilot) }) else null,
        )
        Spacer(Modifier.height(12.dp))

        val showsPicksRail = store.activeBetItems.isNotEmpty() && !isAnyGenerating
        when {
            !canSeePicks -> AgentLockedPicksRail(accent = accent)
            store.snapshotLoadState is LoadState.Loading && store.todaysPicks.isEmpty() ->
                AgentTodaysPicksRailSkeleton()
            // Rail ↔ generation card dissolve IN PLACE in one top-anchored slot, rather
            // than hard-swapping components under a fixed header (iOS:317-331). Scoped
            // to this slot only — the in-card idle→polling morph stays AgentGenerationCard's.
            else -> Crossfade(
                targetState = showsPicksRail,
                animationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing),
                label = "picksSlot",
            ) { showsRail ->
                if (showsRail) {
                    Column(Modifier.fillMaxWidth()) {
                        AgentTodaysPicksRail(
                            items = store.activeBetItems,
                            accent = accent,
                            onTapPick = { pick -> store.activeBetItems.indexOfFirst { it.id == AgentBetItem.Pick(pick).id }.takeIf { it >= 0 }?.let(onTapItem) },
                            onTapParlay = { parlay -> store.activeBetItems.indexOfFirst { it.id == AgentBetItem.Parlay(parlay).id }.takeIf { it >= 0 }?.let(onTapItem) },
                        )
                        Spacer(Modifier.height(12.dp))
                        androidx.compose.foundation.layout.Row(
                            Modifier.fillMaxWidth().padding(horizontal = HInset).padding(top = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.End,
                        ) {
                            RegenerateControlButton(remaining = store.regenerationsRemaining(), accent = accent, enabled = canRegenerate, onClick = onRegenerate)
                        }
                    }
                } else {
                    AgentGenerationCard(
                        spriteIndex = spriteIndex,
                        accent = accent,
                        // Nil unless a run is actually live — a stale terminal state
                        // would otherwise render the idle card as a finished run.
                        state = if (store.isGenerating) store.liveRunState else null,
                        isGenerating = isAnyGenerating,
                        canGenerate = canRegenerate,
                        lockedLabel = generationLabel,
                        conclusion = noPicksConclusion(store),
                        onGenerate = onGenerate,
                        modifier = Modifier.padding(horizontal = HInset),
                    )
                }
            }
        }
    }
}

@Composable
private fun PerformanceSection(
    store: AgentDetailStore,
    canSeePicks: Boolean,
    agentColor: Color,
    preferredSports: List<com.wagerproof.core.models.AgentSport>,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = HInset).padding(bottom = SectionGap)) {
        AgentSectionHeader(title = "Performance", systemImage = "chart.line.uptrend.xyaxis")
        Spacer(Modifier.height(12.dp))
        if (!canSeePicks) {
            Column(
                Modifier.fillMaxWidth().padding(vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(agentSymbol("lock.fill"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.height(26.dp))
                Spacer(Modifier.height(8.dp))
                Text("Upgrade to view pick charts", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary)
            }
        } else {
            // Skeleton → chart is one smooth reveal, not a hard swap (iOS:492/503/509).
            Crossfade(
                targetState = isPerformanceSettling(store),
                animationSpec = tween(durationMillis = 250, easing = LinearOutSlowInEasing),
                label = "performanceSlot",
            ) { settling ->
                if (settling) {
                    AgentPerformanceChartSkeleton()
                } else {
                    AgentPerformanceCharts(
                        items = store.performancePicks.map { AgentBetItem.Pick(it) } + store.performanceParlays.map { AgentBetItem.Parlay(it) },
                        preferredSports = preferredSports,
                        agentColor = agentColor,
                        showsTitle = false,
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Shared scaffold + helpers (used by owner + public)
// ---------------------------------------------------------------------------

/**
 * One coordinated collapsing surface, matching iOS `CollapsingWidgetScroll`:
 * the content starts below the expanded hero, then travels beneath a hero that
 * contracts to its 60dp pinned state. The old split-scroll layout made the
 * detail body feel like a second panel and could never achieve the iOS handoff.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AgentDetailScaffold(
    avatarColorRaw: String,
    rippleEmitter: GlyphRippleEmitter,
    hero: @Composable (progress: Float) -> Unit,
    topBar: @Composable () -> Unit = {},
    isRefreshing: Boolean = false,
    onRefresh: () -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    val scroll = rememberScrollState()
    val density = LocalDensity.current
    val collapsePx = remember(density) {
        with(density) { (AgentTicketGeometry.HERO_MAX - AgentTicketGeometry.HERO_MIN).toPx() }
    }
    val progress = if (collapsePx <= 0f) 0f else (scroll.value / collapsePx).coerceIn(0f, 1f)
    val heroHeight = lerp(AgentTicketGeometry.HERO_MAX, AgentTicketGeometry.HERO_MIN, progress)
    // The nav row floats OVER the hero (iOS hides the nav-bar background so the aura
    // glows to the very top behind the back button), so its height has to be known to
    // place the hero content and the scroll content. Seeded with the real geometry —
    // status bar + the row's 48dp icon button + 2×4dp — then corrected by measurement.
    val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    var topBarHeight by remember(statusBarTop) { mutableStateOf(statusBarTop + 56.dp) }
    val refreshState = rememberPullToRefreshState()

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        state = refreshState,
        modifier = Modifier.fillMaxSize(),
        indicator = {
            // Park the spinner under the floating nav row, not under the status bar.
            PullToRefreshDefaults.Indicator(
                state = refreshState,
                isRefreshing = isRefreshing,
                modifier = Modifier.align(Alignment.TopCenter).padding(top = topBarHeight),
            )
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            // Page field — full bleed, behind the status bar and the nav row.
            AgentPixelWaveBackground(
                avatarColor = avatarColorRaw,
                progress = progress,
                modifier = Modifier.fillMaxSize(),
                rippleEmitter = rippleEmitter,
            )
            Column(
                Modifier.fillMaxSize().verticalScroll(scroll),
            ) {
                // Content starts below the fully expanded hero PLUS the standard card
                // gap, so the first section sits a hair under the hero (iOS:76).
                Spacer(Modifier.height(topBarHeight + AgentTicketGeometry.HERO_MAX + WidgetCard.gap))
                content()
                Spacer(Modifier.height(24.dp))
                Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.navigationBars))
            }
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(topBarHeight + heroHeight)
                    // Clip, or the ~196dp expanded header keeps drawing over the page
                    // while its band shrinks past it (iOS clips the hero overlay).
                    .clipToBounds(),
            ) {
                // A SECOND, screen-anchored copy of the same field is what actually
                // masks the scrolling content: its base is opaque and both copies paint
                // identical pixels, so the seam at the hero's edge is invisible. A
                // translucent scrim can't do this — content shows straight through it.
                AgentPixelWaveBackground(
                    avatarColor = avatarColorRaw,
                    progress = progress,
                    modifier = Modifier.fillMaxSize(),
                    rippleEmitter = rippleEmitter,
                )
                Box(Modifier.padding(top = topBarHeight)) { hero(progress) }
            }
            // Transparent nav row, drawn last so the back button stays on top of the hero.
            Box(Modifier.fillMaxWidth().onSizeChanged { topBarHeight = with(density) { it.height.toDp() } }) {
                topBar()
            }
        }
    }
}

/** Safe inline navigation bar matching iOS detail title geometry. */
@Composable
internal fun AgentDetailTopBar(title: String? = null, onSettings: (() -> Unit)? = null) {
    val nav = LocalAppNavigator.current
    androidx.compose.foundation.layout.Row(
        Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = { nav.popAgents() }) {
            Icon(agentSymbol("chevron.left"), contentDescription = "Back", tint = Color.White)
        }
        Text(
            title.orEmpty(),
            color = Color.White,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        if (onSettings != null) {
            IconButton(onClick = onSettings) {
                Icon(agentSymbol("gearshape"), contentDescription = "Settings", tint = Color.White)
            }
        } else {
            Spacer(Modifier.width(48.dp))
        }
    }
}

/** Modal wrapper around [AgentPickPayloadAuditWidget] (iOS `AgentPickPayloadAuditSheet`). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AgentPickPayloadAuditSheet(pick: AgentPick, payload: AgentPickAuditPayload, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AgentDetailBase) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
            Text("Pick Audit", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(12.dp))
            AgentPickPayloadAuditWidget(pick = pick, payload = payload)
            Spacer(Modifier.height(24.dp))
        }
    }
}

internal fun isHistoryLoading(store: AgentDetailStore): Boolean =
    store.historyLoadState is LoadState.Loading || store.performanceLoadState is LoadState.Loading

/** First-load skeleton gate: empty perf + idle/loading = still settling. */
internal fun isPerformanceSettling(store: AgentDetailStore): Boolean {
    if (store.performancePicks.isNotEmpty() || store.performanceParlays.isNotEmpty()) return false
    return when (store.performanceLoadState) {
        is LoadState.Idle, is LoadState.Loading -> true
        else -> false
    }
}

internal fun noPicksConclusion(store: AgentDetailStore): String? {
    val run = store.todaysGenerationRun ?: return null
    if (run.picksGenerated != 0) return null
    if (run.noGames) return "No games were available in this agent's preferred sports today."
    if (run.weakSlate) return "This agent skipped today because the slate was too weak for its settings."
    return run.slateNote ?: "The agent completed its analysis and passed on the slate."
}
