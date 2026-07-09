package com.wagerproof.app.features.nfl

import com.wagerproof.core.models.NFLPrediction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class NFLGameCardSlatePicksTest {
    @Test
    fun `authoritative rows drive best lines and coexisting badges`() {
        val rows = listOf(
            NFLDryrunPickRow(
                cardGroup = "total",
                pickSide = "UNDER",
                bestLine = 43.5,
                hasPlay = false,
                signalKeys = listOf("pace", "weather"),
            ),
            NFLDryrunPickRow(
                cardGroup = "spread",
                pickTeam = "Buffalo Bills",
                bestLine = -2.5,
                conviction = "high",
                hasPlay = true,
                signalKeys = listOf("weather", "trenches"),
            ),
            NFLDryrunPickRow(
                cardGroup = "moneyline",
                conviction = "mammoth",
                isMammoth = true,
                hasPlay = true,
            ),
        )

        val slate = nflSlatePicks(NFLPrediction(), rows)

        assertEquals(false, slate.totalIsOver)
        assertEquals("O/U UNDER 43.5", slate.totalLabel)
        assertEquals("-2.5", slate.spreadLabel)
        assertEquals(1, slate.highCount)
        assertEquals(3, slate.signalCount)
        assertTrue(slate.hasMammoth)
    }
}
