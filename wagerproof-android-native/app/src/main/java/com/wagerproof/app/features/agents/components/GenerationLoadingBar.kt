package com.wagerproof.app.features.agents.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.services.TriggerV3RunStatus

/**
 * Linear polling-progress bar tinted with the agent accent — port of iOS
 * `GenerationLoadingBar.swift`. [fraction] is turn / maxTurns, clamped 0..1.
 */
@Composable
fun GenerationLoadingBar(
    fraction: Float,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val animated by animateFloatAsState(
        targetValue = fraction.coerceIn(0f, 1f),
        animationSpec = tween(durationMillis = 500),
        label = "generationProgress",
    )
    LinearProgressIndicator(
        progress = { animated },
        modifier = modifier.fillMaxWidth(),
        color = accent,
        trackColor = AppColors.appSurfaceMuted,
    )
}

/** Polling-state working orange (iOS `kGenerationOrange` family). */
private val GenerationOrange = Color(0xFFFF8A00)
private val SuccessGreen = Color(0xFF00E676)

/**
 * The Today's Picks generation card — port of iOS `AgentGenerationCard`
 * (AgentGenerationGlyphLoader.swift). One card that owns both states:
 *
 *   • **Research (idle):** the agent's pixel avatar + "Research in Progress"
 *     line, with a generate CTA (locked copy when [canGenerate] is false).
 *   • **Polling (running):** live action verbs from the Trigger.dev run
 *     metadata, a picks-found chip, and a [GenerationLoadingBar] (turn/maxTurns).
 *
 * FIDELITY-WAIVER: the iOS glyph-matrix / pixel-pulse-wave / swipe-pill
 * flourishes are not ported — behavior (states, copy, metadata wiring) is.
 */
@Composable
fun AgentGenerationCard(
    spriteIndex: Int,
    accent: Color,
    state: TriggerV3RunStatus?,
    isGenerating: Boolean,
    canGenerate: Boolean,
    lockedLabel: String,
    conclusion: String? = null,
    onGenerate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = state?.metadata
    val polling = isGenerating
    // turn/maxTurns, capped below 1 until terminal; a sliver pre-first-turn so
    // the bar still reads as alive (mirrors the iOS fraction derivation).
    val fraction: Float = when {
        state?.isTerminal == true -> 1f
        (meta?.maxTurns ?: 0) > 0 -> minOf(0.96f, (meta?.turn ?: 0).toFloat() / (meta?.maxTurns ?: 1).toFloat())
        (meta?.turn ?: 0) > 0 -> 0.12f
        else -> 0.05f
    }
    val picksFound = meta?.picksAccepted ?: 0
    val currentToolLabel: String? = meta?.currentTool?.takeIf { it.isNotEmpty() }?.let { tool ->
        meta.currentToolDetail?.takeIf { it.isNotEmpty() }?.let { "$tool · $it" } ?: tool
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(Color.Black)
            .border(1.dp, accent.copy(alpha = 0.16f), RoundedCornerShape(26.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // The no-picks conclusion sits ABOVE the avatar (two green console lines).
        if (conclusion != null && !polling) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ConsoleLine("Analysis complete: no high-confidence picks found.", SuccessGreen)
                ConsoleLine(conclusion, SuccessGreen.copy(alpha = 0.72f))
            }
        }

        if (!polling) {
            // Research state: the pixel character, centered.
            Box(Modifier.fillMaxWidth().padding(top = 12.dp), contentAlignment = Alignment.Center) {
                PixelSpriteAvatar(spriteIndex = spriteIndex, modifier = Modifier.size(120.dp))
            }
        } else if (picksFound > 0) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Row(
                    Modifier
                        .background(accent.copy(alpha = 0.18f), CircleShape)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(agentSymbol("checkmark.seal.fill"), contentDescription = null, tint = accent, modifier = Modifier.size(10.dp))
                    Text("$picksFound found", color = accent, fontSize = 11.sp, fontWeight = FontWeight.Black)
                }
            }
        }

        // Status line: research shimmer copy ↔ live action verbs.
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                Modifier
                    .size(8.dp)
                    .background(if (polling) GenerationOrange else accent, CircleShape),
            )
            Text(
                if (polling) (currentToolLabel ?: "Working the slate…") else "Research in Progress",
                color = if (polling) GenerationOrange else accent,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
            )
        }

        // Bottom bar: loading bar while polling, generate CTA while idle.
        if (polling) {
            GenerationLoadingBar(
                fraction = fraction,
                accent = accent,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
        } else {
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp)
                    .clip(CircleShape)
                    .background(accent.copy(alpha = if (canGenerate) 0.32f else 0.14f))
                    .border(1.dp, accent.copy(alpha = if (canGenerate) 0.55f else 0.25f), CircleShape)
                    .clickable(enabled = canGenerate, onClick = onGenerate)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (!canGenerate) {
                        Icon(agentSymbol("lock.fill"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp))
                    }
                    Text(
                        if (canGenerate) "Get picks" else lockedLabel,
                        color = if (canGenerate) Color.White else AppColors.appTextSecondary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
            }
            Spacer(Modifier.height(2.dp))
        }
    }
}

@Composable
private fun ConsoleLine(text: String, tint: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("›", color = SuccessGreen, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
        Text(text, color = tint, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
    }
}
