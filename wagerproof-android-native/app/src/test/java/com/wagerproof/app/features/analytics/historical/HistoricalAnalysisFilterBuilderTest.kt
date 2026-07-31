package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisBar
import com.wagerproof.core.models.HistoricalAnalysisBarOption
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.HistoricalAnalysisUISnapshotSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
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
    fun teamTotalMarketStillEmitsTheFullGameTotalFromItsOwnField() {
        // The game total (`lineMin/Max`) and the team-total line (`ttLineMin/Max`) are
        // independent cross-market dims — picking Team Total must not redirect the
        // game-total slider's value onto tt_min/tt_max (or vice versa).
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
            betType = "team_total"
            lineMin = 44.0
            ttLineMax = 24.0
        }

        val filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(HistoricalAnalysisSport.NFL, snapshot)

        assertEquals(44.0, filters.getValue("total_min").jsonPrimitive.double)
        assertEquals(24.0, filters.getValue("tt_max").jsonPrimitive.double)
        assertFalse("total_max" in filters)
        assertFalse("tt_min" in filters)
    }

    @Test
    fun mlbEmitsRunLineSideSeriesGameSetAndStarterEra() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
            betType = "rl"
            rlSide = "plus"
            seriesGames = listOf(3, 1)
            spEraMax = 3.5
            oppSpEraMin = 4.0
        }

        val filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(HistoricalAnalysisSport.MLB, snapshot)

        assertEquals("plus", filters.getValue("rl_side").jsonPrimitive.content)
        assertEquals(listOf(1, 3), (filters.getValue("series_game_in") as JsonArray).map { it.jsonPrimitive.int })
        assertEquals(3.5, filters.getValue("sp_era_max").jsonPrimitive.double)
        assertEquals(4.0, filters.getValue("opp_sp_era_min").jsonPrimitive.double)
        // Untouched ends of the ERA ranges must stay off the payload.
        assertFalse("sp_era_min" in filters)
        assertFalse("opp_sp_era_max" in filters)
    }

    @Test
    fun legacySeriesGameRangeMigratesIntoTheMultiSelect() {
        val restored = Json.decodeFromString(
            HistoricalAnalysisUISnapshotSerializer,
            """{"betType":"ml","seriesGameMin":2,"seriesGameMax":4}""",
        )

        assertEquals(listOf(2, 3, 4), restored.seriesGames)
        assertNull(restored.seriesGameMin)
        assertNull(restored.seriesGameMax)

        val filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(HistoricalAnalysisSport.MLB, restored)
        assertEquals(listOf(2, 3, 4), (filters.getValue("series_game_in") as JsonArray).map { it.jsonPrimitive.int })
        assertFalse("series_game_min" in filters)
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
