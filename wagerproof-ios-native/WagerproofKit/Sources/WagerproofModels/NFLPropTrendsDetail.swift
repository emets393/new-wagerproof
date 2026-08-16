import Foundation

// MARK: - `nfl_player_prop_trends` row (detail-page columns)
//
// The Outliers feature reads this table's `splits`/`matchups` columns through
// its own decoder; this model is the player-analysis contract, adding
// `recent_game_log` and the `nfl_player_game_logs` actuals enrichment ported
// from `src/features/propBreakdown/hooks.ts`.

/// One entry of `recent_game_log`, newest-first as stored.
public struct NFLPropTrendGame: Hashable, Sendable {
    public let season: Int
    public let week: Int
    public let opp: String
    public let isHome: Bool?
    public let isDiv: Bool?
    public let isPrimetime: Bool?
    /// Served grade letters per market: O/U/P (over/under/push) or Y/N (ATD).
    /// Decoded for tooltips; the Last-10 chart grades vs TODAY's line instead.
    public let markets: [String: String]
    /// Actual stat totals keyed by market — merged from `nfl_player_game_logs`.
    public var actuals: [String: Double]
    /// Historical closing line used to grade each result (unused for bar color).
    public let lines: [String: Double]

    public init(
        season: Int, week: Int, opp: String,
        isHome: Bool? = nil, isDiv: Bool? = nil, isPrimetime: Bool? = nil,
        markets: [String: String] = [:],
        actuals: [String: Double] = [:],
        lines: [String: Double] = [:]
    ) {
        self.season = season
        self.week = week
        self.opp = opp
        self.isHome = isHome
        self.isDiv = isDiv
        self.isPrimetime = isPrimetime
        self.markets = markets
        self.actuals = actuals
        self.lines = lines
    }
}

/// Career H2H record vs one opponent: meeting count + per-market hit rates.
public struct NFLPropTrendMatchup: Hashable, Sendable {
    public let meetings: Int
    public let byMarket: [String: NFLPropHitRate]

    public init(meetings: Int, byMarket: [String: NFLPropHitRate]) {
        self.meetings = meetings
        self.byMarket = byMarket
    }
}

/// One situational record: `n = h + l` (pushes excluded from n).
public struct NFLPropSituationRecord: Hashable, Sendable {
    public let h: Int
    public let n: Int
    public let pct: Double

    public init(h: Int, n: Int, pct: Double) {
        self.h = h
        self.n = n
        self.pct = pct
    }
}

public struct NFLPropTrendsDetail: Decodable, Hashable, Sendable {
    public let playerId: String
    /// Newest-first, ≤10 entries.
    public var recentGameLog: [NFLPropTrendGame]
    /// Opponent abbreviation → career matchup record.
    public let matchups: [String: NFLPropTrendMatchup]
    /// marketKey → bucket (overall/home/away/division/non_division/primetime/regular)
    /// → window ("3"/"5"/"7") → record.
    public let splits: [String: [String: [String: NFLPropSituationRecord]]]

    enum CodingKeys: String, CodingKey {
        case playerId = "player_id"
        case recentGameLog = "recent_game_log"
        case matchups, splits
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        playerId = try c.decode(String.self, forKey: .playerId)
        recentGameLog = Self.mapGameLog((try? c.decodeIfPresent(JSONValue.self, forKey: .recentGameLog)) ?? nil)
        matchups = Self.mapMatchups((try? c.decodeIfPresent(JSONValue.self, forKey: .matchups)) ?? nil)
        splits = Self.mapSplits((try? c.decodeIfPresent(JSONValue.self, forKey: .splits)) ?? nil)
    }

    public init(
        playerId: String,
        recentGameLog: [NFLPropTrendGame] = [],
        matchups: [String: NFLPropTrendMatchup] = [:],
        splits: [String: [String: [String: NFLPropSituationRecord]]] = [:]
    ) {
        self.playerId = playerId
        self.recentGameLog = recentGameLog
        self.matchups = matchups
        self.splits = splits
    }

    /// The window record the UI shows for one bucket: 5-game, else 7, else 3
    /// (mirrors the web's `windows['5'] ?? windows['7'] ?? windows['3']`).
    public static func preferredWindow(_ windows: [String: NFLPropSituationRecord]) -> NFLPropSituationRecord? {
        windows["5"] ?? windows["7"] ?? windows["3"]
    }

    // MARK: JSONB mapping (exposed for decode-fixture tests)

    public static func mapGameLog(_ json: JSONValue?) -> [NFLPropTrendGame] {
        guard let items = json?.arrayValue else { return [] }
        return items.compactMap { item in
            guard let o = item.objectValue,
                  let season = o["season"]?.intValue,
                  let week = o["week"]?.intValue else { return nil }
            return NFLPropTrendGame(
                season: season,
                week: week,
                opp: o["opp"]?.stringValue ?? "",
                isHome: o["is_home"]?.boolValue,
                isDiv: o["is_div"]?.boolValue,
                isPrimetime: o["is_primetime"]?.boolValue,
                markets: mapStringDict(o["markets"]),
                actuals: mapDoubleDict(o["actuals"]),
                lines: mapDoubleDict(o["lines"])
            )
        }
    }

