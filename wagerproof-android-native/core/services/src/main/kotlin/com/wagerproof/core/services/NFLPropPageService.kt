package com.wagerproof.core.services

import com.wagerproof.core.models.NFLPlayerGameLogRow
import com.wagerproof.core.models.NFLPropPlayerPage
import com.wagerproof.core.models.NFLPropPlayerPageRow
import com.wagerproof.core.models.NFLPropTrendsDetail
import com.wagerproof.core.models.NFLPropTrendsDetailRow
import com.wagerproof.core.models.NFLPropTrendsEnrichment
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Everything the NFL player-analysis detail fetches beyond the props-feed
 * selection: the page row and the trends row, each degrading to null alone.
 */
data class NFLPropPlayerDetailBundle(
    /** Null ⇒ fall back to the selection's markets (offseason / rookie week). */
    val page: NFLPropPlayerPage?,
    val trends: NFLPropTrendsDetail?,
)

/**
 * Fetches the NFL player-analysis contract from the CFB (research) Supabase
 * project — the same three tables the web `/props` player drilldown reads
 * (`src/features/propBreakdown/hooks.ts`), mirroring iOS `NFLPropPageService`:
 *
 * - `nfl_prop_player_pages` — one row per player per slate week: posted
 *   markets, WagerProof projection, scheme compare, per-game splits.
 * - `nfl_player_prop_trends` — one row per player: recent game log, career
 *   H2H matchups, situational splits.
 * - `nfl_player_game_logs` — real stat totals merged into the game log's
 *   `actuals` (the served log carries grades; the chart needs quantities).
 */
class NFLPropPageService {

    private val ttlMs = 300 * 1000L
    private val mutex = Mutex()
    private val cache = mutableMapOf<String, Pair<Long, NFLPropPlayerDetailBundle>>()
    private var slate: Triple<Long, Int, Int>? = null

    suspend fun detail(playerId: String): NFLPropPlayerDetailBundle {
        mutex.withLock {
            cache[playerId]?.let { (at, bundle) ->
                if (System.currentTimeMillis() - at < ttlMs) return bundle
            }
        }

        // Trends are keyed by player only; the page needs the latest slate.
        // Each leg degrades to null independently — an offseason-empty pages
        // table must not blank the trends widgets.
        val bundle = coroutineScope {
            val page = async { runCatching { fetchPage(playerId) }.getOrNull() }
            val trends = async { runCatching { fetchTrends(playerId) }.getOrNull() }
            NFLPropPlayerDetailBundle(page = page.await(), trends = trends.await())
        }
        mutex.withLock { cache[playerId] = System.currentTimeMillis() to bundle }
        return bundle
    }

    // MARK: Page

    private suspend fun fetchPage(playerId: String): NFLPropPlayerPage? {
        val (season, week) = resolveSlate() ?: return null
        return SupabaseClients.cfb
            .from("nfl_prop_player_pages")
            .select {
                filter {
                    eq("season", season)
                    eq("week", week)
                    eq("player_id", playerId)
                }
                limit(1)
            }
            .decodeList<NFLPropPlayerPageRow>()
            .firstOrNull()
            ?.toPage()
    }

    @Serializable
    private data class SlateRow(val season: Int, val week: Int)

    /**
     * Latest (season, week) present in the pages table, mirroring the web's
     * `resolveLatestSlate`. Cached; null while the table is empty (offseason).
     */
    private suspend fun resolveSlate(): Pair<Int, Int>? {
        mutex.withLock {
            slate?.let { (at, season, week) ->
                if (System.currentTimeMillis() - at < ttlMs) return season to week
            }
        }
        val row = SupabaseClients.cfb
            .from("nfl_prop_player_pages")
            .select(columns = Columns.raw("season,week")) {
                order("season", Order.DESCENDING)
                order("week", Order.DESCENDING)
                limit(1)
            }
            .decodeList<SlateRow>()
            .firstOrNull() ?: return null
        mutex.withLock { slate = Triple(System.currentTimeMillis(), row.season, row.week) }
        return row.season to row.week
    }

    // MARK: Trends + game-log enrichment

    private suspend fun fetchTrends(playerId: String): NFLPropTrendsDetail? {
        val trends = SupabaseClients.cfb
            .from("nfl_player_prop_trends")
            .select(columns = Columns.raw("player_id,recent_game_log,matchups,splits")) {
                filter { eq("player_id", playerId) }
                limit(1)
            }
            .decodeList<NFLPropTrendsDetailRow>()
            .firstOrNull()
            ?.toDetail() ?: return null
        if (trends.recentGameLog.isEmpty()) return trends

        val seasons = trends.recentGameLog.map { it.season }.distinct()
        val weeks = trends.recentGameLog.map { it.week }.distinct()
        // seasons × weeks is a cross-product superset (same as the web query);
        // the "$season-$week" keyed merge discards the extras.
        val logs = runCatching {
            SupabaseClients.cfb
                .from("nfl_player_game_logs")
                .select(
                    columns = Columns.raw(
                        "player_id,season,week,pass_yds,pass_tds,rush_yds,rush_tds,rec_yds,rec_tds,receptions,pass_attempts,carries,completions",
                    ),
                ) {
                    filter {
                        eq("player_id", playerId)
                        isIn("season", seasons)
                        isIn("week", weeks)
                    }
                }
                .decodeList<NFLPlayerGameLogRow>()
        }.getOrDefault(emptyList())

        return if (logs.isEmpty()) {
            trends
        } else {
            trends.copy(recentGameLog = NFLPropTrendsEnrichment.enrich(trends.recentGameLog, logs))
        }
    }

    companion object {
        val shared = NFLPropPageService()
    }
}
