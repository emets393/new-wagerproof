package com.wagerproof.core.models

import java.util.Locale

/** Primary/secondary brand color hexes (Swift tuple `(primary, secondary)`). */
data class CFBTeamColorHex(val primary: String?, val secondary: String?)

/**
 * Process-wide cache of the `cfb_teams` reference table. CFB has 137 teams,
 * so cards resolve logos/colors from this cache instead of hardcoding a table.
 * iOS confines this to @MainActor; here an immutable snapshot swapped through
 * a @Volatile field gives the same install-once/read-anywhere semantics.
 */
object CFBTeamAssets {

    private data class Snapshot(
        val byName: Map<String, CFBTeamReference>,
        val nameByAlias: Map<String, String>,
    )

    @Volatile
    private var snapshot = Snapshot(emptyMap(), emptyMap())

    /** Normalized teamName → team reference. */
    val byName: Map<String, CFBTeamReference> get() = snapshot.byName

    val isLoaded: Boolean get() = snapshot.byName.isNotEmpty()

    fun install(teams: List<CFBTeamReference>) {
        val byName = teams.associateBy { normalize(it.teamName) }
        val aliases = mutableMapOf<String, String>()
        for (team in teams) {
            val key = normalize(team.teamName)
            aliases[key] = key
            val abbr = team.abbr
            if (!abbr.isNullOrEmpty()) {
                aliases[normalize(abbr)] = key
            }
        }
        snapshot = Snapshot(byName, aliases)
    }

    fun team(name: String): CFBTeamReference? {
        val snap = snapshot
        val key = normalize(name)
        snap.nameByAlias[key]?.let { canonical -> return snap.byName[canonical] }
        return snap.byName[key]
    }

    fun abbr(name: String): String =
        team(name)?.abbr?.uppercase(Locale.US) ?: fallbackAbbr(name)

    /** School name for display (e.g. "Kansas", "Texas Tech") — not the abbreviation. */
    fun displayName(name: String): String = team(name)?.teamName ?: name

    fun logo(name: String, dark: Boolean = false): String? {
        val team = team(name) ?: return null
        return if (dark) (team.logoDark ?: team.logo) else (team.logo ?: team.logoDark)
    }

    fun colorHex(name: String): CFBTeamColorHex {
        val team = team(name) ?: return CFBTeamColorHex(null, null)
        return CFBTeamColorHex(team.color, team.altColor)
    }

    fun normalize(value: String): String =
        value
            .trim()
            .lowercase(Locale.US)
            .replace(".", "")
            .replace("'", "")
            .replace("  ", " ")

    private fun fallbackAbbr(name: String): String {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return "CFB"
        return trimmed
            .split(" ")
            .mapNotNull { it.firstOrNull() }
            .take(4)
            .joinToString("") { it.toString().uppercase(Locale.US) }
    }
}
