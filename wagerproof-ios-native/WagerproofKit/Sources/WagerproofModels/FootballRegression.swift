import Foundation

public struct FootballRegressionReport: Sendable, Hashable {
    public let sport: String
    public let season: Int
    public let week: Int
    public let narrative: String?
    public let updatedAt: String?
    public let games: Int
    public let storylineCount: Int
    public let families: [String: Int]
    public let comingSoon: [FootballComingSoon]
    public let modelRecord: [FootballModelRecord]
    public let digestDate: String?
    public let digest: [FootballDigestEntry]

    public init(sport: String, season: Int, week: Int, narrative: String?, updatedAt: String?, games: Int, storylineCount: Int, families: [String: Int], comingSoon: [FootballComingSoon], modelRecord: [FootballModelRecord], digestDate: String?, digest: [FootballDigestEntry]) {
        self.sport = sport
        self.season = season
        self.week = week
        self.narrative = narrative
        self.updatedAt = updatedAt
        self.games = games
        self.storylineCount = storylineCount
        self.families = families
        self.comingSoon = comingSoon
        self.modelRecord = modelRecord
        self.digestDate = digestDate
        self.digest = digest
    }
}

public struct FootballComingSoon: Sendable, Hashable, Identifiable {
    public let emoji: String
    public let label: String
    public let note: String
    public var id: String { label }

    public init(emoji: String, label: String, note: String) {
        self.emoji = emoji
        self.label = label
        self.note = note
    }
}

public struct FootballModelRecord: Sendable, Hashable, Identifiable {
    public let market: String
    public let label: String
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let roiUnits: Double?
    public var id: String { market }
    public var graded: Int { wins + losses + pushes }

    public init(market: String, label: String, wins: Int, losses: Int, pushes: Int, roiUnits: Double?) {
        self.market = market
        self.label = label
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.roiUnits = roiUnits
    }
}

public struct FootballDigestEntry: Sendable, Hashable, Identifiable {
    public let type: String
    public let title: String
    public var id: String { title }

    public init(type: String, title: String) {
        self.type = type
        self.title = title
    }
}

public struct FootballStoryline: Sendable, Hashable, Identifiable {
    public let id: Int
    public let family: String
    public let matchup: String?
    public let title: String
    public let body: String
    public let rank: Int?
    public let status: String
    public let full: String?
    public let source: String?

    public init(id: Int, family: String, matchup: String?, title: String, body: String, rank: Int?, status: String, full: String?, source: String?) {
        self.id = id
        self.family = family
        self.matchup = matchup
        self.title = title
        self.body = body
        self.rank = rank
        self.status = status
        self.full = full
        self.source = source
    }
}

public struct FootballSignalRow: Sendable, Hashable, Identifiable {
    public let key: String
    public let n: Int
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let hitRate: Double?
    public let units: Double?
    public let roi: Double?
    public var id: String { key }

    public init(key: String, n: Int, wins: Int, losses: Int, pushes: Int, hitRate: Double?, units: Double?, roi: Double?) {
        self.key = key
        self.n = n
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.hitRate = hitRate
        self.units = units
        self.roi = roi
    }
}

public struct FootballSignalDef: Sendable, Hashable {
    public let key: String
    public let name: String?
    public let oneLiner: String?
    public let definition: String?
    public let why: String?
    public let direction: String?
    public let typicalHit: String?
    public let market: String?

    public init(key: String, name: String?, oneLiner: String?, definition: String?, why: String?, direction: String?, typicalHit: String?, market: String?) {
        self.key = key
        self.name = name
        self.oneLiner = oneLiner
        self.definition = definition
        self.why = why
        self.direction = direction
        self.typicalHit = typicalHit
        self.market = market
    }
}

public struct FootballUpcomingFlag: Sendable, Hashable, Identifiable {
    public let signalKey: String
    public let game: String?
    public let pick: String
    public let kickoff: String?
    public let started: Bool
    public var id: String { "\(signalKey)|\(game ?? "")|\(pick)" }

    public init(signalKey: String, game: String?, pick: String, kickoff: String?, started: Bool) {
        self.signalKey = signalKey
        self.game = game
        self.pick = pick
        self.kickoff = kickoff
        self.started = started
    }
}

