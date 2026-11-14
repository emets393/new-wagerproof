import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// `GamesStore` mirrors the RN `(tabs)/index.tsx` data layer end-to-end.
///
/// It owns five per-sport caches (`nfl`, `cfb`, `nba`, `ncaab`, `mlb`),
/// each with its own games array + `lastFetch` timestamp. Cache TTL is
/// 5 minutes (matches RN: `Date.now() - cached.lastFetch < 5 * 60 * 1000`).
///
/// `refresh(sport:force:)` runs the matching per-sport query against the
/// CFB Supabase project. NFL is the most complex: a 4-way merge of
/// `v_input_values_with_epa` + `nfl_predictions_epa` + `nfl_betting_lines`
/// + `production_weather`. CFB reads the slate tables (`cfb_slate_feed`
/// + `cfb_slate_flags`). NCAAB ported in B11 — a 3-way merge of
/// `v_cbb_input_values` + `ncaab_predictions` + `ncaab_team_mapping`.
/// NBA / MLB still placeholder pending B10/B12.
///
/// All queries are byte-identical to RN — see
/// `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx:171-892` for the source.
@Observable
@MainActor
public final class GamesStore {
    public enum Sport: String, Hashable, CaseIterable, Sendable, Identifiable {
        case mlb, nba, ncaab, nfl, cfb
        public var id: String { rawValue }
        public var label: String {
            switch self {
            case .nfl: return "NFL"
            case .cfb: return "CFB"
            case .nba: return "NBA"
            case .ncaab: return "NCAAB"
            case .mlb: return "MLB"
            }
        }

