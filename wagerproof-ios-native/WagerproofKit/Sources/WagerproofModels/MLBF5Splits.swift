import Foundation

/// MLB First-Five (F5) Splits models + helpers. 1:1 port of RN
/// `types/mlbF5Splits.ts` + `utils/mlbF5Splits.ts`.
///
/// The away team is judged by its AWAY games versus tonight's opposing
/// starter hand; the home team by its HOME games versus tonight's opposing
/// starter hand. Splits come from the `mv_mlb_f5_team_splits` materialized
/// view, keyed `teamAbbr|home|away|R|L`.

public enum MLBF5PitchHand: String, Sendable, Hashable {
    case right = "R"
    case left = "L"
}

/// One row from `mv_mlb_f5_team_splits`. Mirrors RN `F5SplitRow`. Numeric
/// columns decode flexibly (PostgREST may hand back numbers or strings).
public struct MLBF5SplitRow: Decodable, Hashable, Sendable {
    public let teamAbbr: String
    public let season: Int
    public let homeAway: String          // "home" | "away"
    public let oppSpHand: String         // "R" | "L"
    public let games: Int
    public let f5Wins: Int
    public let f5Losses: Int
    public let f5Ties: Int
    public let f5Record: String
    public let f5WinPct: Double?
    public let f5Overs: Int
    public let f5Unders: Int
    public let f5Pushes: Int
    public let f5OuRecord: String
    public let f5OverPct: Double?
    public let avgF5Rs: Double?
    public let avgF5Total: Double?
    public let avgF5Line: Double?
    public let f5LineEdge: Double?
    public let avgF5RaWhenOwnRhp: Double?
    public let gamesWithOwnRhp: Int
    public let avgF5RaWhenOwnLhp: Double?
    public let gamesWithOwnLhp: Int
    public let seasonAvgF5Rs: Double?
    public let seasonAvgF5Ra: Double?
    public let seasonAvgF5Total: Double?
    public let rsDiffVsSeason: Double?
    public let totalDiffVsSeason: Double?
    public let raDiffVsSeasonWhenOwnRhp: Double?
    public let raDiffVsSeasonWhenOwnLhp: Double?
    public let lastRefreshedAt: String?

