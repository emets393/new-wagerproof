import Foundation
import Supabase
import WagerproofModels

public struct NbaPropBoardPayload: Sendable {
    public let rows: [NbaSlateProp]
    public let defs: [String: NbaPropDef]

    public init(rows: [NbaSlateProp], defs: [String: NbaPropDef]) {
        self.rows = rows
        self.defs = defs
    }
}

public actor NBAPropsService {
    public static let shared = NBAPropsService()
    public init() {}

    public func loadBoard() async throws -> NbaPropBoardPayload {
        let client = await CFBSupabase.shared.client
        let dates = Self.etDates()
        async let rows: [NbaSlateProp] = client
            .from("nba_slate_props")
            .select("game_date,commence_time,game,home_abbr,away_abbr,athlete_id,player_name,position,team,opponent,headshot_url,market,market_label,line,over_price,under_price,open_line,last_game,l3_avg,l5_avg,l10_avg,szn_avg,prior_szn_avg,prior_szn_gp,gp_prior,min_l5,over_rate_l5,over_rate_l10,over_rate_szn,recent_games,baseline,baseline_gap,rank_pos,flags,flag_detail,report_status")
            .in("game_date", values: dates)
            .order("rank_pos", ascending: true)
            .execute()
            .value
        async let defs: [NbaPropDef] = client
            .from("nba_prop_defs")
            .select("signal_key,display_name,one_liner,definition,why_it_works,bet_direction,record_text,season_record_text")
            .execute()
            .value
        let defRows = try await defs
        var map: [String: NbaPropDef] = [:]
        for def in defRows { map[def.signalKey] = def }
        return NbaPropBoardPayload(rows: try await rows, defs: map)
    }

    public func books(for row: NbaSlateProp) async -> (current: [NbaBookQuote], history: [NbaBookQuote]) {
        guard !row.athleteId.isEmpty, let market = row.market, let date = row.gameDate else { return ([], []) }
        let client = await CFBSupabase.shared.client
        let current: [NbaBookQuote] = (try? await client
            .from("nba_player_props_current")
            .select("bookmaker,line,over_odds,under_odds,snapshot_time")
            .eq("athlete_id", value: row.athleteId)
            .eq("market", value: market)
            .eq("game_date", value: date)
            .execute()
            .value) ?? []
        let history: [NbaBookQuote] = (try? await client
            .from("nba_player_props")
            .select("bookmaker,line,over_odds,under_odds,snapshot_time")
            .eq("athlete_id", value: row.athleteId)
            .eq("market", value: market)
            .eq("game_date", value: date)
            .order("snapshot_time", ascending: true)
            .limit(500)
            .execute()
            .value) ?? []
        return (current, history)
    }

    public static func etDates() -> [String] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York") ?? .current
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let start = calendar.startOfDay(for: Date())
        return (0..<2).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }.map { formatter.string(from: $0) }
    }
}
