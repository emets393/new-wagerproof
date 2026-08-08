package com.wagerproof.app.features.mlb

import com.wagerproof.app.features.mlb.props.propChartMaximum
import com.wagerproof.app.features.mlb.props.shortPropChartDate
import com.wagerproof.core.models.MLBF5Game
import com.wagerproof.core.models.MLBF5Insight
import com.wagerproof.core.models.MLBF5Matchup
import com.wagerproof.core.models.MLBF5PitchHand
import com.wagerproof.core.models.MLBF5SplitRow
import com.wagerproof.core.models.MLBHeadlineProp
import com.wagerproof.core.models.MLBPlayerPropRow
import com.wagerproof.core.models.MLBPropComputedAtLine
import com.wagerproof.core.models.MLBPropHitSplit
import com.wagerproof.core.models.MLBPropsInsight
import com.wagerproof.core.models.MatchupSide
import com.wagerproof.core.models.PropSignal
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * MLB Player Props + First-5 widget copy and chart geometry.
 *
 * The props headline and the featured card read the same
 * `MLBPropComputedAtLine`, and the F5 headline reads the same verdicts the badge
 * does — these tests pin the sentences so a refactor can't let the prose and the
 * evidence disagree.
 */
class MLBInsightHeadlinesTest {

    // --- Player props -------------------------------------------------------

    @Test
    fun `props headline states the hot bat's fraction`() {
        assertEquals(
            "Shohei Ohtani finished over the 1.5 total bases line in 8 of 10 recent games, " +
                "the clearest prop pattern in this matchup.",
            MLBPropsInsight.summaryHeadline(
                propSignal(slot = PropSignal.Slot.HOT_BAT, over = 8, games = 10, line = 1.5),
            ),
        )
    }

    @Test
    fun `props headline points a cold bat at the Under`() {
        assertEquals(
            "Shohei Ohtani finished over the 1.5 total bases line in only 2 of 10 recent games, " +
                "so the recent pattern points to the Under.",
            MLBPropsInsight.summaryHeadline(
                propSignal(slot = PropSignal.Slot.COLD_BAT, over = 2, games = 10, line = 1.5),
            ),
        )
    }

    @Test
    fun `props headline says so when nothing qualified`() {
        assertEquals(
            "No posted player prop has a strong recent pattern. " +
                "Starter strikeout lines and top-of-the-order markets are shown for context.",
            MLBPropsInsight.summaryHeadline(null),
        )
    }

    // --- Evidence chart geometry -------------------------------------------

    @Test
    fun `chart maximum leaves headroom above the posted line`() {
        // A flat series at the line must not paint the rule on the very top edge.
        assertEquals(2.5, propChartMaximum(listOf(1.0, 1.0, 1.0), line = 1.5), 1e-9)
        // A tall bar wins over the line-derived floor.
        assertEquals(9.0, propChartMaximum(listOf(2.0, 9.0), line = 1.5), 1e-9)
        // No bars at all still yields a usable domain.
        assertEquals(1.5, propChartMaximum(emptyList(), line = 0.5), 1e-9)
    }

    @Test
    fun `chart date labels drop the year`() {
        assertEquals("7/14", shortPropChartDate("2026-07-14"))
        assertEquals("7/4", shortPropChartDate("2026-07-04T19:10:00Z"))
        assertNull(shortPropChartDate(null))
        assertNull(shortPropChartDate("2026"))
    }

    // --- First-5 ------------------------------------------------------------

    @Test
    fun `f5 summary exposes the board header inputs`() {
        val summary = MLBF5Insight.summary(
            MLBF5Matchup(
                game = f5Game(),
                awaySplit = split(games = 14, winPct = 64.3, overPct = 62.0, record = "9-5-0", totalDiff = 0.4),
                homeSplit = split(games = 11, winPct = 45.5, overPct = 58.0, record = "5-6-0", totalDiff = 0.3),
            ),
        )
        assertNotNull(summary)
        assertEquals("CHC", summary.awayAbbr)
        assertEquals("CIN", summary.homeAbbr)
        assertEquals(14, summary.awaySampleSize)
        assertEquals(11, summary.homeSampleSize)
    }

