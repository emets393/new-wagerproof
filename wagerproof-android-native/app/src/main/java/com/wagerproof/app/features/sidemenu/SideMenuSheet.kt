package com.wagerproof.app.features.sidemenu

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.components.InsetGroupedDivider
import com.wagerproof.app.features.components.InsetGroupedSection
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.NotificationService
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.LearnWagerProofStore
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.ThemeStore
import kotlinx.coroutines.launch

private const val DISCORD_INVITE = "https://discord.gg/gwy9y7XSDV"
private const val CONTACT_MAILTO = "mailto:admin@wagerproof.bet?subject=Contact%20Us%20-%20Wagerproof"
private const val PRIVACY_URL = "https://wagerproof.bet/privacy-policy"
private const val TERMS_URL = "https://wagerproof.bet/terms-and-conditions"

/**
 * Side-menu "drawer" — port of iOS `Features/Navigation/SideMenuSheet` (doc 08
 * §3.3). Hosted by [com.wagerproof.app.nav.MainScaffold] as a ModalBottomSheet.
 *
 * iOS's 350ms dismiss-then-flip dance (to work around chained sheets) is
 * unnecessary on Android — the shell's overlays are independent, so we set the
 * target flag AND dismiss directly (doc 08 §3.3 note). Dismiss = flip
 * `MainTabStore.isSideMenuPresented = false`.
 *
 * Scoreboard is reachable ONLY here (no bar slot) — matches iOS.
 */
