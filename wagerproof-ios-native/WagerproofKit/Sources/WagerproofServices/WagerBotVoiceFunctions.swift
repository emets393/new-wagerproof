import Foundation
import Supabase

/// Ephemeral OpenAI Realtime session minted by the `create-wagerbot-voice-session`
/// Supabase Edge Function. The function calls OpenAI's GA endpoint
/// (`POST /v1/realtime/client_secrets`) and hands back a short-lived `ek_`
/// client secret plus the model it was minted for.
///
/// Treat `clientSecret` as a credential — never log or persist it. Ported from
/// Honeydew's `RealtimeSession`; the WagerProof edge function already returns
/// `clientSecret`/`model` in camelCase so no key remapping is needed.
public struct RealtimeSession: Codable, Sendable {
    public let clientSecret: String
    public let model: String
}

/// Mints WagerBot voice sessions via the Supabase edge function. Mirrors the
/// contract of Honeydew's `FunctionsService.createRoastChefRealtimeSession`,
/// but targets a Supabase Edge Function (authenticated with the user JWT)
/// instead of a Firebase callable.
public enum WagerBotVoiceFunctions {
    /// POST to `create-wagerbot-voice-session`. `voice` is a wire voice id
    /// (`marin`/`cedar`/`ash`/…), `rudeness` is `friendly`/`spicy`, and
    /// `gameContext` is optional pre-formatted game data the server appends to
    /// the system prompt so the bot can talk about a specific matchup.
    public static func createVoiceSession(
        voice: String,
        rudeness: String,
        gameContext: String? = nil,
        model: String? = nil,
        guidance: String? = nil
    ) async throws -> RealtimeSession {
        let main = await MainSupabase.shared.client
        // The edge function requires a logged-in user (it rate-limits + picks a
        // prompt per account). Resolve/refresh the JWT before the call.
        let authSession = try await main.auth.session

        let url = URL(string: "\(SupabaseConfig.Main.url.absoluteString)/functions/v1/create-wagerbot-voice-session")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(authSession.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        struct Body: Encodable {
            let voice: String
            let rudeness: String
            let gameContext: String?
            let model: String?
            let guidance: String?
        }
        req.httpBody = try JSONEncoder().encode(
            Body(voice: voice, rudeness: rudeness, gameContext: gameContext, model: model, guidance: guidance)
        )

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw NSError(
                domain: "WagerBotVoiceFunctions", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No HTTP response from voice session endpoint"]
            )
        }
        if !(200..<300).contains(http.statusCode) {
            // The function returns `{ "error": string }` on failure — surface it
            // verbatim so the rate-limit message (HTTP 429) reaches the user.
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
                ?? "Voice session request failed (\(http.statusCode))"
            throw NSError(
                domain: "WagerBotVoiceFunctions", code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: msg]
            )
        }
        return try JSONDecoder().decode(RealtimeSession.self, from: data)
    }
}
