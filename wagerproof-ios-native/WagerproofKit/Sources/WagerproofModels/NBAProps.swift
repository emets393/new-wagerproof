import Foundation

public struct NbaFlagDetail: Decodable, Hashable, Sendable {
    public let above: Int?
    public let below: Int?
    public let games: Int?
    public let chief: String?
    public let heatL5: Double?
    public let outMpg: Double?
    public let position: String?
    public let outPlayer: String?
    public let gamesMissedBefore: Int?

    public init(
        above: Int?, games: Int?, chief: String?,
        below: Int? = nil, heatL5: Double? = nil, outMpg: Double? = nil,
        position: String? = nil, outPlayer: String? = nil, gamesMissedBefore: Int? = nil
    ) {
        self.above = above
        self.below = below
        self.games = games
        self.chief = chief
        self.heatL5 = heatL5
        self.outMpg = outMpg
        self.position = position
        self.outPlayer = outPlayer
        self.gamesMissedBefore = gamesMissedBefore
    }

    private enum CodingKeys: String, CodingKey {
        case above, below, games, chief, position
        case heatL5 = "heat_l5"
        case outMpg = "out_mpg"
        case outPlayer = "out_player"
        case gamesMissedBefore = "games_missed_before"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        above = Self.int(c, .above)
        below = Self.int(c, .below)
        games = Self.int(c, .games)
        chief = try c.decodeIfPresent(String.self, forKey: .chief)
        heatL5 = Self.double(c, .heatL5)
        outMpg = Self.double(c, .outMpg)
        position = try c.decodeIfPresent(String.self, forKey: .position)
        outPlayer = Self.flexString(c, .outPlayer)
        gamesMissedBefore = Self.int(c, .gamesMissedBefore)
    }

    private static func int(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(value) }
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Int(value) }
        return nil
    }

    private static func double(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(value) }
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Double(value) }
        return nil
    }

    private static func flexString(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> String? {
        if let value = try? c.decodeIfPresent(String.self, forKey: key), !value.isEmpty { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return String(value) }
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return String(Int(value)) }
        return nil
    }
}

public struct NbaRecentGame: Decodable, Hashable, Sendable {
    public let date: String?
    public let opp: String?
    public let value: Double?
    public let line: Double?

    public init(date: String?, opp: String?, value: Double?, line: Double?) {
        self.date = date
        self.opp = opp
        self.value = value
        self.line = line
    }
}

public struct NbaSlateProp: Decodable, Identifiable, Hashable, Sendable {
    public let gameDate: String?
    public let athleteId: String
    public let playerName: String?
    public let position: String?
    public let team: String?
    public let opponent: String?
    public let headshotURL: String?
    public let market: String?
    public let marketLabel: String?
    public let line: Double?
    public let lastGame: Double?
    public let l3Avg: Double?
    public let l5Avg: Double?
    public let l10Avg: Double?
    public let sznAvg: Double?
    public let priorSznAvg: Double?
    public let priorSznGp: Double?
    public let gpPrior: Double?
    public let minL5: Double?
    public let overRateL5: Double?
    public let overRateL10: Double?
    public let overRateSzn: Double?
    public let recentGames: [NbaRecentGame]
    public let baseline: Double?
    public let baselineGap: Double?
    public let rankPos: Double?
    public let flags: [String]
    public let flagDetail: [String: NbaFlagDetail]
    public let reportStatus: String?
    public let commenceTime: String?
    public let game: String?
    public let homeAbbr: String?
    public let awayAbbr: String?
    public let overPrice: Double?
    public let underPrice: Double?
    public let openLine: Double?

    public var id: String { "\(gameDate ?? "")|\(athleteId)|\(market ?? "")" }
    public var gameKey: String {
        if let awayAbbr, let homeAbbr, !awayAbbr.isEmpty, !homeAbbr.isEmpty {
            return "\(gameDate ?? ""):\(awayAbbr):\(homeAbbr)"
        }
        return "\(gameDate ?? ""):\(game ?? "")"
    }
    public var matchupLabel: String {
        if let awayAbbr, let homeAbbr, !awayAbbr.isEmpty, !homeAbbr.isEmpty {
            return "\(awayAbbr) @ \(homeAbbr)"
        }
        return game ?? "Game"
    }
    public var isOut: Bool { reportStatus?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "out" }

