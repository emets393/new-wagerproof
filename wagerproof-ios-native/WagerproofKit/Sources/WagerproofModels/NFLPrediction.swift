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
    public struct ConvictionPlay: Codable, Hashable, Sendable, Identifiable {
        public var id: String { "\(cardGroup)-\(pickLabel)" }
        public let cardGroup: String
        public let conviction: String?
        public let recommendation: String?
        public let pickLabel: String

        public init(cardGroup: String, conviction: String? = nil, recommendation: String? = nil, pickLabel: String) {
            self.cardGroup = cardGroup
            self.conviction = conviction
            self.recommendation = recommendation
            self.pickLabel = pickLabel
        }

        enum CodingKeys: String, CodingKey {
            case cardGroup = "card_group"
            case conviction
            case recommendation
            case pickLabel = "pick_label"
        }
    }

    public struct ConvictionSummary: Codable, Hashable, Sendable {
        public let topCard: String?
        public let topConviction: String?
        public let plays: [ConvictionPlay]

        public init(topCard: String? = nil, topConviction: String? = nil, plays: [ConvictionPlay] = []) {
            self.topCard = topCard
            self.topConviction = topConviction
            self.plays = plays
        }

        enum CodingKeys: String, CodingKey {
            case topCard = "top_card"
            case topConviction = "top_conviction"
            case plays
        }
    }

    public let id: String
    public let awayTeam: String
    public let homeTeam: String
    public let awayAb: String?
    public let homeAb: String?
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
    // NFL dry-run identity / model contract
    public let gameId: String
    public let season: Int?
    public let week: Int?
    public let gameday: String?
    public let kickoff: String?
    public let slot: String?
    public let fgSpreadOpen: Double?
    public let fgSpreadClose: Double?
    public let fgTotalOpen: Double?
    public let fgTotalClose: Double?
    public let fgMlHomeClose: Int?
    public let fgMlAwayClose: Int?
    public let ttHomeClose: Double?
    public let ttAwayClose: Double?
    public let ttHomeBestOver: Double?
    public let ttHomeBestUnder: Double?
    public let ttAwayBestOver: Double?
    public let ttAwayBestUnder: Double?
    public let ttHomePick: String?
    public let ttAwayPick: String?
    public let ttHomeEdge: Double?
    public let ttAwayEdge: Double?
    public let ttHomePred: Double?
    public let ttAwayPred: Double?
    public let h1SpreadClose: Double?
    public let h1TotalClose: Double?
    public let h1MlHomeClose: Int?
    public let h1MlAwayClose: Int?
    public let h1SpreadPick: String?
    public let h1TotalPick: String?
    public let h1MlPick: String?
    public let fgPredMargin: Double?
    public let fgPredSpread: Double?
    public let fgPredHomePts: Double?
    public let fgPredAwayPts: Double?
    public let fgSpreadEdge: Double?
    public let fgSpreadPick: String?
    public let fgSpreadConfluence: Int?
    public let fgTotalEdge: Double?
    public let fgTotalPick: String?
    public let fgTotalTier: String?
    public let h1PredTotal: Double?
    public let h1PredMargin: Double?
    public let h1TotalEdge: Double?
    public let h1CoverTilt: Double?
    public let h1HomeWinProb: Double?
    public let convictionTierRaw: String
    public let stakeUnits: Double?
    public let convictionSummary: ConvictionSummary?
    public let flagsActive: Int?
    public let flagsTracking: Int?
    public let mammoth: Bool
    public let wxTempF: Double?
    public let wxWindMph: Double?
    public let wxPrecipMm: Double?
    public let wxIndoors: Bool?
    public let wxIcon: String?
    public let wxSummary: String?

    public init(
        id: String,
        awayTeam: String,
        homeTeam: String,
        awayAb: String? = nil,
        homeAb: String? = nil,
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
        underBets: String? = nil,
        gameId: String? = nil,
        season: Int? = nil,
        week: Int? = nil,
        gameday: String? = nil,
        kickoff: String? = nil,
        slot: String? = nil,
        fgSpreadOpen: Double? = nil,
        fgSpreadClose: Double? = nil,
        fgTotalOpen: Double? = nil,
        fgTotalClose: Double? = nil,
        fgMlHomeClose: Int? = nil,
        fgMlAwayClose: Int? = nil,
        ttHomeClose: Double? = nil,
        ttAwayClose: Double? = nil,
        ttHomeBestOver: Double? = nil,
        ttHomeBestUnder: Double? = nil,
        ttAwayBestOver: Double? = nil,
        ttAwayBestUnder: Double? = nil,
        ttHomePick: String? = nil,
        ttAwayPick: String? = nil,
        ttHomeEdge: Double? = nil,
        ttAwayEdge: Double? = nil,
        ttHomePred: Double? = nil,
        ttAwayPred: Double? = nil,
        h1SpreadClose: Double? = nil,
        h1TotalClose: Double? = nil,
        h1MlHomeClose: Int? = nil,
        h1MlAwayClose: Int? = nil,
        h1SpreadPick: String? = nil,
        h1TotalPick: String? = nil,
        h1MlPick: String? = nil,
        fgPredMargin: Double? = nil,
        fgPredSpread: Double? = nil,
        fgPredHomePts: Double? = nil,
        fgPredAwayPts: Double? = nil,
        fgSpreadEdge: Double? = nil,
        fgSpreadPick: String? = nil,
        fgSpreadConfluence: Int? = nil,
        fgTotalEdge: Double? = nil,
        fgTotalPick: String? = nil,
        fgTotalTier: String? = nil,
        h1PredTotal: Double? = nil,
        h1PredMargin: Double? = nil,
        h1TotalEdge: Double? = nil,
        h1CoverTilt: Double? = nil,
        h1HomeWinProb: Double? = nil,
        convictionTierRaw: String = "none",
        stakeUnits: Double? = nil,
        convictionSummary: ConvictionSummary? = nil,
        flagsActive: Int? = nil,
        flagsTracking: Int? = nil,
        mammoth: Bool = false,
        wxTempF: Double? = nil,
        wxWindMph: Double? = nil,
        wxPrecipMm: Double? = nil,
        wxIndoors: Bool? = nil,
        wxIcon: String? = nil,
        wxSummary: String? = nil
    ) {
        self.id = id
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayAb = awayAb
        self.homeAb = homeAb
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
        self.gameId = gameId ?? id
        self.season = season
        self.week = week
        self.gameday = gameday
        self.kickoff = kickoff
        self.slot = slot
        self.fgSpreadOpen = fgSpreadOpen
        self.fgSpreadClose = fgSpreadClose
        self.fgTotalOpen = fgTotalOpen
        self.fgTotalClose = fgTotalClose
        self.fgMlHomeClose = fgMlHomeClose
        self.fgMlAwayClose = fgMlAwayClose
        self.ttHomeClose = ttHomeClose
        self.ttAwayClose = ttAwayClose
        self.ttHomeBestOver = ttHomeBestOver
        self.ttHomeBestUnder = ttHomeBestUnder
        self.ttAwayBestOver = ttAwayBestOver
        self.ttAwayBestUnder = ttAwayBestUnder
        self.ttHomePick = ttHomePick
        self.ttAwayPick = ttAwayPick
        self.ttHomeEdge = ttHomeEdge
        self.ttAwayEdge = ttAwayEdge
        self.ttHomePred = ttHomePred
        self.ttAwayPred = ttAwayPred
        self.h1SpreadClose = h1SpreadClose
        self.h1TotalClose = h1TotalClose
        self.h1MlHomeClose = h1MlHomeClose
        self.h1MlAwayClose = h1MlAwayClose
        self.h1SpreadPick = h1SpreadPick
        self.h1TotalPick = h1TotalPick
        self.h1MlPick = h1MlPick
        self.fgPredMargin = fgPredMargin
        self.fgPredSpread = fgPredSpread
        self.fgPredHomePts = fgPredHomePts
        self.fgPredAwayPts = fgPredAwayPts
        self.fgSpreadEdge = fgSpreadEdge
        self.fgSpreadPick = fgSpreadPick
        self.fgSpreadConfluence = fgSpreadConfluence
        self.fgTotalEdge = fgTotalEdge
        self.fgTotalPick = fgTotalPick
        self.fgTotalTier = fgTotalTier
        self.h1PredTotal = h1PredTotal
        self.h1PredMargin = h1PredMargin
        self.h1TotalEdge = h1TotalEdge
        self.h1CoverTilt = h1CoverTilt
        self.h1HomeWinProb = h1HomeWinProb
        self.convictionTierRaw = convictionTierRaw
        self.stakeUnits = stakeUnits
        self.convictionSummary = convictionSummary
        self.flagsActive = flagsActive
        self.flagsTracking = flagsTracking
        self.mammoth = mammoth
        self.wxTempF = wxTempF
        self.wxWindMph = wxWindMph
        self.wxPrecipMm = wxPrecipMm
        self.wxIndoors = wxIndoors
        self.wxIcon = wxIcon
        self.wxSummary = wxSummary
    }

    enum CodingKeys: String, CodingKey {
        case id
        case awayTeam = "away_team"
        case homeTeam = "home_team"
        case awayAb = "away_ab"
        case homeAb = "home_ab"
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
        case gameId = "game_id"
        case season, week, gameday, kickoff, slot
        case fgSpreadOpen = "fg_spread_open"
        case fgSpreadClose = "fg_spread_close"
        case fgTotalOpen = "fg_total_open"
        case fgTotalClose = "fg_total_close"
        case fgMlHomeClose = "fg_ml_home_close"
        case fgMlAwayClose = "fg_ml_away_close"
        case ttHomeClose = "tt_home_close"
        case ttAwayClose = "tt_away_close"
        case ttHomeBestOver = "tt_home_best_over"
        case ttHomeBestUnder = "tt_home_best_under"
        case ttAwayBestOver = "tt_away_best_over"
        case ttAwayBestUnder = "tt_away_best_under"
        case ttHomePick = "tt_home_pick"
        case ttAwayPick = "tt_away_pick"
        case ttHomeEdge = "tt_home_edge"
        case ttAwayEdge = "tt_away_edge"
        case ttHomePred = "tt_home_pred"
        case ttAwayPred = "tt_away_pred"
        case h1SpreadClose = "h1_spread_close"
        case h1TotalClose = "h1_total_close"
        case h1MlHomeClose = "h1_ml_home_close"
        case h1MlAwayClose = "h1_ml_away_close"
        case h1SpreadPick = "h1_spread_pick"
        case h1TotalPick = "h1_total_pick"
        case h1MlPick = "h1_ml_pick"
        case fgPredMargin = "fg_pred_margin"
        case fgPredSpread = "fg_pred_spread"
        case fgPredHomePts = "fg_pred_home_pts"
        case fgPredAwayPts = "fg_pred_away_pts"
        case fgSpreadEdge = "fg_spread_edge"
        case fgSpreadPick = "fg_spread_pick"
        case fgSpreadConfluence = "fg_spread_confluence"
        case fgTotalEdge = "fg_total_edge"
        case fgTotalPick = "fg_total_pick"
        case fgTotalTier = "fg_total_tier"
        case h1PredTotal = "h1_pred_total"
        case h1PredMargin = "h1_pred_margin"
        case h1TotalEdge = "h1_total_edge"
        case h1CoverTilt = "h1_cover_tilt"
        case h1HomeWinProb = "h1_home_win_prob"
        case convictionTierRaw = "conviction_tier"
        case stakeUnits = "stake_units"
        case convictionSummary = "conviction_summary"
        case flagsActive = "flags_active"
        case flagsTracking = "flags_tracking"
        case mammoth
        case wxTempF = "wx_temp_f"
        case wxWindMph = "wx_wind_mph"
        case wxPrecipMm = "wx_precip_mm"
        case wxIndoors = "wx_indoors"
        case wxIcon = "wx_icon"
        case wxSummary = "wx_summary"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let id = (try? c.decode(String.self, forKey: .id))
            ?? (try? c.decode(String.self, forKey: .gameId))
            ?? (try? c.decode(String.self, forKey: .trainingKey))
            ?? ""
        let away = (try? c.decode(String.self, forKey: .awayTeam)) ?? ""
        let home = (try? c.decode(String.self, forKey: .homeTeam)) ?? ""
        let trainingKey = (try? c.decode(String.self, forKey: .trainingKey)) ?? id
        self.init(
            id: id,
            awayTeam: away,
            homeTeam: home,
            awayAb: try? c.decodeIfPresent(String.self, forKey: .awayAb),
            homeAb: try? c.decodeIfPresent(String.self, forKey: .homeAb),
            homeMl: try? c.decodeIfPresent(Int.self, forKey: .homeMl),
            awayMl: try? c.decodeIfPresent(Int.self, forKey: .awayMl),
            homeSpread: try? c.decodeIfPresent(Double.self, forKey: .homeSpread),
            awaySpread: try? c.decodeIfPresent(Double.self, forKey: .awaySpread),
            overLine: try? c.decodeIfPresent(Double.self, forKey: .overLine),
            gameDate: (try? c.decode(String.self, forKey: .gameDate)) ?? "",
            gameTime: (try? c.decode(String.self, forKey: .gameTime)) ?? "",
            trainingKey: trainingKey,
            uniqueId: (try? c.decode(String.self, forKey: .uniqueId)) ?? trainingKey,
            homeAwayMlProb: try? c.decodeIfPresent(Double.self, forKey: .homeAwayMlProb),
            homeAwaySpreadCoverProb: try? c.decodeIfPresent(Double.self, forKey: .homeAwaySpreadCoverProb),
            ouResultProb: try? c.decodeIfPresent(Double.self, forKey: .ouResultProb),
            predTotal: try? c.decodeIfPresent(Double.self, forKey: .predTotal),
            runId: try? c.decodeIfPresent(String.self, forKey: .runId),
            temperature: try? c.decodeIfPresent(Double.self, forKey: .temperature),
            precipitation: try? c.decodeIfPresent(Double.self, forKey: .precipitation),
            windSpeed: try? c.decodeIfPresent(Double.self, forKey: .windSpeed),
            icon: try? c.decodeIfPresent(String.self, forKey: .icon),
            spreadSplitsLabel: try? c.decodeIfPresent(String.self, forKey: .spreadSplitsLabel),
            totalSplitsLabel: try? c.decodeIfPresent(String.self, forKey: .totalSplitsLabel),
            mlSplitsLabel: try? c.decodeIfPresent(String.self, forKey: .mlSplitsLabel),
            homeMlHandle: try? c.decodeIfPresent(String.self, forKey: .homeMlHandle),
            awayMlHandle: try? c.decodeIfPresent(String.self, forKey: .awayMlHandle),
            homeMlBets: try? c.decodeIfPresent(String.self, forKey: .homeMlBets),
            awayMlBets: try? c.decodeIfPresent(String.self, forKey: .awayMlBets),
            homeSpreadHandle: try? c.decodeIfPresent(String.self, forKey: .homeSpreadHandle),
            awaySpreadHandle: try? c.decodeIfPresent(String.self, forKey: .awaySpreadHandle),
            homeSpreadBets: try? c.decodeIfPresent(String.self, forKey: .homeSpreadBets),
            awaySpreadBets: try? c.decodeIfPresent(String.self, forKey: .awaySpreadBets),
            overHandle: try? c.decodeIfPresent(String.self, forKey: .overHandle),
            underHandle: try? c.decodeIfPresent(String.self, forKey: .underHandle),
            overBets: try? c.decodeIfPresent(String.self, forKey: .overBets),
            underBets: try? c.decodeIfPresent(String.self, forKey: .underBets),
            gameId: try? c.decodeIfPresent(String.self, forKey: .gameId),
            season: try? c.decodeIfPresent(Int.self, forKey: .season),
            week: try? c.decodeIfPresent(Int.self, forKey: .week),
            gameday: try? c.decodeIfPresent(String.self, forKey: .gameday),
            kickoff: try? c.decodeIfPresent(String.self, forKey: .kickoff),
            slot: try? c.decodeIfPresent(String.self, forKey: .slot),
            fgSpreadOpen: try? c.decodeIfPresent(Double.self, forKey: .fgSpreadOpen),
            fgSpreadClose: try? c.decodeIfPresent(Double.self, forKey: .fgSpreadClose),
            fgTotalOpen: try? c.decodeIfPresent(Double.self, forKey: .fgTotalOpen),
            fgTotalClose: try? c.decodeIfPresent(Double.self, forKey: .fgTotalClose),
            fgMlHomeClose: try? c.decodeIfPresent(Int.self, forKey: .fgMlHomeClose),
            fgMlAwayClose: try? c.decodeIfPresent(Int.self, forKey: .fgMlAwayClose),
            ttHomeClose: try? c.decodeIfPresent(Double.self, forKey: .ttHomeClose),
            ttAwayClose: try? c.decodeIfPresent(Double.self, forKey: .ttAwayClose),
            ttHomeBestOver: try? c.decodeIfPresent(Double.self, forKey: .ttHomeBestOver),
            ttHomeBestUnder: try? c.decodeIfPresent(Double.self, forKey: .ttHomeBestUnder),
            ttAwayBestOver: try? c.decodeIfPresent(Double.self, forKey: .ttAwayBestOver),
            ttAwayBestUnder: try? c.decodeIfPresent(Double.self, forKey: .ttAwayBestUnder),
            ttHomePick: try? c.decodeIfPresent(String.self, forKey: .ttHomePick),
            ttAwayPick: try? c.decodeIfPresent(String.self, forKey: .ttAwayPick),
            ttHomeEdge: try? c.decodeIfPresent(Double.self, forKey: .ttHomeEdge),
            ttAwayEdge: try? c.decodeIfPresent(Double.self, forKey: .ttAwayEdge),
            ttHomePred: try? c.decodeIfPresent(Double.self, forKey: .ttHomePred),
            ttAwayPred: try? c.decodeIfPresent(Double.self, forKey: .ttAwayPred),
            h1SpreadClose: try? c.decodeIfPresent(Double.self, forKey: .h1SpreadClose),
            h1TotalClose: try? c.decodeIfPresent(Double.self, forKey: .h1TotalClose),
            h1MlHomeClose: try? c.decodeIfPresent(Int.self, forKey: .h1MlHomeClose),
            h1MlAwayClose: try? c.decodeIfPresent(Int.self, forKey: .h1MlAwayClose),
            h1SpreadPick: try? c.decodeIfPresent(String.self, forKey: .h1SpreadPick),
            h1TotalPick: try? c.decodeIfPresent(String.self, forKey: .h1TotalPick),
            h1MlPick: try? c.decodeIfPresent(String.self, forKey: .h1MlPick),
            fgPredMargin: try? c.decodeIfPresent(Double.self, forKey: .fgPredMargin),
            fgPredSpread: try? c.decodeIfPresent(Double.self, forKey: .fgPredSpread),
            fgPredHomePts: try? c.decodeIfPresent(Double.self, forKey: .fgPredHomePts),
            fgPredAwayPts: try? c.decodeIfPresent(Double.self, forKey: .fgPredAwayPts),
            fgSpreadEdge: try? c.decodeIfPresent(Double.self, forKey: .fgSpreadEdge),
            fgSpreadPick: try? c.decodeIfPresent(String.self, forKey: .fgSpreadPick),
            fgSpreadConfluence: try? c.decodeIfPresent(Int.self, forKey: .fgSpreadConfluence),
            fgTotalEdge: try? c.decodeIfPresent(Double.self, forKey: .fgTotalEdge),
            fgTotalPick: try? c.decodeIfPresent(String.self, forKey: .fgTotalPick),
            fgTotalTier: try? c.decodeIfPresent(String.self, forKey: .fgTotalTier),
            h1PredTotal: try? c.decodeIfPresent(Double.self, forKey: .h1PredTotal),
            h1PredMargin: try? c.decodeIfPresent(Double.self, forKey: .h1PredMargin),
            h1TotalEdge: try? c.decodeIfPresent(Double.self, forKey: .h1TotalEdge),
            h1CoverTilt: try? c.decodeIfPresent(Double.self, forKey: .h1CoverTilt),
            h1HomeWinProb: try? c.decodeIfPresent(Double.self, forKey: .h1HomeWinProb),
            convictionTierRaw: (try? c.decode(String.self, forKey: .convictionTierRaw)) ?? "none",
            stakeUnits: try? c.decodeIfPresent(Double.self, forKey: .stakeUnits),
            convictionSummary: try? c.decodeIfPresent(ConvictionSummary.self, forKey: .convictionSummary),
            flagsActive: try? c.decodeIfPresent(Int.self, forKey: .flagsActive),
            flagsTracking: try? c.decodeIfPresent(Int.self, forKey: .flagsTracking),
            mammoth: (try? c.decode(Bool.self, forKey: .mammoth)) ?? false,
            wxTempF: try? c.decodeIfPresent(Double.self, forKey: .wxTempF),
            wxWindMph: try? c.decodeIfPresent(Double.self, forKey: .wxWindMph),
            wxPrecipMm: try? c.decodeIfPresent(Double.self, forKey: .wxPrecipMm),
            wxIndoors: try? c.decodeIfPresent(Bool.self, forKey: .wxIndoors),
            wxIcon: try? c.decodeIfPresent(String.self, forKey: .wxIcon),
            wxSummary: try? c.decodeIfPresent(String.self, forKey: .wxSummary)
        )
    }
}

public extension NFLPrediction {
    var predictedScore: (home: Double, away: Double)? {
        if let home = fgPredHomePts, let away = fgPredAwayPts { return (home, away) }
        guard let total = predTotal, let margin = fgPredMargin else { return nil }
        return ((total + margin) / 2, (total - margin) / 2)
    }

    var topConvictionRank: Int {
        switch (mammoth ? "mammoth" : convictionTierRaw).lowercased() {
        case "mammoth": return 0
        case "high": return 1
        case "med", "medium": return 2
        case "low": return 3
        case "lean": return 4
        default: return 5
        }
    }
}
