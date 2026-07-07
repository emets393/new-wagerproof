package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Process-wide cache of the `nfl_teams` reference table (32 rows: abbr,
 * display name, `logo_espn` URL). Services hydrate it once per launch;
 * cards read it synchronously while building row models.
 *
 * iOS makes this a @MainActor static cache; here reads are lock-free — a
 * single @Volatile immutable snapshot is swapped whole on install(), so a
 * reader can never see a half-built alias map.
 *
 * Lookups normalize through `NFLTeams.abbr`, so any team string format
 * ("BUF", "Buffalo Bills", "Buffalo") resolves; misses fall back to the
 * static ESPN slug URL.
 */
object NFLTeamAssets {
    @Serializable
    data class Team(
        val abbr: String,
        val name: String,
        val nick: String? = null,
        @SerialName("logo_espn") val logoEspn: String? = null,
    )

    private data class Snapshot(
        val byAbbr: Map<String, Team>,
        /** Lowercased alias (abbr / full name / nickname) → table `team_abbr`. */
        val abbrByAlias: Map<String, String>,
    )

    @Volatile
    private var snapshot: Snapshot = Snapshot(emptyMap(), emptyMap())

    val byAbbr: Map<String, Team> get() = snapshot.byAbbr

    val isLoaded: Boolean get() = snapshot.byAbbr.isNotEmpty()

    fun install(teams: List<Team>) {
        val byAbbr = teams.associateBy { it.abbr.uppercase() }
        val aliases = buildMap {
            for (t in teams) {
                put(t.abbr.lowercase(), t.abbr)
                put(t.name.lowercase(), t.abbr)
                t.nick?.let { put(it.lowercase(), t.abbr) }
            }
        }
        snapshot = Snapshot(byAbbr, aliases)
    }

    /**
     * Table `team_abbr` for any team string format; falls back to the
     * static identity map when the table hasn't loaded or doesn't match.
     */
    fun abbr(team: String): String {
        snapshot.abbrByAlias[team.trim().lowercase()]?.let { return it }
        return NFLTeams.abbr(team)
    }

    /**
     * `logo_espn` URL for any team string format; null only when the team
     * can't be resolved to a franchise at all.
     */
    fun logo(team: String): String? {
        snapshot.byAbbr[abbr(team)]?.logoEspn?.let { return it }
        return NFLTeams.logoUrl(team)
    }

    /** Short display name (nickname) for matchup labels — e.g. "Cowboys". */
    fun nickname(team: String): String {
        val key = abbr(team).uppercase()
        val entry = snapshot.byAbbr[key]
        entry?.nick?.takeIf { it.isNotEmpty() }?.let { return it }
        entry?.name?.takeIf { it.isNotEmpty() }?.let { name ->
            return name.split(" ").lastOrNull { it.isNotEmpty() } ?: name
        }
        NFLTeams.mascot(team)?.let { return it }
        return NFLTeams.nickname(team)
    }
}
