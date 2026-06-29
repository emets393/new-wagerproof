import Foundation

// MARK: - Filters

public enum OutliersTrendsSport: String, CaseIterable, Identifiable, Sendable, Hashable {
    case nfl, ncaaf, mlb, nba, ncaab

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .nfl: return "NFL"
        case .ncaaf: return "NCAAF"
        case .mlb: return "MLB"
        case .nba: return "NBA"
        case .ncaab: return "NCAAB"
        }
    }

    public var hasTrendsData: Bool { self == .nfl || self == .ncaaf || self == .mlb }

    public var allowedSubjects: [OutliersTrendsSubject] {
        switch self {
        case .nfl: return [.all, .teams, .coaches, .refs, .players]
        case .ncaaf: return [.all, .teams, .coaches]
        case .mlb: return [.teams]
        default: return []
        }
    }

    public var usesClientSideTrendCards: Bool { self == .mlb }
}

public enum OutliersTrendsSubject: String, CaseIterable, Identifiable, Sendable, Hashable {
    case all, teams, coaches, refs, players

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .all: return "All"
        case .teams: return "Teams"
        case .coaches: return "Coaches"
        case .refs: return "Refs"
        case .players: return "Players"
        }
    }
}

public enum OutliersTrendsGameMarket: String, CaseIterable, Identifiable, Sendable, Hashable {
    case all, spread, moneyline, total, teamTotal, h1Spread, h1Total
    case ml, rl, ou, f5Ml, f5Rl, f5Ou

    public var id: String { rawValue }

    public var dbKey: String? {
        switch self {
        case .all: return nil
        case .spread: return "spread"
        case .moneyline: return "moneyline"
        case .total: return "total"
        case .teamTotal: return "team_total"
        case .h1Spread: return "h1_spread"
        case .h1Total: return "h1_total"
        case .ml: return "ml"
        case .rl: return "rl"
        case .ou: return "ou"
        case .f5Ml: return "f5_ml"
        case .f5Rl: return "f5_rl"
        case .f5Ou: return "f5_ou"
        }
    }

    public var label: String {
        switch self {
        case .all: return "All bet types"
        case .spread: return "Spread"
        case .moneyline: return "Moneyline"
        case .total: return "Total"
        case .teamTotal: return "Team Total"
        case .h1Spread: return "1H Spread"
        case .h1Total: return "1H Total"
        case .ml: return "Moneyline"
        case .rl: return "Run Line"
        case .ou: return "Total"
        case .f5Ml: return "F5 Moneyline"
        case .f5Rl: return "F5 Run Line"
        case .f5Ou: return "F5 Total"
        }
    }

    public static func markets(for sport: OutliersTrendsSport, subject: OutliersTrendsSubject) -> [OutliersTrendsGameMarket] {
        switch sport {
        case .mlb:
            return [.all, .ml, .rl, .ou, .f5Ml, .f5Rl, .f5Ou]
        case .nfl, .ncaaf:
            switch subject {
            case .teams: return [.all, .spread, .moneyline, .total, .teamTotal, .h1Spread, .h1Total]
            case .refs: return [.all, .spread, .moneyline, .total, .h1Spread, .h1Total]
            default: return [.all, .spread, .moneyline, .total, .teamTotal, .h1Spread, .h1Total]
            }
        default:
            return [.all]
        }
    }
}

public enum OutliersTrendsPropMarket: String, CaseIterable, Identifiable, Sendable, Hashable {
    case all, anytimeTD, rushYards, recYards, receptions, passYards, passTDs

    public var id: String { rawValue }

    public var dbKey: String? {
        switch self {
        case .all: return nil
        case .anytimeTD: return "player_anytime_td"
        case .rushYards: return "player_rush_yds"
        case .recYards: return "player_reception_yds"
        case .receptions: return "player_receptions"
        case .passYards: return "player_pass_yds"
        case .passTDs: return "player_pass_tds"
        }
    }

    public var label: String {
        switch self {
        case .all: return "All bet types"
        case .anytimeTD: return "Anytime TD"
        case .rushYards: return "Rushing Yards"
        case .recYards: return "Receiving Yards"
        case .receptions: return "Receptions"
        case .passYards: return "Passing Yards"
        case .passTDs: return "Passing TDs"
        }
    }
}

// MARK: - Slate

public struct OutliersTrendsMLBContext: Sendable, Hashable {
    public let homeMl: Double?
    public let awayMl: Double?
    public let homeSpread: Double?
    public let totalLine: Double?
    public let f5HomeSpread: Double?
    public let f5TotalLine: Double?
    public let isDivisional: Bool
    public let isDayGame: Bool
    public let seriesGameNumber: Int?

    public init(
        homeMl: Double?,
        awayMl: Double?,
        homeSpread: Double?,
        totalLine: Double?,
        f5HomeSpread: Double?,
        f5TotalLine: Double?,
        isDivisional: Bool,
        isDayGame: Bool,
        seriesGameNumber: Int?
    ) {
        self.homeMl = homeMl
        self.awayMl = awayMl
        self.homeSpread = homeSpread
        self.totalLine = totalLine
        self.f5HomeSpread = f5HomeSpread
        self.f5TotalLine = f5TotalLine
        self.isDivisional = isDivisional
        self.isDayGame = isDayGame
        self.seriesGameNumber = seriesGameNumber
    }
}

