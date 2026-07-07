package com.wagerproof.app.nav

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.auth.AuthGateScreen
import com.wagerproof.app.features.onboarding.OnboardingScreen
import com.wagerproof.app.features.shared.SplashScreen
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.RootRouter

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
        if (router.phase == RootRouter.Phase.Ready) {
            router.consumePendingDeepLink()?.let { route -> graph.mainTab.apply(route) }
        }
    }

    AnimatedContent(
        targetState = router.phase,
        transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(180)) },
        modifier = modifier.fillMaxSize().background(AppColors.appSurface),
        label = "root-phase",
    ) { phase ->
        when (phase) {
            RootRouter.Phase.Launching -> SplashScreen()
            RootRouter.Phase.Unauthenticated -> AuthGateScreen()
            RootRouter.Phase.Onboarding -> OnboardingScreen()
            RootRouter.Phase.Ready -> MainScaffold()
        }
    }
}
