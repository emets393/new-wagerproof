package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NBAGameTrends
import com.wagerproof.core.models.NBAInjuryReport
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Port of iOS `NBAMatchupOverviewStore.swift`.
 *
 * Loads NBA matchup overview data (injury report + recent trends) for the
 * open NBA game bottom sheet. Mirrors RN `hooks/useNBAMatchupOverview.ts`:
 *   - Injuries: `nba_injury_report` filtered by `team_name IN (away, home)`,
 *     `game_date_et = normalizeDateString(game_date)`, `bucket = 'current'`.
 *   - Trends:   single-row select against `nba_input_values_view` on
 *     `(game_date, away_team, home_team)`.
 *
 * Per-sheet store: owned by the bottom sheet, [reset] each time the user opens
 * a different game. Cumulative injury impact scores computed here (matches
 * RN's `calculateInjuryImpact`). NBA tables live on the CFB/sports-data
 * project → `SupabaseClients.cfb`.
 */
@Stable
class NBAMatchupOverviewStore {
    var awayInjuries by mutableStateOf<List<NBAInjuryReport>>(emptyList()); private set
    var homeInjuries by mutableStateOf<List<NBAInjuryReport>>(emptyList()); private set
    var trends by mutableStateOf<NBAGameTrends?>(null); private set
    var awayInjuryImpact by mutableStateOf(0.0); private set
    var homeInjuryImpact by mutableStateOf(0.0); private set
    var injuriesState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var trendsState by mutableStateOf<LoadState>(LoadState.Idle); private set

    fun reset() {
        awayInjuries = emptyList()
        homeInjuries = emptyList()
        trends = null
        awayInjuryImpact = 0.0
        homeInjuryImpact = 0.0
        injuriesState = LoadState.Idle
        trendsState = LoadState.Idle
    }

    /**
     * Mirrors RN's mount-time effect: fetch injuries + trends in parallel
     * whenever away/home/date are all present. We model "isOpen" by callers
     * only invoking this method.
     */
    suspend fun load(awayTeam: String?, homeTeam: String?, gameDate: String?) {
        val away = awayTeam?.trim()
        val home = homeTeam?.trim()
        val rawDate = gameDate
        if (away.isNullOrEmpty() || home.isNullOrEmpty() || rawDate.isNullOrEmpty()) {
            reset()
            return
        }
        // FIDELITY-WAIVER #101: iOS DummyDataMode branch (captured injuries +
        // synthesized trends) has no Android DummyData equivalent — go live.
        val normalized = normalizeDateString(rawDate)
        coroutineScope {
            listOf(
                async { loadInjuries(away, home, normalized) },
                async { loadTrends(away, home, normalized) },
            ).awaitAll()
        }
    }

    private suspend fun loadInjuries(awayTeam: String, homeTeam: String, normalizedDate: String) {
        injuriesState = LoadState.Loading
        val cfb = SupabaseClients.cfb
        try {
            val rows: List<NBAInjuryReport> = cfb
                .from("nba_injury_report")
                .select(Columns.raw("player_name, avg_pie_season, status, team_id, team_name, team_abbr")) {
                    filter {
                        isIn("team_name", listOf(awayTeam, homeTeam))
                        eq("game_date_et", normalizedDate)
                        eq("bucket", "current")
                    }
                }
                .decodeList<NBAInjuryReport>()
            val away = rows.filter { it.teamName.equals(awayTeam, ignoreCase = true) }
            val home = rows.filter { it.teamName.equals(homeTeam, ignoreCase = true) }
            awayInjuries = away
            homeInjuries = home
            awayInjuryImpact = calculateInjuryImpact(away)
            homeInjuryImpact = calculateInjuryImpact(home)
            injuriesState = LoadState.Loaded
        } catch (e: Exception) {
            injuriesState = LoadState.Failed(e.message ?: "Failed to load injuries")
        }
    }

    private suspend fun loadTrends(awayTeam: String, homeTeam: String, normalizedDate: String) {
        trendsState = LoadState.Loading
        val cfb = SupabaseClients.cfb
        // RN uses `maybeSingle`; we read the first element of a normal select.
        val select = "home_ovr_rtg, away_ovr_rtg, " +
            "home_consistency, away_consistency, " +
            "home_win_streak, away_win_streak, " +
            "home_ats_pct, away_ats_pct, " +
            "home_ats_streak, away_ats_streak, " +
            "home_last_margin, away_last_margin, " +
            "home_over_pct, away_over_pct, " +
            "home_adj_pace_pregame_l3_trend, away_adj_pace_pregame_l3_trend, " +
            "home_adj_off_rtg_pregame_l3_trend, away_adj_off_rtg_pregame_l3_trend, " +
            "home_adj_def_rtg_pregame_l3_trend, away_adj_def_rtg_pregame_l3_trend"
        try {
            val rows: List<NBAGameTrends> = cfb
                .from("nba_input_values_view")
                .select(Columns.raw(select)) {
                    filter {
                        eq("game_date", normalizedDate)
                        eq("away_team", awayTeam)
                        eq("home_team", homeTeam)
                    }
                }
                .decodeList<NBAGameTrends>()
            trends = rows.firstOrNull()
            trendsState = LoadState.Loaded
        } catch (e: Exception) {
            trends = null
            trendsState = LoadState.Failed(e.message ?: "Failed to load trends")
        }
    }

    companion object {
        /**
         * Cumulative Injury Impact Score = sum of -PIE values. Mirrors RN's
         * `calculateInjuryImpact` exactly.
         */
        private fun calculateInjuryImpact(injuries: List<NBAInjuryReport>): Double {
            if (injuries.isEmpty()) return 0.0
            return injuries.fold(0.0) { sum, injury ->
                val pie = injury.pieValue ?: return@fold sum
                sum + (-pie)
            }
        }

        /**
         * Normalize a date string to `YYYY-MM-DD`. Mirrors `normalizeDateString`
         * in the original hook: strip a `T`/space suffix, and if the result
         * isn't already `YYYY-MM-DD`, reformat via a parsed instant in ET.
         */
        fun normalizeDateString(dateStr: String): String {
            var normalized = dateStr
            if (dateStr.contains("T")) {
                normalized = dateStr.substringBefore("T")
            } else if (dateStr.contains(" ")) {
                normalized = dateStr.substringBefore(" ")
            }
            val pattern = Regex("^\\d{4}-\\d{2}-\\d{2}$")
            if (!pattern.matches(normalized)) {
                val instant = runCatching { Instant.parse(dateStr) }.getOrNull()
                    ?: runCatching { OffsetDateTime.parse(dateStr).toInstant() }.getOrNull()
                if (instant != null) {
                    val f = DateTimeFormatter.ofPattern("yyyy-MM-dd")
                        .withZone(ZoneId.of("America/New_York"))
                    return f.format(instant)
                }
            }
            return normalized
        }
    }
}
