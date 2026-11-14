package com.wagerproof.core.services

import com.wagerproof.core.models.PublicBetting
import com.wagerproof.core.models.PublicBettingGame
import com.wagerproof.core.models.PublicBoardRow
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order

/// One read of `action_public_splits_board`. The raw splits log is never queried.
object PublicBettingService {
    private const val COLUMNS =
        "game_id,market,sport,start_time,away,home,snap_ts,away_open,home_open,away_cons,home_cons,bets_away,bets_home,money_away,money_home,tickets,has_split"

    suspend fun loadBoard(): List<PublicBettingGame> {
        val rows = SupabaseClients.cfb.from("action_public_splits_board")
            .select(columns = Columns.raw(COLUMNS)) {
                order("start_time", Order.ASCENDING)
            }
            .decodeList<PublicBoardRow>()
        return PublicBetting.games(rows)
    }
}
