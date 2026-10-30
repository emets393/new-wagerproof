import Foundation
import Supabase
import WagerproofModels

public struct FootballRegressionPayload: Sendable {
    public let report: FootballRegressionReport?
    public let storylines: [FootballStoryline]
    public let signals: [FootballSignalRow]
    public let defs: [String: FootballSignalDef]
    public let upcoming: [String: [FootballUpcomingFlag]]
    public let splits: [FootballRecordSplit]
}

public actor FootballRegressionService {
    public static let shared = FootballRegressionService()
    public init() {}

    public func load(sport: String) async -> FootballRegressionPayload {
        let cfb = await CFBSupabase.shared.client
        let reportRow = await fetchReport(cfb, sport: sport)
        let report = reportRow.map(Self.mapReport)
        var storylines: [FootballStoryline] = []
        var signals: [FootballSignalRow] = []
        var defs: [String: FootballSignalDef] = [:]
        var upcoming: [String: [FootballUpcomingFlag]] = [:]
        if let report {
            storylines = await fetchStorylines(cfb, sport: sport, season: report.season, week: report.week)
            signals = await fetchSignals(cfb, sport: sport, season: report.season)
            defs = await fetchDefs(cfb, sport: sport)
            upcoming = await fetchUpcoming(cfb, sport: sport, season: report.season)
        }
        let splits = await fetchSplits(sport: sport)
        return FootballRegressionPayload(
            report: report,
            storylines: storylines,
            signals: signals,
            defs: defs,
            upcoming: upcoming,
            splits: splits
        )
    }

    public func narratives() async -> [FootballPropNarrative] {
        let cfb = await CFBSupabase.shared.client
        let rows: [JSONObject] = (try? await cfb
            .from("nfl_prop_narratives")
            .select("id,season,week,player_name,team,opp,position,market,line,direction,headshot_url,kickoff,summary,body,best_over_line,best_over_price,best_over_book,best_under_line,best_under_price,best_under_book,actual_value,result,score")
            .order("week", ascending: false)
            .order("score", ascending: false)
            .limit(400)
            .execute()
            .value) ?? []
        return rows.compactMap(Self.mapNarrative)
    }

    private func fetchReport(_ client: SupabaseClient, sport: String) async -> JSONObject? {
        let rows: [JSONObject] = (try? await client
            .from("football_regression_reports")
            .select("sport,season,week,narrative,changelog,summary,updated_at")
            .eq("sport", value: sport)
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value) ?? []
        return rows.first
    }

    private func fetchStorylines(_ client: SupabaseClient, sport: String, season: Int, week: Int) async -> [FootballStoryline] {
        let rows: [JSONObject] = (try? await client
            .from("football_regression_storylines")
            .select("id,family,matchup,title,body,rank,status,data")
            .eq("sport", value: sport)
            .eq("season", value: season)
            .eq("week", value: week)
            .order("rank", ascending: true)
            .execute()
            .value) ?? []
        return rows.compactMap { row in
            let status = row["status"]?.stringValue ?? "active"
            guard status != "resolved", let title = row["title"]?.stringValue else { return nil }
            let data = row["data"]
            return FootballStoryline(
                id: row["id"]?.intValue ?? 0,
                family: row["family"]?.stringValue ?? "storylines",
                matchup: row["matchup"]?.stringValue,
                title: title,
                body: row["body"]?.stringValue ?? "",
                rank: row["rank"]?.intValue,
                status: status,
                full: data?["full"]?.stringValue,
                source: data?["source"]?.stringValue
            )
        }
    }

    private func fetchSignals(_ client: SupabaseClient, sport: String, season: Int) async -> [FootballSignalRow] {
        let rows: [JSONObject] = (try? await client
            .from("signal_performance")
            .select("signal_key,n,wins,losses,pushes,hit_rate,units,roi")
            .eq("sport", value: sport)
            .eq("season", value: season)
            .execute()
            .value) ?? []
        return rows.compactMap { row in
            guard let key = row["signal_key"]?.stringValue, let n = Self.num(row["n"]), n > 0 else { return nil }
            return FootballSignalRow(
                key: key,
                n: Int(n),
                wins: Int(Self.num(row["wins"]) ?? 0),
                losses: Int(Self.num(row["losses"]) ?? 0),
                pushes: Int(Self.num(row["pushes"]) ?? 0),
                hitRate: Self.num(row["hit_rate"]),
                units: Self.num(row["units"]),
                roi: Self.num(row["roi"])
            )
        }.sorted { $0.n > $1.n }
    }

    private func fetchDefs(_ client: SupabaseClient, sport: String) async -> [String: FootballSignalDef] {
        let table = sport == "nfl" ? "nfl_signal_defs" : "cfb_signal_defs"
        let rows: [JSONObject] = (try? await client
            .from(table)
            .select("signal_key,display_name,one_liner,definition,why_it_works,bet_direction,typical_hit,market")
            .execute()
            .value) ?? []
        var out: [String: FootballSignalDef] = [:]
        for row in rows {
            guard let key = row["signal_key"]?.stringValue else { continue }
            out[key] = FootballSignalDef(
                key: key,
                name: row["display_name"]?.stringValue,
                oneLiner: row["one_liner"]?.stringValue,
                definition: row["definition"]?.stringValue,
                why: row["why_it_works"]?.stringValue,
                direction: row["bet_direction"]?.stringValue,
                typicalHit: row["typical_hit"]?.stringValue,
                market: row["market"]?.stringValue
            )
        }
        return out
    }

    private func fetchUpcoming(_ client: SupabaseClient, sport: String, season: Int) async -> [String: [FootballUpcomingFlag]] {
        let flagsTable = sport == "nfl" ? "nfl_slate_flags" : "cfb_slate_flags"
        let gamesTable = sport == "nfl" ? "nfl_slate_games" : "cfb_slate_games"
        async let flags: [JSONObject] = (try? await client
            .from(flagsTable)
            .select("signal_key,game,market,side,tier,game_id,bet_team,bet_line,line")
            .eq("season", value: season)
            .execute()
            .value) ?? []
        async let games: [JSONObject] = (try? await client
            .from(gamesTable)
            .select("game_id,kickoff,final_home,home_team,away_team")
            .eq("season", value: season)
            .execute()
            .value) ?? []
        return Self.groupUpcoming(flags: await flags, games: await games)
    }

    private func fetchSplits(sport: String) async -> [FootballRecordSplit] {
        struct Body: Encodable { let sport: String }
        struct Response: Decodable {
            let rows: [JSONObject]
        }
        let client = await MainSupabase.shared.client
        let response: Response? = try? await client.functions.invoke(
            "football-model-record",
            options: FunctionInvokeOptions(body: Body(sport: sport))
        )
        return (response?.rows ?? []).compactMap { row in
            guard let market = row["market"]?.stringValue, let scope = row["scope"]?.stringValue else { return nil }
            return FootballRecordSplit(
                market: market,
                scope: scope,
                scopeKey: row["scope_key"]?.stringValue ?? "",
                wins: row["wins"]?.intValue ?? 0,
                losses: row["losses"]?.intValue ?? 0,
                pushes: row["pushes"]?.intValue ?? 0,
                roiUnits: row["roi_units"]?.doubleValue,
                roiN: row["roi_n"]?.intValue ?? 0
            )
        }
    }

    private static func mapReport(_ row: JSONObject) -> FootballRegressionReport {
        let summary = row["summary"]
        let families = summary?["families"]?.objectValue?.compactMapValues { $0.intValue ?? $0.doubleValue.map { Int($0) } } ?? [:]
        let soon = (summary?["coming_soon"]?.arrayValue ?? []).compactMap { item -> FootballComingSoon? in
            guard let label = item["label"]?.stringValue else { return nil }
            return FootballComingSoon(emoji: item["emoji"]?.stringValue ?? "📌", label: label, note: item["note"]?.stringValue ?? "")
        }
        let record = (summary?["model_record"]?.arrayValue ?? []).compactMap { item -> FootballModelRecord? in
            guard let market = item["market"]?.stringValue else { return nil }
            let wins = item["wins"]?.intValue ?? 0
            let losses = item["losses"]?.intValue ?? 0
            let pushes = item["pushes"]?.intValue ?? 0
            guard wins + losses + pushes > 0 else { return nil }
            return FootballModelRecord(
                market: market,
                label: item["label"]?.stringValue ?? FootballRegressionCopy.marketLabel(market),
                wins: wins,
                losses: losses,
                pushes: pushes,
                roiUnits: item["roi_units"]?.doubleValue
            )
        }
        let changelog = row["changelog"]?.arrayValue?.first
        let digest = (changelog?["entries"]?.arrayValue ?? []).compactMap { entry -> FootballDigestEntry? in
            let type = entry["type"]?.stringValue ?? ""
            guard type == "new" || type == "updated", let title = entry["title"]?.stringValue, !title.isEmpty else { return nil }
            return FootballDigestEntry(type: type, title: title)
        }
        return FootballRegressionReport(
            sport: row["sport"]?.stringValue ?? "",
            season: row["season"]?.intValue ?? 0,
            week: row["week"]?.intValue ?? 0,
            narrative: row["narrative"]?.stringValue,
            updatedAt: row["updated_at"]?.stringValue,
            games: summary?["games"]?.intValue ?? 0,
            storylineCount: summary?["storylines"]?.intValue ?? 0,
            families: families,
            comingSoon: soon,
            modelRecord: record,
            digestDate: changelog?["date"]?.stringValue,
            digest: digest
        )
    }

    private static func mapNarrative(_ row: JSONObject) -> FootballPropNarrative? {
        guard let name = row["player_name"]?.stringValue, let market = row["market"]?.stringValue else { return nil }
        return FootballPropNarrative(
            id: row["id"]?.stringValue ?? "\(name)-\(market)-\(row["week"]?.intValue ?? 0)",
            playerName: name,
            team: row["team"]?.stringValue,
            opp: row["opp"]?.stringValue,
            position: row["position"]?.stringValue,
            market: market,
            line: row["line"]?.doubleValue,
            direction: row["direction"]?.stringValue,
            headshotUrl: row["headshot_url"]?.stringValue,
            kickoff: row["kickoff"]?.stringValue,
            summary: row["summary"]?.stringValue,
            body: row["body"]?.stringValue,
            bestOverLine: row["best_over_line"]?.doubleValue,
            bestOverPrice: row["best_over_price"]?.doubleValue,
            bestOverBook: row["best_over_book"]?.stringValue,
            bestUnderLine: row["best_under_line"]?.doubleValue,
            bestUnderPrice: row["best_under_price"]?.doubleValue,
            bestUnderBook: row["best_under_book"]?.stringValue,
            actual: row["actual_value"]?.doubleValue,
            result: row["result"]?.stringValue,
            week: row["week"]?.intValue ?? 0
        )
    }

    private static func groupUpcoming(flags: [JSONObject], games: [JSONObject]) -> [String: [FootballUpcomingFlag]] {
        var gameById: [String: JSONObject] = [:]
        for game in games {
            if let id = game["game_id"]?.stringValue { gameById[id] = game }
        }
        var out: [String: [FootballUpcomingFlag]] = [:]
        let now = Date()
        for flag in flags {
            guard let key = flag["signal_key"]?.stringValue, !key.isEmpty,
                  let gameId = flag["game_id"]?.stringValue,
                  let game = gameById[gameId] else { continue }
            if let final = game["final_home"], final != .null { continue }
            let kickoff = game["kickoff"]?.stringValue
            let started = kickoff.flatMap(NflPropBoardCopy.isoDate)?.timeIntervalSince(now) ?? 1 <= 0
            let pick = pickLabel(flag, home: game["home_team"]?.stringValue, away: game["away_team"]?.stringValue)
            out[key, default: []].append(FootballUpcomingFlag(signalKey: key, game: flag["game"]?.stringValue, pick: pick, kickoff: kickoff, started: started && kickoff != nil))
        }
        for key in out.keys {
            out[key]?.sort { ($0.kickoff ?? "") < ($1.kickoff ?? "") }
        }
        return out
    }

    private static func pickLabel(_ flag: JSONObject, home: String?, away: String?) -> String {
        let side = flag["side"]?.stringValue?.trimmingCharacters(in: .whitespaces) ?? ""
        if side.rangeOfCharacter(from: .decimalDigits) != nil { return side }
        let market = flag["market"]?.stringValue ?? ""
        let upper = side.uppercased()
        let isHome = upper.hasPrefix("HOME")
        let isAway = upper.hasPrefix("AWAY")
        let team = flag["bet_team"]?.stringValue ?? (isHome ? home : isAway ? away : nil)
        let betLine = flag["bet_line"]?.doubleValue
        let line = flag["line"]?.doubleValue
        func fmt(_ n: Double) -> String { n > 0 ? String(format: "+%.1f", n) : String(format: "%.1f", n) }
        if market == "spread" || market == "h1_spread" {
            let signed = betLine ?? (isAway ? line.map { -$0 } : line)
            let half = market == "h1_spread" ? " 1H" : ""
            if let team, let signed { return "\(team)\(half) \(fmt(signed))" }
            return team.map { "\($0)\(half)" } ?? (side.isEmpty ? "—" : side)
        }
        if market == "total" || market == "h1_total" {
            let number = line ?? betLine
            let dir = upper.contains("OVER") ? "OVER" : upper.contains("UNDER") ? "UNDER" : side
            let half = market == "h1_total" ? " 1H" : ""
            return number.map { "\(dir)\(half) \(NflPropBoardCopy.formatLine($0))" } ?? "\(dir)\(half)"
        }
        if market == "ml" || market == "h1_ml" {
            let half = market == "h1_ml" ? " 1H" : ""
            return team.map { "\($0)\(half) ML" } ?? "\(side)\(half)"
        }
        return side.isEmpty ? "—" : side
    }

    private static func num(_ value: JSONValue?) -> Double? {
        if let value { return value.doubleValue ?? value.stringValue.flatMap(Double.init) }
        return nil
    }
}

private typealias JSONObject = [String: JSONValue]
