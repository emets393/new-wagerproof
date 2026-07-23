import Foundation

// MARK: - Sport

/// NFL / CFB / MLB — drives RPC names, filter keys, and breakdown dimensions.
/// See `.claude/docs/15_mobile_historical_analysis.md`.
public enum HistoricalAnalysisSport: String, Codable, Sendable, Hashable, CaseIterable, Identifiable {
    case nfl
    case cfb
    case mlb

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .nfl: return "NFL Historical Analysis"
        case .cfb: return "CFB Historical Analysis"
        case .mlb: return "MLB Historical Analysis"
        }
    }

    public var shortTitle: String {
        switch self {
        case .nfl: return "NFL"
        case .cfb: return "CFB"
        case .mlb: return "MLB"
        }
    }

    public var analysisRPC: String {
        switch self {
        case .nfl: return "nfl_analysis"
        case .cfb: return "cfb_analysis"
        case .mlb: return "mlb_analysis"
        }
    }

    public var upcomingRPC: String {
        switch self {
        case .nfl: return "nfl_analysis_upcoming"
        case .cfb: return "cfb_analysis_upcoming"
        case .mlb: return "mlb_analysis_upcoming"
        }
    }

    public var savedFiltersTable: String {
        switch self {
        case .nfl: return "nfl_analysis_saved_filters"
        case .cfb: return "cfb_analysis_saved_filters"
        case .mlb: return "mlb_analysis_saved_filters"
        }
    }

    public var defaultSeasonFloor: Int {
        switch self {
        case .nfl: return 2018
        case .cfb: return 2016
        case .mlb: return 2023
        }
    }

    public var seasonMax: Int {
        switch self {
        case .nfl, .cfb: return 2025
        case .mlb: return 2026
        }
    }

    /// Best-effort sport from a saved `bet_type` when the filters blob won't decode.
    public static func infer(fromBetType betType: String) -> HistoricalAnalysisSport {
        let mlb: Set<String> = ["ml", "rl", "total", "f5_ml", "f5_rl", "f5_total", "team_total_runs"]
        if mlb.contains(betType) { return .mlb }
        return .nfl
    }
}

// MARK: - Bet types

public enum HistoricalAnalysisBetType: String, CaseIterable, Identifiable, Sendable {
    // Football
    case fgSpread = "fg_spread"
    case fgML = "fg_ml"
    case fgTotal = "fg_total"
    case teamTotal = "team_total"
    case h1Spread = "h1_spread"
    case h1ML = "h1_ml"
    case h1Total = "h1_total"
    // MLB
    case ml
    case rl
    case total
    case f5ML = "f5_ml"
    case f5RL = "f5_rl"
    case f5Total = "f5_total"

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .fgSpread: return "Spread"
        case .fgML: return "Moneyline"
        case .fgTotal: return "Total"
        case .teamTotal: return "Team Total"
        case .h1Spread: return "1H Spread"
        case .h1ML: return "1H ML"
        case .h1Total: return "1H Total"
        case .ml: return "Moneyline"
        case .rl: return "Run Line"
        case .total: return "Total"
        case .f5ML: return "F5 ML"
        case .f5RL: return "F5 RL"
        case .f5Total: return "F5 Total"
        }
    }

    public var group: String {
        switch self {
        case .fgSpread, .fgML, .fgTotal, .teamTotal: return "Full Game"
        case .h1Spread, .h1ML, .h1Total: return "First Half"
        case .ml, .rl, .total: return "Full Game"
        case .f5ML, .f5RL, .f5Total: return "First Five"
        }
    }

    public static let limitedHistory: Set<String> = [
        "h1_spread", "h1_ml", "h1_total", "team_total",
    ]

    public static let moneylineMarkets: Set<String> = ["fg_ml", "h1_ml"]

    /// MLB markets without ROI (mirrors RN `MLB_NO_ROI`).
    public static let noROIMarkets: Set<String> = ["f5_ml"]

    public static func cases(for sport: HistoricalAnalysisSport) -> [HistoricalAnalysisBetType] {
        switch sport {
        case .nfl, .cfb:
            return [.fgSpread, .fgML, .fgTotal, .teamTotal, .h1Spread, .h1ML, .h1Total]
        case .mlb:
            return [.ml, .rl, .total, .f5ML, .f5RL, .f5Total]
        }
    }

    public static func from(_ raw: String) -> HistoricalAnalysisBetType {
        HistoricalAnalysisBetType(rawValue: raw) ?? .fgSpread
    }

    public static func showsROI(betType: String, sport: HistoricalAnalysisSport) -> Bool {
        switch sport {
        case .mlb: return !noROIMarkets.contains(betType)
        case .nfl, .cfb: return true  // B3: ROI everywhere for NFL/CFB - RPC now returns real ML ROI
        }
    }
}

// MARK: - MLB pitcher option

public struct MlbPitcherOption: Codable, Sendable, Equatable, Identifiable, Hashable {
    public let id: Int
    public let name: String
    public let hand: String?
    public let team: String?

    public init(id: Int, name: String, hand: String? = nil, team: String? = nil) {
        self.id = id
        self.name = name
        self.hand = hand
        self.team = team
    }
}

// MARK: - RPC responses

public struct HistoricalAnalysisCoverage: Codable, Sendable, Equatable {
    public let seasonMin: Int
    public let seasonMax: Int
    public let nBets: Int
    public let nGames: Int

    enum CodingKeys: String, CodingKey {
        case seasonMin = "season_min"
        case seasonMax = "season_max"
        case nBets = "n_bets"
        case nGames = "n_games"
    }

    // Zero-match result sets return SQL nulls; the view hides coverage when
    // overall.n == 0 so zero defaults never render.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        seasonMin = (try? c.decodeIfPresent(Int.self, forKey: .seasonMin)) ?? 0
        seasonMax = (try? c.decodeIfPresent(Int.self, forKey: .seasonMax)) ?? 0
        nBets = (try? c.decodeIfPresent(Int.self, forKey: .nBets)) ?? 0
        nGames = (try? c.decodeIfPresent(Int.self, forKey: .nGames)) ?? 0
    }
}

public struct HistoricalAnalysisOverall: Codable, Sendable, Equatable {
    public let n: Int
    public let wins: Int
    public let hitPct: Double
    public let roi: Double?

    enum CodingKeys: String, CodingKey {
        case n, wins
        case hitPct = "hit_pct"
        case roi
    }

    // Zero-row slices come back as SQL nulls (n/wins/hit_pct). A strict Double
    // decode threw for the WHOLE response, freezing the page on stale data for
    // any side-pinning filter (side/fav_dog/team+away…). Default to zeros —
    // nonDegenerateBars/n>0 checks hide them downstream.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        n = (try? c.decodeIfPresent(Int.self, forKey: .n)) ?? 0
        wins = (try? c.decodeIfPresent(Int.self, forKey: .wins)) ?? 0
        hitPct = (try? c.decodeIfPresent(Double.self, forKey: .hitPct)) ?? 0
        roi = try? c.decodeIfPresent(Double.self, forKey: .roi)
    }
}

public struct HistoricalAnalysisBarOption: Codable, Sendable, Equatable, Identifiable {
    public let side: String
    public let n: Int
    public let wins: Int
    public let hitPct: Double
    public let roi: Double?

    public var id: String { side }

    enum CodingKeys: String, CodingKey {
        case side, n, wins
        case hitPct = "hit_pct"
        case roi
    }

    // Same null-tolerance as Overall — the empty side of a pinned split has
    // null n/wins/hit_pct.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        side = (try? c.decodeIfPresent(String.self, forKey: .side)) ?? "—"
        n = (try? c.decodeIfPresent(Int.self, forKey: .n)) ?? 0
        wins = (try? c.decodeIfPresent(Int.self, forKey: .wins)) ?? 0
        hitPct = (try? c.decodeIfPresent(Double.self, forKey: .hitPct)) ?? 0
        roi = try? c.decodeIfPresent(Double.self, forKey: .roi)
    }
}

public struct HistoricalAnalysisBar: Codable, Sendable, Equatable, Identifiable {
    public let dimension: String
    public let options: [HistoricalAnalysisBarOption]

    public var id: String { dimension }
}

public struct HistoricalAnalysisBreakdownRow: Codable, Sendable, Equatable, Identifiable {
    public let team: String?
    public let coach: String?
    public let referee: String?
    public let conference: String?
    public let venue: String?
    public let n: Int
    public let hitPct: Double
    public let roi: Double?

    public var id: String {
        team ?? coach ?? referee ?? conference ?? venue ?? "\(n)-\(hitPct)"
    }

    public var label: String {
        team ?? coach ?? referee ?? conference ?? venue ?? "—"
    }

    enum CodingKeys: String, CodingKey {
        case team, coach, referee, conference, venue, n
        case hitPct = "hit_pct"
        case roi
    }

    // Null-tolerant for the same reason as the bar options.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        team = try? c.decodeIfPresent(String.self, forKey: .team)
        coach = try? c.decodeIfPresent(String.self, forKey: .coach)
        referee = try? c.decodeIfPresent(String.self, forKey: .referee)
        conference = try? c.decodeIfPresent(String.self, forKey: .conference)
        venue = try? c.decodeIfPresent(String.self, forKey: .venue)
        n = (try? c.decodeIfPresent(Int.self, forKey: .n)) ?? 0
        hitPct = (try? c.decodeIfPresent(Double.self, forKey: .hitPct)) ?? 0
        roi = try? c.decodeIfPresent(Double.self, forKey: .roi)
    }
}

public struct HistoricalAnalysisResponse: Codable, Sendable, Equatable {
    public let betType: String
    public let coverage: HistoricalAnalysisCoverage
    public let baselinePct: Double
    public let overall: HistoricalAnalysisOverall
    public let bars: [HistoricalAnalysisBar]
    public let byTeam: [HistoricalAnalysisBreakdownRow]
    public let byCoach: [HistoricalAnalysisBreakdownRow]?
    public let byReferee: [HistoricalAnalysisBreakdownRow]?
    public let byConference: [HistoricalAnalysisBreakdownRow]?
    public let byVenue: [HistoricalAnalysisBreakdownRow]?

    enum CodingKeys: String, CodingKey {
        case betType = "bet_type"
        case coverage
        case baselinePct = "baseline_pct"
        case overall, bars
        case byTeam = "by_team"
        case byCoach = "by_coach"
        case byReferee = "by_referee"
        case byConference = "by_conference"
        case byVenue = "by_venue"
    }

    // Tolerate null container fields on empty result sets (baseline_pct /
    // by_team / bars can all be SQL nulls when 0 games match).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        betType = (try? c.decodeIfPresent(String.self, forKey: .betType)) ?? ""
        coverage = try c.decode(HistoricalAnalysisCoverage.self, forKey: .coverage)
        baselinePct = (try? c.decodeIfPresent(Double.self, forKey: .baselinePct)) ?? 50
        overall = try c.decode(HistoricalAnalysisOverall.self, forKey: .overall)
        bars = (try? c.decodeIfPresent([HistoricalAnalysisBar].self, forKey: .bars)) ?? []
        byTeam = (try? c.decodeIfPresent([HistoricalAnalysisBreakdownRow].self, forKey: .byTeam)) ?? []
        byCoach = try? c.decodeIfPresent([HistoricalAnalysisBreakdownRow].self, forKey: .byCoach)
        byReferee = try? c.decodeIfPresent([HistoricalAnalysisBreakdownRow].self, forKey: .byReferee)
        byConference = try? c.decodeIfPresent([HistoricalAnalysisBreakdownRow].self, forKey: .byConference)
        byVenue = try? c.decodeIfPresent([HistoricalAnalysisBreakdownRow].self, forKey: .byVenue)
    }
}

