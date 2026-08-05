package com.wagerproof.app.features.gamecards

import kotlin.test.Test
import kotlin.test.assertTrue

class GameDetailCarouselContractTest {
    @Test
    fun matchupSwitcherUsesNearOpaqueBaseAboveScrollingContent() {
        assertTrue(MatchupStripSurfaceAlpha >= 0.90f)
        assertTrue(MatchupStripSurfaceAlpha < 1f)
    }
}
