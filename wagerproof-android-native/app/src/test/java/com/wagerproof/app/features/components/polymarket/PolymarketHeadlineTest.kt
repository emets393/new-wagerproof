package com.wagerproof.app.features.components.polymarket

import com.wagerproof.core.models.PolymarketMarketType
import com.wagerproof.core.models.PolymarketPricePoint
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * The market-odds headline names the SIDE the plotted series is labelled with.
 * Getting that attribution backwards on a two-line complementary chart is the
 * single easiest way to print a false statement, so every branch is pinned.
 */
class PolymarketHeadlineTest {

    @Test
    fun `moneyline names the leader and its movement`() {
        assertEquals(
            "Public markets give KC a 64% chance to win outright, compared with DEN at 36%." +
                " KC is up 9 percentage points from the first tracked price.",
            headline(listOf(0.45, 0.52, 0.36), awayLabel = "DEN", homeLabel = "KC"),
        )
    }

    @Test
    fun `moneyline reads nearly even inside four points`() {
        assertEquals(
            "Public markets see the outright winner as nearly even: DEN 51% and KC 49%." +
                " DEN has held broadly steady across the tracked history.",
            headline(listOf(0.51, 0.51), awayLabel = "DEN", homeLabel = "KC"),
        )
    }

    @Test
    fun `spread says run line for MLB`() {
        assertEquals(
            "Public markets give CHC a 70% chance to cover the selected run line, compared with CIN at 30%." +
                " CHC is up 10 percentage points from the first tracked price.",
            headline(
                listOf(0.60, 0.70), awayLabel = "CHC", homeLabel = "CIN",
                type = PolymarketMarketType.SPREAD, league = "mlb",
            ),
        )
    }

    @Test
    fun `spread says spread for football`() {
        assertEquals(
            "Public markets give DEN a 70% chance to cover the selected spread, compared with KC at 30%." +
                " DEN is down 10 percentage points from the first tracked price.",
            headline(
                listOf(0.80, 0.70), awayLabel = "DEN", homeLabel = "KC",
                type = PolymarketMarketType.SPREAD, league = "nfl",
            ),
        )
    }

    @Test
    fun `total prices Over and Under, not the teams`() {
        assertEquals(
            "Public markets price Over at 66% and Under at 34% for the selected game total." +
                " Over has held broadly steady across the tracked history.",
            headline(
                listOf(0.65, 0.66), awayLabel = "Over", homeLabel = "Under",
                type = PolymarketMarketType.TOTAL, league = "mlb",
            ),
        )
    }

    @Test
    fun `series shorter than two points has no headline`() {
        assertNull(headline(emptyList()))
        assertNull(headline(listOf(0.5)))
    }

    @Test
    fun `whole-percent history is accepted alongside fractions`() {
        // The service returns whole percentage points on some rows; the headline
        // must not turn 67 into 6700%.
        assertEquals(
            "Public markets give KC a 67% chance to win outright, compared with DEN at 33%." +
                " KC is up 7 percentage points from the first tracked price.",
            headline(listOf(40.0, 33.0), awayLabel = "DEN", homeLabel = "KC"),
        )
    }

    private fun headline(
        awayPercents: List<Double>,
        awayLabel: String = "AWAY",
        homeLabel: String = "HOME",
        type: PolymarketMarketType = PolymarketMarketType.MONEYLINE,
        league: String = "nfl",
    ): String? = polymarketMarketHeadline(
        history = awayPercents.mapIndexed { i, p -> PolymarketPricePoint(t = i, p = p) },
        type = type,
        league = league,
        awayLabel = awayLabel,
        homeLabel = homeLabel,
    )
}
