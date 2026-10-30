import Foundation

// MARK: - Spotlight, books, slate, cheat sheet

public struct NflPropTell: Decodable, Hashable, Sendable {
    public let family: String?
    public let dir: String?
    public let src: String?
    public let text: String

    public init(family: String? = nil, dir: String? = nil, src: String? = nil, text: String) {
        self.family = family
        self.dir = dir
        self.src = src
        self.text = text
    }
}

public struct NflPropSpotlightRow: Decodable, Hashable, Sendable, Identifiable {
    public let season: Int
    public let week: Int
    public let playerId: String
    public let playerName: String
    public let position: String?
    public let team: String?
    public let opponent: String?
    public let market: String
    public let marketLabel: String?
    public let side: String?
    public let line: Double?
    public let net: Double?
    public let nFor: Int?
    public let nAgainst: Int?
    public let boardRank: Int?
    public let tells: [NflPropTell]
    public let narrative: String?
    public let result: String?
    public let actualValue: Double?
    public let kickoff: String?
    public let headshotUrl: String?
    public let price: Double?
    public let bookName: String?
    public let units: Double?

    public var id: String { "\(season)-\(week)-\(playerId)-\(market)" }

    enum CodingKeys: String, CodingKey {
        case season, week
        case playerId = "player_id"
        case playerName = "player_name"
        case position, team, opponent, market
        case marketLabel = "market_label"
        case side, line, net
        case nFor = "n_for"
        case nAgainst = "n_against"
        case boardRank = "board_rank"
        case tells, narrative, result
        case actualValue = "actual_value"
        case kickoff
        case headshotUrl = "headshot_url"
        case price
        case bookName = "book_name"
        case units
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        season = Self.int(c, .season) ?? 0
        week = Self.int(c, .week) ?? 0
        playerId = (try? c.decodeIfPresent(String.self, forKey: .playerId)) ?? ""
        playerName = (try? c.decodeIfPresent(String.self, forKey: .playerName)) ?? ""
        position = try? c.decodeIfPresent(String.self, forKey: .position)
        team = try? c.decodeIfPresent(String.self, forKey: .team)
        opponent = try? c.decodeIfPresent(String.self, forKey: .opponent)
        market = (try? c.decodeIfPresent(String.self, forKey: .market)) ?? ""
        marketLabel = try? c.decodeIfPresent(String.self, forKey: .marketLabel)
        side = try? c.decodeIfPresent(String.self, forKey: .side)
        line = Self.double(c, .line)
        net = Self.double(c, .net)
        nFor = Self.int(c, .nFor)
        nAgainst = Self.int(c, .nAgainst)
        boardRank = Self.int(c, .boardRank)
        tells = (try? c.decodeIfPresent([NflPropTell].self, forKey: .tells)) ?? []
        narrative = try? c.decodeIfPresent(String.self, forKey: .narrative)
        result = try? c.decodeIfPresent(String.self, forKey: .result)
        actualValue = Self.double(c, .actualValue)
        kickoff = try? c.decodeIfPresent(String.self, forKey: .kickoff)
        headshotUrl = try? c.decodeIfPresent(String.self, forKey: .headshotUrl)
        price = Self.double(c, .price)
        bookName = try? c.decodeIfPresent(String.self, forKey: .bookName)
        units = Self.double(c, .units)
    }

    private static func int(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(value) }
        return nil
    }

    private static func double(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(value) }
        if let raw = try? c.decodeIfPresent(String.self, forKey: key) { return Double(raw) }
        return nil
    }
}

public struct NflPropBookQuote: Decodable, Hashable, Sendable {
    public let playerId: String
    public let market: String
    public let overBook: String?
    public let overLine: Double?
    public let overPrice: Double?
    public let underBook: String?
    public let underLine: Double?
    public let underPrice: Double?

    public var key: String { "\(playerId):\(market)" }

    enum CodingKeys: String, CodingKey {
        case playerId = "player_id"
        case market
        case overBook = "best_over_book"
        case overLine = "best_over_line"
        case overPrice = "best_over_price"
        case underBook = "best_under_book"
        case underLine = "best_under_line"
        case underPrice = "best_under_price"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        playerId = (try? c.decodeIfPresent(String.self, forKey: .playerId)) ?? ""
        market = (try? c.decodeIfPresent(String.self, forKey: .market)) ?? ""
        overBook = try? c.decodeIfPresent(String.self, forKey: .overBook)
        underBook = try? c.decodeIfPresent(String.self, forKey: .underBook)
        overLine = Self.num(c, .overLine)
        overPrice = Self.num(c, .overPrice)
        underLine = Self.num(c, .underLine)
        underPrice = Self.num(c, .underPrice)
    }

