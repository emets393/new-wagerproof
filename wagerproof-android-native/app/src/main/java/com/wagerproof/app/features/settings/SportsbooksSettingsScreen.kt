package com.wagerproof.app.features.settings

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.SportsbookLogoStyle
import com.wagerproof.app.features.gamecards.SportsbookLogoView
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.SportsbookCatalog
import com.wagerproof.core.models.SportsbookPreference
import com.wagerproof.core.stores.SportsbookPreferenceStore

/**
 * Multi-select preferred sportsbooks. Empty set means "best number from any book".
 * Port of iOS SettingsView's "My Sportsbooks" menu.
 */
@Composable
fun SportsbooksSettingsScreen(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    BackHandler(onBack = onDismiss)
    val selected = SportsbookPreferenceStore.selectedKeys

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface),
    ) {
        SettingsSubScreenBar(title = "My Sportsbooks", onDismiss = onDismiss)
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = Spacing.xl),
        ) {
            Text(
                SportsbookPreference.summary(selected),
                color = AppColors.appTextMuted,
                fontSize = 13.sp,
                modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.sm),
            )
            BookRow(
                title = "All books",
                selected = selected.isEmpty(),
                onClick = { SportsbookPreferenceStore.clear() },
            )
            SportsbookCatalog.selectable.forEach { key ->
                BookRow(
                    title = SportsbookCatalog.name(key),
                    bookKey = key,
                    selected = key in selected,
                    onClick = { SportsbookPreferenceStore.toggle(key) },
                )
            }
        }
    }
}

@Composable
private fun BookRow(
    title: String,
    selected: Boolean,
    onClick: () -> Unit,
    bookKey: String? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.lg, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (bookKey != null) {
            SportsbookLogoView(bookKey, null, SportsbookLogoStyle.COMPACT)
        }
        Text(
            title,
            color = AppColors.appTextPrimary,
            fontSize = 17.sp,
            fontWeight = FontWeight.Normal,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            Icon(
                AppIcon.CHECKMARK.imageVector,
                contentDescription = null,
                tint = AppColors.appPrimary,
            )
        }
    }
}