    private enum CodingKeys: String, CodingKey {
        case gameDate = "game_date"
        case athleteId = "athlete_id"
        case playerName = "player_name"
        case position, team, opponent
        case headshotURL = "headshot_url"
        case market
        case marketLabel = "market_label"
        case line
        case lastGame = "last_game"
        case l3Avg = "l3_avg"
        case l5Avg = "l5_avg"
        case l10Avg = "l10_avg"
        case sznAvg = "szn_avg"
        case priorSznAvg = "prior_szn_avg"
        case priorSznGp = "prior_szn_gp"
        case gpPrior = "gp_prior"
        case minL5 = "min_l5"
        case overRateL5 = "over_rate_l5"
        case overRateL10 = "over_rate_l10"
        case overRateSzn = "over_rate_szn"
        case recentGames = "recent_games"
        case baseline
        case baselineGap = "baseline_gap"
        case rankPos = "rank_pos"
        case flags
        case flagDetail = "flag_detail"
        case reportStatus = "report_status"
        case commenceTime = "commence_time"
        case game
        case homeAbbr = "home_abbr"
        case awayAbbr = "away_abbr"
        case overPrice = "over_price"
        case underPrice = "under_price"
        case openLine = "open_line"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        gameDate = try c.decodeIfPresent(String.self, forKey: .gameDate)
        athleteId = Self.flexString(c, .athleteId)
        playerName = try c.decodeIfPresent(String.self, forKey: .playerName)
        position = try c.decodeIfPresent(String.self, forKey: .position)
        team = try c.decodeIfPresent(String.self, forKey: .team)
        opponent = try c.decodeIfPresent(String.self, forKey: .opponent)
        headshotURL = try c.decodeIfPresent(String.self, forKey: .headshotURL)
        market = try c.decodeIfPresent(String.self, forKey: .market)
        marketLabel = try c.decodeIfPresent(String.self, forKey: .marketLabel)
        line = Self.flexDouble(c, .line)
        lastGame = Self.flexDouble(c, .lastGame)
        l3Avg = Self.flexDouble(c, .l3Avg)
        l5Avg = Self.flexDouble(c, .l5Avg)
        l10Avg = Self.flexDouble(c, .l10Avg)
        sznAvg = Self.flexDouble(c, .sznAvg)
        priorSznAvg = Self.flexDouble(c, .priorSznAvg)
        priorSznGp = Self.flexDouble(c, .priorSznGp)
        gpPrior = Self.flexDouble(c, .gpPrior)
        minL5 = Self.flexDouble(c, .minL5)
        overRateL5 = Self.flexDouble(c, .overRateL5)
        overRateL10 = Self.flexDouble(c, .overRateL10)
        overRateSzn = Self.flexDouble(c, .overRateSzn)
        recentGames = (try? c.decodeIfPresent([NbaRecentGame].self, forKey: .recentGames)) ?? []
        baseline = Self.flexDouble(c, .baseline)
        baselineGap = Self.flexDouble(c, .baselineGap)
        rankPos = Self.flexDouble(c, .rankPos)
        flags = Self.flagKeys(c)
        flagDetail = (try? c.decodeIfPresent([String: NbaFlagDetail].self, forKey: .flagDetail)) ?? [:]
        reportStatus = try c.decodeIfPresent(String.self, forKey: .reportStatus)
        commenceTime = try c.decodeIfPresent(String.self, forKey: .commenceTime)
        game = try c.decodeIfPresent(String.self, forKey: .game)
        homeAbbr = try c.decodeIfPresent(String.self, forKey: .homeAbbr)
        awayAbbr = try c.decodeIfPresent(String.self, forKey: .awayAbbr)
        overPrice = Self.flexDouble(c, .overPrice)
        underPrice = Self.flexDouble(c, .underPrice)
        openLine = Self.flexDouble(c, .openLine)
    }

