import Foundation

/// NFL game prediction row. Mirrors the RN `NFLPrediction` interface in
/// `wagerproof-mobile/types/nfl.ts`. The shape comes from a 4-way join in
/// `GamesStore.refreshNFL()` between `v_input_values_with_epa`,
/// `nfl_predictions_epa`, `nfl_betting_lines`, and `production_weather`.
///
/// Field names are kept snake_case-mapped via `CodingKeys` so the Codable
/// machinery can decode rows directly from Supabase JSON. The Swift
/// property names use camelCase.
public struct NFLPrediction: Identifiable, Codable, Hashable, Sendable {
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
    /// Probability the moneyline prediction comes in (home favorite).
    public let homeAwayMlProb: Double?
    /// Probability the home team covers the spread. Below 0.5 → away covers.
    public let homeAwaySpreadCoverProb: Double?
    /// Probability the total goes Over. Below 0.5 → Under.
    public let ouResultProb: Double?
    /// Model fair total (`fg_pred_total` in the dry-run contract). The legacy
    /// pipeline doesn't publish one — nil there, and the card falls back to
    /// `ouResultProb` for O/U direction.
    public let predTotal: Double?
    public let runId: String?
    // Weather
    public let temperature: Double?
    public let precipitation: Double?
    public let windSpeed: Double?
    public let icon: String?
    // Public betting splits (display labels)
    public let spreadSplitsLabel: String?
    public let totalSplitsLabel: String?
    public let mlSplitsLabel: String?
    // Public betting raw percentages — decimal strings, e.g. "0.61"
    public let homeMlHandle: String?
    public let awayMlHandle: String?
    public let homeMlBets: String?
    public let awayMlBets: String?
    public let homeSpreadHandle: String?
    public let awaySpreadHandle: String?
    public let homeSpreadBets: String?
    public let awaySpreadBets: String?
    public let overHandle: String?
    public let underHandle: String?
    public let overBets: String?
    public let underBets: String?

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
        predTotal: Double? = nil,
        runId: String? = nil,
        temperature: Double? = nil,
        precipitation: Double? = nil,
        windSpeed: Double? = nil,
        icon: String? = nil,
        spreadSplitsLabel: String? = nil,
        totalSplitsLabel: String? = nil,
        mlSplitsLabel: String? = nil,
        homeMlHandle: String? = nil,
        awayMlHandle: String? = nil,
        homeMlBets: String? = nil,
        awayMlBets: String? = nil,
        homeSpreadHandle: String? = nil,
        awaySpreadHandle: String? = nil,
        homeSpreadBets: String? = nil,
        awaySpreadBets: String? = nil,
        overHandle: String? = nil,
        underHandle: String? = nil,
        overBets: String? = nil,
        underBets: String? = nil
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
        self.predTotal = predTotal
        self.runId = runId
        self.temperature = temperature
        self.precipitation = precipitation
        self.windSpeed = windSpeed
        self.icon = icon
        self.spreadSplitsLabel = spreadSplitsLabel
        self.totalSplitsLabel = totalSplitsLabel
        self.mlSplitsLabel = mlSplitsLabel
        self.homeMlHandle = homeMlHandle
        self.awayMlHandle = awayMlHandle
        self.homeMlBets = homeMlBets
        self.awayMlBets = awayMlBets
        self.homeSpreadHandle = homeSpreadHandle
        self.awaySpreadHandle = awaySpreadHandle
        self.homeSpreadBets = homeSpreadBets
        self.awaySpreadBets = awaySpreadBets
        self.overHandle = overHandle
        self.underHandle = underHandle
        self.overBets = overBets
        self.underBets = underBets
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
        case predTotal = "pred_total"
        case runId = "run_id"
        case temperature
        case precipitation
        case windSpeed = "wind_speed"
        case icon
        case spreadSplitsLabel = "spread_splits_label"
        case totalSplitsLabel = "total_splits_label"
        case mlSplitsLabel = "ml_splits_label"
        case homeMlHandle = "home_ml_handle"
        case awayMlHandle = "away_ml_handle"
        case homeMlBets = "home_ml_bets"
        case awayMlBets = "away_ml_bets"
        case homeSpreadHandle = "home_spread_handle"
        case awaySpreadHandle = "away_spread_handle"
        case homeSpreadBets = "home_spread_bets"
        case awaySpreadBets = "away_spread_bets"
        case overHandle = "over_handle"
        case underHandle = "under_handle"
        case overBets = "over_bets"
        case underBets = "under_bets"
    }
}
