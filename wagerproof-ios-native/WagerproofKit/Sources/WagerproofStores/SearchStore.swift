import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// `SearchStore` powers the global cross-surface search experience that lives
/// behind iOS 18's detached `Tab(role: .search)` slot. Mirrors no single RN
/// screen — the RN app shipped per-tab `.searchable()` bars, this consolidates
/// them into one cross-tab search.
///
/// Architecture: this store does NOT duplicate the fetch logic in
/// `GamesStore`, `AgentsStore`, `OutliersTrendsStore`, `PropsStore`. Instead it
/// is `bind(games:agents:trends:props:)`-ed by the tab shell at mount
/// time, and then derives result arrays from those stores' already-resolved
/// data via computed properties. The view subscribes to this store; SwiftUI's
/// observation tracking re-runs the computed properties whenever the upstream
/// stores or the local `query` / `scope` change.
///
/// Public agents are the one exception — `AgentsStore` only owns the signed-in
/// user's own agents, so we fetch the leaderboard separately (one RPC,
/// debounced and cached) for the cross-user lookup.
///
/// Debounce: every `query` mutation schedules a 200ms task that resets
/// `debouncedQuery`. Previous tasks cancel themselves on the next keystroke,
/// matching the RN useEffect debounce pattern used in editor picks search.
///
/// Recent searches: last 5 committed queries persist in `UserDefaults` under
/// `"search.recent.queries"`. We treat a query as "committed" when it's been
/// non-empty for the full debounce window — typing "L", "LA", "LAL" only
/// records "LAL" once the user pauses.
@Observable
@MainActor
public final class SearchStore {

    // MARK: - Scope

    /// Result categories. `.all` interleaves; the other cases pin to a single
    /// section. Matches the segmented chip row directly above the result list.
    public enum SearchScope: String, Hashable, CaseIterable, Sendable {
        case all
        case games
        case players
        case agents
        case outliers

        public var label: String {
            switch self {
            case .all: return "All"
            case .games: return "Matchup"
            case .players: return "Props"
            case .agents: return "Agents"
            case .outliers: return "Outliers"
            }
        }
    }

    // MARK: - Result types
    //
    // Each result carries enough payload to drive the navigation handoff back
    // to the owning tab. We deliberately keep these as plain structs (not
    // typealiases for the underlying models) so the view layer treats search
    // results as their own value type — easier to reason about and easier to
    // mock in previews.

    public enum SearchResult {
        public struct Game: Identifiable, Hashable, Sendable {
            public let id: String
            public let sport: GamesStoreSport
            public let awayTeam: String
            public let homeTeam: String
            public let gameTime: String?
            /// Stable identifier the per-sport sheet store needs to open the
            /// detail bottom sheet. For NFL/CFB this is the `unique_id` /
            /// `training_key`; for NBA/NCAAB/MLB it's the integer game id
            /// stringified. The owning tab resolves the model from this id.
            public let resolvedId: String
            /// SearchTeamAliases rank — drives result ordering (desc).
            public let matchScore: Int
            /// Which side matched the query (abbr) — weights the MLB insight
            /// chips toward the team the user actually searched.
            public let matchedAbbr: String?

            public init(
                id: String,
                sport: GamesStoreSport,
                awayTeam: String,
                homeTeam: String,
                gameTime: String?,
                resolvedId: String,
                matchScore: Int = 0,
                matchedAbbr: String? = nil
            ) {
                self.id = id
                self.sport = sport
                self.awayTeam = awayTeam
                self.homeTeam = homeTeam
                self.gameTime = gameTime
                self.resolvedId = resolvedId
                self.matchScore = matchScore
                self.matchedAbbr = matchedAbbr
            }
        }

        /// Player-prop match resolved against the PropsStore slate (MLB or NFL).
        /// Carries ids only — the view re-resolves the app-target selection
        /// payload at render/tap time.
        public struct Player: Identifiable, Hashable, Sendable {
            public enum Kind: Hashable, Sendable {
                case mlb(gamePk: Int, playerId: Int, isPitcher: Bool)
                case nfl(playerKey: String, gameId: String)
            }

            public let id: String
            public let kind: Kind
            public let playerName: String
            public let teamAbbr: String
            public let matchScore: Int
            /// Tie-break rank — MLB L10 hit %, NFL headline-market L10 rate.
            public let headlineRank: Double

