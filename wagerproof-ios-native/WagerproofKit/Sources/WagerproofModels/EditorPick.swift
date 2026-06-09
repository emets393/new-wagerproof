import Foundation

/// Codable mirror of the RN `EditorPick` type in
/// `wagerproof-mobile/types/editorsPicks.ts`. Field names match the RN
/// `editors_picks` table byte-for-byte so the same JSON payload from
/// main Supabase decodes cleanly here.
///
/// `archived_game_data` is loosely-typed in RN (`any`). We model it as a
/// concrete `ArchivedGameData` struct so the Swift side can read the same
/// keys both camelCased (`awayTeam`, `awaySpread`) and snake_cased
/// (`away_team`, `away_spread`) — RN historically writes both styles, so the
/// decoder accepts either.
public struct EditorPick: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let gameId: String
    public let gameType: GameType
    public let editorId: String
    public let selectedBetType: String
    public let editorsNotes: String?
    public let isPublished: Bool
    public let createdAt: String
    public let updatedAt: String
    public let betslipLinks: [String: String]?
    public let pickValue: String?
    public let bestPrice: String?
    public let sportsbook: String?
    public let units: Double?
    public let isFreePick: Bool?
    public let archivedGameData: ArchivedGameData?
    public let betType: String?
    public let result: PickResult?

    public init(
        id: String,
        gameId: String,
        gameType: GameType,
        editorId: String,
        selectedBetType: String,
        editorsNotes: String? = nil,
        isPublished: Bool,
        createdAt: String,
        updatedAt: String,
        betslipLinks: [String: String]? = nil,
        pickValue: String? = nil,
        bestPrice: String? = nil,
        sportsbook: String? = nil,
        units: Double? = nil,
        isFreePick: Bool? = nil,
        archivedGameData: ArchivedGameData? = nil,
        betType: String? = nil,
        result: PickResult? = nil
    ) {
        self.id = id
        self.gameId = gameId
        self.gameType = gameType
        self.editorId = editorId
        self.selectedBetType = selectedBetType
        self.editorsNotes = editorsNotes
        self.isPublished = isPublished
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.betslipLinks = betslipLinks
        self.pickValue = pickValue
        self.bestPrice = bestPrice
        self.sportsbook = sportsbook
        self.units = units
        self.isFreePick = isFreePick
        self.archivedGameData = archivedGameData
        self.betType = betType
        self.result = result
    }

    enum CodingKeys: String, CodingKey {
        case id
        case gameId = "game_id"
        case gameType = "game_type"
        case editorId = "editor_id"
        case selectedBetType = "selected_bet_type"
        case editorsNotes = "editors_notes"
        case isPublished = "is_published"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case betslipLinks = "betslip_links"
        case pickValue = "pick_value"
        case bestPrice = "best_price"
        case sportsbook
        case units
        case isFreePick = "is_free_pick"
        case archivedGameData = "archived_game_data"
        case betType = "bet_type"
        case result
    }
}

/// Sport keys used by `editors_picks.game_type`. Maps 1:1 to the RN union
/// `'nfl' | 'cfb' | 'nba' | 'ncaab'`. Unknown values decode to `.unknown`
/// so a stray row doesn't blow up the whole feed.
public enum GameType: String, Codable, Sendable, Hashable, CaseIterable {
    case nfl
    case cfb
    case nba
    case ncaab
    case mlb
    case unknown

    public init(from decoder: Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self))?.lowercased() ?? ""
        self = GameType(rawValue: raw) ?? .unknown
    }

    public var displayLabel: String {
        switch self {
        case .nfl: return "NFL"
        case .cfb: return "CFB"
        case .nba: return "NBA"
        case .ncaab: return "NCAAB"
        case .mlb: return "MLB"
        case .unknown: return "—"
        }
    }
}

/// `result` column on `editors_picks`. Mirrors RN union exactly.
public enum PickResult: String, Codable, Sendable, Hashable {
    case won
    case lost
    case push
    case pending
}

