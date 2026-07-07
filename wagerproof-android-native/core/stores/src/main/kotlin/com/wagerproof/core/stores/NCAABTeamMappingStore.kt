package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.NCAABTeamMappingEntry
import com.wagerproof.core.models.serialization.FlexibleIntSerializer
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Port of iOS `NCAABTeamMappingStore.swift`.
 *
 * Session-scoped cache of `ncaab_team_mapping` rows (RN `useNCAABTeamMapping`
 * module-level cache + fetch promise): the first caller triggers a single
 * `select(...)`; subsequent callers reuse the in-memory indexes. Two index
 * keys per row — `teamranking_team_name` and `api_team_id` — to match RN's
 * substring fallback lookup. NCAAB tables live on the CFB/sports-data project
 * → `SupabaseClients.cfb`.
 */
@Stable
class NCAABTeamMappingStore {
    /** Keyed by trimmed `teamranking_team_name` (original case) + a lowercased alias. */
    var byName by mutableStateOf<Map<String, NCAABTeamMappingEntry>>(emptyMap()); private set

    /** Keyed by `api_team_id`. */
    var byApiTeamId by mutableStateOf<Map<Int, NCAABTeamMappingEntry>>(emptyMap()); private set
    var isLoaded by mutableStateOf(false); private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // In-flight job so concurrent callers don't kick off duplicate queries
    // (RN uses a module-level `fetchPromise` for the same reason).
    private var inflight: Job? = null

    fun close() = scope.cancel()

    /** Trigger a one-time fetch. Subsequent calls are no-ops once loaded. */
    suspend fun load() {
        if (isLoaded) return
        inflight?.let {
            it.join()
            return
        }
        val job = scope.launch { performLoad() }
        inflight = job
        job.join()
    }

    private suspend fun performLoad() {
        try {
            val cfb = SupabaseClients.cfb
            val rows = runCatching {
                cfb.from("ncaab_team_mapping")
                    .select(Columns.raw("api_team_id, espn_team_id, team_abbrev, teamranking_team_name"))
                    .decodeList<Row>()
            }.getOrDefault(emptyList())

            val nameIdx = HashMap<String, NCAABTeamMappingEntry>()
            val idIdx = HashMap<Int, NCAABTeamMappingEntry>()
            for (row in rows) {
                val logo = row.espnTeamId?.let { "https://a.espncdn.com/i/teamlogos/ncaa/500/$it.png" }
                val abbrev = row.teamAbbrev?.trim()?.takeIf { it.isNotEmpty() }
                val teamRankingName = row.teamRankingName?.trim()?.takeIf { it.isNotEmpty() }
                val entry = NCAABTeamMappingEntry(
                    apiTeamId = row.apiTeamId,
                    abbrev = abbrev,
                    logoUrl = logo,
                    teamRankingName = teamRankingName,
                )
                if (teamRankingName != null) {
                    nameIdx[teamRankingName] = entry
                    nameIdx[teamRankingName.lowercase()] = entry
                }
                idIdx[row.apiTeamId] = entry
            }
            byName = nameIdx
            byApiTeamId = idIdx
            isLoaded = true
        } finally {
            inflight = null
        }
    }

    /**
     * RN-equivalent name lookup: exact match first, then a length-gated
     * substring/contains fallback (≥6 chars) for cases like
     * "Central Arkansas" vs "Cent. Arkansas Bears".
     */
    fun lookup(teamName: String): NCAABTeamMappingEntry? {
        val trimmed = teamName.trim()
        if (trimmed.isEmpty()) return null
        (byName[trimmed] ?: byName[trimmed.lowercase()])?.let { return it }
        val lower = trimmed.lowercase()
        if (lower.length < 6) return null
        for ((key, info) in byName) {
            if (key != key.lowercase()) continue
            if (key.contains(lower) || lower.contains(key)) return info
        }
        return null
    }

    fun lookup(apiTeamId: Int): NCAABTeamMappingEntry? = byApiTeamId[apiTeamId]

    @Serializable
    private data class Row(
        @SerialName("api_team_id") val apiTeamId: Int,
        @Serializable(with = FlexibleIntSerializer::class)
        @SerialName("espn_team_id") val espnTeamId: Int? = null,
        @SerialName("team_abbrev") val teamAbbrev: String? = null,
        @SerialName("teamranking_team_name") val teamRankingName: String? = null,
    )
}
