import Foundation
import Supabase
import WagerproofModels

/// One read of `action_public_splits_board` on the college-football project.
/// The raw `action_public_splits` log is never queried — the view is already
/// one row per game and market.
public enum PublicBettingService {
    private static let columns = "game_id,market,sport,start_time,away,home,snap_ts,away_open,home_open,away_cons,home_cons,bets_away,bets_home,money_away,money_home,tickets,has_split"

    public static func loadBoard() async throws -> [PublicBettingGame] {
        let client = await CFBSupabase.shared.client
        let rows: [PublicBoardRow] = try await client
            .from("action_public_splits_board")
            .select(columns)
            .order("start_time", ascending: true)
            .execute()
            .value
        return PublicBetting.games(from: rows)
    }
}