public struct OutliersTrendsGame: Identifiable, Hashable, Sendable {
    public let id: String
    public let season: Int
    public let week: Int
    public let awayAb: String
    public let homeAb: String
    public let awayTeam: String
    public let homeTeam: String
    public let fgSpreadClose: Double?
    public let fgTotalClose: Double?
    public let kickoff: String?
    public let slot: String?
    public let assignedReferee: String?
    public let mlbContext: OutliersTrendsMLBContext?

    public init(
        id: String,
        season: Int,
        week: Int,
        awayAb: String,
        homeAb: String,
        awayTeam: String,
        homeTeam: String,
        fgSpreadClose: Double?,
        fgTotalClose: Double?,
        kickoff: String?,
        slot: String?,
        assignedReferee: String?,
        mlbContext: OutliersTrendsMLBContext? = nil
    ) {
        self.id = id
        self.season = season
        self.week = week
        self.awayAb = awayAb
        self.homeAb = homeAb
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.fgSpreadClose = fgSpreadClose
        self.fgTotalClose = fgTotalClose
        self.kickoff = kickoff
        self.slot = slot
        self.assignedReferee = assignedReferee
        self.mlbContext = mlbContext
    }

    public var label: String { "\(awayAb) @ \(homeAb)" }
}

public enum OutliersTrendsMatchupFilter: Hashable, Sendable {
    case allGames
    case game(id: String)
}

// MARK: - Display cards

public enum OutliersTrendsSubjectKind: String, Sendable, Hashable {
    case team, coach, referee, player
}

public struct OutliersTrendsBettingLine: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String
    public let lineText: String
    public let oddsText: String?
    public let bookName: String?
    public let bookLogoUrl: String?
    public let teamAbbr: String?

    public init(
        id: String,
        label: String,
        lineText: String,
        oddsText: String? = nil,
        bookName: String? = nil,
        bookLogoUrl: String? = nil,
        teamAbbr: String? = nil
    ) {
        self.id = id
        self.label = label
        self.lineText = lineText
        self.oddsText = oddsText
        self.bookName = bookName
        self.bookLogoUrl = bookLogoUrl
        self.teamAbbr = teamAbbr
    }
}

public struct OutliersTrendsCardRow: Identifiable, Hashable, Sendable {
    public let id: String
    public let text: String
    public let coverageNote: String?
    public let dominantPct: Double
    public let sampleN: Int

    public init(id: String, text: String, coverageNote: String?, dominantPct: Double, sampleN: Int) {
        self.id = id
        self.text = text
        self.coverageNote = coverageNote
        self.dominantPct = dominantPct
        self.sampleN = sampleN
    }
}

public struct OutliersTrendsCard: Identifiable, Hashable, Sendable {
    public let id: String
    public let gameId: String
    public let matchupLabel: String
    public let subjectKind: OutliersTrendsSubjectKind
    public let subjectName: String
    public let subjectDetail: String?
    public let teamAbbr: String?
    public let playerId: String?
    public let marketKey: String
    public let betTypeLabel: String
    public let trendValue: Double
    public let trendSampleN: Int
    public let lineContext: String?
    public let headshotUrl: String?
    public let bettingLines: [OutliersTrendsBettingLine]
    public let rows: [OutliersTrendsCardRow]
    public let isPlayerOverflow: Bool

    public init(
        id: String,
        gameId: String,
        matchupLabel: String,
        subjectKind: OutliersTrendsSubjectKind,
        subjectName: String,
        subjectDetail: String?,
        teamAbbr: String?,
        playerId: String?,
        marketKey: String,
        betTypeLabel: String,
        trendValue: Double,
        trendSampleN: Int,
        lineContext: String?,
        headshotUrl: String? = nil,
        bettingLines: [OutliersTrendsBettingLine] = [],
        rows: [OutliersTrendsCardRow],
        isPlayerOverflow: Bool = false
    ) {
        self.id = id
        self.gameId = gameId
        self.matchupLabel = matchupLabel
        self.subjectKind = subjectKind
        self.subjectName = subjectName
        self.subjectDetail = subjectDetail
        self.teamAbbr = teamAbbr
        self.playerId = playerId
        self.marketKey = marketKey
        self.betTypeLabel = betTypeLabel
        self.trendValue = trendValue
        self.trendSampleN = trendSampleN
        self.lineContext = lineContext
        self.headshotUrl = headshotUrl
        self.bettingLines = bettingLines
        self.rows = rows
        self.isPlayerOverflow = isPlayerOverflow
    }
}

// MARK: - Split primitives

public struct NFLTrendSplitCell: Codable, Sendable, Hashable {
    public let h: Int
    public let l: Int
    public let p: Int?
    public let n: Int
    public let pct: Double

    public init(h: Int, l: Int, p: Int?, n: Int, pct: Double) {
        self.h = h
        self.l = l
        self.p = p
        self.n = n
        self.pct = pct
    }
}

public struct NFLTrendH2HCell: Codable, Sendable, Hashable {
    public let h: Int
    public let n: Int
    public let pct: Double?

    public init(h: Int, n: Int, pct: Double?) {
        self.h = h
        self.n = n
        self.pct = pct
    }

    public var l: Int { max(0, n - h) }
}

public typealias NFLTrendSplits = [String: [String: [String: NFLTrendSplitCell]]]
public typealias NFLTrendMarketCoverage = [String: String]