            public init(
                id: String,
                kind: Kind,
                playerName: String,
                teamAbbr: String,
                matchScore: Int,
                headlineRank: Double
            ) {
                self.id = id
                self.kind = kind
                self.playerName = playerName
                self.teamAbbr = teamAbbr
                self.matchScore = matchScore
                self.headlineRank = headlineRank
            }
        }

        /// Carries the full `AgentWithPerformance` so Search renders the exact
        /// `AgentRowCard` from the Agents tab (own agents) — public/leaderboard
        /// agents are adapted via `AgentWithPerformance(leaderboard:)`.
        public struct Agent: Identifiable, Hashable, Sendable {
            public let id: String
            public let model: AgentWithPerformance
            /// `true` when this row came from the public-agents leaderboard
            /// (vs the signed-in user's own agents).
            public let isPublic: Bool

            public var agentId: String { model.agent.id }

            public init(id: String, model: AgentWithPerformance, isPublic: Bool) {
                self.id = id
                self.model = model
                self.isPublic = isPublic
            }
        }

        /// One Outliers trend card surfaced in search. Carries the full card + its
        /// sport + game so Search renders the exact `OutliersTrendCard` from the tab.
        public struct Trend: Identifiable, Hashable, Sendable {
            public let id: String
            public let card: OutliersTrendsCard
            public let sport: OutliersTrendsSport
            public let game: OutliersTrendsGame?
            public let matchScore: Int

            public init(
                id: String,
                card: OutliersTrendsCard,
                sport: OutliersTrendsSport,
                game: OutliersTrendsGame?,
                matchScore: Int
            ) {
                self.id = id
                self.card = card
                self.sport = sport
                self.game = game
                self.matchScore = matchScore
            }
        }
    }

    /// Subset of `GamesStore.Sport` we mirror here so result rows don't depend
    /// on the upstream type. Wrapped because `GamesStore` is in the same
    /// module — direct import would create a circular ref with the view layer
    /// reading this type back.
    public enum GamesStoreSport: String, Hashable, Sendable, CaseIterable {
        case nfl, cfb, nba, ncaab, mlb
        public var label: String {
            switch self {
            case .nfl: return "NFL"
            case .cfb: return "CFB"
            case .nba: return "NBA"
            case .ncaab: return "NCAAB"
            case .mlb: return "MLB"
            }
        }
    }

    // MARK: - Bound upstream stores
    //
    // These are weak-style references owned by the tab shell. We do not
    // initialize them — `bind(...)` is the single entry point. When unbound,
    // result accessors return empty arrays so the view degrades gracefully.

    private weak var gamesRef: GamesStore?
    private weak var agentsRef: AgentsStore?
    private weak var trendsRef: OutliersTrendsStore?
    private weak var propsRef: PropsStore?

    // MARK: - Observable state

    /// Raw query bound to `.searchable(text:)`. Mutating this schedules a 200ms
    /// debounce that updates `debouncedQuery`. We expose both so the view can
    /// show a `ProgressView` while the debounce settles.
    public var query: String = "" {
        didSet {
            guard query != oldValue else { return }
            scheduleDebounce()
        }
    }

    /// Scope chip selection. Empty queries hide the chip row entirely.
    public var scope: SearchScope = .all

    /// Debounced version of `query`. Result accessors filter against this.
    public private(set) var debouncedQuery: String = ""

    /// `true` between a keystroke and the next debounce flush. Drives the
    /// inline `ProgressView`.
    public private(set) var isDebouncing: Bool = false

    /// Last 5 committed (non-empty) queries, newest first.
    public private(set) var recentQueries: [String] = []

    /// Public-agents cache. Pulled lazily on first non-empty query that
    /// matches the `.all` or `.agents` scope. Reused across queries until
    /// `clearPublicAgentsCache()` is called or the app restarts.
    public private(set) var publicAgents: [AgentLeaderboardEntry] = []
    public private(set) var isLoadingPublicAgents: Bool = false

    private var debounceTask: Task<Void, Never>?
    private let recentQueriesKey = "search.recent.queries"
    private let recentQueriesLimit = 5
    private let debounceWindowNs: UInt64 = 200_000_000 // 200ms

    public init() {
        loadRecentQueries()
    }

    // MARK: - Lifecycle