        /// Picker display order, seasonal: football-first from Sept 1 through
        /// Feb 15 (kickoff → Super Bowl), MLB-first the rest of the year.
        /// Uses ET to match the rest of the app's sports-date logic.
        public static func displayOrder(on date: Date = Date()) -> [Sport] {
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "America/New_York") ?? .current
            let month = cal.component(.month, from: date)
            let day = cal.component(.day, from: date)
            let footballSeason = month >= 9 || month == 1 || (month == 2 && day <= 15)
            return footballSeason
                ? [.nfl, .cfb, .mlb, .nba, .ncaab]
                : [.mlb, .nfl, .cfb, .nba, .ncaab]
        }
    }

    public enum SortMode: String, Hashable, Sendable {
        case time, spread, ou, ml, signals
    }

    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case refreshing
        case failed(String)
    }

    /// Per-sport cached games + load metadata. Mirrors RN
    /// `cachedData: {nfl: {games, lastFetch}, ...}`.
    public struct SportFeed: Sendable {
        public var nfl: [NFLPrediction] = []
        public var cfb: [CFBPrediction] = []
        public var nba: [NBAGame] = []
        public var ncaab: [NCAABGame] = []
        public var mlb: [MLBGame] = []
        public init() {}
    }

    // MARK: - Observable state

    public private(set) var games = SportFeed()
    public private(set) var nbaSignalsByGame: [Int: [NBASlateSignal]] = [:]
    public private(set) var nbaSignalsByAbbr: [String: [NBASlateSignal]] = [:]
    /// Distinct `ncaab_slate_flags.signal_key` values per CBBD game id. The feed badge.
    public private(set) var ncaabSignalCountByGame: [Int: Int] = [:]
    public private(set) var nbaFirstHalfByGame: [Int: [NBAFirstHalfMarket]] = [:]
    public private(set) var nbaFirstHalfByAbbr: [String: [NBAFirstHalfMarket]] = [:]

    public func ncaabSignalCount(gameId: Int) -> Int {
        ncaabSignalCountByGame[gameId] ?? 0
    }

    public func nbaSignals(gameId: Int, date: String, home: String, away: String) -> [NBASlateSignal] {
        if let rows = nbaSignalsByGame[gameId], !rows.isEmpty { return rows }
        return nbaSignalsByAbbr["\(date.prefix(10))|\(home)|\(away)"] ?? []
    }

    public func nbaFirstHalf(gameId: Int, date: String, home: String, away: String) -> [NBAFirstHalfMarket] {
        if let rows = nbaFirstHalfByGame[gameId], !rows.isEmpty { return rows }
        return nbaFirstHalfByAbbr["\(date.prefix(10))|\(home)|\(away)"] ?? []
    }
    public private(set) var loadState: [Sport: LoadState] = Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, .idle) })
    public private(set) var lastFetched: [Sport: Date] = [:]

    /// Currently-selected sport. Defaults to the first sport in the seasonal
    /// picker order (NFL during the football window, MLB otherwise).
    public var selectedSport: Sport = Sport.displayOrder().first ?? .mlb
    /// Per-sport sort mode. Mirrors RN `sortModes` record.
    public var sortModes: [Sport: SortMode] = Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, .time) })
    /// Best signal ROI (percentage points) and signal count, keyed by game id.
    /// Filled when each sport's slate loads. Empty means that sport has nothing to rank.
    public private(set) var signalRanks: [Sport: [String: SignalBoardRank]] =
        Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, [:]) })
    /// Per-sport search text. Mirrors RN `searchTexts` record.
    public var searchTexts: [Sport: String] = Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, "") })

    /// When true, NFL/CFB load from slate staging tables. Set by the tab
    /// shell from `AdminModeStore.slatePreviewEnabled`.
    public var slatePreviewEnabled: Bool = false

    private let cacheTTL: TimeInterval = 5 * 60
    /// MainTabView owns the canonical eager hydrate. This still protects
    /// against another lifecycle or a fast pull-to-refresh joining the same
    /// sport request before its TTL timestamp has been written.
    @ObservationIgnored private let refreshTasks = InFlightTaskRegistry<Sport>()
    private struct SortedCacheKey: Equatable {
        let version: Int
        let query: String
        let mode: SortMode
    }
    @ObservationIgnored private var feedVersions: [Sport: Int] =
        Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, 0) })
    @ObservationIgnored private var nflSortedCache: (key: SortedCacheKey, value: [NFLPrediction])?
    @ObservationIgnored private var cfbSortedCache: (key: SortedCacheKey, value: [CFBPrediction])?
    @ObservationIgnored private var nbaSortedCache: (key: SortedCacheKey, value: [NBAGame])?
    @ObservationIgnored private var ncaabSortedCache: (key: SortedCacheKey, value: [NCAABGame])?
    @ObservationIgnored private var mlbSortedCache: (key: SortedCacheKey, value: [MLBGame])?

    public init() {}

    public func nflGames() -> [NFLPrediction] { games.nfl }
    public func cfbGames() -> [CFBPrediction] { games.cfb }
    public func mlbGames() -> [MLBGame] { games.mlb }

    /// Stable revision for app-layer date-section caches. It changes only when
    /// the corresponding raw sport feed is replaced.
    public func presentationRevision(for sport: Sport) -> Int {
        feedVersions[sport, default: 0]
    }

    public func isLoading(sport: Sport) -> Bool {
        if case .loading = loadState[sport] ?? .idle { return true }
        return false
    }

    public func errorMessage(sport: Sport) -> String? {
        if case .failed(let m) = loadState[sport] ?? .idle { return m }
        return nil
    }

    // MARK: - Refresh entry points

    /// Refresh a single sport. Honors the 5-minute cache TTL unless `force`
    /// is true (pull-to-refresh path). Errors are surfaced via `loadState`.
    public func refresh(sport: Sport, force: Bool = false) async {
        #if DEBUG
        // Dummy Data Mode: serve a captured real slate so the offseason-empty
        // Games tab populates for UI development. Checked before the TTL guard
        // so toggling takes effect on the next tab appear / pull-to-refresh.
        // MLB is in-season (live data works) and NFL serves the slate
        // contract slate year-round (see fetchNFLSlate) — both stay on the
        // real path.
        if DummyDataMode.isEnabled, sport != .mlb, sport != .nfl {
            loadDummy(sport: sport)
            return
        }
        #endif
        // Mirror RN: skip if cached + within TTL + not forced.
        if !force,
           let last = lastFetched[sport],
           Date().timeIntervalSince(last) < cacheTTL {
            return
        }

        await refreshTasks.run(key: sport) { [weak self] in
            await self?.performRefresh(sport: sport)
        }
    }

    /// The single mutation path behind a coalesced sport request.
    private func performRefresh(sport: Sport) async {
        loadState[sport] = .loading
        defer { markFeedChanged(sport) }
        do {
            switch sport {
            case .nfl: try await fetchNFL()
            case .cfb: try await fetchCFB()
            case .nba: try await fetchNBA()
            case .ncaab: try await fetchNCAAB()
            case .mlb: try await fetchMLB()
            }
            loadState[sport] = .loaded
            lastFetched[sport] = Date()
        } catch {
            loadState[sport] = .failed("Failed to fetch \(sport.label) games")
        }
    }

    /// Refresh every available sport in parallel. Mirrors RN's mount-time
    /// `sports.forEach(fetchDataForSport)` loop.
    public func refreshAll(force: Bool = false) async {
        await withTaskGroup(of: Void.self) { group in
            for sport in Sport.allCases {
                group.addTask { @MainActor in
                    await self.refresh(sport: sport, force: force)
                }
            }
            await group.waitForAll()
        }
    }

    // MARK: - Filtered + sorted accessors

    /// Filtered + sorted NFL list for the active sport view.
    public func sortedNFL() -> [NFLPrediction] {
        let q = normalizedSearchText(for: .nfl)
        let mode = sortModes[.nfl] ?? .time
        let key = SortedCacheKey(
            version: feedVersions[.nfl, default: 0],
            query: q,
            mode: mode
        )
        if let cached = nflSortedCache, cached.key == key { return cached.value }
        let filtered = q.isEmpty ? games.nfl : games.nfl.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        let result = sortNFL(filtered, mode: mode)
        nflSortedCache = (key, result)
        return result
    }

    public func sortedCFB() -> [CFBPrediction] {
        let q = normalizedSearchText(for: .cfb)
        let mode = sortModes[.cfb] ?? .time
        let key = SortedCacheKey(
            version: feedVersions[.cfb, default: 0],
            query: q,
            mode: mode
        )
        if let cached = cfbSortedCache, cached.key == key { return cached.value }
        let filtered = q.isEmpty ? games.cfb : games.cfb.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        let result = sortCFB(filtered, mode: mode)
        cfbSortedCache = (key, result)
        return result
    }

    /// Filtered + sorted NBA list. Mirrors RN search/sort behavior:
    /// confidence-based ordering for `.spread` / `.ou` and tipoff time for
    /// `.time`.
    public func sortedNBA() -> [NBAGame] {
        let q = normalizedSearchText(for: .nba)
        let mode = sortModes[.nba] ?? .time
        let key = SortedCacheKey(
            version: feedVersions[.nba, default: 0],
            query: q,
            mode: mode
        )
        if let cached = nbaSortedCache, cached.key == key { return cached.value }
        let filtered = q.isEmpty ? games.nba : games.nba.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        let result = sortNBA(filtered, mode: mode)
        nbaSortedCache = (key, result)
        return result
    }

    private func sortNBA(_ list: [NBAGame], mode: SortMode) -> [NBAGame] {
        let ranks = signalRanks[.nba] ?? [:]
        if mode == .signals && !list.contains(where: { (ranks[String($0.gameId)]?.count ?? 0) > 0 }) {
            return sortNBA(list, mode: .time)
        }
        let anyRated = list.contains { ranks[String($0.gameId)]?.bestRoi != nil }
        return list.sorted { a, b in
            let tie = { self.tipoff(a.gameTime, a.gameDate, b.gameTime, b.gameDate) }
            switch mode {
            case .time:
                return tie()
            case .spread:
                return GameListSort.higherFirst(
                    GameListSort.gap(a.modelFairHomeSpread, a.homeSpread),
                    GameListSort.gap(b.modelFairHomeSpread, b.homeSpread),
                    tie: tie
                )
            case .ou:
                return GameListSort.higherFirst(
                    GameListSort.gap(a.modelFairTotal, a.overLine),
                    GameListSort.gap(b.modelFairTotal, b.overLine),
                    tie: tie
                )
            case .ml:
                return GameListSort.higherFirst(
                    GameListSort.moneylineValue(homeProb: a.homeAwayMlProb, homeMl: a.homeMl, awayMl: a.awayMl),
                    GameListSort.moneylineValue(homeProb: b.homeAwayMlProb, homeMl: b.homeMl, awayMl: b.awayMl),
                    tie: tie
                )
            case .signals:
                return GameListSort.signalsFirst(
                    ranks[String(a.gameId)] ?? .empty,
                    ranks[String(b.gameId)] ?? .empty,
                    anyRated: anyRated,
                    tie: tie
                )
            }
        }
    }

    /// Filtered + sorted NCAAB list. Mirrors NBA's behavior — NCAAB carries
    /// the same `home_away_spread_cover_prob` / `ou_result_prob` triplet
    /// from `ncaab_predictions`, so the same confidence-based ordering rules
    /// apply for `.spread` / `.ou`.
    public func sortedNCAAB() -> [NCAABGame] {
        let q = normalizedSearchText(for: .ncaab)
        let mode = sortModes[.ncaab] ?? .time
        let key = SortedCacheKey(
            version: feedVersions[.ncaab, default: 0],
            query: q,
            mode: mode
        )
        if let cached = ncaabSortedCache, cached.key == key { return cached.value }
        let filtered = q.isEmpty ? games.ncaab : games.ncaab.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        let result = sortNCAAB(filtered, mode: mode)
        ncaabSortedCache = (key, result)
        return result
    }

    private func sortNCAAB(_ list: [NCAABGame], mode: SortMode) -> [NCAABGame] {
        let ranks = signalRanks[.ncaab] ?? [:]
        if mode == .signals && !list.contains(where: { (ranks[String($0.gameId)]?.count ?? 0) > 0 }) {
            return sortNCAAB(list, mode: .time)
        }
        let anyRated = list.contains { ranks[String($0.gameId)]?.bestRoi != nil }
        return list.sorted { a, b in
            let tie = { self.tipoff(a.gameTime, a.gameDate, b.gameTime, b.gameDate) }
            switch mode {
            case .time:
                return tie()
            case .spread:
                return GameListSort.higherFirst(self.ncaabSpread(a), self.ncaabSpread(b), tie: tie)
            case .ou:
                return GameListSort.higherFirst(
                    GameListSort.gap(a.predTotalPoints, a.overLine),
                    GameListSort.gap(b.predTotalPoints, b.overLine),
                    tie: tie
                )
            case .ml:
                return GameListSort.higherFirst(
                    GameListSort.moneylineValue(homeProb: a.homeAwayMlProb, homeMl: a.homeMl, awayMl: a.awayMl),
                    GameListSort.moneylineValue(homeProb: b.homeAwayMlProb, homeMl: b.homeMl, awayMl: b.awayMl),
                    tie: tie
                )
            case .signals:
                return GameListSort.signalsFirst(
                    ranks[String(a.gameId)] ?? .empty,
                    ranks[String(b.gameId)] ?? .empty,
                    anyRated: anyRated,
                    tie: tie
                )
            }
        }
    }

    /// Fair home spread versus the posted home spread. The fair number is the
    /// originator's spread, or the negated predicted margin when that is all we have.
    private func ncaabSpread(_ game: NCAABGame) -> Double? {
        let model = game.modelFairHomeSpread ?? game.predHomeMargin.map { -$0 }
        return GameListSort.gap(model, game.homeSpread)
    }

    public func sortedMLB() -> [MLBGame] {
        let q = normalizedSearchText(for: .mlb)
        let mode = sortModes[.mlb] ?? .time
        let key = SortedCacheKey(
            version: feedVersions[.mlb, default: 0],
            query: q,
            mode: mode
        )
        if let cached = mlbSortedCache, cached.key == key { return cached.value }
        let filtered = q.isEmpty ? games.mlb : games.mlb.filter { game in
            (game.homeTeamName ?? "").lowercased().contains(q) ||
                (game.awayTeamName ?? "").lowercased().contains(q) ||
                game.homeAbbr.lowercased().contains(q) ||
                game.awayAbbr.lowercased().contains(q)
        }
        let result = sortMLB(filtered, mode: mode)
        mlbSortedCache = (key, result)
        return result
    }

    private func normalizedSearchText(for sport: Sport) -> String {
        (searchTexts[sport] ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    /// Sort MLB games. `time` sorts by `game_time_et` ascending (RN
    /// default); `spread` falls back to ML edge magnitude; `ou` uses the
    /// fair-vs-line delta.
    private func sortMLB(_ list: [MLBGame], mode: SortMode) -> [MLBGame] {
        let ranks = signalRanks[.mlb] ?? [:]
        if mode == .signals && !list.contains(where: { (ranks[$0.id]?.count ?? 0) > 0 }) {
            return sortMLB(list, mode: .time)
        }
        let anyRated = list.contains { ranks[$0.id]?.bestRoi != nil }
        return list.sorted { a, b in
            let tie = {
                (Self.parseEpoch(a.gameTimeEt ?? a.officialDate) ?? .greatestFiniteMagnitude) <
                    (Self.parseEpoch(b.gameTimeEt ?? b.officialDate) ?? .greatestFiniteMagnitude)
            }
            switch mode {
            case .time:
                return tie()
            case .spread, .ml:
                // Baseball has no spread model. The spread menu item is hidden;
                // a leftover `.spread` selection uses the moneyline edge.
                return GameListSort.higherFirst(self.mlbMoneyline(a), self.mlbMoneyline(b), tie: tie)
            case .ou:
                return GameListSort.higherFirst(
                    GameListSort.magnitude(a.ouEdge) ?? GameListSort.gap(a.ouFairTotal, a.totalLine),
                    GameListSort.magnitude(b.ouEdge) ?? GameListSort.gap(b.ouFairTotal, b.totalLine),
                    tie: tie
                )
            case .signals:
                return GameListSort.signalsFirst(
                    ranks[a.id] ?? .empty,
                    ranks[b.id] ?? .empty,
                    anyRated: anyRated,
                    tie: tie
                )
            }
        }
    }

    /// The larger of the two published ML edges, matching the pill. Falls back
    /// to model-versus-price when the edge columns are empty.
    private func mlbMoneyline(_ game: MLBGame) -> Double? {
        if let home = game.homeMlEdgePct, let away = game.awayMlEdgePct {
            return abs(max(home, away))
        }
        if let home = game.homeMlEdgePct { return abs(home) }
        if let away = game.awayMlEdgePct { return abs(away) }
        return GameListSort.moneylineValue(homeProb: game.mlHomeWinProb, homeMl: game.homeMl, awayMl: game.awayMl)
    }

    private func sortNFL(_ list: [NFLPrediction], mode: SortMode) -> [NFLPrediction] {
        let ranks = signalRanks[.nfl] ?? [:]
        if mode == .signals && !list.contains(where: { (ranks[$0.gameId]?.count ?? 0) > 0 }) {
            return sortNFL(list, mode: .time)
        }
        let anyRated = list.contains { ranks[$0.gameId]?.bestRoi != nil }
        return list.sorted { a, b in
            let tie = { self.kickoff(a.gameDate, b.gameDate) }
            switch mode {
            case .time:
                return tie()
            case .spread:
                return GameListSort.higherFirst(
                    GameListSort.magnitude(a.fgSpreadEdge),
                    GameListSort.magnitude(b.fgSpreadEdge),
                    tie: tie
                )
            case .ou:
                return GameListSort.higherFirst(self.nflTotal(a), self.nflTotal(b), tie: tie)
            case .ml:
                return GameListSort.higherFirst(
                    GameListSort.moneylineValue(homeProb: a.homeAwayMlProb, homeMl: a.homeMl, awayMl: a.awayMl),
                    GameListSort.moneylineValue(homeProb: b.homeAwayMlProb, homeMl: b.homeMl, awayMl: b.awayMl),
                    tie: tie
                )
            case .signals:
                return GameListSort.signalsFirst(
                    ranks[a.gameId] ?? .empty,
                    ranks[b.gameId] ?? .empty,
                    anyRated: anyRated,
                    tie: tie
                )
            }
        }
    }

    private func nflTotal(_ game: NFLPrediction) -> Double? {
        GameListSort.magnitude(game.fgTotalEdge) ?? GameListSort.gap(game.predTotal, game.overLine)
    }

    private func sortCFB(_ list: [CFBPrediction], mode: SortMode) -> [CFBPrediction] {
        let ranks = signalRanks[.cfb] ?? [:]
        if mode == .signals && !list.contains(where: { (ranks[$0.gameId]?.count ?? 0) > 0 }) {
            return sortCFB(list, mode: .time)
        }
        let anyRated = list.contains { ranks[$0.gameId]?.bestRoi != nil }
        return list.sorted { a, b in
            let tie = { self.kickoff(a.kickoff ?? a.gameTime, b.kickoff ?? b.gameTime) }
            switch mode {
            case .time:
                return tie()
            case .spread:
                return GameListSort.higherFirst(
                    GameListSort.magnitude(a.fgSpreadEdge ?? a.homeSpreadDiff),
                    GameListSort.magnitude(b.fgSpreadEdge ?? b.homeSpreadDiff),
                    tie: tie
                )
            case .ou:
                return GameListSort.higherFirst(self.cfbTotal(a), self.cfbTotal(b), tie: tie)
            case .ml:
                return GameListSort.higherFirst(
                    GameListSort.moneylineValue(homeProb: a.homeAwayMlProb ?? a.fgHomeWinProb, homeMl: a.homeMl, awayMl: a.awayMl),
                    GameListSort.moneylineValue(homeProb: b.homeAwayMlProb ?? b.fgHomeWinProb, homeMl: b.homeMl, awayMl: b.awayMl),
                    tie: tie
                )
            case .signals:
                return GameListSort.signalsFirst(
                    ranks[a.gameId] ?? .empty,
                    ranks[b.gameId] ?? .empty,
                    anyRated: anyRated,
                    tie: tie
                )
            }
        }
    }

    private func cfbTotal(_ game: CFBPrediction) -> Double? {
        GameListSort.magnitude(game.fgTotalEdge)
            ?? GameListSort.gap(game.fgPredTotal ?? game.predTotal, game.overLine ?? game.fgTotalClose)
    }

    private func tipoff(_ timeA: String, _ dateA: String, _ timeB: String, _ dateB: String) -> Bool {
        if !timeA.isEmpty, !timeB.isEmpty { return timeA < timeB }
        return dateA < dateB
    }

    private func kickoff(_ a: String, _ b: String) -> Bool {
        (Self.parseEpoch(a) ?? .greatestFiniteMagnitude) < (Self.parseEpoch(b) ?? .greatestFiniteMagnitude)
    }

    private func storeRanks(_ sport: Sport, _ ranks: [String: SignalBoardRank]) {
        var next = signalRanks
        next[sport] = ranks
        signalRanks = next
    }

    private struct FootballFlagKeyRow: Decodable, Sendable {
        let gameId: String
        let signalKey: String?
        let source: String?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case signalKey = "signal_key"
            case source
        }
    }

    private struct SignalDefHitRow: Decodable, Sendable {
        let signalKey: String
        let typicalHit: String?
        enum CodingKeys: String, CodingKey {
            case signalKey = "signal_key"
            case typicalHit = "typical_hit"
        }
    }

    private struct NCAABSignalTextRow: Decodable, Sendable {
        let signalKey: String
        let recordText: String?
        let seasonRecordText: String?
        enum CodingKeys: String, CodingKey {
            case signalKey = "signal_key"
            case recordText = "record_text"
            case seasonRecordText = "season_record_text"
        }
    }

    /// Season ROI from `signal_performance` when a signal has graded bets,
    /// otherwise the ROI written into the backtest blurb.
    private func nflSignalRanks(_ client: SupabaseClient, games: [NFLPrediction]) async -> [String: SignalBoardRank] {
        guard let season = games.compactMap(\.season).first else { return [:] }
        let week = games.compactMap(\.week).first
        async let performances = SignalPerformanceService.shared.performances(for: .nfl, season: season)
        async let defs: [SignalDefHitRow] = (try? await client
            .from("nfl_signal_defs")
            .select("signal_key,typical_hit")
            .execute()
            .value) ?? []
        let flags: [FootballFlagKeyRow]
        if let week {
            flags = (try? await client
                .from("nfl_slate_flags")
                .select("game_id,signal_key,source")
                .eq("season", value: season)
                .eq("week", value: week)
                .execute()
                .value) ?? []
        } else {
            flags = []
        }
        let perf = await performances
        var hitByKey: [String: String] = [:]
        for def in await defs {
            if let hit = def.typicalHit { hitByKey[def.signalKey] = hit }
        }
        let grouped = Dictionary(grouping: flags, by: \.gameId)
        var ranks: [String: SignalBoardRank] = [:]
        for game in games {
            let rows = grouped[game.gameId] ?? []
            let keys = FootballBlanketSignals.displayKeys(
                sport: "nfl",
                keys: rows.compactMap { $0.signalKey ?? $0.source }
            )
            let ratings: [Double?] = keys.map { key in
                let row = perf[key]
                return GameListSort.rating(
                    seasonRoiFraction: row?.roi,
                    seasonSample: row?.n ?? 0,
                    seasonText: nil,
                    backtestText: hitByKey[key]
                )
            }
            ranks[game.gameId] = GameListSort.boardRank(count: keys.count, ratings: ratings)
        }
        return ranks
    }

    private func cfbSignalRanks(_ games: [CFBPrediction], _ performances: [String: SignalPerformance]) -> [String: SignalBoardRank] {
        var ranks: [String: SignalBoardRank] = [:]
        for game in games {
            let flags = game.activeFlags
            let keys = FootballBlanketSignals.displayKeys(sport: "cfb", keys: flags.map(\.source))
            let ratings: [Double?] = keys.map { key in
                let flag = flags.first { $0.source == key }
                let perfKey = flag?.signalDefinition?.signalKey ?? key
                let row = performances[perfKey] ?? performances[key]
                return GameListSort.rating(
                    seasonRoiFraction: row?.roi,
                    seasonSample: row?.n ?? 0,
                    seasonText: nil,
                    backtestText: flag?.signalDefinition?.typicalHit
                )
            }
            ranks[game.gameId] = GameListSort.boardRank(count: keys.count, ratings: ratings)
        }
        return ranks
    }

    private func nbaSignalRanks(_ byGame: [Int: [NBASlateSignal]]) -> [String: SignalBoardRank] {
        var ranks: [String: SignalBoardRank] = [:]
        for (gameId, signals) in byGame {
            var seen = Set<String>()
            var ratings: [Double?] = []
            for signal in signals where seen.insert(signal.id).inserted {
                ratings.append(GameListSort.rating(
                    seasonRoiFraction: nil,
                    seasonSample: 0,
                    seasonText: signal.seasonRecordText,
                    backtestText: signal.recordText
                ))
            }
            ranks[String(gameId)] = GameListSort.boardRank(count: seen.count, ratings: ratings)
        }
        return ranks
    }

    private func ncaabSignalRanks(_ client: SupabaseClient, keysByGame: [Int: Set<String>]) async -> [String: SignalBoardRank] {
        let defs: [NCAABSignalTextRow] = (try? await client
            .from("ncaab_signal_defs")
            .select("signal_key,record_text,season_record_text")
            .execute()
            .value) ?? []
        var textByKey: [String: NCAABSignalTextRow] = [:]
        for def in defs { textByKey[def.signalKey] = def }
        var ranks: [String: SignalBoardRank] = [:]
        for (gameId, keys) in keysByGame {
            let ratings: [Double?] = keys.map { key in
                let def = textByKey[key]
                return GameListSort.rating(
                    seasonRoiFraction: nil,
                    seasonSample: 0,
                    seasonText: def?.seasonRecordText,
                    backtestText: def?.recordText
                )
            }
            ranks[String(gameId)] = GameListSort.boardRank(count: keys.count, ratings: ratings)
        }
        return ranks
    }

    private static func parseEpoch(_ raw: String) -> Double? {
        if raw.isEmpty { return nil }
        if let d = isoWithFractionalSeconds.date(from: raw) { return d.timeIntervalSince1970 }
        if let d = isoInternetDateTime.date(from: raw) { return d.timeIntervalSince1970 }
        for formatter in utcDateFormatters {
            if let d = formatter.date(from: raw) { return d.timeIntervalSince1970 }
        }
        return nil
    }

    private static let isoWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoInternetDateTime: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let utcDateFormatters: [DateFormatter] = [
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd",
    ].map { format in
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = format
        return formatter
    }

    private func markFeedChanged(_ sport: Sport) {
        feedVersions[sport, default: 0] &+= 1
        switch sport {
        case .nfl: nflSortedCache = nil
        case .cfb: cfbSortedCache = nil
        case .nba: nbaSortedCache = nil
        case .ncaab: ncaabSortedCache = nil
        case .mlb: mlbSortedCache = nil
        }
    }

    // MARK: - NFL fetch
    //
    // Byte-identical to RN `fetchNFLData()` in index.tsx:172-326. Five steps:
    //   1. Read all rows from v_input_values_with_epa.
    //   2. Read predictions, keep only rows with the latest run_id.
    //   3. Read betting lines, keep most-recent as_of_ts per training_key.
    //   4. Read production_weather, key by training_key.
    //   5. Merge — match on game.home_away_unique == prediction.training_key.

    private struct NFLViewRow: Decodable, Sendable {
        let id: String?
        let awayTeam: String?
        let homeTeam: String?
        let homeAwayUnique: String?
        let uniqueId: String?
        let homeSpread: Double?
        let overUnder: Double?
        let gameDate: String?
        let gameTime: String?

        enum CodingKeys: String, CodingKey {
            case id
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case homeAwayUnique = "home_away_unique"
            case uniqueId = "unique_id"
            case homeSpread = "home_spread"
            case overUnder = "over_under"
            case gameDate = "game_date"
            case gameTime = "game_time"
        }
    }

    private struct NFLPredictionRow: Decodable, Sendable {
        let trainingKey: String
        let homeAwayMlProb: Double?
        let homeAwaySpreadCoverProb: Double?
        let ouResultProb: Double?
        let runId: String?
        enum CodingKeys: String, CodingKey {
            case trainingKey = "training_key"
            case homeAwayMlProb = "home_away_ml_prob"
            case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
            case ouResultProb = "ou_result_prob"
            case runId = "run_id"
        }
    }

    private struct NFLBettingRow: Decodable, Sendable {
        let trainingKey: String
        let homeMl: Int?
        let awayMl: Int?
        let overLine: Double?
        let homeSpread: Double?
        let spreadSplitsLabel: String?
        let mlSplitsLabel: String?
        let totalSplitsLabel: String?
        let asOfTs: String?
        let gameDate: String?
        let gameTime: String?
        let homeMlHandle: String?
        let awayMlHandle: String?
        let homeMlBets: String?
        let awayMlBets: String?
        let homeSpreadHandle: String?
        let awaySpreadHandle: String?
        let homeSpreadBets: String?
        let awaySpreadBets: String?
        let overHandle: String?
        let underHandle: String?
        let overBets: String?
        let underBets: String?
        enum CodingKeys: String, CodingKey {
            case trainingKey = "training_key"
            case homeMl = "home_ml"
            case awayMl = "away_ml"
            case overLine = "over_line"
            case homeSpread = "home_spread"
            case spreadSplitsLabel = "spread_splits_label"
            case mlSplitsLabel = "ml_splits_label"
            case totalSplitsLabel = "total_splits_label"
            case asOfTs = "as_of_ts"
            case gameDate = "game_date"
            case gameTime = "game_time"
            case homeMlHandle = "home_ml_handle"
            case awayMlHandle = "away_ml_handle"
            case homeMlBets = "home_ml_bets"
            case awayMlBets = "away_ml_bets"
            case homeSpreadHandle = "home_spread_handle"
            case awaySpreadHandle = "away_spread_handle"
            case homeSpreadBets = "home_spread_bets"
            case awaySpreadBets = "away_spread_bets"
            case overHandle = "over_handle"
            case underHandle = "under_handle"
            case overBets = "over_bets"
            case underBets = "under_bets"
        }
    }

    private struct WeatherRow: Decodable, Sendable {
        let trainingKey: String?
        let temperature: Double?
        let precipitationPct: Double?
        let windSpeed: Double?
        let icon: String?
        enum CodingKeys: String, CodingKey {
            case trainingKey = "training_key"
            case temperature
            case precipitationPct = "precipitation_pct"
            case windSpeed = "wind_speed"
            case icon
        }
    }

    /// One row of `nfl_slate_feed` — the new app data contract (consensus
    /// close lines + locked-model predictions). See the "NFL Week 12 2025 Dry
    /// Run" doc; the 2026 in-season tables will follow this shape.
    private struct NFLSlateGameRow: Decodable, Sendable {
        let gameId: String
        let season: Int?
        let week: Int?
        let gameday: String?
        let kickoff: String?
        let slot: String?
        let homeAb: String?
        let awayAb: String?
        let homeTeam: String?
        let awayTeam: String?
        let fgSpreadOpen: Double?
        let fgSpreadClose: Double?
        let fgTotalOpen: Double?
        let fgTotalClose: Double?
        let fgMlHomeClose: Double?
        let fgMlAwayClose: Double?
        let ttHomeClose: Double?
        let ttAwayClose: Double?
        let ttHomeBestOver: Double?
        let ttHomeBestUnder: Double?
        let ttAwayBestOver: Double?
        let ttAwayBestUnder: Double?
        let ttHomePick: String?
        let ttAwayPick: String?
        let ttHomeEdge: Double?
        let ttAwayEdge: Double?
        let ttHomePred: Double?
        let ttAwayPred: Double?
        let h1SpreadClose: Double?
        let h1TotalClose: Double?
        let h1MlHomeClose: Double?
        let h1MlAwayClose: Double?
        let h1SpreadPick: String?
        let h1TotalPick: String?
        let h1MlPick: String?
        let fgPredMargin: Double?
        let fgPredSpread: Double?
        let fgPredHomePts: Double?
        let fgPredAwayPts: Double?
        let fgSpreadEdge: Double?
        let fgSpreadPick: String?
        let fgSpreadConfluence: Int?
        let fgPredTotal: Double?
        let fgTotalEdge: Double?
        let fgTotalPick: String?
        let fgTotalTier: String?
        let fgHomeCoverProb: Double?
        let fgHomeWinProb: Double?
        let h1PredTotal: Double?
        let h1PredMargin: Double?
        let h1TotalEdge: Double?
        let h1CoverTilt: Double?
        let h1HomeWinProb: Double?
        let convictionTier: String?
        let stakeUnits: Double?
        let convictionSummary: NFLPrediction.ConvictionSummary?
        let flagsActive: Int?
        let flagsTracking: Int?
        let mammoth: Bool?
        let wxTempF: Double?
        let wxWindMph: Double?
        let wxPrecipMm: Double?
        let wxIndoors: Bool?
        let wxIcon: String?
        let wxSummary: String?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case season, week, gameday, kickoff, slot
            case homeAb = "home_ab"
            case awayAb = "away_ab"
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case fgSpreadOpen = "fg_spread_open"
            case fgSpreadClose = "fg_spread_close"
            case fgTotalOpen = "fg_total_open"
            case fgTotalClose = "fg_total_close"
            case fgMlHomeClose = "fg_ml_home_close"
            case fgMlAwayClose = "fg_ml_away_close"
            case ttHomeClose = "tt_home_close"
            case ttAwayClose = "tt_away_close"
            case ttHomeBestOver = "tt_home_best_over"
            case ttHomeBestUnder = "tt_home_best_under"
            case ttAwayBestOver = "tt_away_best_over"
            case ttAwayBestUnder = "tt_away_best_under"
            case ttHomePick = "tt_home_pick"
            case ttAwayPick = "tt_away_pick"
            case ttHomeEdge = "tt_home_edge"
            case ttAwayEdge = "tt_away_edge"
            case ttHomePred = "tt_home_pred"
            case ttAwayPred = "tt_away_pred"
            case h1SpreadClose = "h1_spread_close"
            case h1TotalClose = "h1_total_close"
            case h1MlHomeClose = "h1_ml_home_close"
            case h1MlAwayClose = "h1_ml_away_close"
            case h1SpreadPick = "h1_spread_pick"
            case h1TotalPick = "h1_total_pick"
            case h1MlPick = "h1_ml_pick"
            case fgPredMargin = "fg_pred_margin"
            case fgPredSpread = "fg_pred_spread"
            case fgPredHomePts = "fg_pred_home_pts"
            case fgPredAwayPts = "fg_pred_away_pts"
            case fgSpreadEdge = "fg_spread_edge"
            case fgSpreadPick = "fg_spread_pick"
            case fgSpreadConfluence = "fg_spread_confluence"
            case fgPredTotal = "fg_pred_total"
            case fgTotalEdge = "fg_total_edge"
            case fgTotalPick = "fg_total_pick"
            case fgTotalTier = "fg_total_tier"
            case fgHomeCoverProb = "fg_home_cover_prob"
            case fgHomeWinProb = "fg_home_win_prob"
            case h1PredTotal = "h1_pred_total"
            case h1PredMargin = "h1_pred_margin"
            case h1TotalEdge = "h1_total_edge"
            case h1CoverTilt = "h1_cover_tilt"
            case h1HomeWinProb = "h1_home_win_prob"
            case convictionTier = "conviction_tier"
            case stakeUnits = "stake_units"
            case convictionSummary = "conviction_summary"
            case flagsActive = "flags_active"
            case flagsTracking = "flags_tracking"
            case mammoth
            case wxTempF = "wx_temp_f"
            case wxWindMph = "wx_wind_mph"
            case wxPrecipMm = "wx_precip_mm"
            case wxIndoors = "wx_indoors"
            case wxIcon = "wx_icon"
            case wxSummary = "wx_summary"
        }
    }

    private static let nflSlotLabels: [String: String] = [
        "thu_fri": "Thu/Fri", "sun_early": "Sun Early",
        "sun_late_sat": "Sun Late", "snf": "SNF", "monday": "MNF",
    ]

    /// Slate mapped onto the card model. Spreads in the contract are
    /// home-relative (negative = home favored) — same convention as the card.
    /// Current (season, week) = soonest upcoming kickoff with a 6h grace.
    private func fetchNFLSlate(_ cfb: SupabaseClient) async -> [NFLPrediction] {
        // Team logos/abbrs come from the `nfl_teams` reference table — warm
        // the cache so the cards can read it synchronously.
        await NFLTeamsService.shared.ensureLoaded()
        await SportsbookCatalogService.shared.ensureLoaded()
        guard let slate = await Self.resolveFootballCurrentWeek(cfb, table: "nfl_slate_feed") else {
            return []
        }
        let rows: [NFLSlateGameRow] = (try? await cfb
            .from("nfl_slate_feed")
            .select()
            .eq("season", value: slate.season)
            .eq("week", value: slate.week)
            .order("kickoff", ascending: true)
            .execute()
            .value) ?? []
        return rows.map(nflPrediction)
        .sorted {
            if $0.topConvictionRank != $1.topConvictionRank { return $0.topConvictionRank < $1.topConvictionRank }
            return ($0.kickoff ?? $0.gameDate) < ($1.kickoff ?? $1.gameDate)
        }
    }

    /// Games-feed anchor: soonest upcoming kickoff (6h grace), else latest slate.
    private static func resolveFootballCurrentWeek(
        _ cfb: SupabaseClient,
        table: String
    ) async -> (season: Int, week: Int)? {
        let grace = Date().addingTimeInterval(-6 * 60 * 60)
        let graceIso = ISO8601DateFormatter().string(from: grace)
        let upcoming: [SlateWeekRow] = (try? await cfb
            .from(table)
            .select("season,week,kickoff")
            .gte("kickoff", value: graceIso)
            .order("kickoff", ascending: true)
            .limit(1)
            .execute()
            .value) ?? []
        if let row = upcoming.first, let season = row.season, let week = row.week {
            return (season, week)
        }
        let latest: [SlateWeekRow] = (try? await cfb
            .from(table)
            .select("season,week")
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value) ?? []
        if let row = latest.first, let season = row.season, let week = row.week {
            return (season, week)
        }
        return nil
    }

    private struct SlateWeekRow: Decodable, Sendable {
        let season: Int?
        let week: Int?
        let kickoff: String?
    }

    private func nflPrediction(from row: NFLSlateGameRow) -> NFLPrediction {
            let gameDate = row.kickoff ?? row.gameday ?? ""
            let homeMl = row.fgMlHomeClose.map { Int($0.rounded()) }
            let awayMl = row.fgMlAwayClose.map { Int($0.rounded()) }
            return NFLPrediction(
                id: row.gameId,
                awayTeam: row.awayTeam ?? "",
                homeTeam: row.homeTeam ?? "",
                awayAb: row.awayAb,
                homeAb: row.homeAb,
                homeMl: homeMl,
                awayMl: awayMl,
                homeSpread: row.fgSpreadClose,
                awaySpread: row.fgSpreadClose.map { -$0 },
                overLine: row.fgTotalClose,
                gameDate: gameDate,
                gameTime: row.kickoff ?? row.slot.flatMap { Self.nflSlotLabels[$0] } ?? "",
                trainingKey: row.gameId,
                uniqueId: row.gameId,
                homeAwayMlProb: row.fgHomeWinProb,
                homeAwaySpreadCoverProb: row.fgHomeCoverProb,
                ouResultProb: nil,
                predTotal: row.fgPredTotal,
                runId: "nfl-slate-\(row.season ?? 2026)-\(row.week ?? 1)",
                temperature: row.wxTempF,
                precipitation: row.wxPrecipMm,
                windSpeed: row.wxWindMph,
                icon: row.wxIcon,
                gameId: row.gameId,
                season: row.season,
                week: row.week,
                gameday: row.gameday,
                kickoff: row.kickoff,
                slot: row.slot,
                fgSpreadOpen: row.fgSpreadOpen,
                fgSpreadClose: row.fgSpreadClose,
                fgTotalOpen: row.fgTotalOpen,
                fgTotalClose: row.fgTotalClose,
                fgMlHomeClose: homeMl,
                fgMlAwayClose: awayMl,
                ttHomeClose: row.ttHomeClose,
                ttAwayClose: row.ttAwayClose,
                ttHomeBestOver: row.ttHomeBestOver,
                ttHomeBestUnder: row.ttHomeBestUnder,
                ttAwayBestOver: row.ttAwayBestOver,
                ttAwayBestUnder: row.ttAwayBestUnder,
                ttHomePick: row.ttHomePick,
                ttAwayPick: row.ttAwayPick,
                ttHomeEdge: row.ttHomeEdge,
                ttAwayEdge: row.ttAwayEdge,
                ttHomePred: row.ttHomePred,
                ttAwayPred: row.ttAwayPred,
                h1SpreadClose: row.h1SpreadClose,
                h1TotalClose: row.h1TotalClose,
                h1MlHomeClose: row.h1MlHomeClose.map { Int($0.rounded()) },
                h1MlAwayClose: row.h1MlAwayClose.map { Int($0.rounded()) },
                h1SpreadPick: row.h1SpreadPick,
                h1TotalPick: row.h1TotalPick,
                h1MlPick: row.h1MlPick,
                fgPredMargin: row.fgPredMargin,
                fgPredSpread: row.fgPredSpread,
                fgPredHomePts: row.fgPredHomePts,
                fgPredAwayPts: row.fgPredAwayPts,
                fgSpreadEdge: row.fgSpreadEdge,
                fgSpreadPick: row.fgSpreadPick,
                fgSpreadConfluence: row.fgSpreadConfluence,
                fgTotalEdge: row.fgTotalEdge,
                fgTotalPick: row.fgTotalPick,
                fgTotalTier: row.fgTotalTier,
                h1PredTotal: row.h1PredTotal,
                h1PredMargin: row.h1PredMargin,
                h1TotalEdge: row.h1TotalEdge,
                h1CoverTilt: row.h1CoverTilt,
                h1HomeWinProb: row.h1HomeWinProb,
                convictionTierRaw: row.convictionTier ?? "none",
                stakeUnits: row.stakeUnits,
                convictionSummary: row.convictionSummary,
                flagsActive: row.flagsActive,
                flagsTracking: row.flagsTracking,
                mammoth: row.mammoth ?? false,
                wxTempF: row.wxTempF,
                wxWindMph: row.wxWindMph,
                wxPrecipMm: row.wxPrecipMm,
                wxIndoors: row.wxIndoors,
                wxIcon: row.wxIcon,
                wxSummary: row.wxSummary
            )
    }

    private func fetchNFL() async throws {
        let cfb = await CFBSupabase.shared.client

        let slate = await fetchNFLSlate(cfb)
        if !slate.isEmpty {
            games.nfl = slate
            storeRanks(.nfl, await nflSignalRanks(cfb, games: slate))
            return
        }

        // Step 1: input view (no filters — matches RN exactly).
        let viewRows: [NFLViewRow] = try await cfb
            .from("v_input_values_with_epa")
            .select()
            .execute()
            .value

        if viewRows.isEmpty { return }

        // Step 2: predictions, latest run_id only.
        let predictionRows: [NFLPredictionRow] = (try? await cfb
            .from("nfl_predictions_epa")
            .select("training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id")
            .execute()
            .value) ?? []
        var predictionsMap: [String: NFLPredictionRow] = [:]
        if !predictionRows.isEmpty {
            // Pick the lexicographically-largest run_id (RN sorts desc + takes first).
            let latestRunId = predictionRows.compactMap { $0.runId }.sorted(by: >).first
            for row in predictionRows where row.runId == latestRunId {
                predictionsMap[row.trainingKey] = row
            }
        }

        // Step 3: betting lines, most-recent per training_key.
        let bettingRows: [NFLBettingRow] = (try? await cfb
            .from("nfl_betting_lines")
            .select("training_key, home_ml, away_ml, over_line, home_spread, spread_splits_label, ml_splits_label, total_splits_label, as_of_ts, game_date, game_time, home_ml_handle, away_ml_handle, home_ml_bets, away_ml_bets, home_spread_handle, away_spread_handle, home_spread_bets, away_spread_bets, over_handle, under_handle, over_bets, under_bets")
            .execute()
            .value) ?? []
        var bettingMap: [String: NFLBettingRow] = [:]
        for row in bettingRows {
            if let existing = bettingMap[row.trainingKey] {
                if let newTs = row.asOfTs, let oldTs = existing.asOfTs, newTs > oldTs {
                    bettingMap[row.trainingKey] = row
                } else if existing.asOfTs == nil {
                    bettingMap[row.trainingKey] = row
                }
            } else {
                bettingMap[row.trainingKey] = row
            }
        }

        // Step 4: weather.
        let weatherRows: [WeatherRow] = (try? await cfb
            .from("production_weather")
            .select()
            .execute()
            .value) ?? []
        var weatherMap: [String: WeatherRow] = [:]
        for row in weatherRows {
            if let key = row.trainingKey { weatherMap[key] = row }
        }

        // Step 5: merge.
        let merged: [NFLPrediction] = viewRows.map { row in
            let matchKey = row.homeAwayUnique ?? ""
            let prediction = predictionsMap[matchKey]
            let bet = bettingMap[matchKey]
            let weather = weatherMap[matchKey]
            let homeSpread = row.homeSpread ?? bet?.homeSpread
            let awaySpread: Double? = {
                if let h = row.homeSpread { return -h }
                if let h = bet?.homeSpread { return -h }
                return nil
            }()
            return NFLPrediction(
                id: row.id ?? matchKey,
                awayTeam: row.awayTeam ?? "",
                homeTeam: row.homeTeam ?? "",
                homeMl: bet?.homeMl,
                awayMl: bet?.awayMl,
                homeSpread: homeSpread,
                awaySpread: awaySpread,
                overLine: row.overUnder ?? bet?.overLine,
                gameDate: row.gameDate ?? "",
                gameTime: bet?.gameTime ?? row.gameTime ?? "",
                trainingKey: matchKey,
                uniqueId: row.uniqueId ?? matchKey,
                homeAwayMlProb: prediction?.homeAwayMlProb,
                homeAwaySpreadCoverProb: prediction?.homeAwaySpreadCoverProb,
                ouResultProb: prediction?.ouResultProb,
                runId: prediction?.runId,
                temperature: weather?.temperature,
                precipitation: weather?.precipitationPct,
                windSpeed: weather?.windSpeed,
                icon: weather?.icon,
                spreadSplitsLabel: bet?.spreadSplitsLabel,
                totalSplitsLabel: bet?.totalSplitsLabel,
                mlSplitsLabel: bet?.mlSplitsLabel,
                homeMlHandle: bet?.homeMlHandle,
                awayMlHandle: bet?.awayMlHandle,
                homeMlBets: bet?.homeMlBets,
                awayMlBets: bet?.awayMlBets,
                homeSpreadHandle: bet?.homeSpreadHandle,
                awaySpreadHandle: bet?.awaySpreadHandle,
                homeSpreadBets: bet?.homeSpreadBets,
                awaySpreadBets: bet?.awaySpreadBets,
                overHandle: bet?.overHandle,
                underHandle: bet?.underHandle,
                overBets: bet?.overBets,
                underBets: bet?.underBets
            )
        }
        games.nfl = merged
        storeRanks(.nfl, [:])
    }

    // MARK: - CFB fetch (slate tables — the legacy cfb_live_weekly_inputs +
    // cfb_api_predictions system is dead; tables kept empty for old RN builds)

    private struct FlexibleString: Decodable, Hashable, Sendable {
        let value: String

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let s = try? c.decode(String.self) {
                value = s
            } else if let i = try? c.decode(Int.self) {
                value = String(i)
            } else if let d = try? c.decode(Double.self) {
                value = d.rounded(.towardZero) == d ? String(Int(d)) : String(d)
            } else {
                value = ""
            }
        }
    }

    private struct CFBSlateGameRow: Decodable, Sendable {
        let gameId: FlexibleString
        let season: Int?
        let week: Int?
        let kickoff: String?
        let neutralSite: Bool?
        let homeTeam: String?
        let awayTeam: String?
        let homeConf: String?
        let awayConf: String?
        let homeRank: Int?
        let awayRank: Int?
        let classification: String?
        let fgSpreadOpen: Double?
        let fgSpreadClose: Double?
        let fgTotalOpen: Double?
        let fgTotalClose: Double?
        let fgMlHomeClose: Double?
        let fgMlAwayClose: Double?
        let ttHomeClose: Double?
        let ttAwayClose: Double?
        let ttHomeBestUnder: Double?
        let ttHomeBestOver: Double?
        let ttAwayBestUnder: Double?
        let ttAwayBestOver: Double?
        let h1SpreadClose: Double?
        let h1TotalClose: Double?
        let h1MlHomeClose: Double?
        let h1MlAwayClose: Double?
        let fgPredMargin: Double?
        let fgPredHomePts: Double?
        let fgPredAwayPts: Double?
        let fgPredSpread: Double?
        let fgSpreadEdge: Double?
        let fgSpreadPick: String?
        let fgSpreadCapped: Bool?
        let fgPredTotal: Double?
        let fgTotalEdge: Double?
        let fgTotalPick: String?
        let ttHomePred: Double?
        let ttAwayPred: Double?
        let ttHomePick: String?
        let ttAwayPick: String?
        let h1PredMargin: Double?
        let h1PredTotal: Double?
        let h1SpreadPick: String?
        let h1TotalPick: String?
        let h1MlPick: String?
        let fgHomeCoverProb: Double?
        let fgHomeWinProb: Double?
        let wxTempF: Double?
        let wxWindMph: Double?
        let wxPrecipMm: Double?
        let wxIndoors: Bool?
        let wxIcon: String?
        let wxSummary: String?
        let convictionTier: String?
        let stakeUnits: Double?
        let nFlagsActive: Int?
        let nFlagsTracking: Int?
        let mammoth: Bool?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case season, week, kickoff
            case neutralSite = "neutral_site"
            case homeTeam = "home_team"
            case awayTeam = "away_team"
            case homeConf = "home_conf"
            case awayConf = "away_conf"
            case homeRank = "home_rank"
            case awayRank = "away_rank"
            case classification
            case fgSpreadOpen = "fg_spread_open"
            case fgSpreadClose = "fg_spread_close"
            case fgTotalOpen = "fg_total_open"
            case fgTotalClose = "fg_total_close"
            case fgMlHomeClose = "fg_ml_home_close"
            case fgMlAwayClose = "fg_ml_away_close"
            case ttHomeClose = "tt_home_close"
            case ttAwayClose = "tt_away_close"
            case ttHomeBestUnder = "tt_home_best_under"
            case ttHomeBestOver = "tt_home_best_over"
            case ttAwayBestUnder = "tt_away_best_under"
            case ttAwayBestOver = "tt_away_best_over"
            case h1SpreadClose = "h1_spread_close"
            case h1TotalClose = "h1_total_close"
            case h1MlHomeClose = "h1_ml_home_close"
            case h1MlAwayClose = "h1_ml_away_close"
            case fgPredMargin = "fg_pred_margin"
            case fgPredHomePts = "fg_pred_home_pts"
            case fgPredAwayPts = "fg_pred_away_pts"
            case fgPredSpread = "fg_pred_spread"
            case fgSpreadEdge = "fg_spread_edge"
            case fgSpreadPick = "fg_spread_pick"
            case fgSpreadCapped = "fg_spread_capped"
            case fgPredTotal = "fg_pred_total"
            case fgTotalEdge = "fg_total_edge"
            case fgTotalPick = "fg_total_pick"
            case ttHomePred = "tt_home_pred"
            case ttAwayPred = "tt_away_pred"
            case ttHomePick = "tt_home_pick"
            case ttAwayPick = "tt_away_pick"
            case h1PredMargin = "h1_pred_margin"
            case h1PredTotal = "h1_pred_total"
            case h1SpreadPick = "h1_spread_pick"
            case h1TotalPick = "h1_total_pick"
            case h1MlPick = "h1_ml_pick"
            case fgHomeCoverProb = "fg_home_cover_prob"
            case fgHomeWinProb = "fg_home_win_prob"
            case wxTempF = "wx_temp_f"
            case wxWindMph = "wx_wind_mph"
            case wxPrecipMm = "wx_precip_mm"
            case wxIndoors = "wx_indoors"
            case wxIcon = "wx_icon"
            case wxSummary = "wx_summary"
            case convictionTier = "conviction_tier"
            case stakeUnits = "stake_units"
            case nFlagsActive = "n_flags_active"
            case nFlagsTracking = "n_flags_tracking"
            case mammoth
        }
    }

    private struct CFBSlateFlagRow: Decodable, Sendable {
        let id: FlexibleString
        let gameId: FlexibleString
        let season: Int?
        let week: Int?
        let game: String?
        let source: String?
        let market: String?
        let side: String?
        let line: Double?
        let price: Int?
        let edge: Double?
        let conviction: String?
        let tier: String?
        let stakeUnits: Double?
        let gradeLine: String?
        let mammoth: Bool?
        let betTeam: String?
        let betDirection: String?
        let betLine: Double?

        enum CodingKeys: String, CodingKey {
            case id
            case gameId = "game_id"
            case season, week, game, source, market, side, line, price, edge, conviction, tier, mammoth
            case stakeUnits = "stake_units"
            case gradeLine = "grade_line"
            case betTeam = "bet_team"
            case betDirection = "bet_direction"
            case betLine = "bet_line"
        }

        var model: CFBSlateFlag {
            CFBSlateFlag(
                id: id.value,
                gameId: gameId.value,
                season: season,
                week: week,
                game: game,
                source: source ?? "Signal",
                market: market ?? "",
                side: side ?? "",
                line: line,
                price: price,
                edge: edge,
                conviction: conviction ?? "track",
                tier: tier ?? "tracking",
                stakeUnits: stakeUnits,
                gradeLine: gradeLine,
                mammoth: mammoth,
                betTeam: betTeam,
                betDirection: betDirection,
                betLine: betLine
            )
        }
    }

    private func fetchCFB() async throws {
        try await fetchCFBSlate()
    }

    private func fetchCFBSlate() async throws {
        let cfb = await CFBSupabase.shared.client
        await CFBTeamsService.shared.ensureLoaded()
        await SportsbookCatalogService.shared.ensureLoaded()

        guard let slate = await Self.resolveFootballCurrentWeek(cfb, table: "cfb_slate_feed") else {
            games.cfb = []
            storeRanks(.cfb, [:])
            return
        }

        async let gameRows: [CFBSlateGameRow] = cfb
            .from("cfb_slate_feed")
            .select()
            .eq("season", value: slate.season)
            .eq("week", value: slate.week)
            .order("kickoff", ascending: true)
            .execute()
            .value
        async let flagRows: [CFBSlateFlagRow] = cfb
            .from("cfb_slate_flags")
            .select()
            .eq("season", value: slate.season)
            .eq("week", value: slate.week)
            .execute()
            .value

        async let signalDefs = CFBSignalDefinitionsService.shared.definitionsBySource()
        let (rows, flags, definitionsBySource) = try await (gameRows, flagRows, signalDefs)
        let flagModels = flags.map { row in
            let flag = row.model
            let definition = CFBSignalDefinitionsService.definition(for: flag.source, in: definitionsBySource)
            return flag.withSignalDefinition(definition)
        }
        let flagsByGame = Dictionary(grouping: flagModels, by: \.gameId)

        let built = rows.map { row in
            let gameId = row.gameId.value
            let away = row.awayTeam ?? "Away"
            let home = row.homeTeam ?? "Home"
            let attachedFlags = (flagsByGame[gameId] ?? []).sorted { a, b in
                if a.isActive != b.isActive { return a.isActive && !b.isActive }
                if a.convictionTier.sortRank != b.convictionTier.sortRank {
                    return a.convictionTier.sortRank < b.convictionTier.sortRank
                }
                return (a.stakeUnits ?? 0) > (b.stakeUnits ?? 0)
            }
            let score = Self.cfbPredictedScore(home: row.fgPredHomePts, away: row.fgPredAwayPts, total: row.fgPredTotal, margin: row.fgPredMargin)
            return CFBPrediction(
                id: gameId,
                awayTeam: away,
                homeTeam: home,
                homeMl: row.fgMlHomeClose.map { Int($0.rounded()) },
                awayMl: row.fgMlAwayClose.map { Int($0.rounded()) },
                homeSpread: row.fgSpreadClose,
                awaySpread: row.fgSpreadClose.map { -$0 },
                overLine: row.fgTotalClose,
                gameDate: row.kickoff ?? "",
                gameTime: row.kickoff ?? "",
                trainingKey: gameId,
                uniqueId: gameId,
                homeAwayMlProb: row.fgHomeWinProb,
                homeAwaySpreadCoverProb: row.fgHomeCoverProb,
                ouResultProb: nil,
                runId: "cfb-slate-\(slate.season)-\(slate.week)",
                temperature: row.wxTempF,
                precipitation: row.wxPrecipMm,
                windSpeed: row.wxWindMph,
                icon: row.wxIcon,
                wxTempF: row.wxTempF,
                wxWindMph: row.wxWindMph,
                wxPrecipMm: row.wxPrecipMm,
                wxIndoors: row.wxIndoors,
                wxIcon: row.wxIcon,
                wxSummary: row.wxSummary,
                conference: [row.awayConf, row.homeConf].compactMap { $0 }.joined(separator: " / "),
                predAwayScore: score?.away,
                predHomeScore: score?.home,
                predAwayPoints: score?.away,
                predHomePoints: score?.home,
                predSpread: row.fgPredSpread,
                homeSpreadDiff: row.fgSpreadEdge,
                predTotal: row.fgPredTotal,
                totalDiff: row.fgTotalEdge,
                predOverLine: row.fgPredTotal,
                overLineDiff: row.fgTotalEdge,
                openingSpread: row.fgSpreadOpen,
                openingTotal: row.fgTotalOpen,
                gameId: gameId,
                season: row.season,
                week: row.week,
                kickoff: row.kickoff,
                neutralSite: row.neutralSite,
                homeConf: row.homeConf,
                awayConf: row.awayConf,
                homeRank: row.homeRank,
                awayRank: row.awayRank,
                homeClassification: CFBTeamAssets.team(for: home)?.classification ?? row.classification,
                awayClassification: CFBTeamAssets.team(for: away)?.classification ?? row.classification,
                homeTeamRef: CFBTeamAssets.team(for: home),
                awayTeamRef: CFBTeamAssets.team(for: away),
                fgSpreadOpen: row.fgSpreadOpen,
                fgSpreadClose: row.fgSpreadClose,
                fgTotalOpen: row.fgTotalOpen,
                fgTotalClose: row.fgTotalClose,
                fgMlHomeClose: row.fgMlHomeClose.map { Int($0.rounded()) },
                fgMlAwayClose: row.fgMlAwayClose.map { Int($0.rounded()) },
                ttHomeClose: row.ttHomeClose,
                ttAwayClose: row.ttAwayClose,
                ttHomeBestUnder: row.ttHomeBestUnder,
                ttHomeBestOver: row.ttHomeBestOver,
                ttAwayBestUnder: row.ttAwayBestUnder,
                ttAwayBestOver: row.ttAwayBestOver,
                h1SpreadClose: row.h1SpreadClose,
                h1TotalClose: row.h1TotalClose,
                h1MlHomeClose: row.h1MlHomeClose.map { Int($0.rounded()) },
                h1MlAwayClose: row.h1MlAwayClose.map { Int($0.rounded()) },
                fgPredMargin: row.fgPredMargin,
                fgPredSpread: row.fgPredSpread,
                fgSpreadEdge: row.fgSpreadEdge,
                fgSpreadPick: row.fgSpreadPick,
                fgSpreadCapped: row.fgSpreadCapped,
                fgPredTotal: row.fgPredTotal,
                fgTotalEdge: row.fgTotalEdge,
                fgTotalPick: row.fgTotalPick,
                ttHomePred: row.ttHomePred,
                ttAwayPred: row.ttAwayPred,
                ttHomePick: row.ttHomePick,
                ttAwayPick: row.ttAwayPick,
                h1PredMargin: row.h1PredMargin,
                h1PredTotal: row.h1PredTotal,
                h1SpreadPick: row.h1SpreadPick,
                h1TotalPick: row.h1TotalPick,
                h1MlPick: row.h1MlPick,
                fgHomeCoverProb: row.fgHomeCoverProb,
                fgHomeWinProb: row.fgHomeWinProb,
                convictionTierRaw: row.convictionTier ?? "none",
                stakeUnits: row.stakeUnits,
                nFlagsActive: row.nFlagsActive,
                nFlagsTracking: row.nFlagsTracking,
                mammoth: row.mammoth ?? false,
                flags: attachedFlags
            )
        }
        games.cfb = built
        let performances = await SignalPerformanceService.shared.performances(for: .cfb, season: slate.season)
        storeRanks(.cfb, cfbSignalRanks(built, performances))
    }

    private static func cfbPredictedScore(home: Double?, away: Double?, total: Double?, margin: Double?) -> (home: Double, away: Double)? {
        if let home, let away { return (home, away) }
        guard let total, let margin else { return nil }
        // |margin| > total makes the raw split negative for the dog — floor at 0 like the generator.
        let h = (total + margin) / 2
        let a = (total - margin) / 2
        if a < 0 { return (total, 0) }
        if h < 0 { return (0, total) }
        return (h, a)
    }

    // MARK: - NBA / NCAAB / MLB
    //
    // NCAAB was upgraded to a real fetch in B11 — see `fetchNCAAB` below.
    // NBA gets its full port in B10 — `fetchNBA` below mirrors RN
    // `fetchNBAData()` (index.tsx:406-529).
    // MLB remains a placeholder fetch pending B12.
    //
    // FIDELITY-WAIVER #031: MLB games render as placeholders, full port lands in B12.

    private struct NBAInputRow: Decodable, Sendable {
        let gameId: Int
        let awayTeam: String?
        let homeTeam: String?
        let awayAbbr: String?
        let homeAbbr: String?
        let homeMoneyline: Int?
        let awayMoneyline: Int?
        let homeSpread: Double?
        let totalLine: Double?
        let gameDate: String?
        let tipoffTimeEt: String?
        let homeAdjOffRtgPregame: Double?
        let awayAdjOffRtgPregame: Double?
        let homeAdjDefRtgPregame: Double?
        let awayAdjDefRtgPregame: Double?
        let homeAdjPacePregame: Double?
        let awayAdjPacePregame: Double?
        let homeAtsPct: Double?
        let awayAtsPct: Double?
        let homeOverPct: Double?
        let awayOverPct: Double?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case awayAbbr = "away_abbr"
            case homeAbbr = "home_abbr"
            case homeMoneyline = "home_moneyline"
            case awayMoneyline = "away_moneyline"
            case homeSpread = "home_spread"
            case totalLine = "total_line"
            case gameDate = "game_date"
            case tipoffTimeEt = "tipoff_time_et"
            case homeAdjOffRtgPregame = "home_adj_off_rtg_pregame"
            case awayAdjOffRtgPregame = "away_adj_off_rtg_pregame"
            case homeAdjDefRtgPregame = "home_adj_def_rtg_pregame"
            case awayAdjDefRtgPregame = "away_adj_def_rtg_pregame"
            case homeAdjPacePregame = "home_adj_pace_pregame"
            case awayAdjPacePregame = "away_adj_pace_pregame"
            case homeAtsPct = "home_ats_pct"
            case awayAtsPct = "away_ats_pct"
            case homeOverPct = "home_over_pct"
            case awayOverPct = "away_over_pct"
        }
    }

    private struct NBAPredictionRow: Decodable, Sendable {
        let gameId: Int
        let homeWinProb: Double?
        let awayWinProb: Double?
        let modelFairTotal: Double?
        let homeScorePred: Double?
        let awayScorePred: Double?
        let modelFairHomeSpread: Double?
        let runId: String?
        let asOfTsUtc: String?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case homeWinProb = "home_win_prob"
            case awayWinProb = "away_win_prob"
            case modelFairTotal = "model_fair_total"
            case homeScorePred = "home_score_pred"
            case awayScorePred = "away_score_pred"
            case modelFairHomeSpread = "model_fair_home_spread"
            case runId = "run_id"
            case asOfTsUtc = "as_of_ts_utc"
        }
    }

    /// One `nba_model_preds` row: the originator models (one row per game per market).
    /// `gameId` (balldontlie) is NULL until nba_input_values_view carries the game, so rows are
    /// also matched on date + abbreviations. Mirrors web `nbaGames.ts` (2026-10-13).
    private struct NBAModelPredRow: Decodable, Sendable {
        let espnGameId: Int
        let gameId: Int?
        let gameDate: String
        let homeAbbr: String
        let awayAbbr: String
        let market: String
        let modelHomeMargin: Double?
        let modelTotal: Double?
        let tier: String?
        let homeWinProb: Double?
        enum CodingKeys: String, CodingKey {
            case espnGameId = "espn_game_id"
            case gameId = "game_id"
            case gameDate = "game_date"
            case homeAbbr = "home_abbr"
            case awayAbbr = "away_abbr"
            case market
            case modelHomeMargin = "model_home_margin"
            case modelTotal = "model_total"
            case tier
            case homeWinProb = "home_win_prob"
        }
        var abbrKey: String { "\(gameDate.prefix(10))|\(homeAbbr)|\(awayAbbr)" }
    }

    private struct NBAFlagRow: Decodable, Sendable {
        let gameId: Int?
        let gameDate: String?
        let game: String?
        let signalKey: String?
        let side: String?
        let recordText: String?
        let market: String?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case gameDate = "game_date"
            case game
            case signalKey = "signal_key"
            case side
            case recordText = "record_text"
            case market
        }
    }

    private struct NBASignalDefRow: Decodable, Sendable {
        let signalKey: String
        let displayName: String?
        let definition: String?
        let recordText: String?
        let seasonRecordText: String?
        let market: String?
        enum CodingKeys: String, CodingKey {
            case signalKey = "signal_key"
            case displayName = "display_name"
            case definition
            case recordText = "record_text"
            case seasonRecordText = "season_record_text"
            case market
        }
    }

    private struct NBAH1Row: Decodable, Sendable {
        let gameId: Int?
        let gameDate: String
        let homeAbbr: String
        let awayAbbr: String
        let market: String
        let modelHomeMargin: Double?
        let modelTotal: Double?
        let marketHomeSpread: Double?
        let marketTotal: Double?
        let disagreement: Double?
        let tier: String?
        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case gameDate = "game_date"
            case homeAbbr = "home_abbr"
            case awayAbbr = "away_abbr"
            case market
            case modelHomeMargin = "model_home_margin"
            case modelTotal = "model_total"
            case marketHomeSpread = "market_home_spread"
            case marketTotal = "market_total"
            case disagreement
            case tier
        }
        var abbrKey: String { "\(gameDate.prefix(10))|\(homeAbbr)|\(awayAbbr)" }
    }

    /// Compute away ML from home ML when missing. Mirrors RN
    /// `calculateAwayML` helper in index.tsx:400-403.
    private static func calculateAwayML(_ homeML: Int?) -> Int? {
        guard let homeML else { return nil }
        return homeML > 0 ? -(homeML + 100) : 100 - homeML
    }

    private func fetchNBA() async throws {
        let cfb = await CFBSupabase.shared.client

        // Step 1: full input view rows (RN selects '*').
        let inputRows: [NBAInputRow] = try await cfb
            .from("nba_input_values_view")
            .select()
            .execute()
            .value
        if inputRows.isEmpty {
            games.nba = []
            nbaSignalsByGame = [:]
            nbaSignalsByAbbr = [:]
            nbaFirstHalfByGame = [:]
            nbaFirstHalfByAbbr = [:]
            storeRanks(.nba, [:])
            return
        }

        // Step 2: originator model rows (spread margin + total) for the dates on the board.
        // Replaced nba_predictions' model_fair_* on 2026-10-13 (owner call): those were a transform of
        // win probability with zero correlation to results. nba_predictions is kept for home_win_prob only.
        let dates = Array(Set(inputRows.compactMap { $0.gameDate.map { String($0.prefix(10)) } }))
        let modelRows: [NBAModelPredRow] = dates.isEmpty ? [] : ((try? await cfb
            .from("nba_model_preds")
            .select("espn_game_id, game_id, game_date, home_abbr, away_abbr, market, model_home_margin, model_total, tier, home_win_prob")
            .in("game_date", values: dates)
            .execute()
            .value) ?? [])
        var spreadByGameId: [Int: NBAModelPredRow] = [:], totalByGameId: [Int: NBAModelPredRow] = [:]
        var spreadByAbbr: [String: NBAModelPredRow] = [:], totalByAbbr: [String: NBAModelPredRow] = [:]
        for row in modelRows {
            if row.market == "total" {
                if let g = row.gameId { totalByGameId[g] = row }
                totalByAbbr[row.abbrKey] = row
            } else {
                if let g = row.gameId { spreadByGameId[g] = row }
                spreadByAbbr[row.abbrKey] = row
            }
        }

        let predictionRows: [NBAPredictionRow] = (try? await cfb
            .from("nba_predictions")
            .select("game_id, home_win_prob, away_win_prob, run_id, as_of_ts_utc")
            .execute()
            .value) ?? []
        var predictionsByGame: [Int: NBAPredictionRow] = [:]
        for row in predictionRows {
            if let existing = predictionsByGame[row.gameId] {
                let lhs = row.asOfTsUtc ?? ""
                let rhs = existing.asOfTsUtc ?? ""
                if lhs > rhs { predictionsByGame[row.gameId] = row }
            } else {
                predictionsByGame[row.gameId] = row
            }
        }

        let flagRows: [NBAFlagRow] = dates.isEmpty ? [] : ((try? await cfb
            .from("nba_slate_flags")
            .select("game_id, game_date, game, signal_key, side, record_text, market")
            .in("game_date", values: dates)
            .execute()
            .value) ?? [])
        let defRows: [NBASignalDefRow] = ((try? await cfb
            .from("nba_signal_defs")
            .select("signal_key, display_name, definition, record_text, season_record_text, market")
            .execute()
            .value) ?? [])
        var defsByKey: [String: NBASignalDefRow] = [:]
        for def in defRows { defsByKey[def.signalKey] = def }
        var signalsByGame: [Int: [NBASlateSignal]] = [:]
        var signalsByAbbr: [String: [NBASlateSignal]] = [:]
        for flag in flagRows {
            guard let key = flag.signalKey, !key.isEmpty else { continue }
            let def = defsByKey[key]
            let signal = NBASlateSignal(
                id: "\(flag.gameId ?? 0)|\(key)",
                title: def?.displayName ?? key,
                side: flag.side,
                definition: def?.definition,
                recordText: def?.recordText ?? flag.recordText,
                seasonRecordText: def?.seasonRecordText,
                market: BasketballSignalMarket.canonical(flag.market) ?? BasketballSignalMarket.canonical(def?.market) ?? ""
            )
            if let gameId = flag.gameId {
                signalsByGame[gameId, default: []].append(signal)
            }
            let parts = (flag.game ?? "").split(separator: "@").map { $0.trimmingCharacters(in: .whitespaces) }
            if parts.count == 2 {
                let abbr = "\((flag.gameDate ?? "").prefix(10))|\(parts[1])|\(parts[0])"
                signalsByAbbr[abbr, default: []].append(signal)
            }
        }
        nbaSignalsByGame = signalsByGame
        nbaSignalsByAbbr = signalsByAbbr
        storeRanks(.nba, nbaSignalRanks(signalsByGame))

        let h1Rows: [NBAH1Row] = dates.isEmpty ? [] : ((try? await cfb
            .from("nba_model_preds_h1")
            .select("game_id, game_date, home_abbr, away_abbr, market, model_home_margin, model_total, market_home_spread, market_total, disagreement, tier")
            .in("game_date", values: dates)
            .execute()
            .value) ?? [])
        var h1ByGame: [Int: [NBAFirstHalfMarket]] = [:]
        var h1ByAbbr: [String: [NBAFirstHalfMarket]] = [:]
        for row in h1Rows {
            let tracking = row.market == "h1_total"
            let modelNumber: Double? = row.market == "h1_spread" ? row.modelHomeMargin.map { -$0 } : row.modelTotal
            let marketNumber: Double? = row.market == "h1_spread" ? row.marketHomeSpread : row.marketTotal
            let tier = tracking && row.tier == "bet" ? "tracking" : row.tier
            let market = NBAFirstHalfMarket(
                id: row.market,
                title: row.market == "h1_spread" ? "1H spread" : "1H total",
                modelNumber: modelNumber,
                marketNumber: marketNumber,
                disagreement: row.disagreement,
                tier: tier,
                trackingOnly: tracking,
                homeAbbr: row.homeAbbr,
                awayAbbr: row.awayAbbr
            )
            if let gameId = row.gameId { h1ByGame[gameId, default: []].append(market) }
            h1ByAbbr[row.abbrKey, default: []].append(market)
        }
        nbaFirstHalfByGame = h1ByGame
        nbaFirstHalfByAbbr = h1ByAbbr

        // Step 3: merge into NBAGame, deriving probabilities client-side
        // (matches RN's index.tsx:457-479).
        games.nba = inputRows.map { input in
            let pred = predictionsByGame[input.gameId]
            let abbrKey = "\((input.gameDate ?? "").prefix(10))|\(input.homeAbbr ?? "")|\(input.awayAbbr ?? "")"
            let spreadRow = spreadByGameId[input.gameId] ?? spreadByAbbr[abbrKey]
            let totalRow = totalByGameId[input.gameId] ?? totalByAbbr[abbrKey]
            // The model predicts the HOME MARGIN; +7.6 is the home team at -7.6, so the fair home
            // spread is the negated margin (negated exactly once, here).
            let modelFairHomeSpread: Double? = spreadRow?.modelHomeMargin.map { -$0 }
            // Total hidden while the model is warming up (< 10 games played): no season-to-date form yet.
            let modelFairTotal: Double? = totalRow?.modelTotal
            let simTotal = totalRow?.modelTotal
            let homeScorePred: Double? = (simTotal != nil && spreadRow?.modelHomeMargin != nil) ? (simTotal! + spreadRow!.modelHomeMargin!) / 2 : nil
            let awayScorePred: Double? = (simTotal != nil && spreadRow?.modelHomeMargin != nil) ? (simTotal! - spreadRow!.modelHomeMargin!) / 2 : nil
            var spreadCoverProb: Double? = nil
            if let modelFair = modelFairHomeSpread, let homeSpread = input.homeSpread {
                let diff = abs(modelFair - homeSpread)
                if modelFair < homeSpread {
                    spreadCoverProb = 0.5 + min(diff * 0.05, 0.35)
                } else {
                    spreadCoverProb = 0.5 - min(diff * 0.05, 0.35)
                }
            } else if let p = pred?.homeWinProb {
                spreadCoverProb = p
            }
            var ouProb: Double? = nil
            if let modelFair = modelFairTotal, let totalLine = input.totalLine {
                let totalDiff = modelFair - totalLine
                if totalDiff > 0 {
                    ouProb = 0.5 + min(abs(totalDiff) * 0.02, 0.35)
                } else {
                    ouProb = 0.5 - min(abs(totalDiff) * 0.02, 0.35)
                }
            }
            let gameIdStr = String(input.gameId)
            let awayAbbr: String = {
                if let a = input.awayAbbr, !a.trimmingCharacters(in: .whitespaces).isEmpty { return a }
                return input.awayTeam ?? "AWAY"
            }()
            let homeAbbr: String = {
                if let h = input.homeAbbr, !h.trimmingCharacters(in: .whitespaces).isEmpty { return h }
                return input.homeTeam ?? "HOME"
            }()
            let awaySpread: Double? = input.homeSpread.map { -$0 }
            return NBAGame(
                id: gameIdStr,
                gameId: input.gameId,
                awayTeam: input.awayTeam ?? "",
                homeTeam: input.homeTeam ?? "",
                awayAbbr: awayAbbr,
                homeAbbr: homeAbbr,
                homeMl: input.homeMoneyline,
                awayMl: input.awayMoneyline ?? Self.calculateAwayML(input.homeMoneyline),
                homeSpread: input.homeSpread,
                awaySpread: awaySpread,
                overLine: input.totalLine,
                gameDate: input.gameDate ?? "",
                gameTime: input.tipoffTimeEt ?? "",
                trainingKey: gameIdStr,
                uniqueId: gameIdStr,
                homeAdjOffense: input.homeAdjOffRtgPregame,
                awayAdjOffense: input.awayAdjOffRtgPregame,
                homeAdjDefense: input.homeAdjDefRtgPregame,
                awayAdjDefense: input.awayAdjDefRtgPregame,
                homeAdjPace: input.homeAdjPacePregame,
                awayAdjPace: input.awayAdjPacePregame,
                homeAtsPct: input.homeAtsPct,
                awayAtsPct: input.awayAtsPct,
                homeOverPct: input.homeOverPct,
                awayOverPct: input.awayOverPct,
                homeAwayMlProb: spreadRow?.homeWinProb ?? pred?.homeWinProb,
                homeAwaySpreadCoverProb: spreadCoverProb,
                ouResultProb: ouProb,
                runId: pred?.runId,
                homeScorePred: homeScorePred,
                awayScorePred: awayScorePred,
                modelFairHomeSpread: modelFairHomeSpread,
                modelFairTotal: modelFairTotal,
                totalTier: totalRow?.tier
            )
        }
    }

    // MARK: NCAAB fetch
    //
    // 3-way merge of `v_cbb_input_values` + `ncaab_predictions` (latest
    // run_id only) + `ncaab_team_mapping`. Matches RN
    // `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx` NCAAB block: pull
    // today's input rows, find the most recent prediction run, attach team
    // logos + abbreviations.

    private struct NCAABInputRow: Decodable, Sendable {
        let gameId: Int
        let awayTeam: String?
        let homeTeam: String?
        let awayTeamId: Int?
        let homeTeamId: Int?
        let homeMl: Int?
        let awayMl: Int?
        /// Home spread. The view publishes one number (`spread`), negative when
        /// the home team is favored. The away number is the negation.
        let homeSpread: Double?
        let overUnder: Double?
        let gameDateEt: String?
        let tipoffTimeEt: String?
        let startUtc: String?
        let homeAdjOffense: Double?
        let awayAdjOffense: Double?
        let homeAdjDefense: Double?
        let awayAdjDefense: Double?
        let homeAdjPace: Double?
        let awayAdjPace: Double?
        let homeRanking: Int?
        let awayRanking: Int?
        let conferenceGame: Bool?
        let neutralSite: Bool?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case awayTeamId = "away_team_id"
            case homeTeamId = "home_team_id"
            case homeMl = "homeMoneyline"
            case awayMl = "awayMoneyline"
            case homeSpread = "spread"
            case overUnder = "over_under"
            case gameDateEt = "game_date_et"
            case tipoffTimeEt = "tipoff_time_et"
            case startUtc = "start_utc"
            case homeAdjOffense = "home_adj_offense"
            case awayAdjOffense = "away_adj_offense"
            case homeAdjDefense = "home_adj_defense"
            case awayAdjDefense = "away_adj_defense"
            case homeAdjPace = "home_adj_pace"
            case awayAdjPace = "away_adj_pace"
            case homeRanking = "home_ranking"
            case awayRanking = "away_ranking"
            case conferenceGame = "conference_game"
            case neutralSite = "neutral_site"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            guard let gameId = Self.flexInt(c, .gameId) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .gameId,
                    in: c,
                    debugDescription: "ncaab game_id missing"
                )
            }
            self.gameId = gameId
            awayTeam = try? c.decodeIfPresent(String.self, forKey: .awayTeam)
            homeTeam = try? c.decodeIfPresent(String.self, forKey: .homeTeam)
            awayTeamId = Self.flexInt(c, .awayTeamId)
            homeTeamId = Self.flexInt(c, .homeTeamId)
            homeMl = Self.flexInt(c, .homeMl)
            awayMl = Self.flexInt(c, .awayMl)
            homeSpread = Self.flexDouble(c, .homeSpread)
            overUnder = Self.flexDouble(c, .overUnder)
            gameDateEt = try? c.decodeIfPresent(String.self, forKey: .gameDateEt)
            tipoffTimeEt = try? c.decodeIfPresent(String.self, forKey: .tipoffTimeEt)
            startUtc = try? c.decodeIfPresent(String.self, forKey: .startUtc)
            homeAdjOffense = Self.flexDouble(c, .homeAdjOffense)
            awayAdjOffense = Self.flexDouble(c, .awayAdjOffense)
            homeAdjDefense = Self.flexDouble(c, .homeAdjDefense)
            awayAdjDefense = Self.flexDouble(c, .awayAdjDefense)
            homeAdjPace = Self.flexDouble(c, .homeAdjPace)
            awayAdjPace = Self.flexDouble(c, .awayAdjPace)
            homeRanking = Self.flexInt(c, .homeRanking)
            awayRanking = Self.flexInt(c, .awayRanking)
            conferenceGame = Self.flexBool(c, .conferenceGame)
            neutralSite = Self.flexBool(c, .neutralSite)
        }

        /// One bad cell used to fail the whole slate (`try?` then an empty board).
        private static func flexInt(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
            if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value }
            if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(value.rounded()) }
            if let value = try? c.decodeIfPresent(String.self, forKey: key) {
                if let int = Int(value) { return int }
                if let double = Double(value) { return Int(double.rounded()) }
            }
            return nil
        }

        private static func flexDouble(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
            if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return value }
            if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(value) }
            if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Double(value) }
            return nil
        }

        private static func flexBool(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Bool? {
            if let value = try? c.decodeIfPresent(Bool.self, forKey: key) { return value }
            if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value != 0 }
            if let value = try? c.decodeIfPresent(String.self, forKey: key) {
                switch value.lowercased() {
                case "true", "t", "1", "yes": return true
                case "false", "f", "0", "no": return false
                default: return nil
                }
            }
            return nil
        }
    }

    /// A single corrupt college row must not blank the board.
    private struct SoftNCAABRow: Decodable {
        let row: NCAABInputRow?
        init(from decoder: Decoder) throws {
            row = try? NCAABInputRow(from: decoder)
        }
    }

    private struct NCAABFlagCountRow: Decodable, Sendable {
        let gameId: Int?
        let signalKey: String?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case signalKey = "signal_key"
        }
    }

    private struct NCAABPredictionRow: Decodable, Sendable {
        let gameId: Int
        let runId: String?
        let asOfTsUtc: String?
        let homeAwayMlProb: Double?
        let homeAwaySpreadCoverProb: Double?
        let ouResultProb: Double?
        let homeWinProb: Double?
        let awayWinProb: Double?
        let predHomeMargin: Double?
        let predTotalPoints: Double?
        let homeScorePred: Double?
        let awayScorePred: Double?
        let modelFairHomeSpread: Double?
        let vegasHomeSpread: Double?
        let vegasTotal: Double?

        enum CodingKeys: String, CodingKey {
            case gameId = "game_id"
            case runId = "run_id"
            case asOfTsUtc = "as_of_ts_utc"
            case homeAwayMlProb = "home_away_ml_prob"
            case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
            case ouResultProb = "ou_result_prob"
            case homeWinProb = "home_win_prob"
            case awayWinProb = "away_win_prob"
            case predHomeMargin = "pred_home_margin"
            case predTotalPoints = "pred_total_points"
            case homeScorePred = "home_score_pred"
            case awayScorePred = "away_score_pred"
            case modelFairHomeSpread = "model_fair_home_spread"
            case vegasHomeSpread = "vegas_home_spread"
            case vegasTotal = "vegas_total"
        }
    }

    private struct NCAABMappingRow: Decodable, Sendable {
        let apiTeamId: Int
        let teamAbbrev: String?
        let espnTeamIdInt: Int?
        let espnTeamIdString: String?

        enum CodingKeys: String, CodingKey {
            case apiTeamId = "api_team_id"
            case teamAbbrev = "team_abbrev"
            case espnTeamId = "espn_team_id"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            apiTeamId = try c.decode(Int.self, forKey: .apiTeamId)
            teamAbbrev = try? c.decode(String.self, forKey: .teamAbbrev)
            if let n = try? c.decode(Int.self, forKey: .espnTeamId) {
                espnTeamIdInt = n
                espnTeamIdString = nil
            } else if let s = try? c.decode(String.self, forKey: .espnTeamId) {
                espnTeamIdInt = nil
                espnTeamIdString = s
            } else {
                espnTeamIdInt = nil
                espnTeamIdString = nil
            }
        }
    }

    private func fetchNCAAB() async throws {
        await CFBTeamsService.shared.ensureLoaded()
        await NCAABSchoolColorLoader.installIfNeeded()
        let cfb = await CFBSupabase.shared.client

        // Same window as the website: the opening slate before Sunday tip,
        // then today and tomorrow once the season is underway.
        let span = SportSeason.ncaabBoardSpan()
        let columns = "game_id,away_team,home_team,away_team_id,home_team_id,homeMoneyline,awayMoneyline,spread,over_under,game_date_et,tipoff_time_et,start_utc,home_adj_offense,away_adj_offense,home_adj_defense,away_adj_defense,home_adj_pace,away_adj_pace,home_ranking,away_ranking,conference_game,neutral_site"
        let wrapped: [SoftNCAABRow] = try await cfb
            .from("v_cbb_input_values")
            .select(columns)
            .gte("game_date_et", value: span.start)
            .lte("game_date_et", value: span.end)
            .order("game_date_et", ascending: true)
            .execute()
            .value
        let inputs = wrapped.compactMap(\.row)
        if inputs.isEmpty {
            games.ncaab = []
            ncaabSignalCountByGame = [:]
            storeRanks(.ncaab, [:])
            return
        }

        // Latest run only. Filtering by every game id in the season is a Bad Request,
        // and downloading every historical run is the slow path.
        struct NCAABRunRow: Decodable { let runId: String?; enum CodingKeys: String, CodingKey { case runId = "run_id" } }
        let latestRuns: [NCAABRunRow] = (try? await cfb
            .from("ncaab_predictions")
            .select("run_id")
            .order("as_of_ts_utc", ascending: false)
            .limit(1)
            .execute()
            .value) ?? []
        var predictionRows: [NCAABPredictionRow] = []
        if let runId = latestRuns.first?.runId, !runId.isEmpty {
            predictionRows = (try? await cfb
                .from("ncaab_predictions")
                .select("game_id, run_id, as_of_ts_utc, home_win_prob, away_win_prob, pred_home_margin, pred_total_points, home_score_pred, away_score_pred, model_fair_home_spread, vegas_home_spread, vegas_total")
                .eq("run_id", value: runId)
                .execute()
                .value) ?? []
        }
        var predictionMap: [Int: NCAABPredictionRow] = [:]
        for row in predictionRows {
            predictionMap[row.gameId] = row
        }

        // Step 3: team mapping (logos + abbreviations).
        let mappingRows: [NCAABMappingRow] = (try? await cfb
            .from("ncaab_team_mapping")
            .select("api_team_id, team_abbrev, espn_team_id")
            .execute()
            .value) ?? []
        var mappingMap: [Int: (abbrev: String?, logo: String?)] = [:]
        for row in mappingRows {
            let espnId: Int? = {
                if let n = row.espnTeamIdInt { return n }
                if let s = row.espnTeamIdString, let parsed = Int(s) { return parsed }
                return nil
            }()
            let logo: String? = {
                guard let espnId else { return nil }
                return "https://a.espncdn.com/i/teamlogos/ncaa/500/\(espnId).png"
            }()
            mappingMap[row.apiTeamId] = (row.teamAbbrev, logo)
        }
        var logosByName: [String: String] = [:]
        var abbrevsByName: [String: String] = [:]
        for row in inputs {
            if let id = row.awayTeamId {
                rememberNCAABIdentity(
                    name: row.awayTeam,
                    mapped: mappingMap[id],
                    logos: &logosByName,
                    abbrevs: &abbrevsByName
                )
            }
            if let id = row.homeTeamId {
                rememberNCAABIdentity(
                    name: row.homeTeam,
                    mapped: mappingMap[id],
                    logos: &logosByName,
                    abbrevs: &abbrevsByName
                )
            }
        }
        NCAABTeamAssets.install(logosByName)
        NCAABTeamAssets.installAbbrevs(abbrevsByName)

        let dates = Array(Set(inputs.compactMap { row -> String? in
            guard let raw = row.gameDateEt, raw.count >= 10 else { return nil }
            return String(raw.prefix(10))
        }))
        let flagRows: [NCAABFlagCountRow] = dates.isEmpty ? [] : ((try? await cfb
            .from("ncaab_slate_flags")
            .select("game_id, signal_key")
            .in("game_date", values: dates)
            .execute()
            .value) ?? [])
        var keysByGame: [Int: Set<String>] = [:]
        for flag in flagRows {
            guard let gameId = flag.gameId, let key = flag.signalKey, !key.isEmpty else { continue }
            keysByGame[gameId, default: []].insert(key)
        }
        ncaabSignalCountByGame = keysByGame.mapValues { $0.count }
        storeRanks(.ncaab, await ncaabSignalRanks(cfb, keysByGame: keysByGame))

        // Step 4: merge.
        games.ncaab = inputs.map { row in
            let pred = predictionMap[row.gameId]
            let awayMap = row.awayTeamId.flatMap { mappingMap[$0] }
            let homeMap = row.homeTeamId.flatMap { mappingMap[$0] }
            let spread = row.homeSpread ?? pred?.vegasHomeSpread
            return NCAABGame(
                id: String(row.gameId),
                gameId: row.gameId,
                awayTeam: row.awayTeam ?? "",
                homeTeam: row.homeTeam ?? "",
                homeMl: row.homeMl,
                awayMl: row.awayMl,
                homeSpread: spread,
                awaySpread: spread.map { -$0 },
                overLine: row.overUnder ?? pred?.vegasTotal,
                gameDate: row.gameDateEt ?? "",
                gameTime: row.startUtc ?? row.tipoffTimeEt ?? "",
                trainingKey: String(row.gameId),
                uniqueId: String(row.gameId),
                homeAdjOffense: row.homeAdjOffense,
                awayAdjOffense: row.awayAdjOffense,
                homeAdjDefense: row.homeAdjDefense,
                awayAdjDefense: row.awayAdjDefense,
                homeAdjPace: row.homeAdjPace,
                awayAdjPace: row.awayAdjPace,
                homeRanking: row.homeRanking,
                awayRanking: row.awayRanking,
                conferenceGame: row.conferenceGame,
                neutralSite: row.neutralSite,
                // `home_win_prob` is the only win probability the table
                // publishes; the `home_away_*` names below are legacy and
                // decode to nil on every row.
                homeAwayMlProb: pred?.homeAwayMlProb ?? pred?.homeWinProb,
                homeAwaySpreadCoverProb: pred?.homeAwaySpreadCoverProb,
                ouResultProb: pred?.ouResultProb,
                predHomeMargin: pred?.predHomeMargin,
                predTotalPoints: pred?.predTotalPoints,
                runId: pred?.runId,
                homeScorePred: pred?.homeScorePred,
                awayScorePred: pred?.awayScorePred,
                modelFairHomeSpread: pred?.modelFairHomeSpread,
                homeTeamLogo: homeMap?.logo,
                awayTeamLogo: awayMap?.logo,
                homeTeamAbbrev: homeMap?.abbrev,
                awayTeamAbbrev: awayMap?.abbrev
            )
        }
    }

    private func rememberNCAABIdentity(
        name: String?,
        mapped: (abbrev: String?, logo: String?)?,
        logos: inout [String: String],
        abbrevs: inout [String: String]
    ) {
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let abbrev = mapped?.abbrev?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let logo = mapped?.logo, !logo.isEmpty {
            if !trimmed.isEmpty { logos[trimmed] = logo }
            if !abbrev.isEmpty { logos[abbrev] = logo }
        }
        if !abbrev.isEmpty {
            if !trimmed.isEmpty { abbrevs[trimmed] = abbrev }
            abbrevs[abbrev] = abbrev
        }
    }

    // MARK: - MLB fetch
    //
    // Ports the real `fetchMLBData()` flow from RN
    // `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx`. Four queries:
    //   1. mlb_games_today.select('*').gte/lte('official_date', today/+1d)
    //   2. mlb_predictions_current.select('*') for all game_pks above
    //   3. mlb_team_mapping.select('*') for abbreviation + logo url
    //   4. mlb_game_signals.select('*') for per-team / per-game signal pills
    //
    // Merge: predictions override game-today fields, mapping fills
    // away_abbr/home_abbr/logos (fallback to MLBTeams static map when the
    // mapping table can't resolve the team), signals attach to
    // MLBGame.signals in game → home → away order.

    private struct MLBGamesTodayRow: Decodable, Sendable {
        let gamePk: Int?
        let officialDate: String?
        let gameTimeEt: String?
        let awayTeamName: String?
        let homeTeamName: String?
        let awayTeam: String?
        let homeTeam: String?
        let awayTeamFullName: String?
        let homeTeamFullName: String?
        let awayTeamId: Int?
        let homeTeamId: Int?
        let status: String?
        let isPostponed: Bool?
        let isCompleted: Bool?
        let isActive: Bool?
        let awayMl: Int?
        let homeMl: Int?
        let awaySpread: Double?
        let homeSpread: Double?
        let totalLine: Double?
        let homeSpName: String?
        let awaySpName: String?
        let homeSpConfirmed: Bool?
        let awaySpConfirmed: Bool?
        let weatherConfirmed: Bool?
        let weatherImputed: Bool?
        let temperatureF: Double?
        let windSpeedMph: Double?
        let windDirection: String?
        let sky: String?
        let venueName: String?

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case officialDate = "official_date"
            case gameTimeEt = "game_time_et"
            case awayTeamName = "away_team_name"
            case homeTeamName = "home_team_name"
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case awayTeamFullName = "away_team_full_name"
            case homeTeamFullName = "home_team_full_name"
            case awayTeamId = "away_team_id"
            case homeTeamId = "home_team_id"
            case status
            case isPostponed = "is_postponed"
            case isCompleted = "is_completed"
            case isActive = "is_active"
            case awayMl = "away_ml"
            case homeMl = "home_ml"
            case awaySpread = "away_spread"
            case homeSpread = "home_spread"
            case totalLine = "total_line"
            case homeSpName = "home_sp_name"
            case awaySpName = "away_sp_name"
            case homeSpConfirmed = "home_sp_confirmed"
            case awaySpConfirmed = "away_sp_confirmed"
            case weatherConfirmed = "weather_confirmed"
            case weatherImputed = "weather_imputed"
            case temperatureF = "temperature_f"
            case windSpeedMph = "wind_speed_mph"
            case windDirection = "wind_direction"
            case sky
            case venueName = "venue_name"
        }
    }

    private struct MLBPredictionsCurrentRow: Decodable, Sendable {
        let gamePk: Int?
        let mlHomeWinProb: Double?
        let mlAwayWinProb: Double?
        let homeImpliedProb: Double?
        let awayImpliedProb: Double?
        let homeMlEdgePct: Double?
        let awayMlEdgePct: Double?
        let homeMlStrongSignal: Bool?
        let awayMlStrongSignal: Bool?
        let ouEdge: Double?
        let ouDirection: String?
        let ouFairTotal: Double?
        let ouStrongSignal: Bool?
        let ouModerateSignal: Bool?
        let f5HomeMl: Int?
        let f5AwayMl: Int?
        let f5FairTotal: Double?
        let f5PredMargin: Double?
        let f5TotalLine: Double?
        let f5HomeSpread: Double?
        let f5AwaySpread: Double?
        let f5OuEdge: Double?
        let f5HomeWinProb: Double?
        let f5AwayWinProb: Double?
        let f5HomeImpliedProb: Double?
        let f5AwayImpliedProb: Double?
        let f5HomeMlEdgePct: Double?
        let f5AwayMlEdgePct: Double?
        let f5HomeMlStrongSignal: Bool?
        let f5AwayMlStrongSignal: Bool?
        let isFinalPrediction: Bool?
        let projectionLabel: String?

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case mlHomeWinProb = "ml_home_win_prob"
            case mlAwayWinProb = "ml_away_win_prob"
            case homeImpliedProb = "home_implied_prob"
            case awayImpliedProb = "away_implied_prob"
            case homeMlEdgePct = "home_ml_edge_pct"
            case awayMlEdgePct = "away_ml_edge_pct"
            case homeMlStrongSignal = "home_ml_strong_signal"
            case awayMlStrongSignal = "away_ml_strong_signal"
            case ouEdge = "ou_edge"
            case ouDirection = "ou_direction"
            case ouFairTotal = "ou_fair_total"
            case ouStrongSignal = "ou_strong_signal"
            case ouModerateSignal = "ou_moderate_signal"
            case f5HomeMl = "f5_home_ml"
            case f5AwayMl = "f5_away_ml"
            case f5FairTotal = "f5_fair_total"
            case f5PredMargin = "f5_pred_margin"
            case f5TotalLine = "f5_total_line"
            case f5HomeSpread = "f5_home_spread"
            case f5AwaySpread = "f5_away_spread"
            case f5OuEdge = "f5_ou_edge"
            case f5HomeWinProb = "f5_home_win_prob"
            case f5AwayWinProb = "f5_away_win_prob"
            case f5HomeImpliedProb = "f5_home_implied_prob"
            case f5AwayImpliedProb = "f5_away_implied_prob"
            case f5HomeMlEdgePct = "f5_home_ml_edge_pct"
            case f5AwayMlEdgePct = "f5_away_ml_edge_pct"
            case f5HomeMlStrongSignal = "f5_home_ml_strong_signal"
            case f5AwayMlStrongSignal = "f5_away_ml_strong_signal"
            case isFinalPrediction = "is_final_prediction"
            case projectionLabel = "projection_label"
        }
    }

    /// PostgREST returns per-team signal payloads as JSON arrays of objects
    /// (jsonb columns) — we decode them into a flat list of `MLBSignalItem`s.
    private struct MLBSignalsRow: Decodable, Sendable {
        let gamePk: Int?
        let homeSignals: [MLBSignalItem]
        let awaySignals: [MLBSignalItem]
        let gameSignals: [MLBSignalItem]

        enum CodingKeys: String, CodingKey {
            case gamePk = "game_pk"
            case homeSignals = "home_signals"
            case awaySignals = "away_signals"
            case gameSignals = "game_signals"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.gamePk = MLBSignalsRow.decodeGamePk(from: c)
            self.homeSignals = MLBSignalsRow.decode(from: c, key: .homeSignals)
            self.awaySignals = MLBSignalsRow.decode(from: c, key: .awaySignals)
            self.gameSignals = MLBSignalsRow.decode(from: c, key: .gameSignals)
        }

        private static func decodeGamePk(from c: KeyedDecodingContainer<CodingKeys>) -> Int? {
            if let value = try? c.decodeIfPresent(Int.self, forKey: .gamePk) {
                return value
            }
            if let value = try? c.decodeIfPresent(Double.self, forKey: .gamePk), value.isFinite {
                return Int(value.rounded(.towardZero))
            }
            if let value = try? c.decodeIfPresent(String.self, forKey: .gamePk),
               let parsed = Double(value.trimmingCharacters(in: .whitespacesAndNewlines)),
               parsed.isFinite {
                return Int(parsed.rounded(.towardZero))
            }
            return nil
        }

        private static func decode(
            from c: KeyedDecodingContainer<CodingKeys>,
            key: CodingKeys
        ) -> [MLBSignalItem] {
            if let arr = try? c.decode([SignalPayloadItem].self, forKey: key) {
                return arr.compactMap { $0.asSignal }
            }
            // The live view stores these as text[] where each entry is a JSON
            // object string; web/RN parse each entry individually.
            if let arr = try? c.decode([String].self, forKey: key) {
                return arr.compactMap { SignalPayloadItem.parseJSONString($0)?.asSignal }
            }
            if let s = try? c.decode(String.self, forKey: key),
               let data = s.data(using: .utf8),
               let arr = try? JSONDecoder().decode([SignalPayloadItem].self, from: data) {
                return arr.compactMap { $0.asSignal }
            }
            return []
        }
    }

    private struct SignalPayloadItem: Decodable, Sendable {
        let category: String?
        let severity: String?
        let message: String?

        enum CodingKeys: String, CodingKey {
            case category, Category, type
            case severity, Severity, level
            case message, Message, text, body, summary
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            // Split chained `??` decodes so the Swift type-checker doesn't
            // time out (it can't infer 5-arm `??` over `String??` quickly).
            var cat: String? = try? c.decode(String.self, forKey: .category)
            if cat == nil { cat = try? c.decode(String.self, forKey: .Category) }
            if cat == nil { cat = try? c.decode(String.self, forKey: .type) }
            self.category = cat

            var sev: String? = try? c.decode(String.self, forKey: .severity)
            if sev == nil { sev = try? c.decode(String.self, forKey: .Severity) }
            if sev == nil { sev = try? c.decode(String.self, forKey: .level) }
            self.severity = sev

            var msg: String? = try? c.decode(String.self, forKey: .message)
            if msg == nil { msg = try? c.decode(String.self, forKey: .Message) }
            if msg == nil { msg = try? c.decode(String.self, forKey: .text) }
            if msg == nil { msg = try? c.decode(String.self, forKey: .body) }
            if msg == nil { msg = try? c.decode(String.self, forKey: .summary) }
            self.message = msg
        }

        var asSignal: MLBSignalItem? {
            guard let m = message, !m.isEmpty else { return nil }
            return MLBSignalItem(category: category ?? "", severity: severity ?? "", message: m)
        }

        static func parseJSONString(_ raw: String) -> SignalPayloadItem? {
            guard let data = raw.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode(SignalPayloadItem.self, from: data)
        }
    }

    private func fetchMLB() async throws {
        let cfb = await CFBSupabase.shared.client
        let today = Date()
        let cal = Calendar(identifier: .gregorian)
        guard let dayAfter = cal.date(byAdding: .day, value: 2, to: today) else { return }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        let startDate = fmt.string(from: today)
        let endDate = fmt.string(from: dayAfter)

        // Step 1: games today (today + 1 day window — matches RN).
        let gamesRows: [MLBGamesTodayRow] = (try? await cfb
            .from("mlb_games_today")
            .select()
            .gte("official_date", value: startDate)
            .lte("official_date", value: endDate)
            .execute()
            .value) ?? []
        if gamesRows.isEmpty {
            games.mlb = []
            storeRanks(.mlb, [:])
            return
        }
        let pks = gamesRows.compactMap { $0.gamePk }

        // Step 2: predictions (model probs / edges / signals — full + F5).
        let predRows: [MLBPredictionsCurrentRow] = (try? await cfb
            .from("mlb_predictions_current")
            .select()
            .in("game_pk", values: pks)
            .execute()
            .value) ?? []
        let predsByPk: [Int: MLBPredictionsCurrentRow] = Dictionary(
            predRows.compactMap { row in row.gamePk.map { ($0, row) } },
            uniquingKeysWith: { a, _ in a }
        )

        // Step 3: team mapping for abbreviations + logos.
        let mappingRows: [MLBTeamMapping] = (try? await cfb
            .from("mlb_team_mapping")
            .select()
            .execute()
            .value) ?? []
        let mappingByName: [String: MLBTeamMapping] = Dictionary(
            mappingRows.map { (MLBTeams.normalize($0.teamName), $0) },
            uniquingKeysWith: { a, _ in a }
        )
        let mappingById: [Int: MLBTeamMapping] = Dictionary(
            mappingRows.map { ($0.mlbApiId, $0) },
            uniquingKeysWith: { a, _ in a }
        )

        // Step 4: signals.
        let signalsRows: [MLBSignalsRow] = (try? await cfb
            .from("mlb_game_signals")
            .select()
            .execute()
            .value) ?? []
        let signalsByPk: [Int: MLBSignalsRow] = Dictionary(
            signalsRows.compactMap { row in row.gamePk.map { ($0, row) } },
            uniquingKeysWith: { a, _ in a }
        )

        // Step 5: merge.
        let merged: [MLBGame] = gamesRows.compactMap { row in
            guard let pk = row.gamePk else { return nil }
            let pred = predsByPk[pk]
            let signalsRow = signalsByPk[pk]

            let awayName = row.awayTeamName ?? row.awayTeam ?? ""
            let homeName = row.homeTeamName ?? row.homeTeam ?? ""

            // Resolve mapping by mlb_api_id first, then normalized name.
            let awayMapping = row.awayTeamId.flatMap { mappingById[$0] }
                ?? mappingByName[MLBTeams.normalize(awayName)]
            let homeMapping = row.homeTeamId.flatMap { mappingById[$0] }
                ?? mappingByName[MLBTeams.normalize(homeName)]

            // Static fallback when the mapping table can't resolve the team.
            let awayFallback = MLBTeams.info(for: awayName)
            let homeFallback = MLBTeams.info(for: homeName)

            let awayAbbr = awayMapping?.team
                ?? awayFallback?.team
                ?? GamesStore.fallbackMLBAbbrev(from: awayName)
            let homeAbbr = homeMapping?.team
                ?? homeFallback?.team
                ?? GamesStore.fallbackMLBAbbrev(from: homeName)

            // Combine signals in spec order: game → home → away.
            var combined: [MLBSignalItem] = []
            if let s = signalsRow {
                combined.append(contentsOf: s.gameSignals)
                combined.append(contentsOf: s.homeSignals)
                combined.append(contentsOf: s.awaySignals)
            }

            return MLBGame(
                id: String(pk),
                gamePk: pk,
                officialDate: row.officialDate ?? "",
                gameTimeEt: row.gameTimeEt,
                awayTeamName: row.awayTeamName,
                homeTeamName: row.homeTeamName,
                awayTeam: row.awayTeam,
                homeTeam: row.homeTeam,
                awayTeamFullName: row.awayTeamFullName,
                homeTeamFullName: row.homeTeamFullName,
                awayTeamId: row.awayTeamId,
                homeTeamId: row.homeTeamId,
                awayAbbr: awayAbbr,
                homeAbbr: homeAbbr,
                awayLogoUrl: awayMapping?.logoUrl ?? awayFallback?.logoUrl,
                homeLogoUrl: homeMapping?.logoUrl ?? homeFallback?.logoUrl,
                status: row.status,
                isPostponed: row.isPostponed,
                isCompleted: row.isCompleted,
                isActive: row.isActive,
                awayMl: row.awayMl,
                homeMl: row.homeMl,
                awaySpread: row.awaySpread,
                homeSpread: row.homeSpread,
                totalLine: row.totalLine,
                mlHomeWinProb: pred?.mlHomeWinProb,
                mlAwayWinProb: pred?.mlAwayWinProb,
                homeImpliedProb: pred?.homeImpliedProb,
                awayImpliedProb: pred?.awayImpliedProb,
                homeMlEdgePct: pred?.homeMlEdgePct,
                awayMlEdgePct: pred?.awayMlEdgePct,
                homeMlStrongSignal: pred?.homeMlStrongSignal,
                awayMlStrongSignal: pred?.awayMlStrongSignal,
                ouEdge: pred?.ouEdge,
                ouDirection: pred?.ouDirection,
                ouFairTotal: pred?.ouFairTotal,
                ouStrongSignal: pred?.ouStrongSignal,
                ouModerateSignal: pred?.ouModerateSignal,
                f5HomeMl: pred?.f5HomeMl,
                f5AwayMl: pred?.f5AwayMl,
                f5FairTotal: pred?.f5FairTotal,
                f5PredMargin: pred?.f5PredMargin,
                f5TotalLine: pred?.f5TotalLine,
                f5HomeSpread: pred?.f5HomeSpread,
                f5AwaySpread: pred?.f5AwaySpread,
                f5OuEdge: pred?.f5OuEdge,
                f5HomeWinProb: pred?.f5HomeWinProb,
                f5AwayWinProb: pred?.f5AwayWinProb,
                f5HomeImpliedProb: pred?.f5HomeImpliedProb,
                f5AwayImpliedProb: pred?.f5AwayImpliedProb,
                f5HomeMlEdgePct: pred?.f5HomeMlEdgePct,
                f5AwayMlEdgePct: pred?.f5AwayMlEdgePct,
                f5HomeMlStrongSignal: pred?.f5HomeMlStrongSignal,
                f5AwayMlStrongSignal: pred?.f5AwayMlStrongSignal,
                homeSpName: row.homeSpName,
                awaySpName: row.awaySpName,
                homeSpConfirmed: row.homeSpConfirmed,
                awaySpConfirmed: row.awaySpConfirmed,
                isFinalPrediction: pred?.isFinalPrediction,
                projectionLabel: pred?.projectionLabel,
                weatherConfirmed: row.weatherConfirmed,
                weatherImputed: row.weatherImputed,
                temperatureF: row.temperatureF,
                windSpeedMph: row.windSpeedMph,
                windDirection: row.windDirection,
                sky: row.sky,
                venueName: row.venueName,
                signals: combined
            )
        }

        games.mlb = merged
        storeRanks(.mlb, Dictionary(uniqueKeysWithValues: merged.map {
            ($0.id, SignalBoardRank(bestRoi: nil, count: $0.signals.count))
        }))
    }

    private static func fallbackMLBAbbrev(from teamName: String) -> String {
        let trimmed = teamName.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "MLB" }
        return trimmed.split(separator: " ")
            .compactMap { $0.first }
            .prefix(3)
            .map { String($0).uppercased() }
            .joined()
    }

    // MARK: - Debug helpers (screenshot harness)

    #if DEBUG
    /// Load a captured real slate for Dummy Data Mode. NFL/NCAAB are fully
    /// real; NBA uses real teams + model-fair lines; CFB is a hand-built
    /// realistic slate (no historical source offseason). MLB is excluded — it
    /// stays on the live path in `refresh`.
    private func loadDummy(sport: Sport) {
        switch sport {
        case .nfl: games.nfl = DummyData.nfl
        case .cfb: games.cfb = DummyData.cfb
        case .nba: games.nba = DummyData.nba
        case .ncaab: games.ncaab = DummyData.ncaab
        case .mlb: break
        }
        markFeedChanged(sport)
        loadState[sport] = .loaded
        lastFetched[sport] = Date()
    }

    public func debugSet(
        nfl: [NFLPrediction] = [],
        cfb: [CFBPrediction] = [],
        nba: [NBAGame] = [],
        ncaab: [NCAABGame] = [],
        mlb: [MLBGame] = [],
        sport: Sport = .mlb,
        state: LoadState = .loaded
    ) {
        var feed = SportFeed()
        feed.nfl = nfl
        feed.cfb = cfb
        feed.nba = nba
        feed.ncaab = ncaab
        feed.mlb = mlb
        self.games = feed
        for sport in Sport.allCases {
            markFeedChanged(sport)
        }
        self.selectedSport = sport
        for s in Sport.allCases {
            self.loadState[s] = state
            self.lastFetched[s] = (state == .loaded) ? Date() : nil
        }
    }
    #endif
}

