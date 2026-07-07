package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentLeaderboardEntry
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.models.MLBPlayerPropRow
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.SearchStoreSport
import com.wagerproof.core.models.SearchTeamAliases
import com.wagerproof.core.services.AgentPerformanceService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.lang.ref.WeakReference

/**
 * `SearchStore` powers the global cross-surface search experience. Mirrors no
 * single RN screen — the RN app shipped per-tab search bars, this consolidates
 * them into one cross-tab search.
 *
 * Architecture: this store does NOT duplicate the fetch logic in [GamesStore],
 * [AgentsStore], [OutliersTrendsStore], [PropsStore]. Instead it is
 * [bind]-ed by the tab shell at mount time and derives result lists from those
 * stores' already-resolved data via computed properties. The view subscribes
 * to this store; Compose re-runs the computed getters whenever the upstream
 * stores' snapshot state or the local [query]/[scope] change.
 *
 * Public agents are the one exception — [AgentsStore] only owns the signed-in
 * user's own agents, so we fetch the leaderboard separately (one RPC, cached)
 * for the cross-user lookup.
 *
 * Debounce: every [query] mutation schedules a 200ms job that resets
 * [debouncedQuery]. Previous jobs cancel on the next keystroke, so only the
 * trailing edge fires.
 *
 * Recent searches: last 5 committed queries persist in [StorePrefs.standard]
 * under `"search.recent.queries"` (newline-joined — Android has no ordered
 * string-array default).
 */
@Stable
class SearchStore {

    // MARK: - Scope

    /**
     * Result categories. `All` interleaves; the other cases pin to a single
     * section. Matches the segmented chip row above the result list.
     */
    enum class SearchScope(val label: String) {
        All("All"),
        Games("Matchup"),
        Players("Props"),
        Agents("Agents"),
        Outliers("Outliers"),
    }

    // MARK: - Result types

    /**
     * Subset of [GamesStore.Sport] mirrored here so result rows don't depend on
     * the upstream type.
     */
    enum class GamesStoreSport(val raw: String, val label: String) {
        NFL("nfl", "NFL"),
        CFB("cfb", "CFB"),
        NBA("nba", "NBA"),
        NCAAB("ncaab", "NCAAB"),
        MLB("mlb", "MLB"),
    }

    /**
     * Each result carries enough payload to drive the navigation handoff back
     * to the owning tab. Kept as plain data classes (not typealiases for the
     * models) so the view treats search results as their own value type.
     */
    object SearchResult {
        data class Game(
            val id: String,
            val sport: GamesStoreSport,
            val awayTeam: String,
            val homeTeam: String,
            val gameTime: String?,
            /**
             * Stable identifier the per-sport sheet store needs to open the
             * detail sheet. For NFL/CFB this is the `unique_id`/`training_key`;
             * for NBA/NCAAB/MLB it's the integer game id stringified.
             */
            val resolvedId: String,
            /** SearchTeamAliases rank — drives result ordering (desc). */
            val matchScore: Int = 0,
            /** Which side matched the query (abbr). */
            val matchedAbbr: String? = null,
        )

        /**
         * Player-prop match resolved against the [PropsStore] slate (MLB/NFL).
         * Carries ids only — the view re-resolves the selection at tap time.
         */
        data class Player(
            val id: String,
            val kind: Kind,
            val playerName: String,
            val teamAbbr: String,
            val matchScore: Int,
            /** Tie-break rank — MLB L10 hit %, NFL headline-market L10 rate. */
            val headlineRank: Double,
        ) {
            sealed interface Kind {
                data class Mlb(val gamePk: Int, val playerId: Int, val isPitcher: Boolean) : Kind
                data class Nfl(val playerKey: String, val gameId: String) : Kind
            }
        }