    /// Wire the upstream stores. Called by the tab shell once at mount. Safe
    /// to call multiple times — overwrites previous references.
    public func bind(
        games: GamesStore?,
        agents: AgentsStore?,
        trends: OutliersTrendsStore?,
        props: PropsStore? = nil
    ) {
        self.gamesRef = games
        self.agentsRef = agents
        self.trendsRef = trends
        self.propsRef = props
    }

    /// Fire the leaderboard fetch for cross-user agent matches. Idempotent
    /// while loading. Caller should invoke when search activates with a
    /// non-empty query that could match agents.
    public func loadPublicAgentsIfNeeded() async {
        guard !isLoadingPublicAgents, publicAgents.isEmpty else { return }
        isLoadingPublicAgents = true
        defer { isLoadingPublicAgents = false }
        do {
            // Pull a wide net (top 100 by overall net units). The user is
            // searching by name; we don't need a perfectly-sorted set, we
            // need enough rows that common-name matches surface.
            let rows = try await AgentPerformanceService.fetchLeaderboard(
                limit: 100,
                sport: nil,
                sortMode: .overall,
                excludeUnder10Picks: false,
                timeframe: .allTime,
                viewerUserId: nil
            )
            self.publicAgents = rows
        } catch {
            // Swallow — search just falls back to own-agent matches. Same
            // pattern as `AgentsStore.fetchUserAgents` defensive try/catch.
            self.publicAgents = []
        }
    }

    public func clearPublicAgentsCache() {
        publicAgents = []
    }

    // MARK: - Recent queries

    /// Apply a recent-search row tap. Sets `query` (which schedules debounce)
    /// and immediately flushes so the result list updates on the next frame.
    public func applyRecent(_ value: String) {
        query = value
        flushDebounce()
    }

    public func clearRecentQueries() {
        recentQueries = []
        UserDefaults.standard.removeObject(forKey: recentQueriesKey)
    }

    private func loadRecentQueries() {
        let stored = UserDefaults.standard.stringArray(forKey: recentQueriesKey) ?? []
        recentQueries = Array(stored.prefix(recentQueriesLimit))
    }

    /// Commit the current debounced query into the recent list. Called by the
    /// view when the user taps a result (signaling intent — we only record
    /// queries that produced an action, not every keystroke pause).
    public func commitCurrentQueryToRecents() {
        let trimmed = debouncedQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        // De-dupe case-insensitively but preserve the user's original casing
        // in the persisted value (matches Safari's recent-searches behavior).
        var next = recentQueries.filter { $0.caseInsensitiveCompare(trimmed) != .orderedSame }
        next.insert(trimmed, at: 0)
        recentQueries = Array(next.prefix(recentQueriesLimit))
        UserDefaults.standard.set(recentQueries, forKey: recentQueriesKey)
    }

    // MARK: - Debounce

    private func scheduleDebounce() {
        debounceTask?.cancel()
        isDebouncing = true
        debounceTask = Task { [weak self] in
            // 200ms quiet window. Per-keystroke calls cancel the previous
            // task so only the trailing edge fires. The `Task.sleep` throws
            // on cancellation — we silently exit.
            do {
                try await Task.sleep(nanoseconds: 200_000_000)
            } catch {
                return
            }
            guard let self else { return }
            self.debouncedQuery = self.query
            self.isDebouncing = false
        }
    }

    /// Immediately publish the current `query` as `debouncedQuery`. Used by
    /// recent-search taps where the user has committed intent and we don't
    /// want the 200ms delay.
    public func flushDebounce() {
        debounceTask?.cancel()
        debouncedQuery = query
        isDebouncing = false
    }

    // MARK: - Result accessors
    //
    // All computed; SwiftUI observation re-runs them whenever any upstream
    // store mutates or `debouncedQuery` changes. The empty-query case returns
    // `[]` so the view can show its suggestions surface instead.

    /// Total result count across all scopes. Drives the empty-state branch.
    public var totalResultCount: Int {
        gameResults.count + playerResults.count + agentResults.count
            + trendResults.count
    }

