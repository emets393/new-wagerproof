package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBTrendsSlateBundle
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsGameMarket
import com.wagerproof.core.models.OutliersTrendsMarketSection
import com.wagerproof.core.models.OutliersTrendsMatchupFilter
import com.wagerproof.core.models.OutliersTrendsPropMarket
import com.wagerproof.core.models.OutliersTrendsSearchEntry
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubject
import com.wagerproof.core.services.CFBTeamsService
import com.wagerproof.core.services.MLBTrendsEngine
import com.wagerproof.core.services.NFLTeamsService
import com.wagerproof.core.services.NFLTrendsEngine
import com.wagerproof.core.services.OutliersTrendsService

@Stable
class OutliersTrendsStore {

    var loadState: LoadState by mutableStateOf(LoadState.Idle); private set
    var precomputedCards: List<OutliersTrendsCard> by mutableStateOf(emptyList()); private set
    var mlbBundle: MLBTrendsSlateBundle? by mutableStateOf(null); private set
    var lastRefreshedAt: Long? by mutableStateOf(null); private set

    /** Slate games are available before trend cards finish loading. */
    var slateGames: List<OutliersTrendsGame> by mutableStateOf(emptyList()); private set
    var isLoadingTrends: Boolean by mutableStateOf(false); private set

    // Sport / subject / matchup are the only filters now — market drives the section layout instead.
    var sport: OutliersTrendsSport by mutableStateOf(OutliersTrendsSport.NFL)
    var matchupFilter: OutliersTrendsMatchupFilter by mutableStateOf(OutliersTrendsMatchupFilter.AllGames)
    var subject: OutliersTrendsSubject by mutableStateOf(OutliersTrendsSubject.ALL)

    val isLoading: Boolean get() = loadState.isLoading || isLoadingTrends
    val lastError: String? get() = loadState.errorMessage

    suspend fun refresh() {
        if (!sport.hasTrendsData) {
            loadState = LoadState.Loaded
            precomputedCards = emptyList()
            mlbBundle = null
            slateGames = emptyList()
            return
        }

        loadState = LoadState.Loading
        isLoadingTrends = true
        slateGames = emptyList()
        precomputedCards = emptyList()
        mlbBundle = null

        try {
            when (sport) {
                OutliersTrendsSport.NFL -> NFLTeamsService.ensureLoaded()
                OutliersTrendsSport.NCAAF -> CFBTeamsService.ensureLoaded()
                else -> {}
            }

            if (sport == OutliersTrendsSport.MLB) {
                val bundle = OutliersTrendsService.shared.fetchMLBBundle()
                mlbBundle = bundle
                slateGames = bundle.games
                precomputedCards = emptyList()
                loadState = LoadState.Loaded
                lastRefreshedAt = System.currentTimeMillis()
                isLoadingTrends = false
                return
            }

            mlbBundle = null
            val games = OutliersTrendsService.shared.fetchSlateGames(sport = sport)
            slateGames = games
            loadState = LoadState.Loaded

            val first = games.firstOrNull()
            if (first == null) {
                precomputedCards = emptyList()
                isLoadingTrends = false
                return
            }

            precomputedCards = OutliersTrendsService.shared.fetchPrecomputedCards(
                sport = sport,
                season = first.season,
                week = first.week,
            )
            lastRefreshedAt = System.currentTimeMillis()
            isLoadingTrends = false
        } catch (e: Exception) {
            isLoadingTrends = false
            val message = e.message ?: e.toString()
            loadState = if (slateGames.isEmpty()) {
                LoadState.Failed(message)
            } else {
                LoadState.Failed("Trends data: $message")
            }
        }
    }

    val games: List<OutliersTrendsGame> get() = slateGames

