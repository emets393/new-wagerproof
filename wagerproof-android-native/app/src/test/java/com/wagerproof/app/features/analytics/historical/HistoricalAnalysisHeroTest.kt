package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisBar
import com.wagerproof.core.models.HistoricalAnalysisBarOption
import com.wagerproof.core.models.HistoricalAnalysisCoverage
import com.wagerproof.core.models.HistoricalAnalysisOverall
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.MlbPitcherOption
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The hero is the one number most users read. Two ways it can lie:
 *
 * 1. On an over/under market it prints the OVER rate even when the under is the
 *    side that hit — "games went over 41.3%" hides a 58.7% under.
 * 2. On a two-sided market with only game-level filters, the overall is a forced
 *    ~50% tautology; showing it as a finding is noise, and showing the wrong
 *    baseline next to it makes the delta wrong too.
 */
class HistoricalAnalysisHeroTest {

    private fun response(
        betType: String,
        baseline: Double = 50.0,
        overall: HistoricalAnalysisOverall = HistoricalAnalysisOverall(n = 200, wins = 83, hitPct = 41.3, roi = -4.0),
        bars: List<HistoricalAnalysisBar> = emptyList(),
    ) = HistoricalAnalysisResponse(
        betType = betType,
        coverage = HistoricalAnalysisCoverage(seasonMin = 2023, seasonMax = 2025, nBets = 200, nGames = 200),
        baselinePct = baseline,
        overall = overall,
        bars = bars,
    )

    private fun overUnderBar(overPct: Double, underPct: Double) = HistoricalAnalysisBar(
        dimension = "over_under",
        options = listOf(
            HistoricalAnalysisBarOption(side = "over", n = 200, wins = 83, hitPct = overPct, roi = -4.0),
            HistoricalAnalysisBarOption(side = "under", n = 200, wins = 117, hitPct = underPct, roi = 6.5),
        ),
    )

    // MARK: - Over/under winning-side flip

