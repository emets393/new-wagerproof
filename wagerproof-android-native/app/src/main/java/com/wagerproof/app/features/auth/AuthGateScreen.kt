package com.wagerproof.app.features.auth

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.auth.Components.AuthGateBackground

/**
 * Routes inside the unauthenticated stack — mirrors iOS `AuthRoute` plus the
 * root Login. [ResetPassword] is Android-only (see [ResetPasswordScreen]).
 */
private enum class AuthRoute { Login, EmailLogin, Signup, ForgotPassword }

/**
 * Unauthenticated root — the Android port of iOS `AuthRouter`
 * (`NavigationStack` over Login/Email/Signup/ForgotPassword). Public entry point
 * called by RootHost.
 *
 * FIDELITY-WAIVER #241: the animated pixel-glyph [AuthGateBackground] is hosted
 * ONCE here behind the router (not per-screen like iOS). PixelWaveBackground
 * runs infinite animations; a shared instance keeps the wave stable across
 * navigation instead of restarting it on every push/pop, and avoids paying its
 * cost twice.
 */
@Composable
fun AuthGateScreen(modifier: Modifier = Modifier) {
    // Simple back stack — the Compose analog of NavigationStack's path array.
    val backStack = remember { mutableStateListOf(AuthRoute.Login) }
    val current = backStack.last()

    fun push(route: AuthRoute) { backStack.add(route) }
    fun pop() { if (backStack.size > 1) backStack.removeAt(backStack.lastIndex) }

    // System back pops the internal stack while there's somewhere to go.
    BackHandler(enabled = backStack.size > 1) { pop() }

    Box(modifier = modifier.fillMaxSize()) {
        AuthGateBackground()

        AnimatedContent(
            targetState = current,
            transitionSpec = {
                // Ordinal doubles as depth: deeper = push (slide from trailing).
                val forward = targetState.ordinal > initialState.ordinal
                if (forward) {
                    (slideInHorizontally(tween(280)) { it / 3 } + fadeIn(tween(280))) togetherWith
                        fadeOut(tween(200))
                } else {
                    fadeIn(tween(200)) togetherWith
                        (slideOutHorizontally(tween(280)) { it / 3 } + fadeOut(tween(280)))
                }
            },
            label = "auth-route",
        ) { route ->
            when (route) {
                AuthRoute.Login -> LoginView(
                    onContinueWithEmail = { push(AuthRoute.EmailLogin) },
                )
                AuthRoute.EmailLogin -> EmailLoginView(
                    onBack = ::pop,
                    onNavigateSignup = { push(AuthRoute.Signup) },
                    onNavigateForgot = { push(AuthRoute.ForgotPassword) },
                )
                AuthRoute.Signup -> SignupView(onBack = ::pop)
                AuthRoute.ForgotPassword -> ForgotPasswordView(onBack = ::pop)
            }
        }
    }
}
