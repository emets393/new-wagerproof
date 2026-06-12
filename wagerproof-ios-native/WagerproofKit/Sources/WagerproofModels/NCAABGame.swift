import Foundation

/// NCAAB game prediction row. Mirrors the RN `NCAABGame` interface in
/// `wagerproof-mobile/types/ncaab.ts`. Built from a 3-way join of
/// `v_cbb_input_values` + `ncaab_predictions` + `ncaab_team_mapping`
/// (see `GamesStore.fetchNCAAB()`).
///
/// Like NBA but lighter: NCAAB carries team adjusted-offense/defense/pace
/// numbers and AP rankings (top-25 only) along with the standard model
/// probability triplet (`home_away_ml_prob`, `home_away_spread_cover_prob`,
/// `ou_result_prob`). The model also exposes `model_fair_home_spread` so
/// the UI can compute spread edges directly.
public struct NCAABGame: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let gameId: Int
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
    // Team stats
    public let homeAdjOffense: Double?
    public let awayAdjOffense: Double?
    public let homeAdjDefense: Double?
    public let awayAdjDefense: Double?
    public let homeAdjPace: Double?
    public let awayAdjPace: Double?
    // Rankings
    public let homeRanking: Int?
    public let awayRanking: Int?
    // Context
    public let conferenceGame: Bool?
    public let neutralSite: Bool?
    // Model predictions
    public let homeAwayMlProb: Double?
    public let homeAwaySpreadCoverProb: Double?
    public let ouResultProb: Double?
    public let predHomeMargin: Double?
    public let predTotalPoints: Double?
    public let runId: String?
    // Predicted scores
    public let homeScorePred: Double?
    public let awayScorePred: Double?
    public let modelFairHomeSpread: Double?
    // Team logos and abbreviations from ncaab_team_mapping
    public let homeTeamLogo: String?
    public let awayTeamLogo: String?
    public let homeTeamAbbrev: String?
    public let awayTeamAbbrev: String?

    public init(
        id: String,
        gameId: Int,
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
        homeAdjOffense: Double? = nil,
        awayAdjOffense: Double? = nil,
        homeAdjDefense: Double? = nil,
        awayAdjDefense: Double? = nil,
        homeAdjPace: Double? = nil,
        awayAdjPace: Double? = nil,
        homeRanking: Int? = nil,
        awayRanking: Int? = nil,
        conferenceGame: Bool? = nil,
        neutralSite: Bool? = nil,
        homeAwayMlProb: Double? = nil,
        homeAwaySpreadCoverProb: Double? = nil,
        ouResultProb: Double? = nil,
        predHomeMargin: Double? = nil,
        predTotalPoints: Double? = nil,
        runId: String? = nil,
        homeScorePred: Double? = nil,
        awayScorePred: Double? = nil,
        modelFairHomeSpread: Double? = nil,
        homeTeamLogo: String? = nil,
        awayTeamLogo: String? = nil,
        homeTeamAbbrev: String? = nil,
        awayTeamAbbrev: String? = nil
    ) {
        self.id = id
        self.gameId = gameId
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
        self.homeAdjOffense = homeAdjOffense
        self.awayAdjOffense = awayAdjOffense
        self.homeAdjDefense = homeAdjDefense
        self.awayAdjDefense = awayAdjDefense
        self.homeAdjPace = homeAdjPace
        self.awayAdjPace = awayAdjPace
        self.homeRanking = homeRanking
        self.awayRanking = awayRanking
        self.conferenceGame = conferenceGame
        self.neutralSite = neutralSite
        self.homeAwayMlProb = homeAwayMlProb
        self.homeAwaySpreadCoverProb = homeAwaySpreadCoverProb
        self.ouResultProb = ouResultProb
        self.predHomeMargin = predHomeMargin
        self.predTotalPoints = predTotalPoints
        self.runId = runId
        self.homeScorePred = homeScorePred
        self.awayScorePred = awayScorePred
        self.modelFairHomeSpread = modelFairHomeSpread
        self.homeTeamLogo = homeTeamLogo
        self.awayTeamLogo = awayTeamLogo
        self.homeTeamAbbrev = homeTeamAbbrev
        self.awayTeamAbbrev = awayTeamAbbrev
    }
}

