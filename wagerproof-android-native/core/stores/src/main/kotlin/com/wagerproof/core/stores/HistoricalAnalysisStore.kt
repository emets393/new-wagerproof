package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSavedFilter
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import com.wagerproof.core.models.MlbPitcherOption
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.services.HistoricalAnalysisDataSource
import com.wagerproof.core.services.HistoricalAnalysisSavedFiltersService
import com.wagerproof.core.services.HistoricalAnalysisService
import com.wagerproof.core.services.MlbTeamOption
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

    var coaches by mutableStateOf<List<String>>(emptyList()); private set
    var referees by mutableStateOf<List<String>>(emptyList()); private set
    var conferences by mutableStateOf<List<String>>(emptyList()); private set
    var conferenceTeamMap by mutableStateOf<Map<String, List<String>>>(emptyMap()); private set
    var cfbLogos by mutableStateOf<Map<String, String>>(emptyMap()); private set
    var savedFilters by mutableStateOf<List<HistoricalAnalysisSavedFilter>>(emptyList()); private set

    /** Team picker options — NFL: abbr+name, CFB: school names, MLB: split abbr+name. */
    var teamOptions by mutableStateOf<List<TeamOption>>(emptyList()); private set
    var mlbTeams by mutableStateOf<List<MlbTeamOption>>(emptyList()); private set

    data class TeamOption(val id: String, val name: String)

    val betType: String get() = snapshot.betType
    val seasonFloor: Int get() = HistoricalAnalysisFilterBuilder.seasonFloor(betType, sport)
    val isLimitedHistory: Boolean
        get() = sport != HistoricalAnalysisSport.MLB && betType in HistoricalAnalysisBetType.limitedHistory

    suspend fun onAppear(userId: String? = null) {
        loadBootstrap()
        refreshSaved(userId)
        fetchNow()
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

    suspend fun saveCurrentFilter(name: String, userId: String) {
        HistoricalAnalysisSavedFiltersService.save(sport, userId, name, betType, snapshot)
        refreshSaved(userId)
    }

    suspend fun deleteSavedFilter(id: String, userId: String) {
        runCatching { HistoricalAnalysisSavedFiltersService.delete(sport, id) }
        refreshSaved(userId)
    }

    fun restoreSaved(filter: HistoricalAnalysisSavedFilter) {
        val restored = filter.filters.copy(selectedConferences = filter.filters.selectedConferences.toList())
        if (filter.betType.isNotEmpty()) restored.betType = filter.betType
        correctLegacyFallbacks(restored)
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
     * Sparse/legacy saved snapshots (web, or any save predating a range field)
     * decode their missing ranges to the NFL-shaped constants baked into
     * [HistoricalAnalysisUISnapshot]'s defaults. On CFB/MLB those become silent
     * always-on filters — a restored CFB system would emit `ppg_max=40` and
     * `last_margin ±60`, quietly excluding high-scoring teams and blowouts the
     * user never filtered out. Snap the exact NFL-fallback signatures back to
     * this sport's no-op defaults.
     *
     * KNOWN FALSE POSITIVE: this infers "fell back" from the VALUE, so a CFB
     * user who deliberately sets a range to the NFL constant loses it — e.g.
     * last margin −60…+60 (CFB's slider runs to ±80) or ppg capped at 40 (CFB
     * defaults to 60). Android then omits the clause while iOS/web still send
     * it, so the same saved system runs a wider sample here. Snapping is still
     * the lesser evil: the phantom filter fires whenever the key is ABSENT,
     * which is far more common than landing on the exact pair.
     *
     * The real fix is a sport-aware decode, the way web does it
     * (src/features/analysis/normalizeSavedFilterSnapshot.ts:254-258) — fill
     * missing keys from `defaults(sport)` instead of the NFL-shaped base in
     * [HistoricalAnalysisUISnapshot], after which this whole function goes
     * away. That needs the sport threaded into
     * `HistoricalAnalysisUISnapshotSerializer`, which is shared with the plain
     * `@Serializable` decode of `HistoricalAnalysisSavedFilter`.
     */
    private fun correctLegacyFallbacks(s: HistoricalAnalysisUISnapshot) {
        val d = HistoricalAnalysisUISnapshot.defaults(sport)
        fun <T> snapBack(value: List<T>, nflFallback: List<T>, default: List<T>): List<T> =
            if (value == nflFallback && default != nflFallback) default else value

        s.winStreak = snapBack(s.winStreak, listOf(0, 16), d.winStreak)
        s.lossStreak = snapBack(s.lossStreak, listOf(0, 16), d.lossStreak)
        s.overStreak = snapBack(s.overStreak, listOf(0, 16), d.overStreak)
        s.underStreak = snapBack(s.underStreak, listOf(0, 16), d.underStreak)
        s.prevWins = snapBack(s.prevWins, listOf(0, 16), d.prevWins)
        s.ppg = snapBack(s.ppg, listOf(0.0, 40.0), d.ppg)
        s.paPg = snapBack(s.paPg, listOf(0.0, 40.0), d.paPg)
        s.oppPpg = snapBack(s.oppPpg, listOf(0.0, 40.0), d.oppPpg)
        s.oppPaPg = snapBack(s.oppPaPg, listOf(0.0, 40.0), d.oppPaPg)
        s.pointDiffPg = snapBack(s.pointDiffPg, listOf(-20.0, 20.0), d.pointDiffPg)
        s.avgCoverMargin = snapBack(s.avgCoverMargin, listOf(-15.0, 15.0), d.avgCoverMargin)
        s.oppLastMargin = snapBack(s.oppLastMargin, listOf(-60, 60), d.oppLastMargin)
        s.lastMargin = snapBack(s.lastMargin, listOf(-60, 60), d.lastMargin)
    }

    suspend fun searchPitchers(query: String): List<MlbPitcherOption> =
        runCatching { source.fetchPitcherOptions(query) }.getOrDefault(emptyList())

    fun close() = scope.cancel()

    private suspend fun loadBootstrap() {
        when (sport) {
            HistoricalAnalysisSport.NFL -> {
                runCatching {
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
                runCatching {
                    source.fetchAnalysis(sport, HistoricalAnalysisBetType.FG_SPREAD.raw, JsonObject(emptyMap()))
                }.onSuccess { boot ->
                    conferences = boot.byConference.orEmpty()
                        .mapNotNull { it.conference }.filter(String::isNotBlank).distinct().sorted()
                }
                coroutineScope {
                    val teams = async { runCatching { source.fetchConferenceTeamMap() }.getOrNull() }
                    val logos = async { runCatching { source.fetchCFBLogos() }.getOrNull() }
                    teams.await()?.let {
                        conferenceTeamMap = it
                        teamOptions = it.values.flatten().distinct().sorted().map { name -> TeamOption(name, name) }
                    }
                    logos.await()?.let { cfbLogos = it }
                }
            }
            HistoricalAnalysisSport.MLB -> {
                mlbTeams = runCatching { source.fetchMLBTeamAbbrs() }.getOrDefault(emptyList())
                teamOptions = mlbTeams.map { TeamOption(it.abbr, it.name) }
            }
        }
    }

    private fun clampSeasonForBetType() {
        if (snapshot.seasonMin < seasonFloor) updateSnapshot { it.seasonMin = seasonFloor }
    }
}
