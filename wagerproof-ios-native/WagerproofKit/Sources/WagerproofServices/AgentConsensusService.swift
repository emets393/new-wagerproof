import Foundation
import Supabase
import WagerproofModels

/// Public-agent consensus for the games feed — "N agents on <side>" plus the
/// green BET flag. See `.claude/docs/18_agent_consensus.md`.
///
/// **MAIN Supabase, not CFB.** `avatar_picks` lives with auth/user data, and it
/// is RLS-gated so the anon key sees ZERO rows — a direct table select returns
/// nothing for signed-out *and* signed-in users. The aggregate can only come
/// from the SECURITY DEFINER RPC.
///
/// The feed itself comes from the CFB project, so there is no SQL join
/// available: this returns counts keyed by `game_id` and the caller merges by
/// map lookup. That merge MUST be a left join — picks exist before predictions
/// populate, so a game with no consensus row is normal, not an error.
public enum AgentConsensusService {
    private struct Params: Encodable {
        let p_sport: String
        let p_game_dates: [String]
    }

    /// One RPC call for a whole slate, keyed by game id.
    ///
    /// `dates` must be EVERY distinct game date in the feed (`yyyy-MM-dd`, ET).
    /// The flag threshold scales with the day's total volume, and MLB's slate
    /// spans today AND tomorrow — a single-date call would leave the next day's
    /// cards permanently unflagged.
    ///
    /// Returns `nil` only when the call itself failed, so callers can tell a
    /// genuine error apart from a legitimately empty slate and retry instead of
    /// caching the miss. Never throws: the feed renders fine without the strip.
    public static func fetch(
        sport: String,
        dates: [String]
    ) async -> [String: GameAgentConsensus]? {
        guard !dates.isEmpty else { return [:] }
        do {
            let main = await MainSupabase.shared.client
            // p_min_share / p_rel_share / p_min_agents are left at their SQL
            // defaults (the calibrated 0.55 / 0.08 / 8) — same as web, so both
            // clients flag the same games.
            let rows: [GameAgentConsensus] = try await main
                .rpc("get_game_agent_consensus", params: Params(p_sport: sport, p_game_dates: dates))
                .execute()
                .value
            return Dictionary(rows.map { ($0.gameId, $0) }, uniquingKeysWith: { first, _ in first })
        } catch {
            print("[AgentConsensusService.fetch] \(sport) \(dates): \(error)")
            return nil
        }
    }
}
