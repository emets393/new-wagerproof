package com.wagerproof.core.shared

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences

/**
 * Android analog of iOS's App Group UserDefaults suite (WagerproofSharedKit/AppGroup.swift).
 * One SharedPreferences file shared between the app and Glance widgets (same process on
 * Android, so a plain prefs file is sufficient — no cross-process container needed).
 *
 * Call [initialize] from Application.onCreate before any service touches [prefs].
 */
object AppGroup {
    /** Kept identical to the iOS App Group identifier so payload tooling greps match. */
    const val IDENTIFIER = "group.com.wagerproof.mobile"

    @SuppressLint("StaticFieldLeak") // application context only — never an Activity
    @Volatile
    private var appContext: Context? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
    }

    /** Application context for services that need one lazily (widgets, notifications). */
    val context: Context
        get() = requireNotNull(appContext) {
            "AppGroup.initialize(context) must be called from Application.onCreate"
        }

    val prefs: SharedPreferences
        get() = context.getSharedPreferences(IDENTIFIER, Context.MODE_PRIVATE)
}

/** Storage keys — byte-for-byte with iOS `AppGroupKey` (and RN where noted). */
object AppGroupKey {
    const val LAST_NOTIFICATION_ROUTE = "last_notification_route"
    const val THEME_PREFERENCE = "theme_pref"
    const val ADMIN_MODE_ENABLED = "admin_mode_enabled"

    /**
     * Declared for parity with iOS, but NOTE: the live widget services use the
     * legacy literal `"widgetPayload"` (see [WIDGET_PAYLOAD_LEGACY]) for
     * Expo-widget compat. Do not switch widgets to this key.
     */
    const val WIDGET_PAYLOAD = "widget_payload_v1"

    /** The key the widget payload is actually stored under (legacy Expo-compat). */
    const val WIDGET_PAYLOAD_LEGACY = "widgetPayload"

    /** DEBUG-only: stores serve bundled fixtures instead of Supabase. */
    const val DUMMY_DATA_MODE = "dummy_data_mode_debug"

    // Coarse subscription snapshot mirrored for widgets/cold-launch so the UI
    // doesn't flash "free" while RevenueCat reconciles. RevenueCat stays the
    // source of truth.
    const val PRO_ENTITLEMENT_GRANTED = "pro_entitlement_granted_v1"
    const val PRO_SUBSCRIPTION_TYPE = "pro_subscription_type_v1"

    /** DEBUG-only WagerBot chat model picker (see WagerBotModelSelection). */
    const val WAGERBOT_CHAT_MODEL = "wagerbot_chat_model_debug"

    /** Per-user onboarding completion — matches RN `@wagerproof/onboarding-completed/{userId}` semantics. */
    fun onboardingComplete(userId: String): String = "onboarding_complete/$userId"
}
