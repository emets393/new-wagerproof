package com.wagerproof.core.services

import com.wagerproof.core.models.Profile
import com.wagerproof.core.models.serialization.WagerproofJson
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.SignOutScope
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/**
 * Services half of iOS `AuthStore` (WagerproofStores/AuthStore.swift): the raw
 * Supabase auth flows, no observable state. The `@Observable` store lands
 * later in :core:stores and subscribes to [sessionStatus].
 *
 * All functions throw on failure — error → user-facing message mapping is the
 * store's job (iOS `lastError`).
 */
object AuthService {

    sealed class AccountDeletionException(
        message: String,
        open val statusCode: Int? = null,
    ) : Exception(message) {
        class NoSession : AccountDeletionException("No active session")
        class Server(message: String, override val statusCode: Int) :
            AccountDeletionException(message, statusCode)
        class MalformedResponse(override val statusCode: Int) :
            AccountDeletionException("Account deletion returned an unexpected response", statusCode)
    }

    /**
     * Raw auth state passthrough for the future store. iOS switches on
     * AuthChangeEvent and ignores passwordRecovery/userDeleted/mfaChallengeVerified;
     * supabase-kt doesn't surface those as distinct statuses, so the raw flow is
     * already the filtered equivalent: Authenticated → authenticated(userId) +
     * loadProfile, NotAuthenticated → unauthenticated.
     */
    val sessionStatus: StateFlow<SessionStatus>
        get() = SupabaseClients.main.auth.sessionStatus

    suspend fun signIn(email: String, password: String) {
        SupabaseClients.main.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signUp(email: String, password: String) {
        // Mirrors RN/iOS: `wagerproof://` as the email confirm redirect — byte-for-byte.
        SupabaseClients.main.auth.signUpWith(Email, redirectUrl = "wagerproof://") {
            this.email = email
            this.password = password
        }
    }

    suspend fun sendPasswordReset(email: String) {
        // RN passes `wagerproof://reset-password` — preserve byte-for-byte.
        SupabaseClients.main.auth.resetPasswordForEmail(
            email = email,
            redirectUrl = "wagerproof://reset-password",
        )
    }

    suspend fun signOut() {
        SupabaseClients.main.auth.signOut()
    }

    /**
     * Permanently delete the authenticated account through the existing
     * `delete-own-account` edge function. The explicit bearer transport is
     * required because this function owns destructive user data.
     *
     * Local sign-out happens only after the server confirms `{success:true}`.
     * LOCAL scope avoids making a second server request against a user that no
     * longer exists while still clearing the persisted refresh/access tokens.
     */
    suspend fun deleteAccount() {
        val token = EdgeFunctions.accessTokenOrNull()
            ?: throw AccountDeletionException.NoSession()
        val response = EdgeFunctions.post(
            name = "delete-own-account",
            bodyJson = "{}",
            bearerToken = token,
        )
        requireSuccessfulAccountDeletion(response)
        SupabaseClients.main.auth.signOut(SignOutScope.LOCAL)
    }

    /**
     * Set a new password for the currently-recovering user. Consumed by the
     * Android-only ResetPasswordScreen after the `wagerproof://reset-password`
     * deep link restores a recovery session (iOS has no in-app consumer — see
     * FIDELITY-WAIVER #240). Requires an active session (the recovery link
     * establishes one); throws otherwise.
     */
    suspend fun updatePassword(newPassword: String) {
        SupabaseClients.main.auth.updateUser {
            password = newPassword
        }
    }

    // FIDELITY-WAIVER #201: Apple Sign-In omitted on Android (iOS
    // AuthStore.signInWithApple trades an ASAuthorization idToken to Supabase).

    /**
     * Trade a Google idToken (from [GoogleSignInHelper]) for a Supabase
     * session — same `signInWithIdToken(provider: .google, …)` call iOS makes.
     * Credential Manager doesn't mint an accessToken, so it's usually null.
     */
    suspend fun signInWithGoogle(idToken: String, accessToken: String? = null) {
        SupabaseClients.main.auth.signInWith(IDToken) {
            provider = Google
            this.idToken = idToken
            this.accessToken = accessToken
        }
    }

    /**
     * Load the user's `profiles` row. Failure returns null silently — the
     * profile may not exist yet for new sign-ups; onboarding is responsible
     * for first-time profile creation.
     */
    suspend fun loadProfile(userId: String): Profile? = runCatching {
        SupabaseClients.main.from("profiles")
            .select { filter { eq("id", userId) } }
            .decodeSingleOrNull<Profile>()
    }.getOrNull()

    internal fun requireSuccessfulAccountDeletion(response: EdgeFunctions.EdgeResponse) {
        val envelope = runCatching { WagerproofJson.parseToJsonElement(response.body) }
            .getOrNull() as? JsonObject

        if (envelope == null) {
            if (response.isSuccess) {
                throw AccountDeletionException.MalformedResponse(response.status)
            }
            throw AccountDeletionException.Server(
                message = "Failed to delete account (${response.status})",
                statusCode = response.status,
            )
        }

        val success = (envelope["success"] as? JsonPrimitive)?.booleanOrNull == true
        if (response.isSuccess && success) return

        val serverMessage = (envelope["error"] as? JsonPrimitive)
            ?.takeIf { it.isString }
            ?.content
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
        throw AccountDeletionException.Server(
            message = serverMessage ?: "Failed to delete account (${response.status})",
            statusCode = response.status,
        )
    }
}
