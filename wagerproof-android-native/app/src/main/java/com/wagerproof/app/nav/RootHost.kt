package com.wagerproof.app.nav

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
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
    val router = graph.rootRouter
    val authPhase = graph.auth.phase
    val onboardingComplete = graph.onboarding.isComplete
    val scope = rememberCoroutineScope()
    var resetPasswordPresented by remember { mutableStateOf(false) }
    var paywallDismissed by remember { mutableStateOf(false) }

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
                graph.onboarding.attachUser(phase.userId)
                router.resolve(phase, graph.onboarding.isComplete)
                graph.wagerBotChat.bind(phase.userId)
                graph.revenueCat.attachUser(phase.userId)
                graph.adminMode.checkRole(phase.userId)
                NotificationService.registerPushToken(phase.userId)
                WidgetSyncCoordinator.syncAll(graph.application, phase.userId)
            }
            is AuthStore.Phase.Unauthenticated -> {
                graph.onboarding.detachUser()
                router.resolve(phase, onboardingComplete = false)
                graph.wagerBotChat.bind(null)
                graph.revenueCat.detachUser()
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

    val shouldPresentPaywall = router.phase == RootRouter.Phase.Ready &&
        graph.revenueCat.hasResolvedActiveUserEntitlement &&
        !graph.proAccess.isLoading &&
        !paywallDismissed &&
        (router.testPaywallOverride || !graph.proAccess.isPro)

    Box(modifier.fillMaxSize().background(AppColors.appSurface)) {
        AnimatedContent(
            targetState = router.phase,
            transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(180)) },
            modifier = Modifier.fillMaxSize(),
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
            PostOnboardingPaywall(
                onUserDismissed = {
                    paywallDismissed = true
                    router.clearTestPaywallOverride()
                },
            )
        }

        if (resetPasswordPresented) {
            ResetPasswordScreen(
                onDone = {
                    resetPasswordPresented = false
                    scope.launch { graph.auth.signOut() }
                },
            )
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
