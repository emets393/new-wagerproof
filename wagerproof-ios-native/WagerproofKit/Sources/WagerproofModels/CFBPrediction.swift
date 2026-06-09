import Foundation

/// CFB game prediction row. Mirrors the RN `CFBPrediction` interface in
/// `wagerproof-mobile/types/cfb.ts`. Comes from a 2-way join between
/// `cfb_live_weekly_inputs` and `cfb_api_predictions` (see
/// `GamesStore.refreshCFB()`).
///
/// Unlike NFL, CFB carries its own score-projection fields (`pred_away_score`,
/// `pred_home_score`, etc.) along with edge fields (`home_spread_diff`,
/// `over_line_diff`) used for sorting by value.
public struct CFBPrediction: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let awayTeam: String
    public let homeTeam: String
    public let homeMl: Int?
    public let awayMl: Int?
    public let homeSpread: Double?
    public let awaySpread: Double?
    public let overLine: Double?
    public let gameDate: String
    public let gameTime: String
    public let trainingKey: String
    public let uniqueId: String
    public let homeAwayMlProb: Double?
    public let homeAwaySpreadCoverProb: Double?
    public let ouResultProb: Double?
    public let runId: String?
    public let temperature: Double?
    public let precipitation: Double?
    public let windSpeed: Double?
    public let icon: String?
    public let spreadSplitsLabel: String?
    public let totalSplitsLabel: String?
    public let mlSplitsLabel: String?
    public let conference: String?
    // CFB-specific prediction fields (from cfb_api_predictions join)
    public let predAwayScore: Double?
    public let predHomeScore: Double?
    public let predAwayPoints: Double?
    public let predHomePoints: Double?
    public let predSpread: Double?
    public let homeSpreadDiff: Double?
    public let predTotal: Double?
    public let totalDiff: Double?
    public let predOverLine: Double?
    public let overLineDiff: Double?
    // Opening line snapshot
    public let openingSpread: Double?
    public let openingTotal: Double?

    public init(
        id: String,
        awayTeam: String,
        homeTeam: String,
        homeMl: Int? = nil,
        awayMl: Int? = nil,
        homeSpread: Double? = nil,
        awaySpread: Double? = nil,
        overLine: Double? = nil,
        gameDate: String,
        gameTime: String,
        trainingKey: String,
        uniqueId: String,
        homeAwayMlProb: Double? = nil,
        homeAwaySpreadCoverProb: Double? = nil,
        ouResultProb: Double? = nil,
        runId: String? = nil,
        temperature: Double? = nil,
        precipitation: Double? = nil,
        windSpeed: Double? = nil,
        icon: String? = nil,
        spreadSplitsLabel: String? = nil,
        totalSplitsLabel: String? = nil,
        mlSplitsLabel: String? = nil,
        conference: String? = nil,
        predAwayScore: Double? = nil,
        predHomeScore: Double? = nil,
        predAwayPoints: Double? = nil,
        predHomePoints: Double? = nil,
        predSpread: Double? = nil,
        homeSpreadDiff: Double? = nil,
        predTotal: Double? = nil,
        totalDiff: Double? = nil,
        predOverLine: Double? = nil,
        overLineDiff: Double? = nil,
        openingSpread: Double? = nil,
        openingTotal: Double? = nil
    ) {
        self.id = id
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.homeMl = homeMl
        self.awayMl = awayMl
        self.homeSpread = homeSpread
        self.awaySpread = awaySpread
        self.overLine = overLine
        self.gameDate = gameDate
        self.gameTime = gameTime
        self.trainingKey = trainingKey
        self.uniqueId = uniqueId
        self.homeAwayMlProb = homeAwayMlProb
        self.homeAwaySpreadCoverProb = homeAwaySpreadCoverProb
        self.ouResultProb = ouResultProb
        self.runId = runId
        self.temperature = temperature
        self.precipitation = precipitation
        self.windSpeed = windSpeed
        self.icon = icon
        self.spreadSplitsLabel = spreadSplitsLabel
        self.totalSplitsLabel = totalSplitsLabel
        self.mlSplitsLabel = mlSplitsLabel
        self.conference = conference
        self.predAwayScore = predAwayScore
        self.predHomeScore = predHomeScore
        self.predAwayPoints = predAwayPoints
        self.predHomePoints = predHomePoints
        self.predSpread = predSpread
        self.homeSpreadDiff = homeSpreadDiff
        self.predTotal = predTotal
        self.totalDiff = totalDiff
        self.predOverLine = predOverLine
        self.overLineDiff = overLineDiff
        self.openingSpread = openingSpread
        self.openingTotal = openingTotal
    }

    enum CodingKeys: String, CodingKey {
        case id
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case homeMl = "home_ml"
        case awayMl = "away_ml"
        case homeSpread = "home_spread"
        case awaySpread = "away_spread"
        case overLine = "over_line"
        case gameDate = "game_date"
        case gameTime = "game_time"
        case trainingKey = "training_key"
        case uniqueId = "unique_id"
        case homeAwayMlProb = "home_away_ml_prob"
        case homeAwaySpreadCoverProb = "home_away_spread_cover_prob"
        case ouResultProb = "ou_result_prob"
        case runId = "run_id"
        case temperature
        case precipitation
        case windSpeed = "wind_speed"
        case icon
        case spreadSplitsLabel = "spread_splits_label"
        case totalSplitsLabel = "total_splits_label"
        case mlSplitsLabel = "ml_splits_label"
        case conference
        case predAwayScore = "pred_away_score"
        case predHomeScore = "pred_home_score"
        case predAwayPoints = "pred_away_points"
        case predHomePoints = "pred_home_points"
        case predSpread = "pred_spread"
        case homeSpreadDiff = "home_spread_diff"
        case predTotal = "pred_total"
        case totalDiff = "total_diff"
        case predOverLine = "pred_over_line"
        case overLineDiff = "over_line_diff"
        case openingSpread = "opening_spread"
        case openingTotal = "opening_total"
    }
}
