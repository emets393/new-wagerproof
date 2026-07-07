package com.wagerproof.app.features.chat

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.WagerBotToolCatalog
import com.wagerproof.core.models.WagerBotToolStatus
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull

/**
 * Port of iOS `WagerBotToolUseChip.swift`. Per-tool-call chip with three
 * states: running (pulsing dot + shimmer border), done-ok (checkmark + server
 * summary + ms), done-error (red x + loss tint). One-shot success haptic on
 * first completion.
 */
@Composable
fun WagerBotToolUseChip(
    toolName: String,
    inputJson: String,
    status: WagerBotToolStatus,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    var didFinishOnce by remember { mutableStateOf(false) }

    LaunchedEffect(status) {
        val done = status as? WagerBotToolStatus.Done
        if (done != null && done.ok && !didFinishOnce) {
            didFinishOnce = true
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        }
    }

    val isError = (status as? WagerBotToolStatus.Done)?.ok == false
    val background = if (isError) AppColors.appLoss.copy(alpha = 0.10f) else AppColors.appPrimary.copy(alpha = 0.10f)
    val shape = RoundedCornerShape(10.dp)

    Row(
        modifier = modifier
            .clip(shape)
            .background(background)
            .runningBorder(status is WagerBotToolStatus.Running, shape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(14.dp), contentAlignment = Alignment.Center) { LeadingGlyph(status) }
        Text(
            text = WagerBotToolCatalog.label(toolName),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
        )
        val inputSummary = remember(inputJson) { inputSummary(inputJson) }
        if (inputSummary.isNotEmpty()) {
            Text(
                text = inputSummary,
                fontSize = 12.sp,
                color = AppColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
        (status as? WagerBotToolStatus.Done)?.let { done ->
            if (done.summary.isNotEmpty()) {
                Text(
                    text = done.summary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = AppColors.appTextSecondary,
                    maxLines = 1,
                )
            }
            Text(
                text = "${done.ms}ms",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                color = AppColors.appTextSecondary.copy(alpha = 0.7f),
            )
        }
    }
}

@Composable
private fun LeadingGlyph(status: WagerBotToolStatus) {
    when (status) {
        is WagerBotToolStatus.Running -> {
            // Pulsing dot in brand green.
            val transition = rememberInfiniteTransition(label = "runningDot")
            val a by transition.animateFloat(
                initialValue = 0.3f,
                targetValue = 1.0f,
                animationSpec = infiniteRepeatable(
                    tween(700, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                    RepeatMode.Reverse,
                ),
                label = "dot",
            )
            Box(
                Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .alpha(a)
                    .background(AppColors.appPrimary),
            )
        }
        is WagerBotToolStatus.Done -> {
            if (status.ok) {
                Icon(AppIcon.CHECKMARK.imageVector, contentDescription = null, tint = AppColors.appWin, modifier = Modifier.size(12.dp))
            } else {
                Icon(AppIcon.XMARK.imageVector, contentDescription = null, tint = AppColors.appLoss, modifier = Modifier.size(12.dp))
            }
        }
    }
}

/** Shimmer border while running; static accent-0.18 border otherwise. */
private fun Modifier.runningBorder(running: Boolean, shape: androidx.compose.ui.graphics.Shape): Modifier =
    composed {
        if (!running) {
            return@composed border(1.dp, AppColors.appPrimary.copy(alpha = 0.18f), shape)
        }
        val transition = rememberInfiniteTransition(label = "shimmerBorder")
        val phase by transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(1400, easing = androidx.compose.animation.core.LinearEasing), RepeatMode.Restart),
            label = "phase",
        )
        val brush = Brush.linearGradient(
            colorStops = arrayOf(
                (phase - 0.3f) to AppColors.appPrimary.copy(alpha = 0f),
                phase to AppColors.appPrimary.copy(alpha = 0.5f),
                (phase + 0.3f) to AppColors.appPrimary.copy(alpha = 0f),
            ),
            start = Offset.Zero,
            end = Offset.Infinite,
        )
        border(1.dp, brush, shape)
    }

/**
 * Short human-readable summary of the tool args (league / query / game_id /
 * date / limit). Mirrors iOS's inputSummary parser.
 */
private fun inputSummary(inputJson: String): String {
    val obj = runCatching { Json.parseToJsonElement(inputJson) as? JsonObject }.getOrNull() ?: return ""
    fun str(key: String): String? = (obj[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
    str("league")?.takeIf { it.isNotEmpty() }?.let { return it.uppercase() }
    str("query")?.takeIf { it.isNotEmpty() }?.let { return "“$it”" }
    str("game_id")?.takeIf { it.isNotEmpty() }?.let { return it.takeLast(8) }
    str("date")?.takeIf { it.isNotEmpty() }?.let { return it }
    (obj["limit"] as? JsonPrimitive)?.intOrNull?.let { return "limit $it" }
    return ""
}
