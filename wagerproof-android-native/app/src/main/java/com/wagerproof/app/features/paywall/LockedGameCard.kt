package com.wagerproof.app.features.paywall

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.RevenueCatService

/**
 * Port of iOS `LockedGameCard.swift`.
 *
 * Wraps a game card with a blurred + dimmed (0.4 opacity) overlay and an amber
 * lock "Pro" pill. Tapping anywhere on the card presents the paywall. The
 * wrapped [content] is the locked silhouette so feed layout stays stable.
 */
@Composable
fun LockedGameCard(
    cardWidth: Dp? = null,
    content: @Composable () -> Unit,
) {
    var isPaywallPresented by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .let { if (cardWidth != null) it.width(cardWidth) else it }
            .clip(RoundedCornerShape(16.dp))
            .clickable { isPaywallPresented = true },
    ) {
        Box(modifier = Modifier.matchParentSize().alpha(0.4f).blur(8.dp)) {
            content()
        }

        Row(
            modifier = Modifier
                .align(Alignment.Center)
                .clip(RoundedCornerShape(999.dp))
                .background(Color.Black.copy(alpha = 0.7f))
                .padding(horizontal = Spacing.md, vertical = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon.fromSystemName("lock.fill")?.imageVector?.let { lock ->
                Icon(
                    imageVector = lock,
                    contentDescription = null,
                    tint = AppColors.appAccentAmber,
                    modifier = Modifier.padding(end = 6.dp),
                )
            }
            Text(
                text = "Pro",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = AppColors.appTextPrimary,
            )
        }

        // Tap-catcher above the silhouette so nested card clickables don't
        // swallow the unlock tap.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable { isPaywallPresented = true },
        )
    }

    PaywallDialogHost(
        show = isPaywallPresented,
        placementId = RevenueCatService.Placement.GENERIC_FEATURE,
        onDismiss = { isPaywallPresented = false },
    )
}
