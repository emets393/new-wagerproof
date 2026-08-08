package com.wagerproof.core.stores

import android.util.Log
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.GameAgentConsensus
import com.wagerproof.core.services.AgentConsensusService
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel

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
 *
 * Owns a scope purely to coalesce overlapping fetches (the equivalent of the
 * Swift store's `inFlight: [Sport: Task]`); [close] cancels it, for tests or any
 * non-app-scoped instance — the `AppGraph` singleton lives for the process. Like
 * every other store here it expects to be driven from composable effects on the
 * main thread, which is why the in-flight bookkeeping needs no locking.
 */
@Stable
class AgentConsensusStore {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Per-sport `game_id` → consensus. Missing entry = no agents on that game. */
    var bySport: Map<GamesStore.Sport, Map<String, GameAgentConsensus>> by mutableStateOf(emptyMap()); private set

    // The exact (sorted, de-duped) date list a sport was last fetched for, so a
    // date rollover or an MLB slate gaining tomorrow's games refetches at once
    // instead of waiting out the TTL.
    private var loadedDates: Map<GamesStore.Sport, List<String>> = emptyMap()
    private var fetchedAt: Map<GamesStore.Sport, Long> = emptyMap()

    // The open call per sport, kept so a later caller can AWAIT it instead of
    // firing a duplicate RPC for the same slate.
    private var inFlight: Map<GamesStore.Sport, Deferred<Unit>> = emptyMap()

    // Dates the open call covers. `loadedDates` is only stamped AFTER a fetch
    // lands, so without this a burst of callers arriving mid-flight cannot tell
    // that their dates are already being fetched — see [ensureLoaded].
    private var inFlightDates: Map<GamesStore.Sport, Set<String>> = emptyMap()

    fun close() = scope.cancel()

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

        if (!force && isFresh(sport, dates)) return

        // Feed recomposition can re-fire the games screen's effect while a call
        // is still open. Await that call rather than duplicating it — but a
        // FORCED caller (pull-to-refresh) still has to go back to the server
        // afterwards, or the gesture silently no-ops whenever the initial fetch
        // was in flight. `join` (not `await`) so a failure in someone else's
        // fetch — already logged below — doesn't surface as ours.
        //
        // Read the open call's coverage BEFORE joining, and only skip the fetch
        // when it covered OUR dates (same containsAll rule as [ensureLoaded]):
        // now that the slot outlives a cancelled caller, a widening caller (MLB
        // slate gaining tomorrow) would otherwise join a narrow call, return,
        // and never request the extra date.
        inFlight[sport]?.let { open ->
            val covered = inFlightDates[sport].orEmpty()
            open.join()
            if (!force && covered.containsAll(dates)) return
        }

        // The slot is released by the TASK, not by whoever is joining it: the
        // games screen's `LaunchedEffect(sport, dates)` is torn down on every
        // sport tap, and a `finally` around `join()` would clear the slot mid-
        // fetch — so the next caller starts a duplicate RPC and the coalescing
        // above never engages. Same rule as [InFlightTaskRegistry], including
        // the LAZY start: eager `async` on Main.immediate runs the body up to
        // its first suspension before `async` returns, so a completion handler
        // registered after that could fire before the map insert and park a
        // finished Deferred in `inFlight` forever.
        val task = scope.async(start = CoroutineStart.LAZY) { performFetch(sport, dates) }
        inFlight = inFlight + (sport to task)
        inFlightDates = inFlightDates + (sport to dates.toSet())
        task.invokeOnCompletion {
            // Only clear if nobody replaced it — a forced call that overlapped
            // ours owns the slot now.
            if (inFlight[sport] === task) {
                inFlight = inFlight - sport
                inFlightDates = inFlightDates - sport
            }
        }
        task.start()
        task.join()
    }

    /**
     * Cover a single game's date for surfaces that arrive without a feed — a
     * game detail opened from Search or Outliers, where [refresh] may never have
     * run for that sport.
     *
     * Widens the existing coverage instead of replacing it: [refresh] is
     * authoritative for a whole slate, and a detail screen must never shrink the
     * feed's map down to one day. Still one RPC per slate, never per card.
     */
    suspend fun ensureLoaded(sport: GamesStore.Sport, date: String) =
        ensureLoaded(sport, listOf(date))

    /**
     * Multi-date variant — a board that knows every date up front (Outliers)
     * widens once rather than once per tile.
     */
    suspend fun ensureLoaded(sport: GamesStore.Sport, dates: List<String>) {
        val wanted = dates.filter { it.isNotBlank() }.toSet()
        if (wanted.isEmpty()) return

        val covered = loadedDates[sport].orEmpty()
        if (covered.containsAll(wanted) && isFresh(sport, covered)) return

        // Detail screens mount several sections at once, so a handful of callers
        // land here before the first RPC stamps `loadedDates`. Without this they
        // would all fall through to `refresh(force = true)` — which deliberately
        // does NOT return early on an open call — and each would fire its own
        // redundant RPC and its own `bySport` write.
        val open = inFlight[sport]
        if (open != null && inFlightDates[sport].orEmpty().containsAll(wanted)) {
            open.join()
            return
        }

        // force: the TTL check above already decided. `refresh`'s own check
        // compares against the narrower date set and would bail.
        refresh(sport, (covered + wanted).distinct(), force = true)
    }

    private fun isFresh(sport: GamesStore.Sport, dates: List<String>): Boolean {
        if (loadedDates[sport] != dates.distinct().sorted()) return false
        val last = fetchedAt[sport] ?: return false
        return System.currentTimeMillis() - last < CACHE_TTL
    }

    private suspend fun performFetch(sport: GamesStore.Sport, dates: List<String>) {
        try {
            val map = AgentConsensusService.fetchGameAgentConsensus(sport.id, dates)
            bySport = bySport + (sport to map)
            loadedDates = loadedDates + (sport to dates)
            fetchedAt = fetchedAt + (sport to System.currentTimeMillis())
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (e: Exception) {
            // Non-fatal: the feed is fully usable without the consensus strip.
            // `loadedDates`/`fetchedAt` stay untouched so the next tick retries
            // instead of caching the failure for the whole TTL.
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
