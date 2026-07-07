package com.wagerproof.app.features.paywall

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.RevenueCatService

/**
 * Port of iOS `LockedOverlay.swift`.
 *
 * General-purpose overlay that blurs whatever [content] it wraps and shows a
 * lock disc + configurable [message]. Tapping opens the paywall by default, or
 * invokes a custom [action] when provided. [content] is optional — omit it for
 * a bare lock overlay.
 */
@Composable
fun LockedOverlay(
    message: String = "Unlock with Pro",
    placementId: String = RevenueCatService.Placement.GENERIC_FEATURE,
    action: (() -> Unit)? = null,
    content: (@Composable () -> Unit)? = null,
) {
    var isPaywallPresented by remember { mutableStateOf(false) }

    val onTap: () -> Unit = {
        if (action != null) action() else isPaywallPresented = true
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onTap),
    ) {
        if (content != null) {
            Box(modifier = Modifier.matchParentSize().alpha(0.5f).blur(8.dp)) {
                content()
            }
        }

        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.6f)),
                )
                AppIcon.fromSystemName("lock.fill")?.imageVector?.let { lock ->
                    Icon(
                        imageVector = lock,
                        contentDescription = null,
                        tint = AppColors.appAccentAmber,
                    )
                }
            }
            Text(
                text = message,
                style = AppTypography.captionEmphasized,
                color = AppColors.appTextPrimary,
            )
        }

        // Tap-catcher above the silhouette so nested clickables don't swallow
        // the unlock tap.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable(onClick = onTap),
        )
    }

    PaywallDialogHost(
        show = isPaywallPresented,
        placementId = placementId,
        onDismiss = { isPaywallPresented = false },
    )
}
