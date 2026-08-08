package com.wagerproof.core.services

import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.MLBF5
import com.wagerproof.core.models.MlbPitcherOption
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

interface HistoricalAnalysisDataSource {
    suspend fun fetchAnalysis(sport: HistoricalAnalysisSport, betType: String, filters: JsonObject): HistoricalAnalysisResponse
    suspend fun fetchUpcoming(sport: HistoricalAnalysisSport, betType: String, filters: JsonObject): List<HistoricalAnalysisUpcomingGame>
    suspend fun fetchConferenceTeamMap(): Map<String, List<String>>
    suspend fun fetchCFBLogos(): Map<String, String>
    suspend fun fetchMLBTeamAbbrs(): List<MlbTeamOption>
    suspend fun fetchPitcherOptions(query: String): List<MlbPitcherOption>
}

data class MlbTeamOption(val abbr: String, val name: String)

/** Read-only warehouse RPCs on the sports-data Supabase project. */
object HistoricalAnalysisService : HistoricalAnalysisDataSource {
    private fun params(betType: String, filters: JsonObject) = buildJsonObject {
        put("p_bet_type", betType)
        put("p_filters", filters)
    }

    override suspend fun fetchAnalysis(
        sport: HistoricalAnalysisSport,
        betType: String,
        filters: JsonObject,
    ): HistoricalAnalysisResponse = SupabaseClients.cfb.postgrest
        .rpc(sport.analysisRPC, params(betType, filters))
        .decodeAs()

    override suspend fun fetchUpcoming(
        sport: HistoricalAnalysisSport,
        betType: String,
        filters: JsonObject,
    ): List<HistoricalAnalysisUpcomingGame> = SupabaseClients.cfb.postgrest
        .rpc(sport.upcomingRPC, params(betType, filters))
        .decodeList()

    override suspend fun fetchConferenceTeamMap(): Map<String, List<String>> {
        val rows = SupabaseClients.cfb.from("cfb_teams")
            .select(columns = io.github.jan.supabase.postgrest.query.Columns.raw("team_name,conference"))
            .decodeList<ConferenceTeamRow>()
        return rows.filter { !it.conference.isNullOrBlank() }
            .groupBy({ requireNotNull(it.conference) }, { it.teamName })
            .mapValues { (_, teams) -> teams.sorted() }
    }

    /**
     * CFB team logos keyed by `cfb_teams.team_name` — the same key the conference/team
     * map, the team RPC filter and the breakdown rows use. The legacy
     * `cfb_team_mapping` table is retired and was keyed by `api`, so any school whose
     * two names differ rendered initials instead of a logo.
     */
    override suspend fun fetchCFBLogos(): Map<String, String> = SupabaseClients.cfb
        .from("cfb_teams")
        .select(columns = io.github.jan.supabase.postgrest.query.Columns.raw("team_name,logo"))
        .decodeList<CFBLogoRow>()
        .mapNotNull { row -> row.teamName?.let { name -> row.logo?.takeIf(String::isNotBlank)?.let { name to it } } }
        .toMap()

    /** MLB team abbr + name from `mlb_team_mapping`, remapped to game-log codes (AZ/ATH). */
    override suspend fun fetchMLBTeamAbbrs(): List<MlbTeamOption> {
        val rows = SupabaseClients.cfb.from("mlb_team_mapping")
            .select(columns = io.github.jan.supabase.postgrest.query.Columns.raw("team,team_name"))
            .decodeList<MlbTeamRow>()
        val seen = mutableSetOf<String>()
        return rows.mapNotNull { row ->
            val abbr = MLBF5.toSplitTeamAbbr(row.team)
            if (abbr.isEmpty() || !seen.add(abbr)) return@mapNotNull null
            MlbTeamOption(abbr, MLBF5.analysisTeamLabel(abbr, row.teamName ?: row.team))
        }.sortedBy { it.name.lowercase() }
    }

    /** Pitcher typeahead via `mlb_pitcher_options`. Empty query → `p_q: null` (same as web/iOS). */
    override suspend fun fetchPitcherOptions(query: String): List<MlbPitcherOption> {
        val trimmed = query.trim()
        val params = buildJsonObject {
            if (trimmed.isEmpty()) put("p_q", null as String?) else put("p_q", trimmed)
        }
        return SupabaseClients.cfb.postgrest.rpc("mlb_pitcher_options", params).decodeList()
    }

    @Serializable private data class ConferenceTeamRow(@SerialName("team_name") val teamName: String, val conference: String? = null)
    @Serializable private data class CFBLogoRow(@SerialName("team_name") val teamName: String? = null, val logo: String? = null)
    @Serializable private data class MlbTeamRow(val team: String, @SerialName("team_name") val teamName: String? = null)
}

// Saved systems (CRUD + leaderboard) live in AnalysisSystemsService.kt.
