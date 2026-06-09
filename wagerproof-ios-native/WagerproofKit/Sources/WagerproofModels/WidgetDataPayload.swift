import Foundation

/// JSON payload written to the shared App Group `UserDefaults` for the iOS
/// home-screen widget. Mirrors `WidgetDataPayload` in
/// `wagerproof-mobile/modules/widget-data-bridge/src/WidgetDataBridge.ts`.
///
/// The schema is intentionally a JSON-friendly grab bag — fields not in scope
/// for a given sync are left untouched so each domain (editor picks, fade
/// alerts, polymarket values, top agent picks) can refresh independently.
///
/// All field names match the RN bridge byte-for-byte (camelCase) since the
/// widget extension binary may have been compiled against the RN payload —
/// breaking the names would brick existing widgets on user phones.
public struct WidgetDataPayload: Codable, Sendable {
    public var editorPicks: [EditorPickForWidget]
    public var fadeAlerts: [FadeAlertForWidget]
    public var polymarketValues: [PolymarketValueForWidget]
    public var topAgentPicks: [TopAgentWidgetData]
    public var lastUpdated: String

    public init(
        editorPicks: [EditorPickForWidget] = [],
        fadeAlerts: [FadeAlertForWidget] = [],
        polymarketValues: [PolymarketValueForWidget] = [],
        topAgentPicks: [TopAgentWidgetData] = [],
        lastUpdated: String
    ) {
        self.editorPicks = editorPicks
        self.fadeAlerts = fadeAlerts
        self.polymarketValues = polymarketValues
        self.topAgentPicks = topAgentPicks
        self.lastUpdated = lastUpdated
    }

    public static func empty() -> WidgetDataPayload {
        WidgetDataPayload(
            editorPicks: [],
            fadeAlerts: [],
            polymarketValues: [],
            topAgentPicks: [],
            lastUpdated: ""
        )
    }
}

/// Mirrors `EditorPickForWidget` in the RN bridge. Other batches (B05 picks)
/// own the in-app sync path; we ship the type here so the shared payload
/// round-trips cleanly.
public struct EditorPickForWidget: Codable, Sendable, Hashable {
    public let id: String
    public let gameType: String
    public let awayTeam: String
    public let homeTeam: String
    public var pickValue: String?
    public var bestPrice: String?
    public var sportsbook: String?
    public var units: Double?
    public var result: String?
    public var gameDate: String?

    public init(
        id: String,
        gameType: String,
        awayTeam: String,
        homeTeam: String,
        pickValue: String? = nil,
        bestPrice: String? = nil,
        sportsbook: String? = nil,
        units: Double? = nil,
        result: String? = nil,
        gameDate: String? = nil
    ) {
        self.id = id
        self.gameType = gameType
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.pickValue = pickValue
        self.bestPrice = bestPrice
        self.sportsbook = sportsbook
        self.units = units
        self.result = result
        self.gameDate = gameDate
    }
}

/// Mirrors `FadeAlertForWidget` in the RN bridge.
public struct FadeAlertForWidget: Codable, Sendable, Hashable {
    public let gameId: String
    public let sport: String
    public let awayTeam: String
    public let homeTeam: String
    public let pickType: String
    public let predictedTeam: String
    public let confidence: Double
    public var gameTime: String?

    public init(
        gameId: String,
        sport: String,
        awayTeam: String,
        homeTeam: String,
        pickType: String,
        predictedTeam: String,
        confidence: Double,
        gameTime: String? = nil
    ) {
        self.gameId = gameId
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.pickType = pickType
        self.predictedTeam = predictedTeam
        self.confidence = confidence
        self.gameTime = gameTime
    }
}

/// Mirrors `PolymarketValueForWidget` in the RN bridge.
public struct PolymarketValueForWidget: Codable, Sendable, Hashable {
    public let gameId: String
    public let sport: String
    public let awayTeam: String
    public let homeTeam: String
    public let marketType: String
    public let side: String
    public let percentage: Double

    public init(
        gameId: String,
        sport: String,
        awayTeam: String,
        homeTeam: String,
        marketType: String,
        side: String,
        percentage: Double
    ) {
        self.gameId = gameId
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.marketType = marketType
        self.side = side
        self.percentage = percentage
    }
}

/// Mirrors `AgentPickForWidget` in the RN bridge.
public struct AgentPickForWidget: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let sport: String
    public let matchup: String
    public let pickSelection: String
    public var odds: String?
    public var result: String?
    public var gameDate: String?

    public init(
        id: String,
        sport: String,
        matchup: String,
        pickSelection: String,
        odds: String? = nil,
        result: String? = nil,
        gameDate: String? = nil
    ) {
        self.id = id
        self.sport = sport
        self.matchup = matchup
        self.pickSelection = pickSelection
        self.odds = odds
        self.result = result
        self.gameDate = gameDate
    }
}

/// Mirrors `TopAgentWidgetData` in the RN bridge. Combines an agent's
/// identity + cached performance summary + up to N representative picks.
public struct TopAgentWidgetData: Codable, Sendable, Hashable, Identifiable {
    public let agentId: String
    public let agentName: String
    public let agentEmoji: String
    public let agentColor: String
    public let isFavorite: Bool
    public let netUnits: Double
    public var winRate: Double?
    public let currentStreak: Int
    public let record: String
    public let picks: [AgentPickForWidget]

    public var id: String { agentId }

    public init(
        agentId: String,
        agentName: String,
        agentEmoji: String,
        agentColor: String,
        isFavorite: Bool,
        netUnits: Double,
        winRate: Double? = nil,
        currentStreak: Int,
        record: String,
        picks: [AgentPickForWidget]
    ) {
        self.agentId = agentId
        self.agentName = agentName
        self.agentEmoji = agentEmoji
        self.agentColor = agentColor
        self.isFavorite = isFavorite
        self.netUnits = netUnits
        self.winRate = winRate
        self.currentStreak = currentStreak
        self.record = record
        self.picks = picks
    }
}
