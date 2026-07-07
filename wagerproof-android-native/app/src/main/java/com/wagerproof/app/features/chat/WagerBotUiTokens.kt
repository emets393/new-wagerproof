package com.wagerproof.app.features.chat

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon

/**
 * Port of iOS `WagerBotChatSharedTypes.swift`.
 *
 * Color tokens for the WagerBot chat surface — resolved once at the top of the
 * chat surface and passed down by value to children (matches iOS's
 * pass-by-value struct). The Android app is dark-only, so [dark] is canonical;
 * the [light] variant is preserved for a hypothetical light theme.
 */
@Immutable
data class WagerBotUiTokens(
    val pageBackground: Color,
    val surfaceBackground: Color,
    val borderColor: Color,
    val primaryText: Color,
    val mutedText: Color,
    val userBubbleBackground: Color,
    val userBubbleText: Color,
    val assistantBubbleBackground: Color,
    val assistantBubbleText: Color,
    val composerBackground: Color,
    val composerBorder: Color,
    val hintChipBackground: Color,
    val hintChipText: Color,
    val controlBackground: Color,
    val primaryActionBackground: Color,
    val primaryActionForeground: Color,
    /** Brand tint for tool chips, thinking indicator, send button. */
    val accent: Color,
) {
    companion object {
        fun resolve(isDark: Boolean = true): WagerBotUiTokens = if (isDark) dark else light

        val dark = WagerBotUiTokens(
            pageBackground = hexColor(0x0A0A0A),
            surfaceBackground = hexColor(0x141414),
            borderColor = hexColor(0x262626),
            primaryText = hexColor(0xF8FAFC),
            mutedText = hexColor(0x94A3B8),
            userBubbleBackground = hexColor(0x1F1F1F),
            userBubbleText = hexColor(0xF8FAFC),
            assistantBubbleBackground = hexColor(0x141414),
            assistantBubbleText = hexColor(0xF8FAFC),
            composerBackground = hexColor(0x141414),
            composerBorder = hexColor(0x2A2A2A),
            hintChipBackground = hexColor(0x1A1A1A),
            hintChipText = hexColor(0xE2E8F0),
            controlBackground = hexColor(0x1F1F1F),
            primaryActionBackground = hexColor(0xF8FAFC),
            primaryActionForeground = hexColor(0x0A0A0A),
            accent = hexColor(0x22C55E),
        )

        val light = WagerBotUiTokens(
            pageBackground = hexColor(0xFFFFFF),
            surfaceBackground = hexColor(0xF8FAFC),
            borderColor = hexColor(0xE2E8F0),
            primaryText = hexColor(0x0F172A),
            mutedText = hexColor(0x64748B),
            userBubbleBackground = hexColor(0xF1F5F9),
            userBubbleText = hexColor(0x0F172A),
            assistantBubbleBackground = hexColor(0xFFFFFF),
            assistantBubbleText = hexColor(0x0F172A),
            composerBackground = hexColor(0xFFFFFF),
            composerBorder = hexColor(0xE2E8F0),
            hintChipBackground = hexColor(0xF1F5F9),
            hintChipText = hexColor(0x334155),
            controlBackground = hexColor(0xF1F5F9),
            primaryActionBackground = hexColor(0x0F172A),
            primaryActionForeground = hexColor(0xFFFFFF),
            accent = hexColor(0x16A34A),
        )
    }
}

/**
 * The WagerBot brand mark — a sparkle. iOS ships a bespoke `WagerBotIcon`
 * (WagerproofDesign); the closest Material analog is the sparkles/AutoAwesome
 * glyph. Tint is applied by the caller.
 */
@Composable
fun WagerBotIcon(size: Dp, tint: Color, modifier: Modifier = Modifier) {
    Box(modifier.size(size)) {
        Icon(
            imageVector = AppIcon.SPARKLES.imageVector,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(size),
        )
    }
}

/**
 * Resolve an SF Symbol name coming straight out of the transplanted chat Swift
 * to an [ImageVector]. Resolves via the shared [AppIcon] map first; a handful
 * of chat-only glyphs (sport `.fill` variants, tool + widget icons) are not in
 * that map, so this falls back to the closest existing symbol.
 *
 * // FIDELITY-WAIVER #220: several fallbacks are approximations (stop.fill →
 * // pause, cloud.sun.fill → sparkles, cross.case.fill → bandage) — Material
 * // has no exact analog and the shared AppIcon map is intentionally not grown
 * // for every one-off chat glyph.
 */
fun chatIcon(systemName: String): ImageVector {
    AppIcon.fromSystemName(systemName)?.let { return it.imageVector }
    val fallback = when (systemName) {
        "basketball.fill" -> "basketball"
        "baseball.fill" -> "baseball"
        "stop.fill" -> "pause.circle"
        "globe" -> "magnifyingglass"
        "wrench.and.screwdriver.fill", "chart.bar.doc.horizontal.fill" -> "chart.bar.fill"
        "doc.text.magnifyingglass" -> "magnifyingglass"
        "questionmark.bubble.fill" -> "bubble.left.and.bubble.right.fill"
        "waveform.circle.fill" -> "waveform"
        "face.smiling.inverse" -> "person.crop.circle.fill"
        "phone.down.fill" -> "xmark.circle.fill"
        "pin.slash.fill" -> "pin.fill"
        "cross.fill", "cross.case.fill" -> "bandage"
        "cloud.sun.fill" -> "sparkles"
        "rectangle.split.2x1.fill" -> "square.grid.2x2.fill"
        else -> null
    }
    fallback?.let { AppIcon.fromSystemName(it)?.let { icon -> return icon.imageVector } }
    return AppIcon.HAMMER_FILL.imageVector
}
