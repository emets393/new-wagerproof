package com.wagerproof.app.features.paywall

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.RevenueCatService

/**
 * Port of iOS `ProContentSection.swift`.
 *
 * Wraps any [content], gating it behind the Pro entitlement. Pro users (or
 * while status is still resolving) see the content directly; non-Pro users see
 * the content dimmed + blurred under a lock capsule. Tapping opens the paywall.
 */
@Composable
fun ProContentSection(
    title: String? = null,
    placementId: String = RevenueCatService.Placement.GENERIC_FEATURE,
    minHeight: Dp = 100.dp,
    content: @Composable () -> Unit,
) {
    val proAccess = appGraph().proAccess
    var isPaywallPresented by remember { mutableStateOf(false) }

    // Loading collapses into "show content" so the section doesn't flash a lock
    // before entitlement resolves — matches iOS `isPro || isLoading`.
    if (proAccess.isPro || proAccess.isLoading) {
        content()
        return
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .defaultMinSize(minHeight = minHeight)
            .clickable { isPaywallPresented = true },
    ) {
        // Dimmed + blurred silhouette (0.3 opacity), non-interactive.
        Box(modifier = Modifier.matchParentSize().alpha(0.3f).blur(8.dp)) {
            content()
        }

        // Lock capsule.
        Row(
            modifier = Modifier
                .align(Alignment.Center)
                .clip(RoundedCornerShape(999.dp))
                .background(Color.Black.copy(alpha = 0.8f))
                .padding(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon.fromSystemName("lock.fill")?.imageVector?.let { lock ->
                Icon(
                    imageVector = lock,
                    contentDescription = null,
                    tint = AppColors.appAccentAmber,
                    modifier = Modifier.padding(end = Spacing.md),
                )
            }
            Column {
                Text(
                    text = title ?: "Pro Feature",
                    style = AppTypography.bodyEmphasized,
                    color = AppColors.appTextPrimary,
                )
                Text(
                    text = "Tap to unlock",
                    style = AppTypography.caption,
                    color = AppColors.appTextSecondary,
                )
            }
        }

        // Transparent tap-catcher above the content so nested clickables in the
        // silhouette can't swallow the unlock tap.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable { isPaywallPresented = true },
        )
    }

    PaywallDialogHost(
        show = isPaywallPresented,
        placementId = placementId,
        onDismiss = { isPaywallPresented = false },
    )
}
