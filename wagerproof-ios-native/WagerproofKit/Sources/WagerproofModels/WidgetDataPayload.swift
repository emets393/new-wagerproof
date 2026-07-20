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
    /// Top outliers (value + fade alerts, ranked by confidence) for the
    /// native "Top Outliers" Home Screen widget. Additive field — the old
    /// RN-shipped widget doesn't know about it and won't round-trip it, but
    /// that widget is being retired alongside the RN app.
    public var topOutliers: [OutlierAlertForWidget]
    /// Configurable market sections for the native Top Outliers widget. Each
    /// group mirrors one header on the Outliers screen (Parlay God,
    /// Moneyline, Run Line, player props, and so on).
    public var outlierMarkets: [OutliersWidgetMarketData]
    public var lastUpdated: String

    public init(
        editorPicks: [EditorPickForWidget] = [],
        fadeAlerts: [FadeAlertForWidget] = [],
        polymarketValues: [PolymarketValueForWidget] = [],
        topAgentPicks: [TopAgentWidgetData] = [],
        topOutliers: [OutlierAlertForWidget] = [],
        outlierMarkets: [OutliersWidgetMarketData] = [],
        lastUpdated: String
    ) {
        self.editorPicks = editorPicks
        self.fadeAlerts = fadeAlerts
        self.polymarketValues = polymarketValues
        self.topAgentPicks = topAgentPicks
        self.topOutliers = topOutliers
        self.outlierMarkets = outlierMarkets
        self.lastUpdated = lastUpdated
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        editorPicks = try container.decodeIfPresent([EditorPickForWidget].self, forKey: .editorPicks) ?? []
        fadeAlerts = try container.decodeIfPresent([FadeAlertForWidget].self, forKey: .fadeAlerts) ?? []
        polymarketValues = try container.decodeIfPresent([PolymarketValueForWidget].self, forKey: .polymarketValues) ?? []
        topAgentPicks = try container.decodeIfPresent([TopAgentWidgetData].self, forKey: .topAgentPicks) ?? []
        topOutliers = try container.decodeIfPresent([OutlierAlertForWidget].self, forKey: .topOutliers) ?? []
        outlierMarkets = try container.decodeIfPresent([OutliersWidgetMarketData].self, forKey: .outlierMarkets) ?? []
        // The original RN bridge did not always include this field. Treat it
        // as optional so one legacy payload cannot blank every widget.
        lastUpdated = try container.decodeIfPresent(String.self, forKey: .lastUpdated) ?? ""
    }

    public static func empty() -> WidgetDataPayload {
        WidgetDataPayload(
            editorPicks: [],
            fadeAlerts: [],
            polymarketValues: [],
            topAgentPicks: [],
            topOutliers: [],
            outlierMarkets: [],
            lastUpdated: ""
        )
    }
}

/// Lightweight widget projection of an Outliers alert — combines both
/// `OutlierValueAlert` (market money on a side) and `OutlierFadeAlert` (model
/// disagrees with the line) into one rankable shape via `kind`.
public struct OutlierAlertForWidget: Codable, Sendable, Hashable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case value
        case fade
        case trend
    }

    public let id: String
    public let kind: Kind
    public let sport: String
    public let awayTeam: String
    public let homeTeam: String
    public let marketType: String
    /// The side/selection this alert is about (e.g. team name, "Over"/"Under").
    public let side: String
    /// Value alerts: market percentage on `side`. Fade alerts: model
    /// confidence (0-100) or point-delta, depending on sport — see
    /// `OutlierFadeAlert.confidenceDisplay` for the same ambiguity upstream.
    public let confidence: Int
    public var gameTime: String?

    public init(
        id: String,
        kind: Kind,
        sport: String,
        awayTeam: String,
        homeTeam: String,
        marketType: String,
        side: String,
        confidence: Int,
        gameTime: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.marketType = marketType
        self.side = side
        self.confidence = confidence
        self.gameTime = gameTime
    }
}

