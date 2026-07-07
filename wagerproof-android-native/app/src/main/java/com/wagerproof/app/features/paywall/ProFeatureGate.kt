package com.wagerproof.app.features.paywall

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `ProFeatureGate.swift`.
 *
 * Three render modes mirror RN / iOS:
 *   1. Pro user → render [content].
 *   2. Non-Pro user with a [fallback] → render the fallback.
 *   3. Non-Pro user with [showUpgradePrompt] → inline crown upgrade card that
 *      opens the paywall.
 *
 * Loading collapses into a thin "Loading…" row so consumers don't have to
 * differentiate. When [showUpgradePrompt] is false and there's no fallback,
 * nothing renders.
 */
@Composable
fun ProFeatureGate(
    showUpgradePrompt: Boolean = false,
    fallback: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val proAccess = appGraph().proAccess
    var isPaywallPresented by remember { mutableStateOf(false) }

    when {
        proAccess.isLoading -> {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(Spacing.lg),
            ) {
                CircularProgressIndicator(
                    color = AppColors.appPrimary,
                    modifier = Modifier.padding(end = Spacing.sm),
                )
                Text(
                    text = "Loading…",
                    style = AppTypography.caption,
                    color = AppColors.appTextSecondary,
                )
            }
        }
        proAccess.isPro -> content()
        fallback != null -> fallback()
        showUpgradePrompt -> {
            UpgradePrompt(onUpgrade = { isPaywallPresented = true })
            PaywallDialogHost(
                show = isPaywallPresented,
                placementId = com.wagerproof.core.services.RevenueCatService.Placement.GENERIC_FEATURE,
                onDismiss = { isPaywallPresented = false },
            )
        }
        // else: render nothing — matches iOS EmptyView().
    }
}

@Composable
private fun UpgradePrompt(onUpgrade: () -> Unit) {
    Column(
        modifier = Modifier
            .padding(Spacing.lg)
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(12.dp))
            .padding(Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        AppIcon.fromSystemName("crown.fill")?.imageVector?.let { crown ->
            Icon(
                imageVector = crown,
                contentDescription = null,
                // iOS gold (0xFFD700) — the "premium" cue on the upgrade card.
                tint = Color(0xFFFFD700),
                modifier = Modifier.padding(bottom = Spacing.xs),
            )
        }
        Text(
            text = "Pro Feature",
            style = AppTypography.title,
            color = AppColors.appTextPrimary,
        )
        Text(
            text = "This feature is available for WagerProof Pro subscribers.",
            style = AppTypography.body,
            color = AppColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Upgrade to Pro",
            style = AppTypography.bodyEmphasized,
            color = Color.White,
            modifier = Modifier
                .padding(top = Spacing.sm)
                .clickable(onClick = onUpgrade)
                .background(AppColors.appPrimary, RoundedCornerShape(12.dp))
                .padding(horizontal = Spacing.xl, vertical = Spacing.md),
        )
    }
}
