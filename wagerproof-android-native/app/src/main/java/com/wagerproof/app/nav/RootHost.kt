package com.wagerproof.app.nav

import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.auth.AuthGateScreen
import com.wagerproof.app.features.auth.ResetPasswordScreen
import com.wagerproof.app.features.onboarding.OnboardingScreen
import com.wagerproof.app.features.paywall.PostOnboardingPaywall
import com.wagerproof.app.features.shared.SplashScreen
import com.wagerproof.app.widgets.WidgetSyncCoordinator
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.RootRouter
import com.wagerproof.core.stores.DeepLinkRoute
import com.wagerproof.core.services.NotificationService
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import com.google.android.play.core.ktx.launchReview
import com.google.android.play.core.ktx.requestReview
import com.google.android.play.core.review.ReviewManagerFactory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch

/**
 * Top-level phase switch — the Android port of iOS `RootView` (doc 08 §1.2).
 * Renders one of splash / auth gate / onboarding / main shell off
 * [RootRouter.phase], and owns the auth-reactive side effects that iOS runs from
 * `WagerproofApp.body` (session restore, per-user attach, router resolve, RC +
 * admin-role attach, deep-link consumption).
 */
@Composable
fun RootHost(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val activity = LocalActivity.current
    val router = graph.rootRouter
    val authPhase = graph.auth.phase
    val onboardingComplete = graph.onboarding.isComplete
    val revenueCatEntitlementStatus = graph.revenueCat.entitlementStatus
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var resetPasswordPresented by remember { mutableStateOf(false) }
    var paywallDismissed by remember { mutableStateOf(false) }

    /**
     * Mirror of the paywall's resolved `paywall_close_enabled` metadata flag
     * (AND-002). Starts false so back is swallowed while the offering is still
     * loading — the hard gate is the default, and a soft gate arriving a moment
     * late is far better than a hard gate that back walks straight through.
     */
    var paywallCloseEnabled by remember { mutableStateOf(false) }

    // iOS `body.task`: start the Supabase auth listener once. Idempotent.
    LaunchedEffect(Unit) {
        graph.auth.start()
    }

    // iOS `onChange(of: authStore.phase)` — must run BEFORE the router resolves so
    // OnboardingView never flashes: attach/detach the per-user onboarding cache
    // synchronously, then resolve, then the async RC/admin work.
    LaunchedEffect(authPhase) {
        when (val phase = authPhase) {
            is AuthStore.Phase.Authenticated -> {
                val identityChanged = graph.revenueCat.prepareUserIdentity(phase.userId)
                if (identityChanged) {
                    WidgetSyncCoordinator.clearUserScopedWidgets(graph.application, phase.userId)
                }
                // App-scoped caches intentionally outlive their screens, so the
                // root auth boundary must own their user binding. bindUser also
                // clears detail polling on a direct account A → B transition.
                graph.agents.bind(phase.userId.lowercase())
                graph.topAgentPicks.bind(phase.userId.lowercase())
                graph.followedAgents.bind(phase.userId)
                graph.agentDetailStores.bindUser(phase.userId)
                graph.onboarding.attachUser(phase.userId)
                // Secret Settings' explicit onboarding replay must survive an
                // Android process recreation (including a crash mid-flow) so a
                // Pro/admin tester still reaches the custom paywall once. The
                // persisted owner is identity-scoped and cleared on sign-out,
                // dismissal or purchase.
                router.restoreTestPaywallOverride(phase.userId)
                router.resolve(phase, graph.onboarding.isComplete)
                graph.wagerBotChat.bind(phase.userId)
                graph.revenueCat.attachUser(phase.userId)
                graph.adminMode.checkRole(phase.userId)
                NotificationService.registerPushToken(phase.userId)
                WidgetSyncCoordinator.syncAll(graph.application, phase.userId)
            }
            is AuthStore.Phase.Unauthenticated -> {
                graph.agents.bind(null)
                graph.topAgentPicks.bind(null)
                graph.followedAgents.bind(null)
                graph.agentDetailStores.clear()
                graph.onboarding.detachUser()
                router.resolve(phase, onboardingComplete = false)
                graph.wagerBotChat.bind(null)
                graph.revenueCat.detachUser()
                WidgetSyncCoordinator.clearUserScopedWidgets(graph.application, nextUserId = null)
                graph.adminMode.reset()
            }
            is AuthStore.Phase.Launching -> router.resolve(phase, onboardingComplete = false)
        }
    }

    // iOS `onChange(of: onboardingStore.isComplete)` → re-resolve.
    LaunchedEffect(onboardingComplete) {
        (authPhase as? AuthStore.Phase.Authenticated)?.let {
            router.resolve(it, onboardingComplete)
        }
    }

    // iOS `MainTabView.onChange(of: rootRouter.phase / pendingDeepLinkRoute)` —
    // consume the buffered deep link once the shell is ready.
    LaunchedEffect(router.phase, router.pendingDeepLinkRoute) {
        when {
            router.pendingDeepLinkRoute == DeepLinkRoute.ResetPassword -> {
                router.consumePendingDeepLink()
                resetPasswordPresented = true
            }
            router.phase == RootRouter.Phase.Ready -> {
                router.consumePendingDeepLink()?.let { route -> graph.mainTab.apply(route) }
            }
        }
    }

    LaunchedEffect(authPhase) {
        if (authPhase is AuthStore.Phase.Unauthenticated) paywallDismissed = false
    }
    LaunchedEffect(router.testPaywallOverride) {
        if (router.testPaywallOverride) paywallDismissed = false
    }

    // Glance publishes RemoteViews snapshots; changing the App Group boolean is
    // not enough to retract a previously-rendered Parlay God card. Re-render on
    // every trusted grant/downgrade (and on identity invalidation) so the
    // launcher sees the current entitlement immediately.
    LaunchedEffect(revenueCatEntitlementStatus) {
        WidgetSyncCoordinator.refreshCachedWidgets(graph.application)
    }

    val requiresSubscriptionResolution = requiresSubscriptionResolution(
        phase = router.phase,
        authenticated = authPhase is AuthStore.Phase.Authenticated,
        hasResolvedActiveUserEntitlement = graph.revenueCat.hasResolvedActiveUserEntitlement,
        proAccessLoading = graph.proAccess.isLoading,
    )
    val shouldPresentPaywall = shouldPresentPostOnboardingPaywall(
        phase = router.phase,
        authenticated = authPhase is AuthStore.Phase.Authenticated,
        hasResolvedActiveUserEntitlement = graph.revenueCat.hasResolvedActiveUserEntitlement,
        proAccessLoading = graph.proAccess.isLoading,
        isPro = graph.proAccess.isPro,
        paywallDismissed = paywallDismissed,
        testPaywallOverride = router.testPaywallOverride,
    )
    val latestShouldPresentPaywall by rememberUpdatedState(shouldPresentPaywall)
    val latestResetPasswordPresented by rememberUpdatedState(resetPasswordPresented)
    val latestRequiresSubscriptionResolution by rememberUpdatedState(requiresSubscriptionResolution)
    val latestAuthPhase by rememberUpdatedState(authPhase)

    // A network failure remains visibly fail-closed, but returning to the app is
    // also an automatic retry opportunity. The explicit Retry action below is
    // still available when the process never leaves the foreground.
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            val account = latestAuthPhase as? AuthStore.Phase.Authenticated
            if (event == Lifecycle.Event.ON_RESUME &&
                account != null &&
                graph.rootRouter.phase == RootRouter.Phase.Ready &&
                !graph.revenueCat.hasResolvedActiveUserEntitlement &&
                !graph.revenueCat.isLoading &&
                graph.revenueCat.lastError != null
            ) {
                scope.launch { graph.revenueCat.attachUser(account.userId) }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // A value event only creates a pending request. The host then waits for a
    // quiet window and re-checks every presentation guard immediately before
    // claiming the attempt. Play may suppress its UI; that is still an attempt,
    // because the API deliberately exposes neither prompt visibility nor rating.
    LaunchedEffect(Unit) {
        snapshotFlow { graph.reviewPrompts.pendingRequest }
            .filterNotNull()
            .collect { request ->
                delay(REVIEW_QUIET_DELAY_MILLIS)
                val hostActivity = activity
                val processIsActive = ProcessLifecycleOwner.get().lifecycle.currentState
                    .isAtLeast(Lifecycle.State.STARTED)
                if (hostActivity == null ||
                    hostActivity.isFinishing ||
                    hostActivity.isDestroyed ||
                    !processIsActive ||
                    router.phase != RootRouter.Phase.Ready ||
                    latestShouldPresentPaywall ||
                    latestRequiresSubscriptionResolution ||
                    latestResetPasswordPresented
                ) {
                    graph.reviewPrompts.cancel(request)
                    return@collect
                }
                if (!graph.reviewPrompts.claim(request)) return@collect

                try {
                    val manager = ReviewManagerFactory.create(hostActivity)
                    val reviewInfo = manager.requestReview()
                    manager.launchReview(hostActivity, reviewInfo)
                } catch (cancellation: CancellationException) {
                    throw cancellation
                } catch (_: Exception) {
                    // Review failures are intentionally non-blocking. The value
                    // event still consumed an attempt before this API call.
                }
            }
    }

    Box(modifier.fillMaxSize().background(AppColors.appSurface)) {
        AnimatedContent(
            targetState = router.phase,
            transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(180)) },
            modifier = Modifier
                .fillMaxSize()
                .then(
                    if (shouldPresentPaywall || requiresSubscriptionResolution || resetPasswordPresented) {
                        // A sibling overlay blocks touch/back but does not remove
                        // the shell's semantics tree. Hide it while modal content
                        // is present so TalkBack cannot activate controls behind
                        // the hard gate.
                        Modifier.clearAndSetSemantics { }
                    } else {
                        Modifier
                    },
                ),
            label = "root-phase",
        ) { phase ->
            when (phase) {
                RootRouter.Phase.Launching -> SplashScreen()
                RootRouter.Phase.Unauthenticated -> AuthGateScreen()
                RootRouter.Phase.Onboarding -> OnboardingScreen()
                RootRouter.Phase.Ready -> MainScaffold()
            }
        }

        if (shouldPresentPaywall) {
            val dismissPaywall = {
                paywallDismissed = true
                router.clearTestPaywallOverride()
            }
            // Back does exactly what the paywall's own ✕ does — no more, no less,
            // INCLUDING not existing. The gate hardness is remote-configured
            // (`paywall_close_enabled`, default false = hard), and the paywall
            // reports the resolved value up here so the ✕ and back can't disagree:
            // a hard gate with a working back button is not a gate.
            //
            // The handler stays REGISTERED either way. Swallowing back is the
            // point — letting it fall through reaches MainScaffold's handler,
            // which is DISABLED at the Games tab root (exactly where a freshly
            // onboarded user lands), so back would finish the Activity.
            ModalOverlay(onBack = { if (paywallCloseEnabled) dismissPaywall() }) {
                PostOnboardingPaywall(
                    onUserDismissed = dismissPaywall,
                    onCloseEnabledChanged = { paywallCloseEnabled = it },
                )
            }
        }

        if (requiresSubscriptionResolution && !resetPasswordPresented) {
            val account = authPhase as? AuthStore.Phase.Authenticated
            ModalOverlay(onBack = {}) {
                SubscriptionResolutionOverlay(
                    isLoading = graph.revenueCat.isLoading || graph.revenueCat.lastError == null,
                    hasError = graph.revenueCat.lastError != null,
                    onRetry = {
                        if (account != null && !graph.revenueCat.isLoading) {
                            scope.launch { graph.revenueCat.attachUser(account.userId) }
                        }
                    },
                    onSignOut = {
                        if (account != null) {
                            scope.launch {
                                // Match every other logout path: leaving this
                                // device token active would keep delivering the
                                // departing account's agent notifications.
                                NotificationService.deactivatePushTokens(account.userId)
                                graph.auth.signOut()
                            }
                        }
                    },
                )
            }
        }

        if (resetPasswordPresented) {
            // No back dismissal: the only ways out are completing the reset or
            // "Back to Login" (both run onDone, which signs out of the recovery
            // session). Back is swallowed so it can't abandon the flow mid-way
            // or exit the app.
            ModalOverlay(onBack = {}) {
                ResetPasswordScreen(
                    onDone = {
                        resetPasswordPresented = false
                        val account = authPhase as? AuthStore.Phase.Authenticated
                        scope.launch {
                            account?.let { NotificationService.deactivatePushTokens(it.userId) }
                            graph.auth.signOut()
                        }
                    },
                )
            }
        }

        if (graph.revenueCat.isRedeemingWebPurchase) {
            CircularProgressIndicator(
                color = AppColors.appPrimary,
                modifier = Modifier.align(Alignment.Center),
            )
        }
    }

    graph.revenueCat.webPurchaseRedemptionMessage?.let { message ->
        AlertDialog(
            onDismissRequest = graph.revenueCat::clearWebPurchaseRedemptionMessage,
            title = { Text(if (message.isError) "Purchase issue" else "Purchase redeemed") },
            text = { Text(message.text) },
            confirmButton = {
                TextButton(onClick = graph.revenueCat::clearWebPurchaseRedemptionMessage) { Text("OK") }
            },
            containerColor = AppColors.appSurfaceElevated,
        )
    }
}

