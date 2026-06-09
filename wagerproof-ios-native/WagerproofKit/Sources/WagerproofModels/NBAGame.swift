import Foundation

/// NBA game prediction row. Mirrors the RN `NBAGame` interface in
/// `wagerproof-mobile/types/nba.ts`. The shape comes from a 2-way merge in
/// `GamesStore.refreshNBA()` between `nba_input_values_view` and
/// `nba_predictions` (latest `as_of_ts_utc` per `game_id`).
///
/// Probabilities `homeAwaySpreadCoverProb` and `ouResultProb` are derived
/// client-side from the model's fair spread / fair total (RN does the same
/// math in `index.tsx:457-479`):
///   - spread: `0.5 ± min(|model_fair_home_spread - home_spread| * 0.05, 0.35)`
///   - total : `0.5 ± min(|model_fair_total - over_line| * 0.02, 0.35)`
public struct NBAGame: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let gameId: Int
    public let awayTeam: String
    public let homeTeam: String
    public let awayAbbr: String
    public let homeAbbr: String
    public let homeMl: Int?
    public let awayMl: Int?
    public let homeSpread: Double?
    public let awaySpread: Double?
    public let overLine: Double?
    public let gameDate: String
    public let gameTime: String
    public let trainingKey: String
    public let uniqueId: String
    // Team stats (from nba_input_values_view)
    public let homeAdjOffense: Double?
    public let awayAdjOffense: Double?
    public let homeAdjDefense: Double?
    public let awayAdjDefense: Double?
    public let homeAdjPace: Double?
    public let awayAdjPace: Double?
    // Trends
    public let homeAtsPct: Double?
    public let awayAtsPct: Double?
    public let homeOverPct: Double?
    public let awayOverPct: Double?
    // Model predictions (derived)
    public let homeAwayMlProb: Double?
    public let homeAwaySpreadCoverProb: Double?
    public let ouResultProb: Double?
    public let runId: String?
    // Predicted scores + fair lines (from nba_predictions)
    public let homeScorePred: Double?
    public let awayScorePred: Double?
    public let modelFairHomeSpread: Double?
    public let modelFairTotal: Double?

    public init(
        id: String,
        gameId: Int,
        awayTeam: String,
        homeTeam: String,
        awayAbbr: String,
        homeAbbr: String,
        homeMl: Int? = nil,
        awayMl: Int? = nil,
        homeSpread: Double? = nil,
        awaySpread: Double? = nil,
        overLine: Double? = nil,
        gameDate: String,
        gameTime: String,
        trainingKey: String,
        uniqueId: String,
        homeAdjOffense: Double? = nil,
        awayAdjOffense: Double? = nil,
        homeAdjDefense: Double? = nil,
        awayAdjDefense: Double? = nil,
        homeAdjPace: Double? = nil,
        awayAdjPace: Double? = nil,
        homeAtsPct: Double? = nil,
        awayAtsPct: Double? = nil,
        homeOverPct: Double? = nil,
        awayOverPct: Double? = nil,
        homeAwayMlProb: Double? = nil,
        homeAwaySpreadCoverProb: Double? = nil,
        ouResultProb: Double? = nil,
        runId: String? = nil,
        homeScorePred: Double? = nil,
        awayScorePred: Double? = nil,
        modelFairHomeSpread: Double? = nil,
        modelFairTotal: Double? = nil
    ) {
        self.id = id
        self.gameId = gameId
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.homeMl = homeMl
        self.awayMl = awayMl
        self.homeSpread = homeSpread
        self.awaySpread = awaySpread
        self.overLine = overLine
        self.gameDate = gameDate
        self.gameTime = gameTime
        self.trainingKey = trainingKey
        self.uniqueId = uniqueId
        self.homeAdjOffense = homeAdjOffense
        self.awayAdjOffense = awayAdjOffense
        self.homeAdjDefense = homeAdjDefense
        self.awayAdjDefense = awayAdjDefense
        self.homeAdjPace = homeAdjPace
        self.awayAdjPace = awayAdjPace
        self.homeAtsPct = homeAtsPct
        self.awayAtsPct = awayAtsPct
        self.homeOverPct = homeOverPct
        self.awayOverPct = awayOverPct
        self.homeAwayMlProb = homeAwayMlProb
        self.homeAwaySpreadCoverProb = homeAwaySpreadCoverProb
        self.ouResultProb = ouResultProb
        self.runId = runId
        self.homeScorePred = homeScorePred
        self.awayScorePred = awayScorePred
        self.modelFairHomeSpread = modelFairHomeSpread
        self.modelFairTotal = modelFairTotal
    }
}

