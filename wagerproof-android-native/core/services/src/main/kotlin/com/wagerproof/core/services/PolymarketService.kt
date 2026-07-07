package com.wagerproof.core.services

import com.wagerproof.core.models.PolymarketGameMarkets
import com.wagerproof.core.models.PolymarketMarket
import com.wagerproof.core.models.PolymarketMarketType
import com.wagerproof.core.models.PolymarketPricePoint
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import io.github.jan.supabase.postgrest.from
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Polymarket market lookup (port of iOS PolymarketService.swift). Cache-first:
 * reads the pg_cron-refreshed `polymarket_markets` table on the Main project.
 * Read-only — the backend owns cache freshness; this service never writes.
 *
 * The live gamma-API fallback is deliberately stubbed (matches iOS): the
 * hourly cache covers prod traffic, so a cache miss returns null and the UI
 * renders a placeholder.
 */
class PolymarketService private constructor() {

    companion object {
        val shared: PolymarketService = PolymarketService()
    }

    /**
     * Fetch markets for a single game. Returns null when the lookup fails or
     * produces no rows — callers render a placeholder in that case.
     */
    suspend fun markets(
        league: String,
        awayTeam: String,
        homeTeam: String,
    ): PolymarketGameMarkets? {
        // iOS DEBUG dummy-data mode serves captured price curves here. The
        // fixtures aren't ported yet, so honor the flag by skipping the network
        // and returning the "no data" placeholder path instead of live reads.
        if (BuildFlags.isDebugBuild && isDummyDataMode()) {
            return null
        }
        return fetchFromCache(league = league, awayTeam = awayTeam, homeTeam = homeTeam)
    }

    private fun isDummyDataMode(): Boolean =
        runCatching { AppGroup.prefs.getBoolean(AppGroupKey.DUMMY_DATA_MODE, false) }
            .getOrDefault(false)

    /**
     * Mirrors RN `getAllMarketsDataFromCache`: single query against
     * `polymarket_markets` by composite `game_key` + league, rows grouped
     * by market type. Any error -> null.
     */
    private suspend fun fetchFromCache(
        league: String,
        awayTeam: String,
        homeTeam: String,
    ): PolymarketGameMarkets? {
        val gameKey = "${league}_${awayTeam}_${homeTeam}"
        return runCatching {
            val rows = SupabaseClients.main.from("polymarket_markets")
                .select {
                    filter {
                        eq("game_key", gameKey)
                        eq("league", league)
                    }
                }
                .decodeList<PolymarketCacheRow>()

            if (rows.isEmpty()) return@runCatching null

            val byType = mutableMapOf<PolymarketMarketType, PolymarketMarket>()
            for (row in rows) {
                val type = marketType(row.marketType)
                byType[type] = PolymarketMarket(
                    gameKey = gameKey,
                    league = league,
                    marketType = type,
                    tokenId = row.tokenId,
                    currentAwayOdds = row.currentAwayOdds,
                    currentHomeOdds = row.currentHomeOdds,
                    priceHistory = row.priceHistory ?: emptyList(),
                )
            }
            PolymarketGameMarkets(awayTeam = awayTeam, homeTeam = homeTeam, markets = byType)
        }.getOrNull()
    }

    // Swift `PolymarketMarketType(rawValue: raw ?? "moneyline") ?? .moneyline`
    private fun marketType(raw: String?): PolymarketMarketType =
        PolymarketMarketType.entries.firstOrNull { it.raw == (raw ?: "moneyline") }
            ?: PolymarketMarketType.MONEYLINE
}

// Internal decoder shape — callers only ever see the sanitized
// PolymarketGameMarkets, so the raw row stays file-private.
@Serializable
private data class PolymarketCacheRow(
    @SerialName("game_key") val gameKey: String? = null,
    val league: String? = null,
    @SerialName("market_type") val marketType: String? = null,
    @SerialName("token_id") val tokenId: String? = null,
    @SerialName("current_away_odds") val currentAwayOdds: Double? = null,
    @SerialName("current_home_odds") val currentHomeOdds: Double? = null,
    @SerialName("price_history") val priceHistory: List<PolymarketPricePoint>? = null,
)
