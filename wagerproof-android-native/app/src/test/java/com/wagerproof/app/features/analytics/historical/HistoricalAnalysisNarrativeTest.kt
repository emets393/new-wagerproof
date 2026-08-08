package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.MlbPitcherOption
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * The share sentence is a claim about what was filtered. Two failure modes matter:
 * a PHANTOM clause ("it's 30–110°F" on a snapshot nobody touched) asserts a filter
 * the user never set, and a MISSING clause hides the filter that produced the
 * number. These tests pin both directions, plus the three MLB sentinels that
 * caused real phantoms on shared systems.
 */
class HistoricalAnalysisNarrativeTest {

    private fun clauses(sport: HistoricalAnalysisSport, snapshot: HistoricalAnalysisUISnapshot) =
        HistoricalAnalysisCopy.narrativeClauses(sport, snapshot)

    @Test
    fun defaultsProduceNoClausesOnAnySport() {
        HistoricalAnalysisSport.entries.forEach { sport ->
            val out = clauses(sport, HistoricalAnalysisUISnapshot.defaults(sport))
            assertTrue(out.isEmpty(), "$sport invents clauses at defaults: $out")
        }
    }

    @Test
    fun everyMlbBetTypeStartsClauseFreeAtDefaults() {
        // The game-total slider bounds shift per market; resolving them from the
        // selected bet type used to paint a phantom total clause the moment an
        // F5 market was picked (f975ab90).
        listOf("ml", "rl", "total", "f5_ml", "f5_rl", "f5_total").forEach { market ->
            val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
                .copy(betType = market)
            val out = clauses(HistoricalAnalysisSport.MLB, snapshot)
            assertTrue(out.isEmpty(), "$market invents clauses at defaults: $out")
        }
    }

