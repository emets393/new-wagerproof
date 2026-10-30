import Foundation
import Observation
import Supabase
import WagerproofServices

/// College game board joined on the CBBD `game_id`. A model play is `tier == bet`
/// only. A tracking flag, or a candidate definition, is a read and not a play.
@Observable
@MainActor
final class NCAABGameDetailStore {
    private(set) var board: NCAABDetailBoard?
    private(set) var loading = true
    private(set) var failed = false

    var tournament: String? { board?.tournament }
    var tv: String? { board?.tv }

    func load(gameId: Int, gameDate: String, home: String, away: String) async {
        loading = true
        failed = false
        let season = NCAABCopy.seasonEnd(gameDate)
        let cfb = await CFBSupabase.shared.client

        let header: [NCAABHeaderRow]? = try? await cfb
            .from("v_cbb_input_values")
            .select("game_id,home_team_id,away_team_id,neutral_site,tournament,broadcasts,game_type")
            .eq("game_id", value: gameId)
            .limit(1)
            .execute()
            .value
        let models: [NCAABModelRow]? = try? await cfb
            .from("ncaab_model_preds")
            .select("game_id,market,model_home_margin,model_total,market_home_spread,market_total,disagreement,tier,bet_side")
            .eq("game_id", value: gameId)
            .execute()
            .value
        let flags: [NCAABFlagRow]? = try? await cfb
            .from("ncaab_slate_flags")
            .select("game_id,signal_key,market,side,tier,trigger_text,record_text")
            .eq("game_id", value: gameId)
            .execute()
            .value
        let defs: [NCAABDefRow]? = try? await cfb
            .from("ncaab_signal_defs")
            .select("signal_key,display_name,one_liner,market,tier,record_text,season_record_text")
            .execute()
            .value

        let homeId = header?.first?.homeTeamId
        let awayId = header?.first?.awayTeamId
        let teamIds = [homeId, awayId].compactMap { $0 }

        let trends: [NCAABTrendRow]?
        let ratings: [NCAABRatingRow]?
        if teamIds.isEmpty {
            trends = []
            ratings = []
        } else {
            trends = try? await cfb
                .from("ncaab_team_trends")
                .select("team_id,team_name,games,su_w,su_l,su_record,ats_w,ats_l,ats_p,ats_pct,ou_o,ou_u,ou_p,over_pct,tt_o,tt_u,tt_over_pct,h1_ats_w,h1_ats_l,h1_ats_p,h1_ats_pct,h1_ou_o,h1_ou_u,h1_over_pct,last5_su,last5_ats,last5_ou,last5_tt,last5_h1_ats,last5_h1_ou,game_log,matchups")
                .in("team_id", values: teamIds)
                .eq("season", value: season)
                .execute()
                .value
            ratings = try? await cfb
                .from("ncaab_team_ratings")
                .select("team_id,team_name,wins,losses,rating,rating_rank,adj_offense,adj_offense_rank,adj_defense,adj_defense_rank,tempo,tempo_rank,luck,sos")
                .in("team_id", values: teamIds)
                .eq("season", value: season)
                .execute()
                .value
        }
        let fanmatch: [NCAABFanmatchRow]? = try? await cfb
            .from("ncaab_fanmatch_daily")
            .select("cbbd_game_id,home_pred,away_pred,home_win_prob,pred_tempo,thrill_score")
            .eq("cbbd_game_id", value: gameId)
            .limit(1)
            .execute()
            .value

        if models == nil && flags == nil && trends == nil {
            failed = true
            loading = false
            return
        }

        board = NCAABCopy.board(
            header: header?.first,
            models: models ?? [],
            flags: flags ?? [],
            defs: defs ?? [],
            trends: trends ?? [],
            ratings: ratings ?? [],
            fanmatch: fanmatch?.first,
            trendsLoaded: trends != nil,
            homeId: homeId,
            awayId: awayId,
            home: home,
            away: away
        )
        loading = false
    }
}

struct NCAABDetailBoard {
    var tournament: String?
    var tv: String?
    var fullGame: [NCAABModelLine]
    var firstHalf: [NCAABModelLine]
    var signals: [NCAABSignalLine]
    var markets: [NCAABMarketLine]
    var ratings: [NCAABRatingLine]
    var awayRecord: String?
    var homeRecord: String?
    var thrillScore: String?
    var thrillDetail: String
    var earlySeason: Bool
    var catalog: [NCAABCatalogLine]
    var awayTrend: NCAABTrendRow?
    var homeTrend: NCAABTrendRow?
}

