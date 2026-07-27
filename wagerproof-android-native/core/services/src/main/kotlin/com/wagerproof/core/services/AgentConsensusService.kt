package com.wagerproof.core.services

import com.wagerproof.core.models.GameAgentConsensus
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * Public-agent consensus for the /games feed cards.
 * See .claude/docs/18_agent_consensus.md.
 *
 * MUST go through the RPC: `avatar_picks` is RLS-gated and the anon key sees
 * ZERO rows, so a direct PostgREST select returns nothing for signed-out AND
 * signed-in users. `get_game_agent_consensus` is SECURITY DEFINER and only
 * aggregates (counts + the 4 stack avatars) cross the wire.
 *
 * Picks live in MAIN while the games feed comes from the CFB project, so there
 * is no SQL join available — this returns a map keyed by `game_id` and the
 * caller merges by lookup. That merge MUST be a left join: picks exist before
 * predictions populate, so a game with no consensus row is normal.
 */
object AgentConsensusService {

    /**
     * One RPC call for a whole slate. [gameDates] is every distinct game date in
     * the feed — MLB's `mlb_games_today` spans today AND tomorrow, so a
     * single-date call would leave the next day's cards permanently unflagged.
     *
     * The flag thresholds (`p_min_share` / `p_rel_share` / `p_min_agents`) are
     * deliberately left at the SQL defaults; they were calibrated server-side
     * and retuning them is a cross-client decision, not a per-platform one.
     *
     * Throws on transport/decode failure — callers treat that as "no strip".
     */
    suspend fun fetchGameAgentConsensus(
        sport: String,
        gameDates: List<String>,
    ): Map<String, GameAgentConsensus> {
        if (gameDates.isEmpty()) return emptyMap()

        val params = buildJsonObject {
            put("p_sport", sport)
            putJsonArray("p_game_dates") { gameDates.forEach { add(it) } }
        }

        val rows: List<GameAgentConsensus> = SupabaseClients.main.postgrest
            .rpc("get_game_agent_consensus", params)
            .decodeList()

        return rows.associateBy { it.gameId }
    }
}
