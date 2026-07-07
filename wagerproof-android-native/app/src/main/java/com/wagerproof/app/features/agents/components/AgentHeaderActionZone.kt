package com.wagerproof.app.features.agents.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.launch

// ---------------------------------------------------------------------------
// AgentHeaderActionZone — the idle "generate your picks" prompt for the agent
// detail picks area. Port of iOS AgentHeaderActionZone.swift. The Generate
// button is the hero (with a shimmer glint); autopilot is demoted to a small
// AutopilotChip in the top-right; regenerate is a hold-to-confirm pill.
// ---------------------------------------------------------------------------

/**
 * Idle prompt: a short header invites a generation now, with the auto-pilot
 * schedule offered as the wait-it-out alternative. Generate is the section hero.
 */
@Composable
fun AgentGeneratePrompt(
    accent: Color,
    title: String,
    subtitle: String,
    autoGenerate: Boolean,
    onToggleAuto: (Boolean) -> Unit,
    canGenerate: Boolean,
    buttonLabel: String,
    onGenerate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
            Column(
                modifier = Modifier.weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = title,
                    color = AppColors.appTextPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                )
                Text(
                    text = subtitle,
                    color = AppColors.appTextSecondary,
                    fontSize = 12.sp,
                )
            }
            Spacer(Modifier.width(8.dp).weight(1f))
            AutopilotChip(isOn = autoGenerate, accent = accent, onToggle = onToggleAuto)
        }

        ShimmerGenerateButton(label = buttonLabel, enabled = canGenerate, accent = accent, action = onGenerate)
    }
}

/**
 * Prominent generate CTA. A white copy of the label masked by the shared
 * `.shimmering()` band is layered over the filled button so a glint sweeps
 * across the text — the "use me" affordance — without eating the button's fill.
 */
@Composable
fun ShimmerGenerateButton(
    label: String,
    enabled: Boolean,
    accent: Color,
    action: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(CircleShape)
            .background(if (enabled) accent else AppColors.appSurfaceMuted)
            .let {
                if (enabled) it.clickable(interactionSource = interaction, indication = null, onClick = action) else it
            }
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        // Base label.
        LabelRow(
            label = label,
            systemImage = if (enabled) "sparkles" else "lock.fill",
            tint = if (enabled) Color.Black else AppColors.appTextSecondary,
        )
        // Shimmer glint: a translucent-white copy of the label sweeping across.
        // (iOS composites this plusLighter; alpha-over is the Compose stand-in.)
        if (enabled) {
            LabelRow(
                label = label,
                systemImage = "sparkles",
                tint = Color.White.copy(alpha = 0.6f),
                modifier = Modifier.shimmering(),
            )
        }
    }
}

@Composable
private fun LabelRow(label: String, systemImage: String, tint: Color, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = agentSymbol(systemImage),
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(15.dp),
        )
        Text(text = label, color = tint, fontSize = 15.sp, fontWeight = FontWeight.Black)
    }
}

/**
 * The tucked-away autopilot control: a small tinted Liquid-Glass pill that
 * toggles auto-generation on tap. The accent tint pulses stronger when on,
 * fainter when off, so both states read as translucent glass.
 */
@Composable
fun AutopilotChip(
    isOn: Boolean,
    accent: Color,
    onToggle: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier = modifier
            .clip(CircleShape)
            .liquidGlassBackground(CircleShape, tint = accent.copy(alpha = if (isOn) 0.4f else 0.22f))
            .border(1.dp, accent.copy(alpha = if (isOn) 0.6f else 0.25f), CircleShape)
            .clickable(interactionSource = interaction, indication = null) { onToggle(!isOn) }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = agentSymbol("bolt.badge.automatic"),
            contentDescription = null,
            // ON: primary text over accent glass (accent-on-accent would vanish).
            tint = if (isOn) AppColors.appTextPrimary else AppColors.appTextSecondary,
            modifier = Modifier.size(11.dp),
        )
        Text(
            text = if (isOn) "Auto" else "Manual",
            color = if (isOn) AppColors.appTextPrimary else AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
        )
    }
}

/**
 * Hold-to-confirm regenerate control. A tinted Liquid-Glass pill that fills
 * left→right with the accent while pressed; completing a full [HOLD_DURATION_MS]
 * hold fires [onRegen] (with a success haptic). Releasing early rewinds the fill.
 * When [enabled] is false it shows a "Limit reached" lock and ignores touches.
 */
@Composable
fun HoldToRegenButton(
    accent: Color,
    enabled: Boolean,
    onRegen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val progress = remember { Animatable(0f) }
    var holding by remember { mutableStateOf(false) }

    val label = when {
        !enabled -> "Limit reached"
        holding -> "Keep holding…"
        else -> "Hold to Regenerate"
    }
    // White reads over both the accent glass (idle) and the accent progress fill.
    val foreground = if (enabled) Color.White else AppColors.appTextSecondary

    Row(
        modifier = modifier
            .clip(CircleShape)
            .liquidGlassBackground(CircleShape, tint = if (enabled) accent.copy(alpha = 0.35f) else null)
            // Accent progress fill grows left→right, over the glass, under the label.
            .drawBehind {
                if (progress.value > 0f) {
                    drawRect(
                        color = accent.copy(alpha = 0.85f),
                        size = androidx.compose.ui.geometry.Size(size.width * progress.value, size.height),
                    )
                }
            }
            .border(
                1.dp,
                if (enabled) accent.copy(alpha = 0.55f) else Color.White.copy(alpha = 0.12f),
                CircleShape,
            )
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    holding = true
                    var fired = false
                    val job = scope.launch {
                        progress.animateTo(1f, tween(HOLD_DURATION_MS, easing = LinearEasing))
                        fired = true
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        onRegen()
                        progress.animateTo(0f, tween(300))
                        holding = false
                    }
                    waitForUpOrCancellation()
                    if (!fired) {
                        job.cancel()
                        holding = false
                        scope.launch { progress.animateTo(0f, tween(250)) }
                    }
                }
            }
            .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = agentSymbol(if (enabled) "arrow.clockwise" else "lock.fill"),
            contentDescription = null,
            tint = foreground,
            modifier = Modifier.size(12.dp),
        )
        Text(
            text = label,
            color = foreground,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
        )
    }
}

/** Seconds the user must hold before the regeneration fires (iOS holdDuration = 5.0). */
private const val HOLD_DURATION_MS = 5000