    public static func mapMatchups(_ json: JSONValue?) -> [String: NFLPropTrendMatchup] {
        guard let byOpp = json?.objectValue else { return [:] }
        var out: [String: NFLPropTrendMatchup] = [:]
        for (opp, raw) in byOpp {
            guard let o = raw.objectValue, let meetings = o["meetings"]?.intValue else { continue }
            var byMarket: [String: NFLPropHitRate] = [:]
            for (key, value) in o where key != "meetings" {
                if let rec = NFLPropPlayerPage.mapHitRate(value) { byMarket[key] = rec }
            }
            out[opp] = NFLPropTrendMatchup(meetings: meetings, byMarket: byMarket)
        }
        return out
    }

    public static func mapSplits(_ json: JSONValue?) -> [String: [String: [String: NFLPropSituationRecord]]] {
        guard let byMarket = json?.objectValue else { return [:] }
        var out: [String: [String: [String: NFLPropSituationRecord]]] = [:]
        for (market, rawBuckets) in byMarket {
            guard let byBucket = rawBuckets.objectValue else { continue }
            var buckets: [String: [String: NFLPropSituationRecord]] = [:]
            for (bucket, rawWindows) in byBucket {
                guard let byWindow = rawWindows.objectValue else { continue }
                var windows: [String: NFLPropSituationRecord] = [:]
                for (window, rec) in byWindow {
                    guard let o = rec.objectValue,
                          let h = o["h"]?.intValue,
                          let n = o["n"]?.intValue,
                          let pct = o["pct"]?.doubleValue else { continue }
                    windows[window] = NFLPropSituationRecord(h: h, n: n, pct: pct)
                }
                if !windows.isEmpty { buckets[bucket] = windows }
            }
            if !buckets.isEmpty { out[market] = buckets }
        }
        return out
    }

    private static func mapStringDict(_ json: JSONValue?) -> [String: String] {
        guard let o = json?.objectValue else { return [:] }
        return o.compactMapValues(\.stringValue)
    }

    private static func mapDoubleDict(_ json: JSONValue?) -> [String: Double] {
        guard let o = json?.objectValue else { return [:] }
        return o.compactMapValues(\.doubleValue)
    }
}

// MARK: - `nfl_player_game_logs` enrichment

/// One row of `nfl_player_game_logs` — real stat totals per (player, season, week).
public struct NFLPlayerGameLogRow: Decodable, Hashable, Sendable {
    public let playerId: String
    public let season: Int
    public let week: Int
    public let passYds: Double?
    public let passTds: Double?
    public let rushYds: Double?
    public let rushTds: Double?
    public let recYds: Double?
    public let recTds: Double?
    public let receptions: Double?
    public let passAttempts: Double?
    public let carries: Double?
    public let completions: Double?

    enum CodingKeys: String, CodingKey {
        case playerId = "player_id"
        case season, week
        case passYds = "pass_yds"
        case passTds = "pass_tds"
        case rushYds = "rush_yds"
        case rushTds = "rush_tds"
        case recYds = "rec_yds"
        case recTds = "rec_tds"
        case receptions
        case passAttempts = "pass_attempts"
        case carries, completions
    }

    public init(
        playerId: String, season: Int, week: Int,
        passYds: Double? = nil, passTds: Double? = nil,
        rushYds: Double? = nil, rushTds: Double? = nil,
        recYds: Double? = nil, recTds: Double? = nil,
        receptions: Double? = nil, passAttempts: Double? = nil,
        carries: Double? = nil, completions: Double? = nil
    ) {
        self.playerId = playerId
        self.season = season
        self.week = week
        self.passYds = passYds
        self.passTds = passTds
        self.rushYds = rushYds
        self.rushTds = rushTds
        self.recYds = recYds
        self.recTds = recTds
        self.receptions = receptions
        self.passAttempts = passAttempts
        self.carries = carries
        self.completions = completions
    }
}

public enum NFLPropTrendsEnrichment {
    /// Merge real stat totals into each game's `actuals`, keyed by market —
    /// port of the web merge in `propBreakdown/hooks.ts`. ATD is synthesized
    /// as rushing + receiving TDs (each defaulting to 0) whenever the stats
    /// row exists.
    public static func enrich(
        _ log: [NFLPropTrendGame],
        gameLogs: [NFLPlayerGameLogRow]
    ) -> [NFLPropTrendGame] {
        guard !log.isEmpty, !gameLogs.isEmpty else { return log }
        let statsByGame = Dictionary(
            gameLogs.map { ("\($0.season)-\($0.week)", $0) },
            uniquingKeysWith: { first, _ in first }
        )
        return log.map { game in
            guard let stats = statsByGame["\(game.season)-\(game.week)"] else { return game }
            var enriched = game
            let byMarket: [(String, Double?)] = [
                ("player_pass_yds", stats.passYds),
                ("player_pass_tds", stats.passTds),
                ("player_receptions", stats.receptions),
                ("player_reception_yds", stats.recYds),
                ("player_rush_yds", stats.rushYds),
                ("player_pass_attempts", stats.passAttempts),
                ("player_rush_attempts", stats.carries),
                ("player_pass_completions", stats.completions),
            ]
            for (market, value) in byMarket {
                if let value, value.isFinite { enriched.actuals[market] = value }
            }
            enriched.actuals["player_anytime_td"] = (stats.rushTds ?? 0) + (stats.recTds ?? 0)
            return enriched
        }
    }
}
