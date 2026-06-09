import Foundation

/// MLB game row. Mirrors RN `wagerproof-mobile/types/mlb.ts` (`MLBGame`).
/// Hydrated from a 4-way merge in `MLBGameSheetStore.refresh()`:
///   - `mlb_games_today` (lines, schedule, status, weather, SP)
///   - `mlb_predictions_current` (model probs / edges / signals — full + F5)
///   - `mlb_team_mapping` (team abbreviation + logo url by `mlb_api_id`)
///   - `mlb_game_signals` (per-game / home / away supplemental signal pills)
///
/// Field names are kept snake_case-mapped via `CodingKeys` so the Codable
/// machinery can decode rows directly from Supabase JSON.
public struct MLBGame: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let gamePk: Int

    // Schedule
    public let officialDate: String
    public let gameTimeEt: String?

    // Teams
    public let awayTeamName: String?
    public let homeTeamName: String?
    public let awayTeam: String?
    public let homeTeam: String?
    public let awayTeamFullName: String?
    public let homeTeamFullName: String?
    public let awayTeamId: Int?
    public let homeTeamId: Int?

    // Resolved display fields (set after team mapping)
    public var awayAbbr: String
    public var homeAbbr: String
    public var awayLogoUrl: String?
    public var homeLogoUrl: String?

    // Status
    public let status: String?
    public let isPostponed: Bool?
    public let isCompleted: Bool?
    public let isActive: Bool?

    // Market lines (full game)
    public let awayMl: Int?
    public let homeMl: Int?
    public let awaySpread: Double?
    public let homeSpread: Double?
    public let totalLine: Double?

    // Full-game model outputs
    public let mlHomeWinProb: Double?
    public let mlAwayWinProb: Double?
    public let homeImpliedProb: Double?
    public let awayImpliedProb: Double?
    public let homeMlEdgePct: Double?
    public let awayMlEdgePct: Double?
    public let homeMlStrongSignal: Bool?
    public let awayMlStrongSignal: Bool?
    public let ouEdge: Double?
    public let ouDirection: String? // "OVER" | "UNDER"
    public let ouFairTotal: Double?
    public let ouStrongSignal: Bool?
    public let ouModerateSignal: Bool?

    // First five (F5)
    public let f5HomeMl: Int?
    public let f5AwayMl: Int?
    public let f5FairTotal: Double?
    public let f5PredMargin: Double?
    public let f5TotalLine: Double?
    public let f5HomeSpread: Double?
    public let f5AwaySpread: Double?
    public let f5OuEdge: Double?
    public let f5HomeWinProb: Double?
    public let f5AwayWinProb: Double?
    public let f5HomeImpliedProb: Double?
    public let f5AwayImpliedProb: Double?
    public let f5HomeMlEdgePct: Double?
    public let f5AwayMlEdgePct: Double?
    public let f5HomeMlStrongSignal: Bool?
    public let f5AwayMlStrongSignal: Bool?

    // Starters
    public let homeSpName: String?
    public let awaySpName: String?
    public let homeSpConfirmed: Bool?
    public let awaySpConfirmed: Bool?

    // Prediction metadata
    public let isFinalPrediction: Bool?
    public let projectionLabel: String?

    // Weather
    public let weatherConfirmed: Bool?
    public let weatherImputed: Bool?
    public let temperatureF: Double?
    public let windSpeedMph: Double?
    public let windDirection: String?
    public let sky: String?
    public let venueName: String?

    // Signals attached after fetch (not decoded from row).
    public var signals: [MLBSignalItem]

    public init(
        id: String,
        gamePk: Int,
        officialDate: String,
        gameTimeEt: String? = nil,
        awayTeamName: String? = nil,
        homeTeamName: String? = nil,
        awayTeam: String? = nil,
        homeTeam: String? = nil,
        awayTeamFullName: String? = nil,
        homeTeamFullName: String? = nil,
        awayTeamId: Int? = nil,
        homeTeamId: Int? = nil,
        awayAbbr: String = "AWY",
        homeAbbr: String = "HME",
        awayLogoUrl: String? = nil,
        homeLogoUrl: String? = nil,
        status: String? = nil,
        isPostponed: Bool? = nil,
        isCompleted: Bool? = nil,
        isActive: Bool? = nil,
        awayMl: Int? = nil,
        homeMl: Int? = nil,
        awaySpread: Double? = nil,
        homeSpread: Double? = nil,
        totalLine: Double? = nil,
        mlHomeWinProb: Double? = nil,
        mlAwayWinProb: Double? = nil,
        homeImpliedProb: Double? = nil,
        awayImpliedProb: Double? = nil,
        homeMlEdgePct: Double? = nil,
        awayMlEdgePct: Double? = nil,
        homeMlStrongSignal: Bool? = nil,
        awayMlStrongSignal: Bool? = nil,
        ouEdge: Double? = nil,
        ouDirection: String? = nil,
        ouFairTotal: Double? = nil,
        ouStrongSignal: Bool? = nil,
        ouModerateSignal: Bool? = nil,
        f5HomeMl: Int? = nil,
        f5AwayMl: Int? = nil,
        f5FairTotal: Double? = nil,
        f5PredMargin: Double? = nil,
        f5TotalLine: Double? = nil,
        f5HomeSpread: Double? = nil,
        f5AwaySpread: Double? = nil,
        f5OuEdge: Double? = nil,
        f5HomeWinProb: Double? = nil,
        f5AwayWinProb: Double? = nil,
        f5HomeImpliedProb: Double? = nil,
        f5AwayImpliedProb: Double? = nil,
        f5HomeMlEdgePct: Double? = nil,
        f5AwayMlEdgePct: Double? = nil,
        f5HomeMlStrongSignal: Bool? = nil,
        f5AwayMlStrongSignal: Bool? = nil,
        homeSpName: String? = nil,
        awaySpName: String? = nil,
        homeSpConfirmed: Bool? = nil,
        awaySpConfirmed: Bool? = nil,
        isFinalPrediction: Bool? = nil,
        projectionLabel: String? = nil,
        weatherConfirmed: Bool? = nil,
        weatherImputed: Bool? = nil,
        temperatureF: Double? = nil,
        windSpeedMph: Double? = nil,
        windDirection: String? = nil,
        sky: String? = nil,
        venueName: String? = nil,
        signals: [MLBSignalItem] = []
    ) {
        self.id = id
        self.gamePk = gamePk
        self.officialDate = officialDate
        self.gameTimeEt = gameTimeEt
        self.awayTeamName = awayTeamName
        self.homeTeamName = homeTeamName
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayTeamFullName = awayTeamFullName
        self.homeTeamFullName = homeTeamFullName
        self.awayTeamId = awayTeamId
        self.homeTeamId = homeTeamId
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.awayLogoUrl = awayLogoUrl
        self.homeLogoUrl = homeLogoUrl
        self.status = status
        self.isPostponed = isPostponed
        self.isCompleted = isCompleted
        self.isActive = isActive
        self.awayMl = awayMl
        self.homeMl = homeMl
        self.awaySpread = awaySpread
        self.homeSpread = homeSpread
        self.totalLine = totalLine
        self.mlHomeWinProb = mlHomeWinProb
        self.mlAwayWinProb = mlAwayWinProb
        self.homeImpliedProb = homeImpliedProb
        self.awayImpliedProb = awayImpliedProb
        self.homeMlEdgePct = homeMlEdgePct
        self.awayMlEdgePct = awayMlEdgePct
        self.homeMlStrongSignal = homeMlStrongSignal
        self.awayMlStrongSignal = awayMlStrongSignal
        self.ouEdge = ouEdge
        self.ouDirection = ouDirection
        self.ouFairTotal = ouFairTotal
        self.ouStrongSignal = ouStrongSignal
        self.ouModerateSignal = ouModerateSignal
        self.f5HomeMl = f5HomeMl
        self.f5AwayMl = f5AwayMl
        self.f5FairTotal = f5FairTotal
        self.f5PredMargin = f5PredMargin
        self.f5TotalLine = f5TotalLine
        self.f5HomeSpread = f5HomeSpread
        self.f5AwaySpread = f5AwaySpread
        self.f5OuEdge = f5OuEdge
        self.f5HomeWinProb = f5HomeWinProb
        self.f5AwayWinProb = f5AwayWinProb
        self.f5HomeImpliedProb = f5HomeImpliedProb
        self.f5AwayImpliedProb = f5AwayImpliedProb
        self.f5HomeMlEdgePct = f5HomeMlEdgePct
        self.f5AwayMlEdgePct = f5AwayMlEdgePct
        self.f5HomeMlStrongSignal = f5HomeMlStrongSignal
        self.f5AwayMlStrongSignal = f5AwayMlStrongSignal
        self.homeSpName = homeSpName
        self.awaySpName = awaySpName
        self.homeSpConfirmed = homeSpConfirmed
        self.awaySpConfirmed = awaySpConfirmed
        self.isFinalPrediction = isFinalPrediction
        self.projectionLabel = projectionLabel
        self.weatherConfirmed = weatherConfirmed
        self.weatherImputed = weatherImputed
        self.temperatureF = temperatureF
        self.windSpeedMph = windSpeedMph
        self.windDirection = windDirection
        self.sky = sky
        self.venueName = venueName
        self.signals = signals
    }

    enum CodingKeys: String, CodingKey {
        case id
        case gamePk = "game_pk"
        case officialDate = "official_date"
        case gameTimeEt = "game_time_et"
        case awayTeamName = "away_team_name"
        case homeTeamName = "home_team_name"
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case awayTeamFullName = "away_team_full_name"
        case homeTeamFullName = "home_team_full_name"
        case awayTeamId = "away_team_id"
        case homeTeamId = "home_team_id"
        case awayAbbr = "away_abbr"
        case homeAbbr = "home_abbr"
        case awayLogoUrl = "away_logo_url"
        case homeLogoUrl = "home_logo_url"
        case status
        case isPostponed = "is_postponed"
        case isCompleted = "is_completed"
        case isActive = "is_active"
        case awayMl = "away_ml"
        case homeMl = "home_ml"
        case awaySpread = "away_spread"
        case homeSpread = "home_spread"
        case totalLine = "total_line"
        case mlHomeWinProb = "ml_home_win_prob"
        case mlAwayWinProb = "ml_away_win_prob"
        case homeImpliedProb = "home_implied_prob"
        case awayImpliedProb = "away_implied_prob"
        case homeMlEdgePct = "home_ml_edge_pct"
        case awayMlEdgePct = "away_ml_edge_pct"
        case homeMlStrongSignal = "home_ml_strong_signal"
        case awayMlStrongSignal = "away_ml_strong_signal"
        case ouEdge = "ou_edge"
        case ouDirection = "ou_direction"
        case ouFairTotal = "ou_fair_total"
        case ouStrongSignal = "ou_strong_signal"
        case ouModerateSignal = "ou_moderate_signal"
        case f5HomeMl = "f5_home_ml"
        case f5AwayMl = "f5_away_ml"
        case f5FairTotal = "f5_fair_total"
        case f5PredMargin = "f5_pred_margin"
        case f5TotalLine = "f5_total_line"
        case f5HomeSpread = "f5_home_spread"
        case f5AwaySpread = "f5_away_spread"
        case f5OuEdge = "f5_ou_edge"
        case f5HomeWinProb = "f5_home_win_prob"
        case f5AwayWinProb = "f5_away_win_prob"
        case f5HomeImpliedProb = "f5_home_implied_prob"
        case f5AwayImpliedProb = "f5_away_implied_prob"
        case f5HomeMlEdgePct = "f5_home_ml_edge_pct"
        case f5AwayMlEdgePct = "f5_away_ml_edge_pct"
        case f5HomeMlStrongSignal = "f5_home_ml_strong_signal"
        case f5AwayMlStrongSignal = "f5_away_ml_strong_signal"
        case homeSpName = "home_sp_name"
        case awaySpName = "away_sp_name"
        case homeSpConfirmed = "home_sp_confirmed"
        case awaySpConfirmed = "away_sp_confirmed"
        case isFinalPrediction = "is_final_prediction"
        case projectionLabel = "projection_label"
        case weatherConfirmed = "weather_confirmed"
        case weatherImputed = "weather_imputed"
        case temperatureF = "temperature_f"
        case windSpeedMph = "wind_speed_mph"
        case windDirection = "wind_direction"
        case sky
        case venueName = "venue_name"
        case signals
    }
}

/// Per-game / per-team signal pill. Mirrors RN `MLBSignalItem`.
public struct MLBSignalItem: Codable, Hashable, Sendable {
    public let category: String
    public let severity: String
    public let message: String

    public init(category: String, severity: String, message: String) {
        self.category = category
        self.severity = severity
        self.message = message
    }
}

// MARK: - Derived calculations

extension MLBGame {
    /// Full-game projected runs using Pythagorean-style split (exponent 1.83).
    /// Matches RN `getFullGameRuns` byte-for-byte.
    public var fullGameRuns: (home: Double, away: Double, margin: Double)? {
        guard let p = mlHomeWinProb, let total = ouFairTotal, p > 0, p < 1 else { return nil }
        let exp: Double = 1.83
        let ratio = pow(p / (1 - p), 1 / exp)
        let home = total * ratio / (ratio + 1)
        let away = total / (ratio + 1)
        return (home, away, home - away)
    }

    /// First-five projected runs. Matches RN `getF5Runs`.
    public var f5Runs: (home: Double, away: Double)? {
        guard let total = f5FairTotal, let margin = f5PredMargin else { return nil }
        return ((total + margin) / 2, (total - margin) / 2)
    }
}
