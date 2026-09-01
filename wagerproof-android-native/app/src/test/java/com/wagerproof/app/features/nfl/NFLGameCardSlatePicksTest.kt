package com.wagerproof.app.features.nfl

import com.wagerproof.core.models.NFLPrediction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NFLGameCardSlatePicksTest {
    @Test
    fun `authoritative rows drive best lines`() {
        val rows = listOf(
            NFLSlatePickRow(
                cardGroup = "total",
                pickSide = "UNDER",
                bestLine = 43.5,
                hasPlay = false,
                signalKeys = listOf("pace", "weather"),
            ),
            NFLSlatePickRow(
                cardGroup = "spread",
                pickTeam = "Buffalo Bills",
                bestLine = -2.5,
                conviction = "high",
                hasPlay = true,
                signalKeys = listOf("weather", "trenches"),
            ),
            NFLSlatePickRow(
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
    }

    /**
     * Mammoth still reads on the feed as the card's orange electric border, so
     * the detection has to keep working even though `SlatePicks` no longer
     * carries a badge for it (AND-090 — conviction is detail-page-only, per iOS).
     */
    @Test
    fun `mammoth detection survives the badge removal`() {
        val rows = listOf(
            NFLSlatePickRow(cardGroup = "moneyline", conviction = "mammoth", isMammoth = true, hasPlay = true),
        )

        assertTrue(nflHasMammothPlay(NFLPrediction(), rows))
        assertFalse(nflHasMammothPlay(NFLPrediction(), emptyList()))
    }
}
