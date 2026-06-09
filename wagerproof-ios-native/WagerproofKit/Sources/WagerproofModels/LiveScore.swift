import Foundation

/// Codable mirror of the RN `LiveGame` type in
/// `wagerproof-mobile/types/liveScores.ts`. Field names match the RN side
/// byte-for-byte so the same JSON payload from the `live_scores` Supabase
/// table decodes cleanly here. Predictions are computed client-side via
/// `LiveScoresService` (mirrors the RN `enrichGamesWithPredictions`),
/// so `predictions` arrives as a derived value, not a wire field.
public struct LiveGame: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let gameId: String?
    public let league: String
    public let homeTeam: String
    public let awayTeam: String
    public let homeAbbr: String
    public let awayAbbr: String
    public let homeScore: Int
    public let awayScore: Int
    public let quarter: String
    public let period: String?
    public let timeRemaining: String
    public let isLive: Bool
    public let gameStatus: String
    public let lastUpdated: String
    public var predictions: GamePredictions?

    public init(
        id: String,
        gameId: String? = nil,
        league: String,
        homeTeam: String,
        awayTeam: String,
        homeAbbr: String,
        awayAbbr: String,
        homeScore: Int,
        awayScore: Int,
        quarter: String,
        period: String? = nil,
        timeRemaining: String,
        isLive: Bool,
        gameStatus: String,
        lastUpdated: String,
        predictions: GamePredictions? = nil
    ) {
        self.id = id
        self.gameId = gameId
        self.league = league
        self.homeTeam = homeTeam
        self.awayTeam = awayTeam
        self.homeAbbr = homeAbbr
        self.awayAbbr = awayAbbr
        self.homeScore = homeScore
        self.awayScore = awayScore
        self.quarter = quarter
        self.period = period
        self.timeRemaining = timeRemaining
        self.isLive = isLive
        self.gameStatus = gameStatus
        self.lastUpdated = lastUpdated
        self.predictions = predictions
    }

    enum CodingKeys: String, CodingKey {
        case id
        case gameId = "game_id"
        case league
        case homeTeam = "home_team"
        case awayTeam = "away_team"
        case homeAbbr = "home_abbr"
        case awayAbbr = "away_abbr"
        case homeScore = "home_score"
        case awayScore = "away_score"
        case quarter
        case period
        case timeRemaining = "time_remaining"
        case isLive = "is_live"
        case gameStatus = "game_status"
        case lastUpdated = "last_updated"
        case predictions
    }
}

/// Wire-level row from the `live_scores` Supabase table. Some columns
/// arrive with slightly different names than the LiveGame the rest of
/// the app uses (RN normalizes inside its service). We decode this
/// shape, then transform to `LiveGame` in `LiveScoresService`.
public struct LiveScoreRow: Codable, Sendable {
    public let id: String
    public let gameId: String?
    public let league: String
    public let homeTeam: String
    public let awayTeam: String
    public let homeAbbr: String
    public let awayAbbr: String
    public let homeScore: Int
    public let awayScore: Int
    public let period: String?
    public let timeRemaining: String?
    public let isLive: Bool
    public let status: String?
    public let lastUpdated: String?

    enum CodingKeys: String, CodingKey {
        case id
        case gameId = "game_id"
        case league
        case homeTeam = "home_team"
        case awayTeam = "away_team"
        case homeAbbr = "home_abbr"
        case awayAbbr = "away_abbr"
        case homeScore = "home_score"
        case awayScore = "away_score"
        case period
        case timeRemaining = "time_remaining"
        case isLive = "is_live"
        case status
        case lastUpdated = "last_updated"
    }
}

/// Per-bet prediction status. Mirrors RN `PredictionStatus` in
/// types/liveScores.ts. `predicted` carries one of four constants
/// instead of a bool so we can render the picked side directly
/// (`"Home"` / `"Away"` for ML+spread, `"Over"` / `"Under"` for totals).
public struct PredictionStatus: Codable, Sendable, Hashable {
    public enum Pick: String, Codable, Sendable, Hashable {
        case home = "Home"
        case away = "Away"
        case over = "Over"
        case under = "Under"
    }

    public let predicted: Pick
    public let isHitting: Bool
    public let probability: Double
    public let line: Double?
    public let currentDifferential: Double

    public init(
        predicted: Pick,
        isHitting: Bool,
        probability: Double,
        line: Double? = nil,
        currentDifferential: Double
    ) {
        self.predicted = predicted
        self.isHitting = isHitting
        self.probability = probability
        self.line = line
        self.currentDifferential = currentDifferential
    }
}

/// Bundle of all three predictions for a single live game. Mirrors RN
/// `GamePredictions`. `hasAnyHitting` is the union-OR across the three
/// prediction states — used by the scoreboard to flip a card green and
/// pulse its border.
public struct GamePredictions: Codable, Sendable, Hashable {
    public var hasAnyHitting: Bool
    public var moneyline: PredictionStatus?
    public var spread: PredictionStatus?
    public var overUnder: PredictionStatus?

    public init(
        hasAnyHitting: Bool = false,
        moneyline: PredictionStatus? = nil,
        spread: PredictionStatus? = nil,
        overUnder: PredictionStatus? = nil
    ) {
        self.hasAnyHitting = hasAnyHitting
        self.moneyline = moneyline
        self.spread = spread
        self.overUnder = overUnder
    }
}
