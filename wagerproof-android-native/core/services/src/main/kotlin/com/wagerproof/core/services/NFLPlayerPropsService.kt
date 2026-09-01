package com.wagerproof.core.services

import com.wagerproof.core.models.NFLPlayerGameLogRow
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLPropPlayerPageRow
import com.wagerproof.core.models.NFLPropRecentGame
import com.wagerproof.core.models.NFLPropTrendsDetail
import com.wagerproof.core.models.NFLPropTrendsDetailRow
import com.wagerproof.core.models.NFLPropTrendsEnrichment
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.Serializable

/**
 * Fetches the NFL player-props board from the live 2026 tables on the
 * CFB (research) Supabase project:
 *
 * - `nfl_prop_player_pages` — one row per player per slate week: identity,
 *   posted/pending markets, kickoff.
 * - `nfl_player_prop_trends` — prior-season game log (grades + lines).
 * - `nfl_player_game_logs` — real stat totals merged into that log.
 *
 * Slate staging tables are not read.
 */
class NFLPlayerPropsService {

    /** Latest slate's player pages, enriched with L10 game logs. */
    suspend fun fetchPlayers(): List<NFLPropPlayer> {
        NFLTeamsService.ensureLoaded()

        val slate = resolveSlate() ?: return emptyList()
        val pages = SupabaseClients.cfb
            .from("nfl_prop_player_pages")
            .select(
                columns = Columns.raw(
                    "player_id,season,week,player_name,position,team,opponent,is_home,game_label,kickoff,headshot_url,rookie,markets",
                ),
            ) {
                filter {
                    eq("season", slate.first)
                    eq("week", slate.second)
                }
            }
            .decodeList<NFLPropPlayerPageRow>()
            .map { it.toPage() }

        val history = fetchRecentGamesFallback(pages.map { it.playerId })
        return NFLPlayerProps.players(from = pages, recentGames = history)
    }

    @Serializable
    private data class SlateRow(val season: Int, val week: Int)

    /**
     * Latest (season, week) present in the pages table — same rule as
     * [NFLPropPageService] / the web `resolveLatestSlate`.
     */
    private suspend fun resolveSlate(): Pair<Int, Int>? {
        val row = SupabaseClients.cfb
            .from("nfl_prop_player_pages")
            .select(columns = Columns.raw("season,week")) {
                order("season", Order.DESCENDING)
                order("week", Order.DESCENDING)
                limit(1)
            }
            .decodeList<SlateRow>()
            .firstOrNull() ?: return null
        return row.season to row.week
    }

    /**
     * Website parity for Week 1: trends are queried by player only (no
     * current-season filter), so the card can show the last ten games from
     * the prior season until the new season has results.
     */
    private suspend fun fetchRecentGamesFallback(
        playerIds: List<String>,
    ): Map<String, List<NFLPropRecentGame>> {
        val uniqueIds = playerIds.distinct()
        if (uniqueIds.isEmpty()) return emptyMap()

        val trends = mutableListOf<NFLPropTrendsDetail>()
        for (chunk in uniqueIds.chunked(120)) {
            val rows = runCatching {
                SupabaseClients.cfb.from("nfl_player_prop_trends")
                    .select(columns = Columns.raw("player_id,recent_game_log,matchups,splits")) {
                        filter { isIn("player_id", chunk) }
                    }
                    .decodeList<NFLPropTrendsDetailRow>()
                    .map { it.toDetail() }
            }.getOrDefault(emptyList())
            trends += rows
        }
        if (trends.isEmpty()) return emptyMap()

        val seasons = trends.flatMap { trend -> trend.recentGameLog.map { it.season } }.distinct()
        val weeks = trends.flatMap { trend -> trend.recentGameLog.map { it.week } }.distinct()
        if (seasons.isEmpty() || weeks.isEmpty()) return emptyMap()

        val logs = mutableListOf<NFLPlayerGameLogRow>()
        for (chunk in uniqueIds.chunked(120)) {
            val rows = runCatching {
                SupabaseClients.cfb.from("nfl_player_game_logs")
                    .select(
                        columns = Columns.raw(
                            "player_id,season,week,pass_yds,pass_tds,rush_yds,rush_tds,rec_yds,rec_tds,receptions,pass_attempts,carries,completions",
                        ),
                    ) {
                        filter {
                            isIn("player_id", chunk)
                            isIn("season", seasons)
                            isIn("week", weeks)
                        }
                    }
                    .decodeList<NFLPlayerGameLogRow>()
            }.getOrDefault(emptyList())
            logs += rows
        }
        val logsByPlayer = logs.groupBy { it.playerId }

        val result = mutableMapOf<String, List<NFLPropRecentGame>>()
        trends.forEach { trend ->
            val enriched = NFLPropTrendsEnrichment.enrich(
                trend.recentGameLog,
                logsByPlayer[trend.playerId].orEmpty(),
            )
            val markets = enriched.flatMap { it.actuals.keys + it.markets.keys }.toSet()
            markets.forEach { market ->
                val games = enriched.take(10).asReversed().mapNotNull { game ->
                    val actual = game.actuals[market] ?: return@mapNotNull null
                    // Don't bake last year's O/U letter in as `cleared` —
                    // the widget grades actuals against THIS week's line.
                    NFLPropRecentGame(game.opp, game.week, actual, cleared = null)
                }
                if (games.isNotEmpty()) result["${trend.playerId}|$market"] = games
            }
        }
        return result
    }

    companion object {
        val shared = NFLPlayerPropsService()
    }
}
