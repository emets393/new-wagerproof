import Foundation

// Models behind the regression report's RN-parity sections (model breakdown
// by team/day-of-week, Perfect Storm tier records, series-position signals,
// and the per-pick alignment engine). Mirrors:
//   wagerproof-mobile/hooks/useMLBModelBreakdownAccuracy.ts
//   wagerproof-mobile/hooks/useMLBPerfectStormRecords.ts
//   wagerproof-mobile/hooks/useMLBSeriesSignals.ts
//   wagerproof-mobile/utils/mlbPickAlignment.ts

// MARK: - Model breakdown (mlb_model_breakdown_accuracy)

public struct MLBModelBreakdownRow: Codable, Hashable, Sendable {
    public let betType: String       // full_ml | full_ou | f5_ml | f5_ou
    public let breakdownType: String // "team" | "dow"
    public let breakdownValue: String
    public let games: Int
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let unitsWon: Double
    public let winPct: Double
    public let roiPct: Double

    enum CodingKeys: String, CodingKey {
        case betType = "bet_type"
        case breakdownType = "breakdown_type"
        case breakdownValue = "breakdown_value"
        case games, wins, losses, pushes
        case unitsWon = "units_won"
        case winPct = "win_pct"
        case roiPct = "roi_pct"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        betType = try c.decode(String.self, forKey: .betType)
        breakdownType = try c.decode(String.self, forKey: .breakdownType)
        breakdownValue = try c.decode(String.self, forKey: .breakdownValue)
        games = try c.decodeIfPresent(Int.self, forKey: .games) ?? 0
        wins = try c.decodeIfPresent(Int.self, forKey: .wins) ?? 0
        losses = try c.decodeIfPresent(Int.self, forKey: .losses) ?? 0
        pushes = try c.decodeIfPresent(Int.self, forKey: .pushes) ?? 0
        // PostgREST numeric columns can drift between number and string.
        unitsWon = MLBRegressionInsightsDecode.flexDouble(c, .unitsWon) ?? 0
        winPct = MLBRegressionInsightsDecode.flexDouble(c, .winPct) ?? 0
        roiPct = MLBRegressionInsightsDecode.flexDouble(c, .roiPct) ?? 0
    }

    public init(
        betType: String, breakdownType: String, breakdownValue: String,
        games: Int, wins: Int, losses: Int, pushes: Int,
        unitsWon: Double, winPct: Double, roiPct: Double
    ) {
        self.betType = betType
        self.breakdownType = breakdownType
        self.breakdownValue = breakdownValue
        self.games = games
        self.wins = wins
        self.losses = losses
        self.pushes = pushes
        self.unitsWon = unitsWon
        self.winPct = winPct
        self.roiPct = roiPct
    }
}

enum MLBRegressionInsightsDecode {
    static func flexDouble<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Double? {
        if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
        if let s = try? c.decodeIfPresent(String.self, forKey: key) { return Double(s) }
        return nil
    }
}

// MARK: - Perfect Storm tier records (mlb_graded_picks aggregation)

public enum MLBPerfectStormTier: String, CaseIterable, Sendable {
    case hammer, ps, lean, watch
}

public struct MLBPerfectStormRecord: Hashable, Sendable {
    public let tier: MLBPerfectStormTier
    public var picks: Int
    public var wins: Int
    public var losses: Int
    public var pushes: Int
    public var winPct: Double?
    public var units: Double
    public var roiPct: Double?

    public init(tier: MLBPerfectStormTier) {
        self.tier = tier
        self.picks = 0
        self.wins = 0
        self.losses = 0
        self.pushes = 0
        self.winPct = nil
        self.units = 0
        self.roiPct = nil
    }

    public var recordString: String {
        pushes > 0 ? "\(wins)-\(losses)-\(pushes)" : "\(wins)-\(losses)"
    }
}

public struct MLBPerfectStormRecords: Hashable, Sendable {
    public var hammer: MLBPerfectStormRecord
    public var ps: MLBPerfectStormRecord
    public var lean: MLBPerfectStormRecord
    public var watch: MLBPerfectStormRecord

    public init() {
        hammer = MLBPerfectStormRecord(tier: .hammer)
        ps = MLBPerfectStormRecord(tier: .ps)
        lean = MLBPerfectStormRecord(tier: .lean)
        watch = MLBPerfectStormRecord(tier: .watch)
    }

    public func record(for tier: MLBPerfectStormTier) -> MLBPerfectStormRecord {
        switch tier {
        case .hammer: return hammer
        case .ps: return ps
        case .lean: return lean
        case .watch: return watch
        }
    }