/// One ESPN men's college basketball team list. Schools that are not in
/// `cfb_teams` still get a real `color` / `alternateColor`, cached beside the logo.
private enum NCAABSchoolColorLoader {
    private static var didLoad = false

    static func installIfNeeded() async {
        if didLoad { return }
        guard let url = URL(string: "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=400") else { return }
        guard let (data, response) = try? await URLSession.shared.data(from: url),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let payload = try? JSONDecoder().decode(Payload.self, from: data)
        else { return }
        didLoad = true
        var map: [String: NCAABSchoolColor] = [:]
        for wrapper in payload.sports.flatMap(\.leagues).flatMap(\.teams) {
            let team = wrapper.team
            guard let color = team.color?.trimmingCharacters(in: .whitespacesAndNewlines), !color.isEmpty else { continue }
            let alt = team.alternateColor?.trimmingCharacters(in: .whitespacesAndNewlines)
            let pair = NCAABSchoolColor(primary: color, secondary: (alt?.isEmpty == false ? alt! : color))
            let keys = [team.displayName, team.location, team.name, team.abbreviation]
            for raw in keys {
                guard let raw else { continue }
                let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if !key.isEmpty { map[key] = pair }
            }
            if let location = team.location, let name = team.name {
                let combined = "\(location) \(name)".trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if !combined.isEmpty { map[combined] = pair }
            }
        }
        await MainActor.run { NCAABTeamAssets.installColors(map) }
    }

    private struct Payload: Decodable {
        var sports: [Sport] = []
    }

    private struct Sport: Decodable {
        var leagues: [League] = []
    }

    private struct League: Decodable {
        var teams: [Wrapper] = []
    }

    private struct Wrapper: Decodable {
        var team: Team
    }

    private struct Team: Decodable {
        var displayName: String?
        var abbreviation: String?
        var location: String?
        var name: String?
        var color: String?
        var alternateColor: String?
    }
}