        /**
         * Carries the full [AgentWithPerformance] so Search renders the exact
         * agent row card — public/leaderboard agents are adapted via the
         * `AgentWithPerformance(entry)` constructor.
         */
        data class Agent(
            val id: String,
            val model: AgentWithPerformance,
            /** `true` when this row came from the public-agents leaderboard. */
            val isPublic: Boolean,
        ) {
            val agentId: String get() = model.agent.id
        }

        /** One Outliers trend card surfaced in search. */
        data class Trend(
            val id: String,
            val card: OutliersTrendsCard,
            val sport: OutliersTrendsSport,
            val game: OutliersTrendsGame?,
            val matchScore: Int,
        )
    }

    // MARK: - Bound upstream stores
    //
    // Weak references owned by the tab shell — `bind(...)` is the single entry
    // point. When unbound, result accessors return empty lists.

    private var gamesRef: WeakReference<GamesStore>? = null
    private var agentsRef: WeakReference<AgentsStore>? = null
    private var trendsRef: WeakReference<OutliersTrendsStore>? = null
    private var propsRef: WeakReference<PropsStore>? = null

    private val storeScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // MARK: - Observable state

    /**
     * Raw query bound to the search field. Mutating it schedules a 200ms
     * debounce that updates [debouncedQuery]. Backed by [_query] because the
     * setter has side effects (JVM would clash `private set` + explicit setter).
     */
    private var _query by mutableStateOf("")
    var query: String
        get() = _query
        set(value) {
            if (value == _query) return
            _query = value
            // A real query takes over from any Explore browse session.
            if (value.isNotEmpty()) browseScope = null
            scheduleDebounce()
        }

    /** Scope chip selection. Empty queries hide the chip row entirely. */
    var scope by mutableStateOf(SearchScope.All)

    /**
     * Set when the user taps an Explore card to browse a whole category
     * without typing. While non-null and the query is empty, the view shows
     * that scope's full list via the `browse*Results` accessors.
     */
    var browseScope by mutableStateOf<SearchScope?>(null)

    /** Debounced version of [query]. Result accessors filter against this. */
    var debouncedQuery by mutableStateOf(""); private set

    /** `true` between a keystroke and the next debounce flush. */
    var isDebouncing by mutableStateOf(false); private set

    /** Last 5 committed (non-empty) queries, newest first. */
    var recentQueries by mutableStateOf<List<String>>(emptyList()); private set

    /**
     * Public-agents cache. Pulled lazily on first non-empty agent-matching
     * query. Reused across queries until [clearPublicAgentsCache].
     */
    var publicAgents by mutableStateOf<List<AgentLeaderboardEntry>>(emptyList()); private set
    var isLoadingPublicAgents by mutableStateOf(false); private set

    private var debounceJob: Job? = null
    private val recentQueriesKey = "search.recent.queries"
    private val recentQueriesLimit = 5

    // Cached name indexes — rebuilding per keystroke would re-run headline math
    // for every player on the slate. Plain (non-snapshot) fields: iOS marks
    // these @ObservationIgnored.
    private var mlbPlayerIndex: List<MLBPlayerIndexEntry> = emptyList()
    private var mlbPlayerIndexKey: Set<Int> = emptySet()
    private var nflPlayerIndex: List<NFLPlayerIndexEntry> = emptyList()
    private var nflPlayerIndexKey: Set<String> = emptySet()

    init {
        loadRecentQueries()
    }

    // MARK: - Lifecycle

    /**
     * Wire the upstream stores. Called by the tab shell once at mount. Safe to
     * call multiple times — overwrites previous references.
     */
    fun bind(
        games: GamesStore?,
        agents: AgentsStore?,
        trends: OutliersTrendsStore?,
        props: PropsStore? = null,
    ) {
        gamesRef = games?.let { WeakReference(it) }
        agentsRef = agents?.let { WeakReference(it) }
        trendsRef = trends?.let { WeakReference(it) }
        propsRef = props?.let { WeakReference(it) }
    }

