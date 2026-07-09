package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisBar
import com.wagerproof.core.models.HistoricalAnalysisBarOption
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class HistoricalAnalysisFilterBuilderTest {
    @Test
    fun favoriteSpreadUsesNegativeBoundsAndExcludesPickem() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
            spreadSide = "favorite"
            spreadMin = 0.0
            spreadMax = 7.5
        }

        val filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(HistoricalAnalysisSport.NFL, snapshot)

        assertEquals(-7.5, filters.getValue("spread_min").jsonPrimitive.double)
        assertEquals(-0.5, filters.getValue("spread_max").jsonPrimitive.double)
        assertFalse("abs_spread_min" in filters)
    }

    @Test
    fun moneylineBoundsAreNormalizedWhenEnteredBackwards() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
            betType = "fg_ml"
            mlMin = "+180"
            mlMax = "-120"
        }

        val filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(HistoricalAnalysisSport.NFL, snapshot)

        assertEquals(-120.0, filters.getValue("ml_min").jsonPrimitive.double)
        assertEquals(180.0, filters.getValue("ml_max").jsonPrimitive.double)
    }

    @Test
    fun multipleConferencesExpandToStableUniqueTeamOrFilter() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.CFB).apply {
            selectedConferences = listOf("SEC", "Big Ten")
        }

        val filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(
            HistoricalAnalysisSport.CFB,
            snapshot,
            mapOf("SEC" to listOf("Georgia", "Alabama"), "Big Ten" to listOf("Michigan", "Georgia")),
        )

        val teams = filters.getValue("team") as JsonArray
        assertEquals(listOf("Alabama", "Georgia", "Michigan"), teams.map { it.jsonPrimitive.content })
        assertFalse("conference" in filters)
    }

    @Test
    fun barsHideDegenerateSplitsAndAlreadyPinnedDirections() {
        val valid = HistoricalAnalysisBar(
            "home_away",
            listOf(option("home", 60), option("away", 40)),
        )
        val degenerate = HistoricalAnalysisBar(
            "fav_dog",
            listOf(option("favorite", 95), option("underdog", 5)),
        )
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply { side = "home" }

        assertTrue(HistoricalAnalysisFilterBuilder.nonDegenerateBars(listOf(valid, degenerate)).contains(valid))
        assertFalse(HistoricalAnalysisFilterBuilder.nonDegenerateBars(listOf(valid, degenerate)).contains(degenerate))
        assertTrue(HistoricalAnalysisFilterBuilder.shownBars(listOf(valid), snapshot).isEmpty())
    }

    private fun option(side: String, n: Int) = HistoricalAnalysisBarOption(side, n, n / 2, 50.0, 0.0)
}
