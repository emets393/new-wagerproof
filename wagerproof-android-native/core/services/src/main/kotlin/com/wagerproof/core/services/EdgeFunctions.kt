package com.wagerproof.core.services

import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Raw edge-function transport for the Main project.
 *
 * Every invoke sets an explicit `Authorization: Bearer <token>` header — the
 * Supabase SDK sometimes drops auto-auth on `verify_jwt=false` functions, so
 * the explicit header is a load-bearing workaround ported from iOS. Do not
 * rely on SDK auto-auth for any edge function.
 */
object EdgeFunctions {

    private val JSON_MEDIA_TYPE = "application/json".toMediaType()

    class NoSessionException : Exception("Not signed in")

    /** Raw edge response; callers shape their own service-specific errors. */
    data class EdgeResponse(val status: Int, val body: String) {
        val isSuccess: Boolean get() = status in 200..299
    }

    /** Current Main-project access token, waiting out cold-start session restore first. */
    suspend fun accessTokenOrNull(): String? {
        val auth = SupabaseClients.main.auth
        runCatching { auth.awaitInitialization() }
        return auth.currentSessionOrNull()?.accessToken
    }

    /** Access token or [NoSessionException] — mirrors iOS services that throw `noSession`. */
    suspend fun requireAccessToken(): String =
        accessTokenOrNull() ?: throw NoSessionException()

    /**
     * POST a JSON body to `functions/v1/<name>`. [bearerToken] is the user's
     * access token (or the anon key for unauthenticated functions). Never
     * throws on non-2xx — returns the status + body so callers can surface
     * server error messages verbatim (e.g. voice-session 429 rate limits).
     */
    suspend fun post(
        name: String,
        bodyJson: String,
        bearerToken: String,
        baseUrl: String = SupabaseConfig.Main.URL,
        anonKey: String = SupabaseConfig.Main.ANON_KEY,
    ): EdgeResponse = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/functions/v1/$name")
            .header("Authorization", "Bearer $bearerToken")
            .header("apikey", anonKey)
            .header("Content-Type", "application/json")
            .post(bodyJson.toRequestBody(JSON_MEDIA_TYPE))
            .build()
        ServiceHttp.client.newCall(request).execute().use { response ->
            EdgeResponse(response.code, response.body?.string().orEmpty())
        }
    }
}
