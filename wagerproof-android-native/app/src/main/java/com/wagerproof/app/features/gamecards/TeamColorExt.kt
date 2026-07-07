package com.wagerproof.app.features.gamecards

import androidx.compose.ui.graphics.Color
import androidx.core.graphics.ColorUtils
import kotlin.math.max
import kotlin.math.pow

/**
 * Team-color luminance + visibility helpers — port of the iOS `Color`
 * extensions used by `GameRowCard` / `MatchupGlassHero` / avatars.
 */

/** WCAG relative luminance (0 dark … 1 light). */
fun Color.relativeLuminance(): Float {
    fun lin(c: Float): Float = if (c <= 0.03928f) c / 12.92f else ((c + 0.055f) / 1.055f).pow(2.4f)
    return 0.2126f * lin(red) + 0.7152f * lin(green) + 0.0722f * lin(blue)
}

/**
 * Lift a team color for dark-mode legibility: HSB brightness floored at
 * [minBrightness], saturation scaled ×0.9 (matches iOS `teamVisible`).
 */
fun Color.teamVisible(minBrightness: Float = 0.5f): Color {
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL(this.toArgb32(), hsl)
    // HSL lightness ≈ HSB proxy: raise the floor and gently desaturate.
    hsl[1] = (hsl[1] * 0.9f).coerceIn(0f, 1f)
    hsl[2] = max(hsl[2], minBrightness)
    return Color(ColorUtils.HSLToColor(hsl))
}

private fun Color.toArgb32(): Int {
    val a = (alpha * 255).toInt() and 0xFF
    val r = (red * 255).toInt() and 0xFF
    val g = (green * 255).toInt() and 0xFF
    val b = (blue * 255).toInt() and 0xFF
    return (a shl 24) or (r shl 16) or (g shl 8) or b
}