// MARK: - Injury / trends

/// NBA injury report row. Mirrors RN `NBAInjuryReport` in `types/nba.ts`.
/// Sourced from the `nba_injury_report` table on the CFB Supabase project.
public struct NBAInjuryReport: Codable, Hashable, Sendable {
    public let playerName: String
    /// `avg_pie_season` ships as either a `Double` or a stringified decimal.
    /// We decode as String and convert at the call site (mirrors RN behavior
    /// in `useNBAMatchupOverview` which does `typeof === 'string'` casing).
    public let avgPieSeason: String?
    public let status: String
    public let teamId: Int?
    public let teamName: String
    public let teamAbbr: String

    public init(
        playerName: String,
        avgPieSeason: String?,
        status: String,
        teamId: Int?,
        teamName: String,
        teamAbbr: String
    ) {
        self.playerName = playerName
        self.avgPieSeason = avgPieSeason
        self.status = status
        self.teamId = teamId
        self.teamName = teamName
        self.teamAbbr = teamAbbr
    }

    public var pieValue: Double? {
        guard let raw = avgPieSeason else { return nil }
        return Double(raw)
    }

    enum CodingKeys: String, CodingKey {
        case playerName = "player_name"
        case avgPieSeason = "avg_pie_season"
        case status
        case teamId = "team_id"
        case teamName = "team_name"
        case teamAbbr = "team_abbr"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.playerName = try c.decode(String.self, forKey: .playerName)
        // PIE may decode as Double, Int, or String. Normalize to String.
        if let d = try? c.decode(Double.self, forKey: .avgPieSeason) {
            self.avgPieSeason = String(d)
        } else if let i = try? c.decode(Int.self, forKey: .avgPieSeason) {
            self.avgPieSeason = String(i)
        } else if let s = try? c.decode(String.self, forKey: .avgPieSeason) {
            self.avgPieSeason = s
        } else {
            self.avgPieSeason = nil
        }
        self.status = (try? c.decode(String.self, forKey: .status)) ?? ""
        self.teamId = try? c.decode(Int.self, forKey: .teamId)
        self.teamName = (try? c.decode(String.self, forKey: .teamName)) ?? ""
        self.teamAbbr = (try? c.decode(String.self, forKey: .teamAbbr)) ?? ""
    }
}

/// NBA recent-trends payload. Mirrors RN `NBAGameTrends` in `types/nba.ts`.
/// Sourced from `nba_input_values_view` (same row that produced `NBAGame`,
/// but RN re-fetches it via `useNBAMatchupOverview` to keep the dependency
/// graph clean).
public struct NBAGameTrends: Codable, Hashable, Sendable {
    public let homeOvrRtg: Double?
    public let awayOvrRtg: Double?
    public let homeConsistency: Double?
    public let awayConsistency: Double?
    public let homeWinStreak: Double?
    public let awayWinStreak: Double?
    public let homeAtsPct: Double?
    public let awayAtsPct: Double?
    public let homeAtsStreak: Double?
    public let awayAtsStreak: Double?
    public let homeLastMargin: Double?
    public let awayLastMargin: Double?
    public let homeOverPct: Double?
    public let awayOverPct: Double?
    public let homeAdjPacePregameL3Trend: Double?
    public let awayAdjPacePregameL3Trend: Double?
    public let homeAdjOffRtgPregameL3Trend: Double?
    public let awayAdjOffRtgPregameL3Trend: Double?
    public let homeAdjDefRtgPregameL3Trend: Double?
    public let awayAdjDefRtgPregameL3Trend: Double?

