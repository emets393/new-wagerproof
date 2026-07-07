package com.wagerproof.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography

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
        secondary = AppColors.appPrimaryStrong,
        background = AppColors.appSurface,
        onBackground = AppColors.appTextPrimary,
        surface = AppColors.appSurface,
        onSurface = AppColors.appTextPrimary,
        surfaceVariant = AppColors.appSurfaceElevated,
        onSurfaceVariant = AppColors.appTextSecondary,
        outline = AppColors.appBorder,
        outlineVariant = AppColors.appBorderStrong,
        error = AppColors.appAccentRed,
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
        content = content,
    )
}

/** Maps the [AppTypography] ramp onto Material3's slots for stock M3 components. */
private val wagerproofM3Typography = Typography(
    displayLarge = AppTypography.displayLarge,
    displayMedium = AppTypography.display,
    titleLarge = AppTypography.title,
    titleMedium = AppTypography.headline,
    bodyLarge = AppTypography.body,
    bodyMedium = AppTypography.body,
    labelLarge = AppTypography.bodyEmphasized,
    labelMedium = AppTypography.caption,
    labelSmall = AppTypography.micro,
)
