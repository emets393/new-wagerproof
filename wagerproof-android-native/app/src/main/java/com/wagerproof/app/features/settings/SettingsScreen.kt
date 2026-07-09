package com.wagerproof.app.features.settings

import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.paywall.CustomerCenterScreen
import com.wagerproof.app.features.paywall.PaywallScreen
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.NotificationService
import com.wagerproof.core.stores.AuthStore
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val APP_VERSION = "3.5.6 (49)"
private const val CONTACT_MAILTO = "mailto:admin@wagerproof.bet?subject=Contact%20Us%20-%20WagerProof%20Mobile"
private const val PRIVACY_URL = "https://wagerproof.bet/privacy-policy"
private const val TERMS_URL = "https://wagerproof.bet/terms-and-conditions"

/** Which settings sub-screen is presented over the main list. */
private enum class SettingsModal { Discord, Widget, DeleteAccount, Developer, Paywall, CustomerCenter }

/**
 * Settings — port of iOS `Features/Settings/SettingsView` (doc 08 §4.2).
 *
 * A hand-rolled flat "profile list" (NOT a Material form): two hero banners on
 * top, then muted section headers + [ProfileRow]s with hairline inset dividers.
 * Dismiss goes through `mainTab.isSettingsPresented = false` (the shell hosts
 * this screen as a full-screen overlay).
 *
 * Sub-modals (Discord / Widget help / Delete Account / Developer) present as
 * local full-screen overlays with their own back handlers, so back closes the
 * modal first, then the screen.
 *
 * // FIDELITY-WAIVER #257: iOS's animated `HoneydewOptionCard` hero banners
 * // (drifting SF-symbol chrome + glass action pill) render here as static
 * // gradient banners — the drifting-symbol animation engine is not ported.
 */
