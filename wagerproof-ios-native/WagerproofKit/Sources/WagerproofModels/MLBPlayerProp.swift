import Foundation

/// MLB player-prop domain model + pure computation utilities. Ports
/// `wagerproof-mobile/types/mlb-player-props.ts` and
/// `wagerproof-mobile/utils/mlbPlayerProps.ts` byte-for-byte so the SwiftUI
/// player-props surface computes hit-rates / chart data / verdicts
/// identically to the RN app.
///
/// The backend RPC `get_mlb_player_props_l10(p_game_pk)` returns the raw
/// materials — the alternate-line ladder (`lines`) and the season game log
/// (`games`) — and the client derives every split (L10, day/night,
/// archetype) at a chosen line. Keeping that math here (Foundation-only)
/// means the views just render the result.

// MARK: - Markets

/// Canonical prop market keys. Mirrors RN `MlbPlayerPropMarket`.
public enum MLBPlayerPropMarket: String, CaseIterable, Sendable {
    case batterHomeRuns = "batter_home_runs"
    case batterHits = "batter_hits"
    case batterTotalBases = "batter_total_bases"
    case batterRbis = "batter_rbis"
    case batterHitsRunsRbis = "batter_hits_runs_rbis"
    case batterWalks = "batter_walks"
    case batterStrikeouts = "batter_strikeouts"
    case pitcherStrikeouts = "pitcher_strikeouts"
    case pitcherHitsAllowed = "pitcher_hits_allowed"
    case pitcherWalks = "pitcher_walks"
    case pitcherOuts = "pitcher_outs"

    /// Friendly label. Falls back to the raw key for unknown markets.
    public var label: String { MLBPlayerProps.marketLabel(rawValue) }
}

// MARK: - Raw RPC row

/// One alternate line + its over/under odds. Mirrors `MlbPlayerPropLineEntry`.
public struct MLBPlayerPropLineEntry: Codable, Hashable, Sendable {
    public let line: Double
    public let over: Int?
    public let under: Int?

    public init(line: Double, over: Int?, under: Int?) {
        self.line = line
        self.over = over
        self.under = under
    }

    enum CodingKeys: String, CodingKey { case line, over, under }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.line = MLBPlayerProps.flexDouble(c, .line) ?? 0
        self.over = MLBPlayerProps.flexInt(c, .over)
        self.under = MLBPlayerProps.flexInt(c, .under)
    }
}

/// One historical game in the season log. Mirrors `MlbPlayerPropGameEntry`:
///   - `v`  the player's actual stat value that game
///   - `d`  day flag (1 = day game, 0 = night)
///   - `a`  opposing starter archetype (nil / "Insufficient" → nil)
///   - `dt` ISO `YYYY-MM-DD` for the chart x-axis
public struct MLBPlayerPropGameEntry: Codable, Hashable, Sendable {
    public let v: Double
    public let d: Int
    public let a: String?
    public let dt: String?

    public init(v: Double, d: Int, a: String?, dt: String?) {
        self.v = v
        self.d = d
        self.a = a
        self.dt = dt
    }

    enum CodingKeys: String, CodingKey { case v, d, a, dt }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.v = MLBPlayerProps.flexDouble(c, .v) ?? 0
        self.d = (MLBPlayerProps.flexInt(c, .d) ?? 0) == 1 ? 1 : 0
        // Match parseGames: "Insufficient" is treated as no archetype.
        let rawArch = try? c.decodeIfPresent(String.self, forKey: .a)
        self.a = (rawArch != nil && rawArch != "Insufficient") ? rawArch : nil
        let rawDate = try? c.decodeIfPresent(String.self, forKey: .dt)
        self.dt = (rawDate?.isEmpty == false) ? rawDate : nil
    }
}

/// Raw RPC result for one `(player, market)` pair. Mirrors `MlbPlayerPropRow`.
public struct MLBPlayerPropRow: Codable, Hashable, Sendable, Identifiable {
    public let playerId: Int
    public let playerName: String
    public let isPitcher: Bool
    public let market: String
    public let gameIsDay: Bool
    public let oppArchetypeToday: String?
    public let lines: [MLBPlayerPropLineEntry]
    public let games: [MLBPlayerPropGameEntry]

