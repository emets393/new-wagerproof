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
import com.wagerproof.core.services.HistoricalAnalysisDataSource
import com.wagerproof.core.services.HistoricalAnalysisSavedFiltersService
import com.wagerproof.core.services.HistoricalAnalysisService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Debounced, cache-preserving state for one NFL/CFB Historical Analysis page. */
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

    val betType: String get() = snapshot.betType
    val seasonFloor: Int get() = HistoricalAnalysisFilterBuilder.seasonFloor(betType, sport)
    val isLimitedHistory: Boolean get() = betType in HistoricalAnalysisBetType.limitedHistory

    suspend fun onAppear(userId: String? = null) {
        loadBootstrap()
        refreshSaved(userId)
        fetchNow()
    }

    fun setBetType(value: String) {
        updateSnapshot { it.betType = value }
        clampSeasonForBetType()
        resetLineControlsForBetType()
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
        resetLineControlsForBetType()
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
        try {
            val result = coroutineScope {
                val analysisTask = async { source.fetchAnalysis(sport, betType, filters) }
                val upcomingTask = async { source.fetchUpcoming(sport, betType, filters) }
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
        if (restored.selectedConferences.isEmpty() && restored.conference != "any") {
            restored.selectedConferences = listOf(restored.conference)
            restored.conference = "any"
        }
        snapshot = restored
        clampSeasonForBetType()
        scheduleFetch()
    }

    fun close() = scope.cancel()

    private suspend fun loadBootstrap() {
        runCatching { source.fetchAnalysis(sport, HistoricalAnalysisBetType.FG_SPREAD.raw, kotlinx.serialization.json.JsonObject(emptyMap())) }
            .onSuccess { boot ->
                if (sport == HistoricalAnalysisSport.NFL) {
                    coaches = boot.byCoach.orEmpty().map { it.label }.filter { it != "—" }.distinct().sorted()
                    referees = boot.byReferee.orEmpty().map { it.label }.filter { it != "—" }.distinct().sorted()
                } else {
                    conferences = boot.byConference.orEmpty().mapNotNull { it.conference }.filter(String::isNotBlank).distinct().sorted()
                }
            }
        if (sport == HistoricalAnalysisSport.CFB) {
            coroutineScope {
                val teams = async { runCatching { source.fetchConferenceTeamMap() }.getOrNull() }
                val logos = async { runCatching { source.fetchCFBLogos() }.getOrNull() }
                teams.await()?.let { conferenceTeamMap = it }
                logos.await()?.let { cfbLogos = it }
            }
        }
    }

    private fun clampSeasonForBetType() {
        if (snapshot.seasonMin < seasonFloor) updateSnapshot { it.seasonMin = seasonFloor }
    }

    private fun resetLineControlsForBetType() {
        updateSnapshot { s ->
            if (s.seasonMin < seasonFloor) s.seasonMin = seasonFloor
            if (sport == HistoricalAnalysisSport.NFL) {
                s.spreadMax = if (betType == "h1_spread") 14.0 else 20.0
                when (betType) {
                    "fg_total" -> { s.lineMin = 30.0; s.lineMax = 60.0 }
                    "h1_total" -> { s.lineMin = 15.0; s.lineMax = 35.0 }
                    "team_total" -> { s.lineMin = 10.0; s.lineMax = 40.0 }
                }
            } else {
                s.spreadMax = if (betType == "h1_spread") 18.0 else 28.0
                when (betType) {
                    "fg_total" -> { s.lineMin = 30.0; s.lineMax = 80.0 }
                    "h1_total" -> { s.lineMin = 15.0; s.lineMax = 45.0 }
                    "team_total" -> { s.lineMin = 10.0; s.lineMax = 55.0 }
                }
            }
        }
    }
}
