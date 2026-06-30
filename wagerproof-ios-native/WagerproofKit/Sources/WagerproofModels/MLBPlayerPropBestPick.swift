import Foundation

// MARK: - Tiers & results

public enum MLBPlayerPropPickTier: String, Codable, Sendable, CaseIterable {
    case elite, strong, lean

    public var label: String {
        switch self {
        case .elite: return "Elite"
        case .strong: return "Strong"
        case .lean: return "Lean"
        }
    }

    public var emoji: String {
        switch self {
        case .elite: return "🔥"
        case .strong: return "⭐"
        case .lean: return "👍"
        }
    }

    public var sortRank: Int {
        switch self {
        case .elite: return 0
        case .strong: return 1
        case .lean: return 2
        }
    }
}

public enum MLBPlayerPropPickResult: String, Codable, Sendable {
    case won, lost, push, pending, void
}

public enum MLBPlayerPropPickKind: String, Codable, Sendable {
    case batter, pitcher
}

// MARK: - Live pick (Best Picks Report)

public struct MLBPlayerPropBestPick: Identifiable, Sendable, Hashable {
    public let reportDate: String
    public let gamePk: Int
    public let playerId: Int
    public let market: String
    public let side: String
    public let playerName: String
    public let teamName: String?
    public let gameLabel: String
    public let isDay: Bool
    public let marketLabel: String
    public let kind: MLBPlayerPropPickKind
    public let tier: MLBPlayerPropPickTier
    public let score: Int
    public let line: Double
    public let overOdds: Int?
    public let underOdds: Int?
    public let l10Over: Int?
    public let l10Games: Int?
    public let l10Pct: Int?
    public let rationale: [String]
    public let locked: Bool

    public var id: String { "\(reportDate)|\(gamePk)|\(playerId)|\(market)|\(side)" }

    public init(
        reportDate: String,
        gamePk: Int,
        playerId: Int,
        market: String,
        side: String,
        playerName: String,
        teamName: String?,
        gameLabel: String,
        isDay: Bool,
        marketLabel: String,
        kind: MLBPlayerPropPickKind,
        tier: MLBPlayerPropPickTier,
        score: Int,
        line: Double,
        overOdds: Int?,
        underOdds: Int?,
        l10Over: Int?,
        l10Games: Int?,
        l10Pct: Int?,
        rationale: [String],
        locked: Bool
    ) {
        self.reportDate = reportDate
        self.gamePk = gamePk
        self.playerId = playerId
        self.market = market
        self.side = side
        self.playerName = playerName
        self.teamName = teamName
        self.gameLabel = gameLabel
        self.isDay = isDay
        self.marketLabel = marketLabel
        self.kind = kind
        self.tier = tier
        self.score = score
        self.line = line
        self.overOdds = overOdds
        self.underOdds = underOdds
        self.l10Over = l10Over
        self.l10Games = l10Games
        self.l10Pct = l10Pct
        self.rationale = rationale
        self.locked = locked
    }
}

// MARK: - Graded history row

public struct MLBPlayerPropGrade: Identifiable, Sendable, Hashable {
    public let reportDate: String
    public let gamePk: Int
    public let playerId: Int
    public let market: String
    public let side: String
    public let playerName: String?
    public let teamName: String?
    public let marketLabel: String?
    public let kind: MLBPlayerPropPickKind?
    public let tier: MLBPlayerPropPickTier?
    public let score: Int?
    public let line: Double?
    public let overOdds: Int?
    public let underOdds: Int?
    public let l10Pct: Int?
    public let actualValue: Double?
    public let result: MLBPlayerPropPickResult?
    public let unitsStaked: Double?
    public let unitsWon: Double?

    public var id: String { "\(reportDate)|\(gamePk)|\(playerId)|\(market)|\(side)" }

    public init(
        reportDate: String,
        gamePk: Int,
        playerId: Int,
        market: String,
        side: String,
        playerName: String?,
        teamName: String?,
        marketLabel: String?,
        kind: MLBPlayerPropPickKind?,
        tier: MLBPlayerPropPickTier?,
        score: Int?,
        line: Double?,
        overOdds: Int?,
        underOdds: Int?,
        l10Pct: Int?,
        actualValue: Double?,
        result: MLBPlayerPropPickResult?,
        unitsStaked: Double?,
        unitsWon: Double?
    ) {
        self.reportDate = reportDate
        self.gamePk = gamePk
        self.playerId = playerId
        self.market = market
        self.side = side
        self.playerName = playerName
        self.teamName = teamName
        self.marketLabel = marketLabel
        self.kind = kind
        self.tier = tier
        self.score = score
        self.line = line
        self.overOdds = overOdds
        self.underOdds = underOdds
        self.l10Pct = l10Pct
        self.actualValue = actualValue
        self.result = result
        self.unitsStaked = unitsStaked
        self.unitsWon = unitsWon
    }
}