private const val REVIEW_QUIET_DELAY_MILLIS = 3_000L

internal fun requiresSubscriptionResolution(
    phase: RootRouter.Phase,
    authenticated: Boolean,
    hasResolvedActiveUserEntitlement: Boolean,
    proAccessLoading: Boolean,
): Boolean = phase == RootRouter.Phase.Ready &&
    authenticated &&
    (!hasResolvedActiveUserEntitlement || proAccessLoading)

/**
 * Pure root-gate contract shared by runtime and focused tests.
 *
 * Normal Pro/admin users stay out of the onboarding paywall. Secret Settings'
 * explicit replay is the sole exception and intentionally wins over Pro access
 * for exactly one test run.
 */
internal fun shouldPresentPostOnboardingPaywall(
    phase: RootRouter.Phase,
    authenticated: Boolean,
    hasResolvedActiveUserEntitlement: Boolean,
    proAccessLoading: Boolean,
    isPro: Boolean,
    paywallDismissed: Boolean,
    testPaywallOverride: Boolean,
): Boolean = phase == RootRouter.Phase.Ready &&
    authenticated &&
    hasResolvedActiveUserEntitlement &&
    !proAccessLoading &&
    !paywallDismissed &&
    (testPaywallOverride || !isPro)

@Composable
private fun SubscriptionResolutionOverlay(
    isLoading: Boolean,
    hasError: Boolean,
    onRetry: () -> Unit,
    onSignOut: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AppColors.appSurface),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 420.dp)
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = AppColors.appPrimary,
                    modifier = Modifier.size(34.dp),
                )
                Text(
                    text = "Checking your WagerProof access…",
                    color = AppColors.appTextPrimary,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
            } else if (hasError) {
                Text(
                    text = "We couldn't verify your subscription",
                    color = AppColors.appTextPrimary,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "Check your connection and try again. Your account has not been charged.",
                    color = AppColors.appTextSecondary,
                    textAlign = TextAlign.Center,
                )
                Button(
                    onClick = onRetry,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.appPrimary,
                        contentColor = AppColors.appSurface,
                    ),
                ) {
                    Text("Retry", fontWeight = FontWeight.Bold)
                }
                TextButton(onClick = onSignOut) {
                    Text("Log Out", color = AppColors.appTextSecondary)
                }
            }
        }
    }
}

