package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.ParlayGodNFLContext
import com.wagerproof.core.models.ParlayLeg
import com.wagerproof.core.models.ParlaySport
import com.wagerproof.core.models.ParlayTicket
import com.wagerproof.core.services.MLBPlayerPropsService
import com.wagerproof.core.services.NFLPlayerPropsService
import com.wagerproof.core.services.OutliersTrendsService
import com.wagerproof.core.services.ParlayGodEngine
import com.wagerproof.core.services.ParlayGodNflOddsService
import com.wagerproof.core.services.runCatchingCancellable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import java.io.IOException

/**
 * Shell-hoisted source for every Parlay God surface (Outliers rail, Search
 * rail, Props Cheats, matchup widgets). Port of iOS
 * `WagerproofStores/ParlayGodStore.swift`.
 *
 * Fetches the MLB + NFL trends bundles and both props slates once, builds the
 * leg pool off the main thread, and serves ticket sets — per-sport tickets,
 * mixed side by side on the rails.
 *
 * Fetches its own data instead of piggybacking on [OutliersTrendsStore] /
 * [PropsStore] so any surface can appear first without hydrating a whole tab.
 *
 * Props tickets are generated independently per sport so a thin NFL board
 * cannot borrow MLB legs to create a misleading mixed-sport cheat.
 */