    private static func num(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Double? {
        if let value = try? c.decodeIfPresent(Double.self, forKey: key) { return value }
        if let value = try? c.decodeIfPresent(Int.self, forKey: key) { return Double(value) }
        return nil
    }
}

public struct NflSlateContextLine: Decodable, Hashable, Sendable {
    public let homeAb: String?
    public let awayAb: String?
    public let spreadClose: Double?
    public let totalClose: Double?
    public let indoors: Bool?
    public let summary: String?
    public let tempF: Double?
    public let windMph: Double?
    public let precipMm: Double?

    enum CodingKeys: String, CodingKey {
        case homeAb = "home_ab"
        case awayAb = "away_ab"
        case spreadClose = "fg_spread_close"
        case totalClose = "fg_total_close"
        case indoors = "wx_indoors"
        case summary = "wx_summary"
        case tempF = "wx_temp_f"
        case windMph = "wx_wind_mph"
        case precipMm = "wx_precip_mm"
    }
}

public struct NflCheatMetric: Hashable, Sendable {
    public let actual: Double?
    public let league: Double?
    public let lift: Double?
    public let rank: Double?
    public let of: Double?
}

public struct NflCheatPlayer: Hashable, Sendable {
    public let name: String
    public let playerId: String
    public let position: String?
    public let share: Double?
    public let shareLabel: String?
}

public struct NflCheatRow: Hashable, Sendable, Identifiable {
    public let family: String
    public let tableKey: String
    public let positionFilter: String?
    public let alignmentFilter: String?
    public let side: String
    public let team: String
    public let opponent: String
    public let kickoff: String?
    public let headline: String?
    public let metrics: [String: NflCheatMetric]
    public let player: NflCheatPlayer?

    public var id: String { "\(tableKey)|\(team)|\(side)" }
}

public struct NflTrenchRow: Hashable, Sendable, Identifiable {
    public let team: String
    public let opponent: String
    public let kickoff: String?
    public let passEdge: Double?
    public let runEdge: Double?
    public let pressure: NflCheatMetric?
    public let yardsBeforeContact: NflCheatMetric?
    public let frontPressure: NflCheatMetric?
    public let frontYards: NflCheatMetric?

    public var id: String { team }
}

// MARK: - Lean

public struct NflMarketScore: Hashable, Sendable {
    public let market: String
    public let populated: Int
    public let nFor: Int
    public let nAgainst: Int
    public let direction: String
    public let netShare: Double
    public let lean: Bool
}

public enum NflPropLean {
    public static let minPop = 3
    public static let leanMinPop = 4

    private static let deadPct = 0.03
    private static let deadLine = 0.04
    private static let marketStat: [String: String] = [
        "player_reception_yds": "rec_yds",
        "player_receptions": "receptions",
        "player_rush_yds": "rush_yds",
        "player_rush_attempts": "rush_att",
        "player_pass_yds": "pass_yds",
        "player_pass_tds": "pass_td",
        "player_pass_attempts": "pass_att",
        "player_pass_completions": "completions",
    ]

    public static func bestMarket(_ page: NFLPropPlayerPage) -> NflMarketScore? {
        let scores = page.markets
            .filter { $0.status == "posted" && marketStat[$0.key] != nil }
            .map { score($0.key, page: page) }
            .filter { $0.populated >= minPop }
        return scores.max { lhs, rhs in
            if lhs.netShare != rhs.netShare { return lhs.netShare < rhs.netShare }
            return lhs.populated < rhs.populated
        }
    }

    public static func hasLean(_ page: NFLPropPlayerPage) -> Bool {
        page.markets.contains { $0.status == "posted" && score($0.key, page: page).lean }
    }

