package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.Profile
import com.wagerproof.core.services.AnalyticsService
import com.wagerproof.core.services.AuthService
import com.wagerproof.core.services.MetaAnalyticsService
import com.wagerproof.core.services.RevenueCatService
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.user.UserInfo
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.util.Locale

/**
 * Port of iOS `AuthStore.swift`. Owns the auth lifecycle, active [Profile], and
 * sign-in/up/reset flows against Supabase Auth (mirrors RN AuthContext). The
 * iOS `authStateChanges` async sequence becomes a collection of
 * [AuthService.sessionStatus] (a supabase-kt StateFlow).
 */
@Stable
class AuthStore(
    private val service: AuthService = AuthService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Mirrors iOS `AuthStore.Phase`. userId carried as String (services key on String). */
    sealed interface Phase {
        data object Launching : Phase
        data object Unauthenticated : Phase
        data class Authenticated(val userId: String) : Phase
    }

    enum class AccountDeletionFailureKind { NoSession, Server, MalformedResponse, Unexpected, AlreadyInProgress }

    sealed interface AccountDeletionResult {
        data object Success : AccountDeletionResult
        data class Failure(
            val message: String,
            val kind: AccountDeletionFailureKind,
            val statusCode: Int? = null,
        ) : AccountDeletionResult
    }

    var phase by mutableStateOf<Phase>(Phase.Launching); private set
    var profile by mutableStateOf<Profile?>(null); private set
    var lastError by mutableStateOf<String?>(null); private set
    var isDeletingAccount by mutableStateOf(false); private set

    /** Monotonic-ish success stamp; views use it as a haptic trigger. */
    var lastSuccessAt by mutableStateOf<Long?>(null); private set

    private var listenerJob: Job? = null

    /**
     * Which user we last pushed to the analytics/attribution SDKs. Guards
     * against re-identifying on every token refresh, and doubles as the
     * "were we ever signed in?" flag the sign-out teardown keys off.
     */
    private var lastIdentifiedUserId: String? = null

    /** Account currently allowed to own [profile] and SDK identity state. */
    private var boundUserId: String? = null

    /** Begin listening for auth changes. Idempotent. */
    fun start() {
        if (listenerJob != null) return
        listenerJob = scope.launch {
            service.sessionStatus.collect { status -> handle(status) }
        }
    }

    fun stop() {
        listenerJob?.cancel()
        listenerJob = null
    }

    fun clearError() {
        lastError = null
    }

    fun close() = scope.cancel()

    // MARK: - Mutators

    suspend fun signIn(email: String, password: String) {
        runCatching { service.signIn(email, password) }
            .onSuccess { lastError = null; lastSuccessAt = System.currentTimeMillis() }
            .onFailure { lastError = message(it) }
    }

    suspend fun signUp(email: String, password: String) {
        runCatching { service.signUp(email, password) }
            .onSuccess { lastError = null; lastSuccessAt = System.currentTimeMillis() }
            .onFailure { lastError = message(it) }
    }

    suspend fun signOut() {
        runCatching { service.signOut() }
            .onSuccess {
                clearBoundUserIdentity()
                phase = Phase.Unauthenticated
            }
            .onFailure { lastError = message(it) }
    }

    /**
     * Delete the server account and then clear local auth state. A failed edge
     * call leaves the session intact so the user can retry or contact support.
     */
    suspend fun deleteAccount(): AccountDeletionResult {
        if (isDeletingAccount) {
            return AccountDeletionResult.Failure(
                message = "Account deletion is already in progress.",
                kind = AccountDeletionFailureKind.AlreadyInProgress,
            )
        }

        isDeletingAccount = true
        return try {
            service.deleteAccount()
            clearBoundUserIdentity()
            phase = Phase.Unauthenticated
            lastError = null
            AccountDeletionResult.Success
        } catch (error: AuthService.AccountDeletionException) {
            val kind = when (error) {
                is AuthService.AccountDeletionException.NoSession -> AccountDeletionFailureKind.NoSession
                is AuthService.AccountDeletionException.Server -> AccountDeletionFailureKind.Server
                is AuthService.AccountDeletionException.MalformedResponse -> AccountDeletionFailureKind.MalformedResponse
            }
            val failure = AccountDeletionResult.Failure(
                message = error.message ?: "Failed to delete account.",
                kind = kind,
                statusCode = error.statusCode,
            )
            lastError = failure.message
            failure
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Throwable) {
            val failure = AccountDeletionResult.Failure(
                message = message(error),
                kind = AccountDeletionFailureKind.Unexpected,
            )
            lastError = failure.message
            failure
        } finally {
            isDeletingAccount = false
        }
    }

    suspend fun sendPasswordReset(email: String) {
        runCatching { service.sendPasswordReset(email) }
            .onSuccess { lastError = null; lastSuccessAt = System.currentTimeMillis() }
            .onFailure { lastError = message(it) }
    }

    /**
     * Google Sign-In handoff. The view drives Credential Manager
     * ([com.wagerproof.core.services.GoogleSignInHelper]) and passes the idToken.
     * User-cancelled errors are the caller's concern (see GoogleSignInHelper.isUserCancellation).
     */
    suspend fun signInWithGoogle(idToken: String, accessToken: String? = null) {
        runCatching { service.signInWithGoogle(idToken, accessToken) }
            .onSuccess { lastError = null; lastSuccessAt = System.currentTimeMillis() }
            .onFailure { lastError = message(it) }
    }

    // FIDELITY-WAIVER #201: Apple Sign-In omitted on Android (matches AuthService).

    // MARK: -

    private suspend fun handle(status: SessionStatus) {
        when (status) {
            is SessionStatus.Authenticated -> {
                val user = status.session.user
                if (user != null) {
                    prepareAuthenticatedUser(user.id)
                    phase = Phase.Authenticated(user.id)
                    loadProfile(user.id)
                    // Remember how they authenticated so onboarding's Meta
                    // CompleteRegistration reports the real method instead of
                    // always claiming "email" — the sign-in that created the
                    // account can be several sessions before onboarding ends.
                    authProvider(user)?.let(::persistAuthProvider)
                    // After loadProfile: the profile carries the display name
                    // Meta's Advanced Matching hashes.
                    identifyForAnalytics(user)
                } else if (phase is Phase.Launching) {
                    phase = Phase.Unauthenticated
                }
            }
            is SessionStatus.NotAuthenticated -> {
                clearBoundUserIdentity()
                phase = Phase.Unauthenticated
            }
            // Initializing / RefreshFailure → stay in current phase (iOS ignores the analogous no-ops).
            else -> Unit
        }
    }

    /**
     * Bind the signed-in user to every analytics/attribution SDK. Port of iOS
     * `AuthStore.identifyForAnalytics`.
     *
     * Meta Advanced Matching is the single biggest match-rate lever: without a
     * usable advertising id the device graph can't close the loop, and hashed
     * email/name is the only remaining way Meta can attribute the conversion.
     * `setAdvancedMatching` REPLACES the whole hashed set rather than merging,
     * so this must stay the one and only call site.
     */
    private fun identifyForAnalytics(user: UserInfo) {
        // Lowercased to match RevenueCat / web / iOS, which all key on the
        // lowercase Supabase uuid.
        val id = user.id.lowercase()
        // Supabase re-emits Authenticated on every token refresh. Without this
        // guard each refresh would re-hash the user's PII for Meta and re-run
        // RevenueCat's device-identifier collection for no new information.
        if (id == lastIdentifiedUserId) return
        lastIdentifiedUserId = id

        val resolvedEmail = profile?.email ?: user.email
        val displayName = profile?.displayName
            ?: metadataString(user.userMetadata, "full_name", "display_name", "name")
            ?: profile?.username
        val firstName = metadataString(user.userMetadata, "first_name", "given_name")
        val lastName = metadataString(user.userMetadata, "last_name", "family_name")

        AnalyticsService.identify(id)
        MetaAnalyticsService.setUserId(id)
        MetaAnalyticsService.setAdvancedMatching(
            email = resolvedEmail,
            displayName = displayName,
            firstName = firstName,
            lastName = lastName,
            phoneNumber = user.phone,
        )
        RevenueCatService.setSubscriberIdentity(
            userId = id,
            email = resolvedEmail,
            displayName = displayName,
            phoneNumber = user.phone,
            authProvider = authProvider(user),
            username = profile?.username,
            accountCreatedAt = user.createdAt?.toString(),
        )
    }

    /**
     * Clear account A synchronously before account B becomes observable. Profile
     * loading suspends, and publishing B first would otherwise leave A's profile
     * and analytics identity live throughout that network window (or forever if
     * B has no profile row).
     */
    private fun prepareAuthenticatedUser(userId: String) {
        if (shouldClearForAccountTransition(boundUserId, userId)) {
            clearBoundUserIdentity()
        }
        boundUserId = normalizeUserId(userId)
        // A fresh process should already be empty; keep this explicit so profile
        // ownership never depends on constructor history.
        if (shouldDiscardProfile(profile?.id, userId)) {
            profile = null
        }
    }

    private fun clearBoundUserIdentity() {
        val hadIdentifiedUser = lastIdentifiedUserId != null
        val hadBoundUser = boundUserId != null
        profile = null
        if (hadIdentifiedUser) {
            // Only clear Meta's once-per-account registration guard after a real
            // signed-in identity. Cold-launch NotAuthenticated must remain a no-op.
            MetaAnalyticsService.clearUser()
            AnalyticsService.reset()
        }
        if (hadBoundUser || hadIdentifiedUser) {
            RevenueCatService.clearSubscriberIdentity()
        }
        lastIdentifiedUserId = null
        boundUserId = null
    }

    private fun persistAuthProvider(provider: String) {
        runCatching {
            StorePrefs.standard.edit().putString(LAST_AUTH_PROVIDER_KEY, provider).apply()
        }
    }

    private fun authProvider(user: UserInfo): String? =
        metadataString(user.appMetadata, "provider")

    private fun metadataString(metadata: JsonObject?, vararg keys: String): String? {
        if (metadata == null) return null
        for (key in keys) {
            val value = (metadata[key] as? JsonPrimitive)?.contentOrNull?.trim()
            if (!value.isNullOrEmpty()) return value
        }
        return null
    }

    private suspend fun loadProfile(userId: String) {
        // Failure swallowed — profile may not exist yet for new sign-ups; onboarding creates it.
        service.loadProfile(userId)?.let { profile = it }
    }

    companion object {
        internal fun normalizeUserId(userId: String): String = userId.trim().lowercase(Locale.ROOT)

        internal fun shouldClearForAccountTransition(
            boundUserId: String?,
            incomingUserId: String,
        ): Boolean = boundUserId != null &&
            normalizeUserId(boundUserId) != normalizeUserId(incomingUserId)

        internal fun shouldDiscardProfile(
            profileUserId: String?,
            incomingUserId: String,
        ): Boolean = profileUserId != null &&
            normalizeUserId(profileUserId) != normalizeUserId(incomingUserId)

        /**
         * Last auth provider Supabase reported ("email", "google"). Persisted
         * because onboarding can complete in a later app session than the
         * sign-in that created the account, and Meta's CompleteRegistration
         * wants the real registration method.
         */
        internal const val LAST_AUTH_PROVIDER_KEY = "auth.lastProvider"

        /**
         * The provider the current user authenticated with, defaulting to
         * "email" (the only method that existed before social sign-in shipped).
         */
        val lastAuthProvider: String
            get() = runCatching {
                StorePrefs.standard.getString(LAST_AUTH_PROVIDER_KEY, null)
            }.getOrNull() ?: "email"
    }

    private fun message(error: Throwable): String {
        val raw = error.message.orEmpty()
        return raw.ifEmpty { "An unexpected error occurred. Please try again." }
    }
}
