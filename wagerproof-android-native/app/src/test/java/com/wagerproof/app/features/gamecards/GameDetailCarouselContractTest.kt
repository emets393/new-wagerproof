package com.wagerproof.app.features.gamecards

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GameDetailCarouselContractTest {
    @Test
    fun matchupSwitcherUsesNearOpaqueBaseAboveScrollingContent() {
        assertTrue(MatchupStripSurfaceAlpha >= 0.90f)
        assertTrue(MatchupStripSurfaceAlpha < 1f)
    }

    @Test
    fun currentChipCentersInTheStripRatherThanSittingAtItsLeadingEdge() {
        // 1000px viewport, 200px chip -> 400px of slack on each side.
        assertEquals(-400, matchupStripCenterOffset(viewport = 1000, itemSize = 200))
    }

    @Test
    fun chipWiderThanTheStripStillLandsNearTheLeadingEdge() {
        assertTrue(matchupStripCenterOffset(viewport = 200, itemSize = 400) >= 0)
    }

    @Test
    fun unmeasuredStripDoesNotOffsetTheScroll() {
        assertEquals(0, matchupStripCenterOffset(viewport = 0, itemSize = 200))
    }
}