    /// Stable identity for `ForEach`. A player can appear under multiple
    /// markets, so the market is part of the key.
    public var id: String { "\(playerId)-\(market)" }

    public init(
        playerId: Int,
        playerName: String,
        isPitcher: Bool,
        market: String,
        gameIsDay: Bool,
        oppArchetypeToday: String?,
        lines: [MLBPlayerPropLineEntry],
        games: [MLBPlayerPropGameEntry]
    ) {
        self.playerId = playerId
        self.playerName = playerName
        self.isPitcher = isPitcher
        self.market = market
        self.gameIsDay = gameIsDay
        self.oppArchetypeToday = oppArchetypeToday
        // parseLines sorts ascending by line; keep the same invariant.
        self.lines = lines.sorted { $0.line < $1.line }
        self.games = games
    }

    enum CodingKeys: String, CodingKey {
        case playerId = "player_id"
        case playerName = "player_name"
        case isPitcher = "is_pitcher"
        case market
        case gameIsDay = "game_is_day"
        case oppArchetypeToday = "opp_archetype_today"
        case lines
        case games
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.playerId = (try? c.decode(Int.self, forKey: .playerId)) ?? 0
        self.playerName = (try? c.decode(String.self, forKey: .playerName)) ?? "Player"
        self.isPitcher = (try? c.decode(Bool.self, forKey: .isPitcher)) ?? false
        self.market = (try? c.decode(String.self, forKey: .market)) ?? ""
        self.gameIsDay = (try? c.decode(Bool.self, forKey: .gameIsDay)) ?? false
        self.oppArchetypeToday = try? c.decodeIfPresent(String.self, forKey: .oppArchetypeToday)
        let rawLines = (try? c.decode([MLBPlayerPropLineEntry].self, forKey: .lines)) ?? []
        self.lines = rawLines.sorted { $0.line < $1.line }
        self.games = (try? c.decode([MLBPlayerPropGameEntry].self, forKey: .games)) ?? []
    }
}

// MARK: - Computed splits

/// Over count / sample size / pct for a subset of games at a line.
/// Mirrors `PropHitSplit`.
public struct MLBPropHitSplit: Hashable, Sendable {
    public let over: Int
    public let games: Int
    public let pct: Int?

    public init(over: Int, games: Int, pct: Int?) {
        self.over = over
        self.games = games
        self.pct = pct
    }

    /// `games > 0 && games < 5` — too small a sample to trust.
    public var lowConfidence: Bool { games > 0 && games < 5 }

    /// "X/Y" or "-" when empty.
    public var fractionLabel: String { games <= 0 ? "-" : "\(over)/\(games)" }

    /// "Z%" or "-".
    public var pctLabel: String { pct.map { "\($0)%" } ?? "-" }
}

/// One bar in the recent-form chart. Mirrors the `chartGames[]` element.
public struct MLBPropChartBar: Identifiable, Hashable, Sendable {
    public let id: Int
    public let value: Double
    public let cleared: Bool
    public let isDay: Bool
    public let archetype: String?
    public let date: String?

    public init(id: Int, value: Double, cleared: Bool, isDay: Bool, archetype: String?, date: String?) {
        self.id = id
        self.value = value
        self.cleared = cleared
        self.isDay = isDay
        self.archetype = archetype
        self.date = date
    }
}

/// Everything the detail view needs at a selected line. Mirrors
/// `PropComputedAtLine`.
public struct MLBPropComputedAtLine: Sendable {
    public let line: Double
    public let overOdds: Int?
    public let underOdds: Int?
    public let l10: MLBPropHitSplit
    public let season: MLBPropHitSplit
    public let contextualDayNight: MLBPropHitSplit?
    public let contextualArchetype: MLBPropHitSplit?
    public let chartGames: [MLBPropChartBar]
    public let miniStrip: [(cleared: Bool, value: Double)]

