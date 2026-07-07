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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.auth.Components.AuthBackButton
import com.wagerproof.app.features.auth.Components.AuthErrorBanner
import com.wagerproof.app.features.auth.Components.AuthFieldRow
import com.wagerproof.app.features.auth.Components.AuthLogo
import com.wagerproof.app.features.auth.Components.AuthTextField
import com.wagerproof.app.features.auth.Components.LiquidGlassPillButton
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.launch

/**
 * Request a password-reset email — port of iOS `ForgotPasswordView`. Submits via
 * `AuthStore.sendPasswordReset` (Supabase `redirectTo: wagerproof://reset-password`).
 * On success the whole form swaps for a "check your email" confirmation.
 */
@Composable
fun ForgotPasswordView(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val authStore = appGraph().auth
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    var email by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf(false) }
    var submittedEmail by remember { mutableStateOf("") }

    LaunchedEffect(errorMessage) {
        if (errorMessage != null) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }
    LaunchedEffect(success) {
        if (success) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    fun sendReset() {
        errorMessage = null
        val trimmed = email.trim()
        when {
            trimmed.isEmpty() -> { errorMessage = "Please enter your email"; return }
            !trimmed.contains("@") -> { errorMessage = "Please enter a valid email"; return }
        }
        scope.launch {
            loading = true
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            authStore.sendPasswordReset(trimmed)
            loading = false
            authStore.lastError?.let { raw ->
                errorMessage = raw
                authStore.clearError()
                return@launch
            }
            submittedEmail = trimmed
            success = true
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .imePadding(),
    ) {
        AnimatedContent(
            targetState = success,
            transitionSpec = { fadeIn(tween(300)) togetherWith fadeOut(tween(300)) },
            label = "forgot-success",
        ) { isSuccess ->
            if (isSuccess) {
                SuccessView(submittedEmail = submittedEmail, onBackToLogin = onBack)
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp)
                        .padding(top = 8.dp, bottom = 24.dp),
                ) {
                    AuthBackButton(onClick = onBack, enabled = !loading, modifier = Modifier.padding(bottom = 28.dp))
                    AuthLogo(modifier = Modifier.padding(bottom = 18.dp))

                    Column(Modifier.padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Forgot password?", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Enter your email and we'll send you a reset link.",
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = 15.sp,
                        )
                    }

                    Column(
                        modifier = Modifier.padding(bottom = 28.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        AuthFieldRow(label = "Email", icon = "envelope.fill") {
                            AuthTextField(
                                value = email,
                                onValueChange = { email = it; errorMessage = null },
                                placeholder = "you@example.com",
                                keyboardType = KeyboardType.Email,
                                imeAction = ImeAction.Send,
                                keyboardActions = KeyboardActions(onSend = { sendReset() }),
                                enabled = !loading,
                            )
                        }

                        errorMessage?.let { AuthErrorBanner(it) }

                        LiquidGlassPillButton(
                            title = "Send Reset Link",
                            loading = loading,
                            isEnabled = email.isNotEmpty(),
                            onClick = { sendReset() },
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Remember your password? ", color = Color.White.copy(alpha = 0.45f), fontSize = 14.sp)
                        Text(
                            text = "Sign In",
                            color = AppColors.appPrimary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickableNoRipple(enabled = !loading, onClick = onBack),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SuccessView(submittedEmail: String, onBackToLogin: () -> Unit) {
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
                .background(AppColors.appPrimary.copy(alpha = 0.12f))
                .padding(bottom = 0.dp),
            contentAlignment = Alignment.Center,
        ) {
            AppIcon.fromSystemName("envelope.badge")?.imageVector?.let {
                Icon(it, contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(44.dp))
            }
        }

        Spacer(Modifier.size(28.dp))
        Text("Check your email", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.size(16.dp))
        Text(
            "We've sent a password reset link to:",
            color = Color.White.copy(alpha = 0.55f),
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(8.dp))
        Text(submittedEmail, color = AppColors.appPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.size(12.dp))
        Text(
            "Follow the instructions in the email to reset your password.",
            color = Color.White.copy(alpha = 0.55f),
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(20.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            AppIcon.fromSystemName("info.circle")?.imageVector?.let {
                Icon(it, contentDescription = null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(15.dp))
            }
            Text(
                "If you don't see the email, check your spam folder.",
                color = Color.White.copy(alpha = 0.4f),
                fontSize = 13.sp,
            )
        }
        Spacer(Modifier.size(24.dp))

        LiquidGlassPillButton(title = "Back to Login", onClick = onBackToLogin)

        Spacer(Modifier.weight(1f))
    }
}
