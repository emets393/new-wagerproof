package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisBar
import com.wagerproof.core.models.HistoricalAnalysisBarOption
import com.wagerproof.core.models.HistoricalAnalysisBreakdownRow
import com.wagerproof.core.models.HistoricalAnalysisCoverage
import com.wagerproof.core.models.HistoricalAnalysisOverall
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * A shared card is a public claim, and the sentence on it has to match the search
 * that produced the number. The failure modes under test:
 *
 * - a PHANTOM clause — the card claims a filter the user never set;
 * - a DROPPED filter — focusing on one split side overwrites the subject, and the
 *   directional filter that subject used to carry disappears from the sentence;
 * - a metric that doesn't belong to the focus (team card printing the overall).
 */
class TrendsShareContextTest {

    private val coverage = HistoricalAnalysisCoverage(seasonMin = 2023, seasonMax = 2025, nBets = 400, nGames = 400)

    private fun response(
        betType: String = "fg_spread",
        overall: HistoricalAnalysisOverall = HistoricalAnalysisOverall(n = 400, wins = 204, hitPct = 51.0, roi = 1.2),
        bars: List<HistoricalAnalysisBar> = listOf(
            HistoricalAnalysisBar(
                "home_away",
                listOf(
                    HistoricalAnalysisBarOption("home", n = 200, wins = 88, hitPct = 44.0, roi = -6.0),
                    HistoricalAnalysisBarOption("away", n = 200, wins = 116, hitPct = 58.0, roi = 7.4),
                ),
            ),
        ),
        byTeam: List<HistoricalAnalysisBreakdownRow> = emptyList(),
    ) = HistoricalAnalysisResponse(
        betType = betType,
        coverage = coverage,
        baselinePct = 50.0,
        overall = overall,
        bars = bars,
        byTeam = byTeam,
    )

    private fun context(
        sport: HistoricalAnalysisSport = HistoricalAnalysisSport.NFL,
        focus: InfographicFocus = InfographicFocus.Overall,
        analysis: HistoricalAnalysisResponse = response(),
        mutate: HistoricalAnalysisUISnapshot.() -> Unit = {},
    ) = TrendsShareContext(
        sport = sport,
        snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply(mutate),
        analysis = analysis,
        focus = focus,
    )

    // MARK: - Metrics follow the focus

    @Test
    fun focusingASidePullsThatSidesSlice() {
        val ctx = context(focus = InfographicFocus.Side("away"))
        assertEquals(58.0, ctx.metrics.hitPct)
        assertEquals(116, ctx.metrics.wins)
        assertEquals(200, ctx.metrics.n)
    }

    @Test
    fun focusingATeamDerivesWinsFromTheRate() {
        // Breakdown rows carry no wins column, so the record has to be derived —
        // printing the overall record next to a team's rate would be a lie.
        val analysis = response(byTeam = listOf(HistoricalAnalysisBreakdownRow(team = "KC", n = 40, hitPct = 62.5, roi = 12.0)))
        val ctx = context(focus = InfographicFocus.Team("KC"), analysis = analysis)
        assertEquals(40, ctx.metrics.n)
        assertEquals(25, ctx.metrics.wins)
        assertEquals(62.5, ctx.metrics.hitPct)
    }

    @Test
    fun anUnknownFocusFallsBackToTheHeadlineSlice() {
        val ctx = context(focus = InfographicFocus.Team("Nobody"))
        assertEquals(51.0, ctx.metrics.hitPct)
    }

    // MARK: - Subject + verb

    @Test
    fun sideFocusesReadAsTheirOwnSubject() {
        assertEquals("home teams" to "covered", context(focus = InfographicFocus.Side("home")).subjectVerb)
        assertEquals("road teams" to "covered", context(focus = InfographicFocus.Side("away")).subjectVerb)
        assertEquals("favorites" to "covered", context(focus = InfographicFocus.Side("favorite")).subjectVerb)
        assertEquals("underdogs" to "covered", context(focus = InfographicFocus.Side("underdog")).subjectVerb)
    }

    @Test
    fun overUnderFocusesReadAsTheMarketNotTheTeam() {
        val ctx = context(
            focus = InfographicFocus.Side("under"),
            analysis = response(betType = "h1_total"),
        ) { betType = "h1_total" }
        assertEquals("the 1H under" to "hit", ctx.subjectVerb)

        val teamTotal = context(
            focus = InfographicFocus.Side("over"),
            analysis = response(betType = "team_total"),
        ) { betType = "team_total" }
        assertEquals("the over on team totals" to "hit", teamTotal.subjectVerb)
    }

