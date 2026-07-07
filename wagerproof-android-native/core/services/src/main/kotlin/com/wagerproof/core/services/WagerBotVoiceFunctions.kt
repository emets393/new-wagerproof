package com.wagerproof.core.services

import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

/**
 * Ephemeral OpenAI Realtime session minted by the `create-wagerbot-voice-session`
 * Supabase Edge Function. The function calls OpenAI's GA endpoint
 * (`POST /v1/realtime/client_secrets`) and hands back a short-lived `ek_`
 * client secret plus the model it was minted for.
 *
 * Treat [clientSecret] as a credential — NEVER log or persist it. The edge
 * function already returns `clientSecret`/`model` in camelCase so no key
 * remapping is needed. (No voice DTO exists in core/models; defined here.)
 */
@Serializable
data class VoiceSessionCredentials(
    val clientSecret: String,
    val model: String,
)

/**
 * Mints WagerBot voice sessions via the Supabase edge function.
 * Kotlin port of iOS `WagerBotVoiceFunctions.swift`.
 */
object WagerBotVoiceFunctions {

    /** Non-2xx mint failure; [message] is the server's error text verbatim. */
    class VoiceSessionException(message: String, val status: Int) : Exception(message)

    @Serializable
    private data class MintBody(
        val voice: String,
        val rudeness: String,
        val gameContext: String? = null,
        val model: String? = null,
        val guidance: String? = null,
    )

    @Serializable
    private data class MintError(val error: String? = null)

    /**
     * POST to `create-wagerbot-voice-session`. [voice] is a wire voice id
     * (`marin`/`cedar`/`ash`/…), [rudeness] is `friendly`/`spicy`, and
     * [gameContext] is optional pre-formatted game data the server appends to
     * the system prompt so the bot can talk about a specific matchup. [model]
     * is an optional Realtime model id (`gpt-realtime`/`gpt-realtime-mini`,
     * nil → server default); [guidance] is free-text steering.
     */
    suspend fun createVoiceSession(
        voice: String,
        rudeness: String,
        gameContext: String? = null,
        model: String? = null,
        guidance: String? = null,
    ): VoiceSessionCredentials {
        // The edge function requires a logged-in user (it rate-limits + picks
        // a prompt per account) — resolve the JWT before the call.
        val token = EdgeFunctions.requireAccessToken()

        // WagerproofJson has explicitNulls=false + encodeDefaults=false, so
        // null optionals are omitted from the body — matching the iOS wire shape.
        val body = WagerproofJson.encodeToString(
            MintBody(voice, rudeness, gameContext, model, guidance)
        )

        val response = EdgeFunctions.post("create-wagerbot-voice-session", body, token)
        if (!response.isSuccess) {
            // The function returns `{ "error": string }` on failure — surface it
            // verbatim so the rate-limit message (HTTP 429) reaches the user.
            val message = runCatching {
                WagerproofJson.decodeFromString<MintError>(response.body).error
            }.getOrNull() ?: "Voice session request failed (${response.status})"
            throw VoiceSessionException(message, response.status)
        }

        return WagerproofJson.decodeFromString(response.body)
    }
}