    /**
     * Fire the leaderboard fetch for cross-user agent matches. Idempotent
     * while loading or once cached.
     */
    suspend fun loadPublicAgentsIfNeeded() {
        if (isLoadingPublicAgents || publicAgents.isNotEmpty()) return
        isLoadingPublicAgents = true
        try {
            // Pull a wide net (top 100 by overall net units). The user searches
            // by name; we need enough rows that common names surface, not a
            // perfectly-sorted set.
            publicAgents = AgentPerformanceService.fetchLeaderboard(
                limit = 100,
                sport = null,
                sortMode = AgentPerformanceService.LeaderboardSortMode.OVERALL,
                excludeUnder10Picks = false,
                timeframe = AgentPerformanceService.LeaderboardTimeframe.ALL_TIME,
                viewerUserId = null,
            )
        } catch (t: Throwable) {
            // Swallow — search falls back to own-agent matches.
            publicAgents = emptyList()
        } finally {
            isLoadingPublicAgents = false
        }
    }

    fun clearPublicAgentsCache() {
        publicAgents = emptyList()
    }

    // MARK: - Recent queries

    /**
     * Apply a recent-search row tap. Sets [query] (which schedules debounce)
     * and immediately flushes so the result list updates on the next frame.
     */
    fun applyRecent(value: String) {
        query = value
        flushDebounce()
    }

    fun clearRecentQueries() {
        recentQueries = emptyList()
        StorePrefs.standard.edit().remove(recentQueriesKey).apply()
    }

    private fun loadRecentQueries() {
        val stored = StorePrefs.standard.getString(recentQueriesKey, null)
            ?.split("\n")
            ?.filter { it.isNotEmpty() }
            ?: emptyList()
        recentQueries = stored.take(recentQueriesLimit)
    }

    /**
     * Commit the current debounced query into the recent list. Called by the
     * view when the user taps a result (records intent, not every pause).
     */
    fun commitCurrentQueryToRecents() {
        val trimmed = debouncedQuery.trim()
        if (trimmed.isEmpty()) return
        // De-dupe case-insensitively but preserve the user's original casing.
        val next = recentQueries.filterNot { it.equals(trimmed, ignoreCase = true) }.toMutableList()
        next.add(0, trimmed)
        recentQueries = next.take(recentQueriesLimit)
        StorePrefs.standard.edit().putString(recentQueriesKey, recentQueries.joinToString("\n")).apply()
    }

    // MARK: - Explore browse

    /**
     * Enter "browse" mode for an Explore card — show the full list for [scope]
     * with no text query. Clears the field so the query path stays dormant.
     */
    fun browse(scope: SearchScope) {
        query = ""
        flushDebounce()
        this.scope = scope
        browseScope = scope
    }

    /** Leave browse mode and return to the empty-state launchpad. */
    fun exitBrowse() {
        browseScope = null
    }

    // MARK: - Debounce

    private fun scheduleDebounce() {
        debounceJob?.cancel()
        isDebouncing = true
        debounceJob = storeScope.launch {
            // 200ms quiet window. Per-keystroke calls cancel the previous job
            // so only the trailing edge fires; the delay throws on cancel and
            // we never reach the publish below.
            delay(200)
            debouncedQuery = query
            isDebouncing = false
        }
    }

    /**
     * Immediately publish the current [query] as [debouncedQuery]. Used by
     * recent-search taps where we don't want the 200ms delay.
     */
    fun flushDebounce() {
        debounceJob?.cancel()
        debouncedQuery = query
        isDebouncing = false
    }

    fun close() = storeScope.cancel()

    // MARK: - Result accessors
    //
    // All computed; Compose re-runs them whenever any upstream store mutates or
    // [debouncedQuery] changes. The empty-query case returns `[]`.

    /** Total result count across scopes. Drives the empty-state branch. */
    val totalResultCount: Int
        get() = gameResults.size + playerResults.size + agentResults.size + trendResults.size

