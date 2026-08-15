package com.wagerproof.core.design.components

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Pure-math tests for [SpreadCoverOutcome] — port of iOS
 * `SpreadCoverBar.swift`'s cover/lose/push zone math. `SpreadCoverBar` itself
 * works in MARGIN (final points for minus points against), never in the raw
 * line, and half-point lines can never push while whole-point lines can.
 *
 * Fixture numbers mirror the iOS `#Preview` cases so the two platforms are
 * checking the same math against the same inputs.
 */
class SpreadCoverOutcomeTest {

    // MARK: - Half-point line: no push possible

    @Test
    fun `half point dog has no push`() {
        // NE +4.5, model has them winning by 2.1 — iOS preview fixture.
        val outcome = SpreadCoverOutcome(line = 4.5, modelMargin = 2.1)
        assertFalse(outcome.hasPush)
        assertNull(outcome.pushMargin)
        assertNull(outcome.pushCondition)
    }

    @Test
    fun `half point dog covers when model margin beats threshold`() {
        val outcome = SpreadCoverOutcome(line = 4.5, modelMargin = 2.1)
        // threshold = -line = -4.5; cushion = modelMargin - threshold = 6.6.
        assertEquals(-4.5, outcome.threshold)
        assertEquals(6.6, outcome.cushion, 1e-9)
        assertTrue(outcome.covers)
    }

    @Test
    fun `half point favourite laying points`() {
        // LAR -3.5, model has them winning by 4.4 — thin cushion, iOS preview fixture.
        val outcome = SpreadCoverOutcome(line = -3.5, modelMargin = 4.4)
        assertFalse(outcome.hasPush)
        assertEquals(4, outcome.coverMin)
        assertEquals(3, outcome.loseMax)
        assertTrue(outcome.covers)
        assertEquals(0.9, outcome.cushion, 1e-9)
    }

    // MARK: - Whole-point line: push exists and must be labelled

    @Test
    fun `whole point line has a push at the threshold`() {
        // ATL +3 — whole point, push band, iOS preview fixture.
        val outcome = SpreadCoverOutcome(line = 3.0, modelMargin = -0.3)
        assertTrue(outcome.hasPush)
        assertEquals(-3, outcome.pushMargin)
        assertEquals("Lose by exactly 3", outcome.pushCondition)
        assertEquals("Lose by 4+", outcome.loseCondition)
        assertEquals("Lose by 2 or less, tie, or win", outcome.coverCondition)
    }

    @Test
    fun `whole point dog covers while the model has the pick team losing`() {
        // The case this widget exists to make legible: ATL +3, model margin
        // -0.3 (a projected 0.3-point LOSS) still clears the -3 threshold and
        // therefore covers. Getting this backwards is the exact bug the iOS
        // spec calls out — "a 3-point loss wins" would be wrong, it pushes;
        // a SMALLER loss like this one covers outright.
        val outcome = SpreadCoverOutcome(line = 3.0, modelMargin = -0.3)
        assertTrue(outcome.modelMargin < 0, "fixture must have the model projecting a loss")
        assertTrue(outcome.covers, "a loss smaller than the +3 cushion still covers")
        assertEquals(2.7, outcome.cushion, 1e-9)
    }

    @Test
    fun `whole point favourite laying double digits`() {
        // LAC -10, model has them winning by 11 — cushion of exactly 1, iOS preview fixture.
        val outcome = SpreadCoverOutcome(line = -10.0, modelMargin = 11.0)
        assertTrue(outcome.hasPush)
        assertEquals(10, outcome.pushMargin)
        assertEquals(11, outcome.coverMin)
        assertEquals(9, outcome.loseMax)
        assertTrue(outcome.covers)
        assertEquals(1.0, outcome.cushion, 1e-9)
    }

    // MARK: - Favourite vs dog sign convention

    @Test
    fun `dog threshold sits on the losing side of zero`() {
        // A dog's cover zone starts at a NEGATIVE margin — you can lose the
        // game and still cash the bet. line=+4.5 -> threshold=-4.5.
        val outcome = SpreadCoverOutcome(line = 4.5, modelMargin = 0.0)
        assertTrue(outcome.threshold < 0)
    }

    @Test
    fun `favourite threshold sits on the winning side of zero`() {
        // A favourite must win by more than they're laying. line=-3.5 -> threshold=+3.5.
        val outcome = SpreadCoverOutcome(line = -3.5, modelMargin = 0.0)
        assertTrue(outcome.threshold > 0)
    }

    @Test
    fun `does not cover when cushion is negative`() {
        // Dog getting 4.5 but the model has them losing by 6 — short of the number.
        val outcome = SpreadCoverOutcome(line = 4.5, modelMargin = -6.0)
        assertFalse(outcome.covers)
        assertEquals(-1.5, outcome.cushion, 1e-9)
    }

    // MARK: - Pick'em (line = 0, a whole number)

    @Test
    fun `pick em pushes on an exact tie`() {
        val outcome = SpreadCoverOutcome(line = 0.0, modelMargin = 3.0)
        assertTrue(outcome.hasPush)
        assertEquals(0, outcome.pushMargin)
        assertEquals("Tie", outcome.pushCondition)
    }

    // MARK: - Half-point dog where the whole number sits exactly at zero cover margin

    @Test
    fun `half point dog can require only a win or tie to cover`() {
        // +0.5: any margin >= 0 (win or tie) covers, since 0 > -0.5.
        val outcome = SpreadCoverOutcome(line = 0.5, modelMargin = 1.0)
        assertEquals(0, outcome.coverMin)
        assertEquals("Win or tie", outcome.coverCondition)
        assertFalse(outcome.hasPush)
    }

    // MARK: - format()

    @Test
    fun `format drops trailing zero on whole numbers`() {
        assertEquals("3", SpreadCoverOutcome.format(3.0))
        assertEquals("3.5", SpreadCoverOutcome.format(3.5))
    }
}