    public init(
        gameDate: String?, athleteId: String, playerName: String?, position: String?, team: String?,
        opponent: String?, headshotURL: String?, market: String?, marketLabel: String?, line: Double?,
        lastGame: Double?, l3Avg: Double?, l5Avg: Double?, l10Avg: Double?, sznAvg: Double?,
        priorSznAvg: Double?, priorSznGp: Double?, gpPrior: Double?, minL5: Double?,
        overRateL5: Double?, overRateL10: Double?, overRateSzn: Double?, recentGames: [NbaRecentGame],
        baseline: Double?, baselineGap: Double?, rankPos: Double?, flags: [String],
        flagDetail: [String: NbaFlagDetail], reportStatus: String?,
        commenceTime: String? = nil, game: String? = nil, homeAbbr: String? = nil, awayAbbr: String? = nil,
        overPrice: Double? = nil, underPrice: Double? = nil, openLine: Double? = nil
    ) {
        self.gameDate = gameDate
        self.athleteId = athleteId
        self.playerName = playerName
        self.position = position
        self.team = team
        self.opponent = opponent
        self.headshotURL = headshotURL
        self.market = market
        self.marketLabel = marketLabel
        self.line = line
        self.lastGame = lastGame
        self.l3Avg = l3Avg
        self.l5Avg = l5Avg
        self.l10Avg = l10Avg
        self.sznAvg = sznAvg
        self.priorSznAvg = priorSznAvg
        self.priorSznGp = priorSznGp
        self.gpPrior = gpPrior
        self.minL5 = minL5
        self.overRateL5 = overRateL5
        self.overRateL10 = overRateL10
        self.overRateSzn = overRateSzn
        self.recentGames = recentGames
        self.baseline = baseline
        self.baselineGap = baselineGap
        self.rankPos = rankPos
        self.flags = flags
        self.flagDetail = flagDetail
        self.reportStatus = reportStatus
        self.commenceTime = commenceTime
        self.game = game
        self.homeAbbr = homeAbbr
        self.awayAbbr = awayAbbr
        self.overPrice = overPrice
        self.underPrice = underPrice
        self.openLine = openLine
    }

    private static func flexString(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> String {
        if let value = try? c.decodeIfPresent(String.self, forKey: key), !value.isEmpty { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return String(value) }
        return ""
    }

    private static func flexDouble(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(value) }
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Double(value) }
        return nil
    }

    private static func flagKeys(_ c: KeyedDecodingContainer<CodingKeys>) -> [String] {
        (try? c.decodeIfPresent([String].self, forKey: .flags))?.filter { !$0.isEmpty } ?? []
    }
}

public struct NbaPropDef: Decodable, Hashable, Sendable {
    public let signalKey: String
    public let displayName: String?
    public let oneLiner: String?
    public let definition: String?
    public let recordText: String?
    public let seasonRecordText: String?
    public let whyItWorks: String?
    public let betDirection: String?

    public init(
        signalKey: String, displayName: String?, oneLiner: String?, definition: String?,
        recordText: String?, seasonRecordText: String?, whyItWorks: String? = nil, betDirection: String? = nil
    ) {
        self.signalKey = signalKey
        self.displayName = displayName
        self.oneLiner = oneLiner
        self.definition = definition
        self.recordText = recordText
        self.seasonRecordText = seasonRecordText
        self.whyItWorks = whyItWorks
        self.betDirection = betDirection
    }

    private enum CodingKeys: String, CodingKey {
        case signalKey = "signal_key"
        case displayName = "display_name"
        case oneLiner = "one_liner"
        case definition
        case recordText = "record_text"
        case seasonRecordText = "season_record_text"
        case whyItWorks = "why_it_works"
        case betDirection = "bet_direction"
    }
}