    public var gameResults: [SearchResult.Game] {
        let q = normalizedQuery
        guard !q.isEmpty, let games = gamesRef else { return [] }
        var out: [SearchResult.Game] = []

        // SearchTeamAliases owns the rank table (exact abbr 100 → mascot/city
        // 90 → prefix 70 → substring 40 → initials 30). The generic fallback
        // covers everything the old substring+initials predicate matched, so
        // there's no result regression — just ordering by score.
        func matchSides(
            awayName: String, homeName: String,
            awayAbbr: String?, homeAbbr: String?,
            sport: SearchStoreSport
        ) -> (score: Int, matchedAbbr: String?)? {
            let away = SearchTeamAliases.match(query: q, teamName: awayName, abbr: awayAbbr, sport: sport)
            let home = SearchTeamAliases.match(query: q, teamName: homeName, abbr: homeAbbr, sport: sport)
            switch (away, home) {
            case (nil, nil): return nil
            case (let a?, nil): return (a.score, awayAbbr)
            case (nil, let h?): return (h.score, homeAbbr)
            case (let a?, let h?):
                return a.score >= h.score ? (a.score, awayAbbr) : (h.score, homeAbbr)
            }
        }

        for g in games.games.nfl {
            if let m = matchSides(awayName: g.awayTeam, homeName: g.homeTeam,
                                  awayAbbr: nil, homeAbbr: nil, sport: .nfl) {
                out.append(.init(
                    id: "nfl-\(g.id)", sport: .nfl,
                    awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                    gameTime: g.gameTime.isEmpty ? g.gameDate : g.gameTime,
                    resolvedId: g.uniqueId, matchScore: m.score, matchedAbbr: m.matchedAbbr
                ))
            }
        }
        for g in games.games.cfb {
            if let m = matchSides(awayName: g.awayTeam, homeName: g.homeTeam,
                                  awayAbbr: nil, homeAbbr: nil, sport: .cfb) {
                out.append(.init(
                    id: "cfb-\(g.id)", sport: .cfb,
                    awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                    gameTime: g.gameTime.isEmpty ? g.gameDate : g.gameTime,
                    resolvedId: g.uniqueId, matchScore: m.score, matchedAbbr: m.matchedAbbr
                ))
            }
        }
        for g in games.games.nba {
            if let m = matchSides(awayName: g.awayTeam, homeName: g.homeTeam,
                                  awayAbbr: g.awayAbbr, homeAbbr: g.homeAbbr, sport: .nba) {
                out.append(.init(
                    id: "nba-\(g.id)", sport: .nba,
                    awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                    gameTime: g.gameTime.isEmpty ? g.gameDate : g.gameTime,
                    resolvedId: g.id, matchScore: m.score, matchedAbbr: m.matchedAbbr
                ))
            }
        }
        for g in games.games.ncaab {
            if let m = matchSides(awayName: g.awayTeam, homeName: g.homeTeam,
                                  awayAbbr: g.awayTeamAbbrev, homeAbbr: g.homeTeamAbbrev, sport: .ncaab) {
                out.append(.init(
                    id: "ncaab-\(g.id)", sport: .ncaab,
                    awayTeam: g.awayTeam, homeTeam: g.homeTeam,
                    gameTime: g.gameTime.isEmpty ? g.gameDate : g.gameTime,
                    resolvedId: g.id, matchScore: m.score, matchedAbbr: m.matchedAbbr
                ))
            }
        }
        for g in games.games.mlb {
            let away = g.awayTeamName ?? g.awayTeam ?? ""
            let home = g.homeTeamName ?? g.homeTeam ?? ""
            if let m = matchSides(awayName: away, homeName: home,
                                  awayAbbr: g.awayAbbr, homeAbbr: g.homeAbbr, sport: .mlb) {
                out.append(.init(
                    id: "mlb-\(g.id)", sport: .mlb,
                    awayTeam: away, homeTeam: home,
                    gameTime: g.gameTimeEt ?? g.officialDate,
                    resolvedId: g.id, matchScore: m.score, matchedAbbr: m.matchedAbbr
                ))
            }
        }
        // Score desc; explicit insertion-order tiebreak (per-sport, roughly
        // time-ascending) — Swift's sorted(by:) does not guarantee stability.
        return out.enumerated()
            .sorted { lhs, rhs in
                if lhs.element.matchScore != rhs.element.matchScore {
                    return lhs.element.matchScore > rhs.element.matchScore
                }
                return lhs.offset < rhs.offset
            }
            .map(\.element)
    }

    // MARK: - Player results (MLB + NFL props slates)

    private struct MLBPlayerIndexEntry {
        let gamePk: Int
        let playerId: Int
        let name: String
        let teamAbbr: String
        let isPitcher: Bool
        let headlineRank: Double
    }

    private struct NFLPlayerIndexEntry {
        let playerKey: String
        let gameId: String
        let name: String
        let teamAbbr: String
        let headlineRank: Double
    }

