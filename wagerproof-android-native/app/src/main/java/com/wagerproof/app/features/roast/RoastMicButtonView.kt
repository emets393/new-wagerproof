package com.wagerproof.app.features.roast

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.RoastSessionStore

/**
 * Port of iOS `Roast/Components/RoastMicButtonView.swift`. 80dp circular mic
 * button with a radar ring + breathing pulse while recording. Choreography
 * mirrors `wagerproof-mobile/components/roast/RoastMicButton.tsx`:
 *   - expanding ring scales 1→2 over 1.2s, opacity 0.6→0 (radar ping)
 *   - inner pulse glow scales 1→1.3 over 0.8s autoreverse, opacity 0.1↔0.4
 *   - button green when recording, muted gray while processing, dark gray idle.
 *
 * FIDELITY-WAIVER #061 — Android has no speech-to-text seam wired into this
 * button; [onTap] is a null seam driven by the caller (RoastSessionStore.toggle
 * has no attached driver on Android). The UI is ported faithfully; the mic
 * action is inert until a driver is attached.
 */
@Composable
fun RoastMicButtonView(
    state: RoastSessionStore.SessionState,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val isRecording = state == RoastSessionStore.SessionState.recording
    val isProcessing =
        state == RoastSessionStore.SessionState.processing ||
            state == RoastSessionStore.SessionState.responding

    val transition = rememberInfiniteTransition(label = "mic")
    // Radar ring phase: 0→1 linear over 1.2s (no autoreverse).
    val ringPhase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Restart),
        label = "ring",
    )
    // Inner pulse phase: 0→1 ease over 0.8s, autoreverse.
    val pulsePhase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "pulse",
    )

    val buttonColor = when {
        isRecording -> AppColors.appPrimary
        isProcessing -> Color(0xFF6B6B6B)
        else -> Color(0xFF383838)
    }
    // RN icon swap: dots-horizontal while processing (not recording), mic
    // otherwise. "ellipsis.circle" resolves to Icons.Rounded.MoreHoriz (plain
    // three dots) — the AppIcon registry has no bare "ellipsis" key.
    val iconName = if (isProcessing && !isRecording) "ellipsis.circle" else "mic.fill"
    val iconColor = if (isRecording) Color.Black else Color.White

    val buttonSize = 80.dp
    val interaction = remember { MutableInteractionSource() }

    Box(
        modifier.size(buttonSize * 2.5f),
        contentAlignment = Alignment.Center,
    ) {
        // ---- Expanding radar ring -------------------------------------------
        if (isRecording) {
            Box(
                Modifier
                    .size(buttonSize)
                    .scale(1f + ringPhase)
                    .graphicsLayer { alpha = 0.6f * (1f - ringPhase) }
                    .border(2.dp, AppColors.appPrimary, CircleShape),
            )
            // ---- Inner pulse glow -------------------------------------------
            Box(
                Modifier
                    .size(buttonSize)
                    .scale(1f + 0.3f * pulsePhase)
                    .graphicsLayer { alpha = 0.1f + 0.3f * pulsePhase }
                    .clip(CircleShape)
                    .background(AppColors.appPrimary),
            )
        }

        // ---- The button itself ----------------------------------------------
        Box(
            Modifier
                .size(buttonSize)
                .shadow(8.dp, CircleShape)
                .clip(CircleShape)
                .background(buttonColor)
                .clickable(
                    interactionSource = interaction,
                    indication = null,
                    enabled = state != RoastSessionStore.SessionState.processing,
                    onClick = onTap,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName(iconName)!!.imageVector,
                contentDescription = accessibilityLabel(state),
                tint = iconColor,
                modifier = Modifier.size(36.dp),
            )
        }
    }
}

private fun accessibilityLabel(state: RoastSessionStore.SessionState): String = when (state) {
    RoastSessionStore.SessionState.idle -> "Start recording"
    RoastSessionStore.SessionState.recording -> "Stop recording"
    RoastSessionStore.SessionState.processing -> "Thinking, please wait"
    RoastSessionStore.SessionState.responding -> "Interrupt and start a new turn"
}
