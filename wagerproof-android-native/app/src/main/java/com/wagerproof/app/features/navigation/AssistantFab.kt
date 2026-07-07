package com.wagerproof.app.features.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background
import com.wagerproof.core.design.icons.AppIcon

/**
 * Floating WagerBot launcher — port of iOS
 * `Features/Navigation/FloatingAssistantBubble` (doc 08 §3.5). A 56dp circular
 * brand-gradient FAB with the WagerBot glyph and a double shadow.
 *
 * Parked component: iOS's `MainTabView` doesn't currently mount it (chat opens
 * from the toolbar), and neither does the Android [com.wagerproof.app.nav.MainScaffold].
 * Kept so a tab can overlay it as a launcher if the design revives it.
 *
 * // Note: iOS uses the bespoke `WagerBotIcon` glyph — no Android equivalent
 * // exists yet, so we use the closest SF-symbol map (the same chat-bubble glyph
 * // the iOS bubble itself uses for its fallback).
 */
@Composable
fun AssistantFab(
    modifier: Modifier = Modifier,
    onTap: () -> Unit = {},
) {
    // Elevation gives the black ambient shadow; the colored glow shadow that iOS
    // layers on top has no direct Compose analog on a clipped circle, so the
    // Surface tonal elevation stands in (FIDELITY-WAIVER #251: single shadow).
    Surface(
        onClick = onTap,
        shape = CircleShape,
        color = Color.Transparent,
        shadowElevation = 8.dp,
        modifier = modifier.size(56.dp),
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(
                    Brush.linearGradient(
                        colors = listOf(Color(0xFF00E676), Color(0xFF16A34A)),
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = AppIcon.BUBBLE_LEFT_AND_TEXT_BUBBLE_RIGHT_FILL.imageVector,
                contentDescription = "Open WagerBot chat",
                tint = Color.White,
            )
        }
    }
}
