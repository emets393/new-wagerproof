import Foundation
import WagerproofModels

/// How each sport's feed row maps onto the `game_id` / `game_date` that
/// `avatar_picks` stores — the join keys for `get_game_agent_consensus`.
/// See `.claude/docs/18_agent_consensus.md` ("Join key").
///
/// These are NOT always the model's `id`. The V3 slate builder writes whichever
/// id its own source table publishes, and for NFL/CFB that is the training key,
/// not the input view's own primary key.
enum GameConsensusKey {
    /// NFL picks key off the nflverse `game_id` on the dry-run path and
    /// `nfl_predictions_epa.training_key` on the legacy path — `trainingKey`
    /// carries both. `id` does not: the legacy fetch prefers the input view's
    /// own `id` column when it is present.
    static func nfl(_ game: NFLPrediction) -> String {
        firstNonBlank(game.trainingKey, game.gameId, game.id)
    }

    /// CFB mirrors the V3 formatter's `training_key || unique_id` fallback
    /// chain; on the dry-run path all three collapse to the CFBD game id.
    static func cfb(_ game: CFBPrediction) -> String {
        firstNonBlank(game.trainingKey, game.uniqueId, game.gameId, game.id)
    }

    static func nba(_ game: NBAGame) -> String { String(game.gameId) }

    static func ncaab(_ game: NCAABGame) -> String { String(game.gameId) }

    /// MLB picks are keyed by `String(game_pk)` — verified at 100% against the
    /// live feed, and true by construction: V3's slate and the feed read the
    /// same `mlb_games_today` view.
    static func mlb(_ game: MLBGame) -> String { String(game.gamePk) }

    /// Distinct, sorted `yyyy-MM-dd` ET dates for a slate. Sorting keeps the
    /// value stable across refetches that return the same slate in a different
    /// order, so the store's TTL check doesn't thrash.
    static func dates(_ raw: [String]) -> [String] {
        Set(raw.map { GameDateGrouping.dateKey(from: $0) }.filter { !$0.isEmpty }).sorted()
    }

    private static func firstNonBlank(_ candidates: String?...) -> String {
        for candidate in candidates {
            if let candidate, !candidate.isEmpty { return candidate }
        }
        return ""
    }
}
