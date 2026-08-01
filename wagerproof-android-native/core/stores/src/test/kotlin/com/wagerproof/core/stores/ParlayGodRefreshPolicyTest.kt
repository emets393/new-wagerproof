package com.wagerproof.core.stores

import com.wagerproof.core.models.ParlayGodCategory
import com.wagerproof.core.models.ParlayLeg
import com.wagerproof.core.models.ParlaySport
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ParlayGodRefreshPolicyTest {
    @Test
    fun `successful empty props slate clears stale prop legs`() {
        val stale = propLeg("stale-player")

        val resolved = ParlayGodRefreshPolicy.resolvePropLegs(
            previous = listOf(stale),
            result = Result.success(emptyList()),
        )

        assertTrue(resolved.isEmpty())
    }

    @Test
    fun `failed props source preserves only last-known-good prop legs`() {
        val staleProp = propLeg("stale-player")
        val unrelatedTeamLeg = teamLeg("team")

        val resolved = ParlayGodRefreshPolicy.resolvePropLegs(
            previous = listOf(unrelatedTeamLeg, staleProp),
            result = Result.failure(IllegalStateException("props unavailable")),
        )

        assertEquals(listOf(staleProp), resolved)
    }

    @Test
    fun `successful empty props source still permits full refresh ttl`() {
        assertTrue(
            ParlayGodRefreshPolicy.allSourcesSucceeded(
                mlbSucceeded = true,
                nflSucceeded = true,
                propsSucceeded = Result.success(emptyList<Nothing>()).isSuccess,
            ),
        )
        assertFalse(
            ParlayGodRefreshPolicy.allSourcesSucceeded(
                mlbSucceeded = true,
                nflSucceeded = true,
                propsSucceeded = Result.failure<Nothing>(IllegalStateException()).isSuccess,
            ),
        )
    }

    private fun propLeg(subject: String) = leg(subject, ParlayLeg.Kind.PROP)

    private fun teamLeg(subject: String) = leg(subject, ParlayLeg.Kind.TEAM)

    private fun leg(subject: String, kind: ParlayLeg.Kind) = ParlayLeg(
        kind = kind,
        sport = ParlaySport.MLB,
        category = ParlayGodCategory.RECENT_FORM,
        gameKey = "game-1",
        matchupLabel = "AWY @ HOME",
        gameTimeEt = null,
        subject = subject,
        teamAbbr = "HOME",
        playerId = if (kind == ParlayLeg.Kind.PROP) 42 else null,
        betText = if (kind == ParlayLeg.Kind.PROP) "Over 1.5 Hits" else "HOME ML",
        odds = -110,
        evidence = "Hit in 5 straight",
        streakN = 5,
        marketKey = if (kind == ParlayLeg.Kind.PROP) "batter_hits" else "ml",
    )
}