public struct NbaBookQuote: Decodable, Hashable, Sendable {
    public let bookmaker: String?
    public let line: Double?
    public let overOdds: Double?
    public let underOdds: Double?
    public let snapshotTime: String?

    public init(bookmaker: String?, line: Double?, overOdds: Double?, underOdds: Double?, snapshotTime: String?) {
        self.bookmaker = bookmaker
        self.line = line
        self.overOdds = overOdds
        self.underOdds = underOdds
        self.snapshotTime = snapshotTime
    }

    private enum CodingKeys: String, CodingKey {
        case bookmaker, line
        case overOdds = "over_odds"
        case underOdds = "under_odds"
        case snapshotTime = "snapshot_time"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bookmaker = try c.decodeIfPresent(String.self, forKey: .bookmaker)
        line = Self.dbl(c, .line)
        overOdds = Self.dbl(c, .overOdds)
        underOdds = Self.dbl(c, .underOdds)
        snapshotTime = try c.decodeIfPresent(String.self, forKey: .snapshotTime)
    }

    private static func dbl(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(value) }
        if let value = try? c.decodeIfPresent(String.self, forKey: key) { return Double(value) }
        return nil
    }
}

public struct NBASlateSignal: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let side: String?
    public let definition: String?
    public let recordText: String?
    public let seasonRecordText: String?
    /// Canonical market this flag belongs under: spread, total, moneyline, h1_spread, h1_total.
    public let market: String

    public init(id: String, title: String, side: String?, definition: String?, recordText: String?, seasonRecordText: String?, market: String = "") {
        self.id = id
        self.title = title
        self.side = side
        self.definition = definition
        self.recordText = recordText
        self.seasonRecordText = seasonRecordText
        self.market = market
    }
}

/// Which betting card a basketball slate flag belongs on, and whether that
/// flag takes the same side as the model. Supporting pills stay neutral;
/// a flag on the other side is the amber contradict pill football already uses.
public enum BasketballSignalMarket {
    public static func canonical(_ raw: String?) -> String? {
        let key = raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if key.isEmpty { return nil }
        switch key {
        case "spread", "fg_spread": return "spread"
        case "total", "fg_total", "ou", "over_under": return "total"
        case "moneyline", "ml", "money_line", "fg_ml": return "moneyline"
        case "h1_spread": return "h1_spread"
        case "h1_total", "h1_ou", "h1_over_under": return "h1_total"
        case "h1_ml", "h1_moneyline": return "h1_ml"
        case "tt": return "team_total"
        default:
            if key.hasPrefix("team_total") { return "team_total" }
            return key
        }
    }

    public static func isTotal(_ market: String) -> Bool {
        market == "total" || market == "h1_total" || market == "team_total"
    }

    public static func contradicts(
        side: String?,
        market: String,
        modelLikesHome: Bool?,
        modelLikesOver: Bool?,
        homeName: String,
        awayName: String,
        homeAbbr: String,
        awayAbbr: String
    ) -> Bool {
        let hay = (side ?? "").uppercased()
        if hay.isEmpty { return false }
        if isTotal(market) {
            if modelLikesOver == true { return hay.contains("UNDER") }
            if modelLikesOver == false, hay.contains("OVER"), !hay.contains("UNDER") { return true }
            return false
        }
        guard let modelLikesHome else { return false }
        if hay.contains("FADE HOME"), modelLikesHome { return true }
        if hay.contains("FADE AWAY"), !modelLikesHome { return true }
        guard let flagHome = likesHome(
            hay: hay,
            homeName: homeName,
            awayName: awayName,
            homeAbbr: homeAbbr,
            awayAbbr: awayAbbr
        ) else { return false }
        return flagHome != modelLikesHome
    }

    public static func supportingFirst<T>(_ items: [T], contradicts: (T) -> Bool) -> [T] {
        items.filter { !contradicts($0) } + items.filter(contradicts)
    }

