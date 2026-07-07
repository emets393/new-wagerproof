package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.core.design.tokens.AppColors

/** Tiny mirror of RN `OverlapAgentSummary` — the overlap footer's per-agent chip. */
data class OverlapSummary(
    val avatarId: String,
    val name: String,
    val avatarEmoji: String,
    val avatarColor: String,
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
            AvatarStack(agents, totalCount, maxVisible)
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

@Composable
private fun AvatarStack(agents: List<OverlapSummary>, totalCount: Int, maxVisible: Int) {
    val visible = agents.take(maxVisible)
    val overflow = totalCount - maxVisible
    Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
        visible.forEachIndexed { i, agent ->
            AvatarCircle(agent, Modifier.zIndex((maxVisible - i).toFloat()))
        }
        if (overflow > 0) {
            Box(
                Modifier
                    .zIndex(0f)
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(AppColors.appBorder.copy(alpha = 0.5f))
                    .border(2.dp, AppColors.appSurfaceElevated, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text("+$overflow", color = AppColors.appTextSecondary, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun AvatarCircle(agent: OverlapSummary, modifier: Modifier = Modifier) {
    val primary = AgentColorPalette.primary(agent.avatarColor)
    val secondary = AgentColorPalette.secondary(agent.avatarColor)
    Box(
        modifier
            .size(22.dp)
            .clip(CircleShape)
            .then(
                if (agent.avatarColor.startsWith("gradient:")) {
                    Modifier.background(
                        Brush.linearGradient(listOf(primary, secondary), start = Offset.Zero, end = Offset.Infinite),
                    )
                } else {
                    Modifier.background(primary)
                },
            )
            .border(2.dp, AppColors.appSurfaceElevated, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(agent.avatarEmoji, fontSize = 10.sp)
    }
}
