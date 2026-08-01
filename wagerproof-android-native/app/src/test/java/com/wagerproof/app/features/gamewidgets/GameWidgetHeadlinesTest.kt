package com.wagerproof.app.features.gamewidgets

import com.wagerproof.core.models.MLBSignalItem
import com.wagerproof.core.models.MLBSuggestedPick
import com.wagerproof.core.models.NBAGameTrends
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Locks the widget headline copy. These strings are the product — a headline
 * that disagrees with the numbers under it is the exact failure mode the LLM
 * pipeline was retired for (see .claude/docs/17_widget_headlines.md), so the
 * side attribution and every rounding rule is asserted verbatim.
 */
class GameWidgetHeadlinesTest {

    // --- projectedScore -----------------------------------------------------

    @Test
    fun `projectedScore names the leader first`() {
        assertEquals(
            "The model projects Chiefs 27.4, Broncos 20.1.",
            GameWidgetHeadlines.projectedScore(
                awayName = "Broncos", homeName = "Chiefs", awayScore = 20.1, homeScore = 27.4,
            ),
        )
    }

    @Test
    fun `projectedScore names the away leader when it is ahead`() {
        assertEquals(
            "The model projects Broncos 27.4, Chiefs 20.1.",
            GameWidgetHeadlines.projectedScore(
                awayName = "Broncos", homeName = "Chiefs", awayScore = 27.4, homeScore = 20.1,
            ),
        )
    }

    @Test
    fun `projectedScore calls a sub-quarter-point gap near-even`() {
        assertEquals(
            "The model projects a near-even game: Broncos 24.1, Chiefs 24.2.",
            GameWidgetHeadlines.projectedScore(
                awayName = "Broncos", homeName = "Chiefs", awayScore = 24.1, homeScore = 24.2,
            ),
        )
    }

    @Test
    fun `projectedScore f5 segment changes the prefix`() {
        assertEquals(
            "Through five, the model projects Reds 2.6, Cubs 1.9.",
            GameWidgetHeadlines.projectedScore(
                segment = "f5", awayName = "Cubs", homeName = "Reds", awayScore = 1.9, homeScore = 2.6,
            ),
        )
    }

    @Test
    fun `projectedScore returns null on missing or negative scores`() {
        assertNull(GameWidgetHeadlines.projectedScore(awayName = "A", homeName = "H", awayScore = null, homeScore = 3.0))
        assertNull(GameWidgetHeadlines.projectedScore(awayName = "A", homeName = "H", awayScore = -1.0, homeScore = 3.0))
        assertNull(
            GameWidgetHeadlines.projectedScore(
                awayName = "A", homeName = "H", awayScore = Double.NaN, homeScore = 3.0,
            ),
        )
    }

    // --- spread -------------------------------------------------------------

    @Test
    fun `spread quotes the model-vs-market gap when both lines exist`() {
        assertEquals(
            "Model makes DEN -8.2 versus -4.5 at the market — a 3.7-point edge.",
            GameWidgetHeadlines.spread(team = "DEN", modelSpread = -8.2, marketSpread = -4.5, edge = 3.7),
        )
    }

    @Test
    fun `spread falls back to cover probability when there is no model line`() {
        assertEquals(
            "Model expects DEN to cover at 62%.",
            GameWidgetHeadlines.spread(team = "DEN", modelSpread = null, marketSpread = -4.5, edge = 2.4, probability = 0.62),
        )
    }

    @Test
    fun `spread falls back to the bare edge with neither line nor probability`() {
        assertEquals(
            "Model finds a 2.4-point spread edge on DEN.",
            GameWidgetHeadlines.spread(team = "DEN", modelSpread = null, marketSpread = null, edge = 2.4),
        )
    }

    // --- total --------------------------------------------------------------

    @Test
    fun `total quotes model versus market`() {
        assertEquals(
            "Full game: model projects 48.6 versus 45.5 at the market — leans Over.",
            GameWidgetHeadlines.total(direction = "Over", modelTotal = 48.6, marketTotal = 45.5),
        )
    }

    @Test
    fun `total f5 scope and probability fallback`() {
        assertEquals(
            "Through five: model leans UNDER at 58%.",
            GameWidgetHeadlines.total(
                segment = "f5", direction = "UNDER", modelTotal = null, marketTotal = null, probability = 0.58,
            ),
        )
    }

    // --- moneyline ----------------------------------------------------------

    @Test
    fun `moneyline states the edge over the market`() {
        assertEquals(
            "Full game: model backs CIN at 57.0%, a +4.5-point edge over the market.",
            GameWidgetHeadlines.moneyline(
                segment = "full", pickAbbr = "CIN", pickProbability = 0.57,
                impliedProbability = 0.525, pickEdgePct = 4.5,
            ),
        )
    }

    @Test
    fun `moneyline says there is no value when the edge is not positive`() {
        assertEquals(
            "Full game: no moneyline value on CIN; the model does not beat the market price.",
            GameWidgetHeadlines.moneyline(
                segment = "full", pickAbbr = "CIN", pickProbability = 0.57,
                impliedProbability = 0.60, pickEdgePct = -3.0,
            ),
        )
    }

    @Test
    fun `moneyline flags an underdog whose model price still beats the market`() {
        assertEquals(
            "Through five: CIN is not the outright favorite, but the model's 47.0% beats the market's 43.0% by 4.0 points.",
            GameWidgetHeadlines.moneyline(
                segment = "f5", pickAbbr = "CIN", pickProbability = 0.47,
                impliedProbability = 0.43, pickEdgePct = 4.0,
            ),
        )
    }