    // Cached name indexes — rebuilding per keystroke would re-run headline
    // math for every player on the slate.
    @ObservationIgnored private var mlbPlayerIndex: [MLBPlayerIndexEntry] = []
    @ObservationIgnored private var mlbPlayerIndexKey: Set<Int> = []
    @ObservationIgnored private var nflPlayerIndex: [NFLPlayerIndexEntry] = []
    @ObservationIgnored private var nflPlayerIndexKey: Set<String> = []

    /// Player-prop matches (min query 3 chars, cap 8). Rank: 100 last-name
    /// prefix · 90 "initial + last name" · 70 first-name prefix · 50 full-name
    /// substring; ties by headline L10 rank desc. MLB + NFL interleaved.
    public var playerResults: [SearchResult.Player] {
        let q = normalizedQuery
        guard q.count >= 3, let props = propsRef else { return [] }

        var scored: [(entry: SearchResult.Player, score: Int)] = []

        if !props.matchups.isEmpty {
            rebuildMLBPlayerIndexIfNeeded(props.matchups)
            for entry in mlbPlayerIndex {
                guard let score = playerScore(query: q, name: entry.name) else { continue }
                scored.append((
                    SearchResult.Player(
                        id: "player-mlb-\(entry.gamePk)-\(entry.playerId)",
                        kind: .mlb(
                            gamePk: entry.gamePk,
                            playerId: entry.playerId,
                            isPitcher: entry.isPitcher
                        ),
                        playerName: entry.name,
                        teamAbbr: entry.teamAbbr,
                        matchScore: score,
                        headlineRank: entry.headlineRank
                    ),
                    score
                ))
            }
        }

        if !props.nflPlayers.isEmpty {
            rebuildNFLPlayerIndexIfNeeded(props.nflPlayers)
            for entry in nflPlayerIndex {
                guard let score = playerScore(query: q, name: entry.name) else { continue }
                scored.append((
                    SearchResult.Player(
                        id: "player-nfl-\(entry.playerKey)",
                        kind: .nfl(playerKey: entry.playerKey, gameId: entry.gameId),
                        playerName: entry.name,
                        teamAbbr: entry.teamAbbr,
                        matchScore: score,
                        headlineRank: entry.headlineRank
                    ),
                    score
                ))
            }
        }

        return scored
            .sorted {
                if $0.score != $1.score { return $0.score > $1.score }
                return $0.entry.headlineRank > $1.entry.headlineRank
            }
            .prefix(8)
            .map(\.entry)
    }

    private func rebuildMLBPlayerIndexIfNeeded(_ matchups: [MLBPropMatchup]) {
        let key = Set(matchups.map(\.gamePk))
        guard key != mlbPlayerIndexKey else { return }
        var entries: [MLBPlayerIndexEntry] = []
        for m in matchups {
            func headlineRank(_ rows: [MLBPlayerPropRow]) -> Double {
                Double(MLBPlayerProps.pickHeadlineProp(rows)?.computed.l10.pct ?? 0)
            }
            for (starter, abbr) in [(m.awayStarter, m.awayAbbr), (m.homeStarter, m.homeAbbr)] {
                let rows = m.pitcherProps(for: starter.pitcherId)
                guard !rows.isEmpty else { continue }
                entries.append(MLBPlayerIndexEntry(
                    gamePk: m.gamePk, playerId: starter.pitcherId, name: starter.name,
                    teamAbbr: abbr, isPitcher: true, headlineRank: headlineRank(rows)
                ))
            }
            for (lineup, abbr) in [(m.awayLineup, m.awayAbbr), (m.homeLineup, m.homeAbbr)] {
                for row in lineup {
                    let rows = m.batterProps(for: row.playerId)
                    guard !rows.isEmpty else { continue }
                    entries.append(MLBPlayerIndexEntry(
                        gamePk: m.gamePk, playerId: row.playerId, name: row.playerName,
                        teamAbbr: abbr, isPitcher: false, headlineRank: headlineRank(rows)
                    ))
                }
            }
            for group in m.extraBatterGroups {
                entries.append(MLBPlayerIndexEntry(
                    gamePk: m.gamePk, playerId: group.playerId,
                    name: group.props.first?.playerName ?? "Player",
                    teamAbbr: "", isPitcher: false, headlineRank: headlineRank(group.props)
                ))
            }
        }
        mlbPlayerIndex = entries
        mlbPlayerIndexKey = key
    }

