package com.wagerproof.core.services

import com.wagerproof.core.models.NFLDryrunPropRow
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropGameContext
import com.wagerproof.core.models.NFLPropPlayer
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Fetches the NFL player-props board from the CFB (research) Supabase
 * project, per the "NFL Week 12 2025 Dry Run — App Data Contract":
 *
 * - `nfl_dryrun_props` — one row per player x market: consensus close
 *   line/prices, season game-log trends, defense matchup, P-flags, headshot.
 * - `nfl_dryrun_games` — kickoff context (gameday + slot), joined client-side.
 *
 * The 2026 in-season tables will follow this same shape, so this service is
 * the production read path — only the table names change at cutover.
 */
class NFLPlayerPropsService {

    /**
     * Fetch the slate's prop rows + game contexts and group them per player.
     * The dry-run tables hold exactly one curated week (~950 rows), so no
     * date filter is needed; revisit if the in-season tables accumulate weeks.
     */
    suspend fun fetchPlayers(): List<NFLPropPlayer> {
        // Team logos/abbrs come from the `nfl_teams` reference table — warm
        // the cache so the cards can read it synchronously.
        NFLTeamsService.ensureLoaded()

        val rows = SupabaseClients.cfb
            .from("nfl_dryrun_props")
            .select {
                order("player_name", Order.ASCENDING)
            }
            .decodeList<NFLDryrunPropRow>()

        // Kickoff context is decoration — a miss degrades to undated cards,
        // never to an error.
        val games = runCatching { fetchGameContexts() }.getOrDefault(emptyMap())
        return NFLPlayerProps.group(
            rows,
            games = games,
            bestBooksFallback = bestBooksFallbackIndex,
        )
    }

    @Serializable
    private data class GameContextRow(
        @SerialName("game_id") val gameId: String,
        val gameday: String? = null,
        val slot: String? = null,
    )

    private suspend fun fetchGameContexts(): Map<String, NFLPropGameContext> {
        val rows = SupabaseClients.cfb
            .from("nfl_dryrun_games")
            .select(columns = Columns.raw("game_id, gameday, slot"))
            .decodeList<GameContextRow>()
        return rows.associate {
            it.gameId to NFLPropGameContext(gameDate = it.gameday ?: "", slot = it.slot)
        }
    }

    companion object {
        val shared = NFLPlayerPropsService()

        /** Backend-precomputed best shops (dry-run assets bundle) — not calculated on device. */
        private val bestBooksFallbackIndex: Map<String, NFLPlayerProps.NFLPropBestBooksFallback> by lazy {
            NFLPropBestBooksBundle.index.mapValues { (_, record) ->
                NFLPlayerProps.NFLPropBestBooksFallback(
                    bestOverBook = record.bestOverBook,
                    bestOverBookName = record.bestOverBookName,
                    bestOverBookLogo = record.bestOverBookLogo,
                    bestOverLine = record.bestOverLine,
                    bestOverPrice = record.bestOverPrice,
                    bestUnderBook = record.bestUnderBook,
                    bestUnderBookName = record.bestUnderBookName,
                    bestUnderBookLogo = record.bestUnderBookLogo,
                    bestUnderLine = record.bestUnderLine,
                    bestUnderPrice = record.bestUnderPrice,
                )
            }
        }
    }
}