struct NCAABModelLine: Identifiable {
    let id: String
    let label: String
    let model: String
    let posted: String
    let disagreement: String
    let play: Bool
    let betSide: String?
    var modelMargin: Double? = nil
    var modelTotal: Double? = nil
    var marketSpread: Double? = nil
    var marketTotal: Double? = nil
    var disagreementPts: Double? = nil
}

struct NCAABSignalLine: Identifiable {
    let id: String
    let name: String
    let market: String
    let side: String
    let trigger: String
    let record: String
    let seasonRecord: String
    let play: Bool
}

struct NCAABMarketLine: Identifiable {
    let id: String
    let label: String
    let awayRecord: String
    let homeRecord: String
    let awayChips: [String]
    let homeChips: [String]
    let series: String
}

struct NCAABRatingLine: Identifiable {
    let id: String
    let label: String
    let away: String
    let home: String
    /// "away", "home", or nil when neither side is better.
    let better: String?
}

struct NCAABCatalogLine: Identifiable {
    let id: String
    let name: String
    let market: String
    let oneLiner: String
    let record: String
    let seasonRecord: String
    let active: Bool
}

enum NCAABCopy {
    static let thrillEmpty = "The watchability score posts the morning of the game."
    static let earlyNote = "Season records start after opening night. Last five and head-to-head still use prior seasons. In-season rating fields stay blank until games are played."

    struct Market {
        let id: String
        let label: String
        let verb: String
        let record: (NCAABTrendRow) -> String
        let chips: (NCAABTrendRow) -> [String]
        let series: (NCAABSeriesEntry) -> NCAABRec?
    }

    static let markets: [Market] = [
        Market(id: "spread", label: "Spread", verb: "covered", record: { record($0.atsW, $0.atsL, $0.atsP, $0.atsPct) }, chips: { $0.last5Ats }, series: { $0.spread }),
        Market(id: "total", label: "Total", verb: "saw the over in", record: { record($0.ouO, $0.ouU, $0.ouP, $0.overPct) }, chips: { $0.last5Ou }, series: { $0.total }),
        Market(id: "moneyline", label: "Moneyline", verb: "won", record: { $0.suRecord ?? record($0.suW, $0.suL, 0, nil) }, chips: { $0.last5Su }, series: { $0.moneyline }),
        Market(id: "team_total", label: "Team total", verb: "went over its team total in", record: { record($0.ttO, $0.ttU, 0, $0.ttOverPct) }, chips: { $0.last5Tt }, series: { $0.teamTotal }),
        Market(id: "h1_spread", label: "1st half spread", verb: "covered the first half in", record: { record($0.h1AtsW, $0.h1AtsL, $0.h1AtsP, $0.h1AtsPct) }, chips: { $0.last5H1Ats }, series: { $0.h1Spread }),
        Market(id: "h1_total", label: "1st half total", verb: "saw the first-half over in", record: { record($0.h1OuO, $0.h1OuU, 0, $0.h1OverPct) }, chips: { $0.last5H1Ou }, series: { $0.h1Total }),
    ]

    static func seasonEnd(_ iso: String) -> Int {
        let parts = iso.split(separator: "-")
        if parts.count >= 2, let year = Int(parts[0]), let month = Int(parts[1]) {
            return month >= 6 ? year + 1 : year
        }
        let now = Calendar.current.dateComponents([.year, .month], from: Date())
        let year = now.year ?? 2026
        let month = now.month ?? 1
        return month >= 6 ? year + 1 : year
    }

