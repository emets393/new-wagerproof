package com.wagerproof.core.stores

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.SportsbookPreference
import com.wagerproof.core.services.AuthService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Preferred-books set. Local cache for instant UI; `profiles.preferred_sportsbooks`
 * is the account copy so iOS / Android / web stay in step.
 */
object SportsbookPreferenceStore {
    var selectedKeys by mutableStateOf(load())
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile private var sessionUserId: String? = null

    fun toggle(key: String) {
        val next = selectedKeys.toMutableSet()
        if (!next.add(key)) next.remove(key)
        set(next)
    }

    fun clear() = set(emptySet())

    fun set(keys: Set<String>, persistRemote: Boolean = true) {
        selectedKeys = keys
        StorePrefs.standard.edit()
            .putString(SportsbookPreference.DEFAULTS_KEY, SportsbookPreference.encode(keys))
            .apply()
        if (persistRemote) {
            val userId = sessionUserId ?: return
            scope.launch { AuthService.savePreferredSportsbooks(userId, keys) }
        }
    }

    fun detach() {
        sessionUserId = null
        set(emptySet(), persistRemote = false)
    }

    suspend fun hydrate(userId: String, service: AuthService = AuthService) {
        sessionUserId = userId
        when (val result = service.loadPreferredSportsbooks(userId)) {
            AuthService.PreferredSportsbooksLoad.Failed -> Unit
            AuthService.PreferredSportsbooksLoad.Unset -> {
                if (selectedKeys.isNotEmpty()) {
                    service.savePreferredSportsbooks(userId, selectedKeys)
                }
            }
            is AuthService.PreferredSportsbooksLoad.Ready -> {
                set(SportsbookPreference.decode(result.keys), persistRemote = false)
            }
        }
    }

    private fun load(): Set<String> = runCatching {
        SportsbookPreference.decode(
            StorePrefs.standard.getString(SportsbookPreference.DEFAULTS_KEY, null),
        )
    }.getOrDefault(emptySet())
}