    /// Combined record across all 4 tiers — drives the recap "ALL-TIME"
    /// hero (RN deliberately ignores report.cumulative_record here).
    public var combined: (wins: Int, losses: Int, pushes: Int, units: Double, roiPct: Double) {
        var w = 0, l = 0, p = 0
        var u = 0.0
        for tier in MLBPerfectStormTier.allCases {
            let r = record(for: tier)
            w += r.wins; l += r.losses; p += r.pushes; u += r.units
        }
        let graded = w + l
        let roi = graded > 0 ? (100 * u / Double(graded) * 10).rounded() / 10 : 0
        return (w, l, p, u, roi)
    }
}

// MARK: - Series-position signals (mlb_game_signals, category == "series")

public struct MLBSeriesSignal: Hashable, Sendable, Identifiable {
    public var id: String { "\(gamePk)-\(teamSide)-\(message.hashValue)" }
    public let gamePk: Int
    public let matchup: String
    public let teamName: String
    public let teamSide: String   // "home" | "away"
    public let severity: String   // "positive" | "negative"
    public let message: String

    public init(gamePk: Int, matchup: String, teamName: String, teamSide: String, severity: String, message: String) {
        self.gamePk = gamePk
        self.matchup = matchup
        self.teamName = teamName
        self.teamSide = teamSide
        self.severity = severity
        self.message = message
    }

    public var isPositive: Bool { severity == "positive" }
}

// MARK: - Per-pick model alignment (port of utils/mlbPickAlignment.ts)

public enum MLBPickAlignmentLevel: String, Sendable {
    case strong, aligned, neutral, mixed, concern
}

public struct MLBPickAlignmentResult: Sendable {
    public let level: MLBPickAlignmentLevel
    public let dow: MLBModelBreakdownRow?
    /// ML/spread: 1 entry (the pick's subject team). O/U: up to 2 (both teams).
    public let teams: [MLBModelBreakdownRow]
    public let dowLabel: String?
}

public enum MLBPickAlignment {
    /// Full team name → game_log abbr (mlb_game_log uses AZ/ATH for ARI/OAK).
    /// Copied verbatim from RN's NAME_TO_ABBR.
    public static let nameToAbbr: [String: String] = [
        "arizona diamondbacks": "AZ",
        "atlanta braves": "ATL",
        "baltimore orioles": "BAL",
        "boston red sox": "BOS",
        "chicago cubs": "CHC",
        "chicago white sox": "CWS",
        "cincinnati reds": "CIN",
        "cleveland guardians": "CLE",
        "colorado rockies": "COL",
        "detroit tigers": "DET",
        "houston astros": "HOU",
        "kansas city royals": "KC",
        "los angeles angels": "LAA",
        "los angeles dodgers": "LAD",
        "miami marlins": "MIA",
        "milwaukee brewers": "MIL",
        "minnesota twins": "MIN",
        "new york mets": "NYM",
        "new york yankees": "NYY",
        "oakland athletics": "ATH",
        "las vegas athletics": "ATH",
        "athletics": "ATH",
        "philadelphia phillies": "PHI",
        "pittsburgh pirates": "PIT",
        "san diego padres": "SD",
        "san francisco giants": "SF",
        "seattle mariners": "SEA",
        "st louis cardinals": "STL",
        "tampa bay rays": "TB",
        "texas rangers": "TEX",
        "toronto blue jays": "TOR",
        "washington nationals": "WSH",
    ]

    public static func teamNameToGameLogAbbr(_ name: String?) -> String? {
        guard let name, !name.isEmpty else { return nil }
        let key = name.lowercased()
            .replacingOccurrences(of: ".", with: "")
            .trimmingCharacters(in: .whitespaces)
        return nameToAbbr[key]
    }

