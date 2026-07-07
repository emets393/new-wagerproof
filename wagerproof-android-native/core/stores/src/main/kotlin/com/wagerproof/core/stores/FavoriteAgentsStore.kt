package com.wagerproof.core.stores

import android.content.SharedPreferences
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Port of iOS `FavoriteAgentsStore.swift` (doc §8.9). Device-local favorites set
 * for the Top Picks Favorites filter. Persisted to [StorePrefs.standard] under
 * the (spelling-stable) key `topPicksFavoriteAgentIds`.
 *
 * iOS stores a sorted `[String]` of lowercased UUIDs; SharedPreferences has no
 * ordered-array type, so we back it with a `StringSet` of the same lowercased
 * ids — order is irrelevant for a set and the key stays byte-identical.
 */
@Stable
class FavoriteAgentsStore(
    private val defaults: SharedPreferences = StorePrefs.standard,
) {
    var favoriteIds by mutableStateOf<Set<String>>(emptySet()); private set

    init {
        favoriteIds = load(defaults)
    }

    fun isFavorite(agentId: String): Boolean = favoriteIds.contains(normalize(agentId))

    /**
     * Toggle a favorite. Returns the new state for callers that want to drive
     * haptics / icon swaps off the result.
     */
    fun toggle(agentId: String): Boolean {
        val key = normalize(agentId)
        favoriteIds = if (favoriteIds.contains(key)) favoriteIds - key else favoriteIds + key
        persist()
        return favoriteIds.contains(key)
    }

    fun setFavorite(agentId: String, isFavorite: Boolean) {
        val key = normalize(agentId)
        val was = favoriteIds.contains(key)
        if (isFavorite && !was) {
            favoriteIds = favoriteIds + key
            persist()
        } else if (!isFavorite && was) {
            favoriteIds = favoriteIds - key
            persist()
        }
    }

    fun clear() {
        favoriteIds = emptySet()
        persist()
    }

    // MARK: - Internal

    private fun normalize(agentId: String): String = agentId.trim().lowercase()

    private fun persist() {
        // Copy — SharedPreferences must not be handed a mutable set it retains.
        defaults.edit().putStringSet(STORAGE_KEY, HashSet(favoriteIds)).apply()
    }

    private companion object {
        // Keep the spelling stable — changing it silently wipes users' favorites.
        const val STORAGE_KEY = "topPicksFavoriteAgentIds"

        fun load(defaults: SharedPreferences): Set<String> =
            defaults.getStringSet(STORAGE_KEY, null)?.map { it.lowercase() }?.toSet() ?: emptySet()
    }
}
