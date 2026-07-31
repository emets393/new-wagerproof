package com.wagerproof.app.features.cfb

import androidx.compose.ui.graphics.Color
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Guards the two invariants that made the old `*_betting_lines` widget lie:
 * a one-row series must never be charted as "movement", and the opener has to
 * come from the slate's `fg_*_open`, not from the first (and only) snapshot.
 */
class LineMovementSeriesTest {

    private val away = Color(0xFF112233)
    private val home = Color(0xFF445566)

    private fun snap(ts: String, spreadHome: Double?, total: Double?) =
        LineMovementSnap(snapTs = ts, nBooks = 6, fgSpreadHome = spreadHome, fgTotal = total)

    private fun build(
        snaps: List<LineMovementSnap>,
        scalars: LineSlateScalars,
    ) = buildMovementSeries(snaps, scalars, "SEA", "SF", away, home)

    @Test
    fun singleSnapshotIsNotChartable() {
        val series = build(
            listOf(snap("2026-09-01T12:00:00Z", -3.5, 44.5)),
            LineSlateScalars(spreadOpen = -3.0, totalOpen = 44.0),
        )
        assertTrue(series.all { !it.chartable })
    }

    @Test
    fun repeatedIdenticalPricesAreNotChartable() {
        val series = build(
            listOf(
                snap("2026-09-01T12:00:00Z", -3.5, 44.5),
                snap("2026-09-01T13:00:00Z", -3.5, 44.5),
                snap("2026-09-01T14:00:00Z", -3.5, 44.5),
            ),
            LineSlateScalars(),
        )
        assertTrue(series.all { !it.chartable })
    }

    @Test
    fun twoDistinctValuesUnlockTheChart() {
        val series = build(
            listOf(
                snap("2026-09-01T12:00:00Z", -3.0, 44.5),
                snap("2026-09-01T13:00:00Z", -3.5, 44.5),
            ),
            LineSlateScalars(),
        )
        val (awaySpread, homeSpread, total) = series
        assertTrue(awaySpread.chartable)
        assertTrue(homeSpread.chartable)
        assertFalse(total.chartable, "total never moved")
    }

    @Test
    fun openerComesFromTheSlateAndMovementIsMeasuredAgainstIt() {
        val series = build(
            listOf(
                snap("2026-09-01T12:00:00Z", -3.0, 44.5),
                snap("2026-09-01T13:00:00Z", -4.5, 46.0),
            ),
            LineSlateScalars(spreadOpen = -2.5, totalOpen = 44.0),
        )
        val homeSpread = series[1]
        assertEquals(-2.5, homeSpread.open)
        assertEquals(-4.5, homeSpread.current)
        assertEquals(-2.0, homeSpread.change)
        assertTrue(homeSpread.isLive)

        // The away side is the home spread mirrored, opener included.
        val awaySpread = series[0]
        assertEquals(2.5, awaySpread.open)
        assertEquals(4.5, awaySpread.current)
    }

    @Test
    fun slateCloseStandsInWhenTheViewHasNoRowsAndIsFlaggedNotLive() {
        val series = build(
            emptyList(),
            LineSlateScalars(spreadOpen = -2.5, totalOpen = 44.0, spreadClose = -3.5, totalClose = 45.5),
        )
        val homeSpread = series[1]
        assertFalse(homeSpread.isLive)
        assertEquals(-3.5, homeSpread.current)
        assertFalse(homeSpread.chartable)
        // No delta against a stale reference — the header would otherwise
        // print "Movement −1.0" for a line nobody watched move.
        assertNull(homeSpread.change)

        val total = series[2]
        assertFalse(total.isLive)
        assertEquals(45.5, total.current)
        assertNull(total.change)
    }

    @Test
    fun nullSnapshotColumnsDoNotEnterTheSeries() {
        val series = build(
            listOf(
                snap("2026-09-01T12:00:00Z", -3.0, null),
                snap("2026-09-01T13:00:00Z", -3.5, null),
            ),
            LineSlateScalars(),
        )
        val total = series[2]
        assertTrue(total.values.isEmpty())
        assertNull(total.current)
        assertEquals(2, series[1].values.size)
    }
}
