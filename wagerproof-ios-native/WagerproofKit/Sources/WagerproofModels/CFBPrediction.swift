import Foundation

/// Conviction ladder for the CFB Week 7 dry-run portfolio. The sort order is a
/// product rule: conviction ranks the slate ahead of edge size.
public enum CFBConvictionTier: String, Codable, Hashable, Sendable, CaseIterable {
    case mammoth
    case high
    case med
    case low
    case lean
    case none

    public var sortRank: Int {
        switch self {
        case .mammoth: return 0
        case .high: return 1
        case .med: return 2
        case .low: return 3
        case .lean: return 4
        case .none: return 5
        }
    }

    public var label: String {
        switch self {
        case .mammoth: return "MAMMOTH"
        case .high: return "High"
        case .med: return "Medium"
        case .low: return "Low"
        case .lean: return "Lean"
        case .none: return "Score Only"
        }
    }

    public var badge: String {
        switch self {
        case .mammoth: return "MAMMOTH"
        case .high: return "T1"
        case .med: return "T2"
        case .low: return "T3"
        case .lean: return "Lean"
        case .none: return "None"
        }
    }

    public init(raw: String?) {
        self = CFBConvictionTier(rawValue: raw?.lowercased() ?? "") ?? .none
    }
}

public enum CFBFlagConviction: String, Codable, Hashable, Sendable, CaseIterable {
    case mammoth
    case t1 = "T1"
    case t2 = "T2"
    case t3 = "T3"
    case track

    public var sortRank: Int {
        switch self {
        case .mammoth: return 0
        case .t1: return 1
        case .t2: return 2
        case .t3: return 3
        case .track: return 4
        }
    }

    public var label: String {
        switch self {
        case .mammoth: return "Mammoth"
        case .t1: return "T1"
        case .t2: return "T2"
        case .t3: return "T3"
        case .track: return "Tracking"
        }
    }

    public init(raw: String?) {
        let value = raw ?? ""
        self = CFBFlagConviction(rawValue: value) ?? CFBFlagConviction(rawValue: value.uppercased()) ?? .track
    }
}

public struct CFBTeamReference: Codable, Hashable, Sendable {
    public let teamName: String
    public let abbr: String?
    public let conference: String?
    public let classification: String?
    public let color: String?
    public let altColor: String?
    public let logo: String?
    public let logoDark: String?

    public init(
        teamName: String,
        abbr: String? = nil,
        conference: String? = nil,
        classification: String? = nil,
        color: String? = nil,
        altColor: String? = nil,
        logo: String? = nil,
        logoDark: String? = nil
    ) {
        self.teamName = teamName
        self.abbr = abbr
        self.conference = conference
        self.classification = classification
        self.color = color
        self.altColor = altColor
        self.logo = logo
        self.logoDark = logoDark
    }
}

public struct CFBDryRunFlag: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let gameId: String
    public let season: Int?
    public let week: Int?
    public let game: String?
    public let source: String
    public let market: String
    public let side: String
    public let line: Double?
    public let price: Int?
    public let edge: Double?
    public let conviction: String
    public let tier: String
    public let stakeUnits: Double?
    public let gradeLine: String?
    public let mammoth: Bool?
    public let signalDefinition: CFBSignalDefinition?

    public init(
        id: String,
        gameId: String,
        season: Int? = nil,
        week: Int? = nil,
        game: String? = nil,
        source: String,
        market: String,
        side: String,
        line: Double? = nil,
        price: Int? = nil,
        edge: Double? = nil,
        conviction: String,
        tier: String,
        stakeUnits: Double? = nil,
        gradeLine: String? = nil,
        mammoth: Bool? = nil,
        signalDefinition: CFBSignalDefinition? = nil
    ) {
        self.id = id
        self.gameId = gameId
        self.season = season
        self.week = week
        self.game = game
        self.source = source
        self.market = market
        self.side = side
        self.line = line
        self.price = price
        self.edge = edge
        self.conviction = conviction
        self.tier = tier
        self.stakeUnits = stakeUnits
        self.gradeLine = gradeLine
        self.mammoth = mammoth
        self.signalDefinition = signalDefinition
    }

    public var convictionTier: CFBFlagConviction { CFBFlagConviction(raw: conviction) }
    public var isActive: Bool { tier.lowercased() == "active" }

    public func withSignalDefinition(_ definition: CFBSignalDefinition?) -> CFBDryRunFlag {
        CFBDryRunFlag(
            id: id,
            gameId: gameId,
            season: season,
            week: week,
            game: game,
            source: source,
            market: market,
            side: side,
            line: line,
            price: price,
            edge: edge,
            conviction: conviction,
            tier: tier,
            stakeUnits: stakeUnits,
            gradeLine: gradeLine,
            mammoth: mammoth,
            signalDefinition: definition
        )
    }
}

