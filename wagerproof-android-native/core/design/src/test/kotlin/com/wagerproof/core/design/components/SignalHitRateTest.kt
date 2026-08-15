package com.wagerproof.core.design.components

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `typical_hit` is hand-written prose, so the parser is the piece most likely to
 * silently misreport a signal. Keep these cases in step with `parseHitRate` on
 * web (`signals/signals.test.ts`) and `SignalHitRateParser` on iOS — the same
 * string must produce the same percentage on all three platforms.
 */
class SignalHitRateTest {

    @Test
    fun `reads a plain percentage`() {
        assertEquals(0.58, SignalHitRate.fraction("58%")!!, 1e-9)
        assertEquals(0.585, SignalHitRate.fraction("58.5%")!!, 1e-9)
    }

    @Test
    fun `averages a true range`() {
        assertEquals(0.585, SignalHitRate.fraction("57-60%")!!, 1e-9)
        assertEquals(0.585, SignalHitRate.fraction("57 – 60 %")!!, 1e-9)
    }

    @Test
    fun `ignores years and sample sizes that are not percentages`() {
        // The regression this exists for: a naive scrape averaged 61 and 1 out
        // of the trailing "(2024-25, n=83)" and rendered a 61% signal as 31%.
        assertEquals(0.61, SignalHitRate.fraction("~61% vs open wk1 (2024-25, n=83 — tracking)")!!, 1e-9)
        assertEquals(0.54, SignalHitRate.fraction("54% ATS since 2019, n=412")!!, 1e-9)
    }

    @Test
    fun `takes a real range even when other numbers follow`() {
        assertEquals(0.59, SignalHitRate.fraction("57-61% of openers (2022 sample)")!!, 1e-9)
    }

    @Test
    fun `returns null when there is no percentage to chart`() {
        assertNull(SignalHitRate.fraction("tracking only"))
        assertNull(SignalHitRate.fraction(""))
        assertNull(SignalHitRate.fraction(null))
    }

    @Test
    fun `rejects out-of-range values rather than charting nonsense`() {
        assertNull(SignalHitRate.fraction("180%"))
        assertNull(SignalHitRate.fraction("0%"))
    }

    @Test
    fun `keeps the default band for ordinary rates`() {
        val w = SignalHitRate.window(0.58)
        assertEquals(0.35, w.start, 1e-9)
        assertEquals(0.70, w.endInclusive, 1e-9)
    }

    @Test
    fun `widens rather than clamping an extreme rate onto the edge`() {
        assertEquals(0.27, SignalHitRate.window(0.31).start, 1e-9)
        assertEquals(0.86, SignalHitRate.window(0.82).endInclusive, 1e-9)
    }

    @Test
    fun `leaves every value strictly inside the axis`() {
        for (rate in listOf(0.05, 0.31, 0.524, 0.61, 0.95)) {
            val f = SignalHitRate.position(rate, SignalHitRate.window(rate))
            assertTrue(f > 0.0, "rate $rate pinned to the left edge")
            assertTrue(f < 1.0, "rate $rate pinned to the right edge")
        }
    }

    @Test
    fun `puts break-even left of a winning rate and right of a losing one`() {
        val win = SignalHitRate.window(0.61)
        assertTrue(
            SignalHitRate.position(SIGNAL_BREAK_EVEN_RATE, win) < SignalHitRate.position(0.61, win)
        )

        val lose = SignalHitRate.window(0.44)
        assertTrue(
            SignalHitRate.position(SIGNAL_BREAK_EVEN_RATE, lose) > SignalHitRate.position(0.44, lose)
        )
    }
}
