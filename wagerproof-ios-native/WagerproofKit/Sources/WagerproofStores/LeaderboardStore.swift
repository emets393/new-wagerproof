import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// `LeaderboardStore` ports `wagerproof-mobile/hooks/useLeaderboard.ts` plus
/// the filter UI state at the top of `components/agents/AgentLeaderboard.tsx`.
///
/// One observable owns the sort mode, timeframe, exclude-under-10 flag, and
/// the resulting entries — re-fetching every time a filter flips. The view
/// just renders state and bumps the bindings.
@Observable
@MainActor
public final class LeaderboardStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public typealias SortMode = AgentPerformanceService.LeaderboardSortMode
    public typealias Timeframe = AgentPerformanceService.LeaderboardTimeframe

    // MARK: - State

    public private(set) var entries: [AgentLeaderboardEntry] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var lastRefreshedAt: Date?

    /// Active sort mode pill. Mirrors RN `sortMode` useState in
    /// AgentLeaderboard.tsx:396.
    public var sortMode: SortMode = .overall {
        didSet { if sortMode != oldValue { Task { await refresh() } } }
    }

    /// Active timeframe pill. Mirrors RN `timeframe`.
    public var timeframe: Timeframe = .allTime {
        didSet { if timeframe != oldValue { Task { await refresh() } } }
    }

    /// Whether to exclude agents with fewer than 10 picks.
    public var excludeUnder10Picks: Bool = false {
        didSet { if excludeUnder10Picks != oldValue { Task { await refresh() } } }
    }

    /// Optional sport filter (nil = all sports).
    public var sport: AgentSport? = nil {
        didSet { if sport != oldValue { Task { await refresh() } } }
    }

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }

    public var lastError: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }

    public init() {}

    /// First-load / pull-to-refresh entry point.
    public func refresh() async {
        loadState = .loading
        do {
            self.entries = try await AgentPerformanceService.fetchLeaderboard(
                limit: 100,
                sport: sport,
                sortMode: sortMode,
                excludeUnder10Picks: excludeUnder10Picks,
                timeframe: timeframe
            )
            self.loadState = .loaded
            self.lastRefreshedAt = Date()
        } catch {
            self.loadState = .failed((error as NSError).localizedDescription)
        }
    }

    /// Convenience for the Bottom-100 mode used to color-code win rates.
    public var isBottomMode: Bool { sortMode == .bottom100 }

    #if DEBUG
    public func debugSet(entries: [AgentLeaderboardEntry], state: LoadState = .loaded) {
        self.entries = entries
        self.loadState = state
        self.lastRefreshedAt = state == .loaded ? Date() : nil
    }
    #endif
}
