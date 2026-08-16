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
        case mlb, nfl, nba

        public var id: String { rawValue }

        public var label: String {
            switch self {
            case .mlb: return "MLB"
            case .nfl: return "NFL"
            case .nba: return "NBA"
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

    // Derived MLB caches. NOT observed: the game sheet reads them from a view
    // body, and mutating observed state during view update is illegal (render
    // loop). Views still invalidate correctly because they also read
    // `matchups`, which IS observed. Same shape as `ParlayGodStore.gameTicketCache`.
    //
    // INVALIDATION KEY: the MLB slate itself. Everything below is rebuilt or
    // dropped in `setMatchups`, the single funnel through which `matchups` is
    // ever reassigned — so a refresh can never leave a stale summary behind.
    @ObservationIgnored private var matchupIndex: [Int: MLBPropMatchup] = [:]
    @ObservationIgnored private var insightSummaryCache: [Int: PropsInsightSummary?] = [:]
    @ObservationIgnored private var sortedMatchupsCache: [MLBPropMatchup] = []
    /// Process-unique namespace for app-target static feed caches. Preview and
    /// screenshot stores can share the same integer version while containing
    /// different fixtures, so version alone is not a safe global cache key.
    @ObservationIgnored public let feedCacheID = UUID()
    /// Bumped on every MLB slate reassignment. Exposed so derived caches that
    /// CANNOT live in this module — `PlayerPropFeed` items are an app-target
    /// type, WagerproofKit can't name them — can key off the same invalidation
    /// point instead of inventing their own staleness rule.
    @ObservationIgnored public private(set) var matchupsVersion: Int = 0
    /// Same invalidation contract for the app-target NFL feed cache.
    @ObservationIgnored public private(set) var nflPlayersVersion: Int = 0
    @ObservationIgnored private var nflInsightCache: [String: NFLPropsInsightSummary?] = [:]

    /// The only place `matchups` is assigned. Rebuilds the per-game index and
    /// drops every derived cache so nothing can outlive the data it came from.
    private func setMatchups(_ new: [MLBPropMatchup]) {
        matchups = new
        matchupIndex = Dictionary(new.map { ($0.gamePk, $0) }, uniquingKeysWith: { first, _ in first })
        sortedMatchupsCache = new.sorted { a, b in
            if a.officialDate != b.officialDate { return a.officialDate < b.officialDate }
            return (a.gameTimeEt ?? "") < (b.gameTimeEt ?? "")
        }
        insightSummaryCache.removeAll()
        matchupsVersion &+= 1
    }

    private func setNFLPlayers(_ new: [NFLPropPlayer]) {
        nflPlayers = new
        nflPlayersVersion &+= 1
        nflInsightCache.removeAll()
    }

    /// Players in this matchup — team-abbr matching, not `game_id`. Player
    /// pages synthesize a game key that may not match `nfl_dryrun_games`.
    public func nflPlayers(matchingAway away: String, home: String) -> [NFLPropPlayer] {
        let teams: Set<String> = [
            NFLTeams.abbr(for: away).uppercased(),
            NFLTeams.abbr(for: home).uppercased(),
        ]
        return nflPlayers.filter { player in
            guard let team = player.team.map({ NFLTeams.abbr(for: $0).uppercased() }),
                  let opp = player.opponent.map({ NFLTeams.abbr(for: $0).uppercased() })
            else { return false }
            return teams.contains(team) && teams.contains(opp)
        }
    }

    /// Memoized matchup digest for the NFL game-sheet Player Props widget.
    public func nflPropsInsight(matchingAway away: String, home: String) -> NFLPropsInsightSummary? {
        let key = "\(NFLTeams.abbr(for: away).uppercased())|\(NFLTeams.abbr(for: home).uppercased())"
        if let cached = nflInsightCache[key] { return cached }
        let built = NFLPropsInsight.summary(for: nflPlayers(matchingAway: away, home: home))
        nflInsightCache[key] = built
        return built
    }

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
        matchupIndex[gamePk]
    }

    /// Memoized `MLBPropsInsight.summary` for one game.
    ///
    /// The uncached call walks every player in the matchup, picks a headline
    /// prop, and makes five passes over that player's ~120-entry season log —
    /// far too expensive to re-run on every body pass of the props widget.
    /// Nil is memoized too (a matchup with no headline props hides the card),
    /// so the miss path can't re-run the pipeline every frame.
    public func propsInsightSummary(forGamePk gamePk: Int) -> PropsInsightSummary? {
        if let cached = insightSummaryCache[gamePk] { return cached }
        guard let matchup = matchupIndex[gamePk] else { return nil }
        let built = MLBPropsInsight.summary(for: matchup)
        insightSummaryCache[gamePk] = built
        return built
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
            setMatchups(try await service.fetchMatchups())
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
            setNFLPlayers(try await nflService.fetchPlayers())
            lastFetched[.nfl] = Date()
            loadState[.nfl] = .loaded
        } catch {
            loadState[.nfl] = nflPlayers.isEmpty ? .failed(friendlyError(error)) : .loaded
        }
    }

    public var isLoadingNFL: Bool { loadState[.nfl] == .loading }
    public var hasLoadedNFL: Bool { lastFetched[.nfl] != nil }

    /// Unused — NFL props read `nfl_prop_player_pages`, not dry-run tables.
    public var dryRunPreviewEnabled: Bool = false

    /// Matchups ordered by game time (the service already orders by date then
    /// time; this keeps a stable secondary sort if the API order drifts).
    public func sortedMatchups() -> [MLBPropMatchup] {
        sortedMatchupsCache
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
                setMatchups(try await service.fetchMatchups())
            case .nfl:
                setNFLPlayers(try await nflService.fetchPlayers())
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
        setMatchups(matchups)
        self.loadState[.mlb] = .loaded
        self.lastFetched[.mlb] = Date()
    }

    public func debugSet(nflPlayers: [NFLPropPlayer]) {
        setNFLPlayers(nflPlayers)
        self.loadState[.nfl] = .loaded
        self.lastFetched[.nfl] = Date()
    }
    #endif
}