    public static func score(_ market: String, page: NFLPropPlayerPage) -> NflMarketScore {
        var votes: [Int] = []
        let stat = marketStat[market]
        let line = page.markets.first { $0.key == market }?.line
        if let projected = projectionValue(page.projection[market]), let line, line != 0 {
            votes.append(sign(projected / line - 1, dead: deadLine))
        }
        if let stat, let base = page.baseline[stat], let line, line != 0 {
            votes.append(sign(base / line - 1, dead: deadLine))
        }
        let position = page.fpCards?["matchup"]?["vs_position"]
        if let stat, let actual = position?["\(stat)_actual"]?.doubleValue, let league = position?["\(stat)_league"]?.doubleValue, league != 0 {
            votes.append(sign(actual / league - 1, dead: deadPct))
        }
        if ["player_reception_yds", "player_receptions"].contains(market) {
            votes.append(contentsOf: alignmentVote(page))
            votes.append(contentsOf: routeVote(page))
        }
        if ["player_pass_yds", "player_pass_completions", "player_pass_attempts"].contains(market) {
            votes.append(contentsOf: blobVote(page, blob: "throw_depth"))
        }
        if ["player_rush_yds", "player_rush_attempts"].contains(market) {
            votes.append(contentsOf: blobVote(page, blob: "run_concept"))
        }
        let decided = votes.filter { $0 != 0 }
        let nFor = decided.filter { $0 > 0 }.count
        let nAgainst = decided.filter { $0 < 0 }.count
        let populated = decided.count
        let net = populated == 0 ? 0 : Double(abs(nFor - nAgainst)) / Double(populated)
        let direction = nFor > nAgainst ? "over" : nAgainst > nFor ? "under" : "split"
        let lean = populated >= leanMinPop && nFor != nAgainst && Double(max(nFor, nAgainst)) / Double(populated) >= 1
        return NflMarketScore(market: market, populated: populated, nFor: nFor, nAgainst: nAgainst, direction: direction, netShare: net, lean: lean)
    }

    private static func projectionValue(_ projection: NFLPropProjection?) -> Double? {
        switch projection {
        case .point(let value, _, _): return value
        case .rate(let scoreRate, _, _): return scoreRate
        case nil: return nil
        }
    }

    private static func sign(_ value: Double, dead: Double) -> Int {
        if abs(value) < dead { return 0 }
        return value > 0 ? 1 : -1
    }

    private static func alignmentVote(_ page: NFLPropPlayerPage) -> [Int] {
        let alignment = page.fpCards?["matchup"]?["vs_alignment"]
        let role = page.fpCards?["role"]
        var defenseWeight = 0.0
        var leagueWeight = 0.0
        for spot in ["wide", "slot", "inline", "backfield"] {
            let share = role?["align_\(spot)_share"]?.doubleValue ?? 0
            let cell = alignment?[spot]
            guard share > 0, let actual = cell?["yds_actual"]?.doubleValue, let league = cell?["yds_league"]?.doubleValue else { continue }
            defenseWeight += share * actual
            leagueWeight += share * league
        }
        guard leagueWeight != 0 else { return [] }
        return [sign(defenseWeight / leagueWeight - 1, dead: deadPct)]
    }

    private static func routeVote(_ page: NFLPropPlayerPage) -> [Int] {
        var numerator = 0.0
        var denominator = 0.0
        for leaf in page.fpCards?["routes"]?.arrayValue ?? [] {
            guard let volume = leaf["routes"]?.doubleValue, volume > 0,
                  let given = leaf["def_yards_per_route_actual"]?.doubleValue,
                  let typical = leaf["def_yards_per_route_league"]?.doubleValue else { continue }
            numerator += volume * (given - typical)
            denominator += volume * typical
        }
        guard denominator != 0 else { return [] }
        return [sign(numerator / denominator, dead: deadPct)]
    }

    private static func blobVote(_ page: NFLPropPlayerPage, blob: String) -> [Int] {
        var numerator = 0.0
        var denominator = 0.0
        for (_, cell) in page.fpCards?[blob]?["by"]?.objectValue ?? [:] {
            guard let volume = cell["attempts"]?.doubleValue, volume > 0,
                  let given = cell["def_yards_per_attempt"]?.doubleValue,
                  let typical = cell["def_yards_per_attempt_league"]?.doubleValue else { continue }
            numerator += volume * (given - typical)
            denominator += volume * typical
        }
        guard denominator != 0 else { return [] }
        return [sign(numerator / denominator, dead: deadPct)]
    }
}

// MARK: - Cheat sheet math

public enum NflCheatSheetMath {
    public enum Tone { case pos, neg, nilTone }
    public enum Kind { case rate, pp, yards, decimal }