public struct CFBSignalDefinition: Codable, Hashable, Sendable {
    /// Join key for `signal_performance.signal_key`.
    public let signalKey: String?
    public let sourceKey: String
    public let displayName: String
    public let oneLiner: String?
    public let definition: String?
    public let whyItWorks: String?
    public let betDirection: String?
    public let typicalHit: String?

    public init(
        signalKey: String? = nil,
        sourceKey: String,
        displayName: String,
        oneLiner: String? = nil,
        definition: String? = nil,
        whyItWorks: String? = nil,
        betDirection: String? = nil,
        typicalHit: String? = nil
    ) {
        self.signalKey = signalKey
        self.sourceKey = sourceKey
        self.displayName = displayName
        self.oneLiner = oneLiner
        self.definition = definition
        self.whyItWorks = whyItWorks
        self.betDirection = betDirection
        self.typicalHit = typicalHit
    }
}

/// CFB game prediction row. The active Games tab now uses the Week 7 2025 dry
/// run contract (`cfb_dryrun_games` + flags + `cfb_teams`), while the legacy
/// live-pipeline fields remain optional so older fixtures/services keep working.
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
    public let wxTempF: Double?
    public let wxWindMph: Double?
    public let wxPrecipMm: Double?
    public let wxIndoors: Bool?
    public let wxIcon: String?
    public let wxSummary: String?
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
    // Dry-run identity / team metadata
    public let gameId: String
    public let season: Int?
    public let week: Int?
    public let kickoff: String?
    public let neutralSite: Bool?
    public let homeConf: String?
    public let awayConf: String?
    public let homeRank: Int?
    public let awayRank: Int?
    public let homeClassification: String?
    public let awayClassification: String?
    public let homeTeamRef: CFBTeamReference?
    public let awayTeamRef: CFBTeamReference?
    // Dry-run market/model contract
    public let fgSpreadOpen: Double?
    public let fgSpreadClose: Double?
    public let fgTotalOpen: Double?
    public let fgTotalClose: Double?
    public let fgMlHomeClose: Int?
    public let fgMlAwayClose: Int?
    public let ttHomeClose: Double?
    public let ttAwayClose: Double?
    public let ttHomeBestUnder: Double?
    public let ttHomeBestOver: Double?
    public let ttAwayBestUnder: Double?
    public let ttAwayBestOver: Double?
    public let h1SpreadClose: Double?
    public let h1TotalClose: Double?
    public let h1MlHomeClose: Int?
    public let h1MlAwayClose: Int?
    public let fgPredMargin: Double?
    public let fgPredSpread: Double?
    public let fgSpreadEdge: Double?
    public let fgSpreadPick: String?
    public let fgSpreadCapped: Bool?
    public let fgPredTotal: Double?
    public let fgTotalEdge: Double?
    public let fgTotalPick: String?
    public let ttHomePred: Double?
    public let ttAwayPred: Double?
    public let ttHomePick: String?
    public let ttAwayPick: String?
    public let h1PredMargin: Double?
    public let h1PredTotal: Double?
    public let h1SpreadPick: String?
    public let h1TotalPick: String?
    public let h1MlPick: String?
    public let fgHomeCoverProb: Double?
    public let fgHomeWinProb: Double?
    // Dry-run portfolio
    public let convictionTierRaw: String
    public let stakeUnits: Double?
    public let nFlagsActive: Int?
    public let nFlagsTracking: Int?
    public let mammoth: Bool
    public var flags: [CFBDryRunFlag]

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
        wxTempF: Double? = nil,
        wxWindMph: Double? = nil,
        wxPrecipMm: Double? = nil,
        wxIndoors: Bool? = nil,
        wxIcon: String? = nil,
        wxSummary: String? = nil,
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
        openingTotal: Double? = nil,
        gameId: String? = nil,
        season: Int? = nil,
        week: Int? = nil,
        kickoff: String? = nil,
        neutralSite: Bool? = nil,
        homeConf: String? = nil,
        awayConf: String? = nil,
        homeRank: Int? = nil,
        awayRank: Int? = nil,
        homeClassification: String? = nil,
        awayClassification: String? = nil,
        homeTeamRef: CFBTeamReference? = nil,
        awayTeamRef: CFBTeamReference? = nil,
        fgSpreadOpen: Double? = nil,
        fgSpreadClose: Double? = nil,
        fgTotalOpen: Double? = nil,
        fgTotalClose: Double? = nil,
        fgMlHomeClose: Int? = nil,
        fgMlAwayClose: Int? = nil,
        ttHomeClose: Double? = nil,
        ttAwayClose: Double? = nil,
        ttHomeBestUnder: Double? = nil,
        ttHomeBestOver: Double? = nil,
        ttAwayBestUnder: Double? = nil,
        ttAwayBestOver: Double? = nil,
        h1SpreadClose: Double? = nil,
        h1TotalClose: Double? = nil,
        h1MlHomeClose: Int? = nil,
        h1MlAwayClose: Int? = nil,
        fgPredMargin: Double? = nil,
        fgPredSpread: Double? = nil,
        fgSpreadEdge: Double? = nil,
        fgSpreadPick: String? = nil,
        fgSpreadCapped: Bool? = nil,
        fgPredTotal: Double? = nil,
        fgTotalEdge: Double? = nil,
        fgTotalPick: String? = nil,
        ttHomePred: Double? = nil,
        ttAwayPred: Double? = nil,
        ttHomePick: String? = nil,
        ttAwayPick: String? = nil,
        h1PredMargin: Double? = nil,
        h1PredTotal: Double? = nil,
        h1SpreadPick: String? = nil,
        h1TotalPick: String? = nil,
        h1MlPick: String? = nil,
        fgHomeCoverProb: Double? = nil,
        fgHomeWinProb: Double? = nil,
        convictionTierRaw: String = "none",
        stakeUnits: Double? = nil,
        nFlagsActive: Int? = nil,
        nFlagsTracking: Int? = nil,
        mammoth: Bool = false,
        flags: [CFBDryRunFlag] = []
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
        self.wxTempF = wxTempF
        self.wxWindMph = wxWindMph
        self.wxPrecipMm = wxPrecipMm
        self.wxIndoors = wxIndoors
        self.wxIcon = wxIcon
        self.wxSummary = wxSummary
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
        self.gameId = gameId ?? id
        self.season = season
        self.week = week
        self.kickoff = kickoff
        self.neutralSite = neutralSite
        self.homeConf = homeConf
        self.awayConf = awayConf
        self.homeRank = homeRank
        self.awayRank = awayRank
        self.homeClassification = homeClassification
        self.awayClassification = awayClassification
        self.homeTeamRef = homeTeamRef
        self.awayTeamRef = awayTeamRef
        self.fgSpreadOpen = fgSpreadOpen
        self.fgSpreadClose = fgSpreadClose
        self.fgTotalOpen = fgTotalOpen
        self.fgTotalClose = fgTotalClose
        self.fgMlHomeClose = fgMlHomeClose
        self.fgMlAwayClose = fgMlAwayClose
        self.ttHomeClose = ttHomeClose
        self.ttAwayClose = ttAwayClose
        self.ttHomeBestUnder = ttHomeBestUnder
        self.ttHomeBestOver = ttHomeBestOver
        self.ttAwayBestUnder = ttAwayBestUnder
        self.ttAwayBestOver = ttAwayBestOver
        self.h1SpreadClose = h1SpreadClose
        self.h1TotalClose = h1TotalClose
        self.h1MlHomeClose = h1MlHomeClose
        self.h1MlAwayClose = h1MlAwayClose
        self.fgPredMargin = fgPredMargin
        self.fgPredSpread = fgPredSpread
        self.fgSpreadEdge = fgSpreadEdge
        self.fgSpreadPick = fgSpreadPick
        self.fgSpreadCapped = fgSpreadCapped
        self.fgPredTotal = fgPredTotal
        self.fgTotalEdge = fgTotalEdge
        self.fgTotalPick = fgTotalPick
        self.ttHomePred = ttHomePred
        self.ttAwayPred = ttAwayPred
        self.ttHomePick = ttHomePick
        self.ttAwayPick = ttAwayPick
        self.h1PredMargin = h1PredMargin
        self.h1PredTotal = h1PredTotal
        self.h1SpreadPick = h1SpreadPick
        self.h1TotalPick = h1TotalPick
        self.h1MlPick = h1MlPick
        self.fgHomeCoverProb = fgHomeCoverProb
        self.fgHomeWinProb = fgHomeWinProb
        self.convictionTierRaw = convictionTierRaw
        self.stakeUnits = stakeUnits
        self.nFlagsActive = nFlagsActive
        self.nFlagsTracking = nFlagsTracking
        self.mammoth = mammoth
        self.flags = flags
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
        case wxTempF = "wx_temp_f"
        case wxWindMph = "wx_wind_mph"
        case wxPrecipMm = "wx_precip_mm"
        case wxIndoors = "wx_indoors"
        case wxIcon = "wx_icon"
        case wxSummary = "wx_summary"
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
        case gameId = "game_id"
        case season, week, kickoff
        case neutralSite = "neutral_site"
        case homeConf = "home_conf"
        case awayConf = "away_conf"
        case homeRank = "home_rank"
        case awayRank = "away_rank"
        case homeClassification = "home_classification"
        case awayClassification = "away_classification"
        case homeTeamRef = "home_team_ref"
        case awayTeamRef = "away_team_ref"
        case fgSpreadOpen = "fg_spread_open"
        case fgSpreadClose = "fg_spread_close"
        case fgTotalOpen = "fg_total_open"
        case fgTotalClose = "fg_total_close"
        case fgMlHomeClose = "fg_ml_home_close"
        case fgMlAwayClose = "fg_ml_away_close"
        case ttHomeClose = "tt_home_close"
        case ttAwayClose = "tt_away_close"
        case ttHomeBestUnder = "tt_home_best_under"
        case ttHomeBestOver = "tt_home_best_over"
        case ttAwayBestUnder = "tt_away_best_under"
        case ttAwayBestOver = "tt_away_best_over"
        case h1SpreadClose = "h1_spread_close"
        case h1TotalClose = "h1_total_close"
        case h1MlHomeClose = "h1_ml_home_close"
        case h1MlAwayClose = "h1_ml_away_close"
        case fgPredMargin = "fg_pred_margin"
        case fgPredSpread = "fg_pred_spread"
        case fgSpreadEdge = "fg_spread_edge"
        case fgSpreadPick = "fg_spread_pick"
        case fgSpreadCapped = "fg_spread_capped"
        case fgPredTotal = "fg_pred_total"
        case fgTotalEdge = "fg_total_edge"
        case fgTotalPick = "fg_total_pick"
        case ttHomePred = "tt_home_pred"
        case ttAwayPred = "tt_away_pred"
        case ttHomePick = "tt_home_pick"
        case ttAwayPick = "tt_away_pick"
        case h1PredMargin = "h1_pred_margin"
        case h1PredTotal = "h1_pred_total"
        case h1SpreadPick = "h1_spread_pick"
        case h1TotalPick = "h1_total_pick"
        case h1MlPick = "h1_ml_pick"
        case fgHomeCoverProb = "fg_home_cover_prob"
        case fgHomeWinProb = "fg_home_win_prob"
        case convictionTierRaw = "conviction_tier"
        case stakeUnits = "stake_units"
        case nFlagsActive = "n_flags_active"
        case nFlagsTracking = "n_flags_tracking"
        case mammoth, flags
    }
}