@Stable
class ParlayGodStore(
    private val trendsService: OutliersTrendsService = OutliersTrendsService.shared,
    private val propsService: MLBPlayerPropsService = MLBPlayerPropsService.shared,
    private val nflPropsService: NFLPlayerPropsService = NFLPlayerPropsService.shared,
    private val nflOddsService: ParlayGodNflOddsService = ParlayGodNflOddsService.shared,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /**
     * Four surfaces mount at once on a cold Outliers/Props visit; one shared
     * request serves all of them instead of four parallel slate fetches.
     */
    private val refreshTasks = InFlightTaskRegistry<Unit>(scope)

    // MARK: - Observable state

    var loadState: LoadState by mutableStateOf(LoadState.Idle); private set

    /** Cross-game category tickets for the Outliers + Search rails. */
    var slateTickets: List<ParlayTicket> by mutableStateOf(emptyList()); private set

    /** Player-props-only category tickets for the Props tab rail. */
    var propsTickets: List<ParlayTicket> by mutableStateOf(emptyList()); private set

    /** Epoch millis of the last refresh where EVERY source landed; null = stale. */
    var lastRefreshedAt: Long? by mutableStateOf(null); private set

    /**
     * Bumped whenever the leg pool is replaced. [tickets] memoizes into a plain
     * map (writing snapshot state from a composable body is illegal), so a
     * matchup widget should `remember(poolRevision, gameKey)` around its read
     * to pick up a refresh that lands while it is on screen.
     */
    var poolRevision: Int by mutableStateOf(0); private set

    // Not snapshot state: `tickets(gameKey)` memoizes from composable bodies.
    // Correctness comes from [poolRevision] — the cache is cleared in lockstep
    // with the pool it was derived from. Same shape as
    // `PropsStore.insightSummaryCache`.
    private var pool: List<ParlayLeg> = emptyList()
    private val gameTicketCache = HashMap<String, List<ParlayTicket>>()

    /** Matches the props feed TTL — slates/odds refresh slowly intraday. */
    private val ttlMs: Long = 300 * 1000L

    /** Cancels the store's scope. The `AppGraph` singleton lives for the process. */
    fun close() = scope.cancel()

    // MARK: - Derived state

    val isLoading: Boolean get() = loadState.isLoading

    val hasContent: Boolean get() = slateTickets.isNotEmpty()

    val errorMessage: String? get() = loadState.errorMessage

    /**
     * Sports currently fielding slate tickets — drives the rail header's
     * "Supports" icon cluster (a sport with no qualifying streaks today drops off).
     */
    val slateSports: List<ParlaySport> get() = ParlayGodEngine.sports(slateTickets)

    val propsSports: List<ParlaySport> get() = ParlayGodEngine.sports(propsTickets)

    fun propsTickets(sport: ParlaySport): List<ParlayTicket> =
        propsTickets.filter { ticket -> ticket.legs.all { it.sport == sport } }

    fun propsSports(sport: ParlaySport): List<ParlaySport> =
        if (propsTickets(sport).isEmpty()) emptyList() else listOf(sport)

    /**
     * Same-game tickets for a matchup widget. Built lazily per game from the
     * cached pool; empty until the first refresh lands.
     */
    fun tickets(gameKey: String): List<ParlayTicket> {
        gameTicketCache[gameKey]?.let { return it }
        val built = ParlayGodEngine.gameTickets(pool, gameKey)
        gameTicketCache[gameKey] = built
        return built
    }

    // MARK: - Fetch

    suspend fun refreshIfNeeded(force: Boolean = false) {
        val last = lastRefreshedAt
        if (!force && loadState is LoadState.Loaded && last != null &&
            System.currentTimeMillis() - last < ttlMs
        ) {
            return
        }
        refreshTasks.run(Unit) { performRefresh() }
    }

    /** The single mutation path behind a coalesced request. */
    private suspend fun performRefresh() {
        loadState = LoadState.Loading
        val previous = pool
        try {
            // Each source tolerates the others failing: a props outage still
            // yields team-leg tickets, an NFL outage still yields MLB, etc.
            val (trendSources, nflPropsResult) = coroutineScope {
                val mlbTask = async {
                    runCatchingCancellable { trendsService.fetchMLBBundle() }.getOrNull()
                }
                val nflTask = async {
                    runCatchingCancellable { trendsService.fetchNFLBundle() }.getOrNull()
                }
                val propsTask = async {
                    runCatchingCancellable { propsService.fetchMatchups() }
                }
                val nflPropsTask = async {
                    runCatchingCancellable { nflPropsService.fetchPlayers() }
                }
                Triple(mlbTask.await(), nflTask.await(), propsTask.await()) to nflPropsTask.await()
            }
            val (mlbBundle, nflBundle, propsResult) = trendSources

            // Sequential on purpose: the ML/H1 closes are keyed by the game ids
            // the NFL bundle just returned. Best-effort — an empty map only
            // costs the ML and 1H legs (see ParlayGodNflOddsService).
            val nflOdds: Map<String, ParlayGodNFLContext> = nflBundle?.games
                ?.map { it.id }
                ?.takeIf { it.isNotEmpty() }
                ?.let { ids -> runCatchingCancellable { nflOddsService.fetchSlateOdds(ids) }.getOrNull() }
                .orEmpty()

            // Every source threw — that's a failure, not an empty slate. (An
            // offseason day still returns non-null, empty bundles and lands on
            // Loaded with no tickets, same as iOS.)
            if (mlbBundle == null && nflBundle == null && propsResult.isFailure && nflPropsResult.isFailure) {
                error("No slate data available")
            }

            // Pure CPU work over value types — keep it off the main thread.
            val built = withContext(Dispatchers.Default) {
                // A transiently-failed source must not wipe its legs for the
                // whole TTL (a null bundle once turned the rail props-only all
                // morning) — keep the last-known legs of that kind and stay
                // stale to retry.
                val mlbTeamLegs = mlbBundle?.let { ParlayGodEngine.teamLegs(it) }
                    ?: previous.filter { it.kind == ParlayLeg.Kind.TEAM && it.sport == ParlaySport.MLB }
                val nflTeamLegs = nflBundle?.let { ParlayGodEngine.nflTeamLegs(it, nflOdds) }
                    ?: previous.filter { it.kind == ParlayLeg.Kind.TEAM && it.sport == ParlaySport.NFL }
                val mlbPropLegs = ParlayGodRefreshPolicy.resolveMlbPropLegs(previous, propsResult)
                val nflPropLegs = ParlayGodRefreshPolicy.resolveNflPropLegs(previous, nflPropsResult)
                val next = mlbTeamLegs + nflTeamLegs + mlbPropLegs + nflPropLegs
                Built(
                    pool = next,
                    slate = ParlayGodEngine.slateTickets(next),
                    props = listOf(ParlaySport.MLB, ParlaySport.NFL).flatMap { sport ->
                        ParlayGodEngine.propsTickets(next.filter { it.kind == ParlayLeg.Kind.PROP && it.sport == sport })
                    },
                )
            }

            pool = built.pool
            slateTickets = built.slate
            propsTickets = built.props
            gameTicketCache.clear()
            poolRevision += 1
            // Only a fully-successful sweep stamps the TTL; a partial one stays
            // stale so the next appearance retries the missing source.
            lastRefreshedAt = if (ParlayGodRefreshPolicy.allSourcesSucceeded(
                    mlbSucceeded = mlbBundle != null,
                    nflSucceeded = nflBundle != null,
                    propsSucceeded = propsResult.isSuccess,
                    nflPropsSucceeded = nflPropsResult.isSuccess,
                )
            ) {
                System.currentTimeMillis()
            } else {
                null
            }
            loadState = LoadState.Loaded
        } catch (cancellation: CancellationException) {
            // Leaving the tab mid-fetch is not a failure: fall back to Idle so
            // the next visit retries, and rethrow so the parent job learns the
            // child was actually cancelled.
            loadState = if (hasContent) LoadState.Loaded else LoadState.Idle
            throw cancellation
        } catch (e: Throwable) {
            loadState = if (hasContent) LoadState.Loaded else LoadState.Failed(friendlyError(e))
        }
    }

    private fun friendlyError(error: Throwable): String =
        if (error is IOException) "No connection. Pull to retry."
        else "Couldn't load Parlay God. Pull to retry."

    private data class Built(
        val pool: List<ParlayLeg>,
        val slate: List<ParlayTicket>,
        val props: List<ParlayTicket>,
    )

    // MARK: - Debug

    /** Test/fixture seeding hook for parity-screenshot builds. */
    fun debugSetPool(legs: List<ParlayLeg>) {
        pool = legs
        slateTickets = ParlayGodEngine.slateTickets(legs)
        propsTickets = listOf(ParlaySport.MLB, ParlaySport.NFL).flatMap { sport ->
            ParlayGodEngine.propsTickets(legs.filter { it.kind == ParlayLeg.Kind.PROP && it.sport == sport })
        }
        gameTicketCache.clear()
        poolRevision += 1
        lastRefreshedAt = System.currentTimeMillis()
        loadState = LoadState.Loaded
    }
}