    val gameResults: List<SearchResult.Game>
        get() {
            val q = normalizedQuery
            val games = gamesRef?.get()
            if (q.isEmpty() || games == null) return emptyList()
            val out = mutableListOf<SearchResult.Game>()

            // SearchTeamAliases owns the rank table (exact abbr 100 → mascot/city
            // 90 → prefix 70 → substring 40 → initials 30); best side wins, ties
            // prefer away.
            fun matchSides(
                awayName: String, homeName: String,
                awayAbbr: String?, homeAbbr: String?,
                sport: SearchStoreSport,
            ): Pair<Int, String?>? {
                val away = SearchTeamAliases.match(query = q, teamName = awayName, abbr = awayAbbr, sport = sport)
                val home = SearchTeamAliases.match(query = q, teamName = homeName, abbr = homeAbbr, sport = sport)
                return when {
                    away == null && home == null -> null
                    home == null -> away!!.score to awayAbbr
                    away == null -> home.score to homeAbbr
                    else -> if (away.score >= home.score) away.score to awayAbbr else home.score to homeAbbr
                }
            }

            for (g in games.games.nfl) {
                matchSides(g.awayTeam, g.homeTeam, null, null, SearchStoreSport.NFL)?.let { m ->
                    out.add(
                        SearchResult.Game(
                            id = "nfl-${g.id}", sport = GamesStoreSport.NFL,
                            awayTeam = g.awayTeam, homeTeam = g.homeTeam,
                            gameTime = if (g.gameTime.isEmpty()) g.gameDate else g.gameTime,
                            resolvedId = g.uniqueId, matchScore = m.first, matchedAbbr = m.second,
                        ),
                    )
                }
            }
            for (g in games.games.cfb) {
                matchSides(g.awayTeam, g.homeTeam, null, null, SearchStoreSport.CFB)?.let { m ->
                    out.add(
                        SearchResult.Game(
                            id = "cfb-${g.id}", sport = GamesStoreSport.CFB,
                            awayTeam = g.awayTeam, homeTeam = g.homeTeam,
                            gameTime = if (g.gameTime.isEmpty()) g.gameDate else g.gameTime,
                            resolvedId = g.uniqueId, matchScore = m.first, matchedAbbr = m.second,
                        ),
                    )
                }
            }
            for (g in games.games.nba) {
                matchSides(g.awayTeam, g.homeTeam, g.awayAbbr, g.homeAbbr, SearchStoreSport.NBA)?.let { m ->
                    out.add(
                        SearchResult.Game(
                            id = "nba-${g.id}", sport = GamesStoreSport.NBA,
                            awayTeam = g.awayTeam, homeTeam = g.homeTeam,
                            gameTime = if (g.gameTime.isEmpty()) g.gameDate else g.gameTime,
                            resolvedId = g.id, matchScore = m.first, matchedAbbr = m.second,
                        ),
                    )
                }
            }
            for (g in games.games.ncaab) {
                matchSides(g.awayTeam, g.homeTeam, g.awayTeamAbbrev, g.homeTeamAbbrev, SearchStoreSport.NCAAB)?.let { m ->
                    out.add(
                        SearchResult.Game(
                            id = "ncaab-${g.id}", sport = GamesStoreSport.NCAAB,
                            awayTeam = g.awayTeam, homeTeam = g.homeTeam,
                            gameTime = if (g.gameTime.isEmpty()) g.gameDate else g.gameTime,
                            resolvedId = g.id, matchScore = m.first, matchedAbbr = m.second,
                        ),
                    )
                }
            }
            for (g in games.games.mlb) {
                val away = g.awayTeamName ?: g.awayTeam ?: ""
                val home = g.homeTeamName ?: g.homeTeam ?: ""
                matchSides(away, home, g.awayAbbr, g.homeAbbr, SearchStoreSport.MLB)?.let { m ->
                    out.add(
                        SearchResult.Game(
                            id = "mlb-${g.id}", sport = GamesStoreSport.MLB,
                            awayTeam = away, homeTeam = home,
                            gameTime = g.gameTimeEt ?: g.officialDate,
                            resolvedId = g.id, matchScore = m.first, matchedAbbr = m.second,
                        ),
                    )
                }
            }
            // Score desc; Kotlin's sortedByDescending is stable, so equal scores
            // keep insertion order (per-sport, roughly time-ascending) — matching
            // iOS's explicit offset tiebreak.
            return out.sortedByDescending { it.matchScore }
        }

