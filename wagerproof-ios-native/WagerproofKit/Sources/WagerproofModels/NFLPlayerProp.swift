import Foundation

// MARK: - Raw table rows (NFL dry-run data contract)

/// One entry of a prop row's `recent_games` JSON array — the player's actual
/// stat in one prior game this season (walk-forward, point-in-time).
public struct NFLPropRecentGame: Codable, Hashable, Sendable {
    public let opp: String?
    public let week: Int?
    public let actual: Double?

    public init(opp: String?, week: Int?, actual: Double?) {
        self.opp = opp
        self.week = week
        self.actual = actual
    }
}

/// One row of `nfl_dryrun_props` (CFB/research Supabase): a single
/// player × market with the consensus close line/prices (median across books),
/// season game-log trends, defense-matchup context, and fired P-flags.
/// See the "NFL Week 12 2025 Dry Run — App Data Contract" doc — the 2026
/// in-season tables will follow this same shape.
public struct NFLDryrunPropRow: Decodable, Hashable, Sendable {
    public let gameId: String
    public let eventId: String?
    public let season: Int?
    public let week: Int?
    public let playerId: String?
    public let playerName: String
    public let position: String?
    public let team: String?
    public let opponent: String?
    public let isHome: Bool?
    public let market: String
    public let closeLine: Double?
    /// American odds; consensus medians can land on half-cents (e.g. -112.5).
    public let overPrice: Double?
    public let underPrice: Double?
    public let openLine: Double?
    public let lineDelta: Double?
    public let lineRange: Double?
    public let nBooks: Int?
    /// Yes/no markets (anytime TD): implied probability at close / open.
    public let closeYesProb: Double?
    public let openYesProb: Double?
    public let gpPrior: Int?
    public let lastGame: Double?
    public let l3Avg: Double?
    public let l5Avg: Double?
    public let l10Avg: Double?
    public let sznAvg: Double?
    public let sznMax: Double?
    public let sznMin: Double?
    public let overRateL5: Double?
    public let overRateL10: Double?
    public let recentGames: [NFLPropRecentGame]?
    public let defAllowedPos: Double?
    public let lgAllowedPos: Double?
    public let defMatchupIdx: Double?
    public let reportStatus: String?
    public let practiceStatus: String?
    public let flags: [String]?
    public let headshotUrl: String?

    enum CodingKeys: String, CodingKey {
        case gameId = "game_id"
        case eventId = "event_id"
        case season, week
        case playerId = "player_id"
        case playerName = "player_name"
        case position, team, opponent
        case isHome = "is_home"
        case market
        case closeLine = "close_line"
        case overPrice = "over_price"
        case underPrice = "under_price"
        case openLine = "open_line"
        case lineDelta = "line_delta"
        case lineRange = "line_range"
        case nBooks = "n_books"
        case closeYesProb = "close_yes_prob"
        case openYesProb = "open_yes_prob"
        case gpPrior = "gp_prior"
        case lastGame = "last_game"
        case l3Avg = "l3_avg"
        case l5Avg = "l5_avg"
        case l10Avg = "l10_avg"
        case sznAvg = "szn_avg"
        case sznMax = "szn_max"
        case sznMin = "szn_min"
        case overRateL5 = "over_rate_l5"
        case overRateL10 = "over_rate_l10"
        case recentGames = "recent_games"
        case defAllowedPos = "def_allowed_pos"
        case lgAllowedPos = "lg_allowed_pos"
        case defMatchupIdx = "def_matchup_idx"
        case reportStatus = "report_status"
        case practiceStatus = "practice_status"
        case flags
        case headshotUrl = "headshot_url"
    }

