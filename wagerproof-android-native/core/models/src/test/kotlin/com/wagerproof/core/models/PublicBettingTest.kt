package com.wagerproof.core.models

import kotlin.math.roundToInt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PublicBettingTest {
    @Test
    fun boiseIsSharpMoneyOnTheDog() {
        val read = PublicBetting.read(row(PublicMarket.spread, "Boise State", "Washington St", -16.5, 16.5, -13.0, 13.0, 52.0 to 48.0, 15.0 to 85.0))
        assertEquals(PublicCategory.sharpMoney, read.category)
        assertEquals("Sharp Money on Washington St", read.chip)
        assertEquals(37.0, read.tiltPp)
        assertEquals(-13.0, read.current)
        assertEquals(13.0, read.homeCurrent)
        assertTrue(read.strong)
        assertFalse(read.excluded)
        val line = PublicBetting.quoteLine(
            PublicMarket.spread, "Boise State", "Washington St",
            PublicLineQuote(read.movedToward, read.moveSize, read.open, read.current, read.homeOpen, read.homeCurrent),
        )
        assertEquals("Boise State -16.5 → -13 · Washington St +16.5 → +13", line)
        assertFalse(line.contains(".25"))
    }

    @Test
    fun indianaUnderIsSharpButNotStrong() {
        val read = PublicBetting.read(row(PublicMarket.total, "Over", "Under", 52.5, null, 41.5, null, 83.0 to 17.0, 64.0 to 36.0))
        assertEquals(PublicCategory.sharpMoney, read.category)
        assertEquals("Sharp Money on the Under", read.chip)
        assertEquals(19.0, read.tiltPp)
        assertEquals(11.0, read.moveSize)
        assertEquals(41.5, read.current)
        assertFalse(read.strong)
        assertEquals("11 points toward the Under", PublicBetting.lineCaption(PublicMarket.total, read)?.text)
        assertEquals("📉", PublicBetting.lineCaption(PublicMarket.total, read)?.mark)
    }

    @Test
    fun hammeredIsThePublicWithVolume() {
        val read = PublicBetting.read(row(PublicMarket.spread, "Cincinnati", "Oklahoma", 3.5, -3.5, 3.0, -3.0, 73.0 to 27.0, 87.0 to 13.0))
        assertEquals(PublicCategory.hammered, read.category)
        assertNotEquals(PublicCategory.sharpMoney, read.category)
        assertTrue(read.sentence.contains("not sharp action"))
        assertEquals(PublicEmphasis.medium, read.emphasis)
    }

    @Test
    fun flatDivergingMoneyHasNotMoved() {
        val read = PublicBetting.read(row(PublicMarket.spread, "Houston", "Utah", 6.5, -6.5, 6.5, -6.5, 69.0 to 31.0, 47.0 to 53.0))
        assertEquals(PublicCategory.moneyNoMove, read.category)
        assertEquals("Money on Utah", read.chip)
    }

    @Test
    fun quarterPointDriftDoesNotCountAsAMove() {
        val read = PublicBetting.read(row(PublicMarket.total, "Over", "Under", 45.0, null, 44.75, null, 70.0 to 30.0, 40.0 to 60.0))
        assertEquals(PublicCategory.moneyNoMove, read.category)
        assertNull(PublicBetting.lineDirection(row(PublicMarket.spread, "A", "B", null, null, -3.0, 3.0, 60.0 to 40.0, 60.0 to 40.0)).movedToward)
    }

    @Test
    fun lineFightingTheMoney() {
        val read = PublicBetting.read(row(PublicMarket.spread, "Oklahoma", "Mississippi St", -1.5, 1.5, -4.5, 4.5, 59.0 to 41.0, 42.0 to 58.0))
        assertEquals(PublicCategory.lineFightsMoney, read.category)
    }

    @Test
    fun linePushingBackStaysQuiet() {
        val read = PublicBetting.read(row(PublicMarket.total, "Over", "Under", 50.5, null, 54.5, null, 9.0 to 91.0, 10.0 to 90.0))
        assertEquals(PublicCategory.linePushesBack, read.category)
        assertEquals(PublicEmphasis.quiet, read.emphasis)
    }

    @Test
    fun piledMoneyMovingWithTheCrowdIsHammered() {
        val read = PublicBetting.read(row(PublicMarket.spread, "Celtics", "Knicks", -3.0, 3.0, -4.5, 4.5, 70.0 to 30.0, 80.0 to 20.0))
        assertEquals(PublicCategory.hammered, read.category)
    }

    @Test
    fun piledMoneyMovingAwayIsTheBookFadingThePublic() {
        val read = PublicBetting.read(row(PublicMarket.spread, "Celtics", "Knicks", -4.5, 4.5, -3.0, 3.0, 70.0 to 30.0, 80.0 to 20.0))
        assertEquals(PublicCategory.linePushesBack, read.category)
        assertEquals(PublicEmphasis.quiet, read.emphasis)
    }

    @Test
    fun moneylineFloorDropsAOneBetDogAndKeepsALopsidedSpread() {
        val ml = PublicBetting.read(row(PublicMarket.ml, "Old Dominion", "LA Tech", 400.0, -550.0, 450.0, -600.0, 4.0 to 96.0, 79.0 to 21.0))
        assertTrue(ml.excluded)
        val spread = PublicBetting.read(row(PublicMarket.spread, "Old Dominion", "LA Tech", 14.0, -14.0, 13.0, -13.0, 12.0 to 88.0, 30.0 to 70.0))
        assertFalse(spread.excluded)
    }

    @Test
    fun missingTicketCountStillShowsTheSplit() {
        val read = PublicBetting.read(
            row(PublicMarket.spread, "Bucks", "Wizards", -3.0, 3.0, -4.5, 4.5, 40.0 to 60.0, 55.0 to 45.0, tickets = null),
        )
        assertFalse(read.excluded)
        val thin = PublicBetting.read(
            row(PublicMarket.spread, "Bucks", "Wizards", -3.0, 3.0, -4.5, 4.5, 40.0 to 60.0, 55.0 to 45.0, tickets = 199.0),
        )
        assertTrue(thin.excluded)
    }

    @Test
    fun moneylineMoveUsesDeviggedPriceNotASubtraction() {
        val input = row(PublicMarket.ml, "Away", "Home", 105.0, -125.0, -113.0, 102.0, 40.0 to 60.0, 20.0 to 80.0)
        val quote = PublicBetting.lineDirection(input)
        assertEquals(PublicSide.away, quote.movedToward)
        assertEquals(-113.0, quote.current)
        assertEquals(102.0, quote.homeCurrent)
        val read = PublicBetting.read(input)
        assertEquals(PublicCategory.linePushesBack, read.category)
    }

    @Test
    fun leanAndEvenSplit() {
        val lean = PublicBetting.read(row(PublicMarket.spread, "Celtics", "Knicks", -3.0, 3.0, -3.0, 3.0, 56.0 to 44.0, 56.0 to 44.0))
        assertEquals(PublicCategory.split, lean.category)
        assertEquals("Leaning Celtics", lean.chip)
        assertEquals(PublicEmphasis.none, lean.emphasis)
        val even = PublicBetting.read(row(PublicMarket.spread, "Celtics", "Knicks", -3.0, 3.0, -3.0, 3.0, 50.0 to 50.0, 50.0 to 50.0))
        assertEquals("Split", even.chip)
    }

    @Test
    fun differenceCaptionAndBoardSort() {
        val wide = PublicBetting.read(row(PublicMarket.spread, "Boise State", "Washington St", -16.5, 16.5, -13.0, 13.0, 52.0 to 48.0, 15.0 to 85.0))
        val gap = PublicBetting.moneyGap(wide)
        assertEquals(37, gap?.points)
        assertEquals(PublicSide.home, gap?.side)
        assertEquals("Washington St", gap?.name)
        val moved = PublicBetting.lineCaption(PublicMarket.spread, wide)
        assertEquals("3.5 points toward Washington St", moved?.text)
        assertEquals("👉", moved?.mark)
        assertEquals(false, moved?.flat)

        val even = PublicBetting.read(row(PublicMarket.spread, "Chiefs", "Bills", -3.0, 3.0, -3.0, 3.0, 50.0 to 50.0, 50.0 to 50.0))
        assertNull(PublicBetting.moneyGap(even))
        assertEquals("Unchanged", PublicBetting.lineCaption(PublicMarket.spread, even)?.text)
        assertEquals("⏸️", PublicBetting.lineCaption(PublicMarket.spread, even)?.mark)

        val early = game(1, "Chiefs", "Bills", "2026-10-25T17:00:00Z", even)
        val late = game(2, "Boise State", "Washington St", "2026-10-25T20:00:00Z", wide)
        assertEquals(listOf(2, 1), PublicBetting.ordered(listOf(early, late), "nfl", PublicMarket.spread, false, "", PublicBoardSort.diff).map { it.gameId })
        assertEquals(listOf(1, 2), PublicBetting.ordered(listOf(late, early), "nfl", PublicMarket.spread, false, "", PublicBoardSort.time).map { it.gameId })
        assertEquals(listOf(1), PublicBetting.ordered(listOf(early, late), "nfl", PublicMarket.spread, false, "kc", PublicBoardSort.sharp).map { it.gameId })
        assertEquals(listOf(2), PublicBetting.ordered(listOf(early, late), "nfl", PublicMarket.spread, true, "", PublicBoardSort.sharp).map { it.gameId })
    }

    private fun game(id: Int, away: String, home: String, start: String, read: PublicMarketRead) = PublicBettingGame(
        id, "nfl", away, home, start, null, read.tickets?.roundToInt(), mapOf(read.market to read),
    )

    private fun row(
        market: PublicMarket,
        away: String,
        home: String,
        awayOpen: Double?,
        homeOpen: Double?,
        awayCons: Double?,
        homeCons: Double?,
        bets: Pair<Double, Double>,
        money: Pair<Double, Double>,
        tickets: Double? = 800.0,
    ) = PublicMarketInput(
        market, away, home, awayOpen, homeOpen, awayCons, homeCons,
        bets.first, bets.second, money.first, money.second, tickets, true,
    )
}
