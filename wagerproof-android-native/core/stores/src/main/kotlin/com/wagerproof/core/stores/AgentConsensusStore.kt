package com.wagerproof.core.stores

import android.util.Log
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.GameAgentConsensus
import com.wagerproof.core.services.AgentConsensusService

/**
 * Public-agent consensus for the games feed, keyed by sport then `game_id`.
 * See .claude/docs/18_agent_consensus.md.
 *
 * Deliberately NOT folded into [GamesStore] or the per-sport card adapters: the
 * flag threshold scales with the whole slate's pick volume, so it can only be
 * computed once the full set of games for a date is known. One RPC serves the
 * entire feed; cards read it back through [consensus].
 *
 * There is no `LoadState` here on purpose — failure is non-fatal by design. A
 * failed fetch keeps whatever was cached and the feed renders without the strip.
 */
@Stable
class AgentConsensusStore {

    /** Per-sport `game_id` → consensus. Missing entry = no agents on that game. */
    var bySport: Map<GamesStore.Sport, Map<String, GameAgentConsensus>> by mutableStateOf(emptyMap()); private set

    // Slate identity (the sorted date list) a sport was last fetched for, so a
    // date rollover or an MLB slate gaining tomorrow's games refetches at once
    // instead of waiting out the TTL.
    private var slateKeys: Map<GamesStore.Sport, String> = emptyMap()
    private var fetchedAt: Map<GamesStore.Sport, Long> = emptyMap()

    fun consensus(sport: GamesStore.Sport, gameId: String): GameAgentConsensus? =
        bySport[sport]?.get(gameId)

    /**
     * Fetch consensus for a whole slate. [gameDates] is every distinct date in
     * the current feed (MLB spans today AND tomorrow) — pass them all, one call.
     */
    suspend fun refresh(
        sport: GamesStore.Sport,
        gameDates: List<String>,
        force: Boolean = false,
    ) {
        val dates = gameDates.filter { it.isNotBlank() }.distinct().sorted()
        if (dates.isEmpty()) return

        val key = dates.joinToString(",")
        if (!force && slateKeys[sport] == key) {
            val last = fetchedAt[sport]
            if (last != null && System.currentTimeMillis() - last < CACHE_TTL) return
        }

        try {
            val map = AgentConsensusService.fetchGameAgentConsensus(sport.id, dates)
            bySport = bySport + (sport to map)
            slateKeys = slateKeys + (sport to key)
            fetchedAt = fetchedAt + (sport to System.currentTimeMillis())
        } catch (e: Exception) {
            // Non-fatal: the feed is fully usable without the consensus strip.
            Log.w(TAG, "agent consensus fetch failed for ${sport.id}", e)
        }
    }

    private companion object {
        private const val TAG = "AgentConsensusStore"

        // Shorter than GamesStore's 5-minute slate TTL: counts move through the
        // day as agents generate (~1 new pick/minute on a busy MLB slate) while
        // the slate itself does not.
        private const val CACHE_TTL = 90_000L
    }
}