public extension CFBPrediction {
    var convictionTier: CFBConvictionTier {
        mammoth ? .mammoth : CFBConvictionTier(raw: convictionTierRaw)
    }

    var predictedScore: (home: Double, away: Double)? {
        let total = fgPredTotal ?? predTotal ?? predOverLine
        let margin = fgPredMargin ?? {
            if let home = predHomeScore, let away = predAwayScore { return home - away }
            return nil
        }()
        guard let total, let margin else { return nil }
        return ((total + margin) / 2, (total - margin) / 2)
    }

    var headlinePick: String? {
        if fgSpreadCapped == true {
            return "Model off-market, no play"
        }
        if let pick = fgSpreadPick, !pick.isEmpty {
            let team = pick.uppercased() == "HOME" ? homeTeam : awayTeam
            let line = pick.uppercased() == "HOME" ? homeSpread : awaySpread
            return "\(team) \(CFBPrediction.formatSpread(line))"
        }
        if let topFlag = flags.filter(\.isActive).sorted(by: {
            if $0.convictionTier.sortRank != $1.convictionTier.sortRank {
                return $0.convictionTier.sortRank < $1.convictionTier.sortRank
            }
            return ($0.stakeUnits ?? 0) > ($1.stakeUnits ?? 0)
        }).first {
            return "\(topFlag.side) \(topFlag.market.replacingOccurrences(of: "_", with: " ")) \(CFBPrediction.formatLine(topFlag.line))"
        }
        return nil
    }

    var activeFlags: [CFBDryRunFlag] { flags.filter(\.isActive) }
    var trackingFlags: [CFBDryRunFlag] { flags.filter { !$0.isActive } }

    private static func formatSpread(_ value: Double?) -> String {
        guard let value else { return "" }
        return value > 0 ? "+\(formatLine(value))" : formatLine(value)
    }

    private static func formatLine(_ value: Double?) -> String {
        guard let value else { return "" }
        return value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }
}