    /**
     * Cards grouped into per-bet-type carousels, honoring the active sport/subject/matchup filters.
     * Market is the layout axis, so the engines run unfiltered by market and we bucket the result.
     */
    val marketSections: List<OutliersTrendsMarketSection>
        get() {
            if (!sport.hasTrendsData) return emptyList()

            val source: List<OutliersTrendsCard>
            if (sport == OutliersTrendsSport.MLB) {
                val bundle = mlbBundle ?: return emptyList()
                source = MLBTrendsEngine.buildCards(
                    bundle = bundle,
                    gameFilter = matchupFilter,
                    subject = subject,
                    gameMarket = OutliersTrendsGameMarket.ALL,
                    visibleLimit = Int.MAX_VALUE,
                )
            } else {
                if (precomputedCards.isEmpty()) return emptyList()
                // Carousels scroll horizontally, so show every player — no per-team overflow capping.
                source = NFLTrendsEngine.filterPrecomputedCards(
                    cards = precomputedCards,
                    games = slateGames,
                    sport = sport,
                    gameFilter = matchupFilter,
                    subject = subject,
                    gameMarket = OutliersTrendsGameMarket.ALL,
                    propMarket = OutliersTrendsPropMarket.ALL,
                    includeAllPlayers = true,
                    visibleLimit = Int.MAX_VALUE,
                )
            }

            return OutliersTrendsMarketSection.sections(cards = source, cap = sectionCardCap)
        }

    // MARK: - Search index
    //
    // The global Search "Outliers" section scans EVERY trend-bearing sport, not just the
    // active tab sport, so a query matches across NFL / NCAAF / MLB. Loaded once, lazily,
    // and cached — kept independent of the tab's `sport` / `precomputedCards` view state.
    var searchIndex: List<OutliersTrendsSearchEntry> by mutableStateOf(emptyList()); private set

    /**
     * Observable so the Search surface can show a shimmer rail while the cross-sport
     * index is fetching (it loads over the network, unlike the other in-memory sources).
     */
    var isLoadingSearchIndex: Boolean by mutableStateOf(false); private set

    /**
     * Fetch + flatten all sports' trend cards into `searchIndex` (each tagged with its
     * sport + game). No-op once loaded or while a load is in flight; a sport that fails
     * is skipped, not fatal.
     */
    suspend fun loadSearchIndexIfNeeded() {
        if (searchIndex.isNotEmpty() || isLoadingSearchIndex) return
        isLoadingSearchIndex = true
        try {
            val all = mutableListOf<OutliersTrendsSearchEntry>()

            // NFL + NCAAF: server-rendered cards keyed by the current slate week.
            for (s in listOf(OutliersTrendsSport.NFL, OutliersTrendsSport.NCAAF)) {
                try {
                    val games = OutliersTrendsService.shared.fetchSlateGames(sport = s)
                    val first = games.firstOrNull() ?: continue
                    val cards = OutliersTrendsService.shared.fetchPrecomputedCards(
                        sport = s, season = first.season, week = first.week,
                    )
                    val gamesById = games.associateBy { it.id }
                    val flat = NFLTrendsEngine.filterPrecomputedCards(
                        cards = cards, games = games, sport = s,
                        gameFilter = OutliersTrendsMatchupFilter.AllGames,
                        subject = OutliersTrendsSubject.ALL,
                        gameMarket = OutliersTrendsGameMarket.ALL,
                        propMarket = OutliersTrendsPropMarket.ALL,
                        includeAllPlayers = true, visibleLimit = Int.MAX_VALUE,
                    )
                    all += flat.map { OutliersTrendsSearchEntry(card = it, sport = s, game = gamesById[it.gameId]) }
                } catch (e: Exception) {
                    // Skip this sport — search still covers whatever else loaded.
                }
            }

            // MLB: client-built cards from the splits bundle.
            try {
                val bundle = OutliersTrendsService.shared.fetchMLBBundle()
                val gamesById = bundle.games.associateBy { it.id }
                val flat = MLBTrendsEngine.buildCards(
                    bundle = bundle,
                    gameFilter = OutliersTrendsMatchupFilter.AllGames,
                    subject = OutliersTrendsSubject.ALL,
                    gameMarket = OutliersTrendsGameMarket.ALL,
                    visibleLimit = Int.MAX_VALUE,
                )
                all += flat.map { OutliersTrendsSearchEntry(card = it, sport = OutliersTrendsSport.MLB, game = gamesById[it.gameId]) }
            } catch (e: Exception) {
            }

            searchIndex = all
        } finally {
            isLoadingSearchIndex = false
        }
    }

    fun onSportChanged() {
        if (sport == OutliersTrendsSport.MLB) {
            subject = OutliersTrendsSubject.TEAMS
        } else if (!sport.allowedSubjects.contains(subject)) {
            subject = OutliersTrendsSubject.ALL
        }
        matchupFilter = OutliersTrendsMatchupFilter.AllGames
    }

    companion object {
        /** Max cards per market carousel — sections are sorted best-first, keeping the strongest trends. */
        const val sectionCardCap = 24
    }
}