    public init(
        line: Double,
        overOdds: Int?,
        underOdds: Int?,
        l10: MLBPropHitSplit,
        season: MLBPropHitSplit,
        contextualDayNight: MLBPropHitSplit?,
        contextualArchetype: MLBPropHitSplit?,
        chartGames: [MLBPropChartBar],
        miniStrip: [(cleared: Bool, value: Double)]
    ) {
        self.line = line
        self.overOdds = overOdds
        self.underOdds = underOdds
        self.l10 = l10
        self.season = season
        self.contextualDayNight = contextualDayNight
        self.contextualArchetype = contextualArchetype
        self.chartGames = chartGames
        self.miniStrip = miniStrip
    }
}

/// A player's single best prop (highest L10 over-rate at its default line).
public struct MLBHeadlineProp: Sendable {
    public let row: MLBPlayerPropRow
    public let computed: MLBPropComputedAtLine
    public init(row: MLBPlayerPropRow, computed: MLBPropComputedAtLine) {
        self.row = row
        self.computed = computed
    }
}

// MARK: - Pure computation namespace

public enum MLBPlayerProps {
    public static let brandGreenHex: UInt32 = 0x22C55E
    public static let missRedHex: UInt32 = 0xEF4444

    static let marketLabels: [String: String] = [
        "batter_home_runs": "Home Runs",
        "batter_hits": "Hits",
        "batter_total_bases": "Total Bases",
        "batter_rbis": "RBIs",
        "batter_hits_runs_rbis": "H+R+RBI",
        "batter_walks": "Walks",
        "batter_strikeouts": "Strikeouts",
        "pitcher_strikeouts": "Strikeouts",
        "pitcher_hits_allowed": "Hits Allowed",
        "pitcher_walks": "Walks",
        "pitcher_outs": "Outs",
    ]

    static let batterMarketOrder: [String] = [
        "batter_home_runs", "batter_hits", "batter_total_bases",
        "batter_rbis", "batter_hits_runs_rbis", "batter_walks", "batter_strikeouts",
    ]
    static let pitcherMarketOrder: [String] = [
        "pitcher_strikeouts", "pitcher_hits_allowed", "pitcher_walks", "pitcher_outs",
    ]

    public static func marketLabel(_ market: String) -> String {
        marketLabels[market] ?? market
    }

    static func marketSortIndex(_ market: String, isPitcher: Bool) -> Int {
        let order = isPitcher ? pitcherMarketOrder : batterMarketOrder
        let idx = order.firstIndex(of: market)
        return idx ?? 999
    }

    /// American-odds string: "+120" / "-110" / "-" for nil. Mirrors
    /// `formatMoneyline` / `formatPropOdds`.
    public static func formatOdds(_ odds: Int?) -> String {
        guard let odds else { return "-" }
        return odds > 0 ? "+\(odds)" : "\(odds)"
    }

    /// Integer or single-decimal line. Mirrors `formatPropLine`.
    public static func formatLine(_ line: Double?) -> String {
        guard let line, line.isFinite else { return "-" }
        return line == line.rounded() ? String(Int(line)) : String(format: "%.1f", line)
    }

    /// Bar value formatter — integer or one decimal. Mirrors `formatBarValue`.
    public static func formatBarValue(_ v: Double) -> String {
        guard v.isFinite else { return "0" }
        return v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }

    public static func cleared(_ game: MLBPlayerPropGameEntry, line: Double) -> Bool {
        game.v > line
    }

    /// First "fair" line (over odds present and ≥ -180), else the last line.
    /// Mirrors `defaultLine`.
    public static func defaultLine(_ lines: [MLBPlayerPropLineEntry]) -> Double? {
        if lines.isEmpty { return nil }
        if let fair = lines.first(where: { $0.over != nil && $0.over! >= -180 }) {
            return fair.line
        }
        return lines.last?.line
    }

    static func lineEntry(_ lines: [MLBPlayerPropLineEntry], line: Double) -> MLBPlayerPropLineEntry? {
        lines.first { $0.line == line }
    }

