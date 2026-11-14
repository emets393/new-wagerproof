package com.wagerproof.core.services

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.pm.PackageManager
import android.os.Build
import com.wagerproof.core.shared.AppGroup

/** Android counterpart to the onboarding-only iOS Live Activity. No background polling. */
object PicksExpiryService {
    private const val DEADLINE_KEY = "tiered_picks_expiry_deadline"
    private const val CHANNEL = "onboarding_picks_hold"
    private const val NOTIFICATION_ID = 3091
    private const val HOLD_MILLIS = 3 * 60 * 60 * 1000L

    fun window(): Long {
        val saved = AppGroup.prefs.getLong(DEADLINE_KEY, 0)
        if (saved > 0) return saved
        return (System.currentTimeMillis() + HOLD_MILLIS).also {
            AppGroup.prefs.edit().putLong(DEADLINE_KEY,it).apply()
        }
    }
    fun showCountdown() {
        val context = AppGroup.context
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val deadline = window()
        if (deadline <= System.currentTimeMillis()) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Your first picks", NotificationManager.IMPORTANCE_LOW))
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        val pending = PendingIntent.getActivity(context, NOTIFICATION_ID, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(context, CHANNEL)
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle("Your WagerProof picks are waiting")
            .setContentText("Return to unlock your first picks.")
            .setWhen(deadline).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true)
            .setTimeoutAfter(deadline - System.currentTimeMillis())
            .setOnlyAlertOnce(true).setContentIntent(pending).setAutoCancel(true).build()
        manager.notify(NOTIFICATION_ID, notification)
    }
    fun cancel() {
        AppGroup.context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }
}
