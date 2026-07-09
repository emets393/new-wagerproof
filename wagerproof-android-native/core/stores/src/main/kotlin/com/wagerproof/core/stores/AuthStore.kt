package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.Profile
import com.wagerproof.core.services.AuthService
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

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
            .onSuccess { phase = Phase.Unauthenticated; profile = null }
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
            phase = Phase.Unauthenticated
            profile = null
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
                val userId = status.session.user?.id
                if (userId != null) {
                    phase = Phase.Authenticated(userId)
                    loadProfile(userId)
                } else if (phase is Phase.Launching) {
                    phase = Phase.Unauthenticated
                }
            }
            is SessionStatus.NotAuthenticated -> {
                phase = Phase.Unauthenticated
                profile = null
            }
            // Initializing / RefreshFailure → stay in current phase (iOS ignores the analogous no-ops).
            else -> Unit
        }
    }

    private suspend fun loadProfile(userId: String) {
        // Failure swallowed — profile may not exist yet for new sign-ups; onboarding creates it.
        service.loadProfile(userId)?.let { profile = it }
    }

    private fun message(error: Throwable): String {
        val raw = error.message.orEmpty()
        return raw.ifEmpty { "An unexpected error occurred. Please try again." }
    }
}
