package com.wagerproof.core.stores

import android.content.SharedPreferences
import com.wagerproof.core.shared.AppGroup

/**
 * Two SharedPreferences surfaces for the stores layer, mapping the two iOS
 * UserDefaults suites:
 *
 * - [appGroup] → iOS App Group defaults (`AppGroup.defaults`). Shared with
 *   widgets. Keys defined in [com.wagerproof.core.shared.AppGroupKey].
 * - [standard] → iOS `UserDefaults.standard`. Per-app, non-widget-shared
 *   (SearchStore recents, FavoriteAgentsStore, AgentPicksSeenStore,
 *   AgentV3SettingsStore). Backed by a plain `wagerproof_prefs` file.
 *
 * Both are lazy — safe to reference before AppGroup.initialize only if never
 * touched (stores read/write lazily on first mutation, always post-onCreate).
 */
object StorePrefs {
    val appGroup: SharedPreferences get() = AppGroup.prefs

    private const val STANDARD_FILE = "wagerproof_prefs"
    val standard: SharedPreferences
        get() = AppGroup.context.getSharedPreferences(STANDARD_FILE, android.content.Context.MODE_PRIVATE)
}