/// Sub-doc inside `editors_picks.archived_game_data`. RN writes this JSON
/// blob when an editor saves a pick — it snapshots the betting lines so the
/// pick still renders correctly after the live game data scrolls off the
/// CFB Supabase tables. RN's persistence is inconsistent — some keys are
/// camelCased (`awayTeam`), others snake_cased (`away_team`) — so this
/// decoder accepts both. Encoding always uses camelCase (RN's newer format).
public struct ArchivedGameData: Codable, Sendable, Hashable {
    public var awayTeam: String?
    public var homeTeam: String?
    public var awayLogo: String?
    public var homeLogo: String?
    public var gameDate: String?
    public var gameTime: String?
    public var rawGameDate: String?
    public var awaySpread: Double?
    public var homeSpread: Double?
    public var overLine: Double?
    public var awayMl: Int?
    public var homeMl: Int?
    public var awayTeamColors: TeamColors?
    public var homeTeamColors: TeamColors?

    public init(
        awayTeam: String? = nil,
        homeTeam: String? = nil,
        awayLogo: String? = nil,
        homeLogo: String? = nil,
        gameDate: String? = nil,
        gameTime: String? = nil,
        rawGameDate: String? = nil,
        awaySpread: Double? = nil,
        homeSpread: Double? = nil,
        overLine: Double? = nil,
        awayMl: Int? = nil,
        homeMl: Int? = nil,
        awayTeamColors: TeamColors? = nil,
        homeTeamColors: TeamColors? = nil
    ) {
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayLogo = awayLogo
        self.homeLogo = homeLogo
        self.gameDate = gameDate
        self.gameTime = gameTime
        self.rawGameDate = rawGameDate
        self.awaySpread = awaySpread
        self.homeSpread = homeSpread
        self.overLine = overLine
        self.awayMl = awayMl
        self.homeMl = homeMl
        self.awayTeamColors = awayTeamColors
        self.homeTeamColors = homeTeamColors
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: DynamicKey.self)
        // Accept either casing for each field.
        awayTeam = c.firstString(["awayTeam", "away_team"])
        homeTeam = c.firstString(["homeTeam", "home_team"])
        awayLogo = c.firstString(["awayLogo", "away_logo"])
        homeLogo = c.firstString(["homeLogo", "home_logo"])
        gameDate = c.firstString(["gameDate", "game_date"])
        gameTime = c.firstString(["gameTime", "game_time"])
        rawGameDate = c.firstString(["rawGameDate", "raw_game_date"])
        awaySpread = c.firstDouble(["awaySpread", "away_spread"])
        homeSpread = c.firstDouble(["homeSpread", "home_spread"])
        overLine = c.firstDouble(["overLine", "over_line"])
        awayMl = c.firstInt(["awayMl", "away_ml"])
        homeMl = c.firstInt(["homeMl", "home_ml"])
        awayTeamColors = c.firstDecodable(["awayTeamColors", "away_team_colors"])
        homeTeamColors = c.firstDecodable(["homeTeamColors", "home_team_colors"])
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: DynamicKey.self)
        try c.encodeIfPresent(awayTeam, forKey: DynamicKey(string: "awayTeam"))
        try c.encodeIfPresent(homeTeam, forKey: DynamicKey(string: "homeTeam"))
        try c.encodeIfPresent(awayLogo, forKey: DynamicKey(string: "awayLogo"))
        try c.encodeIfPresent(homeLogo, forKey: DynamicKey(string: "homeLogo"))
        try c.encodeIfPresent(gameDate, forKey: DynamicKey(string: "gameDate"))
        try c.encodeIfPresent(gameTime, forKey: DynamicKey(string: "gameTime"))
        try c.encodeIfPresent(rawGameDate, forKey: DynamicKey(string: "rawGameDate"))
        try c.encodeIfPresent(awaySpread, forKey: DynamicKey(string: "awaySpread"))
        try c.encodeIfPresent(homeSpread, forKey: DynamicKey(string: "homeSpread"))
        try c.encodeIfPresent(overLine, forKey: DynamicKey(string: "overLine"))
        try c.encodeIfPresent(awayMl, forKey: DynamicKey(string: "awayMl"))
        try c.encodeIfPresent(homeMl, forKey: DynamicKey(string: "homeMl"))
        try c.encodeIfPresent(awayTeamColors, forKey: DynamicKey(string: "awayTeamColors"))
        try c.encodeIfPresent(homeTeamColors, forKey: DynamicKey(string: "homeTeamColors"))
    }
}