    /// Sun..Sat label in ET. Date-only strings anchor to noon so they never
    /// flip a day across the UTC boundary (same hack as RN).
    public static func dowLabel(for raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let et = TimeZone(identifier: "America/New_York")!
        var date: Date?
        if raw.count == 10 {
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "en_US_POSIX")
            fmt.timeZone = et
            fmt.dateFormat = "yyyy-MM-dd"
            date = fmt.date(from: raw).map { $0.addingTimeInterval(12 * 3600) }
        } else {
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            date = iso.date(from: raw)
            if date == nil {
                iso.formatOptions = [.withInternetDateTime]
                date = iso.date(from: raw)
            }
        }
        guard let date else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = et
        let labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return labels[cal.component(.weekday, from: date) - 1]
    }

    static func pickSubjectTeamAbbr(pick: String, homeTeam: String?, awayTeam: String?) -> String? {
        let lower = pick.lowercased()
        // Last word of the team name (e.g. "yankees") — away checked first.
        let awayKey = awayTeam?.lowercased().split(separator: " ").last.map(String.init)
        let homeKey = homeTeam?.lowercased().split(separator: " ").last.map(String.init)
        if let awayKey, lower.contains(awayKey) { return teamNameToGameLogAbbr(awayTeam) }
        if let homeKey, lower.contains(homeKey) { return teamNameToGameLogAbbr(homeTeam) }
        if let awayTeam, lower.contains(awayTeam.lowercased()) { return teamNameToGameLogAbbr(awayTeam) }
        if let homeTeam, lower.contains(homeTeam.lowercased()) { return teamNameToGameLogAbbr(homeTeam) }
        return nil
    }

    public static func compute(
        betType: String,
        pick: String,
        homeTeam: String?,
        awayTeam: String?,
        gameTimeEt: String?,
        rows: [MLBModelBreakdownRow]
    ) -> MLBPickAlignmentResult {
        let dowLabel = Self.dowLabel(for: gameTimeEt)
        let dow = dowLabel.flatMap { label in
            rows.first { $0.betType == betType && $0.breakdownType == "dow" && $0.breakdownValue == label }
        }

        func findTeam(_ abbr: String?) -> MLBModelBreakdownRow? {
            guard let abbr else { return nil }
            return rows.first { $0.betType == betType && $0.breakdownType == "team" && $0.breakdownValue == abbr }
        }

        var teams: [MLBModelBreakdownRow] = []
        if betType == "full_ou" || betType == "f5_ou" {
            if let away = findTeam(teamNameToGameLogAbbr(awayTeam)) { teams.append(away) }
            if let home = findTeam(teamNameToGameLogAbbr(homeTeam)) { teams.append(home) }
        } else if let subj = findTeam(pickSubjectTeamAbbr(pick: pick, homeTeam: homeTeam, awayTeam: awayTeam)) {
            teams.append(subj)
        }

        // "Bad" includes meaningful negative ROI (<= -5%) even in the 45-55%
        // win zone — a team at 46% with -12% ROI is losing money, not neutral.
        func isOk(_ w: Double, _ r: Double) -> Bool { w >= 55 && r > 0 }
        func isBad(_ w: Double, _ r: Double) -> Bool { w < 45 || r <= -5 }
        let dowOk = dow.map { isOk($0.winPct, $0.roiPct) } ?? false
        let dowBad = dow.map { isBad($0.winPct, $0.roiPct) } ?? false
        let teamsAllOk = !teams.isEmpty && teams.allSatisfy { isOk($0.winPct, $0.roiPct) }
        let teamsAllBad = !teams.isEmpty && teams.allSatisfy { isBad($0.winPct, $0.roiPct) }
        let teamsAnyBad = !teams.isEmpty && teams.contains { isBad($0.winPct, $0.roiPct) }

        let level: MLBPickAlignmentLevel
        if dowOk && teamsAllOk { level = .strong }
        else if (dowOk && !teamsAnyBad) || (teamsAllOk && !dowBad) { level = .aligned }
        else if dowBad && teamsAllBad { level = .concern }
        else if dowBad || teamsAnyBad { level = .mixed }
        else { level = .neutral }

        return MLBPickAlignmentResult(level: level, dow: dow, teams: teams, dowLabel: dowLabel)
    }
}

// MARK: - ESPN logo URL from game_log abbr (port of utils/mlbAbbrLogo.ts)

public enum MLBAbbrLogo {
    static let espnSlugByAbbr: [String: String] = [
        "az": "ari",  // mlb_game_log uses AZ; ESPN expects ari
        "ari": "ari",
        "ath": "ath", // Athletics
        "oak": "ath",
        "lva": "ath",
        "kan": "kc",
        "kc": "kc",
        "tam": "tb",
        "tb": "tb",
        "st.": "stl",
        "st": "stl",
        "stl": "stl",
        "sd": "sd",
    ]

    public static func url(forAbbr abbr: String?) -> String? {
        guard let raw = abbr?.trimmingCharacters(in: .whitespaces).lowercased(), !raw.isEmpty else { return nil }
        let slug = espnSlugByAbbr[raw] ?? raw
        return "https://a.espncdn.com/i/teamlogos/mlb/500/\(slug).png"
    }
}
