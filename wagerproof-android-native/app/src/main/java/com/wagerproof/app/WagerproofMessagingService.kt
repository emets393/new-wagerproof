package com.wagerproof.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** FCM token lifecycle + foreground/data-message delivery. */
class WagerproofMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // FirebaseMessagingService may be destroyed as soon as this callback
        // returns. Hand async registration to the process-lifetime app scope.
        (application as? WagerproofApplication)?.handleFirebaseToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: "WagerProof"
        val body = message.notification?.body ?: message.data["body"] ?: return
        val route = message.data["route"]
            ?.trim('/')
            ?.takeIf { it in setOf("agents", "outliers", "feed") }
            ?: "feed"
        showNotification(title, body, route, message.messageId)
    }

    @SuppressLint("MissingPermission") // Guarded directly below for Android 13+.
    private fun showNotification(title: String, body: String, route: String, messageId: String?) {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val manager = NotificationManagerCompat.from(this)
        ensureNotificationChannel(this)
        val contentIntent = PendingIntent.getActivity(
            this,
            (messageId ?: "$route:$body").hashCode(),
            Intent(Intent.ACTION_VIEW, Uri.parse("wagerproof://$route")).apply {
                setPackage(packageName)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_wagerproof)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build()
        runCatching { manager.notify((messageId ?: "$title:$body").hashCode(), notification) }
    }

    companion object {
        const val CHANNEL_ID = "wagerproof_updates"

        /** Also called at process launch for FCM's automatic background UI. */
        fun ensureNotificationChannel(context: Context) {
            NotificationManagerCompat.from(context).createNotificationChannel(
                NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_DEFAULT)
                    .setName("WagerProof updates")
                    .build(),
            )
        }
    }
}
