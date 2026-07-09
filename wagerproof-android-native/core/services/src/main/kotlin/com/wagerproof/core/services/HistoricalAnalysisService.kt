package com.wagerproof.core.services

import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSavedFilter
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
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
}

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

    override suspend fun fetchCFBLogos(): Map<String, String> = SupabaseClients.cfb
        .from("cfb_team_mapping")
        .select(columns = io.github.jan.supabase.postgrest.query.Columns.raw("api,logo_light"))
        .decodeList<CFBLogoRow>()
        .mapNotNull { row -> row.api?.let { api -> row.logoLight?.takeIf(String::isNotBlank)?.let { api to it } } }
        .toMap()

    @Serializable private data class ConferenceTeamRow(@SerialName("team_name") val teamName: String, val conference: String? = null)
    @Serializable private data class CFBLogoRow(val api: String? = null, @SerialName("logo_light") val logoLight: String? = null)
}

object HistoricalAnalysisSavedFiltersService {
    const val MAX_PER_USER = 25

    suspend fun fetch(sport: HistoricalAnalysisSport, userId: String): List<HistoricalAnalysisSavedFilter> =
        SupabaseClients.main.from(sport.savedFiltersTable).select {
            filter { eq("user_id", userId) }
            order("created_at", Order.DESCENDING)
        }.decodeList()

    suspend fun save(
        sport: HistoricalAnalysisSport,
        userId: String,
        name: String,
        betType: String,
        snapshot: HistoricalAnalysisUISnapshot,
    ) {
        SupabaseClients.main.from(sport.savedFiltersTable).insert(
            SavedFilterInsert(userId, name, betType, snapshot),
        )
    }

    suspend fun delete(sport: HistoricalAnalysisSport, id: String) {
        SupabaseClients.main.from(sport.savedFiltersTable).delete { filter { eq("id", id) } }
    }

    @Serializable
    private data class SavedFilterInsert(
        @SerialName("user_id") val userId: String,
        val name: String,
        @SerialName("bet_type") val betType: String,
        val filters: HistoricalAnalysisUISnapshot,
    )
}
