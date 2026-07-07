package com.wagerproof.app.features.auth

import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
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
import com.wagerproof.app.features.auth.Components.AuthPillButton
import com.wagerproof.app.features.auth.Components.AuthPillStyle
import com.wagerproof.app.features.auth.Components.AuthSuccessBanner
import com.wagerproof.app.features.auth.Components.AuthTextField
import com.wagerproof.app.features.auth.Components.LiquidGlassPillButton
import com.wagerproof.app.features.auth.Components.PasswordVisibilityToggle
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.services.GoogleSignInHelper
import com.wagerproof.core.stores.AuthStore
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Create-account form — port of iOS `SignupView`. Wired to `AuthStore.signUp`.
 * On auto-confirm the auth listener routes; otherwise a "check your email"
 * banner shows and we bounce back to login after 3s.
 *
 * FIDELITY-WAIVER #201: Apple Sign-In dropped; only the Google social pill shows.
 */
@Composable
fun SignupView(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val authStore = appGraph().auth
    val activity = LocalActivity.current
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var googleLoading by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmVisible by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    val anyLoading = loading || googleLoading
    val formIncomplete = loading || email.isEmpty() || password.isEmpty() ||
        confirmPassword.isEmpty() || successMessage != null

    LaunchedEffect(errorMessage) {
        if (errorMessage != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    LaunchedEffect(successMessage) {
        if (successMessage != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    LaunchedEffect(passwordVisible, confirmVisible) {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }

    fun clearMessages() { errorMessage = null; successMessage = null }

    fun submit() {
        clearMessages()
        val trimmed = email.trim()
        when {
            trimmed.isEmpty() -> { errorMessage = "Please enter your email"; return }
            !trimmed.contains("@") -> { errorMessage = "Please enter a valid email"; return }
            password.isEmpty() -> { errorMessage = "Please enter a password"; return }
            password.length < 8 -> { errorMessage = "Password must be at least 8 characters"; return }
            password != confirmPassword -> { errorMessage = "Passwords do not match"; return }
        }
        scope.launch {
            loading = true
            authStore.signUp(trimmed, password)
            loading = false
            authStore.lastError?.let { raw ->
                errorMessage = classifySignupError(raw)
                authStore.clearError()
                return@launch
            }
            // Session created (auto-confirm) → success banner, listener routes.
            // Otherwise → "check your email", clear fields, bounce back after 3s.
            if (authStore.phase is AuthStore.Phase.Authenticated) {
                successMessage = "Account created! Setting up your profile..."
            } else {
                successMessage = "Account created! Please check your email to verify your account."
                email = ""; password = ""; confirmPassword = ""
                delay(3_000)
                onBack()
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
        // Top bar: back + "Already have an account? Sign In".
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 28.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AuthBackButton(onClick = onBack, enabled = !loading)
            Box(Modifier.weight(1f))
            Text("Already have an account?", color = Color.White.copy(alpha = 0.5f), fontSize = 13.sp)
            Box(Modifier.width(4.dp))
            Text(
                text = "Sign In",
                color = AppColors.appPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickableNoRipple(enabled = !loading, onClick = onBack),
            )
        }

        AuthLogo(modifier = Modifier.padding(bottom = 18.dp))

        Column(Modifier.padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Create account", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Get started with professional sports analytics",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 15.sp,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            AuthFieldRow(label = "Email", icon = "envelope.fill") {
                AuthTextField(
                    value = email,
                    onValueChange = { email = it; clearMessages() },
                    placeholder = "you@example.com",
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                    enabled = !loading && successMessage == null,
                )
            }

            AuthFieldRow(
                label = "Password",
                icon = "lock.fill",
                trailing = { PasswordVisibilityToggle(passwordVisible) { passwordVisible = !passwordVisible } },
            ) {
                AuthTextField(
                    value = password,
                    onValueChange = { password = it; clearMessages() },
                    placeholder = "At least 8 characters",
                    isPassword = true,
                    passwordVisible = passwordVisible,
                    imeAction = ImeAction.Next,
                    enabled = !loading && successMessage == null,
                )
            }

            AuthFieldRow(
                label = "Confirm Password",
                icon = "lock.shield.fill",
                trailing = { PasswordVisibilityToggle(confirmVisible) { confirmVisible = !confirmVisible } },
            ) {
                AuthTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it; clearMessages() },
                    placeholder = "Re-enter your password",
                    isPassword = true,
                    passwordVisible = confirmVisible,
                    imeAction = ImeAction.Go,
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    enabled = !loading && successMessage == null,
                )
            }

            // 18+ / analytics-only disclaimer.
            Row(
                modifier = Modifier.padding(top = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AppIcon.fromSystemName("info.circle")?.imageVector?.let {
                    Icon(it, contentDescription = null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.padding(top = 1.dp))
                }
                Text(
                    "By signing up, you confirm that you are 18+ and understand this platform is for analytics only.",
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 12.sp,
                )
            }

            errorMessage?.let { AuthErrorBanner(it) }
            successMessage?.let { AuthSuccessBanner(it) }

            LiquidGlassPillButton(
                title = "Create Account",
                loading = loading,
                isEnabled = !formIncomplete,
                onClick = { submit() },
                modifier = Modifier.padding(top = 4.dp),
            )

            // "or continue with" divider.
            Row(
                modifier = Modifier.padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.weight(1f).height(1.dp).background(Color.White.copy(alpha = 0.12f)))
                Text("or continue with", color = Color.White.copy(alpha = 0.4f), fontSize = 13.sp)
                Box(Modifier.weight(1f).height(1.dp).background(Color.White.copy(alpha = 0.12f)))
            }

            AuthPillButton(
                title = "Continue with Google",
                style = AuthPillStyle.Dark,
                loading = googleLoading,
                enabled = !anyLoading && successMessage == null,
                onClick = {
                    val act = activity ?: return@AuthPillButton
                    scope.launch {
                        clearMessages()
                        googleLoading = true
                        try {
                            val idToken = GoogleSignInHelper(act).signIn()
                            authStore.signInWithGoogle(idToken)
                            authStore.lastError?.let { raw -> errorMessage = raw; authStore.clearError() }
                        } catch (t: Throwable) {
                            if (!GoogleSignInHelper(act).isUserCancellation(t)) {
                                errorMessage = t.message ?: "Google sign-in failed."
                            }
                        } finally {
                            googleLoading = false
                        }
                    }
                },
            ) {
                Text(text = "G", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

/** Mirrors the iOS/RN classification: "already registered" → friendly copy. */
internal fun classifySignupError(raw: String): String = when {
    raw.contains("already registered", ignoreCase = true) ->
        "An account with this email already exists"
    else -> raw
}
