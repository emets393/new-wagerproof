package com.wagerproof.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.CornerRadius

/**
 * Root theme wrapper. The app ships dark-only (iOS forces dark by overriding
 * every UIWindow's interface style — doc 08 §1.1; ThemeStore coerces to dark).
 * Android has no per-window override, so we simply always build the dark scheme
 * and never read the system setting.
 *
 * System bars are made transparent here (edge-to-edge is enabled on the
 * Activity) with light icons, so content draws under the status/nav bars the
 * way the iOS layout expects.
 */
@Composable
fun WagerproofTheme(content: @Composable () -> Unit) {
    val colorScheme = darkColorScheme(
        primary = AppColors.appPrimary,
        onPrimary = AppColors.appTextInverse,
        primaryContainer = AppColors.appPrimaryStrong,
        onPrimaryContainer = Color.White,
        secondary = AppColors.appPrimaryStrong,
        onSecondary = AppColors.appTextPrimary,
        secondaryContainer = AppColors.appSurfaceMuted,
        onSecondaryContainer = AppColors.appTextPrimary,
        tertiary = AppColors.appAccentBlue,
        onTertiary = AppColors.appTextPrimary,
        tertiaryContainer = AppColors.appAccentBlue.copy(alpha = 0.22f),
        onTertiaryContainer = AppColors.appTextPrimary,
        background = AppColors.appSurface,
        onBackground = AppColors.appTextPrimary,
        surface = AppColors.appSurface,
        onSurface = AppColors.appTextPrimary,
        surfaceDim = AppColors.appSurface,
        surfaceBright = AppColors.appSurfaceMuted,
        surfaceContainerLowest = AppColors.appSurface,
        surfaceContainerLow = AppColors.appSurfaceElevated,
        surfaceContainer = AppColors.appSurfaceElevated,
        surfaceContainerHigh = AppColors.appSurfaceMuted,
        surfaceContainerHighest = AppColors.appBorder,
        surfaceVariant = AppColors.appSurfaceElevated,
        onSurfaceVariant = AppColors.appTextSecondary,
        surfaceTint = Color.Transparent,
        inverseSurface = AppColors.appTextPrimary,
        inverseOnSurface = AppColors.appTextInverse,
        inversePrimary = AppColors.appPrimaryStrong,
        outline = AppColors.appBorder,
        outlineVariant = AppColors.appBorderStrong,
        error = AppColors.appAccentRed,
        onError = Color.White,
        errorContainer = AppColors.appAccentRed.copy(alpha = 0.18f),
        onErrorContainer = AppColors.appTextPrimary,
        scrim = Color.Black,
    )

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            // Activity.enableEdgeToEdge() already makes both bars transparent; we
            // only force light (dark-app) icons here since the app never goes light.
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = wagerproofM3Typography,
        shapes = wagerproofM3Shapes,
        content = content,
    )
}

/** Maps the [AppTypography] ramp onto Material3's slots for stock M3 components. */
private val wagerproofM3Typography = Typography(
    displayLarge = AppTypography.displayLarge,
    displayMedium = AppTypography.display,
    displaySmall = AppTypography.title,
    headlineLarge = AppTypography.display,
    headlineMedium = AppTypography.title,
    headlineSmall = AppTypography.headline,
    titleLarge = AppTypography.title,
    titleMedium = AppTypography.headline,
    titleSmall = AppTypography.bodyEmphasized,
    bodyLarge = AppTypography.body,
    bodyMedium = AppTypography.body,
    bodySmall = AppTypography.caption,
    labelLarge = AppTypography.bodyEmphasized,
    labelMedium = AppTypography.captionEmphasized,
    labelSmall = AppTypography.micro,
)

/** Makes stock Material controls inherit the same radii as SwiftUI surfaces. */
private val wagerproofM3Shapes = Shapes(
    extraSmall = RoundedCornerShape(CornerRadius.sm),
    small = RoundedCornerShape(CornerRadius.sm),
    medium = RoundedCornerShape(CornerRadius.md),
    large = RoundedCornerShape(CornerRadius.lg),
    extraLarge = RoundedCornerShape(CornerRadius.xl),
)