    public static let columns: [String: [String]] = [
        "pass_off": ["cpoe", "sack_rate", "pressure_oe", "off_target_rate", "deep_rate", "explosive_rate", "success_rate", "td_rate"],
        "pass_def": ["cpoe", "sack_rate", "pressure_oe", "off_target_rate", "deep_rate", "explosive_rate", "success_rate", "td_rate", "man_share", "zone_share"],
        "rush_off": ["success_rate", "stuff_rate", "mtf_per_att", "explosive_rate", "td_rate"],
        "rush_def_RB": ["success_rate", "stuff_rate", "mtf_per_att", "explosive_rate", "td_rate"],
        "rush_def_QB": ["success_rate", "stuff_rate", "explosive_rate", "td_rate"],
        "recv_off": ["yoe_per_target", "targets_per_route", "catch_rate", "first_read_rate", "deep_rate", "yac_per_att", "explosive_rate", "td_rate"],
        "recv_def_WR": ["yoe_per_target", "catch_rate", "target_catchable_rate", "deep_rate", "yac_per_att", "explosive_rate", "td_rate", "man_success", "zone_success"],
        "recv_def_TE": ["yoe_per_target", "catch_rate", "deep_rate", "yac_per_att", "td_rate", "inline_share", "man_success", "zone_success"],
        "recv_def_RB": ["yoe_per_target", "catch_rate", "checkdown_rate", "yac_per_att", "backfield_share", "td_rate"],
        "recv_def_slot": ["yoe_per_target", "slot_share", "catch_rate", "yac_per_att", "explosive_rate", "td_rate"],
        "recv_def_wide": ["yoe_per_target", "wide_share", "catch_rate", "deep_rate", "explosive_rate", "td_rate"],
    ]

    public static let labels: [String: String] = [
        "cpoe": "CPOE", "sack_rate": "Sack rate", "pressure_oe": "Pressure OE",
        "off_target_rate": "Off-target", "deep_rate": "Deep rate", "explosive_rate": "Explosive",
        "success_rate": "Success", "td_rate": "TD rate", "stuff_rate": "Stuff rate",
        "mtf_per_att": "Missed tackles", "yac_per_att": "YAC", "yoe_per_target": "Yards over expected",
        "targets_per_route": "Targets / route", "catch_rate": "Catch rate", "target_catchable_rate": "Catchable",
        "first_read_rate": "First read", "checkdown_rate": "Checkdown", "man_share": "Man", "zone_share": "Zone",
        "man_success": "Success vs man", "zone_success": "Success vs zone", "slot_share": "Slot",
        "wide_share": "Wide", "inline_share": "Inline", "backfield_share": "Backfield",
    ]

    public static let help: [String: String] = [
        "cpoe": "Completion percentage over expected, versus the league rate.",
        "sack_rate": "Share of dropbacks that end in a sack.",
        "pressure_oe": "Pressure over expected, in percentage points versus the league.",
        "success_rate": "Share of plays that count as a success for the offense.",
        "stuff_rate": "Share of runs stopped at or behind the line.",
        "yoe_per_target": "Receiving yards over expected per target.",
        "targets_per_route": "Targets earned per route run.",
    ]

    private static let high = Set(["success_rate", "yac_per_att", "mtf_per_att", "explosive_rate", "td_rate", "zone_success", "man_success", "cpoe", "yoe_per_target", "targets_per_route", "catch_rate", "target_catchable_rate"])
    private static let low = Set(["stuff_rate", "pressure_oe", "sack_rate", "off_target_rate"])
    private static let neutral = Set(["zone_share", "man_share", "deep_rate", "checkdown_rate", "first_read_rate", "slot_share", "wide_share", "inline_share", "backfield_share"])

    public static func label(_ key: String) -> String { labels[key] ?? key }
    public static func helpText(_ key: String) -> String {
        help[key] ?? "This team against the league at the same denominator."
    }

    public static func polarity(side: String, key: String) -> String {
        if neutral.contains(key) || (!high.contains(key) && !low.contains(key)) { return "neutral" }
        let offense = high.contains(key) ? "high" : "low"
        if side == "defense" { return offense == "high" ? "low" : "high" }
        return offense
    }

    public static func direction(side: String, key: String) -> String {
        switch polarity(side: side, key: key) {
        case "neutral": return "This is a mix, not an edge, so it stays grey."
        case "high": return "Higher favors this \(side == "defense" ? "defense" : "offense"). Green means it does. 1st is the best for them."
        default: return "Lower favors this \(side == "defense" ? "defense" : "offense"). Green means it does. 1st is the best for them."
        }
    }

    public static func formatActual(_ key: String, _ actual: Double?) -> String {
        guard let actual else { return "not charted this week" }
        switch kind(key) {
        case .pp: return "\(signed(actual * 100, digits: 1)) pp"
        case .rate: return String(format: "%.1f%%", actual * 100)
        case .decimal: return String(format: "%.3f", actual)
        case .yards:
            let unit = key == "mtf_per_att" ? "per att" : (key == "targets_per_route" ? "" : "yds")
            return unit.isEmpty ? String(format: "%.2f", actual) : String(format: "%.2f %@", actual, unit)
        }
    }

