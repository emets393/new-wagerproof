import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Loads the MLB "Player Prop Matchups" slate (RN `mlb-pitcher-matchups.tsx`).
/// Reuses the same 5-way fetch the Props tab uses — `MLBPlayerPropsService`
/// returns per-game starters (with season archetypes), both batting orders,
/// and every posted prop ladder (with L10 hit rates) for the game. The view
/// regroups those per game (matchup card) rather than the Props tab's flat
/// per-player feed.
@Observable
@MainActor
public final class MLBPitcherMatchupsStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var matchups: [MLBPropMatchup] = []
    public private(set) var loadState: LoadState = .idle

    private let service: MLBPlayerPropsService

    public init(service: MLBPlayerPropsService = .shared) {
        self.service = service
    }

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }
    public var errorMessage: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }
    public var hasMatchups: Bool { !matchups.isEmpty }

    /// Chronological slate order (date, then ET game time).
    public func sortedMatchups() -> [MLBPropMatchup] {
        matchups.sorted { a, b in
            if a.officialDate != b.officialDate { return a.officialDate < b.officialDate }
            return (a.gameTimeEt ?? "") < (b.gameTimeEt ?? "")
        }
    }

    public func refresh() async {
        if matchups.isEmpty { loadState = .loading }
        do {
            matchups = try await service.fetchMatchups()
            loadState = .loaded
        } catch {
            loadState = .failed(error.localizedDescription)
        }
    }
}