    /// Over/games/pct for an optionally-capped subset. Mirrors `hitSplit`.
    public static func hitSplit(_ games: [MLBPlayerPropGameEntry], line: Double, max: Int? = nil) -> MLBPropHitSplit {
        let subset = max != nil ? Array(games.prefix(max!)) : games
        let n = subset.count
        let over = subset.filter { cleared($0, line: line) }.count
        return MLBPropHitSplit(
            over: over,
            games: n,
            pct: n > 0 ? Int((Double(over) / Double(n) * 100).rounded()) : nil
        )
    }

    /// Full computation at a line — L10, season, day/night + archetype
    /// contextual splits, chart bars, mini strip. Mirrors `computePropAtLine`.
    public static func computePropAtLine(_ row: MLBPlayerPropRow, line: Double) -> MLBPropComputedAtLine? {
        guard let entry = lineEntry(row.lines, line: line) else { return nil }

        let l10 = hitSplit(row.games, line: line, max: 10)
        let season = hitSplit(row.games, line: line)
        let dayFlag = row.gameIsDay ? 1 : 0
        let contextualGames = row.games.filter { $0.d == dayFlag }
        let contextualDayNight = contextualGames.isEmpty ? nil : hitSplit(contextualGames, line: line)

        var contextualArchetype: MLBPropHitSplit?
        if !row.isPitcher, let arch = row.oppArchetypeToday {
            let archGames = row.games.filter { $0.a == arch }
            if archGames.count >= 3 { contextualArchetype = hitSplit(archGames, line: line) }
        }

        // Newest-on-the-right: take the most recent 12, reverse to oldest→newest.
        let chartSlice = Array(row.games.prefix(12)).reversed()
        let chartGames = chartSlice.enumerated().map { idx, g in
            MLBPropChartBar(
                id: idx,
                value: g.v,
                cleared: cleared(g, line: line),
                isDay: g.d == 1,
                archetype: g.a,
                date: g.dt
            )
        }

        let miniSlice = Array(row.games.prefix(10)).reversed()
        let miniStrip = miniSlice.map { (cleared: cleared($0, line: line), value: $0.v) }

        return MLBPropComputedAtLine(
            line: line,
            overOdds: entry.over,
            underOdds: entry.under,
            l10: l10,
            season: season,
            contextualDayNight: contextualDayNight,
            contextualArchetype: contextualArchetype,
            chartGames: chartGames,
            miniStrip: miniStrip
        )
    }

    /// Player's best prop by L10 over-rate at each market's default line.
    /// When `market` is set, returns that market only (for feed filters).
    /// Mirrors `pickHeadlineProp`.
    public static func pickHeadlineProp(_ props: [MLBPlayerPropRow], market: String? = nil) -> MLBHeadlineProp? {
        if let market {
            guard let row = props.first(where: { $0.market == market }),
                  let dl = defaultLine(row.lines),
                  let computed = computePropAtLine(row, line: dl) else { return nil }
            return MLBHeadlineProp(row: row, computed: computed)
        }
        var best: (row: MLBPlayerPropRow, computed: MLBPropComputedAtLine, rate: Double)?
        for row in props {
            guard let dl = defaultLine(row.lines),
                  let computed = computePropAtLine(row, line: dl) else { continue }
            let rate = computed.l10.games > 0 ? Double(computed.l10.over) / Double(computed.l10.games) : -1
            if best == nil || rate > best!.rate {
                best = (row, computed, rate)
            }
        }
        guard let best else { return nil }
        return MLBHeadlineProp(row: best.row, computed: best.computed)
    }

    /// Narrative one-liner. Mirrors `buildVerdict`.
    public static func buildVerdict(_ row: MLBPlayerPropRow, _ computed: MLBPropComputedAtLine) -> String {
        let l10 = computed.l10
        if l10.games == 0 { return "Not enough recent games to gauge this line." }
        var parts: [String] = []
        if l10.over >= 7 {
            parts.append("Cleared in \(l10.over) of last \(l10.games)")
        } else if l10.over >= 5 {
            parts.append("Hit \(l10.over)/\(l10.games) over the last \(l10.games)")
        } else {
            parts.append("\(l10.over)/\(l10.games) over the last \(l10.games)")
        }
        if let dn = computed.contextualDayNight, dn.games >= 5 {
            let label = row.gameIsDay ? "day" : "night"
            parts.append("\(dn.over)/\(dn.games) in \(label) games")
        }
        if let arch = computed.contextualArchetype, arch.games >= 3, let archName = row.oppArchetypeToday {
            parts.append("\(arch.over)/\(arch.games) vs \(archName) starters")
        }
        let emoji = l10.over >= 7 ? "🔥 " : (l10.over >= 5 ? "📈 " : "")
        return emoji + parts.joined(separator: " — ") + "."
    }

