import Foundation

/// Lightweight summary of a game emitted by the Outliers feed. Ports
/// `wagerproof-mobile/services/outliersService.ts` `GameSummary` interface.
///
/// Only the columns the outliers screen actually renders are surfaced here.
/// The RN code stashed the raw `originalData` blob for downstream sheets;
/// since the bottom-sheet ports land in B12+, we keep just the structured
/// fields and stash the raw row as an opaque JSON dictionary for future
/// re-hydration by the relevant per-sport game sheet store.
public struct OutlierGame: Identifiable, Hashable, Sendable {
    public var id: String { gameId }
    public let gameId: String
    public let sport: SportLeague
    public let awayTeam: String
    public let homeTeam: String
    public let gameTime: String?

    public let awaySpread: Double?
    public let homeSpread: Double?
    public let totalLine: Double?
    public let awayMl: Int?
    public let homeMl: Int?

    public let awayTeamLogo: String?
    public let homeTeamLogo: String?
    public let awayTeamAbbrev: String?
    public let homeTeamAbbrev: String?

    /// Model-derived signals merged in during `hydratePredictions(...)`.
    public let homeAwaySpreadCoverProb: Double?
    public let ouResultProb: Double?
    public let homeAwayMlProb: Double?
    public let homeSpreadDiff: Double?
    public let overLineDiff: Double?

    public init(
        gameId: String,
        sport: SportLeague,
        awayTeam: String,
        homeTeam: String,
        gameTime: String? = nil,
        awaySpread: Double? = nil,
        homeSpread: Double? = nil,
        totalLine: Double? = nil,
        awayMl: Int? = nil,
        homeMl: Int? = nil,
        awayTeamLogo: String? = nil,
        homeTeamLogo: String? = nil,
        awayTeamAbbrev: String? = nil,
        homeTeamAbbrev: String? = nil,
        homeAwaySpreadCoverProb: Double? = nil,
        ouResultProb: Double? = nil,
        homeAwayMlProb: Double? = nil,
        homeSpreadDiff: Double? = nil,
        overLineDiff: Double? = nil
    ) {
        self.gameId = gameId
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.gameTime = gameTime
        self.awaySpread = awaySpread
        self.homeSpread = homeSpread
        self.totalLine = totalLine
        self.awayMl = awayMl
        self.homeMl = homeMl
        self.awayTeamLogo = awayTeamLogo
        self.homeTeamLogo = homeTeamLogo
        self.awayTeamAbbrev = awayTeamAbbrev
        self.homeTeamAbbrev = homeTeamAbbrev
        self.homeAwaySpreadCoverProb = homeAwaySpreadCoverProb
        self.ouResultProb = ouResultProb
        self.homeAwayMlProb = homeAwayMlProb
        self.homeSpreadDiff = homeSpreadDiff
        self.overLineDiff = overLineDiff
    }
}

/// Prediction-market value alert. Polymarket consensus crossing a threshold
/// for a side that the sportsbook hasn't repriced yet. Ports `ValueAlert`
/// from the RN service.
public struct OutlierValueAlert: Identifiable, Hashable, Sendable {
    public var id: String { "\(gameId)-\(marketType.rawValue)-\(side)" }
    public let gameId: String
    public let sport: SportLeague
    public let awayTeam: String
    public let homeTeam: String
    public let marketType: MarketType
    public let side: String
    public let percentage: Double
    public let game: OutlierGame

    public enum MarketType: String, Hashable, Sendable {
        case spread = "Spread"
        case total = "Total"
        case moneyline = "Moneyline"
    }

    public init(
        gameId: String,
        sport: SportLeague,
        awayTeam: String,
        homeTeam: String,
        marketType: MarketType,
        side: String,
        percentage: Double,
        game: OutlierGame
    ) {
        self.gameId = gameId
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.marketType = marketType
        self.side = side
        self.percentage = percentage
        self.game = game
    }
}

/// Model fade alert. The model is extremely confident on a side; backtesting
/// says fading high-confidence picks has historically been more profitable.
/// Ports `FadeAlert` from the RN service.
public struct OutlierFadeAlert: Identifiable, Hashable, Sendable {
    public var id: String { "\(gameId)-\(pickType.rawValue)-\(predictedTeam)" }
    public let gameId: String
    public let sport: SportLeague
    public let awayTeam: String
    public let homeTeam: String
    public let pickType: PickType
    public let predictedTeam: String
    public let confidence: Int
    public let game: OutlierGame

    public enum PickType: String, Hashable, Sendable {
        case spread = "Spread"
        case total = "Total"
    }

    public init(
        gameId: String,
        sport: SportLeague,
        awayTeam: String,
        homeTeam: String,
        pickType: PickType,
        predictedTeam: String,
        confidence: Int,
        game: OutlierGame
    ) {
        self.gameId = gameId
        self.sport = sport
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.pickType = pickType
        self.predictedTeam = predictedTeam
        self.confidence = confidence
        self.game = game
    }
}
