package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AnalysisSystemVerdict
import com.wagerproof.core.models.AnalysisSystemsLeaderboardRow
import com.wagerproof.core.models.HistoricalAnalysisBarOption
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSavedFilter
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import com.wagerproof.core.models.MlbPitcherOption
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.NLFilterSnapshot
import com.wagerproof.core.services.HistoricalAnalysisDataSource
import com.wagerproof.core.services.HistoricalAnalysisSavedFiltersService
import com.wagerproof.core.services.HistoricalAnalysisService
import com.wagerproof.core.services.MlbTeamOption
import com.wagerproof.core.services.NLFilterPatchService
import com.wagerproof.core.services.runCatchingCancellable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

/** Debounced, cache-preserving state for one NFL/CFB/MLB Historical Analysis page. */
@Stable
class HistoricalAnalysisStore(
    val sport: HistoricalAnalysisSport,
    private val source: HistoricalAnalysisDataSource = HistoricalAnalysisService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var debounceJob: Job? = null

    /** Coalesces the pitcher-catalog fetch — both MLB Pitching typeaheads ask for it. */
    private val inFlight = InFlightTaskRegistry<String>(scope)

    var snapshot by mutableStateOf(HistoricalAnalysisUISnapshot.defaults(sport)); private set
    var analysis by mutableStateOf<HistoricalAnalysisResponse?>(null); private set
    var upcoming by mutableStateOf<List<HistoricalAnalysisUpcomingGame>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var isRefetching by mutableStateOf(false); private set
    var hasLoadedOnce by mutableStateOf(false); private set

    /**
     * Non-null when the LAST refetch failed while stale results stayed on screen.
     * Silently keeping old data made broken filters look like "the filter did
     * nothing" — surface it instead.
     */
    var fetchErrorMessage by mutableStateOf<String?>(null); private set

    /** Set when the saved-systems fetch fails (the list keeps whatever it had). */
    var savedFiltersError by mutableStateOf<String?>(null); private set

    /** Public Systems Leaderboard for this sport — grader-computed, never recomputed here. */
    var leaderboard by mutableStateOf<List<AnalysisSystemsLeaderboardRow>>(emptyList()); private set
    var leaderboardState by mutableStateOf<LoadState>(LoadState.Idle); private set

    /** True while a Save System insert is in flight — the sheet's Save button waits on it. */
    var isSavingSystem by mutableStateOf(false); private set

    /**
     * Set when the user applies a saved / leaderboard system, so the page can say
     * whose rule it is currently showing. Cleared on reset and on a new save.
     */
    var viewingSystemBanner by mutableStateOf<ViewingSystemBanner?>(null)

    /** `username == "you"` marks the viewer's own system (iOS `ViewingSystemBanner`). */
    data class ViewingSystemBanner(
        val name: String,
        val username: String,
        val verdict: AnalysisSystemVerdict,
    )

    var coaches by mutableStateOf<List<String>>(emptyList()); private set
    var referees by mutableStateOf<List<String>>(emptyList()); private set
    var conferences by mutableStateOf<List<String>>(emptyList()); private set
    var conferenceTeamMap by mutableStateOf<Map<String, List<String>>>(emptyMap()); private set
    var cfbLogos by mutableStateOf<Map<String, String>>(emptyMap()); private set
    var savedFilters by mutableStateOf<List<HistoricalAnalysisSavedFilter>>(emptyList()); private set

    /** Team picker options — NFL: abbr+name, CFB: school names, MLB: split abbr+name. */
    var teamOptions by mutableStateOf<List<TeamOption>>(emptyList()); private set
    var mlbTeams by mutableStateOf<List<MlbTeamOption>>(emptyList()); private set

    /**
     * Full MLB starter catalog, fetched once and filtered on device (iOS
     * `MlbPitcherTypeahead.ensureCatalog`). Loaded lazily when the Pitching sheet
     * first opens rather than in `loadBootstrap` — most sessions never open it.
     */
    var pitcherCatalog by mutableStateOf<List<MlbPitcherOption>>(emptyList()); private set
    var pitcherCatalogState by mutableStateOf<LoadState>(LoadState.Idle); private set

    data class TeamOption(val id: String, val name: String)

    val betType: String get() = snapshot.betType
    val seasonFloor: Int get() = HistoricalAnalysisFilterBuilder.seasonFloor(betType, sport)
    val isLimitedHistory: Boolean
        get() = sport != HistoricalAnalysisSport.MLB && betType in HistoricalAnalysisBetType.limitedHistory

    /**
     * True when the overall number is a forced ~50% tautology (two-sided market,
     * only game-level filters) — the hero then shows the real splits instead of
     * a meaningless flat headline. iOS `HistoricalAnalysisStore.shouldShowSymmetricSplit`.
     */
    val shouldShowSymmetricSplit: Boolean get() = snapshot.isSideSymmetricFor(sport)

    /** The two split dimensions plus the single best side, for the symmetric hero. */
    data class SymmetricSplit(
        val extremeSide: HistoricalAnalysisBarOption,
        val homeAway: List<HistoricalAnalysisBarOption>,
        val favDog: List<HistoricalAnalysisBarOption>,
    )

    /**
     * Split data for the symmetric hero. Returns null when the state doesn't
     * apply or the RPC sent no side bars (nothing to headline).
     */
    fun getSymmetricSplitData(): SymmetricSplit? {
        val data = analysis ?: return null
        if (!shouldShowSymmetricSplit) return null
        val homeAway = data.bars.firstOrNull { it.dimension == "home_away" }?.options.orEmpty()
        val favDog = data.bars.firstOrNull { it.dimension == "fav_dog" }?.options.orEmpty()
        // Stronger cover rate wins. Complements sit equally far from 50%, so an
        // abs-from-50 comparison ties and keeps RPC order — often the <50% side.
        val extreme = (homeAway + favDog).maxByOrNull { it.hitPct } ?: return null
        return SymmetricSplit(extreme, homeAway, favDog)
    }

    suspend fun onAppear(userId: String? = null) {
        loadRecentQueries()
        loadBootstrap()
        refreshSaved(userId)
        fetchNow()
    }

    // MARK: - Natural-language filter chat
    //
    // The dock at the bottom of the page is the discovery path for the ~120
    // filter dimensions nobody finds by hand. See NLFilterPatchService for the
    // server contract and NLFilterSnapshot for the shape conversion.

    /** Observable state for the chat dock (iOS `NLFilterChatState`). */
    @Stable
    class NLFilterChatState {
        var inputText by mutableStateOf("")
        var isProcessing by mutableStateOf(false); internal set
        var lastResponse by mutableStateOf<NLFilterResponse?>(null); internal set
        var transcript by mutableStateOf<List<NLFilterExchange>>(emptyList()); internal set
    }

    /** What one chat turn did to the filters, in user-reportable terms. */
    data class NLFilterResponse(
        val applied: List<String> = emptyList(),
        val rejected: List<String> = emptyList(),
        val couldntMap: List<String> = emptyList(),
        val ambiguous: List<String> = emptyList(),
        val noChange: Boolean = false,
        val error: String? = null,
    ) {
        val hasChanges: Boolean
            get() = applied.isNotEmpty() || rejected.isNotEmpty() ||
                couldntMap.isNotEmpty() || ambiguous.isNotEmpty()
    }

    data class NLFilterExchange(
        val id: String,
        val input: String,
        val response: NLFilterResponse,
        val timestampMs: Long,
    )

    val nlChat = NLFilterChatState()

    /**
     * Per-sport recent chat queries, persisted so the suggestion row above the
     * input still has history after a cold start (iOS `recentQueries`).
     */
    var recentQueries by mutableStateOf<List<String>>(emptyList()); private set
    private val recentQueriesKey = "ha_recent_queries_${sport.raw}"

    fun loadRecentQueries() {
        recentQueries = StorePrefs.standard.getString(recentQueriesKey, null)
            ?.split("\n")
            ?.filter { it.isNotEmpty() }
            ?.take(RECENT_QUERIES_LIMIT)
            ?: emptyList()
    }

    private fun rememberQuery(sentence: String) {
        val next = recentQueries.filterNot { it.equals(sentence, ignoreCase = true) }.toMutableList()
        next.add(0, sentence)
        recentQueries = next.take(RECENT_QUERIES_LIMIT)
        StorePrefs.standard.edit().putString(recentQueriesKey, recentQueries.joinToString("\n")).apply()
    }

    /**
     * Run one chat turn: serialize the live filter, patch it server-side, and
     * restore whatever came back. Returns the outcome so the caller can raise
     * the result banner without observing [NLFilterChatState.isProcessing].
     *
     * Signed-out callers are refused locally — the edge function 401s anyway,
     * and an error banner reading "unauthorized" explains nothing.
     */
    suspend fun submitNLFilterQuery(sentence: String, isAuthenticated: Boolean): NLFilterResponse? {
        val trimmed = sentence.trim()
        if (!isAuthenticated || trimmed.isEmpty() || nlChat.isProcessing) return null

        nlChat.isProcessing = true
        val outcome = try {
            val result = NLFilterPatchService.submit(
                sentence = trimmed,
                currentFilter = NLFilterSnapshot.serialize(sport, snapshot),
                coaches = coaches,
                referees = referees,
                sport = sport,
            )
            if (result.error != null) {
                NLFilterResponse(error = result.error)
            } else {
                result.snapshot?.let { web ->
                    updateSnapshot { NLFilterSnapshot.restore(sport, it, web) }
                    // The chat can change betType, and every other betType path in
                    // this store clamps the season floor with it — a limited-history
                    // market left on 2018 queries seasons that have no rows.
                    clampSeasonForBetType()
                    scheduleFetch()
                }
                NLFilterResponse(
                    applied = result.applied.map { it.dimension },
                    rejected = result.rejected,
                    couldntMap = result.couldntMap,
                    ambiguous = result.ambiguous,
                    noChange = result.noChange,
                )
            }
        } catch (cancellation: CancellationException) {
            nlChat.isProcessing = false
            throw cancellation
        } catch (error: Throwable) {
            NLFilterResponse(error = error.message ?: "Filter chat failed. Try again.")
        }

        if (outcome.error == null) {
            nlChat.transcript = nlChat.transcript + NLFilterExchange(
                id = "${System.currentTimeMillis()}-${nlChat.transcript.size}",
                input = trimmed,
                response = outcome,
                timestampMs = System.currentTimeMillis(),
            )
            nlChat.inputText = ""
            rememberQuery(trimmed)
        }
        nlChat.lastResponse = outcome
        nlChat.isProcessing = false
        return outcome
    }

    fun setBetType(value: String) {
        updateSnapshot { it.betType = value }
        clampSeasonForBetType()
        scheduleFetch()
    }

    fun updateSnapshot(block: (HistoricalAnalysisUISnapshot) -> Unit) {
        val next = snapshot.copy(selectedConferences = snapshot.selectedConferences.toList())
        block(next)
        snapshot = next
    }

    fun replaceSnapshot(value: HistoricalAnalysisUISnapshot, fetch: Boolean = true) {
        snapshot = value.copy(selectedConferences = value.selectedConferences.toList())
        clampSeasonForBetType()
        if (fetch) scheduleFetch()
    }

    fun resetAllFilters() {
        val currentBetType = betType
        snapshot = HistoricalAnalysisUISnapshot.defaults(sport).also { it.betType = currentBetType }
        // The banner names the rule currently on screen; after a reset there isn't one.
        viewingSystemBanner = null
        clampSeasonForBetType()
        scheduleFetch()
    }

    fun scheduleFetch() {
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(350)
            fetchNow()
        }
    }

    suspend fun fetchNow() {
        if (hasLoadedOnce) isRefetching = true else loadState = LoadState.Loading
        val filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(sport, snapshot, conferenceTeamMap)
        // Weather-only MLB filters would zero out the upcoming slate (forecast data
        // is missing pre-game) — send `{}` there instead, same as iOS/web.
        val upcomingFilters: JsonObject =
            if (sport == HistoricalAnalysisSport.MLB && HistoricalAnalysisFilterBuilder.mlbFiltersWeatherOnly(filters)) {
                JsonObject(emptyMap())
            } else filters

        // Analysis first, painted before upcoming is even requested. Awaiting both
        // together made every filter change dim the screen for the duration of the
        // slower query, and running them concurrently contended the same warehouse.
        val result = try {
            source.fetchAnalysis(sport, betType, filters)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Throwable) {
            if (hasLoadedOnce) {
                fetchErrorMessage = "Couldn't refresh with these filters — results may be stale."
            } else {
                loadState = LoadState.Failed(error.message ?: "Failed to load analysis.")
            }
            isRefetching = false
            return
        }

        analysis = result
        loadState = LoadState.Loaded
        hasLoadedOnce = true
        isRefetching = false
        fetchErrorMessage = null

        upcoming = try {
            source.fetchUpcoming(sport, betType, upcomingFilters)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (_: Throwable) {
            emptyList()
        }
    }

    suspend fun refreshSaved(userId: String?) {
        if (userId == null) {
            savedFilters = emptyList()
            savedFiltersError = null
            return
        }
        try {
            savedFilters = HistoricalAnalysisSavedFiltersService.fetch(sport, userId)
            savedFiltersError = null
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (_: Throwable) {
            // Never wipe a previously-loaded list on a transient failure — that made
            // successful saves look like they vanished from My Systems.
            savedFiltersError = "Couldn't load your systems — tap refresh to retry."
        }
    }

    /**
     * The exact `p_filters` payload for a snapshot — the same object [fetchNow] sends
     * to `{sport}_analysis`, which is what the nightly grader replays.
     *
     * Takes a snapshot rather than reading [snapshot]: Save System edits a local draft
     * (so cancelling never disturbs the live filters), and the row it writes must carry
     * the payload for THAT draft, not for whatever is on screen.
     */
    fun rpcFiltersFor(value: HistoricalAnalysisUISnapshot): JsonObject =
        HistoricalAnalysisFilterBuilder.buildRPCFilters(sport, value, conferenceTeamMap)

    /**
     * Save a tracked system: UI snapshot + bet-side + the exact warehouse payload the
     * nightly grader replays. Returns the new row id.
     *
     * The row is inserted into [savedFilters] optimistically so My Systems updates even
     * if the follow-up fetch hiccups — a save that appears to vanish is the single worst
     * failure here (the user just named a rule and has nothing to show for it).
     */
    suspend fun saveSystem(
        name: String,
        verdict: AnalysisSystemVerdict,
        isPublic: Boolean,
        userId: String,
        draftSnapshot: HistoricalAnalysisUISnapshot? = null,
    ): String {
        isSavingSystem = true
        try {
            val savedSnapshot = draftSnapshot ?: snapshot
            val savedBetType = savedSnapshot.betType.ifEmpty { betType }
            val rpcFilters = rpcFiltersFor(savedSnapshot)
            val id = HistoricalAnalysisSavedFiltersService.saveSystem(
                sport = sport,
                userId = userId,
                name = name,
                betType = savedBetType,
                snapshot = savedSnapshot,
                verdict = verdict,
                rpcBetType = savedBetType,
                rpcFilters = rpcFilters,
                isPublic = isPublic,
            )
            viewingSystemBanner = null
            val optimistic = HistoricalAnalysisSavedFilter(
                id = id,
                userId = userId,
                name = name.trim(),
                betType = savedBetType,
                filters = savedSnapshot,
                verdict = verdict,
                rpcBetType = savedBetType,
                rpcFilters = rpcFilters,
                isPublic = isPublic,
                sinceSaved = null,
                createdAt = null,
            )
            savedFilters = listOf(optimistic) + savedFilters.filter { it.id != id }
            refreshSaved(userId)
            // Shared systems need a grade pass for filters_hash + all_time before the
            // leaderboard RPC returns them — don't make the user wait for the cron.
            if (isPublic) scope.launch { HistoricalAnalysisSavedFiltersService.requestGrade() }
            return id
        } finally {
            isSavingSystem = false
        }
    }

    suspend fun renameSystem(id: String, name: String, userId: String) {
        runCatchingCancellable { HistoricalAnalysisSavedFiltersService.rename(sport, id, name) }
        refreshSaved(userId)
    }

    suspend fun setSystemPublic(id: String, isPublic: Boolean, userId: String) {
        runCatchingCancellable {
            HistoricalAnalysisSavedFiltersService.setPublic(sport, id, isPublic)
        }
        // Optimistic local flip so the toggle feels instant.
        savedFilters = savedFilters.map { if (it.id == id) it.copy(isPublic = isPublic) else it }
        if (isPublic) scope.launch { HistoricalAnalysisSavedFiltersService.requestGrade() }
        refreshSaved(userId)
    }

    suspend fun deleteSavedFilter(id: String, userId: String) {
        runCatchingCancellable { HistoricalAnalysisSavedFiltersService.delete(sport, id) }
        refreshSaved(userId)
    }

    /**
     * Load the public leaderboard. Coalesced (both hub tabs and the guest sheet can
     * ask at once) and gated on [LoadState.needsInitialLoad] so a failed first load
     * still retries, while an already-loaded board isn't refetched on every open.
     * [force] is the pull-to-refresh path.
     */
    suspend fun loadLeaderboard(force: Boolean = false) {
        if (!force && !leaderboardState.needsInitialLoad) return
        inFlight.run("leaderboard") {
            leaderboardState = if (leaderboard.isEmpty()) LoadState.Loading else LoadState.Refreshing
            runCatchingCancellable { HistoricalAnalysisSavedFiltersService.fetchLeaderboard(sport) }
                .onSuccess {
                    leaderboard = it
                    leaderboardState = LoadState.Loaded
                }
                .onFailure {
                    leaderboardState =
                        LoadState.Failed("Couldn't load the Systems Leaderboard. Pull to retry.")
                }
        }
    }

    fun restoreSaved(filter: HistoricalAnalysisSavedFilter) {
        applyFilterSnapshot(filter.filters, filter.betType)
        // Legacy bookmarks have no bet-side, so there is no rule to announce.
        viewingSystemBanner = filter.verdict?.let {
            ViewingSystemBanner(name = filter.name, username = "you", verdict = it)
        }
    }

    /** Apply a leaderboard system to the page. No-op when the row carries no snapshot. */
    fun applyLeaderboardSystem(row: AnalysisSystemsLeaderboardRow) {
        val filters = row.filters ?: return
        applyFilterSnapshot(filters, row.betType)
        viewingSystemBanner = ViewingSystemBanner(
            name = row.name,
            username = row.username,
            verdict = row.effectiveVerdict,
        )
    }

    private fun applyFilterSnapshot(filters: HistoricalAnalysisUISnapshot, rawBetType: String) {
        val restored = filters.copy(selectedConferences = filters.selectedConferences.toList())
        if (rawBetType.isNotEmpty()) restored.betType = rawBetType
        if (restored.selectedConferences.isEmpty() && restored.conference != "any") {
            restored.selectedConferences = listOf(restored.conference)
            restored.conference = "any"
        }
        snapshot = restored
        clampSeasonForBetType()
        // Restore must refetch immediately — a 350ms debounce leaves the previous
        // (often empty) analysis painted under the new chips and reads as "No games match".
        debounceJob?.cancel()
        debounceJob = scope.launch { fetchNow() }
    }

    /**
     * Loads the starter catalog for the Pitching sheet. Retries after a failure
     * (`needsInitialLoad`) but never refetches a catalog we already have — the
     * list is ~1,500 rows and doesn't change mid-session.
     */
    suspend fun loadPitcherCatalog() {
        if (!pitcherCatalogState.needsInitialLoad) return
        inFlight.run("pitcher-catalog") {
            pitcherCatalogState = LoadState.Loading
            runCatchingCancellable { source.fetchPitcherOptions("") }
                .onSuccess {
                    pitcherCatalog = it
                    pitcherCatalogState = LoadState.Loaded
                }
                .onFailure {
                    pitcherCatalogState = LoadState.Failed(it.message ?: "Couldn't load pitchers.")
                }
        }
    }

    suspend fun searchPitchers(query: String): List<MlbPitcherOption> =
        runCatchingCancellable { source.fetchPitcherOptions(query) }.getOrDefault(emptyList())

    fun close() = scope.cancel()

    private suspend fun loadBootstrap() {
        when (sport) {
            HistoricalAnalysisSport.NFL -> {
                runCatchingCancellable {
                    source.fetchAnalysis(sport, HistoricalAnalysisBetType.FG_SPREAD.raw, JsonObject(emptyMap()))
                }.onSuccess { boot ->
                    coaches = boot.byCoach.orEmpty().map { it.label }.filter { it != "—" }.distinct().sorted()
                    referees = boot.byReferee.orEmpty().map { it.label }.filter { it != "—" }.distinct().sorted()
                }
                teamOptions = NFLTeamAssets.byAbbr.values
                    .map { TeamOption(it.abbr, it.name) }
                    .sortedBy { it.name.lowercase() }
            }
            HistoricalAnalysisSport.CFB -> {
                runCatchingCancellable {
                    source.fetchAnalysis(sport, HistoricalAnalysisBetType.FG_SPREAD.raw, JsonObject(emptyMap()))
                }.onSuccess { boot ->
                    conferences = boot.byConference.orEmpty()
                        .mapNotNull { it.conference }.filter(String::isNotBlank).distinct().sorted()
                }
                coroutineScope {
                    val teams = async { runCatchingCancellable { source.fetchConferenceTeamMap() }.getOrNull() }
                    val logos = async { runCatchingCancellable { source.fetchCFBLogos() }.getOrNull() }
                    teams.await()?.let {
                        conferenceTeamMap = it
                        teamOptions = it.values.flatten().distinct().sorted().map { name -> TeamOption(name, name) }
                    }
                    logos.await()?.let { cfbLogos = it }
                }
            }
            HistoricalAnalysisSport.MLB -> {
                mlbTeams = runCatchingCancellable { source.fetchMLBTeamAbbrs() }.getOrDefault(emptyList())
                teamOptions = mlbTeams.map { TeamOption(it.abbr, it.name) }
            }
        }
    }

    private fun clampSeasonForBetType() {
        if (snapshot.seasonMin < seasonFloor) updateSnapshot { it.seasonMin = seasonFloor }
    }

    companion object {
        /** Recent chat queries kept per sport (iOS keeps 8). */
        const val RECENT_QUERIES_LIMIT = 8
    }
}