    private func rebuildNFLPlayerIndexIfNeeded(_ players: [NFLPropPlayer]) {
        let key = Set(players.map(\.id))
        guard key != nflPlayerIndexKey else { return }
        nflPlayerIndex = players.map { player in
            let abbr = NFLTeamAssets.abbr(for: player.team ?? "")
            return NFLPlayerIndexEntry(
                playerKey: player.id,
                gameId: player.gameId,
                name: player.playerName,
                teamAbbr: abbr.isEmpty ? (player.team ?? "") : abbr,
                headlineRank: player.headlineMarket?.l10HitRate ?? -1
            )
        }
        nflPlayerIndexKey = key
    }

    private func playerScore(query q: String, name: String) -> Int? {
        let lower = name.lowercased()
        let tokens = lower.split(separator: " ").map(String.init)
        guard let last = tokens.last else { return nil }
        if last.hasPrefix(q) { return 100 }
        // "a judge" → first-initial + last-name form.
        if let first = tokens.first, tokens.count >= 2 {
            let initialForm = "\(first.prefix(1)) \(last)"
            if initialForm.hasPrefix(q) || q == initialForm { return 90 }
        }
        if let first = tokens.first, first.hasPrefix(q) { return 70 }
        if lower.contains(q) { return 50 }
        return nil
    }

    public var agentResults: [SearchResult.Agent] {
        let q = normalizedQuery
        guard !q.isEmpty else { return [] }
        var out: [SearchResult.Agent] = []
        // Own agents first (private to the signed-in user) — full model, full card.
        if let agents = agentsRef {
            for a in agents.agents where a.agent.name.lowercased().contains(q) {
                out.append(.init(id: "own-\(a.agent.id)", model: a, isPublic: false))
            }
        }
        // Public agents — leaderboard cache, adapted to a card model. Exclude any
        // avatar id already surfaced from the own-agents pass so a user searching
        // their own public agent doesn't get a duplicate row.
        let seen = Set(out.map { $0.agentId })
        for entry in publicAgents where entry.name.lowercased().contains(q) && !seen.contains(entry.avatarId) {
            out.append(.init(
                id: "public-\(entry.avatarId)",
                model: AgentWithPerformance(leaderboard: entry),
                isPublic: true
            ))
        }
        return out
    }

    /// Outliers trend-card matches over the loaded slate (min query 2 chars, cap 12).
    /// Ranks subject-name prefix highest, then team abbr, then matchup / bet-type hits.
    public var trendResults: [SearchResult.Trend] {
        let q = normalizedQuery
        guard q.count >= 2, let trends = trendsRef else { return [] }
        var scored: [(result: SearchResult.Trend, score: Int)] = []
        for entry in trends.searchIndex {
            guard let score = trendMatchScore(entry.card, q: q) else { continue }
            scored.append((
                SearchResult.Trend(
                    id: "trend-\(entry.id)",
                    card: entry.card,
                    sport: entry.sport,
                    game: entry.game,
                    matchScore: score
                ),
                score
            ))
        }
        return scored
            .sorted {
                if $0.score != $1.score { return $0.score > $1.score }
                return $0.result.card.trendValue > $1.result.card.trendValue
            }
            .prefix(12)
            .map(\.result)
    }

    /// Match a trend card: subject name (player/coach/team/ref) > team abbr >
    /// matchup (so searching one team surfaces its whole game) > bet type.
    private func trendMatchScore(_ card: OutliersTrendsCard, q: String) -> Int? {
        let subject = card.subjectName.lowercased()
        if subject.hasPrefix(q) { return 100 }
        if let abbr = card.teamAbbr?.lowercased(), !abbr.isEmpty, abbr == q { return 95 }
        if subject.contains(q) { return 85 }
        if card.matchupLabel.lowercased().contains(q) { return 70 }
        if card.betTypeLabel.lowercased().contains(q) { return 50 }
        return nil
    }

    // MARK: - Matching helpers

    private var normalizedQuery: String {
        debouncedQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - Debug helpers

    #if DEBUG
    public func debugSetRecent(_ values: [String]) {
        recentQueries = Array(values.prefix(recentQueriesLimit))
    }

    public func debugSetPublicAgents(_ entries: [AgentLeaderboardEntry]) {
        publicAgents = entries
    }
    #endif
}
