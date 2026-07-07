package com.wagerproof.core.services

import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.CFBTeamReference
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Hydrates the CFB team reference cache (`cfb_teams`) once per process. The
 * dry-run slate uses this for AP-rank rows, logos, conferences, and CFBD
 * colors. Silent failure — cards degrade to name-derived fallbacks.
 */
object CFBTeamsService {

    private val mutex = Mutex()
    private var didLoad = false

    @Serializable
    private data class TeamRow(
        @SerialName("team_name") val teamName: String,
        val abbr: String? = null,
        val conference: String? = null,
        val classification: String? = null,
        val color: String? = null,
        @SerialName("alt_color") val altColor: String? = null,
        val logo: String? = null,
        @SerialName("logo_dark") val logoDark: String? = null,
    )

    suspend fun ensureLoaded() {
        mutex.withLock {
            if (didLoad) return
            val rows = runCatching {
                SupabaseClients.cfb
                    .from("cfb_teams")
                    .select(
                        columns = Columns.raw(
                            "team_name, abbr, conference, classification, color, alt_color, logo, logo_dark",
                        ),
                    )
                    .decodeList<TeamRow>()
            }.getOrNull() ?: return
            if (rows.isEmpty()) return

            didLoad = true
            CFBTeamAssets.install(
                rows.map {
                    CFBTeamReference(
                        teamName = it.teamName,
                        abbr = it.abbr,
                        conference = it.conference,
                        classification = it.classification,
                        color = it.color,
                        altColor = it.altColor,
                        logo = it.logo,
                        logoDark = it.logoDark,
                    )
                },
            )
        }
    }
}