    public init(
        gameId: String, eventId: String?, season: Int?, week: Int?,
        playerId: String?, playerName: String, position: String?,
        team: String?, opponent: String?, isHome: Bool?,
        market: String, closeLine: Double?, overPrice: Double?, underPrice: Double?,
        openLine: Double? = nil, lineDelta: Double? = nil, lineRange: Double? = nil,
        nBooks: Int? = nil, closeYesProb: Double? = nil, openYesProb: Double? = nil,
        gpPrior: Int? = nil, lastGame: Double? = nil,
        l3Avg: Double? = nil, l5Avg: Double? = nil, l10Avg: Double? = nil,
        sznAvg: Double? = nil, sznMax: Double? = nil, sznMin: Double? = nil,
        overRateL5: Double? = nil, overRateL10: Double? = nil,
        recentGames: [NFLPropRecentGame]? = nil,
        defAllowedPos: Double? = nil, lgAllowedPos: Double? = nil, defMatchupIdx: Double? = nil,
        reportStatus: String? = nil, practiceStatus: String? = nil,
        flags: [String]? = nil, headshotUrl: String? = nil
    ) {
        self.gameId = gameId
        self.eventId = eventId
        self.season = season
        self.week = week
        self.playerId = playerId
        self.playerName = playerName
        self.position = position
        self.team = team
        self.opponent = opponent
        self.isHome = isHome
        self.market = market
        self.closeLine = closeLine
        self.overPrice = overPrice
        self.underPrice = underPrice
        self.openLine = openLine
        self.lineDelta = lineDelta
        self.lineRange = lineRange
        self.nBooks = nBooks
        self.closeYesProb = closeYesProb
        self.openYesProb = openYesProb
        self.gpPrior = gpPrior
        self.lastGame = lastGame
        self.l3Avg = l3Avg
        self.l5Avg = l5Avg
        self.l10Avg = l10Avg
        self.sznAvg = sznAvg
        self.sznMax = sznMax
        self.sznMin = sznMin
        self.overRateL5 = overRateL5
        self.overRateL10 = overRateL10
        self.recentGames = recentGames
        self.defAllowedPos = defAllowedPos
        self.lgAllowedPos = lgAllowedPos
        self.defMatchupIdx = defMatchupIdx
        self.reportStatus = reportStatus
        self.practiceStatus = practiceStatus
        self.flags = flags
        self.headshotUrl = headshotUrl
    }
}

/// Matchup context joined from `nfl_dryrun_games` (kickoff day + slot) —
/// props rows only carry the `game_id`.
public struct NFLPropGameContext: Hashable, Sendable {
    public let gameDate: String
    public let slot: String?

    public init(gameDate: String, slot: String?) {
        self.gameDate = gameDate
        self.slot = slot
    }
}

// MARK: - Grouped models

/// One market for a player: consensus close line + prices, the season trend
/// behind it, and any fired P-flags. Yes/no markets (anytime TD) carry an
/// implied probability instead of a line.
public struct NFLPropMarket: Hashable, Sendable, Identifiable {
    public let market: String
    public let closeLine: Double?
    public let openLine: Double?
    public let lineDelta: Double?
    public let lineRange: Double?
    public let overPrice: Int?
    public let underPrice: Int?
    public let nBooks: Int?
    public let closeYesProb: Double?
    public let openYesProb: Double?
    public let lastGame: Double?
    public let l3Avg: Double?
    public let l5Avg: Double?
    public let l10Avg: Double?
    public let sznAvg: Double?
    public let sznMax: Double?
    public let sznMin: Double?
    public let overRateL5: Double?
    public let overRateL10: Double?
    public let defMatchupIdx: Double?
    public let flags: [String]
    /// Oldest → newest (as stored).
    public let recentGames: [NFLPropRecentGame]

    public var id: String { market }
    public var label: String { NFLPlayerProps.marketLabel(market) }

    /// Anytime-TD-style market: no posted line, the price is a yes-price.
    public var isYesNo: Bool { closeLine == nil }

    /// The threshold a game "clears": the posted line, or ≥1 for yes/no
    /// markets (scored a TD).
    public var clearThreshold: Double { closeLine ?? 0.5 }

