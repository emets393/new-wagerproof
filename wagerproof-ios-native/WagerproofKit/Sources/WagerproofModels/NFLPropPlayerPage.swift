import Foundation

// MARK: - `nfl_prop_player_pages` row (CFB/research Supabase)
//
// Port of the web contract in `src/features/propBreakdown/types.ts`. The jsonb
// columns (`markets`, `projection`, `scheme`, `scheme_game_splits`) are
// generator-produced and have drifted before (a dict was once written where
// `markets` expected an array), so every jsonb decodes through `JSONValue`
// and maps defensively — one bad blob nils only its widget, never the row.

/// Fired P-flag for one player+market, resolved by the pages generator from
/// `nfl_signal_defs` (name + direction + backtest record). Mirrors web
/// `PropSignal` in `src/features/propBreakdown/types.ts`.
public struct NFLPropPageSignal: Hashable, Sendable, Identifiable {
    public let key: String
    public let label: String
    public let direction: String?
    public let record: String?

    public var id: String { key }

    public init(key: String, label: String, direction: String? = nil, record: String? = nil) {
        self.key = key
        self.label = label
        self.direction = direction
        self.record = record
    }
}

/// One entry of the page's `markets` array — the posted (or pending) book
/// market for this player. ATD is posted with a nil line (yes/no market).
public struct NFLPropPageMarket: Hashable, Sendable, Identifiable {
    public let key: String
    public let label: String
    public let line: Double?
    public let overPrice: Int?
    public let underPrice: Int?
    /// "pending" | "posted" — kept as a raw string so new statuses degrade.
    public let status: String
    /// Fired, validated prop signals for THIS player+market. Empty on most
    /// rows — signals are selective.
    public let signals: [NFLPropPageSignal]

    public var id: String { key }
    public var isPosted: Bool { status == "posted" }
    /// Short P-codes (`P1`, `P14`, …) for the catalog / feed filter.
    public var flagKeys: [String] { signals.map(\.key) }

    public init(
        key: String,
        label: String,
        line: Double?,
        overPrice: Int?,
        underPrice: Int?,
        status: String,
        signals: [NFLPropPageSignal] = []
    ) {
        self.key = key
        self.label = label
        self.line = line
        self.overPrice = overPrice
        self.underPrice = underPrice
        self.status = status
        self.signals = signals
    }
}

/// Per-market WagerProof projection. Points are stat totals; rates are
/// score probabilities (anytime TD only).
public enum NFLPropProjection: Hashable, Sendable {
    case point(value: Double, status: String, source: String)
    case rate(scoreRate: Double, status: String, source: String)

    /// The generator writes status "live" + source "model" for model output
    /// and status "preview" + source "2025 form/games" for the fallback; the
    /// web type contract says status "model". Accept either signal.
    public var isModel: Bool {
        switch self {
        case .point(_, let status, let source), .rate(_, let status, let source):
            return status == "model" || source == "model"
        }
    }
}

/// One defense-usage dim: share of snaps + league percentile.
public struct NFLPropDefenseDim: Hashable, Sendable {
    public let rate: Double
    public let pctile: Double

    public init(rate: Double, pctile: Double) {
        self.rate = rate
        self.pctile = pctile
    }
}

public struct NFLPropDefense: Hashable, Sendable {
    /// Served identity string, e.g. "zone-heavy, two-high".
    public let identity: String?
    /// man / two_high / pressure / blitz / heavy_box / light_box.
    public let dims: [String: NFLPropDefenseDim]

    public init(identity: String?, dims: [String: NFLPropDefenseDim]) {
        self.identity = identity
        self.dims = dims
    }
}