// MARK: - Situational trends

/// Raw row from `ncaab_game_situational_trends_today` (with fallback to
/// `ncaab_game_situational_trends`). Mirrors RN `NCAABSituationalTrendRow`.
/// Each game has two rows (home + away keyed by `team_side`). The team's
/// situation labels carry the same encoded values as RN
/// (`is_after_loss`, `is_fav`, `is_home_fav`, `one_day_off`, etc.).
public struct NCAABSituationalTrendRow: Identifiable, Codable, Hashable, Sendable {
    public let gameId: Int
    public let gameDate: String
    public let apiTeamId: Int
    public let teamAbbr: String
    public let teamName: String
    /// `"home"` or `"away"`.
    public let teamSide: String

    // Situation labels
    public let lastGameSituation: String?
    public let favDogSituation: String?
    public let sideSpreadSituation: String?
    public let homeAwaySituation: String?
    public let restBucket: String?
    public let restComp: String?

    // ATS records (format: "W-L-P")
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

    // O/U records (format: "O-U-P")
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

    public var id: String { "\(gameId)-\(teamSide)" }

    public init(
        gameId: Int,
        gameDate: String,
        apiTeamId: Int,
        teamAbbr: String,
        teamName: String,
        teamSide: String,
        lastGameSituation: String? = nil,
        favDogSituation: String? = nil,
        sideSpreadSituation: String? = nil,
        homeAwaySituation: String? = nil,
        restBucket: String? = nil,
        restComp: String? = nil,
        atsLastGameRecord: String? = nil,
        atsLastGameCoverPct: Double? = nil,
        atsFavDogRecord: String? = nil,
        atsFavDogCoverPct: Double? = nil,
        atsSideFavDogRecord: String? = nil,
        atsSideFavDogCoverPct: Double? = nil,
        atsHomeAwayRecord: String? = nil,
        atsHomeAwayCoverPct: Double? = nil,
        atsRestBucketRecord: String? = nil,
        atsRestBucketCoverPct: Double? = nil,
        atsRestCompRecord: String? = nil,
        atsRestCompCoverPct: Double? = nil,
        ouLastGameRecord: String? = nil,
        ouLastGameOverPct: Double? = nil,
        ouLastGameUnderPct: Double? = nil,
        ouFavDogRecord: String? = nil,
        ouFavDogOverPct: Double? = nil,
        ouFavDogUnderPct: Double? = nil,
        ouSideFavDogRecord: String? = nil,
        ouSideFavDogOverPct: Double? = nil,
        ouSideFavDogUnderPct: Double? = nil,
        ouHomeAwayRecord: String? = nil,
        ouHomeAwayOverPct: Double? = nil,
        ouHomeAwayUnderPct: Double? = nil,
        ouRestBucketRecord: String? = nil,
        ouRestBucketOverPct: Double? = nil,
        ouRestBucketUnderPct: Double? = nil,
        ouRestCompRecord: String? = nil,
        ouRestCompOverPct: Double? = nil,
        ouRestCompUnderPct: Double? = nil
    ) {
        self.gameId = gameId
        self.gameDate = gameDate
        self.apiTeamId = apiTeamId
        self.teamAbbr = teamAbbr
        self.teamName = teamName
        self.teamSide = teamSide
        self.lastGameSituation = lastGameSituation
        self.favDogSituation = favDogSituation
        self.sideSpreadSituation = sideSpreadSituation
        self.homeAwaySituation = homeAwaySituation
        self.restBucket = restBucket
        self.restComp = restComp
        self.atsLastGameRecord = atsLastGameRecord
        self.atsLastGameCoverPct = atsLastGameCoverPct
        self.atsFavDogRecord = atsFavDogRecord
        self.atsFavDogCoverPct = atsFavDogCoverPct
        self.atsSideFavDogRecord = atsSideFavDogRecord
        self.atsSideFavDogCoverPct = atsSideFavDogCoverPct
        self.atsHomeAwayRecord = atsHomeAwayRecord
        self.atsHomeAwayCoverPct = atsHomeAwayCoverPct
        self.atsRestBucketRecord = atsRestBucketRecord
        self.atsRestBucketCoverPct = atsRestBucketCoverPct
        self.atsRestCompRecord = atsRestCompRecord
        self.atsRestCompCoverPct = atsRestCompCoverPct
        self.ouLastGameRecord = ouLastGameRecord
        self.ouLastGameOverPct = ouLastGameOverPct
        self.ouLastGameUnderPct = ouLastGameUnderPct
        self.ouFavDogRecord = ouFavDogRecord
        self.ouFavDogOverPct = ouFavDogOverPct
        self.ouFavDogUnderPct = ouFavDogUnderPct
        self.ouSideFavDogRecord = ouSideFavDogRecord
        self.ouSideFavDogOverPct = ouSideFavDogOverPct
        self.ouSideFavDogUnderPct = ouSideFavDogUnderPct
        self.ouHomeAwayRecord = ouHomeAwayRecord
        self.ouHomeAwayOverPct = ouHomeAwayOverPct
        self.ouHomeAwayUnderPct = ouHomeAwayUnderPct
        self.ouRestBucketRecord = ouRestBucketRecord
        self.ouRestBucketOverPct = ouRestBucketOverPct
        self.ouRestBucketUnderPct = ouRestBucketUnderPct
        self.ouRestCompRecord = ouRestCompRecord
        self.ouRestCompOverPct = ouRestCompOverPct
        self.ouRestCompUnderPct = ouRestCompUnderPct
    }

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case gameDate = "game_date"
        case apiTeamId = "api_team_id"
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

/// Combined home + away trends payload for one NCAAB game. Mirrors RN
/// `NCAABGameTrendsData`. Includes the two team rows, optional logos,
/// and the two pre-computed sort scores (O/U consensus + ATS dominance).
public struct NCAABGameTrendsData: Identifiable, Hashable, Sendable {
    public let gameId: Int
    public let gameDate: String
    public let tipoffTime: String?
    public let awayTeam: NCAABSituationalTrendRow
    public let homeTeam: NCAABSituationalTrendRow
    public let awayTeamLogo: String?
    public let homeTeamLogo: String?
    public var ouConsensusScore: Double?
    public var atsDominanceScore: Double?