    /// Last-10 strip for the feed card, oldest → newest.
    public var miniStrip: [(cleared: Bool, value: Double)] {
        recentGames.suffix(10).compactMap { g in
            guard let v = g.actual else { return nil }
            return (cleared: v > clearThreshold, value: v)
        }
    }

    /// L10 hit count vs the close line, computed from the game log so the
    /// fraction always matches the strip (the server's `over_rate_l10` is
    /// line-at-snapshot and can drift from the close).
    public var l10Hits: (hits: Int, n: Int) {
        let games = recentGames.suffix(10).compactMap(\.actual)
        return (games.filter { $0 > clearThreshold }.count, games.count)
    }

    public var l10HitRate: Double? {
        let (hits, n) = l10Hits
        guard n > 0 else { return nil }
        return Double(hits) / Double(n)
    }

    public init(
        market: String, closeLine: Double?, openLine: Double?, lineDelta: Double?,
        lineRange: Double?, overPrice: Int?, underPrice: Int?, nBooks: Int?,
        closeYesProb: Double?, openYesProb: Double?,
        lastGame: Double?, l3Avg: Double?, l5Avg: Double?, l10Avg: Double?,
        sznAvg: Double?, sznMax: Double?, sznMin: Double?,
        overRateL5: Double?, overRateL10: Double?, defMatchupIdx: Double?,
        flags: [String], recentGames: [NFLPropRecentGame]
    ) {
        self.market = market
        self.closeLine = closeLine
        self.openLine = openLine
        self.lineDelta = lineDelta
        self.lineRange = lineRange
        self.overPrice = overPrice
        self.underPrice = underPrice
        self.nBooks = nBooks
        self.closeYesProb = closeYesProb
        self.openYesProb = openYesProb
        self.lastGame = lastGame
        self.l3Avg = l3Avg
        self.l5Avg = l5Avg
        self.l10Avg = l10Avg
        self.sznAvg = sznAvg
        self.sznMax = sznMax
        self.sznMin = sznMin
        self.overRateL5 = overRateL5
        self.overRateL10 = overRateL10
        self.defMatchupIdx = defMatchupIdx
        self.flags = flags
        self.recentGames = recentGames
    }
}

/// One player's full prop slate for one game — the Tier-1 entity behind the
/// NFL props feed card and detail page.
public struct NFLPropPlayer: Hashable, Sendable, Identifiable {
    public let playerName: String
    public let playerId: String?
    /// Official NFL CDN photo, baked onto every props row.
    public let headshotUrl: String?
    /// Team / opponent abbreviations ("SEA", "TEN").
    public let team: String?
    public let opponent: String?
    public let isHome: Bool?
    public let position: String?
    public let gameId: String
    public let eventId: String?
    /// `gameday` from `nfl_dryrun_games`; empty when the join misses.
    public let gameDate: String
    /// Schedule slot key (thu_fri / sun_early / sun_late_sat / snf / monday).
    public let slot: String?
    public let week: Int?
    public let reportStatus: String?
    public let practiceStatus: String?
    /// Markets ordered by `NFLPlayerProps.marketOrder` (then alphabetically).
    public let markets: [NFLPropMarket]

    public var id: String { "\(gameId)-\(playerId ?? playerName)" }

    /// Headline market for the feed card — a flagged market wins, otherwise
    /// the first in priority order (flags are the contract's badge layer).
    public var headlineMarket: NFLPropMarket? {
        markets.first { !$0.flags.isEmpty } ?? markets.first
    }

    /// All fired P-flags across this player's markets.
    public var allFlags: [String] {
        markets.flatMap(\.flags)
    }

    /// "vs BUF" / "@ KC".
    public var opponentLabel: String {
        guard let opponent, !opponent.isEmpty else { return "" }
        return isHome == true ? "vs \(opponent)" : "@ \(opponent)"
    }

    public var slotLabel: String? { NFLPlayerProps.slotLabel(slot) }

    /// Chronological key: gameday first, then schedule-slot order within it.
    public var sortKey: String {
        "\(gameDate)-\(NFLPlayerProps.slotOrder(slot))"
    }

