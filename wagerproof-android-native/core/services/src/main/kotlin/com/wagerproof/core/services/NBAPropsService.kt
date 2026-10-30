package com.wagerproof.core.services

import com.wagerproof.core.models.NbaBookQuote
import com.wagerproof.core.models.NbaPropDef
import com.wagerproof.core.models.NbaSlateProp
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.LocalDate
import java.time.ZoneId

object NBAPropsService {
    private const val SLATE = "game_date,commence_time,game,home_abbr,away_abbr,athlete_id,player_name,position,team,opponent,headshot_url,market,market_label,line,over_price,under_price,open_line,last_game,l3_avg,l5_avg,l10_avg,szn_avg,prior_szn_avg,prior_szn_gp,gp_prior,min_l5,over_rate_l5,over_rate_l10,over_rate_szn,recent_games,baseline,baseline_gap,rank_pos,flags,flag_detail,report_status"

    suspend fun loadBoard(): Pair<List<NbaSlateProp>, Map<String, NbaPropDef>> {
        val cfb = SupabaseClients.cfb
        val dates = etDates()
        val rows = cfb.from("nba_slate_props").select(columns = Columns.raw(SLATE)) {
            filter { isIn("game_date", dates) }
            order("rank_pos", Order.ASCENDING)
        }.decodeList<NbaSlateProp>()
        val defs = cfb.from("nba_prop_defs")
            .select(columns = Columns.raw("signal_key,display_name,one_liner,definition,why_it_works,bet_direction,record_text,season_record_text"))
            .decodeList<NbaPropDef>()
        return rows to defs.associateBy { it.signalKey }
    }

    suspend fun books(row: NbaSlateProp): Pair<List<NbaBookQuote>, List<NbaBookQuote>> {
        val athlete = row.athleteId ?: return emptyList<NbaBookQuote>() to emptyList()
        val market = row.market ?: return emptyList<NbaBookQuote>() to emptyList()
        val date = row.gameDate ?: return emptyList<NbaBookQuote>() to emptyList()
        val cfb = SupabaseClients.cfb
        val current = runCatching {
            cfb.from("nba_player_props_current").select(columns = Columns.raw("bookmaker,line,over_odds,under_odds,snapshot_time")) {
                filter {
                    eq("athlete_id", athlete)
                    eq("market", market)
                    eq("game_date", date)
                }
            }.decodeList<NbaBookQuote>()
        }.getOrDefault(emptyList())
        val history = runCatching {
            cfb.from("nba_player_props").select(columns = Columns.raw("bookmaker,line,over_odds,under_odds,snapshot_time")) {
                filter {
                    eq("athlete_id", athlete)
                    eq("market", market)
                    eq("game_date", date)
                }
                order("snapshot_time", Order.ASCENDING)
                limit(500)
            }.decodeList<NbaBookQuote>()
        }.getOrDefault(emptyList())
        return current to history
    }

    fun etDates(): List<String> {
        val today = LocalDate.now(ZoneId.of("America/New_York"))
        return listOf(today.toString(), today.plusDays(1).toString())
    }
}