    enum CodingKeys: String, CodingKey {
        case homeOvrRtg = "home_ovr_rtg"
        case awayOvrRtg = "away_ovr_rtg"
        case homeConsistency = "home_consistency"
        case awayConsistency = "away_consistency"
        case homeWinStreak = "home_win_streak"
        case awayWinStreak = "away_win_streak"
        case homeAtsPct = "home_ats_pct"
        case awayAtsPct = "away_ats_pct"
        case homeAtsStreak = "home_ats_streak"
        case awayAtsStreak = "away_ats_streak"
        case homeLastMargin = "home_last_margin"
        case awayLastMargin = "away_last_margin"
        case homeOverPct = "home_over_pct"
        case awayOverPct = "away_over_pct"
        case homeAdjPacePregameL3Trend = "home_adj_pace_pregame_l3_trend"
        case awayAdjPacePregameL3Trend = "away_adj_pace_pregame_l3_trend"
        case homeAdjOffRtgPregameL3Trend = "home_adj_off_rtg_pregame_l3_trend"
        case awayAdjOffRtgPregameL3Trend = "away_adj_off_rtg_pregame_l3_trend"
        case homeAdjDefRtgPregameL3Trend = "home_adj_def_rtg_pregame_l3_trend"
        case awayAdjDefRtgPregameL3Trend = "away_adj_def_rtg_pregame_l3_trend"
    }
}

// MARK: - Situational betting trends

