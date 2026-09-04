package com.wagerproof.app.features.nfl

import com.wagerproof.core.models.NFLPrediction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * NFL detail headlines.
 *
 * `nfl_predictions_epa` is a CLASSIFIER — no model fair line — but the slate
 * pick rows do carry `model_line`, so the spread/total cards quote a real
 * model-vs-market gap when the column is populated and name the selection when
 * it is not. These tests pin both branches so a future data change can't turn
 * the fallback into an invented line.
 */
class NFLDetailHeadlinesTest {

    // --- prediction groups --------------------------------------------------

    @Test
    fun `spread group quotes model line versus market`() {
        val group = NFLPickGroup(
            "spread",
            listOf(row(cardGroup = "spread", pickTeam = "Denver Broncos", modelLine = -8.2, bestLine = -4.5, hasPlay = true)),
        )
        assertEquals(
            "Full game: model makes Broncos -8.2 versus -4.5 at the market, backing Denver Broncos -4.5.",
            predictionHeadline(group),
        )
    }

    @Test
    fun `first-half spread scopes the sentence`() {
        val group = NFLPickGroup(
            "h1_spread",
            listOf(row(cardGroup = "h1_spread", pickTeam = "Denver Broncos", modelLine = -3.0, bestLine = -1.5, hasPlay = true)),
        )
        assertEquals(
            "First half: model makes Broncos -3 versus -1.5 at the market, backing Denver Broncos 1H -1.5.",
            predictionHeadline(group),
        )
    }

    @Test
    fun `spread group without a model line names the selection only`() {
        val group = NFLPickGroup(
            "spread",
            listOf(row(cardGroup = "spread", pickTeam = "Denver Broncos", modelLine = null, bestLine = -4.5)),
        )
        assertEquals("The model backs Denver Broncos -4.5.", predictionHeadline(group))
    }

    @Test
    fun `total group leans with model versus market`() {
        val group = NFLPickGroup(
            "total",
            listOf(row(cardGroup = "total", pickSide = "OVER", pickLabel = "Over 45.5", modelLine = 48.6, bestLine = 45.5)),
        )
        assertEquals(
            "Full game: model projects 48.6 versus 45.5 at the market — leans OVER.",
            predictionHeadline(group),
        )
    }

    @Test
    fun `total group with no numbers still states the lean`() {
        val group = NFLPickGroup("total", listOf(row(cardGroup = "total", pickSide = "UNDER", pickLabel = "Under 45.5")))
        assertEquals("Full game: model leans UNDER.", predictionHeadline(group))
    }

    @Test
    fun `moneyline group quotes the win probability`() {
        val group = NFLPickGroup(
            "moneyline",
            listOf(row(cardGroup = "moneyline", pickTeam = "Kansas City Chiefs", modelNumber = 0.6349)),
        )
        assertEquals("Full game: model backs Chiefs to win at 63%.", predictionHeadline(group))
    }

    @Test
    fun `team total names the team and direction`() {
        val group = NFLPickGroup(
            "team_total",
            listOf(
                row(
                    cardGroup = "team_total", pickTeam = "Denver Broncos", pickSide = "OVER",
                    modelLine = 24.4, bestLine = 21.5,
                ),
            ),
        )
        assertEquals(
            "The model projects Broncos for 24.4 points versus 21.5 at the market, leaning OVER.",
            predictionHeadline(group),
        )
    }

    @Test
    fun `an empty group has no headline`() {
        assertNull(predictionHeadline(NFLPickGroup("spread", emptyList())))
    }

    @Test
    fun `the playable pick wins over an earlier no-play row`() {
        val group = NFLPickGroup(
            "spread",
            listOf(
                row(cardGroup = "spread", pickTeam = "Denver Broncos", modelLine = -1.0, bestLine = -1.0, hasPlay = false),
                row(cardGroup = "spread", pickTeam = "Kansas City Chiefs", modelLine = -8.2, bestLine = -4.5, hasPlay = true),
            ),
        )
        assertEquals(
            "Full game: model makes Chiefs -8.2 versus -4.5 at the market, backing Kansas City Chiefs -4.5.",
            predictionHeadline(group),
        )
    }

    // --- public betting -----------------------------------------------------

    @Test
    fun `public betting reports the widest money-versus-ticket split`() {
        val game = NFLPrediction(
            awaySpreadBets = "41", awaySpreadHandle = "62",
            homeSpreadBets = "59", homeSpreadHandle = "40",
            overBets = "55", overHandle = "57",
        )
        assertEquals(
            "62% of spread money is on DEN, versus 41% of tickets — the clearest public split.",
            publicBettingHeadline(game, "DEN", "KC"),
        )
    }

    @Test
    fun `public betting calls a sub-five-point spread aligned`() {
        val game = NFLPrediction(overBets = "55", overHandle = "57", underBets = "45", underHandle = "43")
        assertEquals(
            "Tickets and money are broadly aligned across the available NFL markets.",
            publicBettingHeadline(game, "DEN", "KC"),
        )
    }

    @Test
    fun `public betting falls back when no market has both sides posted`() {
        assertEquals(
            "Ticket and money percentages show where public volume and wager size agree or diverge.",
            publicBettingHeadline(NFLPrediction(overBets = "55"), "DEN", "KC"),
        )
    }

    @Test
    fun `public betting accepts percent signs and 0-1 fractions`() {
        val game = NFLPrediction(awayMlBets = "0.30", awayMlHandle = "72%")
        assertEquals(
            "72% of moneyline money is on DEN, versus 30% of tickets — the clearest public split.",
            publicBettingHeadline(game, "DEN", "KC"),
        )
    }

    // --- matchup history ----------------------------------------------------

    @Test
    fun `matchup history names a majority winner and the OU tilt`() {
        val history = listOf(
            historyRow(winner = "KC", ou = "OVER"),
            historyRow(winner = "KC", ou = "OVER"),
            historyRow(winner = "DEN", ou = "UNDER"),
        )
        assertEquals(
            "KC won 2 of 3 recent meetings; 2 finished OVER.",
            matchupHistoryHeadline(history),
        )
    }

    @Test
    fun `matchup history calls an even series split`() {
        val history = listOf(historyRow(winner = "KC"), historyRow(winner = "DEN"))
        assertEquals("The last 2 meetings are split.", matchupHistoryHeadline(history))
    }

    @Test
    fun `matchup history is silent with no games`() {
        assertNull(matchupHistoryHeadline(emptyList()))
    }

    private fun row(
        cardGroup: String,
        pickTeam: String? = null,
        pickSide: String? = null,
        pickLabel: String? = null,
        modelLine: Double? = null,
        modelNumber: Double? = null,
        bestLine: Double? = null,
        hasPlay: Boolean? = null,
    ) = NFLSlatePickRow(
        cardGroup = cardGroup,
        pickTeam = pickTeam,
        pickSide = pickSide,
        pickLabel = pickLabel,
        modelLine = modelLine,
        modelNumber = modelNumber,
        bestLine = bestLine,
        hasPlay = hasPlay,
    )

    private fun historyRow(winner: String?, ou: String? = null) = NFLMatchupHistoryRow(
        awayTeam = "DEN",
        homeTeam = "KC",
        winnerTeam = winner,
        ouResult = ou,
    )
}
