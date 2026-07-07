package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.OutlierFadeAlert
import com.wagerproof.core.models.OutlierGame
import com.wagerproof.core.models.OutlierValueAlert
import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.services.OutliersService
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.time.Instant
import java.time.OffsetDateTime

/**
 * `OutliersStore` mirrors the RN `OutliersScreen`'s React-Query trio:
 *   - `useQuery(['week-games'], fetchWeekGames)`
 *   - `useQuery(['value-alerts'], fetchValueAlerts)`
 *   - `useQuery(['fade-alerts'], fetchFadeAlerts)`
 *
 * Refresh is parallel — pulling week games first, then fanning out the two
 * alert queries (which both depend on the week-games result). This matches
 * RN's `enabled: !!weekGames && weekGames.length > 0` gate.
 */
@Stable
class OutliersStore {

    /** Inner-tab identity. Mirrors RN `activeTab`. */
    enum class InnerTab(val raw: String, val label: String) {
        outliers("outliers", "Outliers"),
        agentPicks("agentPicks", "Top Agent Picks"),
        leaderboard("leaderboard", "Leaderboard"),
    }

    /**
     * Hub categories. The situational-trends / F5 / pitcher-matchup tool
     * categories retired when those datasets became per-matchup insight
     * widgets on the game detail sheets (and search chips).
     */
    enum class Category(val raw: String, val displayName: String) {
        `value`("value", "Prediction Market Alerts"),
        fade("fade", "Model Fade Alerts"),
        nbaAccuracy("nba-accuracy", "NBA Model Accuracy"),
        ncaabAccuracy("ncaab-accuracy", "NCAAB Model Accuracy"),
        mlbRegression("mlb-regression", "MLB Regression Report"),
    }

    // MARK: - Observable state

    var weekGames: List<OutlierGame> by mutableStateOf(emptyList()); private set
    var valueAlerts: List<OutlierValueAlert> by mutableStateOf(emptyList()); private set
    var fadeAlerts: List<OutlierFadeAlert> by mutableStateOf(emptyList()); private set
    var loadState: LoadState by mutableStateOf(LoadState.Idle); private set
    var lastRefreshedAt: Long? by mutableStateOf(null); private set

    /** Inner-tab selection. Mirrors RN `activeTab`. */
    var activeTab: InnerTab by mutableStateOf(InnerTab.outliers)

    /** Sport filter on value-alerts detail view. */
    var valueAlertsSportFilter: SportLeague? by mutableStateOf(null)

    /** Sport filter on fade-alerts detail view. */
    var fadeAlertsSportFilter: SportLeague? by mutableStateOf(null)

    /** Loading-spinner overlay key. Set when the user taps a card. */
    var loadingGameId: String? by mutableStateOf(null)

    val isLoading: Boolean get() = loadState.isLoading
    val lastError: String? get() = loadState.errorMessage

    // MARK: - Lifecycle

    /**
     * Pull-to-refresh / first-load entry point. Re-runs the whole pipeline.
     */
    // FIDELITY-WAIVER #062: After every successful refresh, RN's outliers.tsx
    // calls wagerBotSuggestionStore.setOutliersData(valueAlerts, fadeAlerts)
    // and onPageChange('outliers'). The suggestion store lands in B17 (Chat);
    // those calls wire in once it exists.
    suspend fun refresh() {
        loadState = LoadState.Loading
        try {
            val games = OutliersService.shared.fetchWeekGames()
            // Fan out the two alert queries — they only need the week games.
            val (v, f) = coroutineScope {
                val values = async { OutliersService.shared.fetchValueAlerts(weekGames = games) }
                val fades = async { OutliersService.shared.fetchFadeAlerts(weekGames = games) }
                values.await() to fades.await()
            }
            weekGames = games
            valueAlerts = v
            fadeAlerts = f
            loadState = LoadState.Loaded
            lastRefreshedAt = System.currentTimeMillis()
        } catch (e: Exception) {
            loadState = LoadState.Failed(e.message ?: e.toString())
        }
    }

    // MARK: - Selectors
    //
    // Mirrors RN's `filterBySport` + `isGameUpcoming` predicates.

    /** Filtered + game-time-upcoming value alerts. Used by both hub and detail views. */
    val filteredValueAlerts: List<OutlierValueAlert>
        get() {
            val filtered = valueAlertsSportFilter?.let { sport ->
                valueAlerts.filter { it.sport == sport }
            } ?: valueAlerts
            return filtered.filter { isUpcoming(it.game.gameTime) }
        }

    val filteredFadeAlerts: List<OutlierFadeAlert>
        get() {
            val filtered = fadeAlertsSportFilter?.let { sport ->
                fadeAlerts.filter { it.sport == sport }
            } ?: fadeAlerts
            return filtered.filter { isUpcoming(it.game.gameTime) }
        }

    /** Per-sport counts for the filter pills (renders "NFL (3)" labels). */
    fun valueAlertsCount(by: SportLeague): Int =
        valueAlerts.count { it.sport == by && isUpcoming(it.game.gameTime) }

    fun fadeAlertsCount(by: SportLeague): Int =
        fadeAlerts.count { it.sport == by && isUpcoming(it.game.gameTime) }

    // MARK: - Debug helpers (screenshot harness)

    fun debugSet(
        weekGames: List<OutlierGame> = emptyList(),
        valueAlerts: List<OutlierValueAlert> = emptyList(),
        fadeAlerts: List<OutlierFadeAlert> = emptyList(),
        state: LoadState = LoadState.Loaded,
    ) {
        this.weekGames = weekGames
        this.valueAlerts = valueAlerts
        this.fadeAlerts = fadeAlerts
        this.loadState = state
        this.lastRefreshedAt = if (state == LoadState.Loaded) System.currentTimeMillis() else null
    }

    companion object {
        /**
         * ISO parse (with/without fractional seconds) → upcoming if in the future.
         * `null` time → keep; unparseable bare date → keep.
         */
        private fun isUpcoming(gameTime: String?): Boolean {
            val raw = gameTime ?: return true // No time info → keep.
            val instant = runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
                ?: runCatching { Instant.parse(raw) }.getOrNull()
            if (instant != null) return instant.isAfter(Instant.now())
            // Bare date string — give it the benefit of the doubt.
            return true
        }
    }
}
