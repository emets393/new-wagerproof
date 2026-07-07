package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.NotificationService

/**
 * Port of iOS `SettingsStore.swift` (doc §13.4). Notification-permission facade.
 *
 * Android's [NotificationService.permissionStatus] only resolves GRANTED or
 * DENIED — there is no undetermined/provisional/ephemeral concept — and the
 * runtime-permission REQUEST is owned by the UI (ActivityResultContracts), not
 * the service. We keep the full enum for parity with iOS and map best-effort.
 */
@Stable
class SettingsStore {
    enum class NotificationPermission {
        Granted, Denied, Undetermined, Provisional, Ephemeral;

        val isEnabled get() = this == Granted || this == Provisional || this == Ephemeral

        companion object {
            fun from(status: NotificationService.PermissionStatus): NotificationPermission =
                when (status) {
                    NotificationService.PermissionStatus.GRANTED -> Granted
                    NotificationService.PermissionStatus.DENIED -> Denied
                }
        }
    }

    var notificationPermission by mutableStateOf(NotificationPermission.Undetermined); private set
    var isCheckingNotificationPermission by mutableStateOf(true); private set

    /** Refresh the permission cache. Called when the settings view appears. */
    suspend fun refreshNotificationPermission() {
        isCheckingNotificationPermission = true
        val status = NotificationService.permissionStatus()
        notificationPermission = NotificationPermission.from(status)
        isCheckingNotificationPermission = false
    }

    /**
     * User flipped the toggle ON. If already granted, register the push token.
     * Returns the resulting permission so the view can decide whether to surface
     * a "denied — open Settings" alert.
     *
     * FIDELITY-WAIVER #B21: iOS handles the `.undetermined` → request path here;
     * on Android the runtime POST_NOTIFICATIONS request lives in the UI, so this
     * only reads the current status and registers on grant.
     */
    suspend fun enableNotifications(userId: String): NotificationPermission {
        val current = NotificationService.permissionStatus()
        return when (current) {
            NotificationService.PermissionStatus.GRANTED -> {
                notificationPermission = NotificationPermission.Granted
                NotificationService.registerPushToken(userId)
                notificationPermission
            }
            NotificationService.PermissionStatus.DENIED -> {
                notificationPermission = NotificationPermission.Denied
                NotificationPermission.Denied
            }
        }
    }

    /** User flipped the toggle OFF — deactivate every push token row for this user. */
    suspend fun disableNotifications(userId: String) {
        notificationPermission = NotificationPermission.Denied
        NotificationService.deactivatePushTokens(userId)
    }

    // MARK: - DEBUG

    fun debugSet(notificationPermission: NotificationPermission) {
        if (!BuildFlags.isDebugBuild) return
        this.notificationPermission = notificationPermission
        this.isCheckingNotificationPermission = false
    }
}