    @Test
    fun theUnderHeadlinesWhenItOutHitsTheOver() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply { betType = "fg_total" }
        val data = response("fg_total", baseline = 48.0, bars = listOf(overUnderBar(41.3, 58.7)))
        val hero = HistoricalAnalysisCopy.heroSlice(snapshot, data)
        assertEquals(58.7, hero.metrics.hitPct)
        assertEquals(117, hero.metrics.wins)
        assertEquals("went under", hero.verb)
        assertEquals("Under", hero.outcome)
        // The league's over rate is not the under's baseline — it must flip too,
        // or the "+X pts vs baseline" line measures against the wrong number.
        assertEquals(52.0, hero.baseline)
    }

    @Test
    fun theOverKeepsTheHeadlineWhenItWins() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply { betType = "total" }
        val data = response(
            "total",
            baseline = 49.0,
            overall = HistoricalAnalysisOverall(n = 300, wins = 168, hitPct = 56.0, roi = 3.0),
            bars = listOf(overUnderBar(56.0, 44.0)),
        )
        val hero = HistoricalAnalysisCopy.heroSlice(snapshot, data)
        assertEquals(56.0, hero.metrics.hitPct)
        assertEquals("went over", hero.verb)
        assertEquals("Over", hero.outcome)
        assertEquals(49.0, hero.baseline)
    }

    @Test
    fun theFlipUsesTheMarketsOwnUnderVerb() {
        listOf(
            "h1_total" to "went under the 1H total",
            "f5_total" to "went under the F5 total",
            "team_total" to "stayed under their team total",
        ).forEach { (market, verb) ->
            val sport = if (market == "f5_total") HistoricalAnalysisSport.MLB else HistoricalAnalysisSport.NFL
            val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply { betType = market }
            val hero = HistoricalAnalysisCopy.heroSlice(
                snapshot,
                response(market, bars = listOf(overUnderBar(45.0, 55.0))),
            )
            assertEquals(verb, hero.verb, market)
        }
    }

    @Test
    fun sideMarketsNeverFlip() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL)
        // A spread search can still carry an over_under bar; it must not hijack the headline.
        val hero = HistoricalAnalysisCopy.heroSlice(
            snapshot,
            response("fg_spread", bars = listOf(overUnderBar(41.0, 59.0))),
        )
        assertEquals("covered", hero.verb)
        assertEquals("Cover", hero.outcome)
        assertEquals(41.3, hero.metrics.hitPct)
    }

    // MARK: - Symmetric-split detection (football)

    @Test
    fun everyFootballSideMarketIsSymmetricAtDefaults() {
        listOf(HistoricalAnalysisSport.NFL, HistoricalAnalysisSport.CFB).forEach { sport ->
            listOf("fg_spread", "fg_ml", "h1_spread", "h1_ml").forEach { market ->
                val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply { betType = market }
                assertTrue(snapshot.isSideSymmetricFor(sport), "$sport/$market should be symmetric at defaults")
            }
        }
    }

    @Test
    fun totalMarketsAreNeverSymmetric() {
        val sport = HistoricalAnalysisSport.NFL
        listOf("fg_total", "h1_total", "team_total").forEach { market ->
            val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply { betType = market }
            assertFalse(snapshot.isSideSymmetricFor(sport), "$market is one row per game, not a mirror")
        }
    }

    @Test
    fun gameLevelFiltersKeepTheMirrorIntact() {
        val sport = HistoricalAnalysisSport.NFL
        val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply {
            weekMin = 10
            weekMax = 14
            primetime = true
            dome = "outdoor"
            tempMax = 32
            spreadMin = 3.0
            spreadMax = 7.0
            referee = "Carl Cheffers"
            minGames = 4
        }
        assertTrue(snapshot.isSideSymmetricFor(sport))
    }

    @Test
    fun subjectTeamFiltersBreakTheMirror() {
        val sport = HistoricalAnalysisSport.NFL
        val breakers: List<Pair<String, HistoricalAnalysisUISnapshot.() -> Unit>> = listOf(
            "side" to { side = "home" },
            "spreadSide" to { spreadSide = "favorite" },
            "teams" to { teams = listOf("KC") },
            "teamDivisions" to { teamDivisions = listOf("AFC East") },
            "winPct" to { winPct = listOf(60.0, 100.0) },
            "lastResult" to { lastResult = "lost" },
            "oppLastTotal" to { oppLastTotal = "under" },
            "mlMin" to { mlMin = "-200" },
            "restBye" to { restBye = "off_bye" },
            "coach" to { coach = "Andy Reid" },
        )
        breakers.forEach { (name, mutate) ->
            val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply(mutate)
            assertFalse(snapshot.isSideSymmetricFor(sport), "$name must break side symmetry")
        }
    }

    @Test
    fun conferenceBreaksTheMirrorOnCfb() {
        // A conference filter selects the SUBJECT team's conference, so only one
        // of a game's two mirror rows survives (web CFB_SIDE_BREAKING_DIMS).
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.CFB).apply {
            selectedConferences = listOf("SEC")
        }
        assertFalse(snapshot.isSideSymmetricFor(HistoricalAnalysisSport.CFB))
    }

    // MARK: - Symmetric-split detection (MLB)

    @Test
    fun everyMlbSideMarketIsSymmetricAtDefaults() {
        listOf("ml", "rl", "f5_ml", "f5_rl").forEach { market ->
            val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply { betType = market }
            assertTrue(snapshot.isSideSymmetricFor(HistoricalAnalysisSport.MLB), "$market should be symmetric at defaults")
        }
    }

    @Test
    fun mlbGameLevelFiltersKeepTheMirrorIntact() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
            monthMin = 6
            monthMax = 8
            dome = "outdoor"
            windDir = "out"
            doubleheader = true
            seriesGames = listOf(1)
            interleague = true
            division = false
            lineMin = 8.0
            pfRunsMax = 105.0
            minGames = 10
        }
        assertTrue(snapshot.isSideSymmetricFor(HistoricalAnalysisSport.MLB))
    }

    @Test
    fun mlbSubjectTeamFiltersBreakTheMirror() {
        val breakers: List<Pair<String, HistoricalAnalysisUISnapshot.() -> Unit>> = listOf(
            "side" to { side = "home" },
            "rlSide" to { rlSide = "minus" },
            "teams" to { teams = listOf("NYY") },
            "oppSpHand" to { oppSpHand = "L" },
            "restRange" to { restMin = 2 },
            "trip" to { tripMin = 2 },
            "switchGame" to { switchGame = true },
            "sp" to { sp = listOf(MlbPitcherOption(id = 1, name = "Gerrit Cole")) },
            "winPct" to { winPct = listOf(60.0, 100.0) },
            "streak" to { streakMin = "3" },
            "h2hLastWin" to { h2hLastWin = "yes" },
            "oppRpg" to { oppRpg = listOf(5.0, 10.0) },
        )
        breakers.forEach { (name, mutate) ->
            val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply(mutate)
            assertFalse(snapshot.isSideSymmetricFor(HistoricalAnalysisSport.MLB), "$name must break MLB side symmetry")
        }
    }

    @Test
    fun mlbTotalsAreNeverSymmetric() {
        listOf("total", "f5_total").forEach { market ->
            val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply { betType = market }
            assertFalse(snapshot.isSideSymmetricFor(HistoricalAnalysisSport.MLB), market)
        }
    }
}
