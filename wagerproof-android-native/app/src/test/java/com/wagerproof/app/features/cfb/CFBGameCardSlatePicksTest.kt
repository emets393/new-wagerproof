package com.wagerproof.app.features.cfb

import com.wagerproof.core.models.CFBPrediction
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CFBGameCardSlatePicksTest {
    private fun game() = CFBPrediction(
        id = "g1",
        awayTeam = "Texas",
        homeTeam = "Oklahoma",
        gameDate = "2025-10-11",
        gameTime = "12:00",
        trainingKey = "g1",
        uniqueId = "g1",
        convictionTierRaw = "none",
        mammoth = false,
        flags = emptyList(),
    )

    @Test
    fun `authoritative rows drive posted team lines`() {
        val rows = listOf(
            CFBDryrunPickRow(
                cardGroup = "total",
                pickSide = "OVER",
                bestLine = 51.5,
                signalKeys = listOf("tempo", "weather"),
            ),
            CFBDryrunPickRow(
                cardGroup = "spread",
                pickTeam = "Texas",
                bestLine = 3.5,
                conviction = "high",
                hasPlay = true,
                signalKeys = listOf("tempo", "road_dog"),
            ),
            CFBDryrunPickRow(
                cardGroup = "moneyline",
                conviction = "mammoth",
                isMammoth = true,
                hasPlay = true,
            ),
        )

        val slate = cfbSlatePicks(game(), rows)

        assertEquals(true, slate.totalIsOver)
        assertEquals("O/U OVER 51.5", slate.totalLabel)
        assertEquals("+3.5", slate.spreadLabel)
    }

    /**
     * Mammoth still reads on the feed as the card's orange electric border, so
     * the detection has to keep working even though `SlatePicks` no longer
     * carries a badge for it (AND-090 — conviction is detail-page-only, per iOS).
     */
    @Test
    fun `mammoth detection survives the badge removal`() {
        val rows = listOf(
            CFBDryrunPickRow(cardGroup = "moneyline", conviction = "mammoth", isMammoth = true, hasPlay = true),
        )

        assertTrue(cfbHasMammothPlay(game(), rows))
        assertFalse(cfbHasMammothPlay(game(), emptyList()))
    }

    @Test
    fun `pick decoder tolerates numeric ids and string encoded signal keys`() {
        val row = Json.decodeFromString<CFBDryrunPickRow>(
            """{"id":42,"game_id":1001,"best_line":"-2.5","is_mammoth":true,"signal_keys":"[\"pace\",\"weather\"]"}""",
        )

        assertEquals("42", row.id)
        assertEquals("1001", row.gameId)
        assertEquals(-2.5, row.bestLine)
        assertEquals(listOf("pace", "weather"), row.signalKeys)
        assertTrue(row.isMammoth == true)
    }
}