@Composable
fun SideMenuSheet(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val auth = graph.auth
    val theme = graph.theme
    val tabStore = graph.mainTab
    val learn = graph.learn
    val uriHandler = LocalUriHandler.current
    val scope = rememberCoroutineScope()

    fun dismiss() { tabStore.isSideMenuPresented = false }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(bottom = Spacing.xl),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Settings", style = AppTypography.title, color = AppColors.appTextPrimary, modifier = Modifier.weight(1f))
            TextButton(onClick = { dismiss() }) { Text("Done", color = AppColors.appPrimary) }
        }

        // Account
        if (auth.phase is AuthStore.Phase.Authenticated) {
            InsetGroupedSection(modifier = Modifier.padding(horizontal = Spacing.lg)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                ) {
                    Icon(
                        imageVector = AppIcon.PERSON_CROP_CIRCLE_FILL.imageVector,
                        contentDescription = null,
                        tint = AppColors.appPrimary,
                        modifier = Modifier.size(32.dp),
                    )
                    Column {
                        Text(auth.profile?.email ?: "Signed in", style = AppTypography.bodyEmphasized, color = AppColors.appTextPrimary)
                        Text("Account", style = AppTypography.caption, color = AppColors.appTextSecondary)
                    }
                }
            }
        }

        // Navigate
        InsetGroupedSection(title = "Navigate", modifier = Modifier.padding(horizontal = Spacing.lg)) {
            NavRow("Games", AppIcon.TROPHY_FILL.imageVector, active = tabStore.selected == MainTabStore.Tab.Games) { tabStore.select(MainTabStore.Tab.Games); dismiss() }
            InsetGroupedDivider()
            NavRow("Agents", AppIcon.BRAIN_HEAD_PROFILE.imageVector, active = tabStore.selected == MainTabStore.Tab.Agents) { tabStore.select(MainTabStore.Tab.Agents); dismiss() }
            InsetGroupedDivider()
            NavRow("Outliers", AppIcon.BELL_BADGE_FILL.imageVector, active = tabStore.selected == MainTabStore.Tab.Outliers) { tabStore.select(MainTabStore.Tab.Outliers); dismiss() }
            InsetGroupedDivider()
            NavRow("Scoreboard", AppIcon.SPORTSCOURT_FILL.imageVector, active = tabStore.selected == MainTabStore.Tab.Scoreboard) { tabStore.select(MainTabStore.Tab.Scoreboard); dismiss() }
        }

        // More
        InsetGroupedSection(title = "More", modifier = Modifier.padding(horizontal = Spacing.lg)) {
            MenuRow("Settings", AppIcon.GEARSHAPE_FILL.imageVector) { dismiss(); tabStore.isSettingsPresented = true }
            InsetGroupedDivider()
            MenuRow("Feature Requests", AppIcon.LIGHTBULB_FILL.imageVector) { dismiss(); tabStore.isFeatureRequestsPresented = true }
            InsetGroupedDivider()
            MenuRow("Roast Mode", AppIcon.FLAME_FILL.imageVector) { dismiss(); tabStore.isRoastPresented = true }
            InsetGroupedDivider()
            MenuRow("Learn WagerProof", AppIcon.GRADUATIONCAP_FILL.imageVector) { dismiss(); learn.openSheet(LearnWagerProofStore.Topic.CreateAgent) }
        }

        // Preferences — Appearance picker (session-only; app coerces to dark on relaunch)
        InsetGroupedSection(title = "Preferences", modifier = Modifier.padding(horizontal = Spacing.lg)) { AppearancePicker(theme) }

        // Support
        InsetGroupedSection(title = "Support", modifier = Modifier.padding(horizontal = Spacing.lg)) {
            MenuRow("Discord Channel", AppIcon.BUBBLE_LEFT_AND_BUBBLE_RIGHT_FILL.imageVector, showChevron = false) { uriHandler.openUri(DISCORD_INVITE) }
            InsetGroupedDivider()
            MenuRow("Contact Us", AppIcon.ENVELOPE_FILL.imageVector, showChevron = false) { uriHandler.openUri(CONTACT_MAILTO) }
        }

        // Legal
        InsetGroupedSection(
            title = "Legal",
            footer = "Wagerproof v3.5.6",
            modifier = Modifier.padding(horizontal = Spacing.lg),
        ) {
            MenuRow("Privacy Policy", AppIcon.LOCK_SHIELD_FILL.imageVector, showChevron = false) { uriHandler.openUri(PRIVACY_URL) }
            InsetGroupedDivider()
            MenuRow("Terms & Conditions", AppIcon.DOC_TEXT_FILL.imageVector, showChevron = false) { uriHandler.openUri(TERMS_URL) }
        }

        // Sign Out
        if (auth.phase is AuthStore.Phase.Authenticated) {
            InsetGroupedSection(modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.lg)) {
                MenuRow("Sign Out", AppIcon.RECTANGLE_PORTRAIT_AND_ARROW_RIGHT.imageVector, destructive = true, showChevron = false) {
                    scope.launch {
                        (auth.phase as? AuthStore.Phase.Authenticated)?.userId?.let {
                            NotificationService.deactivatePushTokens(it)
                        }
                        graph.revenueCat.detachUser()
                        graph.adminMode.reset()
                        auth.signOut()
                        dismiss()
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    if (title.isEmpty()) {
        Box(Modifier.size(Spacing.md))
        return
    }
    Text(
        text = title,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        color = AppColors.appTextMuted,
        modifier = Modifier.padding(start = Spacing.lg, top = Spacing.lg, bottom = Spacing.xs),
    )
}

@Composable
private fun NavRow(title: String, icon: ImageVector, active: Boolean, onClick: () -> Unit) {
    MenuRowBase(title = title, icon = icon, onClick = onClick) {
        if (active) {
            Icon(AppIcon.CHECKMARK.imageVector, contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
        } else {
            Icon(AppIcon.CHEVRON_RIGHT.imageVector, contentDescription = null, tint = AppColors.appTextMuted, modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun MenuRow(
    title: String,
    icon: ImageVector,
    destructive: Boolean = false,
    showChevron: Boolean = true,
    onClick: () -> Unit,
) {
    MenuRowBase(title = title, icon = icon, destructive = destructive, onClick = onClick) {
        if (showChevron) {
            Icon(AppIcon.CHEVRON_RIGHT.imageVector, contentDescription = null, tint = AppColors.appTextMuted, modifier = Modifier.size(14.dp))
        }
    }
}

@Composable
private fun MenuRowBase(
    title: String,
    icon: ImageVector,
    destructive: Boolean = false,
    onClick: () -> Unit,
    trailing: @Composable () -> Unit,
) {
    val tint = if (destructive) AppColors.appLoss else AppColors.appTextPrimary
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 2.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
        Text(text = title, style = AppTypography.body, color = tint, modifier = Modifier.weight(1f))
        trailing()
    }
}

@Composable
private fun AppearancePicker(theme: ThemeStore) {
    Column(modifier = Modifier.padding(horizontal = 2.dp, vertical = Spacing.sm)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Icon(AppIcon.CIRCLE_LEFTHALF_FILLED.imageVector, contentDescription = null, tint = AppColors.appTextPrimary, modifier = Modifier.size(20.dp))
            Text("Appearance", style = AppTypography.body, color = AppColors.appTextPrimary, modifier = Modifier.weight(1f))
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            ThemeStore.Mode.entries.forEach { mode ->
                val selected = theme.mode == mode
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (selected) AppColors.appPrimary else AppColors.appSurfaceMuted)
                        .clickable { theme.mode = mode }
                        .padding(vertical = Spacing.sm),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = mode.name,
                        style = AppTypography.captionEmphasized,
                        color = if (selected) Color.White else AppColors.appTextSecondary,
                    )
                }
            }
        }
    }
}