    public init(
        playerName: String, playerId: String?, headshotUrl: String?,
        team: String?, opponent: String?, isHome: Bool?, position: String?,
        gameId: String, eventId: String?, gameDate: String, slot: String?,
        week: Int?, reportStatus: String?, practiceStatus: String?,
        markets: [NFLPropMarket]
    ) {
        self.playerName = playerName
        self.playerId = playerId
        self.headshotUrl = headshotUrl
        self.team = team
        self.opponent = opponent
        self.isHome = isHome
        self.position = position
        self.gameId = gameId
        self.eventId = eventId
        self.gameDate = gameDate
        self.slot = slot
        self.week = week
        self.reportStatus = reportStatus
        self.practiceStatus = practiceStatus
        self.markets = markets
    }
}

// MARK: - Helpers

public enum NFLPlayerProps {
    /// Display order for the markets the dry-run publishes; unknown keys sort
    /// after, alphabetically, so new server-side markets degrade gracefully.
    static let marketOrder: [String] = [
        "player_pass_yds", "player_pass_tds", "player_rush_yds",
        "player_reception_yds", "player_receptions", "player_anytime_td",
    ]

    static let marketLabels: [String: String] = [
        "player_pass_yds": "Pass Yards",
        "player_pass_tds": "Pass TDs",
        "player_pass_attempts": "Pass Attempts",
        "player_pass_completions": "Completions",
        "player_pass_interceptions": "Interceptions",
        "player_rush_yds": "Rush Yards",
        "player_rush_attempts": "Rush Attempts",
        "player_rush_tds": "Rush TDs",
        "player_reception_yds": "Rec Yards",
        "player_receptions": "Receptions",
        "player_reception_tds": "Rec TDs",
        "player_anytime_td": "Anytime TD",
        "player_kicking_points": "Kicking Points",
        "player_field_goals": "Field Goals",
        "player_sacks": "Sacks",
        "player_tackles_assists": "Tackles + Ast",
    ]

