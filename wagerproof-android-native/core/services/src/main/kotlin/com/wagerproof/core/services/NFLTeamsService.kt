package com.wagerproof.core.services

import com.wagerproof.core.models.NFLTeamAssets
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Hydrates the `NFLTeamAssets` cache from the `nfl_teams` reference table
 * (CFB/research Supabase): canonical `team_abbr` + `logo_espn` per franchise.
 * Loaded once per process by whichever NFL surface fetches first; failures are
 * silent (cards fall back to the static identity map).
 */
object NFLTeamsService {

    // Mutex (not just a flag) so concurrent first-callers don't double-fetch —
    // the Swift actor got this serialization for free.
    private val mutex = Mutex()
    private var didLoad = false

    @Serializable
    private data class TeamRow(
        @SerialName("team_abbr") val teamAbbr: String,
        @SerialName("team_name") val teamName: String? = null,
        @SerialName("team_nick") val teamNick: String? = null,
        @SerialName("logo_espn") val logoEspn: String? = null,
    )

    suspend fun ensureLoaded() {
        mutex.withLock {
            if (didLoad) return
            val rows = runCatching {
                SupabaseClients.cfb
                    .from("nfl_teams")
                    .select(columns = Columns.raw("team_abbr, team_name, team_nick, logo_espn"))
                    .decodeList<TeamRow>()
            }.getOrNull() ?: return
            if (rows.isEmpty()) return

            didLoad = true
            NFLTeamAssets.install(
                rows.map {
                    NFLTeamAssets.Team(
                        abbr = it.teamAbbr,
                        name = it.teamName ?: it.teamAbbr,
                        nick = it.teamNick,
                        logoEspn = it.logoEspn,
                    )
                },
            )
        }
    }
}
