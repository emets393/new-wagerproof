package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors

/**
 * Shared rounded-square identity tile for agent surfaces — port of iOS
 * `AgentPixelAvatarTile` (PixelSpriteAvatar.swift:96-142): elevated base, the
 * agent's brand gradient at 85%, a 1.5dp inset ring, a color-matched halo, and
 * the pixel-office sprite inset 3dp.
 *
 * One definition, not one per caller: the My Agents row and the Following rail
 * both render this treatment, and they drifted apart once already.
 *
 * [animated] threads the host tab's visibility down to the sprite loop so a
 * hidden tab stops its per-avatar timeline.
 */
@Composable
fun AgentPixelAvatarTile(
    spriteIndex: Int,
    avatarColor: String,
    modifier: Modifier = Modifier,
    size: Dp = 52.dp,
    cornerRadius: Dp = 14.dp,
    animated: Boolean = true,
) {
    val shape = RoundedCornerShape(cornerRadius)
    val primary = AgentColorPalette.primary(avatarColor)
    Box(
        modifier
            .size(size)
            .shadow(10.dp, shape, spotColor = primary, ambientColor = primary)
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .background(
                Brush.linearGradient(
                    AgentColorPalette.avatarGradient(avatarColor),
                    start = Offset.Zero,
                    end = Offset.Infinite,
                ),
                alpha = 0.85f,
            )
            .border(1.5.dp, AppColors.appSurfaceElevated, shape),
        contentAlignment = Alignment.Center,
    ) {
        PixelSpriteAvatar(spriteIndex, Modifier.fillMaxSize().padding(3.dp), animated = animated)
    }
}
