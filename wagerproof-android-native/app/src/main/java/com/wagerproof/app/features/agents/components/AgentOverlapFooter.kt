package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentSpriteIndex

/** Tiny mirror of RN `OverlapAgentSummary` — the overlap footer's per-agent chip. */
data class OverlapSummary(
    val avatarId: String,
    val name: String,
    /** Owner's `sprite_index`; null falls back to the hash of [avatarId]. */
    val spriteIndex: Int?,
    val avatarColor: String,
)

/**
 * Identity [AgentAvatarStack] needs, decoupled from any one row model so the
 * overlap footer and the games-feed consensus strip can share the renderer.
 *
 * Agents are ALWAYS the pixel-office character, never their emoji — the colour
 * is only the halo behind them. Callers resolve [spriteIndex] through
 * `AgentSpriteIndex.forSeed` when the row carries no explicit override.
 */
data class AgentAvatarChip(
    val id: String,
    val spriteIndex: Int,
    /** Raw `avatar_color`: hex or "gradient:#aaa,#bbb". */
    val color: String,
)

/**
 * "N other agents made this pick" footer — port of iOS `AgentOverlapFooter.swift`.
 * A stacked row of mini-avatars (overlapping −8dp) + a count label, above a
 * hairline. Renders nothing when [totalCount] is 0.
 */
@Composable
fun AgentOverlapFooter(
    agents: List<OverlapSummary>,
    totalCount: Int,
    modifier: Modifier = Modifier,
) {
    if (totalCount == 0) return

    val maxVisible = 5
    Box(modifier.fillMaxWidth()) {
        // Top hairline separator.
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(AppColors.appBorder.copy(alpha = 0.3f)),
        )
        Row(
            Modifier.padding(top = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val visible = agents.take(maxVisible).map {
                    AgentAvatarChip(
                        id = it.avatarId,
                        spriteIndex = it.spriteIndex?.takeIf { i -> i in 0..7 }
                            ?: AgentSpriteIndex.forSeed(it.avatarId),
                        color = it.avatarColor,
                    )
                }
            AgentAvatarStack(
                chips = visible,
                overflow = totalCount - visible.size,
            )
            Text(
                if (totalCount == 1) "1 other agent made this pick" else "$totalCount other agents made this pick",
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
        }
    }
}

/**
 * Overlapping agent bubbles + a "+N" overflow pill. Shared by the pick-overlap
 * footer and the games-feed consensus strip, which need different diameters and
 * ring colors but the identical stacking language.
 *
 * The caller passes [overflow] rather than a total because the two surfaces
 * count different populations (all overlapping agents vs. only the agents on
 * the consensus side).
 */
@Composable
fun AgentAvatarStack(
    chips: List<AgentAvatarChip>,
    overflow: Int,
    modifier: Modifier = Modifier,
    diameter: Dp = 22.dp,
    spacing: Dp = (-8).dp,
    ringColor: Color = AppColors.appSurfaceElevated,
    ringWidth: Dp = 2.dp,
    overflowTextSize: TextUnit = 8.sp,
) {
    // No faces → no stack, even if overflow is positive: a bare "+45" bubble
    // with nothing to overflow from reads as a bug. Callers still show their
    // own count label, so nothing is lost.
    if (chips.isEmpty()) return
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(spacing)) {
        chips.forEachIndexed { i, chip ->
            // Leading avatars paint above later ones so the stack reads left-to-right.
            AvatarCircle(
                chip = chip,
                diameter = diameter,
                ringColor = ringColor,
                ringWidth = ringWidth,
                modifier = Modifier.zIndex((chips.size - i).toFloat()),
            )
        }
        if (overflow > 0) {
            Box(
                Modifier
                    .zIndex(0f)
                    .defaultMinSize(minWidth = diameter)
                    .height(diameter)
                    .clip(CircleShape)
                    .background(AppColors.appBorder.copy(alpha = 0.5f))
                    .border(ringWidth, ringColor, CircleShape)
                    .padding(horizontal = 3.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "+$overflow",
                    color = AppColors.appTextSecondary,
                    fontSize = overflowTextSize,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun AvatarCircle(
    chip: AgentAvatarChip,
    diameter: Dp,
    ringColor: Color,
    ringWidth: Dp,
    modifier: Modifier = Modifier,
) {
    val primary = AgentColorPalette.primary(chip.color)
    val secondary = AgentColorPalette.secondary(chip.color)
    Box(
        modifier
            .size(diameter)
            .clip(CircleShape)
            .then(
                if (chip.color.startsWith("gradient:")) {
                    Modifier.background(
                        Brush.linearGradient(listOf(primary, secondary), start = Offset.Zero, end = Offset.Infinite),
                    )
                } else {
                    Modifier.background(primary)
                },
            )
            .border(ringWidth, ringColor, CircleShape),
        // Bottom-aligned: the 48×64 frame is a standing figure, so centering it
        // in a small circle floats the feet and crops the head.
        contentAlignment = Alignment.BottomCenter,
    ) {
        // The sprite overshoots the disc slightly so the character fills it the
        // way the web/iOS stacks do, and the circle clip trims the overflow.
        PixelSpriteAvatar(
            spriteIndex = chip.spriteIndex,
            modifier = Modifier.height(diameter * 1.18f),
        )
    }
}