public struct FootballRecordSplit: Sendable, Hashable, Identifiable {
    public let market: String
    public let scope: String
    public let scopeKey: String
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let roiUnits: Double?
    public let roiN: Int
    public var id: String { "\(scope)|\(market)|\(scopeKey)" }

    public init(market: String, scope: String, scopeKey: String, wins: Int, losses: Int, pushes: Int, roiUnits: Double?, roiN: Int) {
        self.market = market
        self.scope = scope
        self.scopeKey = scopeKey
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.roiUnits = roiUnits
        self.roiN = roiN
    }
}

public struct FootballPropNarrative: Sendable, Hashable, Identifiable {
    public let id: String
    public let playerName: String
    public let team: String?
    public let opp: String?
    public let position: String?
    public let market: String
    public let line: Double?
    public let direction: String?
    public let headshotUrl: String?
    public let kickoff: String?
    public let summary: String?
    public let body: String?
    public let bestOverLine: Double?
    public let bestOverPrice: Double?
    public let bestOverBook: String?
    public let bestUnderLine: Double?
    public let bestUnderPrice: Double?
    public let bestUnderBook: String?
    public let actual: Double?
    public let result: String?
    public let week: Int

    public init(id: String, playerName: String, team: String?, opp: String?, position: String?, market: String, line: Double?, direction: String?, headshotUrl: String?, kickoff: String?, summary: String?, body: String?, bestOverLine: Double?, bestOverPrice: Double?, bestOverBook: String?, bestUnderLine: Double?, bestUnderPrice: Double?, bestUnderBook: String?, actual: Double?, result: String?, week: Int) {
        self.id = id
        self.playerName = playerName
        self.team = team
        self.opp = opp
        self.position = position
        self.market = market
        self.line = line
        self.direction = direction
        self.headshotUrl = headshotUrl
        self.kickoff = kickoff
        self.summary = summary
        self.body = body
        self.bestOverLine = bestOverLine
        self.bestOverPrice = bestOverPrice
        self.bestOverBook = bestOverBook
        self.bestUnderLine = bestUnderLine
        self.bestUnderPrice = bestUnderPrice
        self.bestUnderBook = bestUnderBook
        self.actual = actual
        self.result = result
        self.week = week
    }
}

public enum FootballRegressionCopy {
    public static let familyOrder = [
        "matchups", "storylines", "confluence", "injuries", "signals", "coaching", "player_tendencies",
        "redzone_roles", "line_movement", "ref_trends", "coach_trends", "coach", "luck", "situational", "roster",
    ]

    public static func familyMeta(_ key: String) -> (label: String, emoji: String, hex: Int) {
        switch key {
        case "matchups": return ("Featured Matchup", "🔎", 0x6366F1)
        case "injuries": return ("Injuries", "🏥", 0xEF4444)
        case "signals": return ("Signal", "🎯", 0x10B981)
        case "line_movement": return ("Line Movement", "📈", 0x0EA5E9)
        case "ref_trends": return ("Referee", "🦓", 0xF59E0B)
        case "coach", "coach_trends", "coaching": return ("Coach", "🧠", 0x8B5CF6)
        case "confluence": return ("Ref + Coach", "⚡", 0xEAB308)
        case "luck": return ("Regression", "🎲", 0xD946EF)
        case "situational": return ("Situational", "📅", 0x14B8A6)
        case "roster": return ("Roster", "👥", 0xF97316)
        case "storylines": return ("Storylines", "📖", 0xF43F5E)
        case "player_tendencies": return ("Player Tendencies", "📈", 0x06B6D4)
        case "redzone_roles": return ("Goal-Line Roles", "🥅", 0x84CC16)
        default: return ("Storyline", "📌", 0x94A3B8)
        }
    }

    public static let marketOrder = ["fg_spread", "fg_total", "fg_ml", "tt", "h1_spread", "h1_total", "h1_ml"]
    public static func marketLabel(_ key: String) -> String {
        switch key {
        case "fg_spread": return "Spread"
        case "fg_total": return "Total"
        case "fg_ml": return "Moneyline"
        case "tt": return "Team Totals"
        case "h1_spread": return "1H Spread"
        case "h1_total": return "1H Total"
        case "h1_ml": return "1H ML"
        default: return key
        }
    }
}