    public var id: Int { gameId }

    public init(
        gameId: Int,
        gameDate: String,
        tipoffTime: String? = nil,
        awayTeam: NCAABSituationalTrendRow,
        homeTeam: NCAABSituationalTrendRow,
        awayTeamLogo: String? = nil,
        homeTeamLogo: String? = nil,
        ouConsensusScore: Double? = nil,
        atsDominanceScore: Double? = nil
    ) {
        self.gameId = gameId
        self.gameDate = gameDate
        self.tipoffTime = tipoffTime
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayTeamLogo = awayTeamLogo
        self.homeTeamLogo = homeTeamLogo
        self.ouConsensusScore = ouConsensusScore
        self.atsDominanceScore = atsDominanceScore
    }
}

// MARK: - Record parsing helpers

/// Parse a `"W-L-P"` (or `"O-U-P"`) record string into its component parts.
/// Mirrors RN `parseNCAABRecord`.
public struct NCAABParsedRecord: Sendable, Hashable {
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public var total: Int { wins + losses + pushes }
}

public func parseNCAABRecord(_ record: String?) -> NCAABParsedRecord {
    guard let record else { return NCAABParsedRecord(wins: 0, losses: 0, pushes: 0) }
    let parts = record.split(separator: "-").map { Int($0) ?? 0 }
    let w = parts.indices.contains(0) ? parts[0] : 0
    let l = parts.indices.contains(1) ? parts[1] : 0
    let p = parts.indices.contains(2) ? parts[2] : 0
    return NCAABParsedRecord(wins: w, losses: l, pushes: p)
}

/// Convert encoded situation tag into the human-readable label shown in the
/// trends sheet. Mirrors RN `formatNCAABSituation`.
public func formatNCAABSituation(_ situation: String?) -> String {
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

// MARK: - Model accuracy bucket

/// Edge-bucket accuracy pair (sample size + hit rate). Decoded from the
/// `*_accuracy_pct` / `*_bucket_games` columns of
/// `ncaab_todays_games_predictions_with_accuracy`. Used by the in-sheet
/// "Model Accuracy" widget. Mirrors RN `AccuracyBucket` shape.
public struct NCAABAccuracyBucket: Codable, Hashable, Sendable {
    public let games: Int
    public let accuracyPct: Double

    public init(games: Int, accuracyPct: Double) {
        self.games = games
        self.accuracyPct = accuracyPct
    }
}

/// Per-game accuracy payload for the in-sheet model accuracy widget.
/// Mirrors RN `GameAccuracyData` from `types/modelAccuracy.ts`. Built by
/// `NCAABModelAccuracyStore` from the
/// `ncaab_todays_games_predictions_with_accuracy` view (logos joined
/// separately via `ncaab_team_mapping`).
public struct NCAABModelAccuracyGame: Identifiable, Hashable, Sendable {
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
    public let spreadAccuracy: NCAABAccuracyBucket?
    // Moneyline
    public let homeWinProb: Double?
    public let awayWinProb: Double?
    public let mlPickIsHome: Bool?
    public let mlPickProbRounded: Double?
    public let mlAccuracy: NCAABAccuracyBucket?
    // Over/Under
    public let overLine: Double?
    public let overLineDiff: Double?
    public let ouAccuracy: NCAABAccuracyBucket?
    // Logos
    public let awayTeamLogo: String?
    public let homeTeamLogo: String?

    public var id: Int { gameId }

    public init(
        gameId: Int,
        awayTeam: String,
        homeTeam: String,
        awayAbbr: String,
        homeAbbr: String,
        gameDate: String,
        tipoffTime: String? = nil,
        homeSpread: Double? = nil,
        homeSpreadDiff: Double? = nil,
        spreadAccuracy: NCAABAccuracyBucket? = nil,
        homeWinProb: Double? = nil,
        awayWinProb: Double? = nil,
        mlPickIsHome: Bool? = nil,
        mlPickProbRounded: Double? = nil,
        mlAccuracy: NCAABAccuracyBucket? = nil,
        overLine: Double? = nil,
        overLineDiff: Double? = nil,
        ouAccuracy: NCAABAccuracyBucket? = nil,
        awayTeamLogo: String? = nil,
        homeTeamLogo: String? = nil
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
        self.awayTeamLogo = awayTeamLogo
        self.homeTeamLogo = homeTeamLogo
    }
}

// MARK: - Team mapping cache entry

/// Single row in the `ncaab_team_mapping` cache. Built once per session
/// (warmed by `NCAABTeamMappingStore`) and consumed by both
/// `GamesStore.fetchNCAAB()` and the model-accuracy / trends merges.
public struct NCAABTeamMappingEntry: Codable, Hashable, Sendable {
    public let apiTeamId: Int
    public let abbrev: String?
    public let logoUrl: String?
    public let teamRankingName: String?

    public init(apiTeamId: Int, abbrev: String?, logoUrl: String?, teamRankingName: String?) {
        self.apiTeamId = apiTeamId
        self.abbrev = abbrev
        self.logoUrl = logoUrl
        self.teamRankingName = teamRankingName
    }
}