    @Test
    fun `f5 headline names the stronger side and the over lean`() {
        val summary = MLBF5Insight.summary(
            MLBF5Matchup(
                game = f5Game(),
                awaySplit = split(games = 14, winPct = 64.3, overPct = 62.0, record = "9-5-0", totalDiff = 0.4),
                homeSplit = split(games = 11, winPct = 45.5, overPct = 58.0, record = "5-6-0", totalDiff = 0.3),
            ),
        )
        assertNotNull(summary)
        assertEquals(
            "CHC has the stronger first-five win rate at 64.3%, compared with CIN at 45.5%. " +
                "The matched splits average 60% Over, creating an Over lean.",
            summary.headline,
        )
    }

    @Test
    fun `f5 headline admits when a side has no matched sample`() {
        val summary = MLBF5Insight.summary(
            MLBF5Matchup(
                game = f5Game(),
                awaySplit = split(games = 14, winPct = 64.3, overPct = 48.0, record = "9-5-0", totalDiff = 0.0),
                homeSplit = null,
            ),
        )
        assertNotNull(summary)
        assertEquals(
            "There is not enough matched data to separate the first-five side. " +
                "The total indicators do not show a clear Over or Under lean.",
            summary.headline,
        )
        assertNull(summary.homeSampleSize)
    }

    @Test
    fun `f5 summary is hidden when neither side clears the floor`() {
        assertNull(
            MLBF5Insight.summary(
                MLBF5Matchup(game = f5Game(), awaySplit = split(games = 1), homeSplit = split(games = 0)),
            ),
        )
    }

    // --- fixtures -----------------------------------------------------------

    private fun propSignal(
        slot: PropSignal.Slot,
        over: Int,
        games: Int,
        line: Double,
        market: String = "batter_total_bases",
    ): PropSignal {
        val l10 = MLBPropHitSplit(over = over, games = games, pct = over * 100 / games)
        return PropSignal(
            playerId = 660271,
            playerName = "Shohei Ohtani",
            isPitcher = false,
            teamAbbr = "LAD",
            side = MatchupSide.AWAY,
            battingOrder = 2,
            headline = MLBHeadlineProp(
                row = MLBPlayerPropRow(playerId = 660271, playerName = "Shohei Ohtani", market = market),
                computed = MLBPropComputedAtLine(
                    line = line,
                    overOdds = -115,
                    underOdds = -105,
                    l10 = l10,
                    season = MLBPropHitSplit(over = 70, games = 120, pct = 58),
                    contextualDayNight = null,
                    contextualArchetype = null,
                    chartGames = emptyList(),
                    miniStrip = emptyList(),
                ),
            ),
            slot = slot,
        )
    }

    private fun f5Game() = MLBF5Game(
        gamePk = 776543,
        officialDate = "2026-07-26",
        gameTimeEt = "19:10",
        awayTeamName = "Chicago Cubs",
        homeTeamName = "Cincinnati Reds",
        venueName = "Great American Ball Park",
        awayAbbr = "CHC",
        homeAbbr = "CIN",
        awaySpName = "Justin Steele",
        homeSpName = "Hunter Greene",
        awaySpHand = MLBF5PitchHand.LEFT,
        homeSpHand = MLBF5PitchHand.RIGHT,
        totalLine = 8.5,
        f5AwayMl = 120.0,
        f5HomeMl = -140.0,
        f5TotalLine = 4.5,
    )

    private fun split(
        games: Int,
        winPct: Double? = null,
        overPct: Double? = null,
        record: String = "-",
        totalDiff: Double? = null,
    ) = MLBF5SplitRow(
        teamAbbr = "CHC",
        games = games,
        f5Record = record,
        f5WinPct = winPct,
        f5OverPct = overPct,
        totalDiffVsSeason = totalDiff,
    )
}
