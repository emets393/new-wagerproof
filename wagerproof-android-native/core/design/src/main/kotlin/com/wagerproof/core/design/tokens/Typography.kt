package com.wagerproof.core.design.tokens

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Wagerproof typography ramp — ported from iOS `Typography.swift` (`AppFont`).
 *
 * iOS uses SF with `design: .rounded` for display + odds styles — that rounded
 * personality is the visual signature to replicate.
 *
 * // FIDELITY-WAIVER #204: the rounded-family substitute (Nunito per doc
 * // §10.2) is pending font bundling — the app must stay self-contained (no
 * // downloadable fonts), so rounded styles currently render in the platform
 * // default. Swap [RoundedFontFamily] once the font files are committed.
 */
object AppTypography {
    /**
     * TODO(#204): replace with a bundled rounded family (Nunito recommended —
     * closest metrics to SF Rounded at bold/heavy; see 04_design.md §10.2).
     */
    val RoundedFontFamily: FontFamily = FontFamily.Default

    val displayLarge = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 34.sp,
        fontWeight = FontWeight.Bold,
    )
    val display = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 28.sp,
        fontWeight = FontWeight.Bold,
    )
    val title = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
    )
    val headline = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 17.sp,
        fontWeight = FontWeight.SemiBold,
    )
    val body = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 15.sp,
        fontWeight = FontWeight.Normal,
    )
    val bodyEmphasized = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 15.sp,
        fontWeight = FontWeight.SemiBold,
    )
    val caption = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
    )
    val captionEmphasized = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
    )
    val micro = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
    )

    // iOS `Font.system(.body/.caption, design: .monospaced)` — text-style
    // sizes (17/12 pt), not the ramp's body/caption sizes. Used for ticket
    // stamp values and the thinking terminal.
    val mono = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 17.sp,
        fontWeight = FontWeight.Normal,
    )
    val monoCaption = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 12.sp,
        fontWeight = FontWeight.Normal,
    )

    val oddsLarge = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 28.sp,
        fontWeight = FontWeight.Bold,
    )
    val oddsMedium = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
    )
    val oddsSmall = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
    )
}