    public static func gap(side: String, key: String, metric: NflCheatMetric) -> (text: String, tone: Tone)? {
        guard let raw = rawGap(key, metric) else { return nil }
        let tone = toneFor(side: side, key: key, gap: raw)
        switch kind(key) {
        case .pp: return ("\(signed(raw, digits: 1)) pp", tone)
        case .yards: return ("\(signed(raw, digits: 2)) yds", tone)
        case .decimal: return (signed(raw, digits: 3), tone)
        case .rate: return ("\(signed(raw * 100, digits: 1))%", tone)
        }
    }

    public static func rankLabel(side: String, key: String, metric: NflCheatMetric) -> String? {
        guard let rank = metric.rank, let of = metric.of else { return nil }
        let stored = Int(rank.rounded())
        let n = Int(of.rounded())
        let shown = polarity(side: side, key: key) == "low" ? n - stored + 1 : stored
        return "\(ordinal(shown)) of \(n)"
    }

    public static func teamEdge(side: String, key: String, metric: NflCheatMetric) -> Double? {
        guard let gap = rawGap(key, metric) else { return nil }
        return polarity(side: side, key: key) == "low" ? -gap : gap
    }

    public static func parseRows(_ raw: [NflCheatRawRow]) -> [NflCheatRow] {
        raw.map { row in
            var metrics: [String: NflCheatMetric] = [:]
            for (key, value) in row.metrics?.objectValue ?? [:] {
                guard let object = value.objectValue else { continue }
                metrics[key] = NflCheatMetric(
                    actual: object["actual"]?.doubleValue,
                    league: object["league"]?.doubleValue,
                    lift: object["lift"]?.doubleValue,
                    rank: object["rank"]?.doubleValue,
                    of: object["of"]?.doubleValue
                )
            }
            let playerObject = row.player?.objectValue
            let player = playerObject.flatMap { object -> NflCheatPlayer? in
                guard let name = object["name"]?.stringValue else { return nil }
                return NflCheatPlayer(
                    name: name,
                    playerId: object["player_id"]?.stringValue ?? "",
                    position: object["position"]?.stringValue,
                    share: object["share"]?.doubleValue,
                    shareLabel: object["share_label"]?.stringValue
                )
            }
            return NflCheatRow(
                family: row.family ?? "",
                tableKey: row.tableKey ?? "",
                positionFilter: row.positionFilter,
                alignmentFilter: row.alignmentFilter,
                side: row.side ?? "offense",
                team: row.team ?? "",
                opponent: row.opponent ?? "",
                kickoff: row.kickoff,
                headline: row.headline,
                metrics: metrics,
                player: player
            )
        }
    }

    public static func trenchRows(from pages: [NFLPropPlayerPage]) -> [NflTrenchRow] {
        var seen = Set<String>()
        var rows: [NflTrenchRow] = []
        for page in pages {
            guard let team = page.team?.trimmingCharacters(in: .whitespaces), !team.isEmpty, !seen.contains(team),
                  let trenches = page.fpCards?["trenches"] else { continue }
            let line = trenches["line"]
            let front = trenches["front"]
            let passEdge = trenches["pass_pro_edge"]?.doubleValue
            let runEdge = trenches["run_block_edge"]?.doubleValue
            let pressure = trenchMeasure(line, "ol_pressure_faced")
            let yards = trenchMeasure(line, "ol_ybc_per_att")
            let frontPressure = trenchMeasure(front, "dl_pressure_generated")
            let frontYards = trenchMeasure(front, "dl_ybc_allowed")
            if passEdge == nil && runEdge == nil && pressure == nil && yards == nil && frontPressure == nil && frontYards == nil { continue }
            seen.insert(team)
            rows.append(NflTrenchRow(
                team: team,
                opponent: page.opponent?.trimmingCharacters(in: .whitespaces) ?? "",
                kickoff: page.kickoff,
                passEdge: passEdge,
                runEdge: runEdge,
                pressure: pressure,
                yardsBeforeContact: yards,
                frontPressure: frontPressure,
                frontYards: frontYards
            ))
        }
        return rows
    }

    /// Pass edge is a pressure-rate gap. Run edge is yards before contact. Positive favors the line.
    public static func formatTrenchEdge(pass: Bool, value: Double?) -> (text: String, tone: Tone)? {
        guard let value, value.isFinite else { return nil }
        if pass {
            let points = value * 100
            let tone: Tone = abs(points) < 1 ? .nilTone : (points > 0 ? .pos : .neg)
            return ("\(signed(points, digits: 1)) pp", tone)
        }
        let tone: Tone = abs(value) < 0.15 ? .nilTone : (value > 0 ? .pos : .neg)
        return ("\(signed(value, digits: 2)) yds", tone)
    }