    private static func likesHome(hay: String, homeName: String, awayName: String, homeAbbr: String, awayAbbr: String) -> Bool? {
        if hay.contains("HOME"), !hay.contains("FADE HOME") { return true }
        if hay.contains("AWAY"), !hay.contains("FADE AWAY") { return false }
        let mentionsHome = mentions(homeAbbr, in: hay) || mentions(homeName, in: hay)
        let mentionsAway = mentions(awayAbbr, in: hay) || mentions(awayName, in: hay)
        if mentionsHome, !mentionsAway { return true }
        if mentionsAway, !mentionsHome { return false }
        return nil
    }

    private static func mentions(_ token: String, in hay: String) -> Bool {
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard trimmed.count >= 2 else { return false }
        if trimmed.count >= 4 { return hay.contains(trimmed) }
        let pattern = "\\b\(NSRegularExpression.escapedPattern(for: trimmed))\\b"
        return hay.range(of: pattern, options: .regularExpression) != nil
    }
}

public struct NBAFirstHalfMarket: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let modelNumber: Double?
    public let marketNumber: Double?
    public let disagreement: Double?
    public let tier: String?
    public let trackingOnly: Bool
    public let homeAbbr: String?
    public let awayAbbr: String?

    public init(id: String, title: String, modelNumber: Double?, marketNumber: Double?, disagreement: Double?, tier: String?, trackingOnly: Bool, homeAbbr: String? = nil, awayAbbr: String? = nil) {
        self.id = id
        self.title = title
        self.modelNumber = modelNumber
        self.marketNumber = marketNumber
        self.disagreement = disagreement
        self.tier = tier
        self.trackingOnly = trackingOnly
        self.homeAbbr = homeAbbr
        self.awayAbbr = awayAbbr
    }
}

public enum NbaPickSide: String, Sendable {
    case over, under
}

public struct NbaRecentBar: Hashable, Sendable {
    public let value: Double
    public let cleared: Bool
    public let opponent: String?
    public let date: String?
}

public struct NbaRecentForm: Hashable, Sendable {
    public let bars: [NbaRecentBar]
    public let hits: Int
    public let games: Int
    public let pct: Double?
}

public struct NbaLineStamp: Hashable, Sendable {
    public let at: Double
    public let line: Double
}

public struct NbaLineMovement: Hashable, Sendable {
    public let moves: [NbaLineStamp]
    public let open: NbaLineStamp?
    public let mid: NbaLineStamp?
    public let current: NbaLineStamp?
}

public struct NbaPropGameOption: Identifiable, Hashable, Sendable {
    public let key: String
    public let label: String
    public let away: String?
    public let home: String?
    public var id: String { key }
}

public struct NbaPropMarketOption: Identifiable, Hashable, Sendable {
    public let key: String
    public let label: String
    public var id: String { key }
}

public struct NbaBookPrice: Hashable, Sendable {
    public let book: String
    public let price: Double
}

/// One list row per player-game. The sparkline is points unless a market
/// filter is on. A fired signal features that market in the pill instead.
public struct NbaPropListCard: Identifiable, Hashable, Sendable {
    public let id: String
    public let chart: NbaSlateProp
    public let featured: NbaSlateProp
    public var highlighted: Bool { !featured.flags.isEmpty }
}

public enum NbaPropCopy {
    public static let marketOrder = [
        "player_points", "player_rebounds", "player_assists", "player_threes",
        "player_blocks", "player_steals", "player_points_rebounds_assists",
        "player_points_rebounds", "player_points_assists", "player_rebounds_assists",
    ]

    public static func refSentence(key: String, detail: [String: NbaFlagDetail]) -> String? {
        signalSentence(key: key, detail: detail, playerName: nil)
    }