    enum CodingKeys: String, CodingKey {
        case teamAbbr = "team_abbr"
        case season
        case homeAway = "home_away"
        case oppSpHand = "opp_sp_hand"
        case games
        case f5Wins = "f5_wins"
        case f5Losses = "f5_losses"
        case f5Ties = "f5_ties"
        case f5Record = "f5_record"
        case f5WinPct = "f5_win_pct"
        case f5Overs = "f5_overs"
        case f5Unders = "f5_unders"
        case f5Pushes = "f5_pushes"
        case f5OuRecord = "f5_ou_record"
        case f5OverPct = "f5_over_pct"
        case avgF5Rs = "avg_f5_rs"
        case avgF5Total = "avg_f5_total"
        case avgF5Line = "avg_f5_line"
        case f5LineEdge = "f5_line_edge"
        case avgF5RaWhenOwnRhp = "avg_f5_ra_when_own_rhp"
        case gamesWithOwnRhp = "games_with_own_rhp"
        case avgF5RaWhenOwnLhp = "avg_f5_ra_when_own_lhp"
        case gamesWithOwnLhp = "games_with_own_lhp"
        case seasonAvgF5Rs = "season_avg_f5_rs"
        case seasonAvgF5Ra = "season_avg_f5_ra"
        case seasonAvgF5Total = "season_avg_f5_total"
        case rsDiffVsSeason = "rs_diff_vs_season"
        case totalDiffVsSeason = "total_diff_vs_season"
        case raDiffVsSeasonWhenOwnRhp = "ra_diff_vs_season_when_own_rhp"
        case raDiffVsSeasonWhenOwnLhp = "ra_diff_vs_season_when_own_lhp"
        case lastRefreshedAt = "last_refreshed_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        teamAbbr = c.f5FlexString(.teamAbbr) ?? ""
        season = c.f5FlexInt(.season) ?? 0
        homeAway = c.f5FlexString(.homeAway) ?? ""
        oppSpHand = c.f5FlexString(.oppSpHand) ?? ""
        games = c.f5FlexInt(.games) ?? 0
        f5Wins = c.f5FlexInt(.f5Wins) ?? 0
        f5Losses = c.f5FlexInt(.f5Losses) ?? 0
        f5Ties = c.f5FlexInt(.f5Ties) ?? 0
        f5Record = c.f5FlexString(.f5Record) ?? "-"
        f5WinPct = c.f5FlexDouble(.f5WinPct)
        f5Overs = c.f5FlexInt(.f5Overs) ?? 0
        f5Unders = c.f5FlexInt(.f5Unders) ?? 0
        f5Pushes = c.f5FlexInt(.f5Pushes) ?? 0
        f5OuRecord = c.f5FlexString(.f5OuRecord) ?? "-"
        f5OverPct = c.f5FlexDouble(.f5OverPct)
        avgF5Rs = c.f5FlexDouble(.avgF5Rs)
        avgF5Total = c.f5FlexDouble(.avgF5Total)
        avgF5Line = c.f5FlexDouble(.avgF5Line)
        f5LineEdge = c.f5FlexDouble(.f5LineEdge)
        avgF5RaWhenOwnRhp = c.f5FlexDouble(.avgF5RaWhenOwnRhp)
        gamesWithOwnRhp = c.f5FlexInt(.gamesWithOwnRhp) ?? 0
        avgF5RaWhenOwnLhp = c.f5FlexDouble(.avgF5RaWhenOwnLhp)
        gamesWithOwnLhp = c.f5FlexInt(.gamesWithOwnLhp) ?? 0
        seasonAvgF5Rs = c.f5FlexDouble(.seasonAvgF5Rs)
        seasonAvgF5Ra = c.f5FlexDouble(.seasonAvgF5Ra)
        seasonAvgF5Total = c.f5FlexDouble(.seasonAvgF5Total)
        rsDiffVsSeason = c.f5FlexDouble(.rsDiffVsSeason)
        totalDiffVsSeason = c.f5FlexDouble(.totalDiffVsSeason)
        raDiffVsSeasonWhenOwnRhp = c.f5FlexDouble(.raDiffVsSeasonWhenOwnRhp)
        raDiffVsSeasonWhenOwnLhp = c.f5FlexDouble(.raDiffVsSeasonWhenOwnLhp)
        lastRefreshedAt = c.f5FlexString(.lastRefreshedAt)
    }
}

/// One game on the F5 slate, built in the store from `mlb_games_today` rows.
/// Mirrors RN `F5Game`.
public struct MLBF5Game: Identifiable, Hashable, Sendable {
    public var id: Int { gamePk }
    public let gamePk: Int
    public let officialDate: String
    public let gameTimeEt: String?
    public let awayTeamName: String
    public let homeTeamName: String
    public let venueName: String?
    public let awayAbbr: String
    public let homeAbbr: String
    public let awaySpName: String?
    public let homeSpName: String?
    public let awaySpHand: MLBF5PitchHand?
    public let homeSpHand: MLBF5PitchHand?
    public let totalLine: Double?
    public let f5AwayMl: Double?
    public let f5HomeMl: Double?
    public let f5TotalLine: Double?

    public init(
        gamePk: Int,
        officialDate: String,
        gameTimeEt: String?,
        awayTeamName: String,
        homeTeamName: String,
        venueName: String?,
        awayAbbr: String,
        homeAbbr: String,
        awaySpName: String?,
        homeSpName: String?,
        awaySpHand: MLBF5PitchHand?,
        homeSpHand: MLBF5PitchHand?,
        totalLine: Double?,
        f5AwayMl: Double?,
        f5HomeMl: Double?,
        f5TotalLine: Double?
    ) {
        self.gamePk = gamePk
        self.officialDate = officialDate
        self.gameTimeEt = gameTimeEt
        self.awayTeamName = awayTeamName
        self.homeTeamName = homeTeamName
        self.venueName = venueName
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.awaySpName = awaySpName
        self.homeSpName = homeSpName
        self.awaySpHand = awaySpHand
        self.homeSpHand = homeSpHand
        self.totalLine = totalLine
        self.f5AwayMl = f5AwayMl
        self.f5HomeMl = f5HomeMl
        self.f5TotalLine = f5TotalLine
    }
}

/// Pure helpers — port of `utils/mlbF5Splits.ts`.
public enum MLBF5 {
    public enum Sample {
        public static let hide = 2
        public static let small = 10
        public static let adequate = 20
    }