/// One flexible split shape covering the web's three layers (receiving YPT,
/// QB EPA/dropback, RB box) — all fields optional, read by compare mode.
public struct NFLPropSchemeSplit: Hashable, Sendable {
    public let ypt: Double?
    public let epaDb: Double?
    public let ypa: Double?
    public let compPct: Double?
    public let sackRate: Double?
    public let ypc: Double?
    public let epaRush: Double?
    public let tdRate: Double?
    public let targets: Int?
    public let dropbacks: Int?
    public let carries: Int?
    public let deltaYpt: Double?
    public let deltaEpaDb: Double?
    public let deltaEpaRush: Double?
    public let pctile: Double?
    /// "ok" | "thin".
    public let sample: String?
    public let insufficient: Bool

    public init(
        ypt: Double? = nil, epaDb: Double? = nil, ypa: Double? = nil,
        compPct: Double? = nil, sackRate: Double? = nil, ypc: Double? = nil,
        epaRush: Double? = nil, tdRate: Double? = nil,
        targets: Int? = nil, dropbacks: Int? = nil, carries: Int? = nil,
        deltaYpt: Double? = nil, deltaEpaDb: Double? = nil, deltaEpaRush: Double? = nil,
        pctile: Double? = nil, sample: String? = nil, insufficient: Bool = false
    ) {
        self.ypt = ypt
        self.epaDb = epaDb
        self.ypa = ypa
        self.compPct = compPct
        self.sackRate = sackRate
        self.ypc = ypc
        self.epaRush = epaRush
        self.tdRate = tdRate
        self.targets = targets
        self.dropbacks = dropbacks
        self.carries = carries
        self.deltaYpt = deltaYpt
        self.deltaEpaDb = deltaEpaDb
        self.deltaEpaRush = deltaEpaRush
        self.pctile = pctile
        self.sample = sample
        self.insufficient = insufficient
    }
}

/// `{h, n, pct}` hit-rate record (look hit-rates + H2H matchup markets).
public struct NFLPropHitRate: Hashable, Sendable {
    public let h: Int
    public let n: Int
    public let pct: Double?

    public init(h: Int, n: Int, pct: Double?) {
        self.h = h
        self.n = n
        self.pct = pct
    }
}

public struct NFLPropScheme: Hashable, Sendable {
    public let opponent: String?
    /// "receiving" | "qb" | "rb".
    public let kind: String?
    public let defense: NFLPropDefense?
    public let playerOverall: NFLPropSchemeSplit?
    /// Keyed by look: zone / man / two_high / one_high / pressure / blitz.
    public let playerSplits: [String: NFLPropSchemeSplit]
    public let lookFocus: [String]
    public let rushOverall: NFLPropSchemeSplit?
    /// Keyed by box look: heavy_box / neutral / light_box.
    public let rushSplits: [String: NFLPropSchemeSplit]
    public let rushLookFocus: [String]
    /// bucket → marketKey → record.
    public let lookHitRates: [String: [String: NFLPropHitRate]]

    public init(
        opponent: String?, kind: String?, defense: NFLPropDefense?,
        playerOverall: NFLPropSchemeSplit?, playerSplits: [String: NFLPropSchemeSplit],
        lookFocus: [String], rushOverall: NFLPropSchemeSplit?,
        rushSplits: [String: NFLPropSchemeSplit], rushLookFocus: [String],
        lookHitRates: [String: [String: NFLPropHitRate]]
    ) {
        self.opponent = opponent
        self.kind = kind
        self.defense = defense
        self.playerOverall = playerOverall
        self.playerSplits = playerSplits
        self.lookFocus = lookFocus
        self.rushOverall = rushOverall
        self.rushSplits = rushSplits
        self.rushLookFocus = rushLookFocus
        self.lookHitRates = lookHitRates
    }
}

/// One entry of `scheme_game_splits` — per-game averages, either overall or
/// against one defense-type bucket.
public struct NFLPropGameSplitEntry: Hashable, Sendable {
    public let n: Int?
    public let insufficient: Bool
    /// receptions / rec_yds / targets / rush_att / rush_yds / pass_att / pass_yds.
    public let stats: [String: Double]
    public let delta: [String: Double]

