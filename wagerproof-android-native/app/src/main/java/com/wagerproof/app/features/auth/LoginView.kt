package com.wagerproof.app.features.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.compose.LocalActivity
import androidx.compose.material3.Text
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.auth.Components.AuthErrorBanner
import com.wagerproof.app.features.auth.Components.AuthLogo
import com.wagerproof.app.features.auth.Components.AuthPillButton
import com.wagerproof.app.features.auth.Components.AuthPillGlyph
import com.wagerproof.app.features.auth.Components.AuthPillStyle
import com.wagerproof.core.services.GoogleSignInHelper
import kotlinx.coroutines.launch

/**
 * The unauthenticated welcome gate — port of iOS `LoginView`. Left-aligned logo
 * + tagline centered on screen; sign-in options pinned to the bottom.
 *
 * FIDELITY-WAIVER #201: Apple Sign-In is dropped on Android (see AuthStore /
 * AuthService). Only Google + Email pills render.
 *
 * The animated pixel-glyph background is hosted once by [AuthGateScreen] behind
 * the router, so this screen paints only its foreground.
 */
@Composable
fun LoginView(
    onContinueWithEmail: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val authStore = appGraph().auth
    val activity = LocalActivity.current
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    var googleLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val anyLoading = googleLoading

    // iOS `.sensoryFeedback(.error, trigger: errorMessage)` — buzz on new error.
    LaunchedEffect(errorMessage) {
        if (errorMessage != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    Box(modifier = modifier.fillMaxSize()) {
        // Logo + heading — left-aligned, vertically centered.
        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .fillMaxWidth()
                .padding(horizontal = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AuthLogo()
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = "Welcome to WagerProof",
                    color = Color.White.copy(alpha = 0.92f),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = "The new way to bet with data",
                    color = Color.White.copy(alpha = 0.64f),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }

        // Sign-in options + legal copy, pinned to the bottom.
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(horizontal = 28.dp)
                .padding(bottom = 4.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            errorMessage?.let { AuthErrorBanner(it) }

            AuthPillButton(
                title = "Continue with Google",
                style = AuthPillStyle.Dark,
                loading = googleLoading,
                enabled = !anyLoading,
                onClick = {
                    val act = activity ?: return@AuthPillButton
                    scope.launch {
                        errorMessage = null
                        googleLoading = true
                        try {
                            val helper = GoogleSignInHelper(act)
                            val idToken = helper.signIn()
                            authStore.signInWithGoogle(idToken)
                            authStore.lastError?.let { raw ->
                                errorMessage = raw
                                authStore.clearError()
                            }
                        } catch (t: Throwable) {
                            // Swallow user-cancel silently (matches iOS Google cancel).
                            if (!GoogleSignInHelper(act).isUserCancellation(t)) {
                                errorMessage = t.message ?: "Google sign-in failed."
                            }
                        } finally {
                            googleLoading = false
                        }
                    }
                },
            ) {
                // No Google glyph in the Material set — tinted "G" placeholder (iOS parity).
                Text(text = "G", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Black)
            }

            AuthPillButton(
                title = "Continue with Email",
                style = AuthPillStyle.Dark,
                enabled = !anyLoading,
                onClick = onContinueWithEmail,
            ) {
                AuthPillGlyph(iconName = "envelope.fill")
            }

            LegalCopy(modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
private fun LegalCopy(modifier: Modifier = Modifier) {
    Text(
        modifier = modifier.fillMaxWidth(),
        textAlign = TextAlign.Center,
        fontSize = 12.sp,
        text = buildAnnotatedString {
            withStyle(SpanStyle(color = Color.White.copy(alpha = 0.5f))) {
                append("By creating an account, you agree to the\n")
            }
            withStyle(SpanStyle(color = Color.White.copy(alpha = 0.72f))) { append("Terms of Service") }
            withStyle(SpanStyle(color = Color.White.copy(alpha = 0.5f))) { append(" and ") }
            withStyle(SpanStyle(color = Color.White.copy(alpha = 0.72f))) { append("Privacy Policy") }
        },
    )
}
