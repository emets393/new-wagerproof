import Foundation
import Supabase
import WagerproofModels

public struct NflPropBoardPayload: Sendable {
    public let season: Int
    public let week: Int
    public let pages: [NFLPropPlayerPage]
    public let spotlight: [NflPropSpotlightRow]
    public let ledger: [NflPropSpotlightRow]
    public let books: [NflPropBookQuote]
    public let slate: [NflSlateContextLine]
    public let cheat: [NflCheatRow]
}

public actor NflPropBoardService {
    public static let shared = NflPropBoardService()
    public init() {}

    public func load() async throws -> NflPropBoardPayload {
        let cfb = await CFBSupabase.shared.client
        guard let slate = await FootballSlateAnchor.currentWeek(cfb, table: "nfl_prop_player_pages") else {
            return NflPropBoardPayload(season: 0, week: 0, pages: [], spotlight: [], ledger: [], books: [], slate: [], cheat: [])
        }
        async let pages = fetchPages(cfb, season: slate.season, week: slate.week)
        async let spotlight = fetchSpotlight(cfb, season: slate.season, week: slate.week)
        async let ledger = fetchLedger(cfb)
        async let books = fetchBooks(cfb, season: slate.season, week: slate.week)
        async let lines = fetchSlate(cfb, season: slate.season, week: slate.week)
        async let cheat = fetchCheat(cfb, season: slate.season, week: slate.week)
        return NflPropBoardPayload(
            season: slate.season,
            week: slate.week,
            pages: try await pages,
            spotlight: await spotlight,
            ledger: await ledger,
            books: await books,
            slate: await lines,
            cheat: await cheat
        )
    }

    private func fetchPages(_ client: SupabaseClient, season: Int, week: Int) async throws -> [NFLPropPlayerPage] {
        try await client
            .from("nfl_prop_player_pages")
            .select("player_id,season,week,player_name,position,team,opponent,is_home,game_label,kickoff,headshot_url,rookie,markets,baseline,projection,fp_cards,scheme,ngs,highlights")
            .eq("season", value: season)
            .eq("week", value: week)
            .execute()
            .value
    }

    private func fetchSpotlight(_ client: SupabaseClient, season: Int, week: Int) async -> [NflPropSpotlightRow] {
        let columns = "season,week,player_id,player_name,position,team,opponent,market,market_label,side,line,net,n_for,n_against,board_rank,tells,narrative,result,actual_value,kickoff,headshot_url,price,book_name,units"
        let rows: [NflPropSpotlightRow] = (try? await client
            .from("nfl_prop_spotlight")
            .select(columns)
            .eq("season", value: season)
            .eq("week", value: week)
            .order("board_rank", ascending: true)
            .execute()
            .value) ?? []
        return rows
    }

    private func fetchLedger(_ client: SupabaseClient) async -> [NflPropSpotlightRow] {
        let columns = "season,week,player_name,market_label,side,line,price,book_name,result,actual_value,units,board_rank,market,player_id"
        return (try? await client
            .from("nfl_prop_spotlight")
            .select(columns)
            .order("season", ascending: false)
            .order("week", ascending: false)
            .order("board_rank", ascending: true)
            .execute()
            .value) ?? []
    }

    private func fetchBooks(_ client: SupabaseClient, season: Int, week: Int) async -> [NflPropBookQuote] {
        (try? await client
            .from("nfl_slate_props")
            .select("player_id,market,best_over_book,best_over_line,best_over_price,best_under_book,best_under_line,best_under_price")
            .eq("season", value: season)
            .eq("week", value: week)
            .execute()
            .value) ?? []
    }

    private func fetchSlate(_ client: SupabaseClient, season: Int, week: Int) async -> [NflSlateContextLine] {
        (try? await client
            .from("nfl_slate_feed")
            .select("home_ab,away_ab,fg_spread_close,fg_total_close,wx_indoors,wx_summary,wx_temp_f,wx_wind_mph,wx_precip_mm")
            .eq("season", value: season)
            .eq("week", value: week)
            .execute()
            .value) ?? []
    }

    private func fetchCheat(_ client: SupabaseClient, season: Int, week: Int) async -> [NflCheatRow] {
        let columns = "season,week,family,table_key,position_filter,alignment_filter,side,team,opponent,kickoff,metrics,headline,player"
        let raw: [NflCheatRawRow] = (try? await client
            .from("nfl_prop_cheatsheet")
            .select(columns)
            .eq("season", value: season)
            .eq("week", value: week)
            .execute()
            .value) ?? []
        return NflCheatSheetMath.parseRows(raw)
    }
}
