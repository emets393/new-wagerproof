package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.shared.AppGroupKey

/**
 * Port of iOS `ThemeStore.swift` (doc §13.3). Mirrors RN `contexts/ThemeContext.tsx`.
 *
 * Three modes exist for parity, but the app ships dark-only: [init] FORCE-SETS
 * [Mode.Dark] and coerces any stored light/system preference to dark, so
 * existing users land in dark with no way — or need — to switch back.
 */
@Stable
class ThemeStore {
    enum class Mode(val raw: String) {
        System("system"),
        Light("light"),
        Dark("dark"),
    }

    private var _mode by mutableStateOf(Mode.Dark)

    /** Active theme mode; setter persists the raw value to App Group prefs. */
    var mode: Mode
        get() = _mode
        set(value) {
            _mode = value
            StorePrefs.appGroup.edit().putString(AppGroupKey.THEME_PREFERENCE, value.raw).apply()
        }

    init {
        // Coerce any stored preference to dark (dark-only app). Going through the
        // setter also persists "dark", matching the iOS didSet on init.
        mode = Mode.Dark
    }
}