    private static func trenchMeasure(_ blob: JSONValue?, _ key: String) -> NflCheatMetric? {
        guard let actual = blob?[key]?.doubleValue else { return nil }
        let league = blob?["\(key)_league"]?.doubleValue
        return NflCheatMetric(
            actual: actual,
            league: league,
            lift: league.flatMap { $0 == 0 ? nil : actual / $0 - 1 },
            rank: blob?["\(key)_rank"]?.doubleValue,
            of: blob?["\(key)_of"]?.doubleValue
        )
    }

    private static func kind(_ key: String) -> Kind {
        switch key {
        case "cpoe", "pressure_oe": return .pp
        case "mtf_per_att", "yac_per_att", "yoe_per_target": return .yards
        case "targets_per_route": return .decimal
        default: return .rate
        }
    }

    private static func rawGap(_ key: String, _ metric: NflCheatMetric) -> Double? {
        switch kind(key) {
        case .pp:
            guard let actual = metric.actual, let league = metric.league else { return nil }
            return (actual - league) * 100
        case .yards, .decimal:
            guard let actual = metric.actual, let league = metric.league else { return nil }
            return actual - league
        case .rate:
            return metric.lift
        }
    }

    private static func dead(_ key: String) -> Double {
        switch key {
        case "mtf_per_att": return 0.02
        case "yac_per_att": return 0.15
        case "yoe_per_target": return 0.25
        case "targets_per_route": return 0.004
        default:
            switch kind(key) {
            case .pp: return 1
            case .yards: return 0.25
            case .decimal: return 0.004
            case .rate: return 0.01
            }
        }
    }

    private static func toneFor(side: String, key: String, gap: Double) -> Tone {
        let pole = polarity(side: side, key: key)
        if pole == "neutral" || abs(gap) < dead(key) { return .nilTone }
        return (pole == "high") == (gap > 0) ? .pos : .neg
    }

    private static func signed(_ value: Double, digits: Int) -> String {
        let body = String(format: "%.\(digits)f", abs(value))
        if value > 0 { return "+\(body)" }
        if value < 0 { return "−\(body)" }
        return body
    }

    private static func ordinal(_ n: Int) -> String {
        let mod = n % 100
        let suffix: String
        if (11...13).contains(mod) { suffix = "th" }
        else {
            switch n % 10 {
            case 1: suffix = "st"
            case 2: suffix = "nd"
            case 3: suffix = "rd"
            default: suffix = "th"
            }
        }
        return "\(n)\(suffix)"
    }
}

public struct NflCheatRawRow: Decodable, Sendable {
    public let family: String?
    public let tableKey: String?
    public let positionFilter: String?
    public let alignmentFilter: String?
    public let side: String?
    public let team: String?
    public let opponent: String?
    public let kickoff: String?
    public let headline: String?
    public let metrics: JSONValue?
    public let player: JSONValue?

    enum CodingKeys: String, CodingKey {
        case family
        case tableKey = "table_key"
        case positionFilter = "position_filter"
        case alignmentFilter = "alignment_filter"
        case side, team, opponent, kickoff, metrics, headline, player
    }
}

// MARK: - Record

public struct NflMarketRecord: Hashable, Sendable, Identifiable {
    public let label: String
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let units: Double
    public let graded: Int
    public var id: String { label }
    public var roi: Double? { graded > 0 ? units / Double(graded) : nil }
    public var winRate: Double? {
        let decided = wins + losses
        return decided > 0 ? Double(wins) / Double(decided) : nil
    }
}

public struct NflLedgerSummary: Hashable, Sendable {
    public let wins: Int
    public let losses: Int
    public let pushes: Int
    public let graded: Int
    public let pending: Int
    public let units: Double
    public let markets: [NflMarketRecord]
    public var roi: Double? { graded > 0 ? units / Double(graded) : nil }
    public var winRate: Double? {
        let decided = wins + losses
        return decided > 0 ? Double(wins) / Double(decided) : nil
    }
}

public enum NflPropRecord {
    public static func summarize(_ rows: [NflPropSpotlightRow]) -> NflLedgerSummary {
        var wins = 0, losses = 0, pushes = 0, pending = 0
        var units = 0.0
        var buckets: [String: (wins: Int, losses: Int, pushes: Int, units: Double, graded: Int)] = [:]
        for row in rows {
            guard let result = resultOf(row.result) else {
                pending += 1
                continue
            }
            switch result {
            case "win": wins += 1
            case "loss": losses += 1
            default: pushes += 1
            }
            if let value = row.units { units += value }
            let label = row.marketLabel ?? row.market
            var bucket = buckets[label] ?? (0, 0, 0, 0, 0)
            bucket.graded += 1
            switch result {
            case "win": bucket.wins += 1
            case "loss": bucket.losses += 1
            default: bucket.pushes += 1
            }
            if let value = row.units { bucket.units += value }
            buckets[label] = bucket
        }
        let markets = buckets.map { label, bucket in
            NflMarketRecord(label: label, wins: bucket.wins, losses: bucket.losses, pushes: bucket.pushes, units: bucket.units, graded: bucket.graded)
        }.sorted { $0.label < $1.label }
        return NflLedgerSummary(wins: wins, losses: losses, pushes: pushes, graded: wins + losses + pushes, pending: pending, units: units, markets: markets)
    }

