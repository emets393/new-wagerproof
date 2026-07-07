package com.wagerproof.app.features.auth.Components

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.core.design.backgrounds.PixelWaveBackground
import com.wagerproof.core.design.tokens.AppColors

/**
 * Shared backdrop for every unauthenticated screen (gate, email sign-in,
 * sign-up, forgot-password, reset-password). Thin wrapper over the reusable
 * [PixelWaveBackground] tinted with the app primary — port of iOS
 * `Auth/Components/AuthGateBackground.swift`. iOS's `.ignoresSafeArea()`
 * becomes a plain `fillMaxSize` since the router hosts it edge-to-edge.
 */
@Composable
fun AuthGateBackground(modifier: Modifier = Modifier) {
    PixelWaveBackground(
        modifier = modifier.fillMaxSize(),
        accentColor = AppColors.appPrimary,
    )
}
