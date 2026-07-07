package com.wagerproof.app.features.chat

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * Port of iOS `WagerBotDynamicIcon` — the welcome-state brand avatar.
 *
 * Three animated layers:
 *   1. Radial appPrimary halo (1.6× the disc), pulsing scale 0.95↔1.05 / 2s.
 *   2. Dark disc with a 0.35-accent ring rotating 360°/7s linear.
 *   3. Sparkle glyph scaling 1.0↔1.08 with a ±1.8° wiggle (shares the 2s beat).
 */
@Composable
fun WagerBotDynamicIcon(size: Dp = 72.dp, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "dynamicIcon")

    // Continuous ring rotation — 7s linear, no autoreverse.
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(7000, easing = androidx.compose.animation.core.LinearEasing), RepeatMode.Restart),
        label = "rotation",
    )
    // Pulse beat — 2s easeInOut, autoreverse (0 → 1 → 0).
    val pulse by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(2000, easing = androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse),
        label = "pulse",
    )

    val haloScale = 0.95f + 0.10f * pulse
    val haloAlpha = 0.70f + 0.25f * pulse
    val sparkleScale = 1.0f + 0.08f * pulse
    val sparkleAngle = -1.8f + 3.6f * pulse

    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        // Halo bloom behind the disc.
        Box(
            Modifier
                .size(size * 1.6f)
                .scale(haloScale)
                .drawBehind {
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                AppColors.appPrimary.copy(alpha = 0.45f * haloAlpha),
                                AppColors.appPrimary.copy(alpha = 0f),
                            ),
                            center = Offset(this.size.width / 2f, this.size.height / 2f),
                            radius = this.size.width / 2f,
                        ),
                    )
                },
        )
        // Dark disc with rotating accent ring.
        Box(
            Modifier
                .size(size)
                .rotate(rotation)
                .drawBehind {
                    drawCircle(color = Color(0xFF1A1A1A))
                    drawCircle(
                        color = AppColors.appPrimary.copy(alpha = 0.35f),
                        style = Stroke(width = 1.5.dp.toPx()),
                    )
                },
        )
        // Sparkle glyph.
        Icon(
            imageVector = AppIcon.SPARKLES.imageVector,
            contentDescription = null,
            tint = AppColors.appPrimary.copy(alpha = 0.95f),
            modifier = Modifier
                .size(size * 0.6f)
                .scale(sparkleScale)
                .rotate(sparkleAngle),
        )
    }
}
