package com.wagerproof.app.features.agents

import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.agents.components.TOOL_STACK_IDEAL_PEEK
import com.wagerproof.app.features.agents.components.TOOL_STACK_MIN_PEEK
import com.wagerproof.app.features.agents.components.elapsedSeconds
import com.wagerproof.app.features.agents.components.formatElapsed
import com.wagerproof.app.features.agents.components.parseRunStartMillis
import com.wagerproof.app.features.agents.components.toolActivityPeek
import com.wagerproof.app.features.agents.components.toolActivityVisibleIndices
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Pure-logic cover for the live generation card's progress readouts (AND-084):
 * the tool-activity fan geometry and the elapsed-run timer.
 */
class GenerationProgressTest {

    // --- Tool activity fan -------------------------------------------------

    @Test
    fun noTicketsUntilTheFirstToolCallLands() {
        assertEquals(emptyList<Int>(), toolActivityVisibleIndices(0))
        assertEquals(emptyList<Int>(), toolActivityVisibleIndices(-1))
        assertEquals(listOf(0), toolActivityVisibleIndices(1))
    }

    @Test
    fun oldestTicketsFallOffOnceTheDeckExceedsMaxVisible() {
        // 7 visible is the cap; at 10 cumulative calls the window is the newest 7.
        assertEquals((0..6).toList(), toolActivityVisibleIndices(7))
        assertEquals((3..9).toList(), toolActivityVisibleIndices(10))
        assertEquals(7, toolActivityVisibleIndices(50).size)
    }

    @Test
    fun singleTicketHasNoFanOffset() {
        assertEquals(0.dp, toolActivityPeek(visibleCount = 1, containerWidth = 360.dp, cardWidth = 178.dp))
        assertEquals(0.dp, toolActivityPeek(visibleCount = 0, containerWidth = 360.dp, cardWidth = 178.dp))
    }

    @Test
    fun growingDeckUsesTheComfortablePeekUntilItReachesTheTrailingEdge() {
        // travel = 360 - 178 = 182; two tickets → fillPeek 182 > ideal 96, so ideal wins.
        assertEquals(TOOL_STACK_IDEAL_PEEK, toolActivityPeek(visibleCount = 2, containerWidth = 360.dp, cardWidth = 178.dp))
    }

    @Test
    fun fullDeckTightensToExactlyFillTheWidth() {
        // travel = 182 across 6 gaps → 30.33dp, below ideal but above the floor.
        val peek = toolActivityPeek(visibleCount = 7, containerWidth = 360.dp, cardWidth = 178.dp)
        assertEquals(182f / 6f, peek.value, 0.001f)
    }

    @Test
    fun overlapNeverTightensPastTheReadableFloor() {
        // A narrow container would compute ~13dp; the floor keeps a visible sliver.
        assertEquals(TOOL_STACK_MIN_PEEK, toolActivityPeek(visibleCount = 7, containerWidth = 260.dp, cardWidth = 178.dp))
        // Card wider than the container → travel clamps to 0, floor still applies.
        assertEquals(TOOL_STACK_MIN_PEEK, toolActivityPeek(visibleCount = 3, containerWidth = 120.dp, cardWidth = 178.dp))
    }

    // --- Elapsed timer -----------------------------------------------------

    @Test
    fun runStartParsesBothIsoShapesTriggerEmits() {
        assertEquals(1_767_225_600_000L, parseRunStartMillis("2026-01-01T00:00:00Z"))
        assertEquals(1_767_225_600_000L, parseRunStartMillis("2026-01-01T00:00:00.000Z"))
        // Offset form (OffsetDateTime path): 05:00+05:00 is the same instant as 00:00Z.
        assertEquals(1_767_225_600_000L, parseRunStartMillis("2026-01-01T05:00:00+05:00"))
    }

    @Test
    fun unparseableRunStartFallsBackRatherThanThrowing() {
        assertNull(parseRunStartMillis(null))
        assertNull(parseRunStartMillis(""))
        assertNull(parseRunStartMillis("   "))
        assertNull(parseRunStartMillis("not a timestamp"))
        assertNull(parseRunStartMillis("2026-01-01"))
    }

    @Test
    fun elapsedCountsForwardFromTheRunStart() {
        assertEquals(0.0, elapsedSeconds(1_000L, 1_000L), 0.0001)
        assertEquals(1.5, elapsedSeconds(1_000L, 2_500L), 0.0001)
        assertEquals(125.4, elapsedSeconds(0L, 125_400L), 0.0001)
    }

    @Test
    fun clockSkewNeverShowsNegativeTime() {
        // A server startedAt slightly ahead of the device clock must read 0.0s, not -2.0s.
        assertEquals(0.0, elapsedSeconds(originMillis = 5_000L, nowMillis = 3_000L), 0.0001)
    }

    @Test
    fun elapsedIsZeroPaddedToAStableWidth() {
        assertEquals("00.0s", formatElapsed(0.0))
        assertEquals("07.4s", formatElapsed(7.42))
        assertEquals("119.9s", formatElapsed(119.94))
        // Rounds, so the readout never disagrees with itself by a tenth.
        assertEquals("08.0s", formatElapsed(7.96))
    }
}