/// Single row from `nba_game_situational_trends_today` (or the fallback
/// `nba_game_situational_trends`). Mirrors RN `SituationalTrendRow` in
/// `types/nbaBettingTrends.ts`.
///
/// Records are stringified as `"W-L-P"` (ATS) or `"O-U-P"` (O/U).
public struct NBASituationalTrendRow: Codable, Hashable, Sendable {
    public let gameId: Int
    public let gameDate: String
    public let teamId: Int
    public let teamAbbr: String
    public let teamName: String
    public let teamSide: String  // "home" | "away"
    // Situation labels
    public let lastGameSituation: String?
    public let favDogSituation: String?
    public let sideSpreadSituation: String?
    public let homeAwaySituation: String?
    public let restBucket: String?
    public let restComp: String?
    // ATS records
    public let atsLastGameRecord: String?
    public let atsLastGameCoverPct: Double?
    public let atsFavDogRecord: String?
    public let atsFavDogCoverPct: Double?
    public let atsSideFavDogRecord: String?
    public let atsSideFavDogCoverPct: Double?
    public let atsHomeAwayRecord: String?
    public let atsHomeAwayCoverPct: Double?
    public let atsRestBucketRecord: String?
    public let atsRestBucketCoverPct: Double?
    public let atsRestCompRecord: String?
    public let atsRestCompCoverPct: Double?
    // OU records
    public let ouLastGameRecord: String?
    public let ouLastGameOverPct: Double?
    public let ouLastGameUnderPct: Double?
    public let ouFavDogRecord: String?
    public let ouFavDogOverPct: Double?
    public let ouFavDogUnderPct: Double?
    public let ouSideFavDogRecord: String?
    public let ouSideFavDogOverPct: Double?
    public let ouSideFavDogUnderPct: Double?
    public let ouHomeAwayRecord: String?
    public let ouHomeAwayOverPct: Double?
    public let ouHomeAwayUnderPct: Double?
    public let ouRestBucketRecord: String?
    public let ouRestBucketOverPct: Double?
    public let ouRestBucketUnderPct: Double?
    public let ouRestCompRecord: String?
    public let ouRestCompOverPct: Double?
    public let ouRestCompUnderPct: Double?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case gameDate = "game_date"
        case teamId = "team_id"
        case teamAbbr = "team_abbr"
        case teamName = "team_name"
        case teamSide = "team_side"
        case lastGameSituation = "last_game_situation"
        case favDogSituation = "fav_dog_situation"
        case sideSpreadSituation = "side_spread_situation"
        case homeAwaySituation = "home_away_situation"
        case restBucket = "rest_bucket"
        case restComp = "rest_comp"
        case atsLastGameRecord = "ats_last_game_record"
        case atsLastGameCoverPct = "ats_last_game_cover_pct"
        case atsFavDogRecord = "ats_fav_dog_record"
        case atsFavDogCoverPct = "ats_fav_dog_cover_pct"
        case atsSideFavDogRecord = "ats_side_fav_dog_record"
        case atsSideFavDogCoverPct = "ats_side_fav_dog_cover_pct"
        case atsHomeAwayRecord = "ats_home_away_record"
        case atsHomeAwayCoverPct = "ats_home_away_cover_pct"
        case atsRestBucketRecord = "ats_rest_bucket_record"
        case atsRestBucketCoverPct = "ats_rest_bucket_cover_pct"
        case atsRestCompRecord = "ats_rest_comp_record"
        case atsRestCompCoverPct = "ats_rest_comp_cover_pct"
        case ouLastGameRecord = "ou_last_game_record"
        case ouLastGameOverPct = "ou_last_game_over_pct"
        case ouLastGameUnderPct = "ou_last_game_under_pct"
        case ouFavDogRecord = "ou_fav_dog_record"
        case ouFavDogOverPct = "ou_fav_dog_over_pct"
        case ouFavDogUnderPct = "ou_fav_dog_under_pct"
        case ouSideFavDogRecord = "ou_side_fav_dog_record"
        case ouSideFavDogOverPct = "ou_side_fav_dog_over_pct"
        case ouSideFavDogUnderPct = "ou_side_fav_dog_under_pct"
        case ouHomeAwayRecord = "ou_home_away_record"
        case ouHomeAwayOverPct = "ou_home_away_over_pct"
        case ouHomeAwayUnderPct = "ou_home_away_under_pct"
        case ouRestBucketRecord = "ou_rest_bucket_record"
        case ouRestBucketOverPct = "ou_rest_bucket_over_pct"
        case ouRestBucketUnderPct = "ou_rest_bucket_under_pct"
        case ouRestCompRecord = "ou_rest_comp_record"
        case ouRestCompOverPct = "ou_rest_comp_over_pct"
        case ouRestCompUnderPct = "ou_rest_comp_under_pct"
    }
}

/// Combined home + away trends data for a single matchup. Mirrors RN
/// `NBAGameTrendsData` in `types/nbaBettingTrends.ts`.
public struct NBAGameTrendsData: Identifiable, Hashable, Sendable {
    public let gameId: Int
    public let gameDate: String
    public var tipoffTime: String?
    public let awayTeam: NBASituationalTrendRow
    public let homeTeam: NBASituationalTrendRow

    public var id: Int { gameId }

    public init(
        gameId: Int,
        gameDate: String,
        tipoffTime: String?,
        awayTeam: NBASituationalTrendRow,
        homeTeam: NBASituationalTrendRow
    ) {
        self.gameId = gameId
        self.gameDate = gameDate
        self.tipoffTime = tipoffTime
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
    }
}

/// Parse a record string like "15-3-0" into wins/losses/pushes/total.
/// Mirrors RN `parseRecord` helper.
public struct NBARecord: Hashable, Sendable {
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public var total: Int { wins + losses + pushes }
    public init(wins: Int, losses: Int, pushes: Int) {
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
    }
}

public func parseNBARecord(_ raw: String?) -> NBARecord {
    guard let raw = raw, !raw.isEmpty else { return NBARecord(wins: 0, losses: 0, pushes: 0) }
    let parts = raw.split(separator: "-").map { Int($0) ?? 0 }
    return NBARecord(
        wins: parts.indices.contains(0) ? parts[0] : 0,
        losses: parts.indices.contains(1) ? parts[1] : 0,
        pushes: parts.indices.contains(2) ? parts[2] : 0
    )
}

