package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.agents.shaded

/**
 * 2dp brand-gradient top strip for [AgentCard] — port of iOS `GlowAccentBar.swift`.
 *
 * FIDELITY-WAIVER #071: RN's `react-native-animated-glow` 5-color cycle is
 * dropped. The static left→right gradient bar is on-brand and ships without a
 * per-frame glow animation.
 */
@Composable
fun GlowAccentBar(color: Color, modifier: Modifier = Modifier) {
    // Two-tone left→right bar (partner derived so solid hues still read as a
    // gradient, matching iOS's avatar-gradient depth).
    val brush = Brush.horizontalGradient(listOf(color, color.shaded(0.7)))
    Box(
        modifier
            .fillMaxWidth()
            .height(2.dp)
            .background(brush),
    )
}
