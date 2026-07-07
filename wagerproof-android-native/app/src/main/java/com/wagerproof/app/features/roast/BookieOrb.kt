package com.wagerproof.app.features.roast

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * Port of iOS `BookieOrbView.swift`. 96dp pulsing 3-layer green orb (soft glow +
 * mid ring + dark disc with a mic glyph), 1.6s ease loop.
 *
 * FIDELITY-WAIVER #063 — replaces the RN Lottie `ChattingRobot.json` (Lottie
 * deliberately not added), the established Lottie-replacement waiver.
 */
@Composable
fun BookieOrb(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "orb")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1600), RepeatMode.Reverse),
        label = "phase",
    )

    Box(modifier.size(96.dp), contentAlignment = Alignment.Center) {
        // Outer soft glow.
        Box(
            Modifier
                .size(96.dp)
                .scale(1f + 0.15f * phase)
                .graphicsLayer { alpha = 0.6f + 0.4f * (1f - phase) }
                .blur(8.dp)
                .clip(CircleShape)
                .background(AppColors.appPrimary.copy(alpha = 0.12f)),
        )
        // Mid ring.
        Box(
            Modifier
                .size(72.dp)
                .scale(1f + 0.08f * phase)
                .clip(CircleShape)
                .background(AppColors.appPrimary.copy(alpha = 0.3f)),
        )
        // Inner disc + mic glyph.
        Box(
            Modifier.size(56.dp).clip(CircleShape).background(Color(0xFF171717)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName("mic.fill")!!.imageVector,
                contentDescription = null,
                tint = AppColors.appPrimary,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}
