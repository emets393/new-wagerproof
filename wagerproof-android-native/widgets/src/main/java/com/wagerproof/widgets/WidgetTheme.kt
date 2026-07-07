package com.wagerproof.widgets

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp

/**
 * Inlined color tokens + sizing for the Glance home-screen widgets.
 *
 * Glance can't consume the Compose `MaterialTheme`/`:core:design` `AppColors`
 * object directly, so the DARK-canonical hex values from
 * `core/design/.../tokens/AppColors.kt` are duplicated here. Unlike the iOS
 * widgets (which follow the Home Screen's system light/dark appearance via the
 * adaptive `Color.appSurface` tokens), these are dark-only. FIDELITY-WAIVER #210.
 */
internal object WidgetTheme {
    // Mirror of AppColors dark-canonical values.
    val background = Color(0xFF0A0A0A)        // appSurface
    val card = Color(0xFF141414)              // appSurfaceElevated
    val textPrimary = Color(0xFFF8FAFC)       // appTextPrimary
    val textSecondary = Color(0xFF94A3B8)     // appTextSecondary
    val textMuted = Color(0xFF64748B)         // appTextMuted
    val accent = Color(0xFF22C55E)            // appPrimary
    val win = Color(0xFF22C55E)               // appWin
    val loss = Color(0xFFEF4444)              // appLoss

    /**
     * Per-league badge colors — mirror of iOS `WidgetSportBadge.color(for:)`.
     */
    fun sportBadge(sport: String): Color = when (sport.lowercase()) {
        "nfl" -> Color(0xFF013369)
        "nba" -> Color(0xFF1D428A)
        "cfb" -> Color(0xFF8B0000)
        "ncaab" -> Color(0xFFFF6600)
        "mlb" -> Color(0xFF002D72)
        else -> Color(0xFF6366F1)
    }

    /**
     * Parses "#RRGGBB" / "RRGGBB" agent avatar colors — mirror of iOS
     * `Color(widgetHexString:)`. Returns null on malformed input.
     */
    fun parseHex(hexString: String): Color? {
        var s = hexString.trim()
        if (s.startsWith("#")) s = s.substring(1)
        if (s.length != 6) return null
        val value = s.toLongOrNull(16) ?: return null
        return Color(0xFF000000 or value)
    }
}

/**
 * Responsive size buckets that stand in for the three iOS widget families
 * (systemSmall / systemMedium / systemLarge). Glance picks the closest bucket
 * to the placed size and exposes it via `LocalSize.current`.
 */
internal object WidgetSizes {
    val SMALL = DpSize(140.dp, 140.dp)
    val MEDIUM = DpSize(300.dp, 140.dp)
    val LARGE = DpSize(300.dp, 300.dp)
    val ALL = setOf(SMALL, MEDIUM, LARGE)
}

internal enum class WidgetFamily { SMALL, MEDIUM, LARGE }
