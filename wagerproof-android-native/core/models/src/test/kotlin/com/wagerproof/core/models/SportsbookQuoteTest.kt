package com.wagerproof.core.models

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SportsbookQuoteTest {
    private val board = SportsbookMarketQuotes(
        capturedAt = "2026-08-15T12:00:00Z",
        quotes = listOf(
            SportsbookQuote("draftkings", "DraftKings", -3.5, -110),
            SportsbookQuote("fanduel", "FanDuel", -3.0, -108),
            SportsbookQuote("betmgm", "BetMGM", -3.5, -115),
        ),
    )

    @Test
    fun `leads with the overall best when the user has not narrowed books`() {
        assertEquals("draftkings", board.preferred(emptySet())?.bookKey)
    }

    @Test
    fun `picks the first matching book in the already-sorted board`() {
        assertEquals("fanduel", board.preferred(setOf("fanduel", "betmgm"))?.bookKey)
    }

    @Test
    fun `falls back to the overall best when none of the user books price the market`() {
        assertEquals("draftkings", board.preferred(setOf("bovada"))?.bookKey)
        assertFalse(board.isFromSelection(setOf("bovada")))
        assertTrue(board.isFromSelection(setOf("fanduel")))
    }

    @Test
    fun `drops unknown keys and sorts on write`() {
        assertEquals("draftkings,fanduel", SportsbookPreference.encode(setOf("fanduel", "draftkings")))
        assertEquals(
            setOf("draftkings", "fanduel"),
            SportsbookPreference.decode("fanduel,nope,draftkings"),
        )
        assertTrue(SportsbookPreference.decode("").isEmpty())
    }

    @Test
    fun `sorts OVER by the lowest total`() {
        val odds = SportsbookGameOdds(
            capturedAt = "2026-08-15T12:00:00Z",
            rows = listOf(
                SportsbookBookRow("draftkings", totalPoint = 47.5, totalOverPrice = -110.0, totalUnderPrice = -110.0),
                SportsbookBookRow("fanduel", totalPoint = 47.0, totalOverPrice = -105.0, totalUnderPrice = -115.0),
            ),
        )
        assertEquals("fanduel", odds.quotes(SportsbookMarket.Total(isOver = true)).quotes.first().bookKey)
        assertEquals("draftkings", odds.quotes(SportsbookMarket.Total(isOver = false)).quotes.first().bookKey)
    }

    @Test
    fun `keeps the four ambiguous-city clubs intact`() {
        assertEquals("LA Chargers", NflSportsbookCityNames.cityName("Los Angeles Chargers"))
        assertEquals("NY Giants", NflSportsbookCityNames.cityName("New York Giants"))
        assertEquals("Kansas City", NflSportsbookCityNames.cityName("Kansas City Chiefs"))
    }
}

class SportsbookTeamAliasesTest {
    @Test
    fun `covers the full reference catalog`() {
        assertTrue(CFBSportsbookTeamAliases.supportedAliasCount >= 139)
    }

    @Test
    fun `resolves ordinary programs by exact alias`() {
        val examples = listOf(
            "TCU Horned Frogs" to "TCU",
            "North Carolina Tar Heels" to "North Carolina",
            "NC State Wolfpack" to "NC State",
            "Mississippi State Bulldogs" to "Mississippi State",
            "Maryland Terrapins" to "Maryland",
            "North Dakota State Bison" to "North Dakota State",
        )
        for ((odds, canonical) in examples) {
            assertTrue(CFBSportsbookTeamAliases.matches(odds, canonical), "Expected $odds to resolve to $canonical")
        }
    }

    @Test
    fun `resolves non-prefix aliases explicitly`() {
        val examples = listOf(
            "Southern California Trojans" to "USC",
            "Mississippi Rebels" to "Ole Miss",
            "UMass Minutemen" to "Massachusetts",
            "Hawaii Rainbow Warriors" to "Hawai'i",
            "San Jose State Spartans" to "San José State",
            "Sam Houston State Bearkats" to "Sam Houston",
            "Southern Mississippi Golden Eagles" to "Southern Miss",
            "Appalachian State Mountaineers" to "App State",
        )
        for ((odds, canonical) in examples) {
            assertEquals(canonical, CFBSportsbookTeamAliases.canonicalName(odds, listOf(canonical)))
        }
    }

    @Test
    fun `does not let Miami programs cross-match`() {
        val candidates = listOf("Miami", "Miami (OH)")
        assertEquals("Miami", CFBSportsbookTeamAliases.canonicalName("Miami Hurricanes", candidates))
        assertEquals("Miami (OH)", CFBSportsbookTeamAliases.canonicalName("Miami (OH) RedHawks", candidates))
        assertEquals("Miami (OH)", CFBSportsbookTeamAliases.canonicalName("Miami RedHawks", candidates))
    }

    @Test
    fun `never falls back fuzzily for an unknown school`() {
        assertNull(
            CFBSportsbookTeamAliases.canonicalName(
                "Another State Wildcats",
                listOf("Arizona State", "Kansas State", "Ohio State"),
            ),
        )
        assertNull(CFBSportsbookTeamAliases.canonicalName("North Carolina A&T Aggies", listOf("North Carolina")))
        assertNull(CFBSportsbookTeamAliases.canonicalName("Tennessee State Tigers", listOf("Tennessee")))
    }
}