    public static func marketLabel(_ market: String) -> String {
        if let label = marketLabels[market] { return label }
        // "player_some_stat" → "Some Stat"
        return market
            .replacingOccurrences(of: "player_", with: "")
            .split(separator: "_")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    public static func marketSortIndex(_ market: String) -> Int {
        marketOrder.firstIndex(of: market) ?? 999
    }

    /// Same American-odds convention as the MLB props surfaces.
    public static func formatOdds(_ odds: Int?) -> String {
        guard let odds else { return "-" }
        return odds > 0 ? "+\(odds)" : "\(odds)"
    }

    public static func formatLine(_ line: Double?) -> String {
        guard let line, line.isFinite else { return "-" }
        return line == line.rounded() ? String(Int(line)) : String(format: "%.1f", line)
    }

    /// "0.62" → "62%".
    public static func formatPct(_ p: Double?) -> String {
        guard let p, p.isFinite else { return "-" }
        return "\(Int((p * 100).rounded()))%"
    }

    // MARK: Schedule slots

    static let slotLabels: [String: String] = [
        "thu_fri": "Thu/Fri",
        "sun_early": "Sun Early",
        "sun_late_sat": "Sun Late",
        "snf": "SNF",
        "monday": "MNF",
    ]

    static let slotSequence: [String] = ["thu_fri", "sun_early", "sun_late_sat", "snf", "monday"]

    public static func slotLabel(_ slot: String?) -> String? {
        guard let slot else { return nil }
        return slotLabels[slot] ?? slot.replacingOccurrences(of: "_", with: " ").capitalized
    }

    public static func slotOrder(_ slot: String?) -> Int {
        guard let slot else { return 9 }
        return slotSequence.firstIndex(of: slot) ?? 9
    }

    // MARK: Grouping

    /// Group raw (player, market) rows into per-player entities. Markets
    /// follow `marketOrder`; players come back sorted by gameday → schedule
    /// slot → name (feed-ready). `games` joins kickoff context by `game_id`.
    public static func group(
        _ rows: [NFLDryrunPropRow],
        games: [String: NFLPropGameContext] = [:]
    ) -> [NFLPropPlayer] {
        struct PlayerKey: Hashable {
            let game: String
            let player: String
        }
        let byPlayer = Dictionary(grouping: rows) { row in
            PlayerKey(game: row.gameId, player: row.playerId ?? row.playerName.lowercased())
        }

        let players: [NFLPropPlayer] = byPlayer.values.compactMap { playerRows in
            guard let first = playerRows.first else { return nil }
            let markets: [NFLPropMarket] = playerRows
                .map { r in
                    NFLPropMarket(
                        market: r.market,
                        closeLine: r.closeLine,
                        openLine: r.openLine,
                        lineDelta: r.lineDelta,
                        lineRange: r.lineRange,
                        overPrice: r.overPrice.map { Int($0.rounded()) },
                        underPrice: r.underPrice.map { Int($0.rounded()) },
                        nBooks: r.nBooks,
                        closeYesProb: r.closeYesProb,
                        openYesProb: r.openYesProb,
                        lastGame: r.lastGame,
                        l3Avg: r.l3Avg, l5Avg: r.l5Avg, l10Avg: r.l10Avg,
                        sznAvg: r.sznAvg, sznMax: r.sznMax, sznMin: r.sznMin,
                        overRateL5: r.overRateL5, overRateL10: r.overRateL10,
                        defMatchupIdx: r.defMatchupIdx,
                        flags: r.flags ?? [],
                        recentGames: r.recentGames ?? []
                    )
                }
                .sorted { a, b in
                    let ai = marketSortIndex(a.market), bi = marketSortIndex(b.market)
                    if ai != bi { return ai < bi }
                    return a.market < b.market
                }

            let context = games[first.gameId]
            return NFLPropPlayer(
                playerName: first.playerName,
                playerId: first.playerId,
                headshotUrl: first.headshotUrl,
                team: first.team,
                opponent: first.opponent,
                isHome: first.isHome,
                position: first.position,
                gameId: first.gameId,
                eventId: first.eventId,
                gameDate: context?.gameDate ?? "",
                slot: context?.slot,
                week: first.week,
                reportStatus: first.reportStatus,
                practiceStatus: first.practiceStatus,
                markets: markets
            )
        }

        return players.sorted { a, b in
            if a.sortKey != b.sortKey { return a.sortKey < b.sortKey }
            return a.playerName < b.playerName
        }
    }
}

// MARK: - NFL team identity

/// Static NFL team identity map (abbr + city + full-name aliases → ESPN
/// slug). Team columns across feeds may carry any of those formats, so every
/// lookup normalizes through here.
public enum NFLTeams {
    /// slug → (abbr, city, mascot). Slug doubles as the ESPN logo key.
    private static let teams: [(slug: String, abbr: String, city: String, mascot: String)] = [
        ("ari", "ARI", "Arizona", "Cardinals"),
        ("atl", "ATL", "Atlanta", "Falcons"),
        ("bal", "BAL", "Baltimore", "Ravens"),
        ("buf", "BUF", "Buffalo", "Bills"),
        ("car", "CAR", "Carolina", "Panthers"),
        ("chi", "CHI", "Chicago", "Bears"),
        ("cin", "CIN", "Cincinnati", "Bengals"),
        ("cle", "CLE", "Cleveland", "Browns"),
        ("dal", "DAL", "Dallas", "Cowboys"),
        ("den", "DEN", "Denver", "Broncos"),
        ("det", "DET", "Detroit", "Lions"),
        ("gb", "GB", "Green Bay", "Packers"),
        ("hou", "HOU", "Houston", "Texans"),
        ("ind", "IND", "Indianapolis", "Colts"),
        ("jax", "JAX", "Jacksonville", "Jaguars"),
        ("kc", "KC", "Kansas City", "Chiefs"),
        ("lv", "LV", "Las Vegas", "Raiders"),
        ("lac", "LAC", "Los Angeles Chargers", "Chargers"),
        ("lar", "LAR", "Los Angeles Rams", "Rams"),
        ("mia", "MIA", "Miami", "Dolphins"),
        ("min", "MIN", "Minnesota", "Vikings"),
        ("ne", "NE", "New England", "Patriots"),
        ("no", "NO", "New Orleans", "Saints"),
        ("nyg", "NYG", "New York Giants", "Giants"),
        ("nyj", "NYJ", "New York Jets", "Jets"),
        ("phi", "PHI", "Philadelphia", "Eagles"),
        ("pit", "PIT", "Pittsburgh", "Steelers"),
        ("sf", "SF", "San Francisco", "49ers"),
        ("sea", "SEA", "Seattle", "Seahawks"),
        ("tb", "TB", "Tampa Bay", "Buccaneers"),
        ("ten", "TEN", "Tennessee", "Titans"),
        ("wsh", "WSH", "Washington", "Commanders"),
    ]