public struct TeamColors: Codable, Sendable, Hashable {
    public let primary: String
    public let secondary: String

    public init(primary: String, secondary: String) {
        self.primary = primary
        self.secondary = secondary
    }

    public static let `default` = TeamColors(primary: "#6B7280", secondary: "#9CA3AF")
}

/// Per-pick game context joined from the relevant sport's input/lines table
/// (NFL, CFB, NBA, NCAAB, MLB). Mirrors RN's `GameData` type but Swiftified
/// — colors come back as `TeamColors`, optional values stay optional.
public struct EditorPickGameData: Sendable, Hashable {
    public var awayTeam: String
    public var homeTeam: String
    public var awayLogo: String?
    public var homeLogo: String?
    public var gameDate: String?
    public var gameTime: String?
    /// ISO-ish raw date string used for sorting / filtering. May be `YYYY-MM-DD`
    /// or full ISO 8601 — mirrors the RN code's mixed input.
    public var rawGameDate: String?
    public var awaySpread: Double?
    public var homeSpread: Double?
    public var overLine: Double?
    public var awayMl: Int?
    public var homeMl: Int?
    public var openingSpread: Double?
    public var awayTeamColors: TeamColors
    public var homeTeamColors: TeamColors

    public init(
        awayTeam: String,
        homeTeam: String,
        awayLogo: String? = nil,
        homeLogo: String? = nil,
        gameDate: String? = nil,
        gameTime: String? = nil,
        rawGameDate: String? = nil,
        awaySpread: Double? = nil,
        homeSpread: Double? = nil,
        overLine: Double? = nil,
        awayMl: Int? = nil,
        homeMl: Int? = nil,
        openingSpread: Double? = nil,
        awayTeamColors: TeamColors = .default,
        homeTeamColors: TeamColors = .default
    ) {
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayLogo = awayLogo
        self.homeLogo = homeLogo
        self.gameDate = gameDate
        self.gameTime = gameTime
        self.rawGameDate = rawGameDate
        self.awaySpread = awaySpread
        self.homeSpread = homeSpread
        self.overLine = overLine
        self.awayMl = awayMl
        self.homeMl = homeMl
        self.openingSpread = openingSpread
        self.awayTeamColors = awayTeamColors
        self.homeTeamColors = homeTeamColors
    }
}

// MARK: - Codable helpers

/// Dynamic CodingKey used to accept either snake_case or camelCase JSON keys
/// without writing two parallel decoders for each.
struct DynamicKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init(string: String) { stringValue = string }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

private extension KeyedDecodingContainer where Key == DynamicKey {
    // Swift's `try?` flattens `T?` from a throwing function — so a single
    // `if let v = try? decodeIfPresent(...)` already returns the unwrapped
    // value. No need for `v != nil` (would always be true).
    func firstString(_ keys: [String]) -> String? {
        for key in keys {
            if let dk = DynamicKey(stringValue: key),
               let v = try? decodeIfPresent(String.self, forKey: dk) {
                return v
            }
        }
        return nil
    }
    func firstDouble(_ keys: [String]) -> Double? {
        for key in keys {
            if let dk = DynamicKey(stringValue: key),
               let v = try? decodeIfPresent(Double.self, forKey: dk) {
                return v
            }
        }
        return nil
    }
    func firstInt(_ keys: [String]) -> Int? {
        for key in keys {
            if let dk = DynamicKey(stringValue: key),
               let v = try? decodeIfPresent(Int.self, forKey: dk) {
                return v
            }
        }
        return nil
    }
    func firstDecodable<T: Decodable>(_ keys: [String]) -> T? {
        for key in keys {
            if let dk = DynamicKey(stringValue: key),
               let v = try? decodeIfPresent(T.self, forKey: dk) {
                return v
            }
        }
        return nil
    }
}