    public init(n: Int?, insufficient: Bool, stats: [String: Double], delta: [String: Double]) {
        self.n = n
        self.insufficient = insufficient
        self.stats = stats
        self.delta = delta
    }
}

public struct NFLPropGameSplits: Hashable, Sendable {
    public let overall: NFLPropGameSplitEntry?
    public let splits: [String: NFLPropGameSplitEntry]
    public let applicable: [String]
    public let window: String?

    public init(overall: NFLPropGameSplitEntry?, splits: [String: NFLPropGameSplitEntry], applicable: [String], window: String?) {
        self.overall = overall
        self.splits = splits
        self.applicable = applicable
        self.window = window
    }
}

/// One row of `nfl_prop_player_pages`, defensively decoded.
public struct NFLPropPlayerPage: Decodable, Hashable, Sendable {
    public let playerId: String
    public let season: Int
    public let week: Int
    public let playerName: String
    public let position: String?
    public let team: String?
    public let opponent: String?
    public let isHome: Bool?
    public let gameLabel: String?
    public let kickoff: String?
    public let headshotUrl: String?
    public let rookie: Bool
    public let markets: [NFLPropPageMarket]
    public let projection: [String: NFLPropProjection]
    public let scheme: NFLPropScheme?
    public let schemeGameSplits: NFLPropGameSplits?

    enum CodingKeys: String, CodingKey {
        case playerId = "player_id"
        case season, week
        case playerName = "player_name"
        case position, team, opponent
        case isHome = "is_home"
        case gameLabel = "game_label"
        case kickoff
        case headshotUrl = "headshot_url"
        case rookie, markets, projection, scheme
        case schemeGameSplits = "scheme_game_splits"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        playerId = try c.decode(String.self, forKey: .playerId)
        season = try c.decode(Int.self, forKey: .season)
        week = try c.decode(Int.self, forKey: .week)
        playerName = try c.decode(String.self, forKey: .playerName)
        position = try? c.decodeIfPresent(String.self, forKey: .position)
        team = try? c.decodeIfPresent(String.self, forKey: .team)
        opponent = try? c.decodeIfPresent(String.self, forKey: .opponent)
        isHome = try? c.decodeIfPresent(Bool.self, forKey: .isHome)
        gameLabel = try? c.decodeIfPresent(String.self, forKey: .gameLabel)
        kickoff = try? c.decodeIfPresent(String.self, forKey: .kickoff)
        headshotUrl = try? c.decodeIfPresent(String.self, forKey: .headshotUrl)
        rookie = (try? c.decodeIfPresent(Bool.self, forKey: .rookie)) ?? false
        markets = Self.mapMarkets((try? c.decodeIfPresent(JSONValue.self, forKey: .markets)) ?? nil)
        projection = Self.mapProjection((try? c.decodeIfPresent(JSONValue.self, forKey: .projection)) ?? nil)
        scheme = Self.mapScheme((try? c.decodeIfPresent(JSONValue.self, forKey: .scheme)) ?? nil)
        schemeGameSplits = Self.mapGameSplits((try? c.decodeIfPresent(JSONValue.self, forKey: .schemeGameSplits)) ?? nil)
    }

    public init(
        playerId: String, season: Int, week: Int, playerName: String,
        position: String? = nil, team: String? = nil, opponent: String? = nil,
        isHome: Bool? = nil, gameLabel: String? = nil, kickoff: String? = nil,
        headshotUrl: String? = nil, rookie: Bool = false,
        markets: [NFLPropPageMarket] = [],
        projection: [String: NFLPropProjection] = [:],
        scheme: NFLPropScheme? = nil,
        schemeGameSplits: NFLPropGameSplits? = nil
    ) {
        self.playerId = playerId
        self.season = season
        self.week = week
        self.playerName = playerName
        self.position = position
        self.team = team
        self.opponent = opponent
        self.isHome = isHome
        self.gameLabel = gameLabel
        self.kickoff = kickoff
        self.headshotUrl = headshotUrl
        self.rookie = rookie
        self.markets = markets
        self.projection = projection
        self.scheme = scheme
        self.schemeGameSplits = schemeGameSplits
    }

