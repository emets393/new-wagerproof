package com.wagerproof.core.design.tokens

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.R

/**
 * Wagerproof typography ramp — ported from iOS `Typography.swift` (`AppFont`).
 *
 * iOS uses SF with `design: .rounded` for display + odds styles — that rounded
 * personality is the visual signature to replicate.
 *
 * Body/caption text deliberately remains Android-native for locale coverage and
 * familiar reading metrics. Display, odds, and major CTA text use bundled
 * Nunito (SIL OFL 1.1), the closest offline analogue to SF Rounded.
 */
object AppTypography {
    val SystemFontFamily: FontFamily = FontFamily.SansSerif

    val RoundedFontFamily: FontFamily = FontFamily(
        Font(R.font.nunito_variable, weight = FontWeight.Medium),
        Font(R.font.nunito_variable, weight = FontWeight.SemiBold),
        Font(R.font.nunito_variable, weight = FontWeight.Bold),
        Font(R.font.nunito_variable, weight = FontWeight.ExtraBold),
        Font(R.font.nunito_variable, weight = FontWeight.Black),
    )

    private val appLineHeightStyle = LineHeightStyle(
        alignment = LineHeightStyle.Alignment.Center,
        trim = LineHeightStyle.Trim.Both,
    )

    val displayLarge = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 34.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 41.sp,
        lineHeightStyle = appLineHeightStyle,
        letterSpacing = (-0.4).sp,
    )
    val display = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 28.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 34.sp,
        lineHeightStyle = appLineHeightStyle,
        letterSpacing = (-0.25).sp,
    )
    val title = TextStyle(
        fontFamily = SystemFontFamily,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 28.sp,
        lineHeightStyle = appLineHeightStyle,
        letterSpacing = (-0.15).sp,
    )
    val headline = TextStyle(
        fontFamily = SystemFontFamily,
        fontSize = 17.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 22.sp,
        lineHeightStyle = appLineHeightStyle,
        letterSpacing = (-0.05).sp,
    )
    val body = TextStyle(
        fontFamily = SystemFontFamily,
        fontSize = 15.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 20.sp,
        lineHeightStyle = appLineHeightStyle,
    )
    val bodyEmphasized = TextStyle(
        fontFamily = SystemFontFamily,
        fontSize = 15.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 20.sp,
        lineHeightStyle = appLineHeightStyle,
    )
    val caption = TextStyle(
        fontFamily = SystemFontFamily,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        lineHeight = 18.sp,
        lineHeightStyle = appLineHeightStyle,
    )
    val captionEmphasized = TextStyle(
        fontFamily = SystemFontFamily,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 18.sp,
        lineHeightStyle = appLineHeightStyle,
    )
    val micro = TextStyle(
        fontFamily = SystemFontFamily,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        lineHeight = 14.sp,
        lineHeightStyle = appLineHeightStyle,
        letterSpacing = 0.1.sp,
    )

    // iOS `Font.system(.body/.caption, design: .monospaced)` — text-style
    // sizes (17/12 pt), not the ramp's body/caption sizes. Used for ticket
    // stamp values and the thinking terminal.
    val mono = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 17.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 22.sp,
        lineHeightStyle = appLineHeightStyle,
    )
    val monoCaption = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontSize = 12.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 16.sp,
        lineHeightStyle = appLineHeightStyle,
    )

    val oddsLarge = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 28.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 32.sp,
        lineHeightStyle = appLineHeightStyle,
        letterSpacing = (-0.2).sp,
    )
    val oddsMedium = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 22.sp,
        lineHeightStyle = appLineHeightStyle,
    )
    val oddsSmall = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        lineHeight = 17.sp,
        lineHeightStyle = appLineHeightStyle,
    )

    /** Prominent pill/button copy; ordinary controls continue using system UI. */
    val majorCta = TextStyle(
        fontFamily = RoundedFontFamily,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 20.sp,
        lineHeightStyle = appLineHeightStyle,
        letterSpacing = 0.05.sp,
    )
}
