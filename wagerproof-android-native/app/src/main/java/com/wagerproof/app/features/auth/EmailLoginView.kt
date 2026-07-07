package com.wagerproof.app.features.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.auth.Components.AuthBackButton
import com.wagerproof.app.features.auth.Components.AuthErrorBanner
import com.wagerproof.app.features.auth.Components.AuthFieldRow
import com.wagerproof.app.features.auth.Components.AuthLogo
import com.wagerproof.app.features.auth.Components.AuthTextField
import com.wagerproof.app.features.auth.Components.LiquidGlassPillButton
import com.wagerproof.app.features.auth.Components.PasswordVisibilityToggle
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.launch

/**
 * Email + password sign-in — port of iOS `EmailLoginView`. Wired to
 * `AuthStore.signIn`. Error classification matches iOS verbatim (see
 * [classifyEmailLoginError]).
 */
@Composable
fun EmailLoginView(
    onBack: () -> Unit,
    onNavigateSignup: () -> Unit,
    onNavigateForgot: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val authStore = appGraph().auth
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // iOS `.sensoryFeedback` triggers — approximated with LongPress (impact/
    // error/success) and TextHandleMove (selection).
    LaunchedEffect(errorMessage) {
        if (errorMessage != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    LaunchedEffect(authStore.lastSuccessAt) {
        if (authStore.lastSuccessAt != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    LaunchedEffect(passwordVisible) {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }

    fun submit() {
        errorMessage = null
        val trimmed = email.trim()
        when {
            trimmed.isEmpty() -> { errorMessage = "Please enter your email"; return }
            !trimmed.contains("@") -> { errorMessage = "Please enter a valid email"; return }
            password.isEmpty() -> { errorMessage = "Please enter your password"; return }
        }
        scope.launch {
            loading = true
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            authStore.signIn(trimmed, password)
            loading = false
            authStore.lastError?.let { raw ->
                errorMessage = classifyEmailLoginError(raw)
                authStore.clearError()
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp)
            .padding(top = 8.dp, bottom = 24.dp),
    ) {
        AuthBackButton(onClick = onBack, enabled = !loading, modifier = Modifier.padding(bottom = 28.dp))

        AuthLogo(modifier = Modifier.padding(bottom = 18.dp))

        Column(Modifier.padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Welcome back", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
            Text("Sign in to your account", color = Color.White.copy(alpha = 0.6f), fontSize = 15.sp)
        }

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            AuthFieldRow(
                label = "Email",
                icon = "envelope.fill",
                isError = errorMessage != null && password.isEmpty() && email.isEmpty(),
            ) {
                AuthTextField(
                    value = email,
                    onValueChange = { email = it; errorMessage = null },
                    placeholder = "you@example.com",
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                    enabled = !loading,
                )
            }

            AuthFieldRow(
                label = "Password",
                icon = "lock.fill",
                trailing = { PasswordVisibilityToggle(passwordVisible) { passwordVisible = !passwordVisible } },
            ) {
                AuthTextField(
                    value = password,
                    onValueChange = { password = it; errorMessage = null },
                    placeholder = "Enter your password",
                    isPassword = true,
                    passwordVisible = passwordVisible,
                    imeAction = ImeAction.Go,
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    enabled = !loading,
                )
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Text(
                    text = "Forgot Password?",
                    color = AppColors.appPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .padding(top = 0.dp)
                        .clickableNoRipple(enabled = !loading, onClick = onNavigateForgot),
                )
            }

            errorMessage?.let { AuthErrorBanner(it) }

            LiquidGlassPillButton(
                title = "Sign In",
                loading = loading,
                isEnabled = email.isNotEmpty() && password.isNotEmpty(),
                onClick = { submit() },
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 28.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Don't have an account? ", color = Color.White.copy(alpha = 0.45f), fontSize = 14.sp)
            Text(
                text = "Sign Up",
                color = AppColors.appPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickableNoRipple(enabled = !loading, onClick = onNavigateSignup),
            )
        }
    }
}

/** Mirrors the iOS/RN error classification verbatim. */
internal fun classifyEmailLoginError(raw: String): String = when {
    raw.contains("Invalid login credentials", ignoreCase = true) -> "Invalid email or password"
    raw.contains("Email not confirmed", ignoreCase = true) -> "Please verify your email before signing in"
    else -> raw
}

/** Text-link tap without the Material ripple (iOS `.buttonStyle(.plain)` links). */
internal fun Modifier.clickableNoRipple(enabled: Boolean = true, onClick: () -> Unit): Modifier =
    composed {
        val interaction = remember { MutableInteractionSource() }
        clickable(
            interactionSource = interaction,
            indication = null,
            enabled = enabled,
            onClick = onClick,
        )
    }
