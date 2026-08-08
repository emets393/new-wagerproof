package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Pure bits of the Save System flow: draft side mapping, error copy, save toast. */
class SaveSystemFlowLogicTest {

    @Test
    fun favoriteUnderdogLandsOnTheMarketsOwnField() {
        val spread = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL)
            .also { it.betType = "fg_spread" }
            .withSystemFavDog("underdog")
        // Football spread markets carry their own side field…
        assertEquals("underdog", spread.spreadSide)
        assertEquals("any", spread.favDog)

        val moneyline = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL)
            .also { it.betType = "fg_ml" }
            .withSystemFavDog("favorite")
        // …everything else uses the moneyline fav/dog split.
        assertEquals("favorite", moneyline.favDog)
        assertEquals("any", moneyline.spreadSide)

        val runline = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
            .also { it.betType = "rl" }
            .withSystemFavDog("favorite")
        assertEquals("favorite", runline.favDog)
    }

    @Test
    fun draftEditsNeverMutateTheSnapshotTheyCameFrom() {
        val original = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
            .also { it.betType = "ml" }
        original.withSystemFavDog("favorite")
        // Cancelling the sheet must leave the live Trends filters untouched.
        assertEquals("any", original.favDog)
    }

    @Test
    fun saveErrorsBecomeActionableSentences() {
        assertEquals(
            "Couldn't save — sign in again and try once more.",
            userFacingSaveError(RuntimeException("new row violates row-level security policy")),
        )
        assertEquals(
            "Couldn't save — your session expired. Sign in again.",
            userFacingSaveError(RuntimeException("JWT expired")),
        )
        assertEquals(
            "Couldn't save — try a different name.",
            userFacingSaveError(RuntimeException("duplicate key value violates unique constraint")),
        )
        assertEquals(
            "Couldn't save — check your connection and try again.",
            userFacingSaveError(RuntimeException("network is unreachable")),
        )
        assertEquals("Couldn't save — try again.", userFacingSaveError(RuntimeException("")))
        assertEquals("Couldn't save — boom", userFacingSaveError(RuntimeException("boom")))
    }

    @Test
    fun longServerErrorsAreTruncatedNotDumped() {
        val message = userFacingSaveError(RuntimeException("x".repeat(400)))
        assertTrue(message.length < 200, "expected a truncated message, got ${message.length} chars")
        assertTrue(message.endsWith("…"))
    }

    @Test
    fun savedToastTellsSharedUsersWhyTheBoardIsStillEmpty() {
        assertEquals("Saved — 1 system in My Systems.", systemSavedMessage(shared = false, count = 1))
        assertEquals("Saved — 3 systems in My Systems.", systemSavedMessage(shared = false, count = 3))
        assertTrue(systemSavedMessage(shared = true, count = 2).contains("10 matching games"))
    }
}
