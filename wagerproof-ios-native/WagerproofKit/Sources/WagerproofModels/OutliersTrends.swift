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
        case .f5Ml: return "1st 5 Moneyline"
        case .f5Rl: return "1st 5 Run Line"
        case .f5Ou: return "1st 5 Total"
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
    case all, passYards, passTDs, passAttempts, passCompletions,
         rushYards, rushAttempts,
         recYards, receptions, anytimeTD

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
        case .passAttempts: return "player_pass_attempts"
        case .passCompletions: return "player_pass_completions"
        case .rushAttempts: return "player_rush_attempts"
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
        case .passAttempts: return "Pass Attempts"
        case .passCompletions: return "Completions"
        case .rushAttempts: return "Rush Attempts"
        }
    }
}

// MARK: - Slate

public struct OutliersTrendsMLBContext: Sendable, Hashable {
    public let homeMl: Double?
    public let awayMl: Double?
    public let homeSpread: Double?
    public let awaySpread: Double?
    public let totalLine: Double?
    public let f5HomeMl: Double?
    public let f5AwayMl: Double?
    public let f5HomeSpread: Double?
    public let f5AwaySpread: Double?
    public let f5TotalLine: Double?
    public let homeSpreadOdds: Double?
    public let awaySpreadOdds: Double?
    public let totalOverOdds: Double?
    public let totalUnderOdds: Double?
    public let f5HomeSpreadOdds: Double?
    public let f5AwaySpreadOdds: Double?
    public let f5TotalOverOdds: Double?
    public let f5TotalUnderOdds: Double?
    public let isDivisional: Bool
    public let isDayGame: Bool
    public let seriesGameNumber: Int?

    public init(
        homeMl: Double?,
        awayMl: Double?,
        homeSpread: Double?,
        awaySpread: Double?,
        totalLine: Double?,
        f5HomeMl: Double?,
        f5AwayMl: Double?,
        f5HomeSpread: Double?,
        f5AwaySpread: Double?,
        f5TotalLine: Double?,
        homeSpreadOdds: Double? = nil,
        awaySpreadOdds: Double? = nil,
        totalOverOdds: Double? = nil,
        totalUnderOdds: Double? = nil,
        f5HomeSpreadOdds: Double? = nil,
        f5AwaySpreadOdds: Double? = nil,
        f5TotalOverOdds: Double? = nil,
        f5TotalUnderOdds: Double? = nil,
        isDivisional: Bool,
        isDayGame: Bool,
        seriesGameNumber: Int?
    ) {
        self.homeMl = homeMl
        self.awayMl = awayMl
        self.homeSpread = homeSpread
        self.awaySpread = awaySpread
        self.totalLine = totalLine
        self.f5HomeMl = f5HomeMl
        self.f5AwayMl = f5AwayMl
        self.f5HomeSpread = f5HomeSpread
        self.f5AwaySpread = f5AwaySpread
        self.f5TotalLine = f5TotalLine
        self.homeSpreadOdds = homeSpreadOdds
        self.awaySpreadOdds = awaySpreadOdds
        self.totalOverOdds = totalOverOdds
        self.totalUnderOdds = totalUnderOdds
        self.f5HomeSpreadOdds = f5HomeSpreadOdds
        self.f5AwaySpreadOdds = f5AwaySpreadOdds
        self.f5TotalOverOdds = f5TotalOverOdds
        self.f5TotalUnderOdds = f5TotalUnderOdds
        self.isDivisional = isDivisional
        self.isDayGame = isDayGame
        self.seriesGameNumber = seriesGameNumber
    }
}

/// NFL betting context for Parlay God legs — ML closes plus fully-priced H1
/// markets from `nfl_dryrun_games`. FG spread/total juice isn't stored there,
/// so those legs price at the standard -110.
public struct OutliersTrendsNFLContext: Sendable, Hashable {
    public let homeMl: Double?
    public let awayMl: Double?
    /// Home-relative H1 spread (negative = home favored), matching `h1_spread_close`.
    public let h1SpreadClose: Double?
    public let h1SpreadHomePrice: Double?
    public let h1SpreadAwayPrice: Double?
    public let h1TotalClose: Double?
    public let h1TotalOverPrice: Double?
    public let h1TotalUnderPrice: Double?

