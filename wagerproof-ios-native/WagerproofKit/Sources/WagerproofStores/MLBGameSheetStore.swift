import Foundation
import Observation
import WagerproofModels

/// Drives the MLB game detail bottom sheet + caches today's full slate.
///
/// Mirrors the RN combination of `MLBGameSheetContext` and the MLB-feed
/// fetch logic on the index screen (`fetchMLBData()` in
/// `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx`). Backend queries stay
/// byte-identical:
///   1. `mlb_games_today.select('*').gte('official_date', today).lte(...)`
///   2. `mlb_predictions_current.select('*')` keyed by `game_pk`
///   3. `mlb_team_mapping.select('*')` for abbreviation + logo
///   4. `mlb_game_signals.select('*')` for supplemental signal pills
///
/// The merge precedence — predictions overrides games-today fields, mapping
/// fills `away_abbr` / `home_abbr` / logos, signals attach last — mirrors
/// the RN fetch byte-for-byte. Errors short-circuit each query but never
/// the merge step (so a missing signals table still yields a renderable
/// sheet).
@Observable
@MainActor
public final class MLBGameSheetStore {
    public var selectedGame: MLBGame?
    public private(set) var games: [MLBGame] = []
    public private(set) var lastFetched: Date?

    public init() {}

    public func openGameSheet(_ game: MLBGame) {
        selectedGame = game
    }

    public func closeGameSheet() {
        selectedGame = nil
    }

    #if DEBUG
    /// Test-only seeding hook used by parity-screenshot builds.
    public func debugSet(games: [MLBGame], selected: MLBGame? = nil) {
        self.games = games
        self.selectedGame = selected
        self.lastFetched = Date()
    }
    #endif
}
