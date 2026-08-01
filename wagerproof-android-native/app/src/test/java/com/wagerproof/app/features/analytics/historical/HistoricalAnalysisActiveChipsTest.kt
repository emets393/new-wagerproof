package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.MlbPitcherOption
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * A filter with no chip is a filter the user can neither see nor clear — the exact
 * failure mode that made restored web/iOS systems silently narrow Android results.
 * These tests hold the chip list to two rules: nothing shows at defaults (no
 * phantom filters), and clearing a chip returns that dimension to its sport default.
 */
class HistoricalAnalysisActiveChipsTest {

    private fun floorFor(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot) =
        HistoricalAnalysisFilterBuilder.seasonFloor(snapshot.betType, sport)

    private fun chips(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot) =
        HistoricalAnalysisActiveChips.build(sport, snapshot, floorFor(sport, snapshot))

    @Test
    fun defaultsProduceNoChipsBeyondTheSeasonWindow() {
        HistoricalAnalysisSport.entries.forEach { sport ->
            val defaults = HistoricalAnalysisUISnapshot.defaults(sport)
            val labels = chips(sport, defaults).map { it.label }
            val phantom = labels.filterNot { it.startsWith("Seasons ") }
            assertTrue(phantom.isEmpty(), "$sport shows phantom chips at defaults: $phantom")
        }
    }

    @Test
    fun theSeasonChipIsAbsentWhenTheWindowSpansTheWholeWarehouse() {
        val sport = HistoricalAnalysisSport.NFL
        val wide = HistoricalAnalysisUISnapshot.defaults(sport).apply {
            seasonMin = HistoricalAnalysisFilterBuilder.seasonFloor(betType, sport)
            seasonMax = sport.seasonMax
        }
        assertTrue(chips(sport, wide).isEmpty())
    }

    @Test
    fun everyClearedChipReturnsItsDimensionToTheSportDefault() {
        // One representative snapshot per sport, every sheet's dimensions moved.
        listOf(
            HistoricalAnalysisSport.NFL to nflSnapshot(),
            HistoricalAnalysisSport.CFB to cfbSnapshot(),
            HistoricalAnalysisSport.MLB to mlbSnapshot(),
        ).forEach { (sport, snapshot) ->
            val defaults = HistoricalAnalysisUISnapshot.defaults(sport).also {
                it.betType = snapshot.betType
                it.seasonMin = floorFor(sport, snapshot)
            }
            var working = snapshot.copy()
            chips(sport, snapshot).forEach { chip ->
                working = working.copy().also(chip.clear)
            }
            // Clearing every chip lands back on defaults (bet type and the legacy
            // decode-only fields aside — those have clear-only chips too).
            assertEquals(defaults, working, "$sport did not fully reset via its chips")
        }
    }

    @Test
    fun cfbTeamFormAndOpponentFiltersAreVisible() {
        // iOS only emits these chips on NFL, so a CFB system restored from web
        // narrowed the sample with nothing on screen to show for it.
        val sport = HistoricalAnalysisSport.CFB
        val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply {
            winPct = listOf(60.0, 100.0)
            atsWinStreak = listOf(3, 16)
            oppWinPct = listOf(0.0, 40.0)
            h2hLastWin = "yes"
            lastMargin = listOf(7, 80)
        }
        val labels = chips(sport, snapshot).map { it.label }
        assertTrue(labels.any { it.startsWith("Win% ") }, labels.toString())
        assertTrue(labels.any { it.startsWith("ATS streak ") }, labels.toString())
        assertTrue(labels.any { it.startsWith("Opp win% ") }, labels.toString())
        assertTrue(labels.any { it.startsWith("H2H last: ") }, labels.toString())
        assertTrue(labels.any { it.startsWith("Last margin ") }, labels.toString())
    }

