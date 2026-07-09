package com.wagerproof.app.features.gamecards

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class GameCardFormattingTest {

    @Test
    fun moneylineAndSpreadMatchIosAsciiFormatting() {
        assertEquals("+150", GameCardFormatting.formatMoneyline(150))
        assertEquals("-180", GameCardFormatting.formatMoneyline(-180))
        assertEquals("—", GameCardFormatting.formatMoneyline(null))
        assertEquals("+2.5", GameCardFormatting.formatSpread(2.5))
        assertEquals("-3", GameCardFormatting.formatSpread(-3.0))
    }

    @Test
    fun naiveDatabaseTimestampIsParsedAsUtcBeforeEtDisplay() {
        assertEquals("3:00 PM ET", GameCardFormatting.convertTimeToEST("2026-01-09 20:00:00"))
    }

    @Test
    fun initialsMatchIosFirstTwoWordsAndSingleWordFallback() {
        assertEquals("LA", TeamInitials.from("Los Angeles Lakers"))
        assertEquals("BOS", TeamInitials.from("Boston"))
    }

    @Test
    fun mlEdgeKeepsTheBetterSideEvenWhenBothSidesAreNegative() {
        val edge = GameEdgeMath.mlEdge(
            modelHomeProb = 0.50,
            homeMl = -140,
            awayMl = -140,
            homeAbbr = "HOME",
            awayAbbr = "AWAY",
        )
        assertNotNull(edge)
        assertEquals("HOME", edge.abbr)
        assertEquals(-8.333, edge.edgePoints, absoluteTolerance = 0.001)
    }

    @Test
    fun ouEdgeDoesNotFabricateDeltaOrProbability() {
        val probabilityOnly = GameEdgeMath.ouEdge(
            modelFairTotal = null,
            marketLine = null,
            ouResultProb = 0.62,
        )
        assertNotNull(probabilityOnly)
        assertNull(probabilityOnly.delta)
        assertEquals(0.62, probabilityOnly.probability)

        val fairTotalOnly = GameEdgeMath.ouEdge(
            modelFairTotal = 48.5,
            marketLine = 45.0,
            ouResultProb = null,
        )
        assertNotNull(fairTotalOnly)
        assertEquals(3.5, fairTotalOnly.delta)
        assertNull(fairTotalOnly.probability)
    }
}