    // MARK: JSONB mapping (exposed for decode-fixture tests)

    /// Non-array `markets` (the historical dict drift) degrades to `[]`.
    public static func mapMarkets(_ json: JSONValue?) -> [NFLPropPageMarket] {
        guard let items = json?.arrayValue else { return [] }
        return items.compactMap { item in
            guard let o = item.objectValue,
                  let key = o["key"]?.stringValue else { return nil }
            return NFLPropPageMarket(
                key: key,
                label: o["label"]?.stringValue ?? NFLPlayerProps.marketLabel(key),
                line: o["line"]?.doubleValue,
                overPrice: o["over_price"]?.intValue,
                underPrice: o["under_price"]?.intValue,
                status: o["status"]?.stringValue ?? "pending",
                signals: mapSignals(o["signals"])
            )
        }
    }

    /// Non-array / missing `signals` degrades to `[]` (the normal case).
    public static func mapSignals(_ json: JSONValue?) -> [NFLPropPageSignal] {
        guard let items = json?.arrayValue else { return [] }
        return items.compactMap { item in
            guard let o = item.objectValue,
                  let key = o["key"]?.stringValue, !key.isEmpty else { return nil }
            let label = o["label"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            return NFLPropPageSignal(
                key: key,
                label: (label?.isEmpty == false ? label! : key),
                direction: o["direction"]?.stringValue,
                record: o["record"]?.stringValue
            )
        }
    }

    public static func mapProjection(_ json: JSONValue?) -> [String: NFLPropProjection] {
        guard let byMarket = json?.objectValue else { return [:] }
        var out: [String: NFLPropProjection] = [:]
        for (market, raw) in byMarket {
            guard let o = raw.objectValue, let kind = o["kind"]?.stringValue else { continue }
            let status = o["status"]?.stringValue ?? ""
            let source = o["source"]?.stringValue ?? ""
            switch kind {
            case "point":
                guard let value = o["value"]?.doubleValue else { continue }
                out[market] = .point(value: value, status: status, source: source)
            case "rate":
                guard let rate = o["score_rate"]?.doubleValue else { continue }
                out[market] = .rate(scoreRate: rate, status: status, source: source)
            default:
                continue
            }
        }
        return out
    }

    public static func mapScheme(_ json: JSONValue?) -> NFLPropScheme? {
        guard let o = json?.objectValue else { return nil }

        var defense: NFLPropDefense?
        if let d = o["defense"]?.objectValue {
            var dims: [String: NFLPropDefenseDim] = [:]
            for (key, raw) in d {
                guard let dim = raw.objectValue,
                      let rate = dim["rate"]?.doubleValue,
                      let pctile = dim["pctile"]?.doubleValue else { continue }
                dims[key] = NFLPropDefenseDim(rate: rate, pctile: pctile)
            }
            defense = NFLPropDefense(identity: d["identity"]?.stringValue, dims: dims)
        }

        return NFLPropScheme(
            opponent: o["opponent"]?.stringValue,
            kind: o["kind"]?.stringValue,
            defense: defense,
            playerOverall: mapSplit(o["player_overall"]),
            playerSplits: mapSplitDict(o["player_splits"]),
            lookFocus: mapStringArray(o["look_focus"]),
            rushOverall: mapSplit(o["rush_overall"]),
            rushSplits: mapSplitDict(o["rush_splits"]),
            rushLookFocus: mapStringArray(o["rush_look_focus"]),
            lookHitRates: mapLookHitRates(o["look_hit_rates"])
        )
    }

    public static func mapGameSplits(_ json: JSONValue?) -> NFLPropGameSplits? {
        guard let o = json?.objectValue else { return nil }
        var splits: [String: NFLPropGameSplitEntry] = [:]
        if let raw = o["splits"]?.objectValue {
            for (bucket, entry) in raw {
                if let mapped = mapGameSplitEntry(entry) { splits[bucket] = mapped }
            }
        }
        return NFLPropGameSplits(
            overall: mapGameSplitEntry(o["overall"]),
            splits: splits,
            applicable: mapStringArray(o["applicable"]),
            window: o["window"]?.stringValue
        )
    }

    private static func mapGameSplitEntry(_ json: JSONValue?) -> NFLPropGameSplitEntry? {
        guard let o = json?.objectValue else { return nil }
        var stats: [String: Double] = [:]
        for (key, value) in o where key != "n" && key != "insufficient" && key != "delta" {
            if let v = value.doubleValue { stats[key] = v }
        }
        var delta: [String: Double] = [:]
        if let d = o["delta"]?.objectValue {
            for (key, value) in d {
                if let v = value.doubleValue { delta[key] = v }
            }
        }
        return NFLPropGameSplitEntry(
            n: o["n"]?.intValue,
            insufficient: o["insufficient"]?.boolValue ?? false,
            stats: stats,
            delta: delta
        )
    }

    private static func mapSplit(_ json: JSONValue?) -> NFLPropSchemeSplit? {
        guard let o = json?.objectValue else { return nil }
        return NFLPropSchemeSplit(
            ypt: o["ypt"]?.doubleValue,
            epaDb: o["epa_db"]?.doubleValue,
            ypa: o["ypa"]?.doubleValue,
            compPct: o["comp_pct"]?.doubleValue,
            sackRate: o["sack_rate"]?.doubleValue,
            ypc: o["ypc"]?.doubleValue,
            epaRush: o["epa_rush"]?.doubleValue,
            tdRate: o["td_rate"]?.doubleValue,
            targets: o["targets"]?.intValue,
            dropbacks: o["dropbacks"]?.intValue,
            carries: o["carries"]?.intValue,
            deltaYpt: o["delta_ypt"]?.doubleValue,
            deltaEpaDb: o["delta_epa_db"]?.doubleValue,
            deltaEpaRush: o["delta_epa_rush"]?.doubleValue,
            pctile: o["pctile"]?.doubleValue,
            sample: o["sample"]?.stringValue,
            insufficient: o["insufficient"]?.boolValue ?? false
        )
    }

    private static func mapSplitDict(_ json: JSONValue?) -> [String: NFLPropSchemeSplit] {
        guard let o = json?.objectValue else { return [:] }
        var out: [String: NFLPropSchemeSplit] = [:]
        for (key, value) in o {
            if let split = mapSplit(value) { out[key] = split }
        }
        return out
    }

    private static func mapStringArray(_ json: JSONValue?) -> [String] {
        json?.arrayValue?.compactMap(\.stringValue) ?? []
    }

    static func mapLookHitRates(_ json: JSONValue?) -> [String: [String: NFLPropHitRate]] {
        guard let byBucket = json?.objectValue else { return [:] }
        var out: [String: [String: NFLPropHitRate]] = [:]
        for (bucket, raw) in byBucket {
            guard let byMarket = raw.objectValue else { continue }
            var records: [String: NFLPropHitRate] = [:]
            for (market, rec) in byMarket {
                if let mapped = mapHitRate(rec) { records[market] = mapped }
            }
            if !records.isEmpty { out[bucket] = records }
        }
        return out
    }

    static func mapHitRate(_ json: JSONValue?) -> NFLPropHitRate? {
        guard let o = json?.objectValue,
              let h = o["h"]?.intValue,
              let n = o["n"]?.intValue else { return nil }
        return NFLPropHitRate(h: h, n: n, pct: o["pct"]?.doubleValue)
    }
}
