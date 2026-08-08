package com.wagerproof.app.features.onboarding.pages

import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OnboardingResearchLayoutContractTest {
    @Test
    fun wrappedRiskProjectionLinesHaveExplicitBreathingRoom() {
        assertEquals(40.sp, riskProjectionLineHeight(numberSize = 30))
        assertTrue(RiskProjectionExtraLeadingSp >= 8)
        assertTrue(RiskProjectionVerticalPadding >= 4.dp)
    }
}
