import Foundation
import Supabase
import WagerproofModels

/// Why a vote write was refused. The store rolls back either way; the
/// distinction only decides whether the UI should tell the user to slow down.
public enum WidgetVoteError: Error, Sendable, Equatable {
    /// Server rate limit (SQLSTATE 54000): 30 changes/minute, 600/day.
    case rateLimited
    case failed
}

/// Up/down votes on game-detail widget cards.
/// Contract: `.claude/docs/34_widget_votes_share.md`.
///
/// **MAIN Supabase, RPC only.** The vote tables have RLS on with no policies and
/// no table grants, so a direct `.from("widget_votes")` returns a permission
/// error by design — do not "simplify" these into table calls. The voter is
/// taken from the JWT server-side; there is no user-id parameter to send.
public enum WidgetVoteService {
    private struct FetchParams: Encodable {
        let p_sport: String
        let p_game_id: String
    }

    private struct CastParams: Encodable {
        let p_sport: String
        let p_game_id: String
        let p_widget_key: String
        let p_vote: Int
    }

    /// Tallies for every widget of one game that has ever been voted on, keyed
    /// by widget key. A missing key means "no votes yet", not an error.
    ///
    /// Returns `nil` only when the call itself failed so the store can retry
    /// rather than cache the miss. Never throws: a detail sheet renders fine
    /// without scores.
    public static func fetch(sport: String, gameId: String) async -> [String: WidgetVoteTally]? {
        guard !gameId.isEmpty else { return [:] }
        do {
            let main = await MainSupabase.shared.client
            let rows: [WidgetVoteTally] = try await main
                .rpc("get_widget_votes", params: FetchParams(p_sport: sport, p_game_id: gameId))
                .execute()
                .value
            return Dictionary(rows.map { ($0.widgetKey, $0) }, uniquingKeysWith: { first, _ in first })
        } catch {
            print("[WidgetVoteService.fetch] \(sport) \(gameId): \(error)")
            return nil
        }
    }

    /// Cast (+1 / -1) or clear (0) the caller's vote. On success returns the
    /// server's fresh tally for that widget, which the store adopts over its
    /// optimistic guess — other people vote while the sheet is open.
    public static func cast(
        sport: String,
        gameId: String,
        widgetKey: String,
        vote: Int
    ) async -> Result<WidgetVoteTally, WidgetVoteError> {
        do {
            let main = await MainSupabase.shared.client
            let rows: [WidgetVoteTally] = try await main
                .rpc(
                    "cast_widget_vote",
                    params: CastParams(p_sport: sport, p_game_id: gameId, p_widget_key: widgetKey, p_vote: vote)
                )
                .execute()
                .value
            guard let row = rows.first else { return .failure(.failed) }
            return .success(row)
        } catch {
            print("[WidgetVoteService.cast] \(sport) \(gameId) \(widgetKey): \(error)")
            return .failure(isRateLimit(error) ? .rateLimited : .failed)
        }
    }

    private static func isRateLimit(_ error: Error) -> Bool {
        if let postgrest = error as? PostgrestError, postgrest.code == "54000" { return true }
        // Belt and braces: the SDK has wrapped Postgres errors differently
        // across versions, and misreading this one only costs a haptic.
        return String(describing: error).contains("54000")
    }
}
