package com.wagerproof.app.features.components.polymarket

import com.wagerproof.core.models.PolymarketPricePoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PolymarketFormattingTest {
    @Test
    fun `whole current odds are not multiplied twice`() {
        assertEquals(67.0, 67.0.asPolymarketPercent(), 0.0001)
        assertEquals(33.0, 33.0.asPolymarketPercent(), 0.0001)
    }

    @Test
    fun `fractional history is converted to percentage points`() {
        assertEquals(67.0, 0.67.asPolymarketPercent(), 0.0001)
        assertEquals(33.0, 0.33.asPolymarketPercent(), 0.0001)
    }

    @Test
    fun `movement spans the visible chart window`() {
        val history = listOf(
            PolymarketPricePoint(t = 1, p = 0.51),
            PolymarketPricePoint(t = 2, p = 0.58),
            PolymarketPricePoint(t = 3, p = 0.67),
        )

        assertEquals(16.0, polymarketMovementPercent(history)!!, 0.0001)
    }

    @Test
    fun `chart scale includes away and complementary home series`() {
        val scale = polymarketChartScale(
            listOf(
                PolymarketPricePoint(t = 1, p = 0.66),
                PolymarketPricePoint(t = 2, p = 0.67),
                PolymarketPricePoint(t = 3, p = 0.68),
            ),
        )

        assertTrue(scale.lower <= 32f)
        assertTrue(scale.upper >= 68f)
        assertTrue(scale.ticks.size in 4..6)
    }

    @Test
    fun `chart ticks retain padding for a narrow probability range`() {
        val scale = polymarketChartScale(
            listOf(
                PolymarketPricePoint(t = 1, p = 0.49),
                PolymarketPricePoint(t = 2, p = 0.51),
            ),
        )

        assertTrue(scale.lower <= 45f)
        assertTrue(scale.upper >= 55f)
        assertTrue(scale.ticks.all { it in 0f..100f })
    }
}
