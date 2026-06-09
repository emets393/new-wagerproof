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
/// + `production_weather`. CFB is a 2-way merge of `cfb_live_weekly_inputs`
/// + `cfb_api_predictions`. NCAAB ported in B11 — a 3-way merge of
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
    }

    public enum SortMode: String, Hashable, Sendable {
        case time, spread, ou
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
    public private(set) var loadState: [Sport: LoadState] = Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, .idle) })
    public private(set) var lastFetched: [Sport: Date] = [:]

    /// Currently-selected sport. Mirrors RN `useState<Sport>('mlb')`.
    public var selectedSport: Sport = .mlb
    /// Per-sport sort mode. Mirrors RN `sortModes` record.
    public var sortModes: [Sport: SortMode] = Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, .time) })
    /// Per-sport search text. Mirrors RN `searchTexts` record.
    public var searchTexts: [Sport: String] = Dictionary(uniqueKeysWithValues: Sport.allCases.map { ($0, "") })

    private let cacheTTL: TimeInterval = 5 * 60

    public init() {}

    public func nflGames() -> [NFLPrediction] { games.nfl }
    public func cfbGames() -> [CFBPrediction] { games.cfb }
    public func mlbGames() -> [MLBGame] { games.mlb }

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
        // MLB is in-season (live data works), so it's left on the real path.
        if DummyDataMode.isEnabled, sport != .mlb {
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
        loadState[sport] = .loading
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
        let q = (searchTexts[.nfl] ?? "").lowercased()
        let filtered = q.isEmpty ? games.nfl : games.nfl.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        return sortNFL(filtered, mode: sortModes[.nfl] ?? .time)
    }

    public func sortedCFB() -> [CFBPrediction] {
        let q = (searchTexts[.cfb] ?? "").lowercased()
        let filtered = q.isEmpty ? games.cfb : games.cfb.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        return sortCFB(filtered, mode: sortModes[.cfb] ?? .time)
    }

    /// Filtered + sorted NBA list. Mirrors RN search/sort behavior:
    /// confidence-based ordering for `.spread` / `.ou` and tipoff time for
    /// `.time`.
    public func sortedNBA() -> [NBAGame] {
        let q = (searchTexts[.nba] ?? "").lowercased()
        let filtered = q.isEmpty ? games.nba : games.nba.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        return sortNBA(filtered, mode: sortModes[.nba] ?? .time)
    }

    private func sortNBA(_ list: [NBAGame], mode: SortMode) -> [NBAGame] {
        switch mode {
        case .time:
            return list.sorted { a, b in
                if !a.gameTime.isEmpty, !b.gameTime.isEmpty {
                    return a.gameTime < b.gameTime
                }
                return a.gameDate < b.gameDate
            }
        case .spread:
            return list.sorted { a, b in
                Self.confidence(a.homeAwaySpreadCoverProb) > Self.confidence(b.homeAwaySpreadCoverProb)
            }
        case .ou:
            return list.sorted { a, b in
                Self.confidence(a.ouResultProb) > Self.confidence(b.ouResultProb)
            }
        }
    }

    /// Filtered + sorted NCAAB list. Mirrors NBA's behavior — NCAAB carries
    /// the same `home_away_spread_cover_prob` / `ou_result_prob` triplet
    /// from `ncaab_predictions`, so the same confidence-based ordering rules
    /// apply for `.spread` / `.ou`.
    public func sortedNCAAB() -> [NCAABGame] {
        let q = (searchTexts[.ncaab] ?? "").lowercased()
        let filtered = q.isEmpty ? games.ncaab : games.ncaab.filter { game in
            game.homeTeam.lowercased().contains(q) || game.awayTeam.lowercased().contains(q)
        }
        return sortNCAAB(filtered, mode: sortModes[.ncaab] ?? .time)
    }

    private func sortNCAAB(_ list: [NCAABGame], mode: SortMode) -> [NCAABGame] {
        switch mode {
        case .time:
            return list.sorted { a, b in
                if !a.gameTime.isEmpty, !b.gameTime.isEmpty {
                    return a.gameTime < b.gameTime
                }
                return a.gameDate < b.gameDate
            }
        case .spread:
            return list.sorted { a, b in
                Self.confidence(a.homeAwaySpreadCoverProb) > Self.confidence(b.homeAwaySpreadCoverProb)
            }
        case .ou:
            return list.sorted { a, b in
                Self.confidence(a.ouResultProb) > Self.confidence(b.ouResultProb)
            }
        }
    }

    public func sortedMLB() -> [MLBGame] {
        let q = (searchTexts[.mlb] ?? "").lowercased()
        let filtered = q.isEmpty ? games.mlb : games.mlb.filter { game in
            (game.homeTeamName ?? "").lowercased().contains(q) ||
                (game.awayTeamName ?? "").lowercased().contains(q) ||
                game.homeAbbr.lowercased().contains(q) ||
                game.awayAbbr.lowercased().contains(q)
        }
        return sortMLB(filtered, mode: sortModes[.mlb] ?? .time)
    }

    /// Sort MLB games. `time` sorts by `game_time_et` ascending (RN
    /// default); `spread` falls back to ML edge magnitude; `ou` uses the
    /// fair-vs-line delta.
    private func sortMLB(_ list: [MLBGame], mode: SortMode) -> [MLBGame] {
        switch mode {
        case .time:
            return list.sorted { a, b in
                (Self.parseEpoch(a.gameTimeEt ?? a.officialDate) ?? .greatestFiniteMagnitude) <
                    (Self.parseEpoch(b.gameTimeEt ?? b.officialDate) ?? .greatestFiniteMagnitude)
            }
        case .spread:
            return list.sorted { a, b in
                let ea = max(abs(a.homeMlEdgePct ?? 0), abs(a.awayMlEdgePct ?? 0))
                let eb = max(abs(b.homeMlEdgePct ?? 0), abs(b.awayMlEdgePct ?? 0))
                return ea > eb
            }
        case .ou:
            return list.sorted { a, b in
                abs(a.ouEdge ?? 0) > abs(b.ouEdge ?? 0)
            }
        }
    }

    private func sortNFL(_ list: [NFLPrediction], mode: SortMode) -> [NFLPrediction] {
        switch mode {
        case .time:
            return list.sorted { a, b in
                (Self.parseEpoch(a.gameDate) ?? .greatestFiniteMagnitude) <
                    (Self.parseEpoch(b.gameDate) ?? .greatestFiniteMagnitude)
            }
        case .spread:
            // RN uses confidence-based sorting for NFL.
            return list.sorted { a, b in
                Self.confidence(a.homeAwaySpreadCoverProb) > Self.confidence(b.homeAwaySpreadCoverProb)
            }
        case .ou:
            return list.sorted { a, b in
                Self.confidence(a.ouResultProb) > Self.confidence(b.ouResultProb)
            }
        }
    }

    private func sortCFB(_ list: [CFBPrediction], mode: SortMode) -> [CFBPrediction] {
        switch mode {
        case .time:
            return list.sorted { a, b in
                (Self.parseEpoch(a.gameDate) ?? .greatestFiniteMagnitude) <
                    (Self.parseEpoch(b.gameDate) ?? .greatestFiniteMagnitude)
            }
        case .spread:
            // CFB uses edge-based sorting (home_spread_diff).
            return list.sorted { a, b in
                abs(a.homeSpreadDiff ?? 0) > abs(b.homeSpreadDiff ?? 0)
            }
        case .ou:
            return list.sorted { a, b in
                abs(a.overLineDiff ?? 0) > abs(b.overLineDiff ?? 0)
            }
        }
    }

    private static func confidence(_ prob: Double?) -> Double {
        guard let p = prob else { return 0 }
        return max(p, 1 - p)
    }

    private static func parseEpoch(_ raw: String) -> Double? {
        if raw.isEmpty { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return d.timeIntervalSince1970 }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d.timeIntervalSince1970 }
        let formats = ["yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd"]
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        for f in formats {
            fmt.dateFormat = f
            if let d = fmt.date(from: raw) { return d.timeIntervalSince1970 }
        }
        return nil
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

    private func fetchNFL() async throws {
        let cfb = await CFBSupabase.shared.client

        // Step 1: input view (no filters — matches RN exactly).
        let viewRows: [NFLViewRow] = try await cfb
            .from("v_input_values_with_epa")
            .select()
            .execute()
            .value

        if viewRows.isEmpty {
            games.nfl = []
            return
        }

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
    }

    // MARK: - CFB fetch
    //
    // Mirrors RN `fetchCFBData()` in index.tsx:330-397. Two queries:
    //   1. cfb_live_weekly_inputs (all rows)
    //   2. cfb_api_predictions (all rows; matched by id)
    // Merge: for each input, find a prediction with matching id.

    private struct CFBInputRow: Decodable, Sendable {
        let id: Int
        let awayTeam: String?
        let homeTeam: String?
        let homeMoneyline: Int?
        let awayMoneyline: Int?
        let homeMl: Int?
        let awayMl: Int?
        let apiSpread: Double?
        let homeSpread: Double?
        let awaySpread: Double?
        let apiOverLine: Double?
        let totalLine: Double?
        let spread: Double?
        let startTime: String?
        let startDate: String?
        let gameDate: String?
        let gameTime: String?
        let trainingKey: String?
        let uniqueId: String?
        let runId: String?
        let predMlProba: Double?
        let predSpreadProba: Double?
        let predTotalProba: Double?
        let homeAwayMlProb: Double?
        let homeAwaySpreadCoverProb: Double?
        let ouResultProb: Double?
        let weatherTempF: Double?
        let temperature: Double?
        let precipitation: Double?
        let weatherWindspeedMph: Double?
        let windSpeed: Double?
        let weatherIconText: String?
        let icon: String?
        let spreadSplitsLabel: String?
        let totalSplitsLabel: String?
        let mlSplitsLabel: String?
        let conference: String?
        let predAwayScore: Double?
        let predHomeScore: Double?

        enum CodingKeys: String, CodingKey {
            case id
            case awayTeam = "away_team"
            case homeTeam = "home_team"
            case homeMoneyline = "home_moneyline"
            case awayMoneyline = "away_moneyline"
            case homeMl = "home_ml"
            case awayMl = "away_ml"
            case apiSpread = "api_spread"
            case homeSpread = "home_spread"
            case awaySpread = "away_spread"
            case apiOverLine = "api_over_line"
            case totalLine = "total_line"
            case spread
            case startTime = "start_time"
            case startDate = "start_date"
            case gameDate = "game_date"
            case gameTime = "game_time"
            case trainingKey = "training_key"
            case uniqueId = "unique_id"
            case runId = "run_id"
            case predMlProba = "pred_ml_proba"
            case predSpreadProba = "pred_spread_proba"
            case predTotalProba = "pred_total_proba"
            case homeAwayMlProb = "home_away_ml_prob"
            case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
            case ouResultProb = "ou_result_prob"
            case weatherTempF = "weather_temp_f"
            case temperature
            case precipitation
            case weatherWindspeedMph = "weather_windspeed_mph"
            case windSpeed = "wind_speed"
            case weatherIconText = "weather_icon_text"
            case icon
            case spreadSplitsLabel = "spread_splits_label"
            case totalSplitsLabel = "total_splits_label"
            case mlSplitsLabel = "ml_splits_label"
            case conference
            case predAwayScore = "pred_away_score"
            case predHomeScore = "pred_home_score"
        }
    }

    private struct CFBAPIRow: Decodable, Sendable {
        let id: Int
        let predAwayScore: Double?
        let predHomeScore: Double?
        let predAwayPoints: Double?
        let predHomePoints: Double?
        let awayPoints: Double?
        let homePoints: Double?
        let predSpread: Double?
        let runLinePrediction: Double?
        let spreadPrediction: Double?
        let homeSpreadDiff: Double?
        let spreadDiff: Double?
        let edge: Double?
        let predTotal: Double?
        let totalPrediction: Double?
        let ouPrediction: Double?
        let totalDiff: Double?
        let totalEdge: Double?
        let predOverLine: Double?
        let overLineDiff: Double?

        enum CodingKeys: String, CodingKey {
            case id
            case predAwayScore = "pred_away_score"
            case predHomeScore = "pred_home_score"
            case predAwayPoints = "pred_away_points"
            case predHomePoints = "pred_home_points"
            case awayPoints = "away_points"
            case homePoints = "home_points"
            case predSpread = "pred_spread"
            case runLinePrediction = "run_line_prediction"
            case spreadPrediction = "spread_prediction"
            case homeSpreadDiff = "home_spread_diff"
            case spreadDiff = "spread_diff"
            case edge
            case predTotal = "pred_total"
            case totalPrediction = "total_prediction"
            case ouPrediction = "ou_prediction"
            case totalDiff = "total_diff"
            case totalEdge = "total_edge"
            case predOverLine = "pred_over_line"
            case overLineDiff = "over_line_diff"
        }
    }

    private func fetchCFB() async throws {
        let cfb = await CFBSupabase.shared.client
        let inputs: [CFBInputRow] = try await cfb
            .from("cfb_live_weekly_inputs")
            .select()
            .execute()
            .value
        let preds: [CFBAPIRow] = (try? await cfb
            .from("cfb_api_predictions")
            .select()
            .execute()
            .value) ?? []
        let predsById: [Int: CFBAPIRow] = Dictionary(uniqueKeysWithValues: preds.map { ($0.id, $0) })

        let merged: [CFBPrediction] = inputs.map { input in
            let api = predsById[input.id]
            let homeSpread = input.apiSpread ?? input.homeSpread
            let awaySpread: Double? = {
                if let s = input.apiSpread { return -s }
                if let s = input.awaySpread { return s }
                return nil
            }()
            return CFBPrediction(
                id: String(input.id),
                awayTeam: input.awayTeam ?? "",
                homeTeam: input.homeTeam ?? "",
                homeMl: input.homeMoneyline ?? input.homeMl,
                awayMl: input.awayMoneyline ?? input.awayMl,
                homeSpread: homeSpread,
                awaySpread: awaySpread,
                overLine: input.apiOverLine ?? input.totalLine,
                gameDate: input.startTime ?? input.startDate ?? input.gameDate ?? "",
                gameTime: input.startTime ?? input.startDate ?? input.gameTime ?? "",
                trainingKey: input.trainingKey ?? "",
                uniqueId: input.uniqueId ?? "\(input.awayTeam ?? "")_\(input.homeTeam ?? "")_\(input.startTime ?? "")",
                homeAwayMlProb: input.predMlProba ?? input.homeAwayMlProb,
                homeAwaySpreadCoverProb: input.predSpreadProba ?? input.homeAwaySpreadCoverProb,
                ouResultProb: input.predTotalProba ?? input.ouResultProb,
                runId: input.runId,
                temperature: input.weatherTempF ?? input.temperature,
                precipitation: input.precipitation,
                windSpeed: input.weatherWindspeedMph ?? input.windSpeed,
                icon: input.weatherIconText ?? input.icon,
                spreadSplitsLabel: input.spreadSplitsLabel,
                totalSplitsLabel: input.totalSplitsLabel,
                mlSplitsLabel: input.mlSplitsLabel,
                conference: input.conference,
                predAwayScore: api?.predAwayScore ?? input.predAwayScore,
                predHomeScore: api?.predHomeScore ?? input.predHomeScore,
                predAwayPoints: api?.predAwayPoints ?? api?.awayPoints,
                predHomePoints: api?.predHomePoints ?? api?.homePoints,
                predSpread: api?.predSpread ?? api?.runLinePrediction ?? api?.spreadPrediction,
                homeSpreadDiff: api?.homeSpreadDiff ?? api?.spreadDiff ?? api?.edge,
                predTotal: api?.predTotal ?? api?.totalPrediction ?? api?.ouPrediction,
                totalDiff: api?.totalDiff ?? api?.totalEdge,
                predOverLine: api?.predOverLine,
                overLineDiff: api?.overLineDiff,
                openingSpread: input.spread,
                openingTotal: input.totalLine
            )
        }
        games.cfb = merged
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
            return
        }

        // Step 2: predictions, keep latest as_of_ts_utc per game_id.
        let predictionRows: [NBAPredictionRow] = (try? await cfb
            .from("nba_predictions")
            .select("game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id, as_of_ts_utc")
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

        // Step 3: merge into NBAGame, deriving probabilities client-side
        // (matches RN's index.tsx:457-479).
        games.nba = inputRows.map { input in
            let pred = predictionsByGame[input.gameId]
            var spreadCoverProb: Double? = nil
            if let modelFair = pred?.modelFairHomeSpread, let homeSpread = input.homeSpread {
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
            if let modelFair = pred?.modelFairTotal, let totalLine = input.totalLine {
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
                homeAwayMlProb: pred?.homeWinProb,
                homeAwaySpreadCoverProb: spreadCoverProb,
                ouResultProb: ouProb,
                runId: pred?.runId,
                homeScorePred: pred?.homeScorePred,
                awayScorePred: pred?.awayScorePred,
                modelFairHomeSpread: pred?.modelFairHomeSpread,
                modelFairTotal: pred?.modelFairTotal
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
        let homeSpread: Double?
        let awaySpread: Double?
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
            case homeMl = "home_ml"
            case awayMl = "away_ml"
            case homeSpread = "home_spread"
            case awaySpread = "away_spread"
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
        let cfb = await CFBSupabase.shared.client

        // Step 1: today's input rows from v_cbb_input_values.
        let inputs: [NCAABInputRow] = (try? await cfb
            .from("v_cbb_input_values")
            .select()
            .execute()
            .value) ?? []
        if inputs.isEmpty {
            games.ncaab = []
            return
        }

        // Step 2: latest predictions run.
        let allPreds: [NCAABPredictionRow] = (try? await cfb
            .from("ncaab_predictions")
            .select("game_id, run_id, as_of_ts_utc, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, home_win_prob, away_win_prob, pred_home_margin, pred_total_points, home_score_pred, away_score_pred, model_fair_home_spread, vegas_home_spread, vegas_total")
            .execute()
            .value) ?? []
        // RN: sort run_ids desc by as_of_ts_utc, take first. Without ts we
        // fall back to lexicographic sort of run_id which is the RN behavior
        // for hooks/useNCAABModelAccuracy where as_of_ts_utc was available.
        let latestRunId: String? = {
            // Prefer the run with the newest as_of_ts_utc.
            let dated = allPreds.compactMap { p -> (String, String)? in
                guard let r = p.runId, let ts = p.asOfTsUtc else { return nil }
                return (r, ts)
            }
            if let pair = dated.sorted(by: { $0.1 > $1.1 }).first { return pair.0 }
            return allPreds.compactMap { $0.runId }.sorted(by: >).first
        }()
        var predictionMap: [Int: NCAABPredictionRow] = [:]
        for row in allPreds where row.runId == latestRunId {
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

        // Step 4: merge.
        games.ncaab = inputs.map { row in
            let pred = predictionMap[row.gameId]
            let awayMap = row.awayTeamId.flatMap { mappingMap[$0] }
            let homeMap = row.homeTeamId.flatMap { mappingMap[$0] }
            return NCAABGame(
                id: String(row.gameId),
                gameId: row.gameId,
                awayTeam: row.awayTeam ?? "",
                homeTeam: row.homeTeam ?? "",
                homeMl: row.homeMl,
                awayMl: row.awayMl,
                homeSpread: row.homeSpread ?? pred?.vegasHomeSpread,
                awaySpread: row.awaySpread,
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
                homeAwayMlProb: pred?.homeAwayMlProb,
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
            self.gamePk = try? c.decodeIfPresent(Int.self, forKey: .gamePk)
            self.homeSignals = MLBSignalsRow.decode(from: c, key: .homeSignals)
            self.awaySignals = MLBSignalsRow.decode(from: c, key: .awaySignals)
            self.gameSignals = MLBSignalsRow.decode(from: c, key: .gameSignals)
        }

        private static func decode(
            from c: KeyedDecodingContainer<CodingKeys>,
            key: CodingKeys
        ) -> [MLBSignalItem] {
            if let arr = try? c.decode([SignalPayloadItem].self, forKey: key) {
                return arr.compactMap { $0.asSignal }
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
            .in("game_pk", values: pks)
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
        self.selectedSport = sport
        for s in Sport.allCases {
            self.loadState[s] = state
            self.lastFetched[s] = (state == .loaded) ? Date() : nil
        }
    }
    #endif
}