    // MARK: - Player results (MLB + NFL props slates)

    private data class MLBPlayerIndexEntry(
        val gamePk: Int,
        val playerId: Int,
        val name: String,
        val teamAbbr: String,
        val isPitcher: Boolean,
        val headlineRank: Double,
    )

    private data class NFLPlayerIndexEntry(
        val playerKey: String,
        val gameId: String,
        val name: String,
        val teamAbbr: String,
        val headlineRank: Double,
    )

    /**
     * Player-prop matches (min query 3 chars, cap 8). Rank: 100 last-name
     * prefix · 90 "initial + last name" · 70 first-name prefix · 50 full-name
     * substring; ties by headline L10 rank desc. MLB + NFL interleaved.
     */
    val playerResults: List<SearchResult.Player>
        get() {
            val q = normalizedQuery
            val props = propsRef?.get()
            if (q.length < 3 || props == null) return emptyList()

            val scored = mutableListOf<Pair<SearchResult.Player, Int>>()

            if (props.matchups.isNotEmpty()) {
                rebuildMLBPlayerIndexIfNeeded(props.matchups)
                for (entry in mlbPlayerIndex) {
                    val score = playerScore(q, entry.name) ?: continue
                    scored.add(mlbPlayerResult(entry, score) to score)
                }
            }

            if (props.nflPlayers.isNotEmpty()) {
                rebuildNFLPlayerIndexIfNeeded(props.nflPlayers)
                for (entry in nflPlayerIndex) {
                    val score = playerScore(q, entry.name) ?: continue
                    scored.add(nflPlayerResult(entry, score) to score)
                }
            }

            return scored
                .sortedWith(
                    compareByDescending<Pair<SearchResult.Player, Int>> { it.second }
                        .thenByDescending { it.first.headlineRank },
                )
                .take(8)
                .map { it.first }
        }

    /**
     * Full Props slate for the Explore card (no text query) — MLB + NFL
     * interleaved, ranked by headline L10 rate desc, capped at 30.
     */
    val browsePlayerResults: List<SearchResult.Player>
        get() {
            val props = propsRef?.get() ?: return emptyList()
            val entries = mutableListOf<SearchResult.Player>()
            if (props.matchups.isNotEmpty()) {
                rebuildMLBPlayerIndexIfNeeded(props.matchups)
                entries += mlbPlayerIndex.map { mlbPlayerResult(it, 0) }
            }
            if (props.nflPlayers.isNotEmpty()) {
                rebuildNFLPlayerIndexIfNeeded(props.nflPlayers)
                entries += nflPlayerIndex.map { nflPlayerResult(it, 0) }
            }
            return entries.sortedByDescending { it.headlineRank }.take(30)
        }

    private fun mlbPlayerResult(entry: MLBPlayerIndexEntry, score: Int): SearchResult.Player =
        SearchResult.Player(
            id = "player-mlb-${entry.gamePk}-${entry.playerId}",
            kind = SearchResult.Player.Kind.Mlb(entry.gamePk, entry.playerId, entry.isPitcher),
            playerName = entry.name,
            teamAbbr = entry.teamAbbr,
            matchScore = score,
            headlineRank = entry.headlineRank,
        )

    private fun nflPlayerResult(entry: NFLPlayerIndexEntry, score: Int): SearchResult.Player =
        SearchResult.Player(
            id = "player-nfl-${entry.playerKey}",
            kind = SearchResult.Player.Kind.Nfl(entry.playerKey, entry.gameId),
            playerName = entry.name,
            teamAbbr = entry.teamAbbr,
            matchScore = score,
            headlineRank = entry.headlineRank,
        )

