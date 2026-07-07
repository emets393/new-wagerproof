package com.wagerproof.core.models

/**
 * Team-name match/rank shared by search game results. MLB gets mascot/city
 * aware matching via a local token splitter (mascot = trailing token(s),
 * city = leading tokens; `twoTokenMascots` covers "red sox" / "white sox" /
 * "blue jays" — keep in sync with the canonical MLB team map). All other
 * sports fall back to the generic substring + initials matcher.
 */
object SearchTeamAliases {
    data class Match(val score: Int)

    /**
     * Rank table: 100 exact abbr · 90 exact mascot/city token · 70 prefix of
     * mascot/city/full name (query >= 3 chars) · 40 substring of full name ·
     * 30 initials.
     */
    fun match(query: String, teamName: String, abbr: String?, sport: SearchStoreSport): Match? {
        val q = query.trim().lowercase()
        if (q.isEmpty() || teamName.isEmpty()) return null

        if (!abbr.isNullOrEmpty() && abbr.lowercase() == q) {
            return Match(score = 100)
        }

        val full = teamName.lowercase()
        val (city, mascot) = split(teamName, sport)

        if (q == mascot || (city.isNotEmpty() && q == city)) {
            return Match(score = 90)
        }
        if (q.length >= 3) {
            if (mascot.startsWith(q) || (city.isNotEmpty() && city.startsWith(q)) || full.startsWith(q)) {
                return Match(score = 70)
            }
        }
        if (full.contains(q)) {
            return Match(score = 40)
        }
        val initials = teamName
            .split(" ")
            .filter { it.isNotEmpty() }
            .mapNotNull { it.firstOrNull()?.toString()?.lowercase() }
            .joinToString("")
        if (initials.isNotEmpty() && initials.contains(q)) {
            return Match(score = 30)
        }
        return null
    }

    // Two-token MLB mascots — "boston red sox" splits city "boston",
    // mascot "red sox", not "sox".
    private val twoTokenMascots: Set<String> = setOf("red sox", "white sox", "blue jays")

    private fun split(teamName: String, sport: SearchStoreSport): Pair<String, String> {
        val tokens = teamName.lowercase()
            .split(" ")
            .filter { it.isNotEmpty() }
        if (tokens.size < 2) return "" to (tokens.firstOrNull() ?: "")
        if (sport == SearchStoreSport.MLB) {
            val lastTwo = tokens.takeLast(2).joinToString(" ")
            if (lastTwo in twoTokenMascots) {
                return tokens.dropLast(2).joinToString(" ") to lastTwo
            }
        }
        return tokens.dropLast(1).joinToString(" ") to tokens.last()
    }
}

/** Sport key mirrored out of the search store so this matcher stays store-independent. */
enum class SearchStoreSport(val raw: String) {
    NFL("nfl"),
    CFB("cfb"),
    NBA("nba"),
    NCAAB("ncaab"),
    MLB("mlb"),
}
