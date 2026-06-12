import Foundation

/// MLB team mapping row. Mirrors RN `MLBTeamMapping` in
/// `wagerproof-mobile/types/mlb.ts`. Hydrated from `mlb_team_mapping`.
public struct MLBTeamMapping: Codable, Hashable, Sendable {
    public let mlbApiId: Int
    public let team: String
    public let teamName: String
    public let logoUrl: String?

    public init(mlbApiId: Int, team: String, teamName: String, logoUrl: String? = nil) {
        self.mlbApiId = mlbApiId
        self.team = team
        self.teamName = teamName
        self.logoUrl = logoUrl
    }

    enum CodingKeys: String, CodingKey {
        case mlbApiId = "mlb_api_id"
        case team
        case teamName = "team_name"
        case logoUrl = "logo_url"
    }
}

/// Static MLB team color + abbreviation map. Mirrors RN
/// `wagerproof-mobile/constants/mlbTeams.ts`. Used both as the primary
/// color source for gradients/avatars and as a fallback when the
/// `mlb_team_mapping` table is empty.
public enum MLBTeams {
    public struct TeamInfo: Hashable, Sendable {
        public let team: String
        public let logoUrl: String
        public let primaryHex: UInt32
        public let secondaryHex: UInt32
    }

    public static let byNormalizedName: [String: TeamInfo] = [
        "arizona diamondbacks":   .init(team: "ARI", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png", primaryHex: 0xA71930, secondaryHex: 0xE3D4AD),
        "atlanta braves":         .init(team: "ATL", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png", primaryHex: 0xCE1141, secondaryHex: 0x13274F),
        "baltimore orioles":      .init(team: "BAL", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png", primaryHex: 0xDF4601, secondaryHex: 0x27251F),
        "boston red sox":         .init(team: "BOS", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png", primaryHex: 0xBD3039, secondaryHex: 0x0C2340),
        "chicago cubs":           .init(team: "CHC", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/chc.png", primaryHex: 0x0E3386, secondaryHex: 0xCC3433),
        "chicago white sox":      .init(team: "CWS", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cws.png", primaryHex: 0x27251F, secondaryHex: 0xC4CED4),
        "cincinnati reds":        .init(team: "CIN", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cin.png", primaryHex: 0xC6011F, secondaryHex: 0x27251F),
        "cleveland guardians":    .init(team: "CLE", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png", primaryHex: 0x00385D, secondaryHex: 0xE31937),
        "colorado rockies":       .init(team: "COL", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/col.png", primaryHex: 0x333366, secondaryHex: 0xC4CED4),
        "detroit tigers":         .init(team: "DET", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/det.png", primaryHex: 0x0C2340, secondaryHex: 0xFA4616),
        "houston astros":         .init(team: "HOU", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/hou.png", primaryHex: 0x002D62, secondaryHex: 0xEB6E1F),
        "kansas city royals":     .init(team: "KC",  logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/kc.png",  primaryHex: 0x004687, secondaryHex: 0xBD9B60),
        "los angeles angels":     .init(team: "LAA", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/laa.png", primaryHex: 0xBA0021, secondaryHex: 0x003263),
        "los angeles dodgers":    .init(team: "LAD", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png", primaryHex: 0x005A9C, secondaryHex: 0xEF3E42),
        "miami marlins":          .init(team: "MIA", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mia.png", primaryHex: 0x00A3E0, secondaryHex: 0xEF3340),
        "milwaukee brewers":      .init(team: "MIL", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mil.png", primaryHex: 0xFFC52F, secondaryHex: 0x12284B),
        "minnesota twins":        .init(team: "MIN", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/min.png", primaryHex: 0x002B5C, secondaryHex: 0xD31145),
        "new york mets":          .init(team: "NYM", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png", primaryHex: 0x002D72, secondaryHex: 0xFF5910),
        "new york yankees":       .init(team: "NYY", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png", primaryHex: 0x003087, secondaryHex: 0x132448),
        "oakland athletics":      .init(team: "OAK", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/oak.png", primaryHex: 0x003831, secondaryHex: 0xEFB21E),
        "philadelphia phillies":  .init(team: "PHI", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png", primaryHex: 0xE81828, secondaryHex: 0x002D72),
        "pittsburgh pirates":     .init(team: "PIT", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/pit.png", primaryHex: 0x27251F, secondaryHex: 0xFDB827),
        "san diego padres":       .init(team: "SD",  logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png",  primaryHex: 0x2F241D, secondaryHex: 0xFFC425),
        "san francisco giants":   .init(team: "SF",  logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sf.png",  primaryHex: 0xFD5A1E, secondaryHex: 0x27251F),
        "seattle mariners":       .init(team: "SEA", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sea.png", primaryHex: 0x0C2C56, secondaryHex: 0x005C5C),
        "st louis cardinals":     .init(team: "STL", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/stl.png", primaryHex: 0xC41E3A, secondaryHex: 0x0C2340),
        "tampa bay rays":         .init(team: "TB",  logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png",  primaryHex: 0x092C5C, secondaryHex: 0x8FBCE6),
        "texas rangers":          .init(team: "TEX", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tex.png", primaryHex: 0x003278, secondaryHex: 0xC0111F),
        "toronto blue jays":      .init(team: "TOR", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png", primaryHex: 0x134A8E, secondaryHex: 0x1D2D5C),
        "washington nationals":   .init(team: "WSH", logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png", primaryHex: 0xAB0003, secondaryHex: 0x14225A),
    ]

    /// MLB Stats API `team_id` → `(abbrev, espnSlug)`. Used by the betting trends
    /// flow which carries `team_id` (not `team_name`) from
    /// `mlb_situational_trends_today`. Mirrors RN `MLB_TEAM_BY_ID`.
    public static let brandById: [Int: (abbrev: String, espnSlug: String)] = [
        108: ("LAA", "laa"), 109: ("ARI", "ari"), 110: ("BAL", "bal"),
        111: ("BOS", "bos"), 112: ("CHC", "chc"), 113: ("CIN", "cin"),
        114: ("CLE", "cle"), 115: ("COL", "col"), 116: ("DET", "det"),
        117: ("HOU", "hou"), 118: ("KC",  "kc"),  119: ("LAD", "lad"),
        120: ("WSH", "wsh"), 121: ("NYM", "nym"), 133: ("ATH", "ath"),
        134: ("PIT", "pit"), 135: ("SD",  "sd"),  136: ("SEA", "sea"),
        137: ("SF",  "sf"),  138: ("STL", "stl"), 139: ("TB",  "tb"),
        140: ("TEX", "tex"), 141: ("TOR", "tor"), 142: ("MIN", "min"),
        143: ("PHI", "phi"), 144: ("ATL", "atl"), 145: ("CWS", "cws"),
        146: ("MIA", "mia"), 147: ("NYY", "nyy"), 158: ("MIL", "mil"),
    ]

    /// Normalize a team name for lookup (trim, lowercase, strip apostrophes,
    /// collapse whitespace). Matches RN `normalizeTeamNameKey`.
    public static func normalize(_ name: String) -> String {
        let stripped = name
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "\u{2019}", with: "")
        return stripped
            .split(separator: " ", omittingEmptySubsequences: true)
            .joined(separator: " ")
    }

    /// Team info by full name (with fuzzy fallback). Mirrors RN
    /// `getMLBFallbackTeamInfo`.
    public static func info(for teamName: String) -> TeamInfo? {
        let normalized = normalize(teamName)
        if let exact = byNormalizedName[normalized] { return exact }
        // Fuzzy: substring either direction
        var best: TeamInfo? = nil
        var bestScore = 0
        for (key, info) in byNormalizedName {
            if key.contains(normalized) || normalized.contains(key) {
                let score = min(key.count, normalized.count)
                if score > bestScore { bestScore = score; best = info }
            }
        }
        return best
    }

    /// Resolve `(abbrev, logoUrl)` from MLB Stats API team_id. Returns nil
    /// when the team_id isn't in the static brand map.
    public static func displayById(_ teamId: Int) -> (abbrev: String, logoUrl: String)? {
        guard let brand = brandById[teamId] else { return nil }
        return (brand.abbrev, "https://a.espncdn.com/i/teamlogos/mlb/500/\(brand.espnSlug).png")
    }

    /// Team primary/secondary hex colors by name or abbreviation. Falls
    /// back to a neutral pair if nothing matches. Matches RN
    /// `getMLBTeamColors`.
    public static func colors(for nameOrAbbrev: String) -> (primary: UInt32, secondary: UInt32) {
        let upper = nameOrAbbrev.uppercased()
        for info in byNormalizedName.values where info.team == upper {
            return (info.primaryHex, info.secondaryHex)
        }
        if let info = info(for: nameOrAbbrev) {
            return (info.primaryHex, info.secondaryHex)
        }
        return (0x1F2937, 0x6B7280)
    }
}

// MARK: - Trends + bucket accuracy + regression-report payload types

/// One row from `mlb_situational_trends_today` (or fallback table).
/// Mirrors RN `MLBSituationalTrendRow`.
public struct MLBSituationalTrendRow: Codable, Hashable, Sendable {
    public let gamePk: Int
    public let gameDateEt: String
    public let teamId: Int
    public let teamName: String
    public let teamSide: String // "home" | "away"

    public let lastGameSituation: String?
    public let homeAwaySituation: String?
    public let favDogSituation: String?
    public let restBucket: String?
    public let restComp: String?
    public let leagueSituation: String?
    public let divisionSituation: String?

    // win % (moneyline). PostgREST returns numeric or string for these.
    public let winPctLastGame: Double?
    public let winPctHomeAway: Double?
    public let winPctFavDog: Double?
    public let winPctRestBucket: Double?
    public let winPctRestComp: Double?
    public let winPctLeague: Double?
    public let winPctDivision: Double?

    // over %
    public let overPctLastGame: Double?
    public let overPctHomeAway: Double?
    public let overPctFavDog: Double?
    public let overPctRestBucket: Double?
    public let overPctRestComp: Double?
    public let overPctLeague: Double?
    public let overPctDivision: Double?

    public init(
        gamePk: Int,
        gameDateEt: String,
        teamId: Int,
        teamName: String,
        teamSide: String,
        lastGameSituation: String? = nil,
        homeAwaySituation: String? = nil,
        favDogSituation: String? = nil,
        restBucket: String? = nil,
        restComp: String? = nil,
        leagueSituation: String? = nil,
        divisionSituation: String? = nil,
        winPctLastGame: Double? = nil,
        winPctHomeAway: Double? = nil,
        winPctFavDog: Double? = nil,
        winPctRestBucket: Double? = nil,
        winPctRestComp: Double? = nil,
        winPctLeague: Double? = nil,
        winPctDivision: Double? = nil,
        overPctLastGame: Double? = nil,
        overPctHomeAway: Double? = nil,
        overPctFavDog: Double? = nil,
        overPctRestBucket: Double? = nil,
        overPctRestComp: Double? = nil,
        overPctLeague: Double? = nil,
        overPctDivision: Double? = nil
    ) {
        self.gamePk = gamePk
        self.gameDateEt = gameDateEt
        self.teamId = teamId
        self.teamName = teamName
        self.teamSide = teamSide
        self.lastGameSituation = lastGameSituation
        self.homeAwaySituation = homeAwaySituation
        self.favDogSituation = favDogSituation
        self.restBucket = restBucket
        self.restComp = restComp
        self.leagueSituation = leagueSituation
        self.divisionSituation = divisionSituation
        self.winPctLastGame = winPctLastGame
        self.winPctHomeAway = winPctHomeAway
        self.winPctFavDog = winPctFavDog
        self.winPctRestBucket = winPctRestBucket
        self.winPctRestComp = winPctRestComp
        self.winPctLeague = winPctLeague
        self.winPctDivision = winPctDivision
        self.overPctLastGame = overPctLastGame
        self.overPctHomeAway = overPctHomeAway
        self.overPctFavDog = overPctFavDog
        self.overPctRestBucket = overPctRestBucket
        self.overPctRestComp = overPctRestComp
        self.overPctLeague = overPctLeague
        self.overPctDivision = overPctDivision
    }

    enum CodingKeys: String, CodingKey {
        case gamePk = "game_pk"
        case gameDateEt = "game_date_et"
        case teamId = "team_id"
        case teamName = "team_name"
        case teamSide = "team_side"
        case lastGameSituation = "last_game_situation"
        case homeAwaySituation = "home_away_situation"
        case favDogSituation = "fav_dog_situation"
        case restBucket = "rest_bucket"
        case restComp = "rest_comp"
        case leagueSituation = "league_situation"
        case divisionSituation = "division_situation"
        case winPctLastGame = "win_pct_last_game"
        case winPctHomeAway = "win_pct_home_away"
        case winPctFavDog = "win_pct_fav_dog"
        case winPctRestBucket = "win_pct_rest_bucket"
        case winPctRestComp = "win_pct_rest_comp"
        case winPctLeague = "win_pct_league"
        case winPctDivision = "win_pct_division"
        case overPctLastGame = "over_pct_last_game"
        case overPctHomeAway = "over_pct_home_away"
        case overPctFavDog = "over_pct_fav_dog"
        case overPctRestBucket = "over_pct_rest_bucket"
        case overPctRestComp = "over_pct_rest_comp"
        case overPctLeague = "over_pct_league"
        case overPctDivision = "over_pct_division"
    }

    // PostgREST returns numeric or string for these — accept both.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        gamePk = try MLBSituationalTrendRow.flexibleInt(from: c, key: .gamePk)
        gameDateEt = (try? c.decode(String.self, forKey: .gameDateEt)) ?? ""
        teamId = try MLBSituationalTrendRow.flexibleInt(from: c, key: .teamId)
        teamName = (try? c.decode(String.self, forKey: .teamName)) ?? ""
        teamSide = (try? c.decode(String.self, forKey: .teamSide)) ?? ""
        lastGameSituation = try? c.decodeIfPresent(String.self, forKey: .lastGameSituation)
        homeAwaySituation = try? c.decodeIfPresent(String.self, forKey: .homeAwaySituation)
        favDogSituation = try? c.decodeIfPresent(String.self, forKey: .favDogSituation)
        restBucket = try? c.decodeIfPresent(String.self, forKey: .restBucket)
        restComp = try? c.decodeIfPresent(String.self, forKey: .restComp)
        leagueSituation = try? c.decodeIfPresent(String.self, forKey: .leagueSituation)
        divisionSituation = try? c.decodeIfPresent(String.self, forKey: .divisionSituation)
        winPctLastGame = MLBSituationalTrendRow.flexibleDouble(from: c, key: .winPctLastGame)
        winPctHomeAway = MLBSituationalTrendRow.flexibleDouble(from: c, key: .winPctHomeAway)
        winPctFavDog = MLBSituationalTrendRow.flexibleDouble(from: c, key: .winPctFavDog)
        winPctRestBucket = MLBSituationalTrendRow.flexibleDouble(from: c, key: .winPctRestBucket)
        winPctRestComp = MLBSituationalTrendRow.flexibleDouble(from: c, key: .winPctRestComp)
        winPctLeague = MLBSituationalTrendRow.flexibleDouble(from: c, key: .winPctLeague)
        winPctDivision = MLBSituationalTrendRow.flexibleDouble(from: c, key: .winPctDivision)
        overPctLastGame = MLBSituationalTrendRow.flexibleDouble(from: c, key: .overPctLastGame)
        overPctHomeAway = MLBSituationalTrendRow.flexibleDouble(from: c, key: .overPctHomeAway)
        overPctFavDog = MLBSituationalTrendRow.flexibleDouble(from: c, key: .overPctFavDog)
        overPctRestBucket = MLBSituationalTrendRow.flexibleDouble(from: c, key: .overPctRestBucket)
        overPctRestComp = MLBSituationalTrendRow.flexibleDouble(from: c, key: .overPctRestComp)
        overPctLeague = MLBSituationalTrendRow.flexibleDouble(from: c, key: .overPctLeague)
        overPctDivision = MLBSituationalTrendRow.flexibleDouble(from: c, key: .overPctDivision)
    }

    private static func flexibleInt(from c: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) throws -> Int {
        if let i = try? c.decode(Int.self, forKey: key) { return i }
        if let s = try? c.decode(String.self, forKey: key), let i = Int(s) { return i }
        if let d = try? c.decode(Double.self, forKey: key) { return Int(d) }
        return 0
    }

    private static func flexibleDouble(from c: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) -> Double? {
        if let d = try? c.decode(Double.self, forKey: key) { return d }
        if let s = try? c.decode(String.self, forKey: key) {
            let trimmed = s.replacingOccurrences(of: "%", with: "").trimmingCharacters(in: .whitespaces)
            if let d = Double(trimmed) { return d }
        }
        return nil
    }
}

/// Per-game trends bundle: home + away rows.
public struct MLBGameTrends: Hashable, Sendable, Identifiable {
    public var id: Int { gamePk }
    public let gamePk: Int
    public let gameDateEt: String
    public var gameTimeEt: String?
    public let awayTeam: MLBSituationalTrendRow
    public let homeTeam: MLBSituationalTrendRow
    public var ouConsensusScore: Double
    public var mlDominanceScore: Double

    public init(
        gamePk: Int,
        gameDateEt: String,
        gameTimeEt: String? = nil,
        awayTeam: MLBSituationalTrendRow,
        homeTeam: MLBSituationalTrendRow,
        ouConsensusScore: Double = 0,
        mlDominanceScore: Double = 0
    ) {
        self.gamePk = gamePk
        self.gameDateEt = gameDateEt
        self.gameTimeEt = gameTimeEt
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.ouConsensusScore = ouConsensusScore
        self.mlDominanceScore = mlDominanceScore
    }
}

public enum MLBSituationType: String, CaseIterable, Sendable {
    case lastGame, homeAway, favDog, restBucket, restComp, league, division
}

public enum MLBTrendsSortMode: String, CaseIterable, Sendable {
    case time, ouConsensus, mlDominance
}

/// Convert an encoded MLB situation tag into its display label. Mirrors RN
/// `formatMLBSituation` (`types/mlbBettingTrends.ts`) — the shared map plus
/// the MLB-only home/rest/league/division entries; unknown tags fall back to
/// title-cased words, nil to an em dash.
public func formatMLBSituation(_ situation: String?) -> String {
    guard let situation, !situation.isEmpty else { return "—" }
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
        "rest_equal": "Equal Rest",
        "is_home": "Home",
        "is_away": "Away",
        "no_rest": "No Rest",
        "equal_rest": "Equal Rest",
        "non_league": "Non-League",
        "non_division": "Non-Division",
        "league": "League",
        "division": "Division"
    ]
    if let mapped = map[situation] { return mapped }
    return situation.replacingOccurrences(of: "_", with: " ")
        .split(separator: " ")
        .map { $0.prefix(1).uppercased() + $0.dropFirst() }
        .joined(separator: " ")
}

// MARK: - Bucket accuracy

/// One row from `mlb_model_bucket_accuracy`. Mirrors RN `BucketAccuracyRow`.
public struct MLBBucketAccuracyRow: Codable, Hashable, Sendable {
    public let betType: String   // full_ml | full_ou | f5_ml | f5_ou | perfect_storm
    public let bucket: String
    public let side: String
    public let favDog: String
    public let direction: String
    public let games: Int
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let unitsWon: Double
    public let winPct: Double
    public let roiPct: Double
    public let updatedAt: String?

    public init(
        betType: String, bucket: String, side: String, favDog: String,
        direction: String, games: Int, wins: Int, losses: Int, pushes: Int,
        unitsWon: Double, winPct: Double, roiPct: Double, updatedAt: String? = nil
    ) {
        self.betType = betType
        self.bucket = bucket
        self.side = side
        self.favDog = favDog
        self.direction = direction
        self.games = games
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.unitsWon = unitsWon
        self.winPct = winPct
        self.roiPct = roiPct
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case betType = "bet_type"
        case bucket
        case side
        case favDog = "fav_dog"
        case direction
        case games
        case wins
        case losses
        case pushes
        case unitsWon = "units_won"
        case winPct = "win_pct"
        case roiPct = "roi_pct"
        case updatedAt = "updated_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        betType = (try? c.decode(String.self, forKey: .betType)) ?? ""
        bucket = (try? c.decode(String.self, forKey: .bucket)) ?? ""
        side = (try? c.decodeIfPresent(String.self, forKey: .side)) ?? ""
        favDog = (try? c.decodeIfPresent(String.self, forKey: .favDog)) ?? ""
        direction = (try? c.decodeIfPresent(String.self, forKey: .direction)) ?? ""
        games = (try? c.decode(Int.self, forKey: .games)) ?? 0
        wins = (try? c.decode(Int.self, forKey: .wins)) ?? 0
        losses = (try? c.decode(Int.self, forKey: .losses)) ?? 0
        pushes = (try? c.decode(Int.self, forKey: .pushes)) ?? 0
        unitsWon = (try? c.decode(Double.self, forKey: .unitsWon)) ?? 0
        if let d = try? c.decode(Double.self, forKey: .winPct) {
            winPct = d
        } else if let s = try? c.decode(String.self, forKey: .winPct), let d = Double(s) {
            winPct = d
        } else {
            winPct = 0
        }
        if let d = try? c.decode(Double.self, forKey: .roiPct) {
            roiPct = d
        } else if let s = try? c.decode(String.self, forKey: .roiPct), let d = Double(s) {
            roiPct = d
        } else {
            roiPct = 0
        }
        updatedAt = try? c.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

public struct MLBBucketTally: Hashable, Sendable {
    public var games: Int = 0
    public var wins: Int = 0
    public var winPct: Double = 0
    public var unitsWon: Double = 0
    public var roiPct: Double = 0

    public init() {}
}

public struct MLBBucketBucket: Hashable, Sendable {
    public let bucket: String
    public let side: String?
    public let favDog: String?
    public let direction: String?
    public let games: Int
    public let wins: Int
    public let winPct: Double
    public let unitsWon: Double
    public let roiPct: Double

    public init(
        bucket: String, side: String? = nil, favDog: String? = nil,
        direction: String? = nil, games: Int, wins: Int, winPct: Double,
        unitsWon: Double, roiPct: Double
    ) {
        self.bucket = bucket
        self.side = side
        self.favDog = favDog
        self.direction = direction
        self.games = games
        self.wins = wins
        self.winPct = winPct
        self.unitsWon = unitsWon
        self.roiPct = roiPct
    }
}

public struct MLBBetTypeAccuracy: Hashable, Sendable {
    public var overall: MLBBucketTally
    public var byBucket: [MLBBucketBucket]

    public init(overall: MLBBucketTally = .init(), byBucket: [MLBBucketBucket] = []) {
        self.overall = overall
        self.byBucket = byBucket
    }
}

/// Final aggregated table. Mirrors RN `MLBBucketAccuracy`.
public struct MLBBucketAccuracy: Hashable, Sendable {
    public var fullMl: MLBBetTypeAccuracy
    public var fullOu: MLBBetTypeAccuracy
    public var f5Ml: MLBBetTypeAccuracy
    public var f5Ou: MLBBetTypeAccuracy
    public var perfectStorm: MLBBetTypeAccuracy

    public init(
        fullMl: MLBBetTypeAccuracy = .init(),
        fullOu: MLBBetTypeAccuracy = .init(),
        f5Ml: MLBBetTypeAccuracy = .init(),
        f5Ou: MLBBetTypeAccuracy = .init(),
        perfectStorm: MLBBetTypeAccuracy = .init()
    ) {
        self.fullMl = fullMl
        self.fullOu = fullOu
        self.f5Ml = f5Ml
        self.f5Ou = f5Ou
        self.perfectStorm = perfectStorm
    }

    public func betType(_ key: String) -> MLBBetTypeAccuracy {
        switch key {
        case "full_ml": return fullMl
        case "full_ou": return fullOu
        case "f5_ml": return f5Ml
        case "f5_ou": return f5Ou
        case "perfect_storm": return perfectStorm
        default: return .init()
        }
    }
}

/// One bucket lookup result. Mirrors RN `BucketAccuracyResult`.
public struct MLBBucketLookup: Hashable, Sendable {
    public let winPct: Double
    public let roiPct: Double
    public let record: String

    public init(winPct: Double, roiPct: Double, record: String) {
        self.winPct = winPct
        self.roiPct = roiPct
        self.record = record
    }
}

// MARK: - Regression report payloads (mirrors RN)

public struct MLBPitcherRegression: Codable, Hashable, Sendable {
    public let pitcherName: String
    public let teamName: String
    public let opponent: String?
    public let starts: Int
    public let ip: Double
    public let era: Double
    public let xfip: Double
    public let xera: Double?
    public let fip: Double?
    public let whip: Double?
    public let eraMinusXfip: Double
    public let xwoba: Double?
    public let kPct: Double?
    public let bbPct: Double?
    public let hardHitPct: Double?
    public let barrelPct: Double?
    public let hrPer9: Double?
    public let l3Era: Double?
    public let l3Xfip: Double?
    public let l3Xera: Double?
    public let l3Xwoba: Double?
    public let l3Fip: Double?
    public let l3Whip: Double?
    public let trendEra: Double?
    public let trendXfip: Double?
    public let trendXera: Double?
    public let trendXwoba: Double?
    public let trendFip: Double?
    public let trendWhip: Double?
    public let severity: String
    public let severityScore: Double

    enum CodingKeys: String, CodingKey {
        case pitcherName = "pitcher_name"
        case teamName = "team_name"
        case opponent
        case starts
        case ip
        case era
        case xfip
        case xera
        case fip
        case whip
        case eraMinusXfip = "era_minus_xfip"
        case xwoba
        case kPct = "k_pct"
        case bbPct = "bb_pct"
        case hardHitPct = "hard_hit_pct"
        case barrelPct = "barrel_pct"
        case hrPer9 = "hr_per_9"
        case l3Era = "l3_era"
        case l3Xfip = "l3_xfip"
        case l3Xera = "l3_xera"
        case l3Xwoba = "l3_xwoba"
        case l3Fip = "l3_fip"
        case l3Whip = "l3_whip"
        case trendEra = "trend_era"
        case trendXfip = "trend_xfip"
        case trendXera = "trend_xera"
        case trendXwoba = "trend_xwoba"
        case trendFip = "trend_fip"
        case trendWhip = "trend_whip"
        case severity
        case severityScore = "severity_score"
    }
}

public struct MLBBattingRegression: Codable, Hashable, Sendable {
    public let teamName: String
    public let todayVsPitcher: String?
    public let games: Int
    public let battingAvg: Double?
    public let babip: Double
    public let xwobacon: Double?
    public let woba: Double?
    public let wobaGap: Double?
    public let hardHitPct: Double?
    public let barrelPct: Double?
    public let avgEv: Double?
    public let launchAngle: Double?
    public let slg: Double?
    public let obp: Double?
    public let kPct: Double?
    public let bbPct: Double?
    public let hr: Int
    public let hrPerGame: Double?
    public let l5Woba: Double?
    public let l5Xwobacon: Double?
    public let l5HardHitPct: Double?
    public let l5BarrelPct: Double?
    public let l5AvgEv: Double?
    public let l5BbPct: Double?
    public let trendWoba: Double?
    public let trendXwobacon: Double?
    public let trendHardHitPct: Double?
    public let trendBarrelPct: Double?
    public let trendAvgLaunchSpeed: Double?
    public let severity: String?
    public let severityScore: Double?

    enum CodingKeys: String, CodingKey {
        case teamName = "team_name"
        case todayVsPitcher = "today_vs_pitcher"
        case games
        case battingAvg = "batting_avg"
        case babip
        case xwobacon
        case woba
        case wobaGap = "woba_gap"
        case hardHitPct = "hard_hit_pct"
        case barrelPct = "barrel_pct"
        case avgEv = "avg_ev"
        case launchAngle = "launch_angle"
        case slg
        case obp
        case kPct = "k_pct"
        case bbPct = "bb_pct"
        case hr
        case hrPerGame = "hr_per_game"
        case l5Woba = "l5_woba"
        case l5Xwobacon = "l5_xwobacon"
        case l5HardHitPct = "l5_hard_hit_pct"
        case l5BarrelPct = "l5_barrel_pct"
        case l5AvgEv = "l5_avg_ev"
        case l5BbPct = "l5_bb_pct"
        case trendWoba = "trend_woba"
        case trendXwobacon = "trend_xwobacon"
        case trendHardHitPct = "trend_hard_hit_pct"
        case trendBarrelPct = "trend_barrel_pct"
        case trendAvgLaunchSpeed = "trend_avg_launch_speed"
        case severity
        case severityScore = "severity_score"
    }
}

public struct MLBBullpenFatigue: Codable, Hashable, Sendable {
    public let teamName: String
    public let bpIpLast3d: Double
    public let bpIpLast5d: Double
    public let bpIpLast7d: Double
    public let seasonBpXfip: Double?
    public let trendBpXfip: Double?
    public let seasonBpXera: Double?
    public let trendBpXera: Double?
    public let flag: String
    public let flags: [String]
    public let trending: String?

    enum CodingKeys: String, CodingKey {
        case teamName = "team_name"
        case bpIpLast3d = "bp_ip_last3d"
        case bpIpLast5d = "bp_ip_last5d"
        case bpIpLast7d = "bp_ip_last7d"
        case seasonBpXfip = "season_bp_xfip"
        case trendBpXfip = "trend_bp_xfip"
        case seasonBpXera = "season_bp_xera"
        case trendBpXera = "trend_bp_xera"
        case flag
        case flags
        case trending
    }
}

public struct MLBSuggestedPick: Codable, Hashable, Sendable, Identifiable {
    public var id: String { "\(gamePk)-\(betType)" }
    public let gamePk: Int
    public let betType: String // full_ml | full_ou | f5_ml | f5_ou
    public let pick: String
    public let matchup: String
    public let homeTeam: String
    public let awayTeam: String
    public let gameTimeEt: String?
    public let gameNumber: Int?
    public let modelProb: Double?
    public let fairValue: Double?
    public let edgeAtSuggestion: Double
    public let lineAtSuggestion: Double?
    public let edgeBucket: String
    public let bucketWinPct: Double
    public let bucketSample: Int
    public let confidenceAtSuggestion: String // "high" | "moderate"
    public let reasoning: String?
    public let homeSp: String?
    public let awaySp: String?
    public let firstSuggestedAt: String?
    public let locked: Bool?
    /// hammer | ps | lean | watch — drives the tier badge + accent color.
    public let perfectStormTier: String?
    public let isDoubleheader: Bool?

    enum CodingKeys: String, CodingKey {
        case gamePk = "game_pk"
        case betType = "bet_type"
        case pick
        case matchup
        case homeTeam = "home_team"
        case awayTeam = "away_team"
        case gameTimeEt = "game_time_et"
        case gameNumber = "game_number"
        case modelProb = "model_prob"
        case fairValue = "fair_value"
        case edgeAtSuggestion = "edge_at_suggestion"
        case lineAtSuggestion = "line_at_suggestion"
        case edgeBucket = "edge_bucket"
        case bucketWinPct = "bucket_win_pct"
        case bucketSample = "bucket_sample"
        case confidenceAtSuggestion = "confidence_at_suggestion"
        case reasoning
        case homeSp = "home_sp"
        case awaySp = "away_sp"
        case firstSuggestedAt = "first_suggested_at"
        case locked
        case perfectStormTier = "perfect_storm_tier"
        case isDoubleheader = "is_doubleheader"
    }
}

public struct MLBYesterdayRecap: Codable, Hashable, Sendable {
    public let gamePk: Int
    public let betType: String
    public let pick: String
    public let matchup: String
    public let result: String // "won" | "lost" | "push"
    public let actualScore: String
    public let confidence: String?
    public let edgeBucket: String?

    enum CodingKeys: String, CodingKey {
        case gamePk = "game_pk"
        case betType = "bet_type"
        case pick
        case matchup
        case result
        case actualScore = "actual_score"
        case confidence
        case edgeBucket = "edge_bucket"
    }
}

public struct MLBCumulativeBucket: Codable, Hashable, Sendable {
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let unitsWon: Double
    public let winPct: Double
    public let roiPct: Double

    enum CodingKeys: String, CodingKey {
        case wins
        case losses
        case pushes
        case unitsWon = "units_won"
        case winPct = "win_pct"
        case roiPct = "roi_pct"
    }
}

public struct MLBCumulativeDaily: Codable, Hashable, Sendable {
    public let date: String
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let unitsWon: Double?
    public let cumulativeWinPct: Double
    public let cumulativeUnits: Double?

    enum CodingKeys: String, CodingKey {
        case date
        case wins
        case losses
        case pushes
        case unitsWon = "units_won"
        case cumulativeWinPct = "cumulative_win_pct"
        case cumulativeUnits = "cumulative_units"
    }
}

public struct MLBCumulativeRecord: Codable, Hashable, Sendable {
    public let total: MLBCumulativeBucket
    public let byBetType: [String: MLBCumulativeBucket]?
    public let dailyLog: [MLBCumulativeDaily]?

    enum CodingKeys: String, CodingKey {
        case total
        case byBetType = "by_bet_type"
        case dailyLog = "daily_log"
    }
}

public struct MLBPerfectStorm: Codable, Hashable, Sendable {
    public let gamePk: Int
    public let matchup: String
    public let direction: String
    public let stormScore: Double
    public let pitcher: MLBPitcherRegression
    public let batting: MLBBattingRegression
    public let narrative: String

    enum CodingKeys: String, CodingKey {
        case gamePk = "game_pk"
        case matchup
        case direction
        case stormScore = "storm_score"
        case pitcher
        case batting
        case narrative
    }
}

public struct MLBWeatherParkFlag: Codable, Hashable, Sendable {
    public let gamePk: Int
    public let matchup: String
    public let venue: String
    public let temperatureF: Double?
    public let windSpeedMph: Double?
    public let windDirection: String?
    public let parkFactorRuns: Double?
    public let flags: [String]

    enum CodingKeys: String, CodingKey {
        case gamePk = "game_pk"
        case matchup
        case venue
        case temperatureF = "temperature_f"
        case windSpeedMph = "wind_speed_mph"
        case windDirection = "wind_direction"
        case parkFactorRuns = "park_factor_runs"
        case flags
    }
}

public struct MLBLRSplitEntry: Codable, Hashable, Sendable {
    public let teamName: String
    public let opponent: String
    public let opponentSp: String?
    public let opponentSpHand: String
    public let facing: String
    public let homeAway: String
    public let f5Games: Int
    public let avgF5Runs: Double
    public let f5Wins: Int
    public let f5Losses: Int
    public let f5Ties: Int
    public let f5WinPct: Double?
    public let isNotable: Bool

    enum CodingKeys: String, CodingKey {
        case teamName = "team_name"
        case opponent
        case opponentSp = "opponent_sp"
        case opponentSpHand = "opponent_sp_hand"
        case facing
        case homeAway = "home_away"
        case f5Games = "f5_games"
        case avgF5Runs = "avg_f5_runs"
        case f5Wins = "f5_wins"
        case f5Losses = "f5_losses"
        case f5Ties = "f5_ties"
        case f5WinPct = "f5_win_pct"
        case isNotable = "is_notable"
    }
}

/// Full daily regression report row. Mirrors RN `MLBRegressionReport`.
public struct MLBRegressionReport: Codable, Hashable, Sendable {
    public let reportDate: String
    public let season: Int?
    public let pitcherNegativeRegression: [MLBPitcherRegression]?
    public let pitcherPositiveRegression: [MLBPitcherRegression]?
    public let battingHeatUp: [MLBBattingRegression]?
    public let battingCoolDown: [MLBBattingRegression]?
    public let bullpenFatigue: [MLBBullpenFatigue]?
    public let perfectStormMatchups: [MLBPerfectStorm]?
    public let suggestedPicks: [MLBSuggestedPick]?
    public let yesterdayRecap: [MLBYesterdayRecap]?
    public let cumulativeRecord: MLBCumulativeRecord?
    public let weatherParkFlags: [MLBWeatherParkFlag]?
    public let lrSplitsToday: [MLBLRSplitEntry]?
    public let narrativeText: String?
    public let narrativeModel: String?
    public let generatedAt: String?
    public let generationVersion: Int?

    enum CodingKeys: String, CodingKey {
        case reportDate = "report_date"
        case season
        case pitcherNegativeRegression = "pitcher_negative_regression"
        case pitcherPositiveRegression = "pitcher_positive_regression"
        case battingHeatUp = "batting_heat_up"
        case battingCoolDown = "batting_cool_down"
        case bullpenFatigue = "bullpen_fatigue"
        case perfectStormMatchups = "perfect_storm_matchups"
        case suggestedPicks = "suggested_picks"
        case yesterdayRecap = "yesterday_recap"
        case cumulativeRecord = "cumulative_record"
        case weatherParkFlags = "weather_park_flags"
        case lrSplitsToday = "lr_splits_today"
        case narrativeText = "narrative_text"
        case narrativeModel = "narrative_model"
        case generatedAt = "generated_at"
        case generationVersion = "generation_version"
    }
}