    @Test
    fun cfbAsOfChipsUseCfbBoundsNotNflOnes() {
        // CFB defaults ppg to 0–60; comparing against NFL's 0–40 would show a
        // permanent phantom "PPG 0–60" chip.
        val sport = HistoricalAnalysisSport.CFB
        val defaults = HistoricalAnalysisUISnapshot.defaults(sport)
        assertEquals(listOf(0.0, 60.0), defaults.ppg)
        assertTrue(chips(sport, defaults).none { it.label.startsWith("PPG") })

        val narrowed = defaults.copy(ppg = listOf(24.0, 60.0))
        assertEquals(listOf("PPG 24–60"), chips(sport, narrowed).map { it.label }.filter { it.startsWith("PPG") })
    }

    @Test
    fun mlbPitchingAndScheduleDimensionsEachGetTheirOwnChip() {
        val sport = HistoricalAnalysisSport.MLB
        val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).apply {
            sp = listOf(MlbPitcherOption(id = 1, name = "Tarik Skubal", hand = "L", team = "DET"))
            oppSpHand = "R"
            spEraMax = 3.0
            bpIpMin = 4.0
            seriesGames = listOf(1, 2)
            restMin = 2
            timeMin = "13:00"
            windDir = "out"
            pfRunsMax = 95.0
        }
        val labels = chips(sport, snapshot).map { it.label }
        assertTrue("SP: Tarik Skubal" in labels, labels.toString())
        assertTrue("Opp SP RHP" in labels, labels.toString())
        assertTrue(labels.any { it.startsWith("SP ERA ") }, labels.toString())
        assertTrue(labels.any { it.startsWith("Opp bullpen IP ") }, labels.toString())
        assertTrue("Series game 1, 2" in labels, labels.toString())
        assertTrue(labels.any { it.startsWith("Rest ") }, labels.toString())
        assertTrue(labels.any { it.startsWith("Start 13:00") }, labels.toString())
        assertTrue("Wind out" in labels, labels.toString())
        assertTrue(labels.any { it.startsWith("Park factor ") }, labels.toString())
    }

    @Test
    fun sideAndFavDogChipsFollowTheSelectedMarket() {
        val sport = HistoricalAnalysisSport.NFL
        // Game totals are game-level: neither Side nor fav/dog reaches the RPC, so
        // neither may show a chip that implies it did.
        val total = HistoricalAnalysisUISnapshot.defaults(sport).apply {
            betType = "fg_total"
            side = "home"
            favDog = "favorite"
        }
        val totalLabels = chips(sport, total).map { it.label }
        assertTrue("Home" !in totalLabels, totalLabels.toString())
        assertTrue("Favorites" !in totalLabels, totalLabels.toString())

        val moneyline = HistoricalAnalysisUISnapshot.defaults(sport).apply {
            betType = "fg_ml"
            side = "away"
            favDog = "underdog"
        }
        val mlLabels = chips(sport, moneyline).map { it.label }
        assertTrue("Away" in mlLabels, mlLabels.toString())
        assertTrue("Underdogs" in mlLabels, mlLabels.toString())
    }

    @Test
    fun moneylineChipReadsAsAPriceWindow() {
        val sport = HistoricalAnalysisSport.NFL
        val base = HistoricalAnalysisUISnapshot.defaults(sport)
        assertEquals(
            "ML -200 to +150",
            chips(sport, base.copy(mlMin = "-200", mlMax = "+150")).single { it.label.startsWith("ML ") }.label,
        )
        assertEquals(
            "ML ≥ -200",
            chips(sport, base.copy(mlMin = "-200")).single { it.label.startsWith("ML ") }.label,
        )
        assertEquals(
            "ML ≤ +150",
            chips(sport, base.copy(mlMax = "+150")).single { it.label.startsWith("ML ") }.label,
        )
    }

    private fun nflSnapshot() = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
        teams = listOf("KC")
        opponents = listOf("BUF")
        teamDivisions = listOf("AFC East")
        daysOfWeek = listOf("Thu")
        side = "home"
        spreadSide = "favorite"
        spreadMin = 3.0
        h1SpreadMax = 9.0
        h1TotalMin = 19.0
        ttLineMax = 27.0
        oppTtLineMin = 15.0
        oppSpreadSide = "underdog"
        mlMin = "-180"
        h1MlMax = "+120"
        oppMlMin = "-140"
        lineMax = 51.5
        seasonType = "regular"
        weekMax = 14
        primetime = true
        division = true
        dome = "dome"
        precip = "snow"
        tempMax = 45
        windMax = 22
        restBye = "off_bye"
        coach = "Andy Reid"
        referee = "Carl Cheffers"
        lastResult = "won"
        lastAts = "covered"
        lastTotal = "over"
        lastRole = "favorite"
        lastOt = true
        lastMargin = listOf(7, 60)
        winPct = listOf(55.0, 100.0)
        winStreak = listOf(2, 16)
        above500 = true
        winPctGtOpp = true
        ppg = listOf(24.0, 40.0)
        minGames = 6
        atsWinPct = listOf(52.0, 100.0)
        avgCoverMargin = listOf(0.0, 15.0)
        overPct = listOf(55.0, 100.0)
        prevWins = listOf(10, 16)
        madePlayoffsPrev = true
        moreWinsThanOppPrev = true
        h2hLastWin = "yes"
        h2hSpreadCmp = "lower"
        oppWinPct = listOf(0.0, 45.0)
        oppLastResult = "lost"
        oppLastOt = false
        oppLastMargin = listOf(-60, -3)
    }

    private fun cfbSnapshot() = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.CFB).apply {
        selectedConferences = listOf("SEC")
        teams = listOf("Georgia")
        gameType = "regular"
        weekMin = 4
        rankedMatchup = "both"
        conferenceGame = true
        neutralSite = false
        weather = "rain"
        dome = "outdoor"
        tempMin = 40
        windMax = 15
        restBye = "short"
        daysOfWeek = listOf("Sat")
        spreadSide = "underdog"
        spreadMax = 21.0
        lineMin = 48.0
        lastAts = "not"
        lastMargin = listOf(-80, -14)
        ppg = listOf(31.0, 60.0)
        oppPaPg = listOf(0.0, 20.0)
        h2hLastOver = "no"
    }

    private fun mlbSnapshot() = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
        betType = "rl"
        teams = listOf("LAD")
        opponents = listOf("SD")
        rlSide = "plus"
        favDog = "underdog"
        side = "away"
        mlMax = "-120"
        lineMin = 8.0
        f5TotalMax = 5.0
        monthMin = 6
        daysOfWeek = listOf("Fri")
        timeMax = "19:00"
        seriesGames = listOf(2)
        tripMax = 3
        switchGame = true
        restMax = 1
        doubleheader = false
        interleague = true
        division = true
        dome = "dome"
        tempMin = 75
        windMax = 12
        windDir = "in"
        pfRunsMin = 104.0
        sp = listOf(MlbPitcherOption(id = 2, name = "Yoshinobu Yamamoto", hand = "R", team = "LAD"))
        oppSp = listOf(MlbPitcherOption(id = 3, name = "Dylan Cease", hand = "R", team = "SD"))
        spHand = "R"
        oppSpHand = "L"
        spXfipMax = 4.0
        oppSpXfipMin = 3.0
        spEraMax = 3.2
        oppSpEraMin = 4.1
        bpIpMax = 12.0
        bpXfipMin = 3.5
        lastResult = "lost"
        lastAts = "covered"
        lastTotal = "under"
        lastRole = "underdog"
        lastMargin = listOf(-30, -1)
        streakMin = "2"
        winPct = listOf(50.0, 100.0)
        winStreak = listOf(3, 25)
        rpg = listOf(4.5, 10.0)
        rapg = listOf(0.0, 4.0)
        runDiffPg = listOf(0.5, 4.0)
        minGames = 20
        rlCoverPct = listOf(55.0, 100.0)
        rlStreak = listOf(2, 25)
        overPct = listOf(52.0, 100.0)
        prevWinPct = listOf(50.0, 100.0)
        h2hLastWin = "no"
        h2hLastMargin = listOf(-30, -2)
        h2hSameSeason = true
        oppWinPct = listOf(0.0, 48.0)
        oppRlCoverPct = listOf(0.0, 45.0)
        oppRpg = listOf(0.0, 4.0)
        oppRapg = listOf(5.0, 10.0)
        oppLastResult = "won"
        oppLastMargin = listOf(3, 30)
    }
}