public struct HistoricalAnalysisUpcomingGame: Codable, Sendable, Equatable, Identifiable {
    public let team: String
    public let opponent: String
    public let isHome: Bool
    /// Null when odds are missing / pick'em — MLB `mlb_analysis_upcoming` returns null `is_favorite`.
    public let isFavorite: Bool?
    public let matchup: String
    /// Football kickoff ISO; optional so MLB rows (game_date / time_et) still decode.
    public let kickoff: String?
    public let teamSpread: Double?
    public let total: Double?
    public let ttLine: Double?
    public let h1Spread: Double?
    public let h1Total: Double?
    public let referee: String?

    // MLB
    public let gamePk: Int?
    public let gameDate: String?
    public let timeEt: String?
    public let ml: Double?
    public let f5Total: Double?
    public let seriesGame: Int?
    public let tripSeriesIndex: Int?
    public let isSwitchGame: Bool?
    public let prevResult: String?
    public let daysRest: Int?
    public let dayOfWeek: String?
    public let isDoubleheader: Bool?
    public let spHand: String?
    public let oppSpHand: String?
    public let spId: Int?
    public let spName: String?
    public let oppSpId: Int?
    public let oppSpName: String?
    public let venue: String?

    public var id: String {
        if let gamePk {
            return "\(gamePk)-\(team)"
        }
        return "\(team)-\(kickoff ?? gameDate ?? "")"
    }

    enum CodingKeys: String, CodingKey {
        case team, opponent, matchup, kickoff, total, referee
        case isHome = "is_home"
        case isFavorite = "is_favorite"
        case teamSpread = "team_spread"
        case ttLine = "tt_line"
        case h1Spread = "h1_spread"
        case h1Total = "h1_total"
        case gamePk = "game_pk"
        case gameDate = "game_date"
        case timeEt = "time_et"
        case ml
        case f5Total = "f5_total"
        case seriesGame = "series_game"
        case tripSeriesIndex = "trip_series_index"
        case isSwitchGame = "is_switch_game"
        case prevResult = "prev_result"
        case daysRest = "days_rest"
        case dayOfWeek = "day_of_week"
        case isDoubleheader = "is_doubleheader"
        case spHand = "sp_hand"
        case oppSpHand = "opp_sp_hand"
        case spId = "sp_id"
        case spName = "sp_name"
        case oppSpId = "opp_sp_id"
        case oppSpName = "opp_sp_name"
        case venue
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        team = try c.decode(String.self, forKey: .team)
        opponent = try c.decode(String.self, forKey: .opponent)
        isHome = try c.decodeIfPresent(Bool.self, forKey: .isHome) ?? true
        isFavorite = try c.decodeIfPresent(Bool.self, forKey: .isFavorite)
        matchup = try c.decodeIfPresent(String.self, forKey: .matchup)
            ?? "\(team) vs \(opponent)"
        kickoff = try c.decodeIfPresent(String.self, forKey: .kickoff)
        teamSpread = c.haFlexDouble(.teamSpread)
        total = c.haFlexDouble(.total)
        ttLine = c.haFlexDouble(.ttLine)
        h1Spread = c.haFlexDouble(.h1Spread)
        h1Total = c.haFlexDouble(.h1Total)
        referee = try c.decodeIfPresent(String.self, forKey: .referee)
        gamePk = c.haFlexInt(.gamePk)
        gameDate = try c.decodeIfPresent(String.self, forKey: .gameDate)
        timeEt = try c.decodeIfPresent(String.self, forKey: .timeEt)
        ml = c.haFlexDouble(.ml)
        f5Total = c.haFlexDouble(.f5Total)
        seriesGame = c.haFlexInt(.seriesGame)
        tripSeriesIndex = c.haFlexInt(.tripSeriesIndex)
        isSwitchGame = try c.decodeIfPresent(Bool.self, forKey: .isSwitchGame)
        prevResult = try c.decodeIfPresent(String.self, forKey: .prevResult)
        daysRest = c.haFlexInt(.daysRest)
        dayOfWeek = try c.decodeIfPresent(String.self, forKey: .dayOfWeek)
        isDoubleheader = try c.decodeIfPresent(Bool.self, forKey: .isDoubleheader)
        spHand = try c.decodeIfPresent(String.self, forKey: .spHand)
        oppSpHand = try c.decodeIfPresent(String.self, forKey: .oppSpHand)
        spId = c.haFlexInt(.spId)
        spName = try c.decodeIfPresent(String.self, forKey: .spName)
        oppSpId = c.haFlexInt(.oppSpId)
        oppSpName = try c.decodeIfPresent(String.self, forKey: .oppSpName)
        venue = try c.decodeIfPresent(String.self, forKey: .venue)
    }
}

// MARK: - Flexible numeric decode (PostgREST may emit ints for whole-number doubles)

private extension KeyedDecodingContainer {
    func haFlexDouble(_ key: Key) -> Double? {
        if let d = try? decodeIfPresent(Double.self, forKey: key) { return d }
        if let i = try? decodeIfPresent(Int.self, forKey: key) { return Double(i) }
        if let s = try? decodeIfPresent(String.self, forKey: key) { return Double(s) }
        return nil
    }

    func haFlexInt(_ key: Key) -> Int? {
        if let i = try? decodeIfPresent(Int.self, forKey: key) { return i }
        if let d = try? decodeIfPresent(Double.self, forKey: key) { return Int(d) }
        if let s = try? decodeIfPresent(String.self, forKey: key) { return Int(s) }
        return nil
    }
}

// MARK: - Saved systems (main Supabase project)
// See `.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md`.

/// Which side a saved system bets. Never surface these raw values in UI —
/// use `AnalysisSystemCopy` plain-English helpers instead.
public enum AnalysisSystemVerdict: String, Codable, Sendable, Equatable, Hashable {
    case team
    case fade
    case over
    case under
}

/// Grader-computed record shape: `{n,wins,losses,pushes,hit_pct,roi,units}`.
public struct AnalysisSystemRecord: Codable, Sendable, Equatable, Hashable {
    public let n: Int
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let hitPct: Double?
    public let roi: Double?
    public let units: Double?

    enum CodingKeys: String, CodingKey {
        case n, wins, losses, pushes
        case hitPct = "hit_pct"
        case roi, units
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        n = (try? c.decodeIfPresent(Int.self, forKey: .n)) ?? 0
        wins = (try? c.decodeIfPresent(Int.self, forKey: .wins)) ?? 0
        losses = (try? c.decodeIfPresent(Int.self, forKey: .losses)) ?? 0
        pushes = (try? c.decodeIfPresent(Int.self, forKey: .pushes)) ?? 0
        hitPct = try? c.decodeIfPresent(Double.self, forKey: .hitPct)
        roi = try? c.decodeIfPresent(Double.self, forKey: .roi)
        units = try? c.decodeIfPresent(Double.self, forKey: .units)
    }
}

public struct AnalysisSystemLast10: Codable, Sendable, Equatable, Hashable {
    public let n: Int
    public let wins: Int
    /// Newest first — 1 = win, 0 = loss.
    public let results: [Int]

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        n = (try? c.decodeIfPresent(Int.self, forKey: .n)) ?? 0
        wins = (try? c.decodeIfPresent(Int.self, forKey: .wins)) ?? 0
        results = (try? c.decodeIfPresent([Int].self, forKey: .results)) ?? []
    }

    enum CodingKeys: String, CodingKey { case n, wins, results }
}

public struct AnalysisSystemStreak: Codable, Sendable, Equatable, Hashable {
    public let kind: String
    public let len: Int

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = (try? c.decodeIfPresent(String.self, forKey: .kind)) ?? "win"
        len = (try? c.decodeIfPresent(Int.self, forKey: .len)) ?? 0
    }

    enum CodingKeys: String, CodingKey { case kind, len }
}

/// Row from `{sport}_analysis_saved_filters` owned by the current user.
/// Legacy bookmark rows (no verdict) still decode — label them as filters-only.
///
/// `filters` soft-decodes: Expo/web snapshots omit many iOS-only keys (and use
/// different types for `dome` / totals). A strict decode used to fail the
/// entire My Systems fetch → empty list even after a successful save.
public struct HistoricalAnalysisSavedFilter: Codable, Identifiable, Sendable, Equatable {
    public let id: UUID
    public let userId: UUID
    public var name: String
    public let betType: String
    public let filters: HistoricalAnalysisUISnapshot
    public let verdict: AnalysisSystemVerdict?
    public let rpcBetType: String?
    public let rpcFilters: [String: JSONValue]?
    public var isPublic: Bool
    public let sinceSaved: AnalysisSystemRecord?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, filters, verdict
        case userId = "user_id"
        case betType = "bet_type"
        case rpcBetType = "rpc_bet_type"
        case rpcFilters = "rpc_filters"
        case isPublic = "is_public"
        case sinceSaved = "since_saved"
        case createdAt = "created_at"
    }

    public init(
        id: UUID,
        userId: UUID,
        name: String,
        betType: String,
        filters: HistoricalAnalysisUISnapshot,
        verdict: AnalysisSystemVerdict?,
        rpcBetType: String?,
        rpcFilters: [String: JSONValue]?,
        isPublic: Bool,
        sinceSaved: AnalysisSystemRecord?,
        createdAt: String?
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.betType = betType
        self.filters = filters
        self.verdict = verdict
        self.rpcBetType = rpcBetType
        self.rpcFilters = rpcFilters
        self.isPublic = isPublic
        self.sinceSaved = sinceSaved
        self.createdAt = createdAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        userId = try c.decode(UUID.self, forKey: .userId)
        name = try c.decode(String.self, forKey: .name)
        betType = try c.decode(String.self, forKey: .betType)
        verdict = try? c.decodeIfPresent(AnalysisSystemVerdict.self, forKey: .verdict)
        rpcBetType = try? c.decodeIfPresent(String.self, forKey: .rpcBetType)
        rpcFilters = try? c.decodeIfPresent([String: JSONValue].self, forKey: .rpcFilters)
        isPublic = (try? c.decodeIfPresent(Bool.self, forKey: .isPublic)) ?? false
        sinceSaved = try? c.decodeIfPresent(AnalysisSystemRecord.self, forKey: .sinceSaved)
        createdAt = try? c.decodeIfPresent(String.self, forKey: .createdAt)

        if let decoded = try? c.decode(HistoricalAnalysisUISnapshot.self, forKey: .filters) {
            filters = decoded
        } else {
            // Still list the system — restore uses bet_type + best-effort defaults.
            var fallback = HistoricalAnalysisUISnapshot.defaults(
                for: HistoricalAnalysisSport.infer(fromBetType: betType)
            )
            fallback.betType = betType
            filters = fallback
        }
    }

    /// True when this row has an explicit bet-side and can track since-saved.
    public var isTrackedSystem: Bool { verdict != nil }
}