    @Test
    fun theGameTotalClauseAlwaysDescribesTheFullGameSlider() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
            betType = "f5_total"
            lineMin = 8.0        // full-game total slider, narrowed
            f5TotalMax = 5.0     // F5 slider, narrowed
        }
        val out = clauses(HistoricalAnalysisSport.MLB, snapshot)
        assertTrue("the game total is 8–14" in out, out.toString())
        assertTrue("the F5 total is 2–5" in out, out.toString())
        // Exactly one "total" clause per slider — never the F5 label on the
        // game-total numbers.
        assertEquals(1, out.count { it.startsWith("the game total") }, out.toString())
    }

    @Test
    fun mlbTemperatureFloorsAt30SoRestoredSnapshotsDontClaimAWeatherFilter() {
        val base = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        // Web/iOS saves carry tempMin = 30 to mean UNSET on MLB.
        assertTrue(clauses(HistoricalAnalysisSport.MLB, base.copy(tempMin = 30)).none { it.endsWith("°F") })
        assertTrue("it's 75–110°F" in clauses(HistoricalAnalysisSport.MLB, base.copy(tempMin = 75)))
        // Football keeps the -10 floor.
        val nfl = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL)
        assertTrue("it's 30–100°F" in clauses(HistoricalAnalysisSport.NFL, nfl.copy(tempMin = 30)))
    }

    @Test
    fun mlbWindCapsAt40SoLegacyMaxesReadAsUnset() {
        val base = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        assertTrue(clauses(HistoricalAnalysisSport.MLB, base.copy(windMax = 50)).none { it.contains("mph") })
        assertTrue("winds are under 12 mph" in clauses(HistoricalAnalysisSport.MLB, base.copy(windMax = 12)))
        assertTrue("winds are at least 8 mph" in clauses(HistoricalAnalysisSport.MLB, base.copy(windMin = 8)))
        assertTrue(
            "winds are 8–12 mph" in
                clauses(HistoricalAnalysisSport.MLB, base.copy(windMin = 8, windMax = 12)),
        )
    }

    @Test
    fun asOfRangesCompareAgainstTheSportsOwnDefaults() {
        // CFB scoring defaults to 0–60; comparing to NFL's 0–40 would emit a
        // permanent phantom "they score 0–60 points/game".
        val cfb = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.CFB)
        assertTrue(clauses(HistoricalAnalysisSport.CFB, cfb).none { it.startsWith("they score") })
        assertTrue(
            "they score 31–60 points/game" in
                clauses(HistoricalAnalysisSport.CFB, cfb.copy(ppg = listOf(31.0, 60.0))),
        )
        // MLB says runs, and uses its own run-rate fields.
        val mlb = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB)
        val mlbOut = clauses(HistoricalAnalysisSport.MLB, mlb.copy(rpg = listOf(4.5, 10.0)))
        assertTrue("they score 4.5–10 runs/game" in mlbOut, mlbOut.toString())
    }

    @Test
    fun mlbSituationalFiltersEachProduceAClause() {
        val out = clauses(HistoricalAnalysisSport.MLB, mlbSnapshot())
        listOf(
            "it's months 6–11",
            "it's a Fri",
            "first pitch is before 19:00 ET",
            "it's series game 2",
            "it's series 1–3 of the trip",
            "they're on 0–1 days rest",
            "it's not a doubleheader",
            "it's a division game",
            "it's interleague",
            "it's their first game after a home/road switch",
            "they're getting +1.5",
            "the F5 total is 2–5",
            "the park factor is at least 104",
            "they lost their last game",
            "they covered the run line last game",
            "their last game went under",
            "they were underdogs last game",
            "their opponent won its last game",
            "they lost the last meeting",
            "the last meeting was this season",
            "their starter is RHP",
            "the opposing starter is LHP",
            "starting Yoshinobu Yamamoto",
            "facing Dylan Cease",
            "their starter's xFIP is 2–4",
            "the opposing starter's xFIP is 3–7",
            "their starter's ERA is 0–3.2",
            "the opposing starter's ERA is 4.1–10",
            "the opposing bullpen threw 0–12 IP over the last 3 days",
            "the opposing bullpen's xFIP is 3.5–7",
            "the game is in a dome",
            "wind is in",
            "it's 75–110°F",
            "winds are under 12 mph",
            "the game total is 8–14",
            "the moneyline is -120 or worse",
            "their current streak is 2 to any (+ = wins)",
            "their run-line cover rate is 55–100%",
            "they've covered the run line 2–25 straight",
            "the opponent's run-line cover rate is 0–45%",
            "the opponent scores 0–4 runs/game",
            "the opponent allows 5–10 runs/game",
            "their last-game margin was -30 to -1 runs",
        ).forEach { expected ->
            assertTrue(expected in out, "missing clause \"$expected\" in $out")
        }
        // MLB never describes football-only line dimensions.
        assertTrue(out.none { it.contains("1H total") }, out.toString())
        assertTrue(out.none { it.contains("team total line") }, out.toString())
        assertTrue(out.none { it.contains("points") }, out.toString())
    }

    @Test
    fun footballKeepsItsOwnLastGameAndWeatherVocabulary() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).apply {
            seasonType = "regular"
            weekMin = 14
            weekMax = 14
            division = true
            lastAts = "covered"
            precip = "snow"
            restBye = "off_bye"
            referee = "Carl Cheffers"
            h2hSpreadCmp = "lower"
            spreadSide = "favorite"
            spreadMin = 3.0
            spreadMax = 7.0
            mlMin = "-200"
            mlMax = "150"
        }
        val out = clauses(HistoricalAnalysisSport.NFL, snapshot)
        assertTrue("it's the regular season" in out, out.toString())
        assertTrue("it's week 14" in out, out.toString())
        assertTrue("it's a divisional game" in out, out.toString())
        // Football says "covered", MLB says "covered the run line".
        assertTrue("they covered last game" in out, out.toString())
        assertTrue("it's snowing" in out, out.toString())
        assertTrue("they're coming off a bye" in out, out.toString())
        assertTrue("Carl Cheffers is officiating" in out, out.toString())
        assertTrue("they're more favored than the last meeting" in out, out.toString())
        assertTrue("they're laying 3–7 points" in out, out.toString())
        assertTrue("the moneyline is -200 to +150" in out, out.toString())
    }

    @Test
    fun cfbWeekRangeAndConditionsUseCfbWording() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.CFB).apply {
            gameType = "bowl"
            weather = "rain"
            neutralSite = true
            rankedMatchup = "both"
        }
        val out = clauses(HistoricalAnalysisSport.CFB, snapshot)
        assertTrue("it's a bowl game" in out, out.toString())
        assertTrue("both teams are ranked" in out, out.toString())
        assertTrue("it's at a neutral site" in out, out.toString())
        assertTrue("conditions are rain" in out, out.toString())
        // A bowl-game snapshot must not also claim a week window.
        assertTrue(out.none { it.startsWith("it's week") }, out.toString())
    }

    @Test
    fun oxfordCommaJoin() {
        assertEquals("", HistoricalAnalysisCopy.joinedClauses(emptyList()))
        assertEquals("a", HistoricalAnalysisCopy.joinedClauses(listOf("a")))
        assertEquals("a and b", HistoricalAnalysisCopy.joinedClauses(listOf("a", "b")))
        assertEquals("a, b, and c", HistoricalAnalysisCopy.joinedClauses(listOf("a", "b", "c")))
    }

    @Test
    fun midSentenceSubjectLowercasesGenericsAndLeavesProperNouns() {
        assertEquals("home games", HistoricalAnalysisCopy.midSentenceSubject("Home games"))
        assertEquals("favorites", HistoricalAnalysisCopy.midSentenceSubject("Favorites"))
        assertEquals("teams", HistoricalAnalysisCopy.midSentenceSubject("Teams"))
        assertEquals("LAD, SD", HistoricalAnalysisCopy.midSentenceSubject("LAD, SD"))
        assertEquals("Andy Reid's teams", HistoricalAnalysisCopy.midSentenceSubject("Andy Reid's teams"))
    }

    @Test
    fun mlbScopeNoteNeverMentionsFbs() {
        val sport = HistoricalAnalysisSport.MLB
        val base = HistoricalAnalysisUISnapshot.defaults(sport)
        assertEquals(
            "All MLB teams in every past game that matches your filters.",
            HistoricalAnalysisCopy.scopeNote(sport, base),
        )
        assertEquals(
            "LAD, SD in every past game that matches your filters.",
            HistoricalAnalysisCopy.scopeNote(sport, base.copy(teams = listOf("LAD", "SD"))),
        )
        assertFalse(HistoricalAnalysisCopy.scopeNote(sport, base).contains("FBS"))
    }

    @Test
    fun overUnderMarketsCarryAnUnderVerb() {
        assertTrue("total" in HistoricalAnalysisCopy.overUnderMarkets)
        assertTrue("f5_total" in HistoricalAnalysisCopy.overUnderMarkets)
        assertFalse("rl" in HistoricalAnalysisCopy.overUnderMarkets)
        assertEquals("went under", HistoricalAnalysisCopy.underVerb("total"))
        assertEquals("went under the F5 total", HistoricalAnalysisCopy.underVerb("f5_total"))
        assertEquals("stayed under their team total", HistoricalAnalysisCopy.underVerb("team_total"))
        assertEquals("went under the 1H total", HistoricalAnalysisCopy.underVerb("h1_total"))
    }

    @Test
    fun filterChipLabelsMatchTheOnScreenChipRow() {
        val sport = HistoricalAnalysisSport.MLB
        val snapshot = mlbSnapshot()
        val onScreen = HistoricalAnalysisActiveChips.build(
            sport,
            snapshot,
            HistoricalAnalysisFilterBuilder.seasonFloor(snapshot.betType, sport),
        ).map { it.label }
        assertEquals(onScreen, HistoricalAnalysisCopy.filterChipLabels(sport, snapshot))
        assertTrue(onScreen.isNotEmpty())
    }

    private fun mlbSnapshot() = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.MLB).apply {
        betType = "rl"
        rlSide = "plus"
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
        rlCoverPct = listOf(55.0, 100.0)
        rlStreak = listOf(2, 25)
        h2hLastWin = "no"
        h2hSameSeason = true
        oppRlCoverPct = listOf(0.0, 45.0)
        oppRpg = listOf(0.0, 4.0)
        oppRapg = listOf(5.0, 10.0)
        oppLastResult = "won"
    }
}
