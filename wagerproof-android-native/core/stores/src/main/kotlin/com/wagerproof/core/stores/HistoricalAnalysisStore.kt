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
        try {
            val result = coroutineScope {
                val analysisTask = async { source.fetchAnalysis(sport, betType, filters) }
                val upcomingTask = async { runCatching { source.fetchUpcoming(sport, betType, upcomingFilters) }.getOrDefault(emptyList()) }
                analysisTask.await() to upcomingTask.await()
            }
            analysis = result.first
            upcoming = result.second
            loadState = LoadState.Loaded
            hasLoadedOnce = true
        } catch (error: Throwable) {
            if (!hasLoadedOnce) loadState = LoadState.Failed(error.message ?: "Failed to load analysis.")
        } finally {
            isRefetching = false
        }
    }

    suspend fun refreshSaved(userId: String?) {
        if (userId == null) {
            savedFilters = emptyList()
            return
        }
        runCatching { HistoricalAnalysisSavedFiltersService.fetch(sport, userId) }
            .onSuccess { savedFilters = it }
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
        if (restored.selectedConferences.isEmpty() && restored.conference != "any") {
            restored.selectedConferences = listOf(restored.conference)
            restored.conference = "any"
        }
        snapshot = restored
        clampSeasonForBetType()
        scheduleFetch()
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