/// Public Systems Leaderboard row from `analysis_systems_leaderboard`.
public struct AnalysisSystemsLeaderboardRow: Codable, Identifiable, Sendable, Equatable {
    public var id: String { systemId }
    public let sport: String
    public let systemId: String
    public let name: String
    public let verdict: AnalysisSystemVerdict
    public let betType: String
    public let rpcBetType: String?
    /// UI snapshot — restore through the same path as My Systems.
    public let filters: HistoricalAnalysisUISnapshot?
    public let username: String
    public let createdAt: String?
    public let sinceSaved: AnalysisSystemRecord?
    public let allTime: AnalysisSystemRecord?
    public let currentSeason: AnalysisSystemRecord?
    public let seasonLabel: Int?
    public let last10: AnalysisSystemLast10?
    public let streak: AnalysisSystemStreak?
    public let gradedAt: String?

    enum CodingKeys: String, CodingKey {
        case sport, name, verdict, filters, username
        case systemId = "system_id"
        case betType = "bet_type"
        case rpcBetType = "rpc_bet_type"
        case createdAt = "created_at"
        case sinceSaved = "since_saved"
        case allTime = "all_time"
        case currentSeason = "current_season"
        case seasonLabel = "season_label"
        case last10
        case streak
        case gradedAt = "graded_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sport = (try? c.decodeIfPresent(String.self, forKey: .sport)) ?? ""
        systemId = (try? c.decodeIfPresent(String.self, forKey: .systemId))
            ?? (try? c.decodeIfPresent(UUID.self, forKey: .systemId))?.uuidString
            ?? UUID().uuidString
        name = (try? c.decodeIfPresent(String.self, forKey: .name)) ?? "Untitled"
        verdict = (try? c.decodeIfPresent(AnalysisSystemVerdict.self, forKey: .verdict)) ?? .team
        betType = (try? c.decodeIfPresent(String.self, forKey: .betType)) ?? ""
        rpcBetType = try? c.decodeIfPresent(String.self, forKey: .rpcBetType)
        // Filters may be web/Expo-shaped; soft-fail so a bad snapshot never blanks the board.
        filters = try? c.decodeIfPresent(HistoricalAnalysisUISnapshot.self, forKey: .filters)
        username = (try? c.decodeIfPresent(String.self, forKey: .username)) ?? "user"
        createdAt = try? c.decodeIfPresent(String.self, forKey: .createdAt)
        sinceSaved = try? c.decodeIfPresent(AnalysisSystemRecord.self, forKey: .sinceSaved)
        allTime = try? c.decodeIfPresent(AnalysisSystemRecord.self, forKey: .allTime)
        currentSeason = try? c.decodeIfPresent(AnalysisSystemRecord.self, forKey: .currentSeason)
        seasonLabel = try? c.decodeIfPresent(Int.self, forKey: .seasonLabel)
        last10 = try? c.decodeIfPresent(AnalysisSystemLast10.self, forKey: .last10)
        streak = try? c.decodeIfPresent(AnalysisSystemStreak.self, forKey: .streak)
        gradedAt = try? c.decodeIfPresent(String.self, forKey: .gradedAt)
    }
}

/// Card-level hot/cold signal for Systems Leaderboard accent + emoji.
public enum SystemTemperature: Sendable, Equatable {
    case fire
    case ice
    case neutral
}

/// Plain-English copy for systems UI — never expose verdict / RPC jargon.
public enum AnalysisSystemCopy {
    /// e.g. "Bets the Under" / "Bets ON matching teams" / "Fades matching teams".
    public static func verdictLabel(_ verdict: AnalysisSystemVerdict?) -> String {
        switch verdict {
        case .over: return "Bets the Over"
        case .under: return "Bets the Under"
        case .team: return "Bets ON matching teams"
        case .fade: return "Fades matching teams"
        case nil: return "Filters only (save again to track as a System)"
        }
    }

    /// Fragment for "We'll track … as if you bet X".
    public static func betPhrase(_ verdict: AnalysisSystemVerdict) -> String {
        switch verdict {
        case .over: return "the Over"
        case .under: return "the Under"
        case .team: return "on these teams"
        case .fade: return "against these teams"
        }
    }

    /// Short "bets {side}" for the viewing banner.
    public static func sideWord(_ verdict: AnalysisSystemVerdict?) -> String {
        switch verdict {
        case .over: return "the Over"
        case .under: return "the Under"
        case .team: return "on matching teams"
        case .fade: return "against matching teams"
        case nil: return ""
        }
    }

    /// "2-1 since you saved" / "0-0 so far" / null → waiting on matching games.
    public static func sinceSavedLabel(_ rec: AnalysisSystemRecord?) -> String {
        guard let rec else { return "Waiting on matching games" }
        if rec.n == 0 { return "0-0 so far" }
        return "\(rec.wins)-\(rec.losses) since you saved"
    }

    public static func recordText(_ rec: AnalysisSystemRecord?) -> String {
        guard let rec else { return "—" }
        if rec.n == 0 { return "0-0 so far" }
        let base = "\(rec.wins)-\(rec.losses)"
        return rec.pushes > 0 ? "\(base)-\(rec.pushes)" : base
    }

    public static func sampleBadge(n: Int?) -> String? {
        guard let n else { return nil }
        if n >= 100 { return "Proven" }
        if n >= 30 { return "Established" }
        if n >= 10 { return "Early" }
        return nil
    }

    // MARK: - Fire / ice temperature (leaderboard cards)
    //
    // Product thresholds — keep native + Expo in sync:
    //   🔥 Fire: win streak len ≥ 3, OR last-10 with n ≥ 10 and wins ≥ 7
    //   ❄️ Ice:  loss/miss streak len ≥ 3, OR last-10 with n ≥ 10 and wins ≤ 3
    // Streak signal wins when both streak and last-10 speak (len ≥ 3).

    public static func isHotStreak(_ streak: AnalysisSystemStreak?) -> Bool {
        guard let streak else { return false }
        return streak.kind == "win" && streak.len >= 3
    }

    public static func isColdStreak(_ streak: AnalysisSystemStreak?) -> Bool {
        guard let streak else { return false }
        return streak.kind == "loss" && streak.len >= 3
    }

    public static func isHotLast10(_ last10: AnalysisSystemLast10?) -> Bool {
        guard let last10, last10.n >= 10 else { return false }
        return last10.wins >= 7
    }

    public static func isColdLast10(_ last10: AnalysisSystemLast10?) -> Bool {
        guard let last10, last10.n >= 10 else { return false }
        return last10.wins <= 3
    }

    /// Single card-level temperature for accent bar / badge. Prefers streak when len ≥ 3.
    public static func temperature(
        streak: AnalysisSystemStreak?,
        last10: AnalysisSystemLast10?
    ) -> SystemTemperature {
        if isHotStreak(streak) { return .fire }
        if isColdStreak(streak) { return .ice }
        if isHotLast10(last10) { return .fire }
        if isColdLast10(last10) { return .ice }
        return .neutral
    }

    public static func isSideMarket(_ betType: String, sport: HistoricalAnalysisSport) -> Bool {
        switch sport {
        case .mlb: return HistoricalAnalysisUISnapshot.mlbSideMarkets.contains(betType)
        case .nfl, .cfb: return HistoricalAnalysisUISnapshot.sideMarkets.contains(betType)
        }
    }

    public static func isTotalMarket(_ betType: String, sport: HistoricalAnalysisSport) -> Bool {
        switch sport {
        case .mlb: return ["total", "f5_total"].contains(betType)
        case .nfl, .cfb: return ["fg_total", "h1_total", "team_total"].contains(betType)
        }
    }

    public static func isSideSymmetric(
        snapshot: HistoricalAnalysisUISnapshot,
        sport: HistoricalAnalysisSport
    ) -> Bool {
        if sport == .mlb { return snapshot.isSideSymmetricMlb() }
        return snapshot.isSideSymmetric(sport: sport)
    }
}

// Canonical side-breaking dim lists (verbatim reference from
// `src/features/analysis/filterSchema*.ts`). Symmetry checks live on
// `HistoricalAnalysisUISnapshot.isSideSymmetric*` — these arrays document
// the web contract for parity reviews; do not re-derive classification from them alone.
public enum AnalysisSideBreakingDims {
    public static let mlb: [String] = [
        "teams", "opponents", "side", "favDog", "mlMin", "mlMax", "trip", "switchGame", "restRange",
        "spNames", "oppSpNames", "spHand", "oppSpHand", "spXfip", "oppSpXfip", "bpIp", "bpXfip",
        "lastResult", "lastAts", "lastTotal", "lastRole", "lastMargin", "winLossStreak",
        "oppLastResult", "oppLastAts", "oppLastTotal", "oppLastRole", "oppLastMargin",
        "winPct", "winStreak", "lossStreak", "rpg", "rapg", "runDiffPg", "rlCoverPct", "rlStreak",
        "overPct", "overStreak", "underStreak", "prevWins", "prevWinPct",
        "h2hLastWin", "h2hLastAts", "h2hLastOver", "h2hLastMargin", "h2hLastHome", "h2hLastFav", "h2hSameSeason",
        "oppWinPct", "oppOverPct", "oppRlCoverPct", "oppWinStreak", "oppLossStreak", "oppRpg", "oppRapg", "oppPrevWinPct",
    ]

    public static let nfl: [String] = [
        "teams", "opponents", "side", "favDog", "spreadSide", "mlMin", "mlMax",
        "h1SpreadSide", "h1MlMin", "h1MlMax", "oppSpreadSide", "oppMlMin", "oppMlMax",
        "coach", "restBye", "teamDivisions",
        "winPct", "winStreak", "lossStreak", "above500", "winPctGtOpp", "ppg", "paPg", "pointDiffPg",
        "atsWinPct", "atsWinStreak", "avgCoverMargin",
        "overPct", "overStreak", "underStreak",
        "prevWins", "prevWinPct", "madePlayoffsPrev", "moreWinsThanOppPrev",
        "h2hLastWin", "h2hLastAts", "h2hLastOver", "h2hLastHome", "h2hLastFav", "h2hSameSeason", "h2hSpreadCmp",
        "oppWinPct", "oppOverPct", "oppWinStreak", "oppLossStreak", "oppPpg", "oppPaPg", "oppPrevWinPct",
        "lastResult", "lastAts", "lastTotal", "lastRole", "lastOt", "lastMargin",
        "oppLastResult", "oppLastAts", "oppLastTotal", "oppLastRole", "oppLastOt", "oppLastMargin",
    ]

    public static let cfb: [String] = [
        "teams", "opponents", "side", "favDog", "spreadSide", "mlMin", "mlMax",
        "h1SpreadSide", "h1MlMin", "h1MlMax", "oppSpreadSide", "oppMlMin", "oppMlMax",
        "selectedConferences", "conference",
        "winPct", "winStreak", "lossStreak", "above500", "winPctGtOpp", "ppg", "paPg", "pointDiffPg",
        "atsWinPct", "atsWinStreak", "avgCoverMargin",
        "overPct", "overStreak", "underStreak",
        "prevWins", "prevWinPct", "madePlayoffsPrev", "moreWinsThanOppPrev",
        "h2hLastWin", "h2hLastAts", "h2hLastOver", "h2hLastHome", "h2hLastFav", "h2hSameSeason", "h2hSpreadCmp",
        "oppWinPct", "oppOverPct", "oppWinStreak", "oppLossStreak", "oppPpg", "oppPaPg", "oppPrevWinPct",
        "lastResult", "lastAts", "lastTotal", "lastRole", "lastOt", "lastMargin",
        "oppLastResult", "oppLastAts", "oppLastTotal", "oppLastRole", "oppLastOt", "oppLastMargin",
    ]
}

