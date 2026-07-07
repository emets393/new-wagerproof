import Foundation

// MARK: - Sport

/// NFL vs CFB — drives RPC names, filter keys, and breakdown dimensions.
/// See `.claude/docs/15_mobile_historical_analysis.md`.
public enum HistoricalAnalysisSport: String, Codable, Sendable, Hashable, CaseIterable, Identifiable {
    case nfl
    case cfb

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .nfl: return "NFL Historical Analysis"
        case .cfb: return "CFB Historical Analysis"
        }
    }

    public var shortTitle: String {
        switch self {
        case .nfl: return "NFL"
        case .cfb: return "CFB"
        }
    }

    public var analysisRPC: String {
        switch self {
        case .nfl: return "nfl_analysis"
        case .cfb: return "cfb_analysis"
        }
    }

    public var upcomingRPC: String {
        switch self {
        case .nfl: return "nfl_analysis_upcoming"
        case .cfb: return "cfb_analysis_upcoming"
        }
    }

    public var savedFiltersTable: String {
        switch self {
        case .nfl: return "nfl_analysis_saved_filters"
        case .cfb: return "cfb_analysis_saved_filters"
        }
    }

    public var defaultSeasonFloor: Int {
        switch self {
        case .nfl: return 2018
        case .cfb: return 2016
        }
    }

    public static let seasonMax = 2025
}

// MARK: - Bet types

public enum HistoricalAnalysisBetType: String, CaseIterable, Identifiable, Sendable {
    case fgSpread = "fg_spread"
    case fgML = "fg_ml"
    case fgTotal = "fg_total"
    case teamTotal = "team_total"
    case h1Spread = "h1_spread"
    case h1ML = "h1_ml"
    case h1Total = "h1_total"

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
        }
    }

    public var group: String {
        switch self {
        case .fgSpread, .fgML, .fgTotal, .teamTotal: return "Full Game"
        case .h1Spread, .h1ML, .h1Total: return "First Half"
        }
    }

    public static let limitedHistory: Set<String> = [
        "h1_spread", "h1_ml", "h1_total", "team_total",
    ]

    public static let moneylineMarkets: Set<String> = ["fg_ml", "h1_ml"]

    public static func from(_ raw: String) -> HistoricalAnalysisBetType {
        HistoricalAnalysisBetType(rawValue: raw) ?? .fgSpread
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
    public let n: Int
    public let hitPct: Double
    public let roi: Double?

    public var id: String {
        team ?? coach ?? referee ?? conference ?? "\(n)-\(hitPct)"
    }

    public var label: String {
        team ?? coach ?? referee ?? conference ?? "—"
    }

    enum CodingKeys: String, CodingKey {
        case team, coach, referee, conference, n
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

    enum CodingKeys: String, CodingKey {
        case betType = "bet_type"
        case coverage
        case baselinePct = "baseline_pct"
        case overall, bars
        case byTeam = "by_team"
        case byCoach = "by_coach"
        case byReferee = "by_referee"
        case byConference = "by_conference"
    }
}

public struct HistoricalAnalysisUpcomingGame: Codable, Sendable, Equatable, Identifiable {
    public let team: String
    public let opponent: String
    public let isHome: Bool
    public let isFavorite: Bool
    public let matchup: String
    public let kickoff: String
    public let teamSpread: Double?
    public let total: Double?
    public let ttLine: Double?
    public let h1Spread: Double?
    public let h1Total: Double?
    public let referee: String?

    public var id: String { "\(team)-\(kickoff)" }

    enum CodingKeys: String, CodingKey {
        case team, opponent, matchup, kickoff, total, referee
        case isHome = "is_home"
        case isFavorite = "is_favorite"
        case teamSpread = "team_spread"
        case ttLine = "tt_line"
        case h1Spread = "h1_spread"
        case h1Total = "h1_total"
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

    public static func defaults(for sport: HistoricalAnalysisSport) -> HistoricalAnalysisUISnapshot {
        HistoricalAnalysisUISnapshot(
            betType: HistoricalAnalysisBetType.fgSpread.rawValue,
            seasonMin: sport.defaultSeasonFloor,
            seasonMax: HistoricalAnalysisSport.seasonMax,
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
