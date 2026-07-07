package com.wagerproof.app.features.auth

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.auth.Components.AuthErrorBanner
import com.wagerproof.app.features.auth.Components.AuthFieldRow
import com.wagerproof.app.features.auth.Components.AuthGateBackground
import com.wagerproof.app.features.auth.Components.AuthLogo
import com.wagerproof.app.features.auth.Components.AuthTextField
import com.wagerproof.app.features.auth.Components.LiquidGlassPillButton
import com.wagerproof.app.features.auth.Components.PasswordVisibilityToggle
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.services.AuthService
import kotlinx.coroutines.launch

/**
 * FIDELITY-WAIVER #240: Android IMPROVEMENT over the iOS gap.
 *
 * iOS sends a `wagerproof://reset-password` redirect in the reset email but has
 * NO in-app consumer — the deep link dead-ends. This screen is the real
 * set-new-password destination: the recovery link establishes a Supabase
 * recovery session, then the user picks a new password here.
 *
 * Two fields (new + confirm, min 8, must match), an "Update Password" CTA that
 * calls [AuthService.updatePassword] (added for exactly this screen), and a
 * success confirmation that hands control back via [onDone] (return to login).
 *
 * TODO(coordinator): wire the `wagerproof://reset-password` deep link in
 * RootHost so this screen is shown when that URI arrives (the recovery session
 * must be restored first). This file must NOT touch nav; routing is external.
 */
@Composable
fun ResetPasswordScreen(
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmVisible by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf(false) }

    LaunchedEffect(errorMessage) {
        if (errorMessage != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    LaunchedEffect(success) {
        if (success) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    fun submit() {
        errorMessage = null
        when {
            newPassword.length < 8 -> { errorMessage = "Password must be at least 8 characters"; return }
            newPassword != confirmPassword -> { errorMessage = "Passwords do not match"; return }
        }
        scope.launch {
            loading = true
            val result = runCatching { AuthService.updatePassword(newPassword) }
            loading = false
            result
                .onSuccess { success = true }
                .onFailure { errorMessage = it.message ?: "Couldn't update your password. Please try again." }
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        AuthGateBackground()

        Box(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
            AnimatedContent(
                targetState = success,
                transitionSpec = { fadeIn(tween(300)) togetherWith fadeOut(tween(300)) },
                label = "reset-success",
            ) { isSuccess ->
                if (isSuccess) {
                    ResetSuccessView(onBackToLogin = onDone)
                } else {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp)
                            .padding(top = 8.dp, bottom = 24.dp),
                    ) {
                        AuthLogo(modifier = Modifier.padding(top = 20.dp, bottom = 18.dp))

                        Column(Modifier.padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Set a new password", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
                            Text(
                                "Choose a new password for your account.",
                                color = Color.White.copy(alpha = 0.6f),
                                fontSize = 15.sp,
                            )
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            AuthFieldRow(
                                label = "New Password",
                                icon = "lock.fill",
                                trailing = { PasswordVisibilityToggle(passwordVisible) { passwordVisible = !passwordVisible } },
                            ) {
                                AuthTextField(
                                    value = newPassword,
                                    onValueChange = { newPassword = it; errorMessage = null },
                                    placeholder = "At least 8 characters",
                                    isPassword = true,
                                    passwordVisible = passwordVisible,
                                    imeAction = ImeAction.Next,
                                    enabled = !loading,
                                )
                            }

                            AuthFieldRow(
                                label = "Confirm Password",
                                icon = "lock.shield.fill",
                                trailing = { PasswordVisibilityToggle(confirmVisible) { confirmVisible = !confirmVisible } },
                            ) {
                                AuthTextField(
                                    value = confirmPassword,
                                    onValueChange = { confirmPassword = it; errorMessage = null },
                                    placeholder = "Re-enter your password",
                                    isPassword = true,
                                    passwordVisible = confirmVisible,
                                    imeAction = ImeAction.Go,
                                    keyboardActions = KeyboardActions(onGo = { submit() }),
                                    enabled = !loading,
                                )
                            }

                            errorMessage?.let { AuthErrorBanner(it) }

                            LiquidGlassPillButton(
                                title = "Update Password",
                                loading = loading,
                                isEnabled = newPassword.isNotEmpty() && confirmPassword.isNotEmpty(),
                                onClick = { submit() },
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ResetSuccessView(onBackToLogin: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp)
            .padding(top = 60.dp, bottom = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))

        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(AppColors.appPrimary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            AppIcon.fromSystemName("checkmark.circle")?.imageVector?.let {
                Icon(it, contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(44.dp))
            }
        }

        Spacer(Modifier.size(28.dp))
        Text("Password updated", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.size(16.dp))
        Text(
            "Your password has been changed. You can now sign in with your new password.",
            color = Color.White.copy(alpha = 0.55f),
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(24.dp))

        LiquidGlassPillButton(title = "Back to Login", onClick = onBackToLogin)

        Spacer(Modifier.weight(1f))
    }
}
