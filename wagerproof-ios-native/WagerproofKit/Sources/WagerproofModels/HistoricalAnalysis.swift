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
        case .nfl, .cfb: return !moneylineMarkets.contains(betType)
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
}

public struct HistoricalAnalysisUpcomingGame: Codable, Sendable, Equatable, Identifiable {
    public let team: String
    public let opponent: String
    public let isHome: Bool
    public let isFavorite: Bool
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
}

// MARK: - Saved filters (main Supabase project)

public struct HistoricalAnalysisSavedFilter: Codable, Identifiable, Sendable, Equatable {
    public let id: UUID
    public let userId: UUID
    public let name: String
    public let betType: String
    public let filters: HistoricalAnalysisUISnapshot
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, filters
        case userId = "user_id"
        case betType = "bet_type"
        case createdAt = "created_at"
    }
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

    enum CodingKeys: String, CodingKey {
        case betType, seasonMin, seasonMax, weekMin, weekMax
        case side, favDog, spreadSide, spreadMin, spreadMax
        case lineMin, lineMax, mlMin, mlMax, primetime
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
        weather: String = "any",
        lastAts: String = "any",
        lastTotal: String = "any",
        lastRole: String = "any",
        lastOt: Bool? = nil,
        lastBlowout: String = "any"
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
        self.weather = weather
        self.lastAts = lastAts
        self.lastTotal = lastTotal
        self.lastRole = lastRole
        self.lastOt = lastOt
        self.lastBlowout = lastBlowout
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        betType = try c.decode(String.self, forKey: .betType)
        seasonMin = try c.decode(Int.self, forKey: .seasonMin)
        seasonMax = try c.decode(Int.self, forKey: .seasonMax)
        weekMin = try c.decode(Int.self, forKey: .weekMin)
        weekMax = try c.decode(Int.self, forKey: .weekMax)
        side = try c.decode(String.self, forKey: .side)
        favDog = try c.decode(String.self, forKey: .favDog)
        spreadSide = try c.decode(String.self, forKey: .spreadSide)
        spreadMin = try c.decode(Double.self, forKey: .spreadMin)
        spreadMax = try c.decode(Double.self, forKey: .spreadMax)
        lineMin = try c.decode(Double.self, forKey: .lineMin)
        lineMax = try c.decode(Double.self, forKey: .lineMax)
        mlMin = try c.decode(String.self, forKey: .mlMin)
        mlMax = try c.decode(String.self, forKey: .mlMax)
        primetime = try c.decodeIfPresent(Bool.self, forKey: .primetime)
        tempMin = try c.decode(Int.self, forKey: .tempMin)
        tempMax = try c.decode(Int.self, forKey: .tempMax)
        windMax = try c.decode(Int.self, forKey: .windMax)
        seasonType = try c.decode(String.self, forKey: .seasonType)
        playoffRound = try c.decode(String.self, forKey: .playoffRound)
        division = try c.decodeIfPresent(Bool.self, forKey: .division)
        dome = try c.decode(String.self, forKey: .dome)
        precip = try c.decode(String.self, forKey: .precip)
        restBye = try c.decode(String.self, forKey: .restBye)
        coach = try c.decode(String.self, forKey: .coach)
        referee = try c.decode(String.self, forKey: .referee)
        gameType = try c.decode(String.self, forKey: .gameType)
        rankedMatchup = try c.decode(String.self, forKey: .rankedMatchup)
        conferenceGame = try c.decodeIfPresent(Bool.self, forKey: .conferenceGame)
        neutralSite = try c.decodeIfPresent(Bool.self, forKey: .neutralSite)
        conference = try c.decode(String.self, forKey: .conference)
        selectedConferences = try c.decodeIfPresent([String].self, forKey: .selectedConferences) ?? []

        monthMin = try c.decodeIfPresent(Int.self, forKey: .monthMin) ?? 3
        monthMax = try c.decodeIfPresent(Int.self, forKey: .monthMax) ?? 11
        teams = try c.decodeIfPresent([String].self, forKey: .teams) ?? []
        opponents = try c.decodeIfPresent([String].self, forKey: .opponents) ?? []
        interleague = try c.decodeIfPresent(Bool.self, forKey: .interleague)
        dayOfWeek = try c.decodeIfPresent(String.self, forKey: .dayOfWeek) ?? "any"
        doubleheader = try c.decodeIfPresent(Bool.self, forKey: .doubleheader)
        seriesGameMin = try c.decodeIfPresent(Int.self, forKey: .seriesGameMin)
        seriesGameMax = try c.decodeIfPresent(Int.self, forKey: .seriesGameMax)
        tripMin = try c.decodeIfPresent(Int.self, forKey: .tripMin)
        tripMax = try c.decodeIfPresent(Int.self, forKey: .tripMax)
        switchGame = try c.decodeIfPresent(Bool.self, forKey: .switchGame)
        restMin = try c.decodeIfPresent(Int.self, forKey: .restMin)
        restMax = try c.decodeIfPresent(Int.self, forKey: .restMax)
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
        pfRunsMin = try c.decodeIfPresent(Double.self, forKey: .pfRunsMin)
        pfRunsMax = try c.decodeIfPresent(Double.self, forKey: .pfRunsMax)
        weather = try c.decodeIfPresent(String.self, forKey: .weather) ?? "any"
        lastAts = try c.decodeIfPresent(String.self, forKey: .lastAts) ?? "any"
        lastTotal = try c.decodeIfPresent(String.self, forKey: .lastTotal) ?? "any"
        lastRole = try c.decodeIfPresent(String.self, forKey: .lastRole) ?? "any"
        lastOt = try c.decodeIfPresent(Bool.self, forKey: .lastOt)
        lastBlowout = try c.decodeIfPresent(String.self, forKey: .lastBlowout) ?? "any"
    }

    public static func defaults(for sport: HistoricalAnalysisSport) -> HistoricalAnalysisUISnapshot {
        switch sport {
        case .mlb:
            return HistoricalAnalysisUISnapshot(
                betType: HistoricalAnalysisBetType.ml.rawValue,
                seasonMin: sport.defaultSeasonFloor,
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
                monthMax: 11
            )
        case .nfl, .cfb:
            return HistoricalAnalysisUISnapshot(
                betType: HistoricalAnalysisBetType.fgSpread.rawValue,
                seasonMin: sport.defaultSeasonFloor,
                seasonMax: sport.seasonMax,
                weekMin: 1,
                weekMax: sport == .nfl ? 18 : 16,
                side: "any",
                favDog: "any",
                spreadSide: "any",
                spreadMin: 0,
                spreadMax: sport == .nfl ? 20 : 28,
                lineMin: 30,
                lineMax: sport == .nfl ? 60 : 80,
                mlMin: "",
                mlMax: "",
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
                selectedConferences: []
            )
        }
    }
}