    public static func gradedHistory(_ rows: [NflPropSpotlightRow]) -> [NflPropSpotlightRow] {
        rows.filter { resultOf($0.result) != nil }
            .sorted { lhs, rhs in
                if lhs.season != rhs.season { return lhs.season > rhs.season }
                if lhs.week != rhs.week { return lhs.week > rhs.week }
                return (lhs.boardRank ?? 99) < (rhs.boardRank ?? 99)
            }
    }

    public static func formatUnits(_ units: Double?) -> String? {
        guard let units, units.isFinite else { return nil }
        let body = String(format: "%.2f", abs(units))
        if units > 0 { return "+\(body)" }
        if units < 0 { return "−\(body)" }
        return "0.00"
    }

    public static func formatRoi(_ roi: Double?) -> String? {
        guard let roi, roi.isFinite else { return nil }
        let body = String(format: "%.1f", abs(roi * 100))
        if roi > 0 { return "+\(body)%" }
        if roi < 0 { return "−\(body)%" }
        return "0.0%"
    }

    public static func formatAmerican(_ price: Double?) -> String? {
        guard let price else { return nil }
        let rounded = Int(price.rounded())
        if rounded > 0 { return "+\(rounded)" }
        if rounded < 0 { return "−\(abs(rounded))" }
        return nil
    }

    private static func resultOf(_ raw: String?) -> String? {
        switch (raw ?? "").lowercased() {
        case "win", "loss", "push": return (raw ?? "").lowercased()
        default: return nil
        }
    }
}

public enum NflPropBoardCopy {
    public static func compactMarket(_ label: String) -> String {
        label
            .replacingOccurrences(of: "Receiving ", with: "Rec ")
            .replacingOccurrences(of: "Rushing ", with: "Rush ")
            .replacingOccurrences(of: "Passing ", with: "Pass ")
            .replacingOccurrences(of: "Completions", with: "Pass Comp")
            .replacingOccurrences(of: "Attempts", with: "Att")
    }

    public static func formatLine(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    public static func kickoffLabel(_ iso: String?) -> String? {
        guard let iso, let date = isoDate(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.setLocalizedDateFormatFromTemplate("EEE MMM d jmm")
        return formatter.string(from: date)
    }

    public static func isoDate(_ iso: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: iso) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: iso)
    }
}

public struct NflPropListRow: Identifiable, Hashable, Sendable {
    public let playerId: String
    public let name: String
    public let position: String?
    public let team: String?
    public let opponent: String?
    public let isHome: Bool?
    public let headshotUrl: String?
    public let kickoff: String?
    public let marketKey: String
    public let marketLabel: String
    public let side: String?
    public let line: Double?
    public let badge: String?
    public let bookName: String?
    public let bookLine: Double?
    public let bookPrice: Double?
    public let band: Int

    public var id: String { playerId }

