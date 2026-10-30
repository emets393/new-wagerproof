package com.wagerproof.core.models

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SignalRoiTest {
    @Test
    fun readsASignedRoi() {
        assertEquals(52.7, SignalRoi.percent("+52.7% ROI")!!, 1e-9)
        assertEquals(-52.3, SignalRoi.percent("-52.3% ROI")!!, 1e-9)
        assertEquals(43.2, SignalRoi.percent("3-1 (75.0%) in 2026-27, +43.2% ROI")!!, 1e-9)
    }

    @Test
    fun averagesARoiRange() {
        assertEquals(13.5, SignalRoi.percent("+11-16% ROI")!!, 1e-9)
        assertEquals(13.5, SignalRoi.percent("58-61% / +11-16% ROI")!!, 1e-9)
    }

    @Test
    fun ignoresAHitRateThatIsNotRoi() {
        assertNull(SignalRoi.percent("190-134 (58.7%) at the closing line"))
        assertNull(SignalRoi.percent("no graded bets yet in 2026-27"))
    }

    @Test
    fun bestRoiOutranksALargerCount() {
        val hot = SignalBoardRank(bestRoi = 40.0, count = 1)
        val crowded = SignalBoardRank(bestRoi = 5.0, count = 6)
        assertTrue(GameListSort.signalsFirst(hot, crowded, anyRated = true) < 0)
    }

    @Test
    fun emptySignalsCompareEqual() {
        assertEquals(0, GameListSort.signalsFirst(SignalBoardRank.empty, SignalBoardRank.empty, false))
    }
}