    private fun rebuildMLBPlayerIndexIfNeeded(matchups: List<MLBPropMatchup>) {
        val key = matchups.map { it.gamePk }.toSet()
        if (key == mlbPlayerIndexKey) return
        fun headlineRank(rows: List<MLBPlayerPropRow>): Double =
            MLBPlayerProps.pickHeadlineProp(rows)?.computed?.l10?.pct?.toDouble() ?: 0.0
        val entries = mutableListOf<MLBPlayerIndexEntry>()
        for (m in matchups) {
            for ((starter, abbr) in listOf(m.awayStarter to m.awayAbbr, m.homeStarter to m.homeAbbr)) {
                val rows = m.pitcherProps(starter.pitcherId)
                if (rows.isEmpty()) continue
                entries.add(
                    MLBPlayerIndexEntry(
                        gamePk = m.gamePk, playerId = starter.pitcherId, name = starter.name,
                        teamAbbr = abbr, isPitcher = true, headlineRank = headlineRank(rows),
                    ),
                )
            }
            for ((lineup, abbr) in listOf(m.awayLineup to m.awayAbbr, m.homeLineup to m.homeAbbr)) {
                for (row in lineup) {
                    val rows = m.batterProps(row.playerId)
                    if (rows.isEmpty()) continue
                    entries.add(
                        MLBPlayerIndexEntry(
                            gamePk = m.gamePk, playerId = row.playerId, name = row.playerName,
                            teamAbbr = abbr, isPitcher = false, headlineRank = headlineRank(rows),
                        ),
                    )
                }
            }
            for (group in m.extraBatterGroups) {
                entries.add(
                    MLBPlayerIndexEntry(
                        gamePk = m.gamePk, playerId = group.playerId,
                        name = group.props.firstOrNull()?.playerName ?: "Player",
                        teamAbbr = "", isPitcher = false, headlineRank = headlineRank(group.props),
                    ),
                )
            }
        }
        mlbPlayerIndex = entries
        mlbPlayerIndexKey = key
    }

    private fun rebuildNFLPlayerIndexIfNeeded(players: List<NFLPropPlayer>) {
        val key = players.map { it.id }.toSet()
        if (key == nflPlayerIndexKey) return
        nflPlayerIndex = players.map { player ->
            val abbr = NFLTeamAssets.abbr(player.team ?: "")
            NFLPlayerIndexEntry(
                playerKey = player.id,
                gameId = player.gameId,
                name = player.playerName,
                teamAbbr = if (abbr.isEmpty()) (player.team ?: "") else abbr,
                headlineRank = player.headlineMarket?.l10HitRate ?: -1.0,
            )
        }
        nflPlayerIndexKey = key
    }

    private fun playerScore(q: String, name: String): Int? {
        val lower = name.lowercase()
        val tokens = lower.split(" ").filter { it.isNotEmpty() }
        val last = tokens.lastOrNull() ?: return null
        if (last.startsWith(q)) return 100
        // "a judge" → first-initial + last-name form.
        val first = tokens.firstOrNull()
        if (first != null && tokens.size >= 2) {
            val initialForm = "${first.take(1)} $last"
            if (initialForm.startsWith(q) || q == initialForm) return 90
        }
        if (first != null && first.startsWith(q)) return 70
        if (lower.contains(q)) return 50
        return null
    }

    val agentResults: List<SearchResult.Agent>
        get() {
            val q = normalizedQuery
            if (q.isEmpty()) return emptyList()
            val out = mutableListOf<SearchResult.Agent>()
            // Own agents first (private to the signed-in user) — full model.
            agentsRef?.get()?.let { agents ->
                for (a in agents.agents) {
                    if (a.agent.name.lowercase().contains(q)) {
                        out.add(SearchResult.Agent(id = "own-${a.agent.id}", model = a, isPublic = false))
                    }
                }
            }
            // Public agents — leaderboard cache. Exclude any avatar id already
            // surfaced so a user searching their own public agent isn't duped.
            val seen = out.map { it.agentId }.toSet()
            for (entry in publicAgents) {
                if (entry.name.lowercase().contains(q) && entry.avatarId !in seen) {
                    out.add(
                        SearchResult.Agent(
                            id = "public-${entry.avatarId}",
                            model = AgentWithPerformance(entry),
                            isPublic = true,
                        ),
                    )
                }
            }
            return out
        }

