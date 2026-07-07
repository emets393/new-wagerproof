package com.wagerproof.app.features.settings

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing

/**
 * Shared vocabulary for the Settings feature (main page + sub-modals). Kept in
 * one file so the flat "profile list" aesthetic — monochrome outline glyphs,
 * airy muted headers, hairline inset dividers — stays in lockstep everywhere,
 * exactly as iOS keeps `ProfileRow`/`ProfileSectionHeader` private to SettingsView.
 */

/** Icon column width (icon + divider inset alignment, from iOS `iconColumnWidth`). */
internal val SettingsIconColumnWidth = 26.dp

/** Trailing accessory on a [ProfileRow]. */
internal enum class RowAccessory { Chevron, External, None }

/**
 * Top bar for a pushed/presented settings sub-screen. [large] mirrors iOS's
 * large-title Developer screen (leading back chevron); the compact form mirrors
 * the inline-title modals (trailing X close).
 */
@Composable
internal fun SettingsSubScreenBar(
    title: String,
    onDismiss: () -> Unit,
    large: Boolean = false,
) {
    if (large) {
        Column(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.sm)) {
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = AppIcon.CHEVRON_LEFT.imageVector,
                    contentDescription = "Back",
                    tint = AppColors.appTextPrimary,
                )
            }
            Text(
                text = title,
                style = AppTypography.displayLarge,
                color = AppColors.appTextPrimary,
                modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.xs),
            )
        }
    } else {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.lg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = title,
                style = AppTypography.headline,
                color = AppColors.appTextPrimary,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = AppIcon.XMARK.imageVector,
                    contentDescription = "Close",
                    tint = AppColors.appTextPrimary,
                )
            }
        }
    }
}

/** Muted, airy section header — sentence case, generous top breathing room. */
@Composable
internal fun ProfileSectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 15.sp,
        fontWeight = FontWeight.Normal,
        color = AppColors.appTextMuted,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.lg)
            .padding(top = Spacing.xl, bottom = Spacing.sm),
    )
}

/**
 * Flat settings row: monochrome outline glyph + title (+ optional subtitle) +
 * trailing accessory. No tinted icon chip, no card background. `onClick == null`
 * renders a non-interactive display row (e.g. the email row).
 */
@Composable
internal fun ProfileRow(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    accessory: RowAccessory = RowAccessory.Chevron,
    destructive: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    val tint = if (destructive) AppColors.appAccentRed else AppColors.appTextSecondary
    val titleColor = if (destructive) AppColors.appAccentRed else AppColors.appTextPrimary

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(horizontal = Spacing.lg, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.width(SettingsIconColumnWidth),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = title, fontSize = 17.sp, fontWeight = FontWeight.Normal, color = titleColor)
            if (subtitle != null) {
                Text(text = subtitle, style = AppTypography.caption, color = AppColors.appTextMuted)
            }
        }
        when (accessory) {
            RowAccessory.Chevron -> Icon(
                imageVector = AppIcon.CHEVRON_RIGHT.imageVector,
                contentDescription = null,
                tint = AppColors.appTextMuted,
                modifier = Modifier.size(16.dp),
            )
            RowAccessory.External -> Icon(
                imageVector = AppIcon.ARROW_UP_RIGHT.imageVector,
                contentDescription = null,
                tint = AppColors.appTextMuted,
                modifier = Modifier.size(16.dp),
            )
            RowAccessory.None -> Unit
        }
    }
}

/** Hairline divider inset to start under the row title (clears the icon column). */
@Composable
internal fun RowDivider() {
    Box(
        modifier = Modifier
            .padding(start = Spacing.lg + SettingsIconColumnWidth + Spacing.lg)
            .fillMaxWidth()
            .height(0.5.dp)
            .background(AppColors.appBorder),
    )
}

/**
 * Colored-chip row used by the Developer screen (SecretSettings). 42dp rounded
 * icon chip + title/subtitle + optional trailing content (chevron or a Switch).
 */
@Composable
internal fun DeveloperRow(
    icon: ImageVector,
    iconColor: androidx.compose.ui.graphics.Color,
    iconBackground: androidx.compose.ui.graphics.Color,
    title: String,
    subtitle: String,
    onClick: (() -> Unit)? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(horizontal = Spacing.lg, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .background(iconBackground, androidx.compose.foundation.shape.RoundedCornerShape(13.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(18.dp))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = title, style = AppTypography.headline, color = AppColors.appTextPrimary)
            Text(text = subtitle, style = AppTypography.caption, color = AppColors.appTextSecondary)
        }
        if (trailing != null) {
            trailing()
        } else if (onClick != null) {
            Icon(
                imageVector = AppIcon.CHEVRON_RIGHT.imageVector,
                contentDescription = null,
                tint = AppColors.appTextMuted,
                modifier = Modifier.size(16.dp),
            )
        }
        Spacer(Modifier.width(0.dp))
    }
}
