package com.wagerproof.app.features.onboarding

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ResearchTimeContractTest {
    @Test
    fun persistedBucketIdsMatchTheCrossPlatformContract() {
        assertEquals(
            listOf("lt30m", "m30to60", "h1to2", "h2to3", "h3to4", "h4plus", "unknown"),
            ResearchTimeBucket.entries.map { it.raw },
        )
        assertEquals(
            listOf("lt50", "h50to150", "h150to400", "h400to1000", "h1000plus", "unknown"),
            StakesBucket.entries.map { it.raw },
        )
        assertEquals(ResearchTimeBucket.UNKNOWN, ResearchTimeBucket.resolve("h6to10"))
        assertEquals(StakesBucket.UNKNOWN, StakesBucket.resolve(null))
    }

    @Test
    fun timeProjectionUsesTheOwnerApprovedWakingLifetimeAndReclaimBasis() {
        assertEquals(16.0, ResearchTimeEstimates.WAKING_HOURS_PER_DAY)
        assertEquals(46.0, ResearchTimeEstimates.LIFETIME_HORIZON_YEARS)
        assertEquals(0.75, ResearchTimeEstimates.RECLAIM_FRACTION)

        val estimate = ResearchTimeEstimates(ResearchTimeBucket.H1TO2)
        assertEquals(23, estimate.daysThisYear)
        assertEquals(4, estimate.yearsOfLife)
        assertEquals(3, estimate.reclaimYears)
        assertEquals(8, estimate.reclaimHoursPerWeek)
    }

    @Test
    fun stakeProjectionIsTurnoverAndNeverOutcomeCopy() {
        val stakes = StakesEstimates(StakesBucket.H150TO400)
        assertEquals(13_000, stakes.yearlyAction)
        assertEquals(600_000, stakes.lifetimeAction)
        assertEquals("$13,000", stakes.yearlyActionDisplay)
        assertEquals("$600,000", stakes.lifetimeActionDisplay)
        assertTrue(StakesEstimates.DISCLOSURE.contains("money in play, not winnings or losses"))
        assertTrue(StakesEstimates.DISCLOSURE.contains("does not promise profits or outcomes"))
    }
}