/// Convert encoded situation tag into the human-readable label shown in the
/// trends sheet. Mirrors RN `formatSituation` in `types/nbaBettingTrends.ts`.
public func formatNBASituation(_ situation: String?) -> String {
    guard let situation, !situation.isEmpty else { return "-" }
    let map: [String: String] = [
        "is_after_loss": "After Loss",
        "is_after_win": "After Win",
        "is_fav": "Favorite",
        "is_dog": "Underdog",
        "is_home_fav": "Home Favorite",
        "is_away_fav": "Away Favorite",
        "is_home_dog": "Home Underdog",
        "is_away_dog": "Away Underdog",
        "one_day_off": "1 Day Off",
        "two_three_days_off": "2-3 Days Off",
        "four_plus_days_off": "4+ Days Off",
        "rest_advantage": "Rest Advantage",
        "rest_disadvantage": "Rest Disadvantage",
        "rest_equal": "Rest Equal"
    ]
    if let mapped = map[situation] { return mapped }
    return situation.replacingOccurrences(of: "_", with: " ")
        .split(separator: " ")
        .map { $0.prefix(1).uppercased() + $0.dropFirst() }
        .joined(separator: " ")
}

// MARK: - Model accuracy

/// Single accuracy bucket (count of historical games + accuracy %). Mirrors
/// RN `AccuracyBucket` in `types/modelAccuracy.ts`.
public struct NBAAccuracyBucket: Codable, Hashable, Sendable {
    public let games: Int
    public let accuracyPct: Double
    public init(games: Int, accuracyPct: Double) {
        self.games = games
        self.accuracyPct = accuracyPct
    }
}

/// Per-game accuracy snapshot. Mirrors RN `GameAccuracyData` in
/// `types/modelAccuracy.ts`. Built from a single row of the
/// `nba_todays_games_predictions_with_accuracy` view.
public struct NBAModelAccuracyData: Identifiable, Hashable, Sendable {
    public let gameId: Int
    public let awayTeam: String
    public let homeTeam: String
    public let awayAbbr: String
    public let homeAbbr: String
    public let gameDate: String
    public let tipoffTime: String?
    // Spread
    public let homeSpread: Double?
    public let homeSpreadDiff: Double?
    public let spreadAccuracy: NBAAccuracyBucket?
    // Moneyline
    public let homeWinProb: Double?
    public let awayWinProb: Double?
    public let mlPickIsHome: Bool?
    public let mlPickProbRounded: Double?
    public let mlAccuracy: NBAAccuracyBucket?
    // Over/Under
    public let overLine: Double?
    public let overLineDiff: Double?
    public let ouAccuracy: NBAAccuracyBucket?

    public var id: Int { gameId }

    public init(
        gameId: Int,
        awayTeam: String,
        homeTeam: String,
        awayAbbr: String,
        homeAbbr: String,
        gameDate: String,
        tipoffTime: String?,
        homeSpread: Double?,
        homeSpreadDiff: Double?,
        spreadAccuracy: NBAAccuracyBucket?,
        homeWinProb: Double?,
        awayWinProb: Double?,
        mlPickIsHome: Bool?,
        mlPickProbRounded: Double?,
        mlAccuracy: NBAAccuracyBucket?,
        overLine: Double?,
        overLineDiff: Double?,
        ouAccuracy: NBAAccuracyBucket?
    ) {
        self.gameId = gameId
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.gameDate = gameDate
        self.tipoffTime = tipoffTime
        self.homeSpread = homeSpread
        self.homeSpreadDiff = homeSpreadDiff
        self.spreadAccuracy = spreadAccuracy
        self.homeWinProb = homeWinProb
        self.awayWinProb = awayWinProb
        self.mlPickIsHome = mlPickIsHome
        self.mlPickProbRounded = mlPickProbRounded
        self.mlAccuracy = mlAccuracy
        self.overLine = overLine
        self.overLineDiff = overLineDiff
        self.ouAccuracy = ouAccuracy
    }
}
