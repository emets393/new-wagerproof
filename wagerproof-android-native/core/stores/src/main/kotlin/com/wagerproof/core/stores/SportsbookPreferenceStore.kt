package com.wagerproof.core.stores

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.SportsbookPreference

/**
 * Local preferred-books set. Port of iOS `SportsbookPreference` + `@AppStorage`.
 * Empty set means "best number from any book".
 */
object SportsbookPreferenceStore {
    var selectedKeys by mutableStateOf(load())
        private set

    fun toggle(key: String) {
        val next = selectedKeys.toMutableSet()
        if (!next.add(key)) next.remove(key)
        set(next)
    }

    fun clear() = set(emptySet())

    fun set(keys: Set<String>) {
        selectedKeys = keys
        StorePrefs.standard.edit()
            .putString(SportsbookPreference.DEFAULTS_KEY, SportsbookPreference.encode(keys))
            .apply()
    }

    private fun load(): Set<String> = runCatching {
        SportsbookPreference.decode(
            StorePrefs.standard.getString(SportsbookPreference.DEFAULTS_KEY, null),
        )
    }.getOrDefault(emptySet())
}