/// One editable market option in the Top Outliers widget. `id` is stable and
/// intentionally data-driven so WidgetKit can offer every live Outliers page
/// header without hard-coding a second market taxonomy in the extension.
public struct OutliersWidgetMarketData: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let symbolName: String
    public let items: [OutliersWidgetItem]
    /// Total qualifying cards in this market before the widget payload cap.
    public let totalCount: Int

    public init(
        id: String,
        title: String,
        symbolName: String,
        items: [OutliersWidgetItem],
        totalCount: Int
    ) {
        self.id = id
        self.title = title
        self.symbolName = symbolName
        self.items = items
        self.totalCount = totalCount
    }
}

/// Glanceable projection of either an Outliers trend card or a Parlay God
/// ticket. The fraction is calculated from the real strongest row; no sample
/// or streak is synthesized in the extension.
public struct OutliersWidgetItem: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let sport: String
    public let matchup: String
    public let subject: String
    public let selection: String
    public let oddsText: String?
    public let hitCount: Int
    public let sampleSize: Int
    /// Additional trend rows (or parlay legs) available behind this preview.
    public let additionalTrendCount: Int

    public var fractionText: String { "\(hitCount)/\(sampleSize)" }

    public init(
        id: String,
        sport: String,
        matchup: String,
        subject: String,
        selection: String,
        oddsText: String? = nil,
        hitCount: Int,
        sampleSize: Int,
        additionalTrendCount: Int = 0
    ) {
        self.id = id
        self.sport = sport
        self.matchup = matchup
        self.subject = subject
        self.selection = selection
        self.oddsText = oddsText
        self.hitCount = hitCount
        self.sampleSize = sampleSize
        self.additionalTrendCount = additionalTrendCount
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
    public let bestStreak: Int
    public let record: String
    public let picks: [AgentPickForWidget]
    /// Stable character from the agent's selected pixel-office avatar.
    public let spriteIndex: Int
    /// Cumulative recent graded-pick results used by the widget sparkline.
    public let form: [Double]

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
        bestStreak: Int = 0,
        record: String,
        picks: [AgentPickForWidget],
        spriteIndex: Int? = nil,
        form: [Double] = []
    ) {
        self.agentId = agentId
        self.agentName = agentName
        self.agentEmoji = agentEmoji
        self.agentColor = agentColor
        self.isFavorite = isFavorite
        self.netUnits = netUnits
        self.winRate = winRate
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.record = record
        self.picks = picks
        self.spriteIndex = spriteIndex ?? AgentSpriteIndex.forSeed(agentId)
        self.form = form
    }

    enum CodingKeys: String, CodingKey {
        case agentId, agentName, agentEmoji, agentColor, isFavorite, netUnits
        case winRate, currentStreak, bestStreak, record, picks, spriteIndex, form
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        agentId = try container.decode(String.self, forKey: .agentId)
        agentName = try container.decode(String.self, forKey: .agentName)
        agentEmoji = try container.decodeIfPresent(String.self, forKey: .agentEmoji) ?? "🤖"
        agentColor = try container.decodeIfPresent(String.self, forKey: .agentColor) ?? "#22C55E"
        isFavorite = try container.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
        netUnits = try container.decodeIfPresent(Double.self, forKey: .netUnits) ?? 0
        winRate = try container.decodeIfPresent(Double.self, forKey: .winRate)
        currentStreak = try container.decodeIfPresent(Int.self, forKey: .currentStreak) ?? 0
        bestStreak = try container.decodeIfPresent(Int.self, forKey: .bestStreak) ?? 0
        record = try container.decodeIfPresent(String.self, forKey: .record) ?? "0-0"
        picks = try container.decodeIfPresent([AgentPickForWidget].self, forKey: .picks) ?? []
        spriteIndex = try container.decodeIfPresent(Int.self, forKey: .spriteIndex)
            ?? AgentSpriteIndex.forSeed(agentId)
        form = try container.decodeIfPresent([Double].self, forKey: .form) ?? []
    }
}
