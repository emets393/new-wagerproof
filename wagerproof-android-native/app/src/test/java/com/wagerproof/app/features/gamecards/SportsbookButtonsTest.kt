package com.wagerproof.app.features.gamecards

import kotlin.test.Test
import kotlin.test.assertEquals

class SportsbookButtonsTest {

    @Test
    fun knownBooksGetTheirBrandNameNotTheTitlecasedKey() {
        val ordered = orderedBooks(
            setOf("fanduel", "draftkings", "pointsbetus", "wynnbet", "foxbet", "hardrockbet"),
        )
        assertEquals(
            listOf("DraftKings", "FanDuel", "PointsBet", "WynnBET", "FOX Bet", "Hard Rock Bet"),
            ordered.map { it.second },
        )
    }

    @Test
    fun orderIsTopBooksThenAdditionalThenSortedUnknownTail() {
        val ordered = orderedBooks(setOf("zebra", "betrivers", "betmgm", "acmebook"))
        assertEquals(listOf("betmgm", "betrivers", "acmebook", "zebra"), ordered.map { it.first })
        assertEquals(listOf("BetMGM", "BetRivers", "Acmebook", "Zebra"), ordered.map { it.second })
    }

    @Test
    fun originalKeyCasingIsPreservedSoTheBetslipLookupStillHits() {
        val ordered = orderedBooks(setOf("DraftKings"))
        assertEquals("DraftKings" to "DraftKings", ordered.single())
    }
}
