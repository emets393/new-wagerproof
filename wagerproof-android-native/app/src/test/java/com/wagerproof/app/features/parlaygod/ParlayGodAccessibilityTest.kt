package com.wagerproof.app.features.parlaygod

import com.wagerproof.core.models.ParlayGodCategory
import com.wagerproof.core.models.ParlayLeg
import com.wagerproof.core.models.ParlaySport
import com.wagerproof.core.models.ParlayTicket
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse

class ParlayGodAccessibilityTest {
    @Test
    fun `expanded card announces evidence and matchup`() {
        val label = parlayTicketAccessibilityLabel(
            ticket = ticket(),
            displayMode = ParlayGodCardDisplayMode.Expanded,
            showsMatchup = true,
        )

        assertContains(label, "Won 7 straight at home")
        assertContains(label, "matchup Cubs @ Cardinals")
    }

    @Test
    fun `same-game expanded card announces evidence without redundant matchup`() {
        val label = parlayTicketAccessibilityLabel(
            ticket = ticket(),
            displayMode = ParlayGodCardDisplayMode.Expanded,
            showsMatchup = false,
        )

        assertContains(label, "Won 7 straight at home")
        assertFalse(label.contains("matchup Cubs @ Cardinals"))
    }

    private fun ticket(): ParlayTicket {
        val leg = ParlayLeg(
            kind = ParlayLeg.Kind.TEAM,
            sport = ParlaySport.MLB,
            category = ParlayGodCategory.HOME_AWAY,
            gameKey = "game-1",
            matchupLabel = "Cubs @ Cardinals",
            gameTimeEt = null,
            subject = "Cardinals",
            teamAbbr = "STL",
            playerId = null,
            betText = "STL ML",
            odds = -120,
            evidence = "Won 7 straight at home",
            streakN = 7,
            marketKey = "ml",
            backedTeamAbbr = "STL",
        )
        return ParlayTicket(
            id = "ticket-1",
            sports = listOf(ParlaySport.MLB),
            category = ParlayGodCategory.HOME_AWAY,
            legs = listOf(leg),
            combinedOddsText = "-120",
        )
    }
}
