package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBPropsInsight
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLPropsInsight
import com.wagerproof.core.models.NFLPropsInsightSummary
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.models.PropsInsightSummary
import com.wagerproof.core.services.MLBPlayerPropsService
import com.wagerproof.core.services.NFLPlayerPropsService
import kotlinx.coroutines.CancellationException
import java.io.IOException

/**
 * Drives the Props tab. Mirrors [GamesStore]'s shape (per-sport selection,
 * 5-minute cache TTL, pull-to-refresh bypass) but the feed items are
 * player-prop entities instead of games.
 *
 * Two sports have props today: MLB (matchups feed with game logs + alt-line
 * ladders) and NFL (odds-board feed with cross-book price comparison).
 * Remaining sports render a "coming soon" empty state and never fetch.
 */
@Stable
class PropsStore(
    private val service: MLBPlayerPropsService = MLBPlayerPropsService.shared,
    private val nflService: NFLPlayerPropsService = NFLPlayerPropsService.shared,
) {

    /**
     * Sports surfaced in the picker. Order puts MLB first since it carries the
     * deepest props data today. No CFB — college player props aren't offered
     * (NCAA restrictions), so the segment would be a dead end.
     */
    enum class Sport(val raw: String, val label: String) {
        MLB("mlb", "MLB"),
        NFL("nfl", "NFL"),
        NBA("nba", "NBA");

        /** Whether this sport has a player-props feed yet. */
        val hasProps: Boolean get() = this == MLB || this == NFL

        /** Mirror this Props segment back onto the Games tab. */
        val gamesSport: GamesStore.Sport
            get() = GamesStore.Sport.entries.firstOrNull { it.name == raw } ?: GamesStore.Sport.mlb

        companion object {
            /** Mirror the Games tab's selected sport when the user switches to Props. */
            fun matching(gamesSport: GamesStore.Sport): Sport =
                entries.firstOrNull { it.raw == gamesSport.name } ?: MLB
        }
    }

    // MARK: - Observable state

    var selectedSport by mutableStateOf(Sport.MLB)
    var matchups by mutableStateOf<List<MLBPropMatchup>>(emptyList()); private set
    var nflPlayers by mutableStateOf<List<NFLPropPlayer>>(emptyList()); private set

    /** When true, NFL props load from `nfl_dryrun_*` staging tables. */
    var dryRunPreviewEnabled by mutableStateOf(false)

    // Snapshot-observable so the MLB/NFL-specific getters recompose the game
    // sheet + search hydrate paths.
    private val loadState = mutableStateMapOf<Sport, LoadState>()
    private val lastFetched = mutableStateMapOf<Sport, Long>()

    /** 5-minute cache TTL — matches the games feed. */
    private val ttlMs: Long = 300 * 1000L

    // MARK: - Derived state (selected sport)

    val isLoading: Boolean get() = loadState[selectedSport] is LoadState.Loading

    val errorMessage: String? get() = (loadState[selectedSport] as? LoadState.Failed)?.message

    val hasCachedMatchups: Boolean
        get() = when (selectedSport) {
            Sport.MLB -> matchups.isNotEmpty()
            Sport.NFL -> nflPlayers.isNotEmpty()
            else -> false
        }

    // Derived MLB caches, all invalidated by the slate itself: `matchups` is the
    // only input, so replacing it rebuilds the index and drops the memo. Mirrors
    // iOS PropsStore.swift:59-98 (matchupIndex / sortedMatchupsCache /
    // insightSummaryCache), where `setMatchups` is the single funnel.
    //
    // `derivedStateOf` rather than plain fields: reads stay snapshot-observable,
    // so the props feed and the MLB sheet still recompose after a refresh.
    private val matchupIndexState = derivedStateOf {
        // First-wins on a duplicate game_pk, matching the previous
        // `firstOrNull` lookup and iOS's `uniquingKeysWith: { first, _ in first }`.
        val index = LinkedHashMap<Int, MLBPropMatchup>(matchups.size)
        for (matchup in matchups) if (!index.containsKey(matchup.gamePk)) index[matchup.gamePk] = matchup
        index
    }

    private val sortedMatchupsState = derivedStateOf {
        matchups.sortedWith(compareBy({ it.officialDate }, { it.gameTimeEt ?: "" }))
    }

    // Plain map, not snapshot state: the MLB sheet reads this from a composable
    // body and writing observable state during composition is illegal.
    // Correctness comes from `matchupIndexState` — a new slate produces a new
    // index instance, which clears the memo below.
    private val insightSummaryCache = HashMap<Int, PropsInsightSummary?>()
    private var insightSummarySource: Map<Int, MLBPropMatchup>? = null
    private val nflInsightCache = HashMap<String, NFLPropsInsightSummary?>()
    private var nflInsightSource: List<NFLPropPlayer>? = null

    /** Per-game lookup for the MLB game-sheet "Player Props" widget. */
    fun matchup(gamePk: Int): MLBPropMatchup? = matchupIndexState.value[gamePk]

    /**
     * Memoized [MLBPropsInsight.summary] for one game.
     *
     * The uncached call walks every player in the matchup, picks a headline
     * prop, and makes five passes over that player's ~120-entry season log —
     * far too expensive to re-run on every recomposition of the props widget.
     * Null is memoized too (a matchup with no headline props hides the card),
     * so the miss path can't re-run the pipeline every frame.
     */
    fun propsInsightSummary(gamePk: Int): PropsInsightSummary? {
        val index = matchupIndexState.value
        if (insightSummarySource !== index) {
            insightSummaryCache.clear()
            insightSummarySource = index
        }
        if (insightSummaryCache.containsKey(gamePk)) return insightSummaryCache[gamePk]
        val built = index[gamePk]?.let { MLBPropsInsight.summary(it) }
        insightSummaryCache[gamePk] = built
        return built
    }

    /**
     * MLB-specific load state, independent of the Props tab's selected sport
     * — the MLB game sheet reads these for the first-hydrate skeleton rule.
     */
    val isLoadingMLB: Boolean get() = loadState[Sport.MLB] is LoadState.Loading
    val hasLoadedMLB: Boolean get() = lastFetched[Sport.MLB] != null

    val isLoadingNFL: Boolean get() = loadState[Sport.NFL] is LoadState.Loading
    val hasLoadedNFL: Boolean get() = lastFetched[Sport.NFL] != null

    /**
     * Matchups ordered by game time (the service already orders by date then
     * time; this keeps a stable secondary sort if the API order drifts).
     *
     * Memoized, so the returned list keeps a stable identity between slates —
     * screen-side derivations (`PlayerPropFeed.items`,
     * `MLBPropGameFilterOptions.build`) can `remember(...)` on it.
     */
    fun sortedMatchups(): List<MLBPropMatchup> = sortedMatchupsState.value

    /**
     * Players in this matchup — team-abbr matching, not `game_id`. Player
     * pages synthesize a game key that may not match prediction row ids.
     */
    fun nflPlayers(matchingAway: String, home: String): List<NFLPropPlayer> {
        val teams = setOf(NFLTeams.abbr(matchingAway).uppercase(), NFLTeams.abbr(home).uppercase())
        return nflPlayers.filter { player ->
            val team = player.team?.let { NFLTeams.abbr(it).uppercase() } ?: return@filter false
            val opp = player.opponent?.let { NFLTeams.abbr(it).uppercase() } ?: return@filter false
            team in teams && opp in teams
        }
    }

    /** Memoized matchup digest for the NFL game-sheet Player Props widget. */
    fun nflPropsInsight(matchingAway: String, home: String): NFLPropsInsightSummary? {
        val key = "${NFLTeams.abbr(matchingAway).uppercase()}|${NFLTeams.abbr(home).uppercase()}"
        if (nflInsightSource !== nflPlayers) {
            nflInsightCache.clear()
            nflInsightSource = nflPlayers
        }
        if (nflInsightCache.containsKey(key)) return nflInsightCache[key]
        val built = NFLPropsInsight.summary(nflPlayers(matchingAway, home))
        nflInsightCache[key] = built
        return built
    }

    // MARK: - Fetch

    /**
     * MLB-specific hydrate for the game-sheet widget. [refresh] keys off
     * [selectedSport] (the Props tab picker), which may be parked on another
     * sport while the user opens an MLB game sheet — so the sheet calls this.
     */
    suspend fun refreshMLB(force: Boolean = false) {
        val last = lastFetched[Sport.MLB]
        if (!force && loadState[Sport.MLB] is LoadState.Loaded && last != null &&
            System.currentTimeMillis() - last < ttlMs
        ) {
            return
        }
        if (matchups.isEmpty()) loadState[Sport.MLB] = LoadState.Loading
        try {
            matchups = service.fetchMatchups()
            lastFetched[Sport.MLB] = System.currentTimeMillis()
            loadState[Sport.MLB] = LoadState.Loaded
        } catch (cancellation: CancellationException) {
            loadState[Sport.MLB] = if (matchups.isEmpty()) LoadState.Idle else LoadState.Loaded
            throw cancellation
        } catch (e: Exception) {
            loadState[Sport.MLB] =
                if (matchups.isEmpty()) LoadState.Failed(friendlyError(e)) else LoadState.Loaded
        }
    }

    /** NFL-specific hydrate for search — mirrors [refreshMLB]. */
    suspend fun refreshNFL(force: Boolean = false) {
        val last = lastFetched[Sport.NFL]
        if (!force && loadState[Sport.NFL] is LoadState.Loaded && last != null &&
            System.currentTimeMillis() - last < ttlMs
        ) {
            return
        }
        if (nflPlayers.isEmpty()) loadState[Sport.NFL] = LoadState.Loading
        try {
            nflPlayers = nflService.fetchPlayers()
            lastFetched[Sport.NFL] = System.currentTimeMillis()
            loadState[Sport.NFL] = LoadState.Loaded
        } catch (cancellation: CancellationException) {
            loadState[Sport.NFL] = if (nflPlayers.isEmpty()) LoadState.Idle else LoadState.Loaded
            throw cancellation
        } catch (e: Exception) {
            loadState[Sport.NFL] =
                if (nflPlayers.isEmpty()) LoadState.Failed(friendlyError(e)) else LoadState.Loaded
        }
    }

    /**
     * Refresh the selected sport's feed. Sports without props no-op.
     * [force] bypasses the cache TTL (pull-to-refresh). No Dummy Data Mode
     * branch here — props always come from the live tables, so an offseason
     * board is honestly empty.
     */
    suspend fun refresh(force: Boolean = false) {
        val sport = selectedSport
        if (!sport.hasProps) return

        val last = lastFetched[sport]
        if (!force && loadState[sport] is LoadState.Loaded && last != null &&
            System.currentTimeMillis() - last < ttlMs
        ) {
            return
        }
        // Don't show the skeleton over a populated cache during a silent
        // background refresh — only when there's nothing to show.
        if (!hasCachedMatchups) loadState[sport] = LoadState.Loading

        try {
            when (sport) {
                Sport.MLB -> matchups = service.fetchMatchups()
                Sport.NFL -> nflPlayers = nflService.fetchPlayers()
                else -> return
            }
            lastFetched[sport] = System.currentTimeMillis()
            loadState[sport] = LoadState.Loaded
        } catch (cancellation: CancellationException) {
            loadState[sport] = if (hasCachedMatchups) LoadState.Loaded else LoadState.Idle
            throw cancellation
        } catch (e: Exception) {
            loadState[sport] =
                if (hasCachedMatchups) LoadState.Loaded else LoadState.Failed(friendlyError(e))
        }
    }

    private fun friendlyError(error: Throwable): String =
        if (error is IOException) "No connection. Pull to retry."
        else "Couldn't load player props. Pull to retry."

    // MARK: - Debug

    /** Test-only seeding hook for parity-screenshot builds. */
    fun debugSetMatchups(matchups: List<MLBPropMatchup>) {
        this.matchups = matchups
        this.loadState[Sport.MLB] = LoadState.Loaded
        this.lastFetched[Sport.MLB] = System.currentTimeMillis()
    }

    fun debugSetNflPlayers(nflPlayers: List<NFLPropPlayer>) {
        this.nflPlayers = nflPlayers
        this.loadState[Sport.NFL] = LoadState.Loaded
        this.lastFetched[Sport.NFL] = System.currentTimeMillis()
    }
}
