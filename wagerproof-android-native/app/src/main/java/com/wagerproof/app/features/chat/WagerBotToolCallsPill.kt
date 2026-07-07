package com.wagerproof.app.features.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.zIndex
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.WagerBotContentBlock
import com.wagerproof.core.models.WagerBotToolCatalog
import com.wagerproof.core.models.WagerBotToolStatus

/**
 * Port of iOS `WagerBotToolCallsPill.swift`. Consolidates a run of tool-use
 * blocks into one collapsible pill: collapsed = up to 4 overlapping icon
 * circles + count label + chevron; expanded = stacked [WagerBotToolUseChip]s.
 * Auto-expands while any call is running; a manual tap toggle persists.
 */
@Composable
fun WagerBotToolCallsPill(
    calls: List<WagerBotContentBlock.ToolUse>,
    modifier: Modifier = Modifier,
) {
    var manuallyExpanded by remember { mutableStateOf(false) }
    val anyRunning = calls.any { it.status is WagerBotToolStatus.Running }
    val showExpanded = manuallyExpanded || anyRunning

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Collapsed pill
        Row(
            modifier = Modifier
                .clip(CircleShape)
                .background(AppColors.appPrimary.copy(alpha = 0.10f))
                .clickable { manuallyExpanded = !manuallyExpanded }
                .padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StackedIcons(calls)
            Text(
                text = countLabel(calls.size, anyRunning),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.appTextSecondary,
            )
            Icon(
                imageVector = AppIcon.CHEVRON_DOWN.imageVector,
                contentDescription = null,
                tint = AppColors.appTextSecondary.copy(alpha = 0.6f),
                modifier = Modifier
                    .size(12.dp)
                    // Flip the down-chevron to point up when expanded (no up glyph in AppIcon).
                    .graphicsLayer(rotationZ = if (showExpanded) 180f else 0f),
            )
        }

        AnimatedVisibility(
            visible = showExpanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                calls.forEach { call ->
                    WagerBotToolUseChip(
                        toolName = call.name,
                        inputJson = call.argumentsJson,
                        status = call.status,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@Composable
private fun StackedIcons(calls: List<WagerBotContentBlock.ToolUse>) {
    val visible = calls.take(4)
    // Negative spacing overlaps the circles by 8dp (iOS HStack spacing -8).
    Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
        visible.forEachIndexed { idx, call ->
            // Earlier icons draw on top (iOS zIndex(count - idx)).
            IconCircle(call, Modifier.zIndex((visible.size - idx).toFloat()))
        }
    }
}

@Composable
private fun IconCircle(call: WagerBotContentBlock.ToolUse, modifier: Modifier = Modifier) {
    val icon = chatIcon(WagerBotToolCatalog.icon(call.name))
    Box(
        modifier
            .size(22.dp)
            .clip(CircleShape)
            .background(AppColors.appPrimary.copy(alpha = 0.20f))
            .border(2.dp, AppColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(10.dp))
    }
}

private fun countLabel(n: Int, anyRunning: Boolean): String = when {
    anyRunning -> if (n == 1) "running" else "$n running"
    n == 1 -> "1 action"
    else -> "$n actions"
}