    public static func oneDecimal(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "%.1f", value)
    }

    public static func formatNumber(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "—" }
        if value.rounded() == value { return String(Int(value)) }
        return String(format: "%.1f", value)
    }

    public static func formatAmerican(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "—" }
        let rounded = Int(value.rounded())
        if rounded > 0 { return "+\(rounded)" }
        return "\(rounded)"
    }

    public static func sample(_ value: Double?, noun: String) -> String {
        guard let value else { return "sample size not posted" }
        return "\(Int(value)) \(noun)"
    }

    /// A higher American price is the better number for the bettor.
    public static func betterAmerican(_ candidate: Double, _ current: Double) -> Bool {
        candidate > current
    }

    public static func pickSide(_ row: NbaSlateProp, defs: [String: NbaPropDef]) -> NbaPickSide? {
        for key in row.flags {
            let direction = (defs[key]?.betDirection ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if direction == "over" || direction == "o" { return .over }
            if direction == "under" || direction == "u" { return .under }
            if key == "nba_player_ref_over" || key.hasSuffix("_over") { return .over }
            if key == "nba_player_ref_under" || key.hasSuffix("_under") { return .under }
        }
        return nil
    }

    public static func pickLabel(_ row: NbaSlateProp, defs: [String: NbaPropDef]) -> String {
        let label = row.marketLabel ?? row.market ?? "Prop"
        let line = formatNumber(row.line)
        switch pickSide(row, defs: defs) {
        case .over: return "\(label) O\(line)"
        case .under: return "\(label) U\(line)"
        case nil: return "\(label) \(line)"
        }
    }

    public static func signalSentence(key: String, detail: [String: NbaFlagDetail], playerName: ((String) -> String?)?) -> String? {
        if key == "nba_player_ref_over" || key == "nba_player_ref_under", let row = detail[key] {
            guard let games = row.games, let chief = row.chief?.trimmingCharacters(in: .whitespacesAndNewlines), !chief.isEmpty else { return nil }
            if key.hasSuffix("_under") {
                guard let below = row.below else { return nil }
                return "\(below) of \(games) games below his norm with \(chief)"
            }
            guard let above = row.above else { return nil }
            return "\(above) of \(games) games above his norm with \(chief)"
        }
        guard let row = detail[key] else { return nil }
        if key == "nba_hot_shooter_under", let heat = row.heatL5 {
            return "Last 5 games he scored \(String(format: "%.1f", heat)) points a night more than his own finishing"
        }
        if key == "nba_backup_same_pos_under" {
            let minutes = row.outMpg.map { "\(Int($0.rounded()))-minute " } ?? ""
            let position = row.position?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? "\(row.position!.trimmingCharacters(in: .whitespacesAndNewlines)) "
                : ""
            let missed = row.gamesMissedBefore
            let which = missed == 0 ? " for the first game" : missed == 1 ? " for the second game" : ""
            let starter = "a \(minutes)\(position)starter"
            let name = row.outPlayer.flatMap { playerName?($0) }
            let who = name.map { "\($0), \(starter)," } ?? "A \(minutes)\(position)starter"
            return "\(who) is out\(which) and this player is still on the bench"
        }
        return nil
    }

    public static func signalLines(_ row: NbaSlateProp, defs: [String: NbaPropDef], names: [String: String]) -> [String] {
        row.flags.compactMap { key in
            let specific = signalSentence(key: key, detail: row.flagDetail) { names[$0] }
            if let specific, !specific.isEmpty { return specific }
            let def = defs[key]
            if let line = def?.oneLiner?.trimmingCharacters(in: .whitespacesAndNewlines), !line.isEmpty { return line }
            if let line = def?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines), !line.isEmpty { return line }
            return nil
        }
    }

    public static func recentForm(_ row: NbaSlateProp, limit: Int = 10) -> NbaRecentForm {
        let line = row.line
        let logged = row.recentGames.compactMap { game -> (date: String?, opp: String?, value: Double, stamp: Double)? in
            guard let value = game.value else { return nil }
            let stamp = game.date.flatMap { isoStamp($0) } ?? .nan
            return (game.date, game.opp, value, stamp)
        }
        let ordered = logged.sorted { lhs, rhs in
            let leftKnown = lhs.stamp.isFinite
            let rightKnown = rhs.stamp.isFinite
            if leftKnown && rightKnown { return lhs.stamp < rhs.stamp }
            if leftKnown { return false }
            if rightKnown { return true }
            return false
        }.suffix(limit)
        let bars = ordered.map { game in
            NbaRecentBar(
                value: game.value,
                cleared: line.map { game.value > $0 } ?? false,
                opponent: game.opp?.trimmingCharacters(in: .whitespacesAndNewlines),
                date: game.date
            )
        }
        let hits = bars.filter(\.cleared).count
        return NbaRecentForm(
            bars: bars,
            hits: hits,
            games: bars.count,
            pct: bars.isEmpty || line == nil ? nil : (Double(hits) / Double(bars.count)) * 100
        )
    }

    public static func clearedCount(rate: Double?, games: Double?) -> Int? {
        guard let rate, let games, games > 0 else { return nil }
        let share = rate > 1 ? rate / 100 : rate
        guard share >= 0, share <= 1 else { return nil }
        return Int((share * games).rounded())
    }

    public static func bestQuote(_ quotes: [NbaBookQuote], side: NbaPickSide) -> NbaBookPrice? {
        var best: NbaBookPrice?
        for quote in quotes {
            let price = side == .over ? quote.overOdds : quote.underOdds
            let book = quote.bookmaker ?? ""
            guard let price, !book.isEmpty else { continue }
            if best == nil || betterAmerican(price, best!.price) {
                best = NbaBookPrice(book: book, price: price)
            }
        }
        return best
    }

    public static func lineMovement(_ quotes: [NbaBookQuote]) -> NbaLineMovement {
        var buckets: [Double: [Double]] = [:]
        for quote in quotes {
            guard let line = quote.line, let raw = quote.snapshotTime, let at = isoStamp(raw) else { continue }
            let minute = (at / 60_000).rounded(.down) * 60_000
            buckets[minute, default: []].append(line)
        }
        let samples = buckets.map { NbaLineStamp(at: $0.key, line: median($0.value)) }.sorted { $0.at < $1.at }
        guard let first = samples.first else { return NbaLineMovement(moves: [], open: nil, mid: nil, current: nil) }
        var moves: [NbaLineStamp] = []
        for sample in samples {
            if let last = moves.last, abs(last.line - sample.line) < 0.05 { continue }
            moves.append(sample)
        }
        let end = samples.last?.at ?? first.at
        let current = NbaLineStamp(at: end, line: moves.last?.line ?? first.line)
        var mid: NbaLineStamp?
        if moves.count > 1, end > first.at {
            let at = first.at + (end - first.at) / 2
            var line = first.line
            for move in moves where move.at <= at { line = move.line }
            mid = NbaLineStamp(at: at, line: line)
        }
        return NbaLineMovement(moves: moves, open: moves.first, mid: mid, current: current)
    }

    public static func games(_ rows: [NbaSlateProp]) -> [NbaPropGameOption] {
        var first: [String: NbaSlateProp] = [:]
        for row in rows where first[row.gameKey] == nil { first[row.gameKey] = row }
        let ordered = first.values.sorted {
            ($0.commenceTime ?? $0.gameDate ?? "") < ($1.commenceTime ?? $1.gameDate ?? "")
        }
        let labels = ordered.map(\.matchupLabel)
        let duplicated = Set(labels.filter { label in labels.filter { $0 == label }.count > 1 })
        return ordered.map { row in
            let label = row.matchupLabel
            let dated = duplicated.contains(label) && (row.gameDate?.count ?? 0) >= 10
                ? "\(label) · \(String(row.gameDate!.dropFirst(5)))"
                : label
            return NbaPropGameOption(key: row.gameKey, label: dated, away: row.awayAbbr, home: row.homeAbbr)
        }
    }

    public static func markets(_ rows: [NbaSlateProp]) -> [NbaPropMarketOption] {
        var labels: [String: String] = [:]
        for row in rows {
            guard let market = row.market, labels[market] == nil else { continue }
            labels[market] = row.marketLabel ?? market
        }
        return labels.map { NbaPropMarketOption(key: $0.key, label: $0.value) }
            .sorted { $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending }
    }

    public static func filter(_ rows: [NbaSlateProp], game: String?, market: String?, signalsOnly: Bool, query: String) -> [NbaPropListCard] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var groups: [String: [NbaSlateProp]] = [:]
        var order: [String] = []
        for row in rows {
            let id = playerGameID(row)
            if groups[id] == nil { order.append(id) }
            groups[id, default: []].append(row)
        }
        return order.compactMap { id in
            guard let group = groups[id], let sample = group.first else { return nil }
            if let game, sample.gameKey != game { return nil }
            if let market, !group.contains(where: { $0.market == market }) { return nil }
            if signalsOnly {
                let pool = market == nil ? group : group.filter { $0.market == market }
                if !pool.contains(where: { !$0.flags.isEmpty }) { return nil }
            }
            if !needle.isEmpty {
                let haystack = "\(sample.playerName ?? "") \(sample.team ?? "") \(sample.opponent ?? "")".lowercased()
                if !haystack.contains(needle) { return nil }
            }
            let featured = featuredRow(group, market: market)
            return NbaPropListCard(id: id, chart: chartRow(group, market: market, featured: featured), featured: featured)
        }
    }

    /// Points, unless the user picked a market or this player has no points row.
    private static func chartRow(_ group: [NbaSlateProp], market: String?, featured: NbaSlateProp) -> NbaSlateProp {
        if market != nil { return featured }
        return group.first { $0.market == "player_points" } ?? featured
    }

    /// A market filter wins. Otherwise the earliest signaled market, then points.
    private static func featuredRow(_ group: [NbaSlateProp], market: String?) -> NbaSlateProp {
        if let market, let match = group.first(where: { $0.market == market }) { return match }
        let signaled = group.filter { !$0.flags.isEmpty }.sorted { rank($0.market) < rank($1.market) }
        if let first = signaled.first { return first }
        if let points = group.first(where: { $0.market == "player_points" }) { return points }
        return group.sorted { rank($0.market) < rank($1.market) }[0]
    }

    public static func signalPlayerCount(_ rows: [NbaSlateProp]) -> Int {
        Set(rows.filter { !$0.flags.isEmpty }.map(playerGameID)).count
    }

    public static func playerSignalCount(_ rows: [NbaSlateProp], for row: NbaSlateProp) -> Int {
        let id = playerGameID(row)
        return rows.filter { playerGameID($0) == id }.reduce(0) { $0 + $1.flags.count }
    }

    public static func siblings(_ rows: [NbaSlateProp], of row: NbaSlateProp) -> [NbaSlateProp] {
        rows.filter { $0.athleteId == row.athleteId && $0.gameDate == row.gameDate }
            .sorted { rank($0.market) < rank($1.market) }
    }

    public static func athleteNames(_ rows: [NbaSlateProp]) -> [String: String] {
        var names: [String: String] = [:]
        for row in rows {
            if !row.athleteId.isEmpty, let name = row.playerName, !name.isEmpty {
                names[row.athleteId] = name
            }
        }
        return names
    }

    private static func playerGameID(_ row: NbaSlateProp) -> String {
        "\(row.gameDate ?? ""):\(row.athleteId)"
    }

    private static func rank(_ market: String?) -> Int {
        guard let market, let index = marketOrder.firstIndex(of: market) else { return marketOrder.count }
        return index
    }

    private static func median(_ values: [Double]) -> Double {
        let sorted = values.sorted()
        let mid = sorted.count / 2
        if sorted.count % 2 == 0 { return (sorted[mid - 1] + sorted[mid]) / 2 }
        return sorted[mid]
    }

    private static func isoStamp(_ iso: String) -> Double? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: iso) { return date.timeIntervalSince1970 * 1000 }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let date = plain.date(from: iso) { return date.timeIntervalSince1970 * 1000 }
        if iso.count >= 10 {
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = "yyyy-MM-dd"
            if let date = formatter.date(from: String(iso.prefix(10))) {
                return date.timeIntervalSince1970 * 1000
            }
        }
        return nil
    }
}
