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
        h1SpreadSide = try c.decodeIfPresent(String.self, forKey: .h1SpreadSide) ?? "any"
        h1SpreadMin = try c.decodeIfPresent(Double.self, forKey: .h1SpreadMin) ?? 0
        h1SpreadMax = try c.decodeIfPresent(Double.self, forKey: .h1SpreadMax) ?? 14
        h1MlMin = try c.decodeIfPresent(String.self, forKey: .h1MlMin) ?? ""
        h1MlMax = try c.decodeIfPresent(String.self, forKey: .h1MlMax) ?? ""
        h1TotalMin = try c.decodeIfPresent(Double.self, forKey: .h1TotalMin) ?? 15
        h1TotalMax = try c.decodeIfPresent(Double.self, forKey: .h1TotalMax) ?? 35
        ttLineMin = try c.decodeIfPresent(Double.self, forKey: .ttLineMin) ?? 10
        ttLineMax = try c.decodeIfPresent(Double.self, forKey: .ttLineMax) ?? 40
        oppSpreadSide = try c.decodeIfPresent(String.self, forKey: .oppSpreadSide) ?? "any"
        oppSpreadMin = try c.decodeIfPresent(Double.self, forKey: .oppSpreadMin) ?? 0
        oppSpreadMax = try c.decodeIfPresent(Double.self, forKey: .oppSpreadMax) ?? 20
        oppMlMin = try c.decodeIfPresent(String.self, forKey: .oppMlMin) ?? ""
        oppMlMax = try c.decodeIfPresent(String.self, forKey: .oppMlMax) ?? ""
        oppTtLineMin = try c.decodeIfPresent(Double.self, forKey: .oppTtLineMin) ?? 10
        oppTtLineMax = try c.decodeIfPresent(Double.self, forKey: .oppTtLineMax) ?? 40
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
        
        // NFL "as-of" fields with backward compatibility defaults
        winPct = try c.decodeIfPresent([Double].self, forKey: .winPct) ?? [0, 100]
        winStreak = try c.decodeIfPresent([Int].self, forKey: .winStreak) ?? [0, 16]
        lossStreak = try c.decodeIfPresent([Int].self, forKey: .lossStreak) ?? [0, 16]
        above500 = try c.decodeIfPresent(Bool.self, forKey: .above500)
        winPctGtOpp = try c.decodeIfPresent(Bool.self, forKey: .winPctGtOpp)
        ppg = try c.decodeIfPresent([Double].self, forKey: .ppg) ?? [0, 40]
        paPg = try c.decodeIfPresent([Double].self, forKey: .paPg) ?? [0, 40]
        pointDiffPg = try c.decodeIfPresent([Double].self, forKey: .pointDiffPg) ?? [-20, 20]
        minGames = try c.decodeIfPresent(Int.self, forKey: .minGames) ?? 0
        atsWinPct = try c.decodeIfPresent([Double].self, forKey: .atsWinPct) ?? [0, 100]
        atsWinStreak = try c.decodeIfPresent([Int].self, forKey: .atsWinStreak) ?? [0, 16]
        avgCoverMargin = try c.decodeIfPresent([Double].self, forKey: .avgCoverMargin) ?? [-15, 15]
        overPct = try c.decodeIfPresent([Double].self, forKey: .overPct) ?? [0, 100]
        overStreak = try c.decodeIfPresent([Int].self, forKey: .overStreak) ?? [0, 16]
        underStreak = try c.decodeIfPresent([Int].self, forKey: .underStreak) ?? [0, 16]
        prevWins = try c.decodeIfPresent([Int].self, forKey: .prevWins) ?? [0, 16]
        prevWinPct = try c.decodeIfPresent([Double].self, forKey: .prevWinPct) ?? [0, 100]
        madePlayoffsPrev = try c.decodeIfPresent(Bool.self, forKey: .madePlayoffsPrev)
        moreWinsThanOppPrev = try c.decodeIfPresent(Bool.self, forKey: .moreWinsThanOppPrev)
        h2hLastWin = try c.decodeIfPresent(String.self, forKey: .h2hLastWin) ?? "any"
        h2hLastAts = try c.decodeIfPresent(String.self, forKey: .h2hLastAts) ?? "any"
        h2hLastOver = try c.decodeIfPresent(String.self, forKey: .h2hLastOver) ?? "any"
        h2hLastHome = try c.decodeIfPresent(Bool.self, forKey: .h2hLastHome)
        h2hLastFav = try c.decodeIfPresent(Bool.self, forKey: .h2hLastFav)
        h2hSameSeason = try c.decodeIfPresent(Bool.self, forKey: .h2hSameSeason)
        h2hSpreadCmp = try c.decodeIfPresent(String.self, forKey: .h2hSpreadCmp) ?? "any"
        oppWinPct = try c.decodeIfPresent([Double].self, forKey: .oppWinPct) ?? [0, 100]
        oppOverPct = try c.decodeIfPresent([Double].self, forKey: .oppOverPct) ?? [0, 100]
        oppWinStreak = try c.decodeIfPresent([Int].self, forKey: .oppWinStreak) ?? [0, 16]
        oppLossStreak = try c.decodeIfPresent([Int].self, forKey: .oppLossStreak) ?? [0, 16]
        oppPpg = try c.decodeIfPresent([Double].self, forKey: .oppPpg) ?? [0, 40]
        oppPaPg = try c.decodeIfPresent([Double].self, forKey: .oppPaPg) ?? [0, 40]
        oppPrevWinPct = try c.decodeIfPresent([Double].self, forKey: .oppPrevWinPct) ?? [0, 100]
        oppLastResult = try c.decodeIfPresent(String.self, forKey: .oppLastResult) ?? "any"
        oppLastAts = try c.decodeIfPresent(String.self, forKey: .oppLastAts) ?? "any"
        oppLastTotal = try c.decodeIfPresent(String.self, forKey: .oppLastTotal) ?? "any"
        oppLastRole = try c.decodeIfPresent(String.self, forKey: .oppLastRole) ?? "any"
        oppLastOt = try c.decodeIfPresent(Bool.self, forKey: .oppLastOt)
        oppLastMargin = try c.decodeIfPresent([Int].self, forKey: .oppLastMargin) ?? [-60, 60]
        lastMargin = try c.decodeIfPresent([Int].self, forKey: .lastMargin) ?? [-60, 60]
        daysOfWeek = try c.decodeIfPresent([String].self, forKey: .daysOfWeek) ?? []
        teamDivisions = try c.decodeIfPresent([String].self, forKey: .teamDivisions) ?? []
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
                selectedConferences: []
            )
        }
    }
}
