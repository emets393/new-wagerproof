package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentWithPerformance

/**
 * Single-column agent card primitive — port of iOS `AgentCard.swift`. Glow
 * accent bar, identity row (avatar + name + sport chips + active dot), divider,
 * and a 3-cell stat strip (Record / Net Units / Streak).
 */
@Composable
fun AgentCard(
    agent: AgentWithPerformance,
    modifier: Modifier = Modifier,
    onTap: () -> Unit,
) {
    val perf = agent.performance
    val netUnits = perf?.netUnits ?: 0.0
    val streak = perf?.currentStreak ?: 0
    val shape = RoundedCornerShape(16.dp)

    Column(
        modifier
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .clickable(onClick = onTap),
    ) {
        GlowAccentBar(color = AgentColorPalette.primary(agent.agent.avatarColor))

        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(50.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(
                            Brush.linearGradient(
                                AgentColorPalette.avatarGradient(agent.agent.avatarColor),
                                start = Offset.Zero,
                                end = Offset.Infinite,
                            ),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    PixelSpriteAvatar(
                        spriteIndex = agent.agent.spriteIndex,
                        modifier = Modifier.fillMaxSize().padding(3.dp),
                    )
                }
                Spacer(Modifier.size(12.dp))
                Column(
                    Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        agent.agent.name,
                        color = AppColors.appTextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        agent.agent.preferredSports.forEach { sport ->
                            Text(
                                sport.label,
                                color = AppColors.appTextSecondary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(AppColors.appBorder.copy(alpha = 0.4f))
                                    .padding(horizontal = 8.dp, vertical = 2.dp),
                            )
                        }
                    }
                }
                if (agent.agent.isActive) {
                    Box(
                        Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF10B981)),
                    )
                }
            }

            HorizontalDivider(color = AppColors.appBorder.copy(alpha = 0.5f))

            Row(Modifier.fillMaxWidth()) {
                StatCell(
                    label = "Record",
                    value = perf?.recordLabel ?: "0-0",
                    color = AppColors.appTextPrimary,
                    modifier = Modifier.weight(1f),
                )
                StatCell(
                    label = "Net Units",
                    value = perf?.netUnitsLabel ?: "+0.00u",
                    color = if (netUnits >= 0) AppColors.appWin else AppColors.appLoss,
                    modifier = Modifier.weight(1f),
                )
                StatCell(
                    label = "Streak",
                    value = perf?.currentStreakLabel ?: "-",
                    color = when {
                        streak > 0 -> AppColors.appWin
                        streak < 0 -> AppColors.appLoss
                        else -> AppColors.appTextSecondary
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun StatCell(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            label.uppercase(),
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            letterSpacing = 0.5.sp,
        )
        Text(value, color = color, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}
