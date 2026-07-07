package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Polymarket market cache row (`polymarket_markets` table, main Supabase;
 * `game_key` format `{league}_{away_team}_{home_team}`). Backed by a pg_cron
 * refreshed cache; the service falls back to gamma-api.polymarket.com on miss.
 *
 * `priceHistory` is a JSONB array of `{t, p}` rows where `t` is a unix
 * timestamp (seconds) and `p` is the YES-token price (0.0-1.0).
 */
@Serializable
data class PolymarketMarket(
    @SerialName("game_key") val gameKey: String,
    val league: String,
    @SerialName("market_type") val marketType: PolymarketMarketType,
    @SerialName("token_id") val tokenId: String? = null,
    @SerialName("current_away_odds") val currentAwayOdds: Double? = null,
    @SerialName("current_home_odds") val currentHomeOdds: Double? = null,
    @SerialName("price_history") val priceHistory: List<PolymarketPricePoint>,
) {
    val id: String get() = "$gameKey#${marketType.raw}"
}

@Serializable
enum class PolymarketMarketType(val raw: String) {
    @SerialName("moneyline") MONEYLINE("moneyline"),
    @SerialName("spread") SPREAD("spread"),
    @SerialName("total") TOTAL("total");

    val displayLabel: String
        get() = when (this) {
            MONEYLINE -> "Moneyline"
            SPREAD -> "Spread"
            TOTAL -> "Total"
        }
}

/**
 * A single Polymarket price observation. `t` is unix seconds, `p` is the
 * price of the YES outcome on the away-team token (0.0-1.0); home = 1 - p.
 * Literal wire keys `t` / `p` — do not rename.
 */
@Serializable
data class PolymarketPricePoint(
    val t: Int,
    val p: Double,
)

/**
 * Bundle of markets for a single game. Team names are echoed so callers can
 * render labels without re-parsing the `game_key`. Client-assembled, not serialized.
 */
data class PolymarketGameMarkets(
    val awayTeam: String,
    val homeTeam: String,
    val markets: Map<PolymarketMarketType, PolymarketMarket>,
) {
    val moneyline: PolymarketMarket? get() = markets[PolymarketMarketType.MONEYLINE]
    val spread: PolymarketMarket? get() = markets[PolymarketMarketType.SPREAD]
    val total: PolymarketMarket? get() = markets[PolymarketMarketType.TOTAL]
}