/** Pure refresh policy kept separate so empty-success and failure cannot regress. */
internal object ParlayGodRefreshPolicy {
    // Kept as the MLB-named source's compatibility entry point for focused
    // refresh-policy tests and older callers.
    fun resolvePropLegs(
        previous: List<ParlayLeg>,
        result: Result<List<MLBPropMatchup>>,
    ): List<ParlayLeg> = resolveMlbPropLegs(previous, result)

    fun resolveMlbPropLegs(
        previous: List<ParlayLeg>,
        result: Result<List<MLBPropMatchup>>,
    ): List<ParlayLeg> = result.fold(
        onSuccess = ParlayGodEngine::propLegs,
        onFailure = { previous.filter { it.kind == ParlayLeg.Kind.PROP && it.sport == ParlaySport.MLB } },
    )

    fun resolveNflPropLegs(
        previous: List<ParlayLeg>,
        result: Result<List<NFLPropPlayer>>,
    ): List<ParlayLeg> = result.fold(
        onSuccess = ParlayGodEngine::nflPropLegs,
        onFailure = { previous.filter { it.kind == ParlayLeg.Kind.PROP && it.sport == ParlaySport.NFL } },
    )

    fun allSourcesSucceeded(
        mlbSucceeded: Boolean,
        nflSucceeded: Boolean,
        propsSucceeded: Boolean,
        nflPropsSucceeded: Boolean = true,
    ): Boolean = mlbSucceeded && nflSucceeded && propsSucceeded && nflPropsSucceeded
}