@Composable
fun SettingsScreen(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val graph = appGraph()
    val auth = graph.auth
    val settings = graph.settings
    val revenueCat = graph.revenueCat
    val adminMode = graph.adminMode
    val proAccess = graph.proAccess

    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current

    var modal by remember { mutableStateOf<SettingsModal?>(null) }
    var logoutAlert by remember { mutableStateOf(false) }
    var isSigningOut by remember { mutableStateOf(false) }
    var notificationDeniedAlert by remember { mutableStateOf(false) }
    var didCopyUserId by remember { mutableStateOf(false) }

    val userId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId

    // POST_NOTIFICATIONS runtime request (Android 13+). The store only reads the
    // OS status — the actual request must come from the UI.
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        scope.launch {
            settings.refreshNotificationPermission()
            if (granted && userId != null) {
                settings.enableNotifications(userId)
            } else if (!granted) {
                notificationDeniedAlert = true
            }
        }
    }

    LaunchedEffect(Unit) { settings.refreshNotificationPermission() }

    Column(modifier = modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding()) {
        // Top bar — back pops the settings overlay (clears isSettingsPresented).
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = Spacing.xs, end = Spacing.lg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onDismiss) {
                Icon(AppIcon.CHEVRON_LEFT.imageVector, contentDescription = "Back", tint = AppColors.appTextPrimary)
            }
            Text("Settings", style = AppTypography.title, color = AppColors.appTextPrimary)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = Spacing.xl),
        ) {
            // --- Hero banners ---
            Column(
                modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.md),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val proTitle = when {
                    proAccess.isLoading -> "Verifying access"
                    proAccess.isPro -> "You are Pro"
                    else -> "Go Pro Today"
                }
                val proSubtitle = when {
                    proAccess.isLoading -> "Checking plan"
                    proAccess.isPro -> "Premium picks unlocked"
                    else -> "Unlock premium picks"
                }
                val proAction = when {
                    proAccess.isLoading -> "Hold"
                    proAccess.isPro -> "Manage"
                    else -> "Upgrade"
                }
                HeroBanner(
                    title = proTitle,
                    subtitle = proSubtitle,
                    actionWord = proAction,
                    gradient = listOf(Color(0xFFFF8000), Color(0xFFFFC74D)),
                    enabled = !proAccess.isLoading,
                    onTap = {
                        if (!proAccess.isLoading) {
                            modal = if (proAccess.isPro) SettingsModal.CustomerCenter else SettingsModal.Paywall
                        }
                    },
                )
                HeroBanner(
                    title = "Join our Discord",
                    subtitle = "Picks, updates, and live chat",
                    actionWord = "Join",
                    gradient = listOf(Color(0xFF5C66F2), Color(0xFF9EA8FF)),
                    enabled = true,
                    onTap = { modal = SettingsModal.Discord },
                )
            }

            // --- Preferences ---
            ProfileSectionHeader("Preferences")
            PushNotificationsRow(
                enabled = settings.notificationPermission.isEnabled,
                checking = settings.isCheckingNotificationPermission,
                onToggle = { turnOn ->
                    if (turnOn) {
                        val granted = NotificationService.permissionStatus() == NotificationService.PermissionStatus.GRANTED
                        if (granted) {
                            scope.launch { userId?.let { settings.enableNotifications(it) } }
                        } else if (Build.VERSION.SDK_INT >= 33) {
                            permissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            // Pre-13: nothing to request at runtime — blocked at the
                            // channel level, so send the user to system settings.
                            notificationDeniedAlert = true
                        }
                    } else {
                        scope.launch { userId?.let { settings.disableNotifications(it) } }
                    }
                },
            )
            RowDivider()
            ProfileRow(
                icon = AppIcon.RECTANGLE_STACK_FILL.imageVector,
                title = "Home Screen Widget",
                accessory = RowAccessory.Chevron,
                onClick = { modal = SettingsModal.Widget },
            )

            // --- Support ---
            ProfileSectionHeader("Support")
            ProfileRow(
                icon = AppIcon.BUBBLE_LEFT_AND_BUBBLE_RIGHT_FILL.imageVector,
                title = "Discord Channel",
                accessory = RowAccessory.Chevron,
                onClick = { modal = SettingsModal.Discord },
            )
            RowDivider()
            ProfileRow(
                icon = AppIcon.ENVELOPE_FILL.imageVector,
                title = "Contact Us",
                accessory = RowAccessory.External,
                onClick = { uriHandler.openUri(CONTACT_MAILTO) },
            )

            // --- Legal ---
            ProfileSectionHeader("Legal")
            ProfileRow(
                icon = AppIcon.LOCK_SHIELD_FILL.imageVector,
                title = "Privacy Policy",
                accessory = RowAccessory.External,
                onClick = { uriHandler.openUri(PRIVACY_URL) },
            )
            RowDivider()
            ProfileRow(
                icon = AppIcon.DOC_TEXT_FILL.imageVector,
                title = "Terms of Use",
                accessory = RowAccessory.External,
                onClick = { uriHandler.openUri(TERMS_URL) },
            )

            // --- Account / More / Danger Zone (auth-gated) ---
            if (userId != null) {
                ProfileSectionHeader("Account")
                val email = auth.profile?.email
                if (email != null) {
                    ProfileRow(
                        icon = AppIcon.AT.imageVector,
                        title = "Email",
                        subtitle = email,
                        accessory = RowAccessory.None,
                    )
                    RowDivider()
                }
                UserIdRow(
                    userId = userId,
                    copied = didCopyUserId,
                    onCopy = {
                        clipboard.setText(AnnotatedString(userId))
                        didCopyUserId = true
                        scope.launch {
                            delay(1600)
                            didCopyUserId = false
                        }
                    },
                )

                ProfileSectionHeader("More")
                SignOutRow(isSigningOut = isSigningOut, onClick = { logoutAlert = true })

                ProfileSectionHeader("Danger Zone")
                ProfileRow(
                    icon = AppIcon.TRASH.imageVector,
                    title = "Delete Account",
                    subtitle = "Permanently delete your account and data",
                    accessory = RowAccessory.None,
                    destructive = true,
                    onClick = { modal = SettingsModal.DeleteAccount },
                )
            }

            // --- Footer (double-tap → Developer) ---
            FooterVersion(onSecretOpen = { modal = SettingsModal.Developer })
        }
    }

    // --- Alerts ---
    if (logoutAlert) {
        AlertDialog(
            onDismissRequest = { logoutAlert = false },
            title = { Text("Logout") },
            text = { Text("Are you sure you want to logout?") },
            confirmButton = {
                TextButton(onClick = {
                    logoutAlert = false
                    isSigningOut = true
                    scope.launch {
                        userId?.let { NotificationService.deactivatePushTokens(it) }
                        revenueCat.detachUser()
                        adminMode.reset()
                        auth.signOut()
                        isSigningOut = false
                    }
                }) { Text("Logout", color = AppColors.appAccentRed) }
            },
            dismissButton = { TextButton(onClick = { logoutAlert = false }) { Text("Cancel") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    if (notificationDeniedAlert) {
        AlertDialog(
            onDismissRequest = { notificationDeniedAlert = false },
            title = { Text("Notifications Disabled") },
            text = { Text("Push notifications are blocked. Open Settings to enable them.") },
            confirmButton = {
                TextButton(onClick = {
                    notificationDeniedAlert = false
                    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    runCatching { context.startActivity(intent) }
                }) { Text("Open Settings") }
            },
            dismissButton = { TextButton(onClick = { notificationDeniedAlert = false }) { Text("Cancel") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    // --- Sub-screen overlays ---
    when (modal) {
        SettingsModal.Discord -> Box(Modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding()) {
            DiscordScreen(onDismiss = { modal = null }, onUpgrade = { modal = SettingsModal.Paywall })
        }
        SettingsModal.Widget -> Box(Modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding()) {
            WidgetHelpScreen(onDismiss = { modal = null })
        }
        SettingsModal.DeleteAccount -> Box(Modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding()) {
            DeleteAccountScreen(onDismiss = { modal = null })
        }
        SettingsModal.Developer -> Box(Modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding()) {
            DeveloperSettingsScreen(onDismiss = { modal = null })
        }
        SettingsModal.Paywall -> Box(Modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding()) {
            PaywallScreen(onDismiss = { modal = null })
        }
        SettingsModal.CustomerCenter -> Box(Modifier.fillMaxSize().background(AppColors.appSurface).safeDrawingPadding()) {
            CustomerCenterScreen(onDismiss = { modal = null })
        }
        null -> Unit
    }
}

// MARK: - Hero banner

@Composable
private fun HeroBanner(
    title: String,
    subtitle: String,
    actionWord: String,
    gradient: List<Color>,
    enabled: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(23.dp))
            .background(Brush.horizontalGradient(gradient))
            .then(if (enabled) Modifier.clickable(onClick = onTap) else Modifier)
            .padding(Spacing.lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text(subtitle, style = AppTypography.caption, color = Color.White.copy(alpha = 0.9f))
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(Color.White.copy(alpha = 0.22f))
                .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        ) {
            Text(actionWord, style = AppTypography.captionEmphasized, color = Color.White)
        }
    }
}

// MARK: - Bespoke rows

@Composable
private fun PushNotificationsRow(
    enabled: Boolean,
    checking: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Icon(
            imageVector = AppIcon.BELL.imageVector,
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.width(SettingsIconColumnWidth),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Push Notifications", fontSize = 17.sp, color = AppColors.appTextPrimary)
            Text(
                text = if (checking) "Checking permission…" else if (enabled) "On — agent picks & alerts" else "Off",
                style = AppTypography.caption,
                color = AppColors.appTextMuted,
            )
        }
        if (checking) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = AppColors.appPrimary)
        } else {
            Switch(
                checked = enabled,
                onCheckedChange = onToggle,
                colors = SwitchDefaults.colors(
                    checkedTrackColor = AppColors.appPrimary,
                    checkedThumbColor = Color.White,
                ),
            )
        }
    }
}

@Composable
private fun UserIdRow(userId: String, copied: Boolean, onCopy: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onCopy).padding(horizontal = Spacing.lg, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Icon(
            imageVector = AppIcon.NUMBER.imageVector,
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.width(SettingsIconColumnWidth),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("User ID", fontSize = 17.sp, color = AppColors.appTextPrimary)
            Text(
                text = userId,
                style = AppTypography.monoCaption,
                color = AppColors.appTextMuted,
                maxLines = 1,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (copied) {
                Text("Copied", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appPrimary)
            }
            Icon(
                imageVector = if (copied) AppIcon.CHECKMARK.imageVector else AppIcon.DOC_ON_DOC.imageVector,
                contentDescription = null,
                tint = if (copied) AppColors.appPrimary else AppColors.appTextMuted,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable
private fun SignOutRow(isSigningOut: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (!isSigningOut) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = Spacing.lg, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Icon(
            imageVector = AppIcon.RECTANGLE_PORTRAIT_AND_ARROW_RIGHT.imageVector,
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.width(SettingsIconColumnWidth),
        )
        Text(
            text = if (isSigningOut) "Logging out…" else "Sign out",
            fontSize = 17.sp,
            color = AppColors.appTextPrimary,
            modifier = Modifier.weight(1f),
        )
        if (isSigningOut) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = AppColors.appPrimary)
        }
    }
}

@Composable
private fun FooterVersion(onSecretOpen: () -> Unit) {
    // Double-tap within 500ms opens the Developer screen (iOS version-tap easter egg).
    var tapCount by remember { mutableStateOf(0) }
    var resetJob by remember { mutableStateOf<Job?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                resetJob?.cancel()
                tapCount += 1
                if (tapCount >= 2) {
                    tapCount = 0
                    onSecretOpen()
                } else {
                    resetJob = scope.launch {
                        delay(500)
                        tapCount = 0
                    }
                }
            }
            .padding(top = Spacing.xxl, bottom = Spacing.sm),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(APP_VERSION, style = AppTypography.monoCaption, color = AppColors.appTextMuted)
        Text("Developed by nerds from Ohio.", fontSize = 12.sp, color = AppColors.appTextMuted)
    }
}
