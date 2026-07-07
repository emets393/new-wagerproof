package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.shared.AppGroupKey

/**
 * Port of iOS `DebugDataModeStore.swift` (doc §13.2) — the entire file is
 * DEBUG-only.
 *
 * Backs the "Dummy Data Mode" toggle in Secret Settings. [enabled] is the
 * single source of truth for the UI binding; its setter writes through to the
 * App Group flag ([AppGroupKey.DUMMY_DATA_MODE]) that every data store reads
 * before fetching. Init reads the flag back.
 *
 * FIDELITY-WAIVER #B21: there is no `DummyDataMode` object in core.services;
 * the read-path is the raw pref (see PolymarketService.isDummyDataMode), so we
 * write the flag directly to [StorePrefs.appGroup] under the same key.
 */
@Stable
class DebugDataModeStore {
    private var _enabled by mutableStateOf(
        StorePrefs.appGroup.getBoolean(AppGroupKey.DUMMY_DATA_MODE, false),
    )

    var enabled: Boolean
        get() = _enabled
        set(value) {
            _enabled = value
            // Debug-only: never mutate the flag in release builds.
            if (!BuildFlags.isDebugBuild) return
            StorePrefs.appGroup.edit().putBoolean(AppGroupKey.DUMMY_DATA_MODE, value).apply()
        }
}