    /// Group a flat prop list by player, keeping only batters or pitchers,
    /// markets sorted by the canonical order. Mirrors `groupPropsByPlayer`.
    public static func groupPropsByPlayer(_ rows: [MLBPlayerPropRow], isPitcher: Bool) -> [(playerId: Int, props: [MLBPlayerPropRow])] {
        var order: [Int] = []
        var map: [Int: [MLBPlayerPropRow]] = [:]
        for row in rows where row.isPitcher == isPitcher {
            if map[row.playerId] == nil { order.append(row.playerId) }
            map[row.playerId, default: []].append(row)
        }
        return order.map { pid in
            let sorted = (map[pid] ?? []).sorted {
                marketSortIndex($0.market, isPitcher: isPitcher) < marketSortIndex($1.market, isPitcher: isPitcher)
            }
            return (pid, sorted)
        }
    }

    /// MLB headshot CDN url. The legacy `content.mlb.com/images/headshots/...`
    /// path now 403s for direct (non-browser) requests, so we use the
    /// `img.mlbstatic.com` Cloudinary endpoint — it serves a 213px headshot
    /// (with a generic silhouette fallback baked in) and loads fine from
    /// `AsyncImage`.
    public static func headshotURL(_ playerId: Int) -> String {
        "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/\(playerId)/headshot/67/current"
    }

    // MARK: Flexible JSON number decoding

    /// jsonb numerics can arrive as `-120` or `-120.0`; decode either.
    static func flexDouble<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Double? {
        if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
        if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(i) }
        return nil
    }

    static func flexInt<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Int? {
        if let i = try? c.decodeIfPresent(Int.self, forKey: key) { return i }
        if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(d.rounded()) }
        return nil
    }
}

// MARK: - Pitcher archetype display

/// Display metadata for a pitcher archetype. Mirrors `ARCHETYPE_META`
/// (`wagerproof-mobile/utils/mlbPitcherArchetypes.ts`). Color is exposed as
/// a hex so the Foundation-only Models layer stays SwiftUI-free.
public struct MLBArchetypeMeta: Sendable {
    public let icon: String
    public let colorHex: UInt32
    public let label: String
}

public enum MLBPitcherArchetypes {
    static let meta: [String: MLBArchetypeMeta] = [
        "Power": MLBArchetypeMeta(icon: "🔥", colorHex: 0xEF4444, label: "Power Pitcher"),
        "Groundball": MLBArchetypeMeta(icon: "🪨", colorHex: 0x10B981, label: "Groundball Pitcher"),
        "Flyball": MLBArchetypeMeta(icon: "🎈", colorHex: 0xF59E0B, label: "Flyball Pitcher"),
        "Control": MLBArchetypeMeta(icon: "🎯", colorHex: 0x3B82F6, label: "Control Pitcher"),
        "Finesse": MLBArchetypeMeta(icon: "🧪", colorHex: 0xA855F7, label: "Finesse / Crafty"),
        "Balanced": MLBArchetypeMeta(icon: "⚖️", colorHex: 0x64748B, label: "Balanced"),
    ]

    /// True for archetypes we render a badge for (excludes "Insufficient").
    public static func isDisplay(_ archetype: String?) -> Bool {
        guard let a = archetype, a != "Insufficient" else { return false }
        return meta[a] != nil
    }

    public static func displayMeta(_ archetype: String?) -> MLBArchetypeMeta? {
        guard let a = archetype, isDisplay(a) else { return nil }
        return meta[a]
    }
}