    /// The MV is keyed by the relocated abbreviations (`AZ`, `ATH`).
    public static func toSplitTeamAbbr(_ abbr: String?) -> String {
        let a = (abbr ?? "").trimmingCharacters(in: .whitespaces).uppercased()
        if a == "ARI" { return "AZ" }
        if a == "OAK" || a == "LVA" { return "ATH" }
        return a
    }

    public static func normalizePitchHand(_ raw: String?) -> MLBF5PitchHand? {
        guard let raw, !raw.isEmpty else { return nil }
        let h = raw.trimmingCharacters(in: .whitespaces).uppercased()
        if h.hasPrefix("R") { return .right }
        if h.hasPrefix("L") { return .left }
        return nil
    }

    public static func splitLookupKey(teamAbbr: String, homeAway: String, oppSpHand: MLBF5PitchHand?) -> String? {
        guard let oppSpHand else { return nil }
        return "\(toSplitTeamAbbr(teamAbbr))|\(homeAway)|\(oppSpHand.rawValue)"
    }

    public static func buildSplitLookup(_ rows: [MLBF5SplitRow]) -> [String: MLBF5SplitRow] {
        var map: [String: MLBF5SplitRow] = [:]
        for row in rows {
            let hand = MLBF5PitchHand(rawValue: row.oppSpHand.uppercased())
            if let key = splitLookupKey(teamAbbr: row.teamAbbr, homeAway: row.homeAway, oppSpHand: hand) {
                map[key] = row
            }
        }
        return map
    }

    public static func findSplitRow(_ lookup: [String: MLBF5SplitRow], teamAbbr: String, homeAway: String, oppSpHand: MLBF5PitchHand?) -> MLBF5SplitRow? {
        guard let key = splitLookupKey(teamAbbr: teamAbbr, homeAway: homeAway, oppSpHand: oppSpHand) else { return nil }
        return lookup[key]
    }

    public static func isShowable(_ games: Int?) -> Bool { (games ?? 0) >= Sample.hide }

    public static func pitchHandLabel(_ hand: MLBF5PitchHand?) -> String {
        switch hand {
        case .right: return "RHP"
        case .left: return "LHP"
        case nil: return "unknown hand"
        }
    }

    public static func formatMoneyline(_ ml: Double?) -> String {
        guard let ml, ml.isFinite else { return "-" }
        let i = Int(ml.rounded())
        return i > 0 ? "+\(i)" : "\(i)"
    }

    public static func formatPct(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "-" }
        var s = String(format: "%.1f", value)
        if s.hasSuffix(".0") { s = String(s.dropLast(2)) }
        return "\(s)%"
    }

    public static func formatNumber(_ value: Double?, digits: Int = 2) -> String {
        guard let value, value.isFinite else { return "-" }
        return String(format: "%.\(digits)f", value)
    }

    public static func formatDiff(_ value: Double?, digits: Int = 2) -> String {
        guard let value, value.isFinite else { return "-" }
        let body = String(format: "%.\(digits)f", value)
        return value > 0 ? "+\(body)" : body
    }

    public static func recordWithPct(_ row: MLBF5SplitRow?) -> String {
        guard let row else { return "-" }
        return "\(row.f5Record) (\(formatPct(row.f5WinPct)))"
    }
}

// MARK: - Flexible decode helpers (file-local to avoid collisions)

fileprivate extension KeyedDecodingContainer {
    func f5FlexInt(_ key: Key) -> Int? {
        if let i = try? decode(Int.self, forKey: key) { return i }
        if let d = try? decode(Double.self, forKey: key) { return Int(d) }
        if let s = try? decode(String.self, forKey: key) {
            if let i = Int(s) { return i }
            if let d = Double(s) { return Int(d) }
        }
        return nil
    }

    func f5FlexDouble(_ key: Key) -> Double? {
        if let d = try? decode(Double.self, forKey: key) { return d }
        if let i = try? decode(Int.self, forKey: key) { return Double(i) }
        if let s = try? decode(String.self, forKey: key) {
            return Double(s.replacingOccurrences(of: "%", with: "").trimmingCharacters(in: .whitespaces))
        }
        return nil
    }

    func f5FlexString(_ key: Key) -> String? {
        if let s = try? decode(String.self, forKey: key) { return s }
        if let i = try? decode(Int.self, forKey: key) { return String(i) }
        if let d = try? decode(Double.self, forKey: key) { return String(d) }
        return nil
    }
}