    public var matchup: String {
        let team = team ?? ""
        let opp = opponent ?? ""
        if isHome == true { return "\(opp) at \(team)" }
        if isHome == false { return "\(team) at \(opp)" }
        return "\(team) vs \(opp)"
    }
}

public enum NflPropBoardList {
    public static func rows(
        pages: [NFLPropPlayerPage],
        spotlight: [NflPropSpotlightRow],
        books: [String: NflPropBookQuote],
        rail: String,
        query: String
    ) -> [NflPropListRow] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let byPlayer = Dictionary(grouping: spotlight, by: \.playerId)
        var built: [NflPropListRow] = []
        for page in pages {
            let spot = byPlayer[page.playerId]?.min { ($0.boardRank ?? 99) < ($1.boardRank ?? 99) }
            let lean = NflPropLean.bestMarket(page)
            let posted = page.markets.filter(\.isPosted)
            let marketKey = spot?.market ?? lean?.market ?? posted.first?.key
            guard let marketKey else { continue }
            let market = page.markets.first { $0.key == marketKey }
            let side = spot?.side?.lowercased() ?? (lean?.lean == true ? lean?.direction : nil)
            let quote = books["\(page.playerId):\(marketKey)"]
            let book = bookFor(side: side, quote: quote, market: market)
            let badge: String? = spot != nil ? "Spotlight" : (NflPropLean.hasLean(page) ? "Lean" : nil)
            let band = spot != nil ? 0 : (badge == "Lean" ? 1 : 2)
            let row = NflPropListRow(
                playerId: page.playerId,
                name: page.playerName,
                position: page.position,
                team: page.team,
                opponent: page.opponent,
                isHome: page.isHome,
                headshotUrl: page.headshotUrl,
                kickoff: page.kickoff ?? spot?.kickoff,
                marketKey: marketKey,
                marketLabel: spot?.marketLabel ?? market?.label ?? NFLPlayerProps.marketLabel(marketKey),
                side: side == "split" ? nil : side,
                line: spot?.line ?? market?.line ?? book.line,
                badge: badge,
                bookName: book.name,
                bookLine: book.line,
                bookPrice: book.price,
                band: band
            )
            let isLean = NflPropLean.hasLean(page)
            if !matches(row, rail: rail, needle: needle, game: gameKey(page), isLean: isLean) { continue }
            built.append(row)
        }
        return built.sorted { lhs, rhs in
            if lhs.band != rhs.band { return lhs.band < rhs.band }
            if lhs.band == 0 {
                let lRank = byPlayer[lhs.playerId]?.first?.boardRank ?? 99
                let rRank = byPlayer[rhs.playerId]?.first?.boardRank ?? 99
                if lRank != rRank { return lRank < rRank }
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    public static func games(from pages: [NFLPropPlayerPage]) -> [(id: String, label: String)] {
        var seen = Set<String>()
        var out: [(String, String)] = []
        for page in pages {
            let id = gameKey(page)
            guard !id.isEmpty, seen.insert(id).inserted else { continue }
            let away = page.isHome == true ? (page.opponent ?? "") : (page.team ?? "")
            let home = page.isHome == true ? (page.team ?? "") : (page.opponent ?? "")
            out.append((id, "\(away) at \(home)"))
        }
        return out.sorted { $0.1 < $1.1 }
    }

    public static func gameKey(_ page: NFLPropPlayerPage) -> String {
        let away = page.isHome == true ? (page.opponent ?? "") : (page.team ?? "")
        let home = page.isHome == true ? (page.team ?? "") : (page.opponent ?? "")
        return "\(away)@\(home)"
    }

    private static func matches(_ row: NflPropListRow, rail: String, needle: String, game: String, isLean: Bool) -> Bool {
        if rail == "spotlight", row.badge != "Spotlight" { return false }
        if rail == "leans", !isLean { return false }
        if rail.hasPrefix("g:"), String(rail.dropFirst(2)) != game { return false }
        guard !needle.isEmpty else { return true }
        let hay = [row.name, row.team, row.opponent, row.marketLabel].compactMap { $0?.lowercased() }.joined(separator: " ")
        return hay.contains(needle)
    }

    private static func bookFor(side: String?, quote: NflPropBookQuote?, market: NFLPropPageMarket?) -> (name: String?, line: Double?, price: Double?) {
        let preferOver = side != "under"
        if preferOver {
            if let name = quote?.overBook, !name.isEmpty {
                return (name, quote?.overLine ?? market?.line, quote?.overPrice ?? market?.overPrice.map(Double.init))
            }
        } else if let name = quote?.underBook, !name.isEmpty {
            return (name, quote?.underLine ?? market?.line, quote?.underPrice ?? market?.underPrice.map(Double.init))
        }
        if let name = quote?.overBook, !name.isEmpty {
            return (name, quote?.overLine ?? market?.line, quote?.overPrice ?? market?.overPrice.map(Double.init))
        }
        if let name = quote?.underBook, !name.isEmpty {
            return (name, quote?.underLine ?? market?.line, quote?.underPrice ?? market?.underPrice.map(Double.init))
        }
        let price = preferOver ? market?.overPrice : market?.underPrice
        return (nil, market?.line, price.map(Double.init))
    }
}