/**
 * Makes a root-level overlay behave like iOS's `.fullScreenCover`: the shell
 * underneath stays composed (so its state survives) but must not be reachable.
 *
 * Two things are needed for that on Android, neither of which a plain sibling in
 * a [Box] gets for free:
 *  - [onBack] takes over the hardware/predictive back gesture. Without it back
 *    reaches MainScaffold's handler, which is DISABLED at the Games tab root —
 *    so back finished the Activity for exactly the freshly-onboarded users who
 *    see these overlays.
 *  - a full-size pointer blocker sits BEHIND the content as a sibling, so taps
 *    that miss the overlay's own controls can't land on the tab bar underneath.
 *    It must be a sibling, not a consuming wrapper: an ancestor that consumes on
 *    the Main pass does so after the child sees the event but before the Final
 *    pass, so any child press whose gesture includes a MOVE gets cancelled by
 *    waitForUpOrCancellation — every real finger tap dies while emulator mouse
 *    clicks (no MOVEs) still work.
 */
@Composable
private fun ModalOverlay(
    onBack: () -> Unit,
    content: @Composable () -> Unit,
) {
    BackHandler(enabled = true, onBack = onBack)
    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    awaitPointerEventScope {
                        while (true) {
                            awaitPointerEvent().changes.forEach { it.consume() }
                        }
                    }
                },
        )
        content()
    }
}
