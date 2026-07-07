package com.wagerproof.app.features.agents

import androidx.compose.ui.graphics.Color

/**
 * Helpers for the per-agent `avatar_color` field, which is either a hex string
 * ("#6366f1") or a gradient pair ("gradient:#6366f1,#ec4899"). Port of iOS
 * `AgentColorPalette.swift`. Shared by every agents-local card/hero/sheet.
 */
object AgentColorPalette {
    /** Fallback indigo when a color string is missing/malformed (Swift 0x6366F1). */
    val fallback = Color(0xFF6366F1)

    fun primary(raw: String): Color = colorFromHexString(primaryHex(raw)) ?: fallback

    fun secondary(raw: String): Color = colorFromHexString(secondaryHex(raw)) ?: primary(raw)

    fun gradient(raw: String): Pair<Color, Color> = primary(raw) to secondary(raw)

    /**
     * A two-color gradient for avatar tiles that is ALWAYS visibly two-tone.
     * When `avatar_color` is a solid hex (primary == secondary), derive a darker
     * partner so the tile has real top-left→bottom-right depth. Gradient pairs
     * are used as-is.
     */
    fun avatarGradient(raw: String): List<Color> {
        val p = primary(raw)
        return if (secondaryHex(raw).equals(primaryHex(raw), ignoreCase = true)) {
            listOf(p, p.shaded(0.55))
        } else {
            listOf(p, secondary(raw))
        }
    }

    fun primaryHex(raw: String): String {
        if (raw.startsWith("gradient:")) {
            val stripped = raw.removePrefix("gradient:")
            return stripped.split(",").firstOrNull()?.trim() ?: "#6366f1"
        }
        return raw
    }

    fun secondaryHex(raw: String): String {
        if (raw.startsWith("gradient:")) {
            val stripped = raw.removePrefix("gradient:")
            val parts = stripped.split(",")
            if (parts.size >= 2) return parts[1].trim()
            return parts.firstOrNull()?.trim() ?: "#6366f1"
        }
        return raw
    }
}

/** Multiply RGB by [factor] (<1 darkens, >1 lightens), clamped to [0,1]. */
fun Color.shaded(factor: Double): Color {
    fun cl(v: Float): Float = (v * factor.toFloat()).coerceIn(0f, 1f)
    return Color(red = cl(red), green = cl(green), blue = cl(blue), alpha = alpha)
}

/**
 * Parses "#RRGGBB" / "RRGGBB" / "#AARRGGBB" strings. Returns null on malformed
 * input (matches Swift `Color(hexString:)`).
 */
fun colorFromHexString(hexString: String): Color? {
    var s = hexString.trim()
    if (s.startsWith("#")) s = s.substring(1)
    if (s.length != 6 && s.length != 8) return null
    val value = s.toULongOrNull(16) ?: return null
    return if (s.length == 6) {
        Color(
            red = ((value shr 16) and 0xFFu).toInt() / 255f,
            green = ((value shr 8) and 0xFFu).toInt() / 255f,
            blue = (value and 0xFFu).toInt() / 255f,
            alpha = 1f,
        )
    } else {
        Color(
            alpha = ((value shr 24) and 0xFFu).toInt() / 255f,
            red = ((value shr 16) and 0xFFu).toInt() / 255f,
            green = ((value shr 8) and 0xFFu).toInt() / 255f,
            blue = (value and 0xFFu).toInt() / 255f,
        )
    }
}
