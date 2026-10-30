package com.wagerproof.core.services

import com.wagerproof.core.models.NCAABTeamAssets
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Loads every `ncaab_team_mapping` row once so agent tickets can show the
 * same ESPN mark and `team_abbrev` the college basketball game cards use.
 */
object NCAABTeamIdentityService {
    private val mutex = Mutex()
    private var didLoad = false

    @Serializable
    private data class Row(
        @SerialName("espn_team_id") @Serializable(with = FlexibleStringSerializer::class) val espnTeamId: String? = null,
        @SerialName("team_abbrev") val teamAbbrev: String? = null,
        @SerialName("teamranking_team_name") val teamRankingName: String? = null,
    )

    suspend fun ensureLoaded() {
        mutex.withLock {
            if (didLoad) return
            val rows = runCatching {
                SupabaseClients.cfb
                    .from("ncaab_team_mapping")
                    .select(columns = Columns.raw("espn_team_id, team_abbrev, teamranking_team_name"))
                    .decodeList<Row>()
            }.getOrElse { return }
            didLoad = true
            val logos = HashMap<String, String>()
            val abbrevs = HashMap<String, String>()
            for (row in rows) {
                val name = row.teamRankingName?.trim().orEmpty()
                val abbrev = row.teamAbbrev?.trim().orEmpty()
                val espnId = row.espnTeamId?.toIntOrNull() ?: row.espnTeamId?.toDoubleOrNull()?.toInt()
                val logo = espnId?.let { "https://a.espncdn.com/i/teamlogos/ncaa/500/$it.png" }
                if (name.isNotEmpty()) {
                    if (logo != null) logos[name] = logo
                    if (abbrev.isNotEmpty()) abbrevs[name] = abbrev
                }
                if (abbrev.isNotEmpty()) {
                    if (logo != null) logos[abbrev] = logo
                    abbrevs[abbrev] = abbrev
                }
            }
            NCAABTeamAssets.install(logos, abbrevs)
        }
    }
}
