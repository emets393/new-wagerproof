package com.wagerproof.core.services

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.os.bundleOf
import com.wagerproof.core.shared.AppGroup
import io.github.jan.supabase.postgrest.from
import java.time.Instant
import kotlinx.serialization.Serializable

/**
 * Port of iOS `NotificationService.swift` / RN `services/notificationService.ts`:
 * push-token registration with Supabase + the local "generation finished" banner.
 *
 * The FCM token itself is supplied from outside — Firebase is not a dependency
 * of this module; the app's `FirebaseMessagingService` calls [cacheToken] on
 * `onNewToken`, and [registerPushToken] picks it up best-effort.
 *
 * Permission flow: this service only *checks* POST_NOTIFICATIONS. The actual
 * runtime request needs an Activity — the UI layer launches
 * `ActivityResultContracts.RequestPermission()` and re-checks [permissionStatus].
 */
object NotificationService {

    enum class PermissionStatus { GRANTED, DENIED }

    private const val CHANNEL_ID = "agent_generation"

    @Volatile
    private var cachedDeviceToken: String? = null

    /** Called from the app's FirebaseMessagingService (onNewToken / getToken). */
    fun cacheToken(token: String) {
        cachedDeviceToken = token
    }

    /** Cached FCM token — for the secret-settings push diagnostics action. */
    fun currentDeviceToken(): String? = cachedDeviceToken

    // FIDELITY-WAIVER #051 analog: the column stays `expo_push_token` even
    // though we store a bare FCM registration token — the server-side
    // dispatcher branches on token shape (Expo vs APNs hex vs FCM).
    @Serializable
    private data class TokenUpsert(
        val user_id: String,
        val expo_push_token: String,
        val platform: String,
        val device_name: String,
        val is_active: Boolean,
        val last_used_at: String,
        val updated_at: String,
    )

    @Serializable
    private data class PreferenceInsert(
        val user_id: String,
        val auto_pick_ready: Boolean,
    )

    /**
     * Register the cached FCM token with Supabase. No-op if no token cached
     * yet (best-effort — retried on the next call). Mirrors the RN upsert
     * byte-for-byte; all failures are non-fatal (retried next foreground).
     */
    suspend fun registerPushToken(userId: String) {
        val token = cachedDeviceToken ?: return
        val now = Instant.now().toString()
        runCatching {
            SupabaseClients.main.from("user_push_tokens").upsert(
                TokenUpsert(
                    user_id = userId,
                    expo_push_token = token,
                    platform = "android",
                    device_name = Build.MODEL,
                    is_active = true,
                    last_used_at = now,
                    updated_at = now,
                ),
            ) {
                onConflict = "user_id,expo_push_token"
            }

            // Ensure a notification-preferences row exists. ignoreDuplicates +
            // swallowed failure — the row may already exist (matches RN).
            runCatching {
                SupabaseClients.main.from("user_notification_preferences").upsert(
                    PreferenceInsert(user_id = userId, auto_pick_ready = true),
                ) {
                    onConflict = "user_id"
                    ignoreDuplicates = true
                }
            }
        }
    }

    /** Deactivate all of a user's push tokens on sign-out. Errors swallowed (matches RN). */
    suspend fun deactivatePushTokens(userId: String) {
        runCatching {
            SupabaseClients.main.from("user_push_tokens").update(
                { set("is_active", false) },
            ) {
                filter { eq("user_id", userId) }
            }
        }
    }

    fun permissionStatus(): PermissionStatus {
        val context = AppGroup.context
        // Android 13+ needs the runtime permission AND channel-level enablement;
        // pre-13 only the app-level toggle exists.
        val runtimeGranted = Build.VERSION.SDK_INT < 33 ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        val enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        return if (runtimeGranted && enabled) PermissionStatus.GRANTED else PermissionStatus.DENIED
    }

    /**
     * Post the LOCAL "pick generation finished" notification for a manual run.
     * Only fires when the app is NOT foreground — on-screen the agent detail
     * page already shows the result live. [isAppForeground] is injectable so
     * callers with lifecycle awareness (ProcessLifecycleOwner) can pass truth.
     */
    fun postGenerationFinishedNotification(
        agentId: String,
        agentName: String,
        picksGenerated: Int,
        parlaysGenerated: Int,
        succeeded: Boolean,
        note: String? = null,
        isAppForeground: Boolean = isAppInForeground(),
    ) {
        if (isAppForeground) return
        if (permissionStatus() != PermissionStatus.GRANTED) return

        val context = AppGroup.context
        val (title, body) = if (succeeded) {
            val parts = buildList {
                if (picksGenerated > 0) add("$picksGenerated pick${if (picksGenerated == 1) "" else "s"}")
                if (parlaysGenerated > 0) add("$parlaysGenerated parlay${if (parlaysGenerated == 1) "" else "s"}")
            }
            "$agentName finished its research" to if (parts.isEmpty()) {
                note ?: "No plays today — the agent passed on the slate."
            } else {
                "${parts.joinToString(" + ")} ready to view."
            }
        } else {
            "$agentName hit a snag" to (note ?: "Pick generation failed. Tap to try again.")
        }

        val manager = NotificationManagerCompat.from(context)
        ensureChannel(manager)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            // No drawable resources in this module — borrow the app icon.
            .setSmallIcon(context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setDefaults(NotificationCompat.DEFAULT_SOUND)
            .setAutoCancel(true)
            .addExtras(bundleOf("avatar_id" to agentId, "type" to "generation_finished"))
            .build()

        // Stable per-agent id: a rapid re-run replaces the stale banner instead
        // of stacking duplicates (iOS threadIdentifier/request-id equivalent).
        runCatching {
            manager.notify("generation-finished-$agentId".hashCode(), notification)
        }
    }

    private fun ensureChannel(manager: NotificationManagerCompat) {
        manager.createNotificationChannel(
            NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_DEFAULT)
                .setName("Agent pick generation")
                .build(),
        )
    }

    // Coarse foreground check without a lifecycle dependency — matches the
    // iOS `applicationState == .active` gate closely enough for this banner.
    private fun isAppInForeground(): Boolean {
        val activityManager = AppGroup.context
            .getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
        val myPid = Process.myPid()
        return activityManager.runningAppProcesses?.any {
            it.pid == myPid &&
                it.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        } == true
    }
}