    @Test
    fun `moneyline without an edge just leans`() {
        assertEquals(
            "Full game: model leans CIN at 57.0%.",
            GameWidgetHeadlines.moneyline(
                segment = "full", pickAbbr = "CIN", pickProbability = 0.57,
                impliedProbability = null, pickEdgePct = null,
            ),
        )
    }

    // --- injuries / team stats ---------------------------------------------

    @Test
    fun `injuries reports the healthier side and the empty state`() {
        assertEquals(
            "No injuries are currently reported for this matchup.",
            GameWidgetHeadlines.injuries("DEN", "KC", awayImpact = 0.0, homeImpact = 0.0, count = 0),
        )
        assertEquals(
            "4 reported injuries; the current impact scores favor KC.",
            GameWidgetHeadlines.injuries("DEN", "KC", awayImpact = 1.2, homeImpact = 3.4, count = 4),
        )
        assertEquals(
            "4 reported injuries, with no clear impact advantage.",
            GameWidgetHeadlines.injuries("DEN", "KC", awayImpact = 3.4, homeImpact = 3.4, count = 4),
        )
    }

    @Test
    fun `injury headline stays silent until the query loads`() {
        assertNull(
            GameWidgetHeadlines.injuriesWhenLoaded(
                isLoaded = false,
                awayAbbr = "DEN",
                homeAbbr = "KC",
                awayImpact = 0.0,
                homeImpact = 0.0,
                count = 0,
            ),
        )
    }

    @Test
    fun `teamStats names the stronger adjusted offense`() {
        assertEquals(
            "KC owns the stronger adjusted offense entering this matchup.",
            GameWidgetHeadlines.teamStats("DEN", "KC", awayOffense = 110.2, homeOffense = 118.9),
        )
        assertEquals(
            "DEN and KC are nearly even in adjusted offense.",
            GameWidgetHeadlines.teamStats("DEN", "KC", awayOffense = 110.2, homeOffense = 110.23),
        )
        assertNull(GameWidgetHeadlines.teamStats("DEN", "KC", awayOffense = null, homeOffense = 110.0))
    }

    // --- recent trends ------------------------------------------------------

    @Test
    fun `recentTrends joins the findings it has`() {
        val trends = NBAGameTrends(
            homeOvrRtg = 8.4, awayOvrRtg = 2.1, homeAtsPct = 0.41, awayAtsPct = 0.62,
        )
        assertEquals(
            "BOS has the stronger recent overall rating; LAL has covered 62% versus 41% for BOS.",
            GameWidgetHeadlines.recentTrends("LAL", "BOS", trends),
        )
    }

    @Test
    fun `recentTrends returns null with nothing to say`() {
        assertNull(GameWidgetHeadlines.recentTrends("LAL", "BOS", null))
        assertNull(GameWidgetHeadlines.recentTrends("LAL", "BOS", NBAGameTrends()))
    }

    // --- regression picks ---------------------------------------------------

    @Test
    fun `regressionPicks leads with the primary pick and its bucket record`() {
        assertEquals(
            "The regression report flags Reds ML in the full-game moneyline market; " +
                "its perfect storm edge bucket has won 64% across 87 picks.",
            GameWidgetHeadlines.regressionPicks(listOf(pick())),
        )
    }

    @Test
    fun `regressionPicks counts multiple suggestions and drops an empty bucket`() {
        val picks = listOf(pick(bucketSample = 0), pick(pick = "Under 8.5", betType = "f5_ou"))
        assertEquals(
            "2 regression picks are available, led by Reds ML in the full-game moneyline market.",
            GameWidgetHeadlines.regressionPicks(picks),
        )
        assertNull(GameWidgetHeadlines.regressionPicks(emptyList()))
    }

    // --- game signals -------------------------------------------------------

    @Test
    fun `gameSignals summarises the top categories and a one-sided tag`() {
        val signals = listOf(
            MLBSignalItem(category = "bullpen", severity = "over", message = "a"),
            MLBSignalItem(category = "bullpen", severity = "over", message = "b"),
            MLBSignalItem(category = "park_factor", severity = "over", message = "c"),
            MLBSignalItem(category = "weather", severity = "neutral", message = "d"),
        )
        assertEquals(
            "4 situational signals flagged — bullpen and park factor context, 3 tagged OVER.",
            GameWidgetHeadlines.gameSignals(signals),
        )
    }

    @Test
    fun `gameSignals stays neutral when both directions are present`() {
        val signals = listOf(
            MLBSignalItem(category = "", severity = "over", message = "a"),
            MLBSignalItem(category = "", severity = "under", message = "b"),
        )
        assertEquals(
            "2 situational signals flagged beyond the model's projections.",
            GameWidgetHeadlines.gameSignals(signals),
        )
        assertNull(GameWidgetHeadlines.gameSignals(emptyList()))
    }

    private fun pick(
        pick: String = "Reds ML",
        betType: String = "full_ml",
        bucketSample: Int = 87,
    ) = MLBSuggestedPick(
        gamePk = 1,
        betType = betType,
        pick = pick,
        matchup = "CHC @ CIN",
        homeTeam = "Cincinnati Reds",
        awayTeam = "Chicago Cubs",
        edgeAtSuggestion = 4.2,
        edgeBucket = "perfect_storm",
        bucketWinPct = 63.8,
        bucketSample = bucketSample,
        confidenceAtSuggestion = "high",
    )
}
