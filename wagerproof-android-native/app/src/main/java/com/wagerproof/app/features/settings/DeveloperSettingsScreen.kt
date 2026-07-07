package com.wagerproof.app.features.settings

import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.NotificationService
import com.wagerproof.core.stores.AgentV3SettingsStore
import com.wagerproof.core.stores.AuthStore
import kotlinx.coroutines.launch

private data class DiagMessage(val title: String, val body: String)

/**
 * Developer / Secret settings — port of iOS `Features/Settings/SecretSettingsView`.
 * Reached via the double-tap shortcut on the Settings footer version row.
 *
 * Sections: Testing Toggles, Platform Analytics, Agent V3 Engine, Diagnostics,
 * Info (User ID). Admin Mode is hidden unless `adminMode.canEnableAdminMode`;
 * Dummy Data Mode is DEBUG-only.
 *
 * // FIDELITY-WAIVER #053 (carried from iOS): WagerBot admin rows deferred.
 * // FIDELITY-WAIVER #055 (carried from iOS): Meta SDK event-test rows not surfaced.
 */
@Composable
fun DeveloperSettingsScreen(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val graph = appGraph()
    val revenueCat = graph.revenueCat
    val adminMode = graph.adminMode
    val debugDataMode = graph.debugDataMode
    val auth = graph.auth
    val onboarding = graph.onboarding
    val router = graph.rootRouter
    val v3 = remember { AgentV3SettingsStore() }
    val scope = rememberCoroutineScope()

    var diag by remember { mutableStateOf<DiagMessage?>(null) }
    var showStats by remember { mutableStateOf(false) }
    var showPaywallStub by remember { mutableStateOf(false) }

    BackHandler(onBack = onDismiss)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .padding(top = Spacing.sm),
    ) {
        SettingsSubScreenBar(title = "Developer", onDismiss = onDismiss, large = true)

        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = Spacing.xl)) {
            // --- Testing Toggles ---
            ProfileSectionHeader("Testing Toggles")
            DeveloperRow(
                icon = AppIcon.PERSON_CROP_CIRCLE_BADGE_EXCLAMATION.imageVector,
                iconColor = Color(0xFFF59E0B),
                iconBackground = Color(0xFFFFF8E6),
                title = "Simulate Freemium",
                subtitle = if (revenueCat.forceFreemiumMode) "Viewing as non-subscriber" else "Test the app as a non-subscriber",
                trailing = { AppSwitch(revenueCat.forceFreemiumMode) { revenueCat.forceFreemiumMode = it } },
            )
            if (adminMode.canEnableAdminMode) {
                DeveloperRow(
                    icon = AppIcon.CHECKMARK_SHIELD_FILL.imageVector,
                    iconColor = Color(0xFF22C55E),
                    iconBackground = Color(0xFFE9F8F0),
                    title = "Admin Mode",
                    subtitle = if (adminMode.adminModeEnabled) "Admin features enabled" else "Enable editor picks management",
                    trailing = { AppSwitch(adminMode.adminModeEnabled) { adminMode.toggleAdminMode() } },
                )
            }
            if (BuildFlags.isDebugBuild) {
                DeveloperRow(
                    icon = AppIcon.WAND_AND_STARS.imageVector,
                    iconColor = Color(0xFF8B5CF6),
                    iconBackground = Color(0xFFF3EEFF),
                    title = "Dummy Data Mode",
                    subtitle = if (debugDataMode.enabled) "Serving real captured sample games" else "Populate cards & widgets in the offseason",
                    trailing = { AppSwitch(debugDataMode.enabled) { debugDataMode.enabled = it } },
                )
            }

            // --- Platform Analytics ---
            ProfileSectionHeader("Platform Analytics")
            DeveloperRow(
                icon = AppIcon.CHART_BAR_XAXIS.imageVector,
                iconColor = Color(0xFF2A86FF),
                iconBackground = Color(0xFFEDF5FF),
                title = "Agents Platform Stats",
                subtitle = "Win-rate distribution across all agents",
                onClick = { showStats = true },
            )

            // --- Agent V3 Engine ---
            ProfileSectionHeader("Agent V3 Engine")
            DeveloperRow(
                icon = AppIcon.CHECKMARK_CIRCLE_FILL.imageVector,
                iconColor = Color(0xFF0EA5E9),
                iconBackground = Color(0xFFE6F6FE),
                title = "Dry Run",
                subtitle = if (v3.dryRun) "Runs the loop + records trace, writes NO picks" else "Writes picks normally",
                trailing = { AppSwitch(v3.dryRun) { v3.setDryRun(it) } },
            )
            ModelPicker(v3)

            // --- Diagnostics ---
            ProfileSectionHeader("Diagnostics")
            DeveloperRow(
                icon = AppIcon.SCOPE.imageVector,
                iconColor = Color(0xFFF59E0B),
                iconBackground = Color(0xFFFFF8E6),
                title = "Push Diagnostics",
                subtitle = "Check device, permission, token, and DB status",
                onClick = { diag = runPushDiagnostics(auth) },
            )
            DeveloperRow(
                icon = AppIcon.BELL_BADGE_FILL.imageVector,
                iconColor = Color(0xFF22C55E),
                iconBackground = Color(0xFFE9F8F0),
                title = "Register & Test Push",
                subtitle = "Register token, send a local test notification",
                onClick = { scope.launch { diag = registerAndTestPush(auth) } },
            )
            DeveloperRow(
                icon = AppIcon.ARROW_CLOCKWISE.imageVector,
                iconColor = Color(0xFF2A86FF),
                iconBackground = Color(0xFFEDF5FF),
                title = "Sync Offerings",
                subtitle = "Force refresh from RevenueCat servers",
                onClick = {
                    scope.launch {
                        diag = try {
                            revenueCat.syncPurchases()
                            DiagMessage("Success", "Offerings refreshed from server.")
                        } catch (e: Throwable) {
                            DiagMessage("Error", "Failed to sync: ${e.message}")
                        }
                    }
                },
            )
            DeveloperRow(
                icon = AppIcon.SHIPPINGBOX_FILL.imageVector,
                iconColor = Color(0xFF2A86FF),
                iconBackground = Color(0xFFEDF5FF),
                title = "Check Offerings",
                subtitle = "Debug available RevenueCat offerings",
                onClick = {
                    scope.launch {
                        revenueCat.refreshOffering()
                        val offering = revenueCat.offering
                        diag = if (offering != null) {
                            DiagMessage("Offering Found", "Identifier: ${offering.identifier}\nPackages: ${offering.availablePackages.size}")
                        } else {
                            DiagMessage("No Offerings", "Check RevenueCat dashboard config.")
                        }
                    }
                },
            )
            DeveloperRow(
                icon = AppIcon.DOLLARSIGN_CIRCLE_FILL.imageVector,
                iconColor = Color(0xFF2A86FF),
                iconBackground = Color(0xFFEDF5FF),
                title = "Test Paywall",
                subtitle = "Present the dynamic paywall",
                onClick = { showPaywallStub = true },
            )
            DeveloperRow(
                icon = AppIcon.ARROW_CLOCKWISE.imageVector,
                iconColor = Color(0xFFD16A00),
                iconBackground = Color(0xFFFFF0E1),
                title = "Reset Onboarding",
                subtitle = "Go through the onboarding flow again",
                onClick = {
                    // FIDELITY-WAIVER #255: iOS also flips profiles.onboarding_completed
                    // via Supabase; the app module has no postgrest classpath, so we only
                    // do the local reset + force re-entry (the dev-only visible effect).
                    onboarding.reset()
                    router.forceOnboardingForTestingNow()
                    onDismiss()
                },
            )

            // --- Info ---
            (auth.phase as? AuthStore.Phase.Authenticated)?.let { authed ->
                ProfileSectionHeader("Info")
                Column(modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.sm)) {
                    Text("User ID", style = AppTypography.captionEmphasized, color = AppColors.appTextSecondary)
                    Text(authed.userId, style = AppTypography.mono, color = AppColors.appTextPrimary, fontSize = 14.sp)
                }
            }
        }
    }

    diag?.let { msg ->
        AlertDialog(
            onDismissRequest = { diag = null },
            title = { Text(msg.title) },
            text = { Text(msg.body) },
            confirmButton = { TextButton(onClick = { diag = null }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    if (showPaywallStub) {
        // FIDELITY-WAIVER #250: RevenueCat paywall UI is not ported on Android.
        AlertDialog(
            onDismissRequest = { showPaywallStub = false },
            title = { Text("Upgrade") },
            text = { Text("The paywall isn't available in this build yet.") },
            confirmButton = { TextButton(onClick = { showPaywallStub = false }) { Text("OK") } },
            containerColor = AppColors.appSurfaceElevated,
        )
    }

    if (showStats) {
        Box(modifier = Modifier.fillMaxSize()) {
            AgentStatsScreen(onDismiss = { showStats = false })
        }
    }
}

@Composable
private fun AppSwitch(checked: Boolean, onChange: (Boolean) -> Unit) {
    Switch(
        checked = checked,
        onCheckedChange = onChange,
        colors = SwitchDefaults.colors(
            checkedTrackColor = AppColors.appPrimary,
            checkedThumbColor = Color.White,
        ),
    )
}

@Composable
private fun ModelPicker(v3: AgentV3SettingsStore) {
    Column(modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.sm)) {
        Text("Model", style = AppTypography.captionEmphasized, color = AppColors.appTextSecondary)
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            AgentV3SettingsStore.models.forEach { model ->
                val selected = v3.model == model
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (selected) AppColors.appPrimary else AppColors.appSurfaceMuted)
                        .clickable { v3.setModel(model) }
                        .padding(horizontal = Spacing.md, vertical = Spacing.sm),
                ) {
                    Text(
                        text = model,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (selected) Color.White else AppColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

private fun runPushDiagnostics(auth: AuthStore): DiagMessage {
    val lines = buildList {
        add("Platform: Android")
        add("Device model: ${Build.MODEL}")
        add("Permission: ${NotificationService.permissionStatus()}")
        val token = NotificationService.currentDeviceToken() ?: "<none>"
        add("FCM token: ${token.take(30)}…")
        val userId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId
        add(if (userId != null) "User ID: $userId" else "User: not logged in")
    }
    return DiagMessage("Push Diagnostics", lines.joinToString("\n"))
}

private suspend fun registerAndTestPush(auth: AuthStore): DiagMessage {
    val userId = (auth.phase as? AuthStore.Phase.Authenticated)?.userId
        ?: return DiagMessage("Error", "Must be logged in")
    if (NotificationService.permissionStatus() != NotificationService.PermissionStatus.GRANTED) {
        return DiagMessage("Permission Denied", "Notifications are blocked. Enable them in system settings, then retry.")
    }
    NotificationService.registerPushToken(userId)
    // FIDELITY-WAIVER #256: iOS schedules a bespoke 3s local test notification;
    // Android reuses the existing local "generation finished" banner (forced to
    // show) as the delivery test.
    NotificationService.postGenerationFinishedNotification(
        agentId = "test",
        agentName = "Test Agent",
        picksGenerated = 3,
        parlaysGenerated = 0,
        succeeded = true,
        isAppForeground = false,
    )
    return DiagMessage("Test Sent", "Token registered with Supabase and a local test notification was posted.")
}