    static func hideProvider(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "" }
        guard let regex = try? NSRegularExpression(pattern: "\\bkenpom(?:'s|’s)?\\b", options: [.caseInsensitive]) else {
            return raw.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let range = NSRange(raw.startIndex..., in: raw)
        var text = regex.stringByReplacingMatches(in: raw, options: [], range: range, withTemplate: "")
        text = text.replacingOccurrences(of: "\\s{2,}", with: " ", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\s+([,.;:])", with: "$1", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\(\\s+", with: "(", options: .regularExpression)
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// STD is the feed's code for a standard game. It is not a label.
    static func publicGameType(_ raw: String) -> String {
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if key.isEmpty || key == "STD" || key == "STANDARD" || key == "REG" || key.contains("REGULAR") {
            return ""
        }
        if key == "TRNMNT" || key == "TOURNAMENT" { return "Tournament" }
        return raw
    }

    static func points(_ value: Double) -> String {
        let rounded = (value * 10).rounded() / 10
        if rounded == rounded.rounded() { return String(Int(rounded)) }
        return String(format: "%.1f", rounded)
    }

    static func spread(_ value: Double) -> String {
        let text = points(value)
        return value > 0 ? "+\(text)" : text
    }

    static func disagreement(_ market: String, _ value: Double?, home: String, away: String) -> String {
        guard let value else { return "" }
        let magnitude = abs(value)
        if magnitude < 0.05 { return "In line with the posted number." }
        let amount = points(magnitude)
        let unit = amount == "1" ? "point" : "points"
        if market.contains("total") {
            return "\(amount) \(unit) toward \(value > 0 ? "the over" : "the under")."
        }
        return "\(amount) \(unit) toward \(value > 0 ? home : away)."
    }

    static func modelLine(_ market: String, _ row: NCAABModelRow?, home: String, away: String) -> NCAABModelLine {
        let labels = ["spread": "Spread", "total": "Total", "h1_spread": "1st half spread", "h1_total": "1st half total"]
        let label = labels[market] ?? market
        guard let row else {
            return NCAABModelLine(id: market, label: label, model: "—", posted: "—", disagreement: "No line posted.", play: false, betSide: nil)
        }
        let play = (row.tier ?? "").lowercased() == "bet"
        let isTotal = market.contains("total")
        let model: String
        let posted: String
        if isTotal {
            model = row.modelTotal.map(points) ?? "—"
            posted = row.marketTotal.map(points) ?? "—"
        } else {
            model = row.modelHomeMargin.map { "\(home) \(spread(-$0))" } ?? "—"
            posted = row.marketHomeSpread.map { "\(home) \(spread($0))" } ?? "—"
        }
        let side = play ? hideProvider(row.betSide) : ""
        return NCAABModelLine(
            id: market,
            label: label,
            model: model,
            posted: posted,
            disagreement: disagreement(market, row.disagreement, home: home, away: away),
            play: play,
            betSide: side.isEmpty ? nil : side,
            modelMargin: row.modelHomeMargin,
            modelTotal: row.modelTotal,
            marketSpread: row.marketHomeSpread,
            marketTotal: row.marketTotal,
            disagreementPts: row.disagreement
        )
    }

    static func record(_ w: Int, _ l: Int, _ p: Int, _ pct: Double?) -> String {
        let base = p > 0 ? "\(w)-\(l)-\(p)" : "\(w)-\(l)"
        guard let pct else { return base }
        let shown = pct <= 1 ? pct * 100 : pct
        return "\(base) \(Int(shown.rounded()))%"
    }

    static func series(_ home: NCAABTrendRow?, _ away: NCAABTrendRow?, homeId: Int?, awayId: Int?, homeName: String, awayName: String, market: Market) -> String {
        let homeRec = awayId.flatMap { home?.matchups[String($0)] }.flatMap(market.series)
        let awayRec = homeId.flatMap { away?.matchups[String($0)] }.flatMap(market.series)
        if let rec = homeRec, rec.n > 0 { return "\(homeName) \(market.verb) \(rec.h) of \(rec.n)." }
        if let rec = awayRec, rec.n > 0 { return "\(awayName) \(market.verb) \(rec.h) of \(rec.n)." }
        return "No meetings in the window on file."
    }

    static func better(_ away: Double?, _ home: Double?, lower: Bool) -> String? {
        guard let away, let home, away != home else { return nil }
        if lower { return away < home ? "away" : "home" }
        return away > home ? "away" : "home"
    }

    static func shown(_ value: Double?, rank: Bool = false, digits: Int = 1) -> String {
        guard let value else { return "—" }
        if rank { return "#\(Int(value.rounded()))" }
        if digits == 3 { return String(format: "%.3f", value) }
        if digits == 2 { return String(format: "%.2f", value) }
        return points(value)
    }

    static func board(
        header: NCAABHeaderRow?,
        models: [NCAABModelRow],
        flags: [NCAABFlagRow],
        defs: [NCAABDefRow],
        trends: [NCAABTrendRow],
        ratings: [NCAABRatingRow],
        fanmatch: NCAABFanmatchRow?,
        trendsLoaded: Bool,
        homeId: Int?,
        awayId: Int?,
        home: String,
        away: String
    ) -> NCAABDetailBoard {
        let byMarket = Dictionary(models.map { ($0.market, $0) }, uniquingKeysWith: { _, last in last })
        func line(_ market: String) -> NCAABModelLine {
            modelLine(market, byMarket[market], home: home, away: away)
        }

        let defByKey = Dictionary(defs.map { ($0.signalKey, $0) }, uniquingKeysWith: { _, last in last })
        let signals = flags.map { flag -> NCAABSignalLine in
            let def = defByKey[flag.signalKey]
            let active = (def?.tier ?? "").lowercased() == "active"
            let tracking = (flag.tier ?? "").lowercased() == "tracking"
            let flagMarket = (flag.market ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let defMarket = (def?.market ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return NCAABSignalLine(
                id: "\(flag.signalKey)-\(flag.side ?? "")",
                name: hideProvider(def?.displayName).isEmpty ? flag.signalKey : hideProvider(def?.displayName),
                market: flagMarket.isEmpty ? defMarket : flagMarket,
                side: hideProvider(flag.side),
                trigger: hideProvider(flag.triggerText),
                record: {
                    let fromDef = hideProvider(def?.recordText)
                    return fromDef.isEmpty ? hideProvider(flag.recordText) : fromDef
                }(),
                seasonRecord: hideProvider(def?.seasonRecordText),
                play: active && !tracking
            )
        }.sorted { lhs, rhs in
            if lhs.play != rhs.play { return lhs.play && !rhs.play }
            return lhs.name < rhs.name
        }

        let homeTrend = trends.first { $0.teamId == homeId }
        let awayTrend = trends.first { $0.teamId == awayId }
        let marketLines = markets.map { market in
            NCAABMarketLine(
                id: market.id,
                label: market.label,
                awayRecord: awayTrend.map(market.record) ?? "No games yet",
                homeRecord: homeTrend.map(market.record) ?? "No games yet",
                awayChips: awayTrend.map(market.chips) ?? [],
                homeChips: homeTrend.map(market.chips) ?? [],
                series: series(homeTrend, awayTrend, homeId: homeId, awayId: awayId, homeName: home, awayName: away, market: market)
            )
        }

        let homeRating = ratings.first { $0.teamId == homeId }
        let awayRating = ratings.first { $0.teamId == awayId }
        let ratingLines: [(String, Double?, Double?, Bool, Bool, Int)] = [
            ("Rating", awayRating?.rating, homeRating?.rating, false, false, 1),
            ("Rating rank", awayRating?.ratingRank, homeRating?.ratingRank, true, true, 0),
            ("Adj. offense", awayRating?.adjOffense, homeRating?.adjOffense, false, false, 1),
            ("Offense rank", awayRating?.adjOffenseRank, homeRating?.adjOffenseRank, true, true, 0),
            ("Adj. defense", awayRating?.adjDefense, homeRating?.adjDefense, true, false, 1),
            ("Defense rank", awayRating?.adjDefenseRank, homeRating?.adjDefenseRank, true, true, 0),
            ("Tempo", awayRating?.tempo, homeRating?.tempo, false, false, 1),
            ("Tempo rank", awayRating?.tempoRank, homeRating?.tempoRank, false, true, 0),
            ("Luck", awayRating?.luck, homeRating?.luck, false, false, 3),
            ("Strength of schedule", awayRating?.sos, homeRating?.sos, false, false, 2),
        ]
        let neutralIds: Set<String> = ["Tempo", "Tempo rank", "Luck", "Strength of schedule"]
        let ratingViews = ratingLines.map { label, awayValue, homeValue, lower, rank, digits in
            NCAABRatingLine(
                id: label,
                label: label,
                away: shown(awayValue, rank: rank, digits: digits),
                home: shown(homeValue, rank: rank, digits: digits),
                better: neutralIds.contains(label) ? nil : better(awayValue, homeValue, lower: lower)
            )
        }

        let thrill = fanmatch?.thrillScore
        var detail = ""
        if let homePred = fanmatch?.homePred, let awayPred = fanmatch?.awayPred {
            detail += "Projected \(points(awayPred))–\(points(homePred))"
        }
        if let tempo = fanmatch?.predTempo {
            if !detail.isEmpty { detail += "  ·  " }
            detail += "Tempo \(points(tempo))"
        }
        if let win = fanmatch?.homeWinProb {
            let pct = Int((win <= 1 ? win * 100 : win).rounded())
            if !detail.isEmpty { detail += "  ·  " }
            detail += "\(home) \(pct)%"
        }

        let awayGames = awayTrend?.games ?? 0
        let homeGames = homeTrend?.games ?? 0
        let catalog = defs.map { def in
            NCAABCatalogLine(
                id: def.signalKey,
                name: hideProvider(def.displayName).isEmpty ? def.signalKey : hideProvider(def.displayName),
                market: hideProvider(def.market).replacingOccurrences(of: "_", with: " "),
                oneLiner: hideProvider(def.oneLiner),
                record: hideProvider(def.recordText),
                seasonRecord: hideProvider(def.seasonRecordText),
                active: (def.tier ?? "").lowercased() == "active"
            )
        }.sorted { lhs, rhs in
            if lhs.active != rhs.active { return lhs.active && !rhs.active }
            return lhs.name < rhs.name
        }

        let tournament = hideProvider(header?.tournament)
        let gameType = hideProvider(header?.gameType)
        let namedTournament = !tournament.isEmpty ? tournament : Self.publicGameType(gameType)
        let tv = hideProvider(header?.broadcasts)

        return NCAABDetailBoard(
            tournament: namedTournament.isEmpty ? nil : namedTournament,
            tv: tv.isEmpty ? nil : tv,
            fullGame: [line("spread"), line("total")],
            firstHalf: [line("h1_spread"), line("h1_total")],
            signals: signals,
            markets: marketLines,
            ratings: ratingViews,
            awayRecord: awayRating.map { "\($0.wins ?? 0)-\($0.losses ?? 0)" },
            homeRecord: homeRating.map { "\($0.wins ?? 0)-\($0.losses ?? 0)" },
            thrillScore: thrill.map { String(Int($0.rounded())) },
            thrillDetail: detail,
            earlySeason: trendsLoaded && (awayGames == 0 || homeGames == 0),
            catalog: catalog,
            awayTrend: awayTrend,
            homeTrend: homeTrend
        )
    }
}

// MARK: - Rows

struct NCAABHeaderRow: Decodable {
    let homeTeamId: Int?
    let awayTeamId: Int?
    let tournament: String?
    let broadcasts: String?
    let gameType: String?

    enum CodingKeys: String, CodingKey {
        case homeTeamId = "home_team_id"
        case awayTeamId = "away_team_id"
        case tournament, broadcasts
        case gameType = "game_type"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        homeTeamId = NCAABJSON.int(c, .homeTeamId)
        awayTeamId = NCAABJSON.int(c, .awayTeamId)
        tournament = NCAABJSON.text(c, .tournament)
        broadcasts = NCAABJSON.text(c, .broadcasts)
        gameType = NCAABJSON.text(c, .gameType)
    }
}

struct NCAABModelRow: Decodable {
    let market: String
    let modelHomeMargin: Double?
    let modelTotal: Double?
    let marketHomeSpread: Double?
    let marketTotal: Double?
    let disagreement: Double?
    let tier: String?
    let betSide: String?

    enum CodingKeys: String, CodingKey {
        case market
        case modelHomeMargin = "model_home_margin"
        case modelTotal = "model_total"
        case marketHomeSpread = "market_home_spread"
        case marketTotal = "market_total"
        case disagreement, tier
        case betSide = "bet_side"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        market = (try? c.decode(String.self, forKey: .market)) ?? ""
        modelHomeMargin = NCAABJSON.double(c, .modelHomeMargin)
        modelTotal = NCAABJSON.double(c, .modelTotal)
        marketHomeSpread = NCAABJSON.double(c, .marketHomeSpread)
        marketTotal = NCAABJSON.double(c, .marketTotal)
        disagreement = NCAABJSON.double(c, .disagreement)
        tier = try? c.decode(String.self, forKey: .tier)
        betSide = NCAABJSON.text(c, .betSide)
    }
}

struct NCAABFlagRow: Decodable {
    let signalKey: String
    let market: String?
    let side: String?
    let tier: String?
    let triggerText: String?
    let recordText: String?

    enum CodingKeys: String, CodingKey {
        case signalKey = "signal_key"
        case market, side, tier
        case triggerText = "trigger_text"
        case recordText = "record_text"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        signalKey = (try? c.decode(String.self, forKey: .signalKey)) ?? ""
        market = NCAABJSON.text(c, .market)
        side = NCAABJSON.text(c, .side)
        tier = try? c.decode(String.self, forKey: .tier)
        triggerText = NCAABJSON.text(c, .triggerText)
        recordText = NCAABJSON.text(c, .recordText)
    }
}

struct NCAABDefRow: Decodable {
    let signalKey: String
    let displayName: String?
    let oneLiner: String?
    let market: String?
    let tier: String?
    let recordText: String?
    let seasonRecordText: String?

    enum CodingKeys: String, CodingKey {
        case signalKey = "signal_key"
        case displayName = "display_name"
        case oneLiner = "one_liner"
        case market, tier
        case recordText = "record_text"
        case seasonRecordText = "season_record_text"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        signalKey = (try? c.decode(String.self, forKey: .signalKey)) ?? ""
        displayName = NCAABJSON.text(c, .displayName)
        oneLiner = NCAABJSON.text(c, .oneLiner)
        market = NCAABJSON.text(c, .market)
        tier = try? c.decode(String.self, forKey: .tier)
        recordText = NCAABJSON.text(c, .recordText)
        seasonRecordText = NCAABJSON.text(c, .seasonRecordText)
    }
}

struct NCAABRec: Decodable {
    let h: Int
    let n: Int

    enum CodingKeys: String, CodingKey { case h, n }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        h = NCAABJSON.int(c, .h) ?? 0
        n = NCAABJSON.int(c, .n) ?? 0
    }
}

struct NCAABSeriesEntry: Decodable {
    let spread: NCAABRec?
    let moneyline: NCAABRec?
    let total: NCAABRec?
    let teamTotal: NCAABRec?
    let h1Spread: NCAABRec?
    let h1Total: NCAABRec?

    enum CodingKeys: String, CodingKey {
        case spread, moneyline, total
        case teamTotal = "team_total"
        case h1Spread = "h1_spread"
        case h1Total = "h1_total"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        spread = try? c.decode(NCAABRec.self, forKey: .spread)
        moneyline = try? c.decode(NCAABRec.self, forKey: .moneyline)
        total = try? c.decode(NCAABRec.self, forKey: .total)
        teamTotal = try? c.decode(NCAABRec.self, forKey: .teamTotal)
        h1Spread = try? c.decode(NCAABRec.self, forKey: .h1Spread)
        h1Total = try? c.decode(NCAABRec.self, forKey: .h1Total)
    }
}

struct NCAABGameLog: Decodable, Hashable {
    let date: String?
    let opp: String?
    let isHome: Bool?
    let ptsFor: Int?
    let ptsAgainst: Int?
    let su: String?
    let ats: String?
    let ou: String?
    let tt: String?
    let h1Ats: String?
    let h1Ou: String?

    var scoreText: String {
        guard let ptsFor, let ptsAgainst else { return "—" }
        return "\(ptsFor)–\(ptsAgainst)"
    }

    func result(for marketId: String) -> String? {
        switch marketId {
        case "spread": return ats
        case "total": return ou
        case "moneyline": return su
        case "team_total": return tt
        case "h1_spread": return h1Ats
        case "h1_total": return h1Ou
        default: return nil
        }
    }

    enum CodingKeys: String, CodingKey {
        case date, opp, su, ats, ou, tt
        case isHome = "is_home"
        case ptsFor = "pts_for"
        case ptsAgainst = "pts_against"
        case teamPts = "team_pts"
        case oppPts = "opp_pts"
        case h1Ats = "h1_ats"
        case h1Ou = "h1_ou"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = NCAABJSON.text(c, .date)
        opp = NCAABJSON.text(c, .opp)
        if let flag = try? c.decode(Bool.self, forKey: .isHome) {
            isHome = flag
        } else if let number = NCAABJSON.int(c, .isHome) {
            isHome = number != 0
        } else {
            isHome = nil
        }
        ptsFor = NCAABJSON.int(c, .ptsFor) ?? NCAABJSON.int(c, .teamPts)
        ptsAgainst = NCAABJSON.int(c, .ptsAgainst) ?? NCAABJSON.int(c, .oppPts)
        su = NCAABJSON.text(c, .su)
        ats = NCAABJSON.text(c, .ats)
        ou = NCAABJSON.text(c, .ou)
        tt = NCAABJSON.text(c, .tt)
        h1Ats = NCAABJSON.text(c, .h1Ats)
        h1Ou = NCAABJSON.text(c, .h1Ou)
    }
}

struct NCAABTrendRow: Decodable {
    let teamId: Int
    let games: Int
    let suW: Int
    let suL: Int
    let suRecord: String?
    let atsW: Int
    let atsL: Int
    let atsP: Int
    let atsPct: Double?
    let ouO: Int
    let ouU: Int
    let ouP: Int
    let overPct: Double?
    let ttO: Int
    let ttU: Int
    let ttOverPct: Double?
    let h1AtsW: Int
    let h1AtsL: Int
    let h1AtsP: Int
    let h1AtsPct: Double?
    let h1OuO: Int
    let h1OuU: Int
    let h1OverPct: Double?
    let last5Su: [String]
    let last5Ats: [String]
    let last5Ou: [String]
    let last5Tt: [String]
    let last5H1Ats: [String]
    let last5H1Ou: [String]
    let gameLog: [NCAABGameLog]
    let matchups: [String: NCAABSeriesEntry]

    enum CodingKeys: String, CodingKey {
        case teamId = "team_id"
        case games
        case suW = "su_w"
        case suL = "su_l"
        case suRecord = "su_record"
        case atsW = "ats_w"
        case atsL = "ats_l"
        case atsP = "ats_p"
        case atsPct = "ats_pct"
        case ouO = "ou_o"
        case ouU = "ou_u"
        case ouP = "ou_p"
        case overPct = "over_pct"
        case ttO = "tt_o"
        case ttU = "tt_u"
        case ttOverPct = "tt_over_pct"
        case h1AtsW = "h1_ats_w"
        case h1AtsL = "h1_ats_l"
        case h1AtsP = "h1_ats_p"
        case h1AtsPct = "h1_ats_pct"
        case h1OuO = "h1_ou_o"
        case h1OuU = "h1_ou_u"
        case h1OverPct = "h1_over_pct"
        case last5Su = "last5_su"
        case last5Ats = "last5_ats"
        case last5Ou = "last5_ou"
        case last5Tt = "last5_tt"
        case last5H1Ats = "last5_h1_ats"
        case last5H1Ou = "last5_h1_ou"
        case gameLog = "game_log"
        case matchups
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        teamId = NCAABJSON.int(c, .teamId) ?? -1
        games = NCAABJSON.int(c, .games) ?? 0
        suW = NCAABJSON.int(c, .suW) ?? 0
        suL = NCAABJSON.int(c, .suL) ?? 0
        suRecord = NCAABJSON.text(c, .suRecord)
        atsW = NCAABJSON.int(c, .atsW) ?? 0
        atsL = NCAABJSON.int(c, .atsL) ?? 0
        atsP = NCAABJSON.int(c, .atsP) ?? 0
        atsPct = NCAABJSON.double(c, .atsPct)
        ouO = NCAABJSON.int(c, .ouO) ?? 0
        ouU = NCAABJSON.int(c, .ouU) ?? 0
        ouP = NCAABJSON.int(c, .ouP) ?? 0
        overPct = NCAABJSON.double(c, .overPct)
        ttO = NCAABJSON.int(c, .ttO) ?? 0
        ttU = NCAABJSON.int(c, .ttU) ?? 0
        ttOverPct = NCAABJSON.double(c, .ttOverPct)
        h1AtsW = NCAABJSON.int(c, .h1AtsW) ?? 0
        h1AtsL = NCAABJSON.int(c, .h1AtsL) ?? 0
        h1AtsP = NCAABJSON.int(c, .h1AtsP) ?? 0
        h1AtsPct = NCAABJSON.double(c, .h1AtsPct)
        h1OuO = NCAABJSON.int(c, .h1OuO) ?? 0
        h1OuU = NCAABJSON.int(c, .h1OuU) ?? 0
        h1OverPct = NCAABJSON.double(c, .h1OverPct)
        last5Su = NCAABJSON.strings(c, .last5Su)
        last5Ats = NCAABJSON.strings(c, .last5Ats)
        last5Ou = NCAABJSON.strings(c, .last5Ou)
        last5Tt = NCAABJSON.strings(c, .last5Tt)
        last5H1Ats = NCAABJSON.strings(c, .last5H1Ats)
        last5H1Ou = NCAABJSON.strings(c, .last5H1Ou)
        gameLog = (try? c.decode([NCAABGameLog].self, forKey: .gameLog)) ?? []
        matchups = (try? c.decode([String: NCAABSeriesEntry].self, forKey: .matchups)) ?? [:]
    }
}

struct NCAABRatingRow: Decodable {
    let teamId: Int
    let wins: Int?
    let losses: Int?
    let rating: Double?
    let ratingRank: Double?
    let adjOffense: Double?
    let adjOffenseRank: Double?
    let adjDefense: Double?
    let adjDefenseRank: Double?
    let tempo: Double?
    let tempoRank: Double?
    let luck: Double?
    let sos: Double?

    enum CodingKeys: String, CodingKey {
        case teamId = "team_id"
        case wins, losses, rating
        case ratingRank = "rating_rank"
        case adjOffense = "adj_offense"
        case adjOffenseRank = "adj_offense_rank"
        case adjDefense = "adj_defense"
        case adjDefenseRank = "adj_defense_rank"
        case tempo
        case tempoRank = "tempo_rank"
        case luck, sos
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        teamId = NCAABJSON.int(c, .teamId) ?? -1
        wins = NCAABJSON.int(c, .wins)
        losses = NCAABJSON.int(c, .losses)
        rating = NCAABJSON.double(c, .rating)
        ratingRank = NCAABJSON.double(c, .ratingRank)
        adjOffense = NCAABJSON.double(c, .adjOffense)
        adjOffenseRank = NCAABJSON.double(c, .adjOffenseRank)
        adjDefense = NCAABJSON.double(c, .adjDefense)
        adjDefenseRank = NCAABJSON.double(c, .adjDefenseRank)
        tempo = NCAABJSON.double(c, .tempo)
        tempoRank = NCAABJSON.double(c, .tempoRank)
        luck = NCAABJSON.double(c, .luck)
        sos = NCAABJSON.double(c, .sos)
    }
}

struct NCAABFanmatchRow: Decodable {
    let homePred: Double?
    let awayPred: Double?
    let homeWinProb: Double?
    let predTempo: Double?
    let thrillScore: Double?

    enum CodingKeys: String, CodingKey {
        case homePred = "home_pred"
        case awayPred = "away_pred"
        case homeWinProb = "home_win_prob"
        case predTempo = "pred_tempo"
        case thrillScore = "thrill_score"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        homePred = NCAABJSON.double(c, .homePred)
        awayPred = NCAABJSON.double(c, .awayPred)
        homeWinProb = NCAABJSON.double(c, .homeWinProb)
        predTempo = NCAABJSON.double(c, .predTempo)
        thrillScore = NCAABJSON.double(c, .thrillScore)
    }
}

enum NCAABJSON {
    static func double<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Double? {
        if let value = try? c.decode(Double.self, forKey: key) { return value }
        if let value = try? c.decode(Int.self, forKey: key) { return Double(value) }
        if let value = try? c.decode(String.self, forKey: key) { return Double(value) }
        return nil
    }

    static func int<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Int? {
        if let value = try? c.decode(Int.self, forKey: key) { return value }
        if let value = try? c.decode(Double.self, forKey: key) { return Int(value.rounded()) }
        if let value = try? c.decode(String.self, forKey: key) {
            if let parsed = Int(value) { return parsed }
            if let parsed = Double(value) { return Int(parsed.rounded()) }
        }
        return nil
    }

    static func text<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> String? {
        if let value = try? c.decode(String.self, forKey: key) {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        if let values = try? c.decode([String].self, forKey: key) {
            let joined = values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: ", ")
            return joined.isEmpty ? nil : joined
        }
        return nil
    }

    static func strings<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> [String] {
        if let values = try? c.decode([String].self, forKey: key) {
            return values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        }
        guard let raw = try? c.decode(String.self, forKey: key) else { return [] }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("["),
           let data = trimmed.data(using: .utf8),
           let parsed = try? JSONDecoder().decode([String].self, from: data) {
            return parsed
        }
        return trimmed
            .replacingOccurrences(of: "{", with: "")
            .replacingOccurrences(of: "}", with: "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}
