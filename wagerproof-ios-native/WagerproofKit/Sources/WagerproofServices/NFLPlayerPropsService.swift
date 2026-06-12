import Foundation
import Supabase
import WagerproofModels

/// Fetches the NFL player-props board from the CFB (research) Supabase
/// project, per the "NFL Week 12 2025 Dry Run — App Data Contract":
///
/// - `nfl_dryrun_props` — one row per player × market: consensus close
///   line/prices (median across books), season game-log trends, defense
///   matchup context, P-flags, and the official headshot URL.
/// - `nfl_dryrun_games` — kickoff context (gameday + schedule slot), joined
///   client-side on `game_id`.
///
/// The 2026 in-season tables will follow this same shape, so this service is
/// the production read path — only the table names should change at cutover.
public actor NFLPlayerPropsService {
    public static let shared = NFLPlayerPropsService()
    public init() {}

    /// Fetch the slate's prop rows + game contexts and group them per player.
    /// The dry-run tables hold exactly one curated week (~950 rows), so no
    /// date filter is needed; revisit if the in-season tables accumulate weeks.
    public func fetchPlayers() async throws -> [NFLPropPlayer] {
        let cfb = await CFBSupabase.shared.client

        // Team logos/abbrs come from the `nfl_teams` reference table — warm
        // the cache so the cards can read it synchronously.
        await NFLTeamsService.shared.ensureLoaded()

        let rows: [NFLDryrunPropRow] = try await cfb
            .from("nfl_dryrun_props")
            .select()
            .order("player_name", ascending: true)
            .execute()
            .value

        // Kickoff context is decoration — a miss degrades to undated cards,
        // never to an error.
        let games = (try? await fetchGameContexts(client: cfb)) ?? [:]
        return NFLPlayerProps.group(rows, games: games)
    }

    private struct GameContextRow: Decodable {
        let gameId: String
        let gameday: String?
        let slot: String?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case gameday, slot
        }
    }

    private func fetchGameContexts(client: SupabaseClient) async throws -> [String: NFLPropGameContext] {
        let rows: [GameContextRow] = try await client
            .from("nfl_dryrun_games")
            .select("game_id, gameday, slot")
            .execute()
            .value
        return Dictionary(uniqueKeysWithValues: rows.map {
            ($0.gameId, NFLPropGameContext(gameDate: $0.gameday ?? "", slot: $0.slot))
        })
    }
}