/// UI-shaped filter snapshot — stored in saved-filters tables and restored
/// verbatim (mirrors web `snapshot()` / `restore()`).
public struct HistoricalAnalysisUISnapshot: Codable, Sendable, Equatable {
    public var betType: String
    public var seasonMin: Int
    public var seasonMax: Int
    public var weekMin: Int
    public var weekMax: Int
    public var side: String
    public var favDog: String
    public var spreadSide: String
    public var spreadMin: Double
    public var spreadMax: Double
    public var lineMin: Double
    public var lineMax: Double
    public var mlMin: String
    public var mlMax: String
    // Cross-market football line filters. These stay separate from the selected
    // result market so a spread analysis can still be narrowed by 1H/TT pricing.
    public var h1SpreadSide: String
    public var h1SpreadMin: Double
    public var h1SpreadMax: Double
    public var h1MlMin: String
    public var h1MlMax: String
    public var h1TotalMin: Double
    public var h1TotalMax: Double
    public var ttLineMin: Double
    public var ttLineMax: Double
    public var oppSpreadSide: String
    public var oppSpreadMin: Double
    public var oppSpreadMax: Double
    public var oppMlMin: String
    public var oppMlMax: String
    public var oppTtLineMin: Double
    public var oppTtLineMax: Double
    public var primetime: Bool?
    public var tempMin: Int
    public var tempMax: Int
    public var windMax: Int

    // NFL-only
    public var seasonType: String
    public var playoffRound: String
    public var division: Bool?
    public var dome: String
    public var precip: String
    public var restBye: String
    public var coach: String
    public var referee: String

    // CFB-only
    public var gameType: String
    public var rankedMatchup: String
    public var conferenceGame: Bool?
    public var neutralSite: Bool?
    /// Legacy single-conference value (`"any"` = unset). Prefer `selectedConferences`.
    public var conference: String
    /// CFB multi-conference filter — empty = all conferences.
    public var selectedConferences: [String]
    /// CFB actual weather (CFBD weatherCondition): any | clear | cloudy | rain | snow.
    public var weather: String

    // Football "last game" filters (CFB/NFL) — each describes the team's PREVIOUS game.
    // (MLB reuses `lastResult` below for its own last-game W/L.)
    public var lastAts: String       // any | covered | not
    public var lastTotal: String     // any | over | under
    public var lastRole: String      // any | favorite | underdog
    public var lastOt: Bool?         // previous game went to overtime
    public var lastBlowout: String   // any | win | loss  (±21 margin)

    // NFL "as-of" season record filters (team's situation at time of game)
    public var winPct: [Double]             // [0, 100] UI range (sent as 0–1 to RPC)
    public var winStreak: [Int]             // [0, 16]
    public var lossStreak: [Int]            // [0, 16]
    public var above500: Bool?              // true = >.500, false = <.500
    public var winPctGtOpp: Bool?          // win % better than opponent
    public var ppg: [Double]               // points per game [0, 40]
    public var paPg: [Double]              // points allowed per game [0, 40]
    public var pointDiffPg: [Double]       // point differential [-20, 20]
    public var minGames: Int               // minimum games this season (guard for thin samples)
    
    // NFL ATS/Cover profile
    public var atsWinPct: [Double]         // ATS cover % [0, 100]
    public var atsWinStreak: [Int]         // ATS cover streak [0, 16]
    public var avgCoverMargin: [Double]    // average cover margin [-15, 15]
    
    // NFL Total profile
    public var overPct: [Double]           // over % [0, 100]
    public var overStreak: [Int]           // over streak [0, 16]
    public var underStreak: [Int]          // under streak [0, 16]
    
    // NFL Prior year
    public var prevWins: [Int]             // previous season wins [0, 16]
    public var prevWinPct: [Double]        // previous season win % [0, 100]
    public var madePlayoffsPrev: Bool?     // made playoffs last year
    public var moreWinsThanOppPrev: Bool?  // more wins than opponent last year
    
    // NFL Head-to-head (last meeting)
    public var h2hLastWin: String          // "any" | "yes" | "no"
    public var h2hLastAts: String          // "any" | "yes" | "no"
    public var h2hLastOver: String         // "any" | "yes" | "no"
    public var h2hLastHome: Bool?          // was home in last meeting
    public var h2hLastFav: Bool?           // was favorite in last meeting
    public var h2hSameSeason: Bool?        // last meeting same season
    public var h2hSpreadCmp: String        // "any" | "lower" | "higher"
    
    // NFL Opponent record
    public var oppWinPct: [Double]         // opponent win % [0, 100]
    public var oppOverPct: [Double]        // opponent over % [0, 100]
    public var oppWinStreak: [Int]         // opponent win streak [0, 16]
    public var oppLossStreak: [Int]        // opponent loss streak [0, 16]
    public var oppPpg: [Double]            // opponent points per game
    public var oppPaPg: [Double]           // opponent points allowed per game
    public var oppPrevWinPct: [Double]     // opponent previous season win % [0, 100]
    
    // NFL Opponent last game (the opponent's previous game)
    public var oppLastResult: String       // "any" | "won" | "lost"
    public var oppLastAts: String          // "any" | "covered" | "not"
    public var oppLastTotal: String        // "any" | "over" | "under"
    public var oppLastRole: String         // "any" | "favorite" | "underdog"
    public var oppLastOt: Bool?            // opponent's last game went to overtime
    public var oppLastMargin: [Int]        // opponent's last game margin [-60, 60]
    
    // NFL Last game margin (replaces blowout for NFL)
    public var lastMargin: [Int]           // signed margin [-60, 60] (+ = won by, - = lost by)
    
    // NFL Multi-select additions
    public var daysOfWeek: [String]        // ["Sun", "Mon", ...] 
    public var teamDivisions: [String]     // ["AFC East", "NFC West", ...]

    // MLB-only (tolerant decode — missing keys use defaults so old football JSON still works)
    public var monthMin: Int
    public var monthMax: Int
    public var teams: [String]
    public var opponents: [String]
    public var interleague: Bool?
    public var dayOfWeek: String
    public var doubleheader: Bool?
    public var seriesGameMin: Int?
    public var seriesGameMax: Int?
    public var tripMin: Int?
    public var tripMax: Int?
    public var switchGame: Bool?
    public var restMin: Int?
    public var restMax: Int?
    public var streakMin: String
    public var streakMax: String
    public var lastResult: String
    public var lastMarginMin: String
    public var lastMarginMax: String
    /// Team starter(s) — full options so chips can show names (mirrors web `sp`).
    public var sp: [MlbPitcherOption]
    /// Opposing starter(s) — mirrors web `oppSp`.
    public var oppSp: [MlbPitcherOption]
    public var spHand: String
    public var oppSpHand: String
    public var windMin: Int?
    public var windDir: String
    public var pfRunsMin: Double?
    public var pfRunsMax: Double?

    // MLB — F5 total (independent of full-game `lineMin/Max`) + start-time window.
    public var f5TotalMin: Double
    public var f5TotalMax: Double
    public var timeMin: String
    public var timeMax: String

    // MLB — pitching quality (starters + bullpen xFIP, bullpen IP last 3 days).
    public var spXfipMin: Double
    public var spXfipMax: Double
    public var oppSpXfipMin: Double
    public var oppSpXfipMax: Double
    public var bpIpMin: Double
    public var bpIpMax: Double
    public var bpXfipMin: Double
    public var bpXfipMax: Double

    // MLB — run-based season record additions (winPct/winStreak/lossStreak/minGames
    // are shared with football above; MLB reuses them with its own default ranges).
    public var rpg: [Double]
    public var rapg: [Double]
    public var runDiffPg: [Double]

    // MLB — run-line profile (overPct/overStreak/underStreak/prevWins/prevWinPct
    // are shared with football above).
    public var rlCoverPct: [Double]
    public var rlStreak: [Int]

    // MLB — H2H last-meeting margin (h2hLastWin/Ats/Over/Home/Fav/SameSeason are
    // shared with football above).
    public var h2hLastMargin: [Int]

    // MLB — opponent record additions (oppWinPct/oppOverPct/oppWinStreak/
    // oppLossStreak/oppPrevWinPct are shared with football above).
    public var oppRlCoverPct: [Double]
    public var oppRpg: [Double]
    public var oppRapg: [Double]

    enum CodingKeys: String, CodingKey {
        case betType, seasonMin, seasonMax, weekMin, weekMax
        case side, favDog, spreadSide, spreadMin, spreadMax
        case lineMin, lineMax, mlMin, mlMax, primetime
        case h1SpreadSide, h1SpreadMin, h1SpreadMax, h1MlMin, h1MlMax, h1TotalMin, h1TotalMax
        case ttLineMin, ttLineMax, oppSpreadSide, oppSpreadMin, oppSpreadMax
        case oppMlMin, oppMlMax, oppTtLineMin, oppTtLineMax
        case tempMin, tempMax, windMax
        case seasonType, playoffRound, division, dome, precip, restBye, coach, referee
        case gameType, rankedMatchup, conferenceGame, neutralSite, conference, selectedConferences
        case weather, lastAts, lastTotal, lastRole, lastOt, lastBlowout
        case monthMin, monthMax, teams, opponents, interleague
        case dayOfWeek, doubleheader
        case seriesGameMin, seriesGameMax, tripMin, tripMax, switchGame
        case restMin, restMax, streakMin, streakMax, lastResult
        case lastMarginMin, lastMarginMax
        case sp, oppSp, spHand, oppSpHand
        case windMin, windDir, pfRunsMin, pfRunsMax
        case f5TotalMin, f5TotalMax, timeMin, timeMax
        case spXfipMin, spXfipMax, oppSpXfipMin, oppSpXfipMax, bpIpMin, bpIpMax, bpXfipMin, bpXfipMax
        case rpg, rapg, runDiffPg
        case rlCoverPct, rlStreak
        case h2hLastMargin
        case oppRlCoverPct, oppRpg, oppRapg
        // NFL "as-of" filters - encoding with WEB key names for saved filter compatibility
        case winPct, winStreak, lossStreak, above500, winPctGtOpp
        case ppg, paPg, pointDiffPg, minGames
        case atsWinPct, atsWinStreak, avgCoverMargin
        case overPct, overStreak, underStreak
        case prevWins, prevWinPct, madePlayoffsPrev, moreWinsThanOppPrev
        case h2hLastWin, h2hLastAts, h2hLastOver, h2hLastHome, h2hLastFav
        case h2hSameSeason, h2hSpreadCmp
        case oppWinPct, oppOverPct, oppWinStreak, oppLossStreak, oppPpg, oppPaPg, oppPrevWinPct
        case oppLastResult, oppLastAts, oppLastTotal, oppLastRole, oppLastOt, oppLastMargin
        case lastMargin, daysOfWeek, teamDivisions
    }

    /// Expo / web aliases present in older saves — decode-only (not encoded).
    private enum AltKeys: String, CodingKey {
        case totalMin, totalMax, seasons, weeks
        case spreadSize, lineRange, tempRange, windRange
        case h1SpreadSize, h1TotalRange, ttLineRange
        case oppSpreadSize, oppTtLineRange
        // web MLB pair fields (arrays or {min,max} objects)
        case months, restRange, f5TotalRange, seriesGame, trip
        case spXfip, oppSpXfip, bpIp, bpXfip, pfRuns
    }

