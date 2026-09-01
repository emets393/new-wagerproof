package com.wagerproof.core.services

import com.wagerproof.core.models.ParlayGodNFLContext
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Moneyline + first-half closes for the NFL slate, keyed by `game_id`.
 *
 * iOS gets these for free: `OutliersTrendsService`'s NFL game select carries
 * the `fg_ml_*` / `h1_*` columns and hands them to every consumer on
 * `OutliersTrendsGame.nflContext`. Android's equivalent select is narrower (the
 * Outliers trend cards never read those columns), and widening it is owned by
 * the Outliers track — so Parlay God asks for exactly the nine columns it needs
 * in one slate-scoped query instead.
 *
 * Best-effort by design: [ParlayGodEngine.nflTeamLegs] falls back to
 * [ParlayGodNFLContext.EMPTY] per game, which drops ML and H1 legs but still
 * prices full-game spread/total legs off `fg_spread_close` / `fg_total_close`.
 */
class ParlayGodNflOddsService {

    /**
     * [gameIds] is the current slate's `nfl_slate_feed.game_id` list — the
     * caller already has it from the NFL trends bundle, so no season/week
     * anchor round-trip is needed here.
     */
    suspend fun fetchSlateOdds(gameIds: List<String>): Map<String, ParlayGodNFLContext> {
        if (gameIds.isEmpty()) return emptyMap()
        val rows = SupabaseClients.cfb.from("nfl_slate_feed")
            .select(Columns.raw(ODDS_COLUMNS)) {
                filter { isIn("game_id", gameIds) }
            }
            .decodeList<OddsRow>()
        return rows.associate { it.gameId to it.context() }
    }

    @Serializable
    private data class OddsRow(
        @SerialName("game_id") val gameId: String,
        @SerialName("fg_ml_home_close") val fgMlHomeClose: Double? = null,
        @SerialName("fg_ml_away_close") val fgMlAwayClose: Double? = null,
        @SerialName("h1_spread_close") val h1SpreadClose: Double? = null,
        @SerialName("h1_spread_home_price") val h1SpreadHomePrice: Double? = null,
        @SerialName("h1_spread_away_price") val h1SpreadAwayPrice: Double? = null,
        @SerialName("h1_total_close") val h1TotalClose: Double? = null,
        @SerialName("h1_total_over_price") val h1TotalOverPrice: Double? = null,
        @SerialName("h1_total_under_price") val h1TotalUnderPrice: Double? = null,
    ) {
        fun context(): ParlayGodNFLContext = ParlayGodNFLContext(
            homeMl = fgMlHomeClose,
            awayMl = fgMlAwayClose,
            h1SpreadClose = h1SpreadClose,
            h1SpreadHomePrice = h1SpreadHomePrice,
            h1SpreadAwayPrice = h1SpreadAwayPrice,
            h1TotalClose = h1TotalClose,
            h1TotalOverPrice = h1TotalOverPrice,
            h1TotalUnderPrice = h1TotalUnderPrice,
        )
    }

    companion object {
        val shared = ParlayGodNflOddsService()

        private const val ODDS_COLUMNS =
            "game_id,fg_ml_home_close,fg_ml_away_close," +
                "h1_spread_close,h1_spread_home_price,h1_spread_away_price," +
                "h1_total_close,h1_total_over_price,h1_total_under_price"
    }
}
