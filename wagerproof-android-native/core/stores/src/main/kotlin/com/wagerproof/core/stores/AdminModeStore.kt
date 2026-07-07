package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import com.wagerproof.core.shared.AppGroupKey
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Port of iOS `AdminModeStore.swift` (doc §13.1).
 *
 * Two pieces of state:
 *   1. [isAdmin] — whether the user has the `admin` role in Supabase (queried
 *      via the `has_role(_user_id, _role)` RPC).
 *   2. [adminModeEnabled] — whether the admin toggled developer tools on;
 *      persisted to App Group prefs so it survives launch for the same user.
 *
 * Backend contract (byte-identical to RN): `rpc('has_role', { _user_id, _role: 'admin' })`.
 */
@Stable
class AdminModeStore {
    var isAdmin by mutableStateOf(false); private set
    var isCheckingRole by mutableStateOf(false); private set
    var lastError by mutableStateOf<String?>(null); private set

    /** `true` once a role check has completed — views use it to avoid flashing dev rows mid-RPC. */
    var roleResolved by mutableStateOf(false); private set

    private var _adminModeEnabled by mutableStateOf(
        StorePrefs.appGroup.getBoolean(AppGroupKey.ADMIN_MODE_ENABLED, false),
    )

    /** Developer-tools toggle; setter persists to App Group prefs. */
    var adminModeEnabled: Boolean
        get() = _adminModeEnabled
        set(value) {
            _adminModeEnabled = value
            StorePrefs.appGroup.edit().putBoolean(AppGroupKey.ADMIN_MODE_ENABLED, value).apply()
        }

    /** Check the admin role for the given user. Called when `phase == authenticated`. Idempotent. */
    suspend fun checkRole(userId: String) {
        isCheckingRole = true
        try {
            val result = SupabaseClients.main.postgrest.rpc(
                "has_role",
                buildJsonObject {
                    put("_user_id", userId)
                    put("_role", "admin")
                },
            )
            // Supabase RPC returns the boolean as the raw body. Decode it directly.
            isAdmin = result.data.trim() == "true"
            roleResolved = true
        } catch (e: Throwable) {
            // Non-fatal: default to non-admin on error. RN does the same.
            isAdmin = false
            roleResolved = true
            lastError = e.localizedMessage ?: e.message
        } finally {
            isCheckingRole = false
        }
        // Mirror RN: if not (or no longer) admin, force the local toggle off so the
        // developer drawer doesn't render at all.
        if (!isAdmin && adminModeEnabled) {
            adminModeEnabled = false
        }
    }

    /** Clear admin state. Called on sign-out. */
    fun reset() {
        isAdmin = false
        adminModeEnabled = false
        roleResolved = false
    }

    fun toggleAdminMode() {
        if (!isAdmin) return
        adminModeEnabled = !adminModeEnabled
    }

    val canEnableAdminMode: Boolean get() = isAdmin

    /** NFL/CFB dry-run staging tables — requires both admin role and the Secret Settings toggle. */
    val dryRunPreviewEnabled: Boolean get() = isAdmin && adminModeEnabled

    // MARK: - DEBUG

    fun debugSet(isAdmin: Boolean, modeEnabled: Boolean = false) {
        if (!BuildFlags.isDebugBuild) return
        this.isAdmin = isAdmin
        this.adminModeEnabled = modeEnabled
        this.roleResolved = true
    }
}