    /**
     * Full agents slate for the Explore card (no text query) — own agents
     * first, then the public leaderboard, de-duped by avatar id, capped at 30.
     */
    val browseAgentResults: List<SearchResult.Agent>
        get() {
            val out = mutableListOf<SearchResult.Agent>()
            agentsRef?.get()?.let { agents ->
                out += agents.agents.map {
                    SearchResult.Agent(id = "own-${it.agent.id}", model = it, isPublic = false)
                }
            }
            val seen = out.map { it.agentId }.toSet()
            for (entry in publicAgents) {
                if (entry.avatarId !in seen) {
                    out.add(
                        SearchResult.Agent(
                            id = "public-${entry.avatarId}",
                            model = AgentWithPerformance(entry),
                            isPublic = true,
                        ),
                    )
                }
            }
            return out.take(30)
        }

    /**
     * Outliers trend-card matches over the loaded slate (min query 2 chars,
     * cap 12). Ranks subject-name prefix highest, then team abbr, then matchup
     * / bet-type hits.
     */
    val trendResults: List<SearchResult.Trend>
        get() {
            val q = normalizedQuery
            val trends = trendsRef?.get()
            if (q.length < 2 || trends == null) return emptyList()
            val scored = mutableListOf<Pair<SearchResult.Trend, Int>>()
            for (entry in trends.searchIndex) {
                val score = trendMatchScore(entry.card, q) ?: continue
                scored.add(
                    SearchResult.Trend(
                        id = "trend-${entry.id}",
                        card = entry.card,
                        sport = entry.sport,
                        game = entry.game,
                        matchScore = score,
                    ) to score,
                )
            }
            return scored
                .sortedWith(
                    compareByDescending<Pair<SearchResult.Trend, Int>> { it.second }
                        .thenByDescending { it.first.card.trendValue },
                )
                .take(12)
                .map { it.first }
        }

    /**
     * Full Outliers slate for the Explore card (no text query) — the loaded
     * cross-sport index sorted by trend strength desc, capped at 30.
     */
    val browseTrendResults: List<SearchResult.Trend>
        get() {
            val trends = trendsRef?.get() ?: return emptyList()
            return trends.searchIndex
                .sortedByDescending { it.card.trendValue }
                .take(30)
                .map {
                    SearchResult.Trend(
                        id = "trend-${it.id}",
                        card = it.card,
                        sport = it.sport,
                        game = it.game,
                        matchScore = 0,
                    )
                }
        }

    /**
     * Match a trend card: subject name (player/coach/team/ref) > team abbr >
     * matchup (so searching one team surfaces its whole game) > bet type.
     */
    private fun trendMatchScore(card: OutliersTrendsCard, q: String): Int? {
        val subject = card.subjectName.lowercase()
        if (subject.startsWith(q)) return 100
        val abbr = card.teamAbbr?.lowercase()
        if (!abbr.isNullOrEmpty() && abbr == q) return 95
        if (subject.contains(q)) return 85
        if (card.matchupLabel.lowercase().contains(q)) return 70
        if (card.betTypeLabel.lowercase().contains(q)) return 50
        return null
    }

    // MARK: - Matching helpers

    private val normalizedQuery: String
        get() = debouncedQuery.trim().lowercase()

    // MARK: - Debug

    fun debugSetRecent(values: List<String>) {
        recentQueries = values.take(recentQueriesLimit)
    }

    fun debugSetPublicAgents(entries: List<AgentLeaderboardEntry>) {
        publicAgents = entries
    }
}
