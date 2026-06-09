import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Drives the Props tab. Mirrors `GamesStore`'s shape (per-sport selection,
/// 5-minute cache TTL, pull-to-refresh bypass) but the feed items are
/// `MLBPropMatchup`s instead of games.
///
/// Player props currently exist only for MLB. The sport picker is kept (for
/// visual parity with the Games tab and to leave room for future sports);
/// non-MLB sports render a "coming soon" empty state and never fetch.
@Observable
@MainActor
public final class PropsStore {
    /// Sports surfaced in the picker. Order puts MLB first since it's the
    /// only sport with posted props today.
    public enum Sport: String, CaseIterable, Identifiable, Sendable {
        case mlb, nfl, nba, ncaab, cfb

        public var id: String { rawValue }

        public var label: String {
            switch self {
            case .mlb: return "MLB"
            case .nfl: return "NFL"
            case .nba: return "NBA"
            case .ncaab: return "NCAAB"
            case .cfb: return "CFB"
            }
        }

        /// Whether this sport has a player-props feed yet.
        public var hasProps: Bool { self == .mlb }
    }

    public enum LoadState: Equatable {
        case idle, loading, loaded
        case failed(String)
    }

    public var selectedSport: Sport = .mlb
    public private(set) var matchups: [MLBPropMatchup] = []
    private var loadState: LoadState = .idle
    private var lastFetched: Date?

    /// 5-minute cache TTL — matches the games feed.
    private let ttl: TimeInterval = 300

    private let service: MLBPlayerPropsService

    public init(service: MLBPlayerPropsService = .shared) {
        self.service = service
    }

    // MARK: - Derived state (MLB only for now)

    public var isLoading: Bool { loadState == .loading }

    public var errorMessage: String? {
        if case let .failed(msg) = loadState { return msg }
        return nil
    }

    public var hasCachedMatchups: Bool { !matchups.isEmpty }

    /// Matchups ordered by game time (the service already orders by date then
    /// time; this keeps a stable secondary sort if the API order drifts).
    public func sortedMatchups() -> [MLBPropMatchup] {
        matchups.sorted { a, b in
            if a.officialDate != b.officialDate { return a.officialDate < b.officialDate }
            return (a.gameTimeEt ?? "") < (b.gameTimeEt ?? "")
        }
    }

    // MARK: - Fetch

    /// Refresh the selected sport's feed. Only MLB fetches today; other
    /// sports no-op. `force` bypasses the cache TTL (pull-to-refresh).
    public func refresh(force: Bool = false) async {
        guard selectedSport.hasProps else { return }

        if !force, loadState == .loaded, let last = lastFetched, Date().timeIntervalSince(last) < ttl {
            return
        }
        // Don't show the skeleton over a populated cache during a silent
        // background refresh — only when there's nothing to show.
        if matchups.isEmpty { loadState = .loading }

        do {
            let fetched = try await service.fetchMatchups()
            matchups = fetched
            lastFetched = Date()
            loadState = .loaded
        } catch {
            loadState = matchups.isEmpty ? .failed(friendlyError(error)) : .loaded
        }
    }

    private func friendlyError(_ error: Error) -> String {
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            return "No connection. Pull to retry."
        }
        return "Couldn't load player props. Pull to retry."
    }

    #if DEBUG
    /// Test-only seeding hook for parity-screenshot builds.
    public func debugSet(matchups: [MLBPropMatchup]) {
        self.matchups = matchups
        self.loadState = .loaded
        self.lastFetched = Date()
    }
    #endif
}
