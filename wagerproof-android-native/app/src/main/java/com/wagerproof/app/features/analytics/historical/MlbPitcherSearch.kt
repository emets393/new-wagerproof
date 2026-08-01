package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.MlbPitcherOption

/**
 * Local ranking for the MLB starter typeahead. Port of iOS
 * `MlbPitcherTypeahead.filterPitchers` — the catalog is fetched once and filtered
 * on device, so typing doesn't fire an RPC per keystroke.
 *
 * Pure object; unit-tested in MlbPitcherSearchTest.
 */
internal object MlbPitcherSearch {

    /**
     * Empty query returns nothing on purpose: an unprompted dump of 40 names
     * reads as noise under the search field.
     */
    fun filter(catalog: List<MlbPitcherOption>, query: String, limit: Int = 40): List<MlbPitcherOption> {
        val q = foldForSearch(query.trim())
        if (q.isEmpty()) return emptyList()
        return catalog
            .mapNotNull { pitcher ->
                val name = foldForSearch(pitcher.name)
                val team = pitcher.team?.let(::foldForSearch).orEmpty()
                if (!name.contains(q) && !team.contains(q)) return@mapNotNull null
                val tokens = name.split(TOKEN_BOUNDARY).filter(String::isNotEmpty)
                val score = when {
                    name.startsWith(q) || tokens.any { it.startsWith(q) } -> 0
                    tokens.any { it.contains(q) } -> 1
                    else -> 2
                }
                // Ties break on the FOLDED name so "José" sorts next to "Jos…"
                // rather than after every ASCII name (iOS uses a localized compare,
                // which collates é under e — a raw lowercase() compare does not).
                Ranked(pitcher, score, name)
            }
            .sortedWith(compareBy<Ranked>({ it.score }, { it.sortKey }))
            .take(limit)
            .map { it.pitcher }
    }

    fun subtitle(pitcher: MlbPitcherOption): String =
        listOfNotNull(pitcher.team, pitcher.hand?.let { "${it}HP" })
            .filter(String::isNotEmpty)
            .joinToString(" · ")

    private data class Ranked(val pitcher: MlbPitcherOption, val score: Int, val sortKey: String)

    private val TOKEN_BOUNDARY = Regex("[^\\p{L}\\p{N}]+")
}
