package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.AnalysisSystemCopy
import com.wagerproof.core.models.AnalysisSystemLast10
import com.wagerproof.core.models.AnalysisSystemRecord
import com.wagerproof.core.models.AnalysisSystemStreak
import com.wagerproof.core.models.AnalysisSystemVerdict
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.SystemSampleBadge
import com.wagerproof.core.models.SystemTemperature
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Plain-English systems copy + the fire/ice thresholds. These strings are the
 * product's promise to the user ("2-1 since you saved"), and the thresholds must
 * stay identical across iOS, web and Android or the same system reads hot on one
 * platform and neutral on another.
 */
class AnalysisSystemCopyTest {

    private fun record(n: Int, wins: Int, losses: Int, pushes: Int = 0) =
        AnalysisSystemRecord(n = n, wins = wins, losses = losses, pushes = pushes)

    @Test
    fun verdictLabelsNeverLeakRawValues() {
        assertEquals("Bets the Over", AnalysisSystemCopy.verdictLabel(AnalysisSystemVerdict.OVER))
        assertEquals("Bets the Under", AnalysisSystemCopy.verdictLabel(AnalysisSystemVerdict.UNDER))
        assertEquals("Bets ON matching teams", AnalysisSystemCopy.verdictLabel(AnalysisSystemVerdict.TEAM))
        assertEquals("Fades matching teams", AnalysisSystemCopy.verdictLabel(AnalysisSystemVerdict.FADE))
        assertEquals(
            "Filters only (save again to track as a System)",
            AnalysisSystemCopy.verdictLabel(null),
        )
    }

    @Test
    fun betPhraseAndSideWordReadAsSentenceFragments() {
        assertEquals("against these teams", AnalysisSystemCopy.betPhrase(AnalysisSystemVerdict.FADE))
        assertEquals("the Over", AnalysisSystemCopy.betPhrase(AnalysisSystemVerdict.OVER))
        assertEquals("against matching teams", AnalysisSystemCopy.sideWord(AnalysisSystemVerdict.FADE))
        assertEquals("", AnalysisSystemCopy.sideWord(null))
    }

    @Test
    fun sinceSavedDistinguishesNoDataFromZeroZero() {
        assertEquals("Waiting on matching games", AnalysisSystemCopy.sinceSavedLabel(null))
        assertEquals("0-0 so far", AnalysisSystemCopy.sinceSavedLabel(record(0, 0, 0)))
        assertEquals("2-1 since you saved", AnalysisSystemCopy.sinceSavedLabel(record(3, 2, 1)))
    }

    @Test
    fun recordTextAppendsPushesOnlyWhenThereAreSome() {
        assertEquals("—", AnalysisSystemCopy.recordText(null))
        assertEquals("0-0 so far", AnalysisSystemCopy.recordText(record(0, 0, 0)))
        assertEquals("7-3", AnalysisSystemCopy.recordText(record(10, 7, 3)))
        assertEquals("7-3-1", AnalysisSystemCopy.recordText(record(11, 7, 3, pushes = 1)))
    }

    @Test
    fun sampleBadgeTiersMatchTheProductThresholds() {
        assertNull(AnalysisSystemCopy.sampleBadge(null))
        assertNull(AnalysisSystemCopy.sampleBadge(9))
        assertEquals(SystemSampleBadge.EARLY, AnalysisSystemCopy.sampleBadge(10))
        assertEquals(SystemSampleBadge.EARLY, AnalysisSystemCopy.sampleBadge(29))
        assertEquals(SystemSampleBadge.ESTABLISHED, AnalysisSystemCopy.sampleBadge(30))
        assertEquals(SystemSampleBadge.ESTABLISHED, AnalysisSystemCopy.sampleBadge(99))
        assertEquals(SystemSampleBadge.PROVEN, AnalysisSystemCopy.sampleBadge(100))
    }

    @Test
    fun signedNumberUsesTypographicMinusAndDropsTrailingZero() {
        assertEquals("—", AnalysisSystemCopy.signedNumber(null))
        assertEquals("+3", AnalysisSystemCopy.signedNumber(3.0))
        assertEquals("+3.4", AnalysisSystemCopy.signedNumber(3.4))
        assertEquals("−2.5", AnalysisSystemCopy.signedNumber(-2.5))
        assertEquals("+0", AnalysisSystemCopy.signedNumber(0.0))
    }

    @Test
    fun streakOutranksLastTenWhenBothSpeak() {
        val coldLast10 = AnalysisSystemLast10(n = 10, wins = 2, results = List(10) { 0 })
        val hotStreak = AnalysisSystemStreak(kind = "win", len = 4)
        assertEquals(SystemTemperature.FIRE, AnalysisSystemCopy.temperature(hotStreak, coldLast10))
    }

    @Test
    fun temperatureThresholds() {
        assertTrue(AnalysisSystemCopy.isHotStreak(AnalysisSystemStreak("win", 3)))
        assertFalse(AnalysisSystemCopy.isHotStreak(AnalysisSystemStreak("win", 2)))
        assertTrue(AnalysisSystemCopy.isColdStreak(AnalysisSystemStreak("loss", 3)))
        assertFalse(AnalysisSystemCopy.isColdStreak(AnalysisSystemStreak("win", 9)))

        assertTrue(AnalysisSystemCopy.isHotLast10(AnalysisSystemLast10(10, 7)))
        assertFalse(AnalysisSystemCopy.isHotLast10(AnalysisSystemLast10(10, 6)))
        // A 9-game window never qualifies — n must be a full 10.
        assertFalse(AnalysisSystemCopy.isHotLast10(AnalysisSystemLast10(9, 9)))
        assertTrue(AnalysisSystemCopy.isColdLast10(AnalysisSystemLast10(10, 3)))
        assertFalse(AnalysisSystemCopy.isColdLast10(AnalysisSystemLast10(10, 4)))

        assertEquals(SystemTemperature.NEUTRAL, AnalysisSystemCopy.temperature(null, null))
    }

    @Test
    fun marketClassificationIsPerSport() {
        assertTrue(AnalysisSystemCopy.isTotalMarket("total", HistoricalAnalysisSport.MLB))
        assertTrue(AnalysisSystemCopy.isTotalMarket("f5_total", HistoricalAnalysisSport.MLB))
        assertFalse(AnalysisSystemCopy.isTotalMarket("fg_total", HistoricalAnalysisSport.MLB))

        assertTrue(AnalysisSystemCopy.isTotalMarket("team_total", HistoricalAnalysisSport.NFL))
        assertTrue(AnalysisSystemCopy.isSideMarket("fg_spread", HistoricalAnalysisSport.CFB))
        assertFalse(AnalysisSystemCopy.isSideMarket("fg_total", HistoricalAnalysisSport.CFB))
        assertTrue(AnalysisSystemCopy.isSideMarket("rl", HistoricalAnalysisSport.MLB))
    }

    @Test
    fun symmetricSideDrivesTheForcedSideChoice() {
        val sport = HistoricalAnalysisSport.MLB
        val untouched = HistoricalAnalysisUISnapshot.defaults(sport).also { it.betType = "ml" }
        // No team-defining filter → the save flow must force Home/Away/Fav/Dog.
        assertTrue(AnalysisSystemCopy.isSideSymmetric(untouched, sport))

        val homeOnly = HistoricalAnalysisUISnapshot.defaults(sport).also {
            it.betType = "ml"
            it.side = "home"
        }
        assertFalse(AnalysisSystemCopy.isSideSymmetric(homeOnly, sport))
    }
}
