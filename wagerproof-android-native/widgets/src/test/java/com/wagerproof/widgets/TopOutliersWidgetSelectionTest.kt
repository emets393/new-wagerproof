package com.wagerproof.widgets

import com.wagerproof.core.models.OutliersWidgetMarketData
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TopOutliersWidgetSelectionTest {

    @Test
    fun missingExplicitMarketDoesNotFallBackToAnotherMarket() {
        val moneyline = market("moneyline")

        assertNull(resolveOutliersWidgetMarket(listOf(moneyline), "spread"))
    }

    @Test
    fun unconfiguredWidgetUsesFirstAvailableMarket() {
        val moneyline = market("moneyline")
        val spread = market("spread")

        assertEquals(moneyline, resolveOutliersWidgetMarket(listOf(moneyline, spread), null))
    }

    private fun market(id: String) = OutliersWidgetMarketData(
        id = id,
        title = id,
        symbolName = "chart.line.uptrend.xyaxis",
        items = emptyList(),
        totalCount = 0,
    )
}
