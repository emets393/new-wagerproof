import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Drives the Props tab. Mirrors `GamesStore`'s shape (per-sport selection,
/// 5-minute cache TTL, pull-to-refresh bypass) but the feed items are
/// player-prop entities instead of games.
///
/// Two sports have props today: MLB (matchups feed with game logs + alt-line
/// ladders) and NFL (odds-board feed with cross-book price comparison).
/// Remaining sports render a "coming soon" empty state and never fetch.
@Observable
@MainActor
public final class PropsStore {
    /// Sports surfaced in the picker. Order puts MLB first since it carries
    /// the deepest props data today. No CFB — college player props aren't
    /// offered (NCAA restrictions), so the segment would be a dead end.
    public enum Sport: String, CaseIterable, Identifiable, Sendable {
        case mlb, nfl, cfb, nba, ncaab

        public var id: String { rawValue }

        public var label: String {
            switch self {
            case .mlb: return "MLB"
            case .nfl: return "NFL"
            case .cfb: return "CFB"
            case .nba: return "NBA"
            case .ncaab: return "NCAAB"
            }
        }

        /// Whether this sport has a player-props feed yet.
        public var hasProps: Bool { self == .mlb || self == .nfl }

        /// Mirror the Games tab's selected sport when the user switches to Props.
        public static func matching(gamesSport: GamesStore.Sport) -> Sport {
            Sport(rawValue: gamesSport.rawValue) ?? .mlb
        }

        /// Mirror this Props segment back onto the Games tab.
        public var gamesSport: GamesStore.Sport {
            GamesStore.Sport(rawValue: rawValue) ?? .mlb
        }
    }

    public enum LoadState: Equatable {
        case idle, loading, loaded
        case failed(String)
    }

    public var selectedSport: Sport = .mlb
    public private(set) var matchups: [MLBPropMatchup] = []
    public private(set) var nflPlayers: [NFLPropPlayer] = []
    private var loadState: [Sport: LoadState] = [:]
    private var lastFetched: [Sport: Date] = [:]

    /// 5-minute cache TTL — matches the games feed.
    private let ttl: TimeInterval = 300

    private let service: MLBPlayerPropsService
    private let nflService: NFLPlayerPropsService

    public init(service: MLBPlayerPropsService = .shared, nflService: NFLPlayerPropsService = .shared) {
        self.service = service
        self.nflService = nflService
    }

    // MARK: - Derived state (selected sport)

    public var isLoading: Bool { loadState[selectedSport] == .loading }

    public var errorMessage: String? {
        if case let .failed(msg) = loadState[selectedSport] { return msg }
        return nil
    }

    public var hasCachedMatchups: Bool {
        switch selectedSport {
        case .mlb: return !matchups.isEmpty
        case .nfl: return !nflPlayers.isEmpty
        default: return false
        }
    }

    /// Per-game lookup for the MLB game-sheet "Player Props" widget.
    public func matchup(for gamePk: Int) -> MLBPropMatchup? {
        matchups.first { $0.gamePk == gamePk }
    }

    /// MLB-specific load state, independent of the Props tab's selected sport
    /// — the MLB game sheet reads these for the first-hydrate skeleton rule.
    public var isLoadingMLB: Bool { loadState[.mlb] == .loading }
    public var hasLoadedMLB: Bool { lastFetched[.mlb] != nil }

    /// MLB-specific hydrate for the game-sheet widget. `refresh()` keys off
    /// `selectedSport` (the Props tab picker), which may be parked on another
    /// sport while the user opens an MLB game sheet — so the sheet calls this.
    public func refreshMLB(force: Bool = false) async {
        if !force, loadState[.mlb] == .loaded, let last = lastFetched[.mlb],
           Date().timeIntervalSince(last) < ttl {
            return
        }
        if matchups.isEmpty { loadState[.mlb] = .loading }
        do {
            matchups = try await service.fetchMatchups()
            lastFetched[.mlb] = Date()
            loadState[.mlb] = .loaded
        } catch {
            loadState[.mlb] = matchups.isEmpty ? .failed(friendlyError(error)) : .loaded
        }
    }

    /// NFL-specific hydrate for search — mirrors `refreshMLB`.
    public func refreshNFL(force: Bool = false) async {
        if !force, loadState[.nfl] == .loaded, let last = lastFetched[.nfl],
           Date().timeIntervalSince(last) < ttl {
            return
        }
        if nflPlayers.isEmpty { loadState[.nfl] = .loading }
        do {
            nflPlayers = try await nflService.fetchPlayers()
            lastFetched[.nfl] = Date()
            loadState[.nfl] = .loaded
        } catch {
            loadState[.nfl] = nflPlayers.isEmpty ? .failed(friendlyError(error)) : .loaded
        }
    }

    public var isLoadingNFL: Bool { loadState[.nfl] == .loading }
    public var hasLoadedNFL: Bool { lastFetched[.nfl] != nil }

    /// Matchups ordered by game time (the service already orders by date then
    /// time; this keeps a stable secondary sort if the API order drifts).
    public func sortedMatchups() -> [MLBPropMatchup] {
        matchups.sorted { a, b in
            if a.officialDate != b.officialDate { return a.officialDate < b.officialDate }
            return (a.gameTimeEt ?? "") < (b.gameTimeEt ?? "")
        }
    }

    // MARK: - Fetch

    /// Refresh the selected sport's feed. Sports without props no-op.
    /// `force` bypasses the cache TTL (pull-to-refresh).
    /// No Dummy Data Mode branch here — props always come from the live
    /// tables, so an offseason board is honestly empty.
    public func refresh(force: Bool = false) async {
        let sport = selectedSport
        guard sport.hasProps else { return }

        if !force, loadState[sport] == .loaded, let last = lastFetched[sport],
           Date().timeIntervalSince(last) < ttl {
            return
        }
        // Don't show the skeleton over a populated cache during a silent
        // background refresh — only when there's nothing to show.
        if !hasCachedMatchups { loadState[sport] = .loading }

        do {
            switch sport {
            case .mlb:
                matchups = try await service.fetchMatchups()
            case .nfl:
                nflPlayers = try await nflService.fetchPlayers()
            default:
                return
            }
            lastFetched[sport] = Date()
            loadState[sport] = .loaded
        } catch {
            loadState[sport] = hasCachedMatchups ? .loaded : .failed(friendlyError(error))
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
        self.loadState[.mlb] = .loaded
        self.lastFetched[.mlb] = Date()
    }

    public func debugSet(nflPlayers: [NFLPropPlayer]) {
        self.nflPlayers = nflPlayers
        self.loadState[.nfl] = .loaded
        self.lastFetched[.nfl] = Date()
    }
    #endif
}
