package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.MlbPitcherOption
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MlbPitcherSearchTest {

    private val catalog = listOf(
        pitcher(1, "José Berríos", "TOR"),
        pitcher(2, "Blake Snell", "LAD"),
        pitcher(3, "Snell Jr., Bobby", "SD"),
        pitcher(4, "Tarik Skubal", "DET"),
        pitcher(5, "Framber Valdez", "HOU"),
        pitcher(6, "Josiah Gray", "WSH"),
    )

    @Test
    fun emptyQueryReturnsNothingInsteadOfDumpingTheCatalog() {
        assertTrue(MlbPitcherSearch.filter(catalog, "").isEmpty())
        assertTrue(MlbPitcherSearch.filter(catalog, "   ").isEmpty())
    }

    @Test
    fun accentsAndCaseAreFolded() {
        assertEquals(listOf("José Berríos"), MlbPitcherSearch.filter(catalog, "jose").map { it.name })
        assertEquals(listOf("José Berríos"), MlbPitcherSearch.filter(catalog, "BERRIOS").map { it.name })
    }

    @Test
    fun tokenPrefixMatchesOutrankMidTokenMatches() {
        // "Snell" starts a token in both names, so both score 0 and fall back to
        // alphabetical; "Josiah" only prefix-matches on "jos".
        assertEquals(
            listOf("Blake Snell", "Snell Jr., Bobby"),
            MlbPitcherSearch.filter(catalog, "snell").map { it.name },
        )
        assertEquals(
            listOf("José Berríos", "Josiah Gray"),
            MlbPitcherSearch.filter(catalog, "jos").map { it.name },
        )
    }

    @Test
    fun teamAbbreviationsAreSearchable() {
        assertEquals(listOf("Tarik Skubal"), MlbPitcherSearch.filter(catalog, "det").map { it.name })
    }

    @Test
    fun resultsAreCappedAtTheRequestedLimit() {
        val many = (1..100).map { pitcher(it, "Pitcher $it", "AAA") }
        assertEquals(5, MlbPitcherSearch.filter(many, "pitcher", limit = 5).size)
    }

    @Test
    fun subtitleShowsTeamAndHandednessWhenPresent() {
        assertEquals("TOR · RHP", MlbPitcherSearch.subtitle(catalog.first()))
        assertEquals("SD", MlbPitcherSearch.subtitle(MlbPitcherOption(9, "Some Guy", hand = null, team = "SD")))
        assertEquals("", MlbPitcherSearch.subtitle(MlbPitcherOption(9, "Some Guy")))
    }

    private fun pitcher(id: Int, name: String, team: String) =
        MlbPitcherOption(id = id, name = name, hand = "R", team = team)
}
