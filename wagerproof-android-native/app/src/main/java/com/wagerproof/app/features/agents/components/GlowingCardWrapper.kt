package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.agents.shaded

/**
 * Static halo around top-3 leaderboard avatars — port of iOS `GlowingCardWrapper.swift`.
 *
 * FIDELITY-WAIVER #071: the animated multi-stop color cycle is dropped. A soft
 * outer ring + tight inner ring calls out the row without pulsing.
 */
@Composable
fun GlowingCardWrapper(
    color: Color,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 20.dp,
    content: @Composable () -> Unit,
) {
    val secondary = color.shaded(0.7)
    val softBrush = Brush.linearGradient(listOf(color.copy(alpha = 0.6f), secondary.copy(alpha = 0.6f)))
    val vividBrush = Brush.linearGradient(listOf(color, secondary))

    Box(modifier = modifier) {
        // Halo rings sit behind the content, bleeding 3dp past its bounds.
        Box(
            Modifier
                .matchParentSize()
                .padding((-3).dp)
                .blur(6.dp)
                .border(4.dp, softBrush, RoundedCornerShape(cornerRadius + 4.dp)),
        )
        Box(
            Modifier
                .matchParentSize()
                .padding((-3).dp)
                .blur(1.dp)
                .border(1.dp, vividBrush, RoundedCornerShape(cornerRadius + 2.dp)),
        )
        content()
    }
}
