package com.wagerproof.core.services

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Credential Manager port of iOS `GoogleSignInCoordinator` (GIDSignIn).
 * Returns the Google idToken so [AuthService.signInWithGoogle] can trade it
 * to Supabase — same payload shape as the iOS/RN flow.
 *
 * Construct with an **Activity** context: `getCredential` shows the account
 * picker UI and rejects a bare application context.
 */
class GoogleSignInHelper(private val context: Context) {

    companion object {
        // TODO: replace before shipping. The iOS client ID
        // (142325632215-agrfdkh87j01kgfa4uv4opuohl5l01lq.apps.googleusercontent.com)
        // will NOT work on Android — GetGoogleIdOption needs the WEB/server
        // client ID of the same Google Cloud project, and an Android OAuth
        // client (package name + SHA-1) must be registered in that project.
        const val GOOGLE_WEB_CLIENT_ID = "TODO-REPLACE-web-client-id.apps.googleusercontent.com"
    }

    /** Analog of iOS `GoogleSignInError.missingIDToken`. */
    class MissingIdTokenException : Exception("Google sign-in did not return an idToken.")

    private val credentialManager = CredentialManager.create(context)

    /**
     * Run the Sign in with Google flow and return the idToken.
     *
     * User-cancel surfaces as [GetCredentialCancellationException] — callers
     * swallow it silently, matching iOS's `GIDSignInError.canceled` short-circuit
     * (check via [isUserCancellation]).
     */
    suspend fun signIn(): String {
        // filterByAuthorizedAccounts=false forces the full account picker every
        // time — mirrors iOS calling GIDSignIn.signOut() before each attempt.
        val googleIdOption = GetGoogleIdOption.Builder()
            .setServerClientId(GOOGLE_WEB_CLIENT_ID)
            .setFilterByAuthorizedAccounts(false)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val credential = credentialManager.getCredential(context, request).credential
        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            return GoogleIdTokenCredential.createFrom(credential.data).idToken
        }
        throw MissingIdTokenException()
    }

    /** True when the flow ended because the user dismissed the picker. */
    fun isUserCancellation(error: Throwable): Boolean =
        error is GetCredentialCancellationException
}
