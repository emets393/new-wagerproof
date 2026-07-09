package com.wagerproof.app.features.onboarding

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBackIos
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography

/**
 * Port of iOS `WagerproofDesign/Components/OnboardingPageShell.swift` (custom-
 * chrome variant only — the onboarding carousel always passes
 * `useNativeChrome: false`, and Android has no NavigationStack analog to port).
 *
 * Fixed, FULLY TRANSPARENT chrome over the root pixelwave: a top strip with a
 * centered progress bar + optional Liquid Glass back chevron, and a floating
 * bottom CTA pill. Page content draws in the middle band, inset clear of both
 * so it never sits under the chrome (iOS lets it scroll under; the inset is a
 * cleaner Compose equivalent — FIDELITY-WAIVER #260).
 */
@Composable
fun OnboardingPageShell(
    continueTitle: String,
    onContinue: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    progress: Double? = null,
    isCTAEnabled: Boolean = true,
    isCTALoading: Boolean = false,
    canGoBack: Boolean = false,
    ctaTint: Color = AppColors.appPrimary,
    content: @Composable () -> Unit,
) {
    val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val navBarBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

    // Chrome band = 2dp top pad + 48dp band; CTA = 60dp pill + 16dp above/below.
    val chromeHeight = statusBarTop + 50.dp
    val ctaHeight = if (continueTitle.isEmpty()) navBarBottom else navBarBottom + 92.dp

    Box(modifier = modifier.fillMaxSize()) {
        // --- Content band, inset clear of the transparent chrome ---
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = chromeHeight, bottom = ctaHeight),
        ) {
            content()
        }

        // --- Top chrome strip (progress bar + back chevron), transparent ---
        ChromeBand(
            progress = progress,
            canGoBack = canGoBack,
            ctaTint = ctaTint,
            onBack = onBack,
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .padding(top = statusBarTop + 2.dp),
        )

        // --- Floating bottom CTA pill ---
        if (continueTitle.isNotEmpty()) {
            ContinueCTAButton(
                label = continueTitle,
                isEnabled = isCTAEnabled,
                isLoading = isCTALoading,
                onClick = onContinue,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .imePadding()
                    .padding(bottom = navBarBottom + 16.dp)
                    .padding(horizontal = 16.dp)
                    .widthIn(max = 720.dp),
            )
        }
    }
}

// MARK: - Chrome band

@Composable
private fun ChromeBand(
    progress: Double?,
    canGoBack: Boolean,
    ctaTint: Color,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.height(48.dp),
        contentAlignment = Alignment.Center,
    ) {
        // Centered fixed-width progress bar — reads as one stable element across
        // pages regardless of chevron visibility.
        if (progress != null) {
            OnboardingProgressBar(
                value = progress,
                trackColor = Color.White.copy(alpha = 0.12f),
                fillColor = ctaTint.copy(alpha = 0.9f),
                modifier = Modifier.width(168.dp),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Leading: Liquid Glass back disc (or an equal placeholder so the
            // centered bar never shifts).
            AnimatedVisibility(
                visible = canGoBack,
                enter = fadeIn() + scaleIn(initialScale = 0.8f),
                exit = fadeOut() + scaleOut(targetScale = 0.8f),
            ) {
                Box(
                    modifier = Modifier
                        .padding(start = 12.dp)
                        .size(40.dp)
                        .liquidGlassBackground(shape = CircleShape, tint = Color.White.copy(alpha = 0.10f))
                        .onboardingPressable(onBack),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.ArrowBackIos,
                        contentDescription = "Back",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
            if (!canGoBack) Spacer(Modifier.width(52.dp))

            Spacer(Modifier.weight(1f))
            // Trailing placeholder mirrors the leading width — WagerProof has no
            // Skip button (dev tools live in secret settings).
            Spacer(Modifier.width(52.dp))
        }
    }
}

// MARK: - Progress bar (port of OnboardingProgressBar.swift)

@Composable
private fun OnboardingProgressBar(
    value: Double,
    modifier: Modifier = Modifier,
    trackColor: Color = Color.Gray.copy(alpha = 0.15f),
    fillColor: Color = Color.Gray.copy(alpha = 0.40f),
) {
    val clamped = value.coerceIn(0.0, 1.0).toFloat()
    val animated by animateFloatAsState(
        targetValue = clamped,
        animationSpec = tween(durationMillis = 300, easing = AppColorsEaseInOut),
        label = "onboardingProgress",
    )
    val shape = RoundedCornerShape(20.dp)
    Box(
        modifier = modifier
            .height(10.dp)
            .clip(shape)
            .background(trackColor),
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(animated)
                .clip(shape)
                .background(fillColor),
        )
    }
}

// Compose has no built-in easeInOut identical to iOS; reuse the design token's.
private val AppColorsEaseInOut = com.wagerproof.core.design.tokens.AppAnimations.EaseInOut

// MARK: - CTA pill (port of ContinueCTAButton.swift)

@Composable
private fun ContinueCTAButton(
    label: String,
    isEnabled: Boolean,
    isLoading: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // hasAppeared flips on first composition so the pill rises + fades in,
    // matching iOS's spring(0.55, 0.82) delayed 180ms entrance.
    var hasAppeared by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(Unit) { hasAppeared = true }

    val entranceAlpha by animateFloatAsState(
        targetValue = if (hasAppeared) 1f else 0f,
        animationSpec = tween(durationMillis = 400),
        label = "ctaEntranceAlpha",
    )
    val entranceOffset by animateDpAsState(
        targetValue = if (hasAppeared) 0.dp else 18.dp,
        animationSpec = com.wagerproof.core.design.tokens.AppAnimations.appEntrance(),
        label = "ctaEntranceOffset",
    )
    val enabledDim by animateFloatAsState(
        targetValue = if (isEnabled) 1f else 0.5f,
        animationSpec = tween(durationMillis = 200),
        label = "ctaEnabledDim",
    )

    val shape = CircleShape
    Box(
        modifier = modifier
            .fillMaxWidth()
            .graphicsLayer {
                translationY = entranceOffset.toPx()
                alpha = entranceAlpha * enabledDim
            }
            .height(60.dp)
            // Current iOS carousel keeps the CTA bright white/black while
            // the live accent is reserved for the progress fill.
            .liquidGlassBackground(shape = shape, tint = Color.White.copy(alpha = 0.92f))
            // Specular highlight — white gradient fading top → mid.
            .background(
                Brush.verticalGradient(
                    0f to Color.White.copy(alpha = 0.22f),
                    0.5f to Color.White.copy(alpha = 0f),
                ),
            )
            .then(
                if (isEnabled && !isLoading) Modifier.onboardingPressable(onClick) else Modifier,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (isLoading) {
            CircularProgressIndicator(color = Color.Black, modifier = Modifier.size(24.dp))
        } else {
            Text(
                text = label,
                style = AppTypography.majorCta.copy(fontSize = 18.sp),
                color = Color.Black,
                modifier = Modifier.wrapContentWidth(),
            )
        }
    }
}
