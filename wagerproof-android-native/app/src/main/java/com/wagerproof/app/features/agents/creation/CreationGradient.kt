package com.wagerproof.app.features.agents.creation

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.agents.AgentColorPalette

/**
 * Top-left → bottom-right avatar/swatch brush for an `avatar_color` wire string
 * ("gradient:#a,#b" or "#hex"). Mirrors iOS `gradientView(for:)`: two hexes →
 * linear gradient; a single hex → flat (both stops equal). Uses the shared
 * [AgentColorPalette] parser so it stays byte-for-byte with the rest of agents.
 */
fun avatarBrush(raw: String): Brush {
    val (primary, secondary) = AgentColorPalette.gradient(raw)
    return Brush.linearGradient(
        colors = listOf(primary, secondary),
        start = Offset(0f, 0f),
        end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
    )
}

/** First hex of an `avatar_color`, as a Color (fallback indigo). */
fun avatarPrimaryColor(raw: String): Color = AgentColorPalette.primary(raw)