    /// Web pair fields arrive as [lo, hi] arrays or {min, max} objects.
    private struct OptRange: Decodable { let min: Double?; let max: Double? }
    private static func altPair(_ alt: KeyedDecodingContainer<AltKeys>, _ key: AltKeys) -> (Double?, Double?)? {
        if let a = try? alt.decodeIfPresent([Double?].self, forKey: key), a.count >= 2 { return (a[0], a[1]) }
        if let o = try? alt.decodeIfPresent(OptRange.self, forKey: key) { return (o.min, o.max) }
        return nil
    }

    public init(
        betType: String,
        seasonMin: Int,
        seasonMax: Int,
        weekMin: Int,
        weekMax: Int,
        side: String,
        favDog: String,
        spreadSide: String,
        spreadMin: Double,
        spreadMax: Double,
        lineMin: Double,
        lineMax: Double,
        mlMin: String,
        mlMax: String,
        h1SpreadSide: String = "any",
        h1SpreadMin: Double = 0,
        h1SpreadMax: Double = 14,
        h1MlMin: String = "",
        h1MlMax: String = "",
        h1TotalMin: Double = 15,
        h1TotalMax: Double = 35,
        ttLineMin: Double = 10,
        ttLineMax: Double = 40,
        oppSpreadSide: String = "any",
        oppSpreadMin: Double = 0,
        oppSpreadMax: Double = 20,
        oppMlMin: String = "",
        oppMlMax: String = "",
        oppTtLineMin: Double = 10,
        oppTtLineMax: Double = 40,
        primetime: Bool?,
        tempMin: Int,
        tempMax: Int,
        windMax: Int,
        seasonType: String,
        playoffRound: String,
        division: Bool?,
        dome: String,
        precip: String,
        restBye: String,
        coach: String,
        referee: String,
        gameType: String,
        rankedMatchup: String,
        conferenceGame: Bool?,
        neutralSite: Bool?,
        conference: String,
        selectedConferences: [String],
        monthMin: Int = 3,
        monthMax: Int = 11,
        teams: [String] = [],
        opponents: [String] = [],
        interleague: Bool? = nil,
        dayOfWeek: String = "any",
        doubleheader: Bool? = nil,
        seriesGameMin: Int? = nil,
        seriesGameMax: Int? = nil,
        tripMin: Int? = nil,
        tripMax: Int? = nil,
        switchGame: Bool? = nil,
        restMin: Int? = nil,
        restMax: Int? = nil,
        streakMin: String = "",
        streakMax: String = "",
        lastResult: String = "any",
        lastMarginMin: String = "",
        lastMarginMax: String = "",
        sp: [MlbPitcherOption] = [],
        oppSp: [MlbPitcherOption] = [],
        spHand: String = "any",
        oppSpHand: String = "any",
        windMin: Int? = nil,
        windDir: String = "any",
        pfRunsMin: Double? = nil,
        pfRunsMax: Double? = nil,
        f5TotalMin: Double = 2,
        f5TotalMax: Double = 8,
        timeMin: String = "",
        timeMax: String = "",
        spXfipMin: Double = 2,
        spXfipMax: Double = 7,
        oppSpXfipMin: Double = 2,
        oppSpXfipMax: Double = 7,
        bpIpMin: Double = 0,
        bpIpMax: Double = 20,
        bpXfipMin: Double = 2,
        bpXfipMax: Double = 7,
        rpg: [Double] = [0, 10],
        rapg: [Double] = [0, 10],
        runDiffPg: [Double] = [-4, 4],
        rlCoverPct: [Double] = [0, 100],
        rlStreak: [Int] = [0, 25],
        h2hLastMargin: [Int] = [-30, 30],
        oppRlCoverPct: [Double] = [0, 100],
        oppRpg: [Double] = [0, 10],
        oppRapg: [Double] = [0, 10],
        weather: String = "any",
        lastAts: String = "any",
        lastTotal: String = "any",
        lastRole: String = "any",
        lastOt: Bool? = nil,
        lastBlowout: String = "any",
        // NFL "as-of" defaults
        winPct: [Double] = [0, 100],
        winStreak: [Int] = [0, 16],
        lossStreak: [Int] = [0, 16],
        above500: Bool? = nil,
        winPctGtOpp: Bool? = nil,
        ppg: [Double] = [0, 40],
        paPg: [Double] = [0, 40],
        pointDiffPg: [Double] = [-20, 20],
        minGames: Int = 0,
        atsWinPct: [Double] = [0, 100],
        atsWinStreak: [Int] = [0, 16],
        avgCoverMargin: [Double] = [-15, 15],
        overPct: [Double] = [0, 100],
        overStreak: [Int] = [0, 16],
        underStreak: [Int] = [0, 16],
        prevWins: [Int] = [0, 16],
        prevWinPct: [Double] = [0, 100],
        madePlayoffsPrev: Bool? = nil,
        moreWinsThanOppPrev: Bool? = nil,
        h2hLastWin: String = "any",
        h2hLastAts: String = "any",
        h2hLastOver: String = "any",
        h2hLastHome: Bool? = nil,
        h2hLastFav: Bool? = nil,
        h2hSameSeason: Bool? = nil,
        h2hSpreadCmp: String = "any",
        oppWinPct: [Double] = [0, 100],
        oppOverPct: [Double] = [0, 100],
        oppWinStreak: [Int] = [0, 16],
        oppLossStreak: [Int] = [0, 16],
        oppPpg: [Double] = [0, 40],
        oppPaPg: [Double] = [0, 40],
        oppPrevWinPct: [Double] = [0, 100],
        oppLastResult: String = "any",
        oppLastAts: String = "any",
        oppLastTotal: String = "any",
        oppLastRole: String = "any",
        oppLastOt: Bool? = nil,
        oppLastMargin: [Int] = [-60, 60],
        lastMargin: [Int] = [-60, 60],
        daysOfWeek: [String] = [],
        teamDivisions: [String] = []
    ) {
        self.betType = betType
        self.seasonMin = seasonMin
        self.seasonMax = seasonMax
        self.weekMin = weekMin
        self.weekMax = weekMax
        self.side = side
        self.favDog = favDog
        self.spreadSide = spreadSide
        self.spreadMin = spreadMin
        self.spreadMax = spreadMax
        self.lineMin = lineMin
        self.lineMax = lineMax
        self.mlMin = mlMin
        self.mlMax = mlMax
        self.h1SpreadSide = h1SpreadSide
        self.h1SpreadMin = h1SpreadMin
        self.h1SpreadMax = h1SpreadMax
        self.h1MlMin = h1MlMin
        self.h1MlMax = h1MlMax
        self.h1TotalMin = h1TotalMin
        self.h1TotalMax = h1TotalMax
        self.ttLineMin = ttLineMin
        self.ttLineMax = ttLineMax
        self.oppSpreadSide = oppSpreadSide
        self.oppSpreadMin = oppSpreadMin
        self.oppSpreadMax = oppSpreadMax
        self.oppMlMin = oppMlMin
        self.oppMlMax = oppMlMax
        self.oppTtLineMin = oppTtLineMin
        self.oppTtLineMax = oppTtLineMax
        self.primetime = primetime
        self.tempMin = tempMin
        self.tempMax = tempMax
        self.windMax = windMax
        self.seasonType = seasonType
        self.playoffRound = playoffRound
        self.division = division
        self.dome = dome
        self.precip = precip
        self.restBye = restBye
        self.coach = coach
        self.referee = referee
        self.gameType = gameType
        self.rankedMatchup = rankedMatchup
        self.conferenceGame = conferenceGame
        self.neutralSite = neutralSite
        self.conference = conference
        self.selectedConferences = selectedConferences
        self.monthMin = monthMin
        self.monthMax = monthMax
        self.teams = teams
        self.opponents = opponents
        self.interleague = interleague
        self.dayOfWeek = dayOfWeek
        self.doubleheader = doubleheader
        self.seriesGameMin = seriesGameMin
        self.seriesGameMax = seriesGameMax
        self.tripMin = tripMin
        self.tripMax = tripMax
        self.switchGame = switchGame
        self.restMin = restMin
        self.restMax = restMax
        self.streakMin = streakMin
        self.streakMax = streakMax
        self.lastResult = lastResult
        self.lastMarginMin = lastMarginMin
        self.lastMarginMax = lastMarginMax
        self.sp = sp
        self.oppSp = oppSp
        self.spHand = spHand
        self.oppSpHand = oppSpHand
        self.windMin = windMin
        self.windDir = windDir
        self.pfRunsMin = pfRunsMin
        self.pfRunsMax = pfRunsMax
        self.f5TotalMin = f5TotalMin
        self.f5TotalMax = f5TotalMax
        self.timeMin = timeMin
        self.timeMax = timeMax
        self.spXfipMin = spXfipMin
        self.spXfipMax = spXfipMax
        self.oppSpXfipMin = oppSpXfipMin
        self.oppSpXfipMax = oppSpXfipMax
        self.bpIpMin = bpIpMin
        self.bpIpMax = bpIpMax
        self.bpXfipMin = bpXfipMin
        self.bpXfipMax = bpXfipMax
        self.rpg = rpg
        self.rapg = rapg
        self.runDiffPg = runDiffPg
        self.rlCoverPct = rlCoverPct
        self.rlStreak = rlStreak
        self.h2hLastMargin = h2hLastMargin
        self.oppRlCoverPct = oppRlCoverPct
        self.oppRpg = oppRpg
        self.oppRapg = oppRapg
        self.weather = weather
        self.lastAts = lastAts
        self.lastTotal = lastTotal
        self.lastRole = lastRole
        self.lastOt = lastOt
        self.lastBlowout = lastBlowout
        // NFL "as-of" fields
        self.winPct = winPct
        self.winStreak = winStreak
        self.lossStreak = lossStreak
        self.above500 = above500
        self.winPctGtOpp = winPctGtOpp
        self.ppg = ppg
        self.paPg = paPg
        self.pointDiffPg = pointDiffPg
        self.minGames = minGames
        self.atsWinPct = atsWinPct
        self.atsWinStreak = atsWinStreak
        self.avgCoverMargin = avgCoverMargin
        self.overPct = overPct
        self.overStreak = overStreak
        self.underStreak = underStreak
        self.prevWins = prevWins
        self.prevWinPct = prevWinPct
        self.madePlayoffsPrev = madePlayoffsPrev
        self.moreWinsThanOppPrev = moreWinsThanOppPrev
        self.h2hLastWin = h2hLastWin
        self.h2hLastAts = h2hLastAts
        self.h2hLastOver = h2hLastOver
        self.h2hLastHome = h2hLastHome
        self.h2hLastFav = h2hLastFav
        self.h2hSameSeason = h2hSameSeason
        self.h2hSpreadCmp = h2hSpreadCmp
        self.oppWinPct = oppWinPct
        self.oppOverPct = oppOverPct
        self.oppWinStreak = oppWinStreak
        self.oppLossStreak = oppLossStreak
        self.oppPpg = oppPpg
        self.oppPaPg = oppPaPg
        self.oppPrevWinPct = oppPrevWinPct
        self.oppLastResult = oppLastResult
        self.oppLastAts = oppLastAts
        self.oppLastTotal = oppLastTotal
        self.oppLastRole = oppLastRole
        self.oppLastOt = oppLastOt
        self.oppLastMargin = oppLastMargin
        self.lastMargin = lastMargin
        self.daysOfWeek = daysOfWeek
        self.teamDivisions = teamDivisions
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let alt = try decoder.container(keyedBy: AltKeys.self)
        // Tolerant decode: Expo MLB + legacy web bookmarks omit football-only
        // keys and use different types (`dome` bool, `totalMin` vs `lineMin`).
        // Required-field failures here used to blank the entire My Systems list.
        betType = (try? c.decodeIfPresent(String.self, forKey: .betType)) ?? "fg_spread"
        if let seasons = try? alt.decodeIfPresent([Int].self, forKey: .seasons), seasons.count >= 2 {
            seasonMin = seasons[0]
            seasonMax = seasons[1]
        } else {
            seasonMin = Self.decodeInt(c, .seasonMin) ?? 2018
            seasonMax = Self.decodeInt(c, .seasonMax) ?? 2025
        }
        if let weeks = try? alt.decodeIfPresent([Int].self, forKey: .weeks), weeks.count >= 2 {
            weekMin = weeks[0]
            weekMax = weeks[1]
        } else {
            weekMin = Self.decodeInt(c, .weekMin) ?? 1
            weekMax = Self.decodeInt(c, .weekMax) ?? 18
        }
        side = (try? c.decodeIfPresent(String.self, forKey: .side)) ?? "any"
        favDog = (try? c.decodeIfPresent(String.self, forKey: .favDog)) ?? "any"
        spreadSide = (try? c.decodeIfPresent(String.self, forKey: .spreadSide)) ?? "any"
        if let size = try? alt.decodeIfPresent([Double].self, forKey: .spreadSize), size.count >= 2 {
            spreadMin = size[0]
            spreadMax = size[1]
        } else {
            spreadMin = Self.decodeDouble(c, .spreadMin) ?? 0
            spreadMax = Self.decodeDouble(c, .spreadMax) ?? 20
        }
        // Expo MLB uses totalMin/totalMax for game totals; web football uses lineRange.
        if let lr = try? alt.decodeIfPresent([Double].self, forKey: .lineRange), lr.count >= 2 {
            lineMin = lr[0]
            lineMax = lr[1]
        } else {
            lineMin = Self.decodeDouble(c, .lineMin)
                ?? Self.decodeAltDouble(alt, .totalMin)
                ?? 5
            lineMax = Self.decodeDouble(c, .lineMax)
                ?? Self.decodeAltDouble(alt, .totalMax)
                ?? 14
        }
        mlMin = (try? c.decodeIfPresent(String.self, forKey: .mlMin)) ?? ""
        mlMax = (try? c.decodeIfPresent(String.self, forKey: .mlMax)) ?? ""
        h1SpreadSide = (try? c.decodeIfPresent(String.self, forKey: .h1SpreadSide)) ?? "any"
        if let size = try? alt.decodeIfPresent([Double].self, forKey: .h1SpreadSize), size.count >= 2 {
            h1SpreadMin = size[0]
            h1SpreadMax = size[1]
        } else {
            h1SpreadMin = (try? c.decodeIfPresent(Double.self, forKey: .h1SpreadMin)) ?? 0
            h1SpreadMax = (try? c.decodeIfPresent(Double.self, forKey: .h1SpreadMax)) ?? 14
        }
        h1MlMin = (try? c.decodeIfPresent(String.self, forKey: .h1MlMin)) ?? ""
        h1MlMax = (try? c.decodeIfPresent(String.self, forKey: .h1MlMax)) ?? ""
        if let tr = try? alt.decodeIfPresent([Double].self, forKey: .h1TotalRange), tr.count >= 2 {
            h1TotalMin = tr[0]
            h1TotalMax = tr[1]
        } else {
            h1TotalMin = (try? c.decodeIfPresent(Double.self, forKey: .h1TotalMin)) ?? 15
            h1TotalMax = (try? c.decodeIfPresent(Double.self, forKey: .h1TotalMax)) ?? 35
        }
        if let tt = try? alt.decodeIfPresent([Double].self, forKey: .ttLineRange), tt.count >= 2 {
            ttLineMin = tt[0]
            ttLineMax = tt[1]
        } else {
            ttLineMin = (try? c.decodeIfPresent(Double.self, forKey: .ttLineMin)) ?? 10
            ttLineMax = (try? c.decodeIfPresent(Double.self, forKey: .ttLineMax)) ?? 40
        }
        oppSpreadSide = (try? c.decodeIfPresent(String.self, forKey: .oppSpreadSide)) ?? "any"
        if let size = try? alt.decodeIfPresent([Double].self, forKey: .oppSpreadSize), size.count >= 2 {
            oppSpreadMin = size[0]
            oppSpreadMax = size[1]
        } else {
            oppSpreadMin = (try? c.decodeIfPresent(Double.self, forKey: .oppSpreadMin)) ?? 0
            oppSpreadMax = (try? c.decodeIfPresent(Double.self, forKey: .oppSpreadMax)) ?? 20
        }
        oppMlMin = (try? c.decodeIfPresent(String.self, forKey: .oppMlMin)) ?? ""
        oppMlMax = (try? c.decodeIfPresent(String.self, forKey: .oppMlMax)) ?? ""
        if let ott = try? alt.decodeIfPresent([Double].self, forKey: .oppTtLineRange), ott.count >= 2 {
            oppTtLineMin = ott[0]
            oppTtLineMax = ott[1]
        } else {
            oppTtLineMin = (try? c.decodeIfPresent(Double.self, forKey: .oppTtLineMin)) ?? 10
            oppTtLineMax = (try? c.decodeIfPresent(Double.self, forKey: .oppTtLineMax)) ?? 40
        }
        primetime = try? c.decodeIfPresent(Bool.self, forKey: .primetime)
        if let tr = try? alt.decodeIfPresent([Double].self, forKey: .tempRange), tr.count >= 2 {
            tempMin = Int(tr[0].rounded())
            tempMax = Int(tr[1].rounded())
        } else {
            tempMin = Self.decodeInt(c, .tempMin) ?? -10
            tempMax = Self.decodeInt(c, .tempMax) ?? 110
        }
        if let wr = try? alt.decodeIfPresent([Double].self, forKey: .windRange), wr.count >= 2 {
            windMax = Int(wr[1].rounded())
            windMin = Int(wr[0].rounded())
        } else {
            windMax = Self.decodeInt(c, .windMax) ?? 60
            windMin = try? c.decodeIfPresent(Int.self, forKey: .windMin)
        }
        seasonType = (try? c.decodeIfPresent(String.self, forKey: .seasonType)) ?? "any"
        playoffRound = (try? c.decodeIfPresent(String.self, forKey: .playoffRound)) ?? "any"
        division = try c.decodeIfPresent(Bool.self, forKey: .division)
        // iOS string enum vs Expo MLB bool tristate
        if let s = try? c.decodeIfPresent(String.self, forKey: .dome) {
            dome = s
        } else if let b = try? c.decode(Bool.self, forKey: .dome) {
            dome = b ? "dome" : "outdoor"
        } else {
            dome = "any"
        }
        precip = (try? c.decodeIfPresent(String.self, forKey: .precip)) ?? "any"
        restBye = (try? c.decodeIfPresent(String.self, forKey: .restBye)) ?? "any"
        coach = (try? c.decodeIfPresent(String.self, forKey: .coach)) ?? "any"
        referee = (try? c.decodeIfPresent(String.self, forKey: .referee)) ?? "any"
        gameType = (try? c.decodeIfPresent(String.self, forKey: .gameType)) ?? "any"
        rankedMatchup = (try? c.decodeIfPresent(String.self, forKey: .rankedMatchup)) ?? "any"
        conferenceGame = try c.decodeIfPresent(Bool.self, forKey: .conferenceGame)
        neutralSite = try c.decodeIfPresent(Bool.self, forKey: .neutralSite)
        conference = (try? c.decodeIfPresent(String.self, forKey: .conference)) ?? "any"
        selectedConferences = try c.decodeIfPresent([String].self, forKey: .selectedConferences) ?? []

        if let p = Self.altPair(alt, .months) {
            monthMin = p.0.map { Int($0.rounded()) } ?? 3
            monthMax = p.1.map { Int($0.rounded()) } ?? 11
        } else {
            monthMin = try c.decodeIfPresent(Int.self, forKey: .monthMin) ?? 3
            monthMax = try c.decodeIfPresent(Int.self, forKey: .monthMax) ?? 11
        }
        teams = try c.decodeIfPresent([String].self, forKey: .teams) ?? []
        opponents = try c.decodeIfPresent([String].self, forKey: .opponents) ?? []
        interleague = try c.decodeIfPresent(Bool.self, forKey: .interleague)
        dayOfWeek = try c.decodeIfPresent(String.self, forKey: .dayOfWeek) ?? "any"
        doubleheader = try c.decodeIfPresent(Bool.self, forKey: .doubleheader)
        if let p = Self.altPair(alt, .seriesGame) {
            seriesGameMin = p.0.map { Int($0.rounded()) }
            seriesGameMax = p.1.map { Int($0.rounded()) }
        } else {
            seriesGameMin = try c.decodeIfPresent(Int.self, forKey: .seriesGameMin)
            seriesGameMax = try c.decodeIfPresent(Int.self, forKey: .seriesGameMax)
        }
        if let p = Self.altPair(alt, .trip) {
            tripMin = p.0.map { Int($0.rounded()) }
            tripMax = p.1.map { Int($0.rounded()) }
        } else {
            tripMin = try c.decodeIfPresent(Int.self, forKey: .tripMin)
            tripMax = try c.decodeIfPresent(Int.self, forKey: .tripMax)
        }
        switchGame = try c.decodeIfPresent(Bool.self, forKey: .switchGame)
        if let p = Self.altPair(alt, .restRange) {
            restMin = p.0.map { Int($0.rounded()) }
            restMax = p.1.map { Int($0.rounded()) }
        } else {
            restMin = try c.decodeIfPresent(Int.self, forKey: .restMin)
            restMax = try c.decodeIfPresent(Int.self, forKey: .restMax)
        }
        streakMin = try c.decodeIfPresent(String.self, forKey: .streakMin) ?? ""
        streakMax = try c.decodeIfPresent(String.self, forKey: .streakMax) ?? ""
        lastResult = try c.decodeIfPresent(String.self, forKey: .lastResult) ?? "any"
        lastMarginMin = try c.decodeIfPresent(String.self, forKey: .lastMarginMin) ?? ""
        lastMarginMax = try c.decodeIfPresent(String.self, forKey: .lastMarginMax) ?? ""
        sp = try c.decodeIfPresent([MlbPitcherOption].self, forKey: .sp) ?? []
        oppSp = try c.decodeIfPresent([MlbPitcherOption].self, forKey: .oppSp) ?? []
        spHand = try c.decodeIfPresent(String.self, forKey: .spHand) ?? "any"
        oppSpHand = try c.decodeIfPresent(String.self, forKey: .oppSpHand) ?? "any"
        windMin = try c.decodeIfPresent(Int.self, forKey: .windMin)
        windDir = try c.decodeIfPresent(String.self, forKey: .windDir) ?? "any"
        if let p = Self.altPair(alt, .pfRuns) {
            pfRunsMin = p.0; pfRunsMax = p.1
        } else {
            pfRunsMin = try c.decodeIfPresent(Double.self, forKey: .pfRunsMin)
            pfRunsMax = try c.decodeIfPresent(Double.self, forKey: .pfRunsMax)
        }
        if let p = Self.altPair(alt, .f5TotalRange) {
            f5TotalMin = p.0 ?? 2; f5TotalMax = p.1 ?? 8
        } else {
            f5TotalMin = try c.decodeIfPresent(Double.self, forKey: .f5TotalMin) ?? 2
            f5TotalMax = try c.decodeIfPresent(Double.self, forKey: .f5TotalMax) ?? 8
        }
        timeMin = try c.decodeIfPresent(String.self, forKey: .timeMin) ?? ""
        timeMax = try c.decodeIfPresent(String.self, forKey: .timeMax) ?? ""
        if let p = Self.altPair(alt, .spXfip) {
            spXfipMin = p.0 ?? 2; spXfipMax = p.1 ?? 7
        } else {
            spXfipMin = try c.decodeIfPresent(Double.self, forKey: .spXfipMin) ?? 2
            spXfipMax = try c.decodeIfPresent(Double.self, forKey: .spXfipMax) ?? 7
        }
        if let p = Self.altPair(alt, .oppSpXfip) {
            oppSpXfipMin = p.0 ?? 2; oppSpXfipMax = p.1 ?? 7
        } else {
            oppSpXfipMin = try c.decodeIfPresent(Double.self, forKey: .oppSpXfipMin) ?? 2
            oppSpXfipMax = try c.decodeIfPresent(Double.self, forKey: .oppSpXfipMax) ?? 7
        }
        if let p = Self.altPair(alt, .bpIp) {
            bpIpMin = p.0 ?? 0; bpIpMax = p.1 ?? 20
        } else {
            bpIpMin = try c.decodeIfPresent(Double.self, forKey: .bpIpMin) ?? 0
            bpIpMax = try c.decodeIfPresent(Double.self, forKey: .bpIpMax) ?? 20
        }
        if let p = Self.altPair(alt, .bpXfip) {
            bpXfipMin = p.0 ?? 2; bpXfipMax = p.1 ?? 7
        } else {
            bpXfipMin = try c.decodeIfPresent(Double.self, forKey: .bpXfipMin) ?? 2
            bpXfipMax = try c.decodeIfPresent(Double.self, forKey: .bpXfipMax) ?? 7
        }
        rpg = try c.decodeIfPresent([Double].self, forKey: .rpg) ?? [0, 10]
        rapg = try c.decodeIfPresent([Double].self, forKey: .rapg) ?? [0, 10]
        runDiffPg = try c.decodeIfPresent([Double].self, forKey: .runDiffPg) ?? [-4, 4]
        rlCoverPct = try c.decodeIfPresent([Double].self, forKey: .rlCoverPct) ?? [0, 100]
        rlStreak = try c.decodeIfPresent([Int].self, forKey: .rlStreak) ?? [0, 25]
        h2hLastMargin = try c.decodeIfPresent([Int].self, forKey: .h2hLastMargin) ?? [-30, 30]
        oppRlCoverPct = try c.decodeIfPresent([Double].self, forKey: .oppRlCoverPct) ?? [0, 100]
        oppRpg = try c.decodeIfPresent([Double].self, forKey: .oppRpg) ?? [0, 10]
        oppRapg = try c.decodeIfPresent([Double].self, forKey: .oppRapg) ?? [0, 10]
        weather = try c.decodeIfPresent(String.self, forKey: .weather) ?? "any"
        lastAts = try c.decodeIfPresent(String.self, forKey: .lastAts) ?? "any"
        lastTotal = try c.decodeIfPresent(String.self, forKey: .lastTotal) ?? "any"
        lastRole = try c.decodeIfPresent(String.self, forKey: .lastRole) ?? "any"
        lastOt = try c.decodeIfPresent(Bool.self, forKey: .lastOt)
        lastBlowout = try c.decodeIfPresent(String.self, forKey: .lastBlowout) ?? "any"
        
        // NFL "as-of" fields with backward compatibility defaults.
        // Prefer try? — web jsonb can type-mismatch Int vs Double arrays and used
        // to throw, soft-falling the whole snapshot to defaults (empty restore).
        winPct = (try? c.decodeIfPresent([Double].self, forKey: .winPct)) ?? [0, 100]
        winStreak = (try? c.decodeIfPresent([Int].self, forKey: .winStreak))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .winStreak))?.map { Int($0.rounded()) }
            ?? [0, 16]
        lossStreak = (try? c.decodeIfPresent([Int].self, forKey: .lossStreak))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .lossStreak))?.map { Int($0.rounded()) }
            ?? [0, 16]
        above500 = try? c.decodeIfPresent(Bool.self, forKey: .above500)
        winPctGtOpp = try? c.decodeIfPresent(Bool.self, forKey: .winPctGtOpp)
        ppg = (try? c.decodeIfPresent([Double].self, forKey: .ppg)) ?? [0, 40]
        paPg = (try? c.decodeIfPresent([Double].self, forKey: .paPg)) ?? [0, 40]
        pointDiffPg = (try? c.decodeIfPresent([Double].self, forKey: .pointDiffPg)) ?? [-20, 20]
        minGames = (try? c.decodeIfPresent(Int.self, forKey: .minGames)) ?? 0
        atsWinPct = (try? c.decodeIfPresent([Double].self, forKey: .atsWinPct)) ?? [0, 100]
        atsWinStreak = (try? c.decodeIfPresent([Int].self, forKey: .atsWinStreak))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .atsWinStreak))?.map { Int($0.rounded()) }
            ?? [0, 16]
        avgCoverMargin = (try? c.decodeIfPresent([Double].self, forKey: .avgCoverMargin)) ?? [-15, 15]
        overPct = (try? c.decodeIfPresent([Double].self, forKey: .overPct)) ?? [0, 100]
        overStreak = (try? c.decodeIfPresent([Int].self, forKey: .overStreak))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .overStreak))?.map { Int($0.rounded()) }
            ?? [0, 16]
        underStreak = (try? c.decodeIfPresent([Int].self, forKey: .underStreak))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .underStreak))?.map { Int($0.rounded()) }
            ?? [0, 16]
        prevWins = (try? c.decodeIfPresent([Int].self, forKey: .prevWins))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .prevWins))?.map { Int($0.rounded()) }
            ?? [0, 16]
        prevWinPct = (try? c.decodeIfPresent([Double].self, forKey: .prevWinPct)) ?? [0, 100]
        madePlayoffsPrev = try? c.decodeIfPresent(Bool.self, forKey: .madePlayoffsPrev)
        moreWinsThanOppPrev = try? c.decodeIfPresent(Bool.self, forKey: .moreWinsThanOppPrev)
        h2hLastWin = (try? c.decodeIfPresent(String.self, forKey: .h2hLastWin)) ?? "any"
        h2hLastAts = (try? c.decodeIfPresent(String.self, forKey: .h2hLastAts)) ?? "any"
        h2hLastOver = (try? c.decodeIfPresent(String.self, forKey: .h2hLastOver)) ?? "any"
        h2hLastHome = try? c.decodeIfPresent(Bool.self, forKey: .h2hLastHome)
        h2hLastFav = try? c.decodeIfPresent(Bool.self, forKey: .h2hLastFav)
        h2hSameSeason = try? c.decodeIfPresent(Bool.self, forKey: .h2hSameSeason)
        h2hSpreadCmp = (try? c.decodeIfPresent(String.self, forKey: .h2hSpreadCmp)) ?? "any"
        oppWinPct = (try? c.decodeIfPresent([Double].self, forKey: .oppWinPct)) ?? [0, 100]
        oppOverPct = (try? c.decodeIfPresent([Double].self, forKey: .oppOverPct)) ?? [0, 100]
        oppWinStreak = (try? c.decodeIfPresent([Int].self, forKey: .oppWinStreak))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .oppWinStreak))?.map { Int($0.rounded()) }
            ?? [0, 16]
        oppLossStreak = (try? c.decodeIfPresent([Int].self, forKey: .oppLossStreak))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .oppLossStreak))?.map { Int($0.rounded()) }
            ?? [0, 16]
        oppPpg = (try? c.decodeIfPresent([Double].self, forKey: .oppPpg)) ?? [0, 40]
        oppPaPg = (try? c.decodeIfPresent([Double].self, forKey: .oppPaPg)) ?? [0, 40]
        oppPrevWinPct = (try? c.decodeIfPresent([Double].self, forKey: .oppPrevWinPct)) ?? [0, 100]
        oppLastResult = (try? c.decodeIfPresent(String.self, forKey: .oppLastResult)) ?? "any"
        oppLastAts = (try? c.decodeIfPresent(String.self, forKey: .oppLastAts)) ?? "any"
        oppLastTotal = (try? c.decodeIfPresent(String.self, forKey: .oppLastTotal)) ?? "any"
        oppLastRole = (try? c.decodeIfPresent(String.self, forKey: .oppLastRole)) ?? "any"
        oppLastOt = try? c.decodeIfPresent(Bool.self, forKey: .oppLastOt)
        oppLastMargin = (try? c.decodeIfPresent([Int].self, forKey: .oppLastMargin))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .oppLastMargin))?.map { Int($0.rounded()) }
            ?? [-60, 60]
        lastMargin = (try? c.decodeIfPresent([Int].self, forKey: .lastMargin))
            ?? (try? c.decodeIfPresent([Double].self, forKey: .lastMargin))?.map { Int($0.rounded()) }
            ?? [-60, 60]
        daysOfWeek = (try? c.decodeIfPresent([String].self, forKey: .daysOfWeek)) ?? []
        teamDivisions = (try? c.decodeIfPresent([String].self, forKey: .teamDivisions)) ?? []
    }

    /// JSON numbers often arrive as Double from jsonb — accept either.
    private static func decodeInt(
        _ c: KeyedDecodingContainer<CodingKeys>,
        _ key: CodingKeys
    ) -> Int? {
        if let v = try? c.decodeIfPresent(Int.self, forKey: key) { return v }
        if let v = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(v.rounded()) }
        return nil
    }

    private static func decodeDouble(
        _ c: KeyedDecodingContainer<CodingKeys>,
        _ key: CodingKeys
    ) -> Double? {
        if let v = try? c.decodeIfPresent(Double.self, forKey: key) { return v }
        if let v = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(v) }
        return nil
    }

    private static func decodeAltDouble(
        _ c: KeyedDecodingContainer<AltKeys>,
        _ key: AltKeys
    ) -> Double? {
        if let v = try? c.decodeIfPresent(Double.self, forKey: key) { return v }
        if let v = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(v) }
        return nil
    }

    // MARK: - Side Market Symmetry (B2)
    
    /// Two-sided markets that contribute mirror rows per game
    public static let sideMarkets: Set<String> = ["fg_spread", "fg_ml", "h1_spread", "h1_ml"]
    
    /// Game-level filter dimensions that keep both mirror rows (don't break side symmetry)
    public static let sideSymmetricDims: Set<String> = [
        "seasons", "weeks", "seasonType", "playoffRound", "lineRange", "spreadSize", 
        "primetime", "division", "dome", "tempRange", "windMax", "precip", "referee", 
        "daysOfWeek", "minGames"
    ]
    
    /// Checks if current snapshot is in symmetric state (forced ~50% overall on two-sided market)
    public func isSideSymmetric(sport: HistoricalAnalysisSport) -> Bool {
        guard Self.sideMarkets.contains(betType) else { return false }
        
        let defaults = Self.defaults(for: sport)
        
        // Check if all side-breaking dimensions are at defaults
        return (
            side == defaults.side &&
            teams.isEmpty && opponents.isEmpty &&
            favDog == defaults.favDog &&
            spreadSide == defaults.spreadSide &&
            mlMin.isEmpty && mlMax.isEmpty &&
            h1SpreadSide == defaults.h1SpreadSide &&
            h1SpreadMin == defaults.h1SpreadMin &&
            h1SpreadMax == defaults.h1SpreadMax &&
            h1MlMin.isEmpty && h1MlMax.isEmpty &&
            h1TotalMin == defaults.h1TotalMin &&
            h1TotalMax == defaults.h1TotalMax &&
            ttLineMin == defaults.ttLineMin &&
            ttLineMax == defaults.ttLineMax &&
            oppSpreadSide == defaults.oppSpreadSide &&
            oppSpreadMin == defaults.oppSpreadMin &&
            oppSpreadMax == defaults.oppSpreadMax &&
            oppMlMin.isEmpty && oppMlMax.isEmpty &&
            oppTtLineMin == defaults.oppTtLineMin &&
            oppTtLineMax == defaults.oppTtLineMax &&
            lastResult == defaults.lastResult &&
            lastAts == defaults.lastAts &&
            lastTotal == defaults.lastTotal &&
            lastRole == defaults.lastRole &&
            lastOt == defaults.lastOt &&
            lastMargin == defaults.lastMargin &&
            oppLastResult == defaults.oppLastResult &&
            oppLastAts == defaults.oppLastAts &&
            oppLastTotal == defaults.oppLastTotal &&
            oppLastRole == defaults.oppLastRole &&
            oppLastOt == defaults.oppLastOt &&
            oppLastMargin == defaults.oppLastMargin &&
            winPct == defaults.winPct &&
            winStreak == defaults.winStreak &&
            lossStreak == defaults.lossStreak &&
            above500 == defaults.above500 &&
            winPctGtOpp == defaults.winPctGtOpp &&
            ppg == defaults.ppg &&
            paPg == defaults.paPg &&
            pointDiffPg == defaults.pointDiffPg &&
            atsWinPct == defaults.atsWinPct &&
            atsWinStreak == defaults.atsWinStreak &&
            avgCoverMargin == defaults.avgCoverMargin &&
            overPct == defaults.overPct &&
            overStreak == defaults.overStreak &&
            underStreak == defaults.underStreak &&
            prevWins == defaults.prevWins &&
            prevWinPct == defaults.prevWinPct &&
            madePlayoffsPrev == defaults.madePlayoffsPrev &&
            moreWinsThanOppPrev == defaults.moreWinsThanOppPrev &&
            h2hLastWin == defaults.h2hLastWin &&
            h2hLastAts == defaults.h2hLastAts &&
            h2hLastOver == defaults.h2hLastOver &&
            h2hLastHome == defaults.h2hLastHome &&
            h2hLastFav == defaults.h2hLastFav &&
            h2hSameSeason == defaults.h2hSameSeason &&
            h2hSpreadCmp == defaults.h2hSpreadCmp &&
            oppWinPct == defaults.oppWinPct &&
            oppOverPct == defaults.oppOverPct &&
            oppWinStreak == defaults.oppWinStreak &&
            oppLossStreak == defaults.oppLossStreak &&
            oppPpg == defaults.oppPpg &&
            oppPaPg == defaults.oppPaPg &&
            oppPrevWinPct == defaults.oppPrevWinPct &&
            coach == defaults.coach &&
            restBye == defaults.restBye &&
            teamDivisions.isEmpty
        )
    }

    /// MLB two-sided markets — mirrors web `MLB_SIDE_MARKETS`.
    public static let mlbSideMarkets: Set<String> = ["ml", "rl", "f5_ml", "f5_rl"]

    /// True when the current MLB snapshot is in the symmetric ~50% state on a
    /// two-sided market — mirrors web `isSideSymmetricMlb` /
    /// `MLB_SIDE_SYMMETRIC_DIMS`. Dims NOT listed here are "side-breaking":
    /// they must all be at their defaults for the split to still be symmetric.
    public func isSideSymmetricMlb() -> Bool {
        guard Self.mlbSideMarkets.contains(betType) else { return false }
        let d = Self.defaults(for: .mlb)
        return (
            teams.isEmpty && opponents.isEmpty &&
            side == d.side && favDog == d.favDog &&
            mlMin.isEmpty && mlMax.isEmpty &&
            tripMin == nil && tripMax == nil &&
            switchGame == nil &&
            restMin == nil && restMax == nil &&
            sp.isEmpty && oppSp.isEmpty &&
            spHand == d.spHand && oppSpHand == d.oppSpHand &&
            spXfipMin == d.spXfipMin && spXfipMax == d.spXfipMax &&
            oppSpXfipMin == d.oppSpXfipMin && oppSpXfipMax == d.oppSpXfipMax &&
            bpIpMin == d.bpIpMin && bpIpMax == d.bpIpMax &&
            bpXfipMin == d.bpXfipMin && bpXfipMax == d.bpXfipMax &&
            lastResult == d.lastResult && lastAts == d.lastAts &&
            lastTotal == d.lastTotal && lastRole == d.lastRole &&
            lastMargin == d.lastMargin &&
            streakMin == d.streakMin && streakMax == d.streakMax &&
            oppLastResult == d.oppLastResult && oppLastAts == d.oppLastAts &&
            oppLastTotal == d.oppLastTotal && oppLastRole == d.oppLastRole &&
            oppLastMargin == d.oppLastMargin &&
            winPct == d.winPct && winStreak == d.winStreak && lossStreak == d.lossStreak &&
            rlCoverPct == d.rlCoverPct && rlStreak == d.rlStreak &&
            overPct == d.overPct && overStreak == d.overStreak && underStreak == d.underStreak &&
            rpg == d.rpg && rapg == d.rapg && runDiffPg == d.runDiffPg &&
            prevWins == d.prevWins && prevWinPct == d.prevWinPct &&
            // `minGames` is in web's MLB_SIDE_SYMMETRIC_DIMS — a sample-size
            // floor applies identically to both ML sides, so narrowing it does
            // NOT break the forced ~50% split (unlike every other Season
            // Record dim above, which is per-team and DOES break it).
            h2hLastWin == d.h2hLastWin && h2hLastAts == d.h2hLastAts && h2hLastOver == d.h2hLastOver &&
            h2hLastMargin == d.h2hLastMargin &&
            h2hLastHome == d.h2hLastHome && h2hLastFav == d.h2hLastFav && h2hSameSeason == d.h2hSameSeason &&
            oppWinPct == d.oppWinPct && oppOverPct == d.oppOverPct && oppRlCoverPct == d.oppRlCoverPct &&
            oppWinStreak == d.oppWinStreak && oppLossStreak == d.oppLossStreak &&
            oppRpg == d.oppRpg && oppRapg == d.oppRapg &&
            oppPrevWinPct == d.oppPrevWinPct
        )
    }

    public static func defaults(for sport: HistoricalAnalysisSport) -> HistoricalAnalysisUISnapshot {
        switch sport {
        case .mlb:
            return HistoricalAnalysisUISnapshot(
                betType: HistoricalAnalysisBetType.ml.rawValue,
                seasonMin: max(sport.defaultSeasonFloor, sport.seasonMax - 1),
                seasonMax: sport.seasonMax,
                weekMin: 1,
                weekMax: 18,
                side: "any",
                favDog: "any",
                spreadSide: "any",
                spreadMin: 0,
                spreadMax: 20,
                lineMin: 5,
                lineMax: 14,
                mlMin: "",
                mlMax: "",
                h1SpreadMax: 14,
                h1TotalMin: 15,
                h1TotalMax: 35,
                ttLineMin: 10,
                ttLineMax: 40,
                oppSpreadMax: 20,
                oppTtLineMin: 10,
                oppTtLineMax: 40,
                primetime: nil,
                tempMin: -10,
                tempMax: 110,
                windMax: 60,
                seasonType: "any",
                playoffRound: "any",
                division: nil,
                dome: "any",
                precip: "any",
                restBye: "any",
                coach: "any",
                referee: "any",
                gameType: "any",
                rankedMatchup: "any",
                conferenceGame: nil,
                neutralSite: nil,
                conference: "any",
                selectedConferences: [],
                monthMin: 3,
                monthMax: 11,
                // MLB reuses these football fields with wider/shifted default
                // ranges (web MLB_SNAPSHOT_DEFAULTS) — must match the builder's
                // narrowed-from-default comparisons or an untouched slider would
                // emit an RPC key.
                winStreak: [0, 25],
                lossStreak: [0, 25],
                overStreak: [0, 25],
                underStreak: [0, 25],
                prevWins: [0, 120],
                oppWinStreak: [0, 25],
                oppLossStreak: [0, 25],
                oppLastMargin: [-30, 30],
                lastMargin: [-30, 30]
            )
        case .nfl, .cfb:
            return HistoricalAnalysisUISnapshot(
                betType: HistoricalAnalysisBetType.fgSpread.rawValue,
                // Web-parity default windows (NFL last 3 seasons, CFB current) —
                // deep-history default scans are the statement-timeout risk.
                seasonMin: sport == .nfl ? max(sport.defaultSeasonFloor, sport.seasonMax - 2) : sport.seasonMax,
                seasonMax: sport.seasonMax,
                weekMin: 1,
                weekMax: sport == .nfl ? 18 : 16,
                side: "any",
                favDog: "any",
                spreadSide: "any",
                spreadMin: 0,
                spreadMax: sport == .nfl ? 20 : 50,
                lineMin: 30,
                lineMax: sport == .nfl ? 60 : 80,
                mlMin: "",
                mlMax: "",
                h1SpreadMax: sport == .nfl ? 14 : 28,
                h1TotalMin: 15,
                h1TotalMax: sport == .nfl ? 35 : 45,
                ttLineMin: 10,
                ttLineMax: sport == .nfl ? 40 : 55,
                oppSpreadMax: sport == .nfl ? 20 : 50,
                oppTtLineMin: 10,
                oppTtLineMax: sport == .nfl ? 40 : 55,
                primetime: nil,
                tempMin: -10,
                tempMax: sport == .nfl ? 100 : 110,
                windMax: 60,
                seasonType: "any",
                playoffRound: "any",
                division: nil,
                dome: "any",
                precip: "any",
                restBye: "any",
                coach: "any",
                referee: "any",
                gameType: "any",
                rankedMatchup: "any",
                conferenceGame: nil,
                neutralSite: nil,
                conference: "any",
                selectedConferences: [],
                // As-of range defaults MUST match the builder's per-sport
                // defaultRange comparisons (buildRPCFilters) — CFB scoring runs
                // higher than NFL. A mismatch makes every CFB query emit
                // spurious ppg/margin bounds that silently narrow results.
                ppg: sport == .cfb ? [0, 60] : [0, 40],
                paPg: sport == .cfb ? [0, 60] : [0, 40],
                pointDiffPg: sport == .cfb ? [-40, 40] : [-20, 20],
                avgCoverMargin: sport == .cfb ? [-30, 30] : [-15, 15],
                prevWins: sport == .cfb ? [0, 15] : [0, 16],
                oppPpg: sport == .cfb ? [0, 60] : [0, 40],
                oppPaPg: sport == .cfb ? [0, 60] : [0, 40],
                oppLastMargin: sport == .cfb ? [-80, 80] : [-60, 60],
                lastMargin: sport == .cfb ? [-80, 80] : [-60, 60]
            )
        }
    }
}