// MARK: - Per-(tier × market) summary row

public struct MLBPlayerPropGradeSummary: Identifiable, Sendable, Hashable {
    public let tier: MLBPlayerPropPickTier
    public let market: String
    public let marketLabel: String
    public let kind: MLBPlayerPropPickKind
    public let picksTotal: Int
    public let picksWon: Int
    public let picksLost: Int
    public let picksPush: Int
    public let picksPending: Int
    public let winPct: Double?
    public let unitsStaked: Double?
    public let unitsWon: Double?
    public let roiPct: Double?

    public var id: String { "\(tier.rawValue)|\(market)" }

    public init(
        tier: MLBPlayerPropPickTier,
        market: String,
        marketLabel: String,
        kind: MLBPlayerPropPickKind,
        picksTotal: Int,
        picksWon: Int,
        picksLost: Int,
        picksPush: Int,
        picksPending: Int,
        winPct: Double?,
        unitsStaked: Double?,
        unitsWon: Double?,
        roiPct: Double?
    ) {
        self.tier = tier
        self.market = market
        self.marketLabel = marketLabel
        self.kind = kind
        self.picksTotal = picksTotal
        self.picksWon = picksWon
        self.picksLost = picksLost
        self.picksPush = picksPush
        self.picksPending = picksPending
        self.winPct = winPct
        self.unitsStaked = unitsStaked
        self.unitsWon = unitsWon
        self.roiPct = roiPct
    }
}

// MARK: - Aggregates

public struct MLBPlayerPropPerformanceTotals: Sendable, Hashable {
    public var picks: Int = 0
    public var won: Int = 0
    public var lost: Int = 0
    public var push: Int = 0
    public var unitsStaked: Double = 0
    public var unitsWon: Double = 0

    public var settled: Int { won + lost + push }

    public var winPct: Double? {
        let graded = won + lost
        guard graded > 0 else { return nil }
        return (Double(won) / Double(graded)) * 100
    }

    public var roiPct: Double? {
        guard unitsStaked > 0 else { return nil }
        return (unitsWon / unitsStaked) * 100
    }

    public static func aggregate(_ rows: [MLBPlayerPropGradeSummary]) -> MLBPlayerPropPerformanceTotals {
        var totals = MLBPlayerPropPerformanceTotals()
        for row in rows {
            totals.picks += row.picksTotal
            totals.won += row.picksWon
            totals.lost += row.picksLost
            totals.push += row.picksPush
            totals.unitsStaked += row.unitsStaked ?? 0
            totals.unitsWon += row.unitsWon ?? 0
        }
        return totals
    }
}

public struct MLBPlayerPropTierSummary: Identifiable, Sendable {
    public let tier: MLBPlayerPropPickTier
    public let totals: MLBPlayerPropPerformanceTotals
    public let markets: [MLBPlayerPropGradeSummary]

    public var id: String { tier.rawValue }

    public init(tier: MLBPlayerPropPickTier, totals: MLBPlayerPropPerformanceTotals, markets: [MLBPlayerPropGradeSummary]) {
        self.tier = tier
        self.totals = totals
        self.markets = markets
    }
}

public enum MLBPlayerPropPerformanceFormatting {
    public static func formatUnits(_ value: Double?, signed: Bool = true) -> String {
        guard let value, value.isFinite else { return "—" }
        let rounded = (value * 100).rounded() / 100
        let body = String(format: "%.2f", abs(rounded))
        if !signed { return "\(body)u" }
        if rounded >= 0 { return "+\(body)u" }
        return "-\(body)u"
    }

    public static func formatPct(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "—" }
        return String(format: "%.1f%%", value)
    }

    public static func unitsColor(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "muted" }
        if value > 0 { return "win" }
        if value < 0 { return "loss" }
        return "muted"
    }
}