    /// Lowercased alias → slug. Built once; covers abbr ("KC"), city
    /// ("Kansas City"), mascot ("Chiefs"), full name, and common alt abbrs.
    private static let slugByAlias: [String: String] = {
        var map: [String: String] = [:]
        for t in teams {
            map[t.abbr.lowercased()] = t.slug
            map[t.city.lowercased()] = t.slug
            map[t.mascot.lowercased()] = t.slug
            map["\(t.city) \(t.mascot)".lowercased()] = t.slug
        }
        // Alt abbreviations seen across feeds (nflverse uses LA for the Rams).
        map["was"] = "wsh"; map["jac"] = "jax"; map["lvr"] = "lv"
        map["nor"] = "no"; map["nwe"] = "ne"; map["gnb"] = "gb"
        map["kan"] = "kc"; map["sfo"] = "sf"; map["tam"] = "tb"
        map["la"] = "lar"; map["la chargers"] = "lac"; map["la rams"] = "lar"
        map["ny giants"] = "nyg"; map["ny jets"] = "nyj"
        return map
    }()

    public static func slug(for team: String) -> String? {
        slugByAlias[team.trimmingCharacters(in: .whitespaces).lowercased()]
    }

    /// "KC" — falls back to up-to-3 initials for unmapped strings.
    public static func abbr(for team: String) -> String {
        if let slug = slug(for: team),
           let entry = teams.first(where: { $0.slug == slug }) {
            return entry.abbr
        }
        let trimmed = team.trimmingCharacters(in: .whitespaces)
        if trimmed.count <= 3 { return trimmed.uppercased() }
        return trimmed.split(separator: " ").compactMap(\.first).prefix(3).map(String.init).joined().uppercased()
    }

    /// "Buffalo Bills" for any alias/abbr format; nil when unmapped.
    public static func fullName(for team: String) -> String? {
        guard let slug = slug(for: team),
              let entry = teams.first(where: { $0.slug == slug }) else { return nil }
        return "\(entry.city) \(entry.mascot)"
    }

    public static func logoUrl(for team: String) -> String? {
        guard let slug = slug(for: team) else { return nil }
        return "https://a.espncdn.com/i/teamlogos/nfl/500/\(slug).png"
    }

    /// Two team strings refer to the same franchise (any alias format).
    public static func matches(_ a: String, _ b: String) -> Bool {
        if let sa = slug(for: a), let sb = slug(for: b) { return sa == sb }
        return a.compare(b, options: [.caseInsensitive]) == .orderedSame
    }

    /// ESPN headshot for numeric player ids; nil otherwise (the card falls
    /// back to an initials disc).
    public static func headshotUrl(playerId: String?) -> String? {
        guard let playerId, Int(playerId) != nil else { return nil }
        return "https://a.espncdn.com/i/headshots/nfl/players/full/\(playerId).png"
    }
}