    @Test
    fun aTeamOnAGameTotalReadsAsThatTeamsGames() {
        val mlb = context(
            sport = HistoricalAnalysisSport.MLB,
            focus = InfographicFocus.Team("New York Yankees"),
            analysis = response(betType = "total"),
        ) { betType = "total" }
        assertEquals("New York Yankees games" to "went over", mlb.subjectVerb)

        val spread = context(focus = InfographicFocus.Team("KC"))
        assertEquals("KC" to "covered", spread.subjectVerb)
    }

    @Test
    fun theOverallSubjectIsLowercasedMidSentence() {
        val (subject, _) = context { side = "home" }.subjectVerb
        assertEquals("home", subject)
    }

    // MARK: - Clauses

    @Test
    fun defaultsShareNoClauses() {
        HistoricalAnalysisSport.entries.forEach { sport ->
            assertTrue(context(sport = sport).clauses.isEmpty(), "$sport invents clauses at defaults")
        }
    }

    @Test
    fun focusingASideKeepsTheDirectionalFilterInTheSentence() {
        // Subject becomes "the under", so "home favorites" would otherwise vanish
        // from a sentence that is still describing a home-favorites-only sample.
        val ctx = context(focus = InfographicFocus.Side("under"), analysis = response(betType = "fg_total")) {
            betType = "fg_total"
            side = "home"
        }
        assertTrue("playing at home" in ctx.clauses, ctx.clauses.toString())

        val ml = context(focus = InfographicFocus.Side("home"), analysis = response(betType = "fg_ml")) {
            betType = "fg_ml"
            favDog = "underdog"
        }
        assertTrue("as underdogs" in ml.clauses, ml.clauses.toString())

        val spread = context(focus = InfographicFocus.Side("away")) { spreadSide = "favorite" }
        assertTrue("as favorites" in spread.clauses, spread.clauses.toString())
    }

    @Test
    fun theFocusedSideIsNeverAlsoAClause() {
        // "When playing at home, home teams covered…" is a stutter, and worse, it
        // implies two filters where there is one.
        val ctx = context(focus = InfographicFocus.Side("home")) { side = "home" }
        assertFalse("playing at home" in ctx.clauses, ctx.clauses.toString())
    }

    @Test
    fun overallFocusLeavesDirectionalFiltersInTheSubject() {
        val ctx = context { side = "home"; spreadSide = "favorite" }
        assertFalse("playing at home" in ctx.clauses)
        assertFalse("as favorites" in ctx.clauses)
        assertEquals("home favorites", ctx.subjectVerb.first)
    }

    // MARK: - Sentence composition

    @Test
    fun theSentenceNamesEveryActiveFilter() {
        val ctx = context {
            // Weeks only narrow inside a season type, which is why the clause
            // builder gates them on it — set both, as the UI does.
            seasonType = "regular"
            weekMin = 12
            weekMax = 12
            primetime = true
        }
        val sentence = ctx.narrativeSentence()
        assertTrue(sentence.startsWith("When "), sentence)
        assertTrue("it's the regular season" in sentence, sentence)
        assertTrue("it's week 12" in sentence, sentence)
        assertTrue("it's primetime" in sentence, sentence)
        assertTrue(sentence.endsWith("teams covered 51% of the time."), sentence)
        // Every clause the builder produced has to appear — a card that names two
        // of three filters overstates the sample it is describing.
        ctx.clauses.forEach { assertTrue(it in sentence, "$it missing from: $sentence") }
    }

    @Test
    fun anUnfilteredSearchSaysSoInsteadOfClaimingAFilter() {
        val sentence = context().narrativeSentence()
        assertEquals("Across every game since 2023, teams covered 51% of the time.", sentence)
    }

    @Test
    fun theCondensedSituationLineCapsAtThreeClausesAndCountsTheRest() {
        val ctx = context {
            weekMin = 12
            weekMax = 12
            primetime = true
            division = true
            dome = "dome"
            seasonType = "regular"
        }
        val line = ctx.situationLine(capitalized = false)
        assertTrue(line.startsWith("when "), line)
        assertTrue(line.endsWith("more)"), line)
        assertEquals(ctx.clauses.size - 3, line.substringAfter("(+").substringBefore(" more)").toInt())
    }

    // MARK: - Top lists

    @Test
    fun topListsIgnoreTinySamplesAndPlaceholderRows() {
        val rows = listOf(
            HistoricalAnalysisBreakdownRow(team = "One-gamer", n = 1, hitPct = 100.0),
            HistoricalAnalysisBreakdownRow(team = null, n = 30, hitPct = 90.0),
            HistoricalAnalysisBreakdownRow(team = "Solid", n = 30, hitPct = 60.0),
            HistoricalAnalysisBreakdownRow(team = "Bigger sample", n = 60, hitPct = 60.0),
        )
        val sorted = TrendsShareContext.qualifyingSorted(rows)
        assertEquals(listOf("Bigger sample", "Solid"), sorted.map { it.label })
    }
}