    public init(
        homeMl: Double?,
        awayMl: Double?,
        h1SpreadClose: Double?,
        h1SpreadHomePrice: Double?,
        h1SpreadAwayPrice: Double?,
        h1TotalClose: Double?,
        h1TotalOverPrice: Double?,
        h1TotalUnderPrice: Double?
    ) {
        self.homeMl = homeMl
        self.awayMl = awayMl
        self.h1SpreadClose = h1SpreadClose
        self.h1SpreadHomePrice = h1SpreadHomePrice
        self.h1SpreadAwayPrice = h1SpreadAwayPrice
        self.h1TotalClose = h1TotalClose
        self.h1TotalOverPrice = h1TotalOverPrice
        self.h1TotalUnderPrice = h1TotalUnderPrice
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
    public let nflContext: OutliersTrendsNFLContext?

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
        mlbContext: OutliersTrendsMLBContext? = nil,
        nflContext: OutliersTrendsNFLContext? = nil
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
        self.nflContext = nflContext
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

// MARK: - Market sections

/// One bet-type group on the Outliers page: a section header + a horizontal card carousel.
/// Market stopped being a filter pill — it's now the page's organizing dimension.
public struct OutliersTrendsMarketSection: Identifiable, Hashable, Sendable {
    public let marketKey: String
    public let title: String
    public let cards: [OutliersTrendsCard]

    public var id: String { marketKey }

    public init(marketKey: String, title: String, cards: [OutliersTrendsCard]) {
        self.marketKey = marketKey
        self.title = title
        self.cards = cards
    }

    /// Canonical section order across every sport; unranked markets fall to the end.
    private static let marketOrder: [String] = [
        "spread", "moneyline", "total", "team_total", "h1_spread", "h1_total",
        "ml", "rl", "ou", "f5_ml", "f5_rl", "f5_ou",
        "player_pass_yds", "player_pass_tds", "player_pass_attempts", "player_pass_completions",
        "player_rush_yds", "player_rush_attempts",
        "player_reception_yds", "player_receptions", "player_anytime_td",
    ]

    private static func rank(_ key: String) -> Int {
        marketOrder.firstIndex(of: key) ?? marketOrder.count
    }

    /// Buckets an already-sorted (best-first) card list by market into ordered sections,
    /// capping each carousel. Overflow placeholder cards are dropped — carousels scroll instead.
    public static func sections(from cards: [OutliersTrendsCard], cap: Int) -> [OutliersTrendsMarketSection] {
        var keyOrder: [String] = []
        var groups: [String: [OutliersTrendsCard]] = [:]
        for card in cards where !card.isPlayerOverflow {
            if groups[card.marketKey] == nil {
                keyOrder.append(card.marketKey)
                groups[card.marketKey] = []
            }
            groups[card.marketKey]?.append(card)
        }
        return keyOrder.map { key in
            let bucket = groups[key] ?? []
            return OutliersTrendsMarketSection(
                marketKey: key,
                title: bucket.first?.betTypeLabel ?? key,
                cards: Array(bucket.prefix(cap))
            )
        }
        .sorted { rank($0.marketKey) < rank($1.marketKey) }
    }
}

// MARK: - Search index entry

/// A trend card plus the context Search needs to render the exact `OutliersTrendCard`
/// from the Outliers tab — the card's sport (for logos) and its game (for the schedule
/// label + matchup names). The cross-sport search index is a list of these.
public struct OutliersTrendsSearchEntry: Identifiable, Hashable, Sendable {
    public let card: OutliersTrendsCard
    public let sport: OutliersTrendsSport
    public let game: OutliersTrendsGame?

    public var id: String { "\(sport.rawValue)-\(card.id)" }

    public init(card: OutliersTrendsCard, sport: OutliersTrendsSport, game: OutliersTrendsGame?) {
        self.card = card
        self.sport = sport
        self.game = game
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
