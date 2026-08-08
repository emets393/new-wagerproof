package com.wagerproof.core.services

import com.wagerproof.core.models.MLBTeamTrendRecord
import com.wagerproof.core.models.MLBTrendsSlateBundle
import com.wagerproof.core.models.NFLTeamTrendRecord
import com.wagerproof.core.models.NFLTrendH2HCell
import com.wagerproof.core.models.NFLTrendMatchupRecord
import com.wagerproof.core.models.NFLTrendSplitCell
import com.wagerproof.core.models.NFLTrendSplits
import com.wagerproof.core.models.NFLTrendsSlateBundle
import com.wagerproof.core.models.OutliersTrendsGame
import com.wagerproof.core.models.OutliersTrendsMLBContext
import com.wagerproof.core.models.ParlayGodCategory
import com.wagerproof.core.models.ParlayGodNFLContext
import com.wagerproof.core.models.ParlayLeg
import com.wagerproof.core.models.ParlaySport
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Pure-function tests for the Parlay God engine: odds math, leg assembly rules
 * (dedup / uniqueness / conflicts / market cap), and ticket building. Port of
 * iOS `Tests/WagerproofStoresTests/ParlayGodEngineTests.swift`, plus coverage
 * for the two Android-only seams — the ties-away-from-zero rounding helper that
 * replaces Swift's `Double.rounded()`, and the injected [ParlayGodNFLContext]
 * that replaces iOS's `OutliersTrendsGame.nflContext`.
 *
 * The extraction rules were validated against live data first — see
 * `.context/parlay_god_demo.py` for the reference implementation.
 */
class ParlayGodEngineTest {

    // MARK: - Odds math

    @Test
    fun decimalOddsConversion() {
        assertEquals(2.0, ParlayGodEngine.decimalOdds(100), 1e-9)
        assertEquals(1.909, ParlayGodEngine.decimalOdds(-110), 0.001)
        assertEquals(2.5, ParlayGodEngine.decimalOdds(150), 1e-9)
        assertEquals(1.5, ParlayGodEngine.decimalOdds(-200), 1e-9)
    }

    @Test
    fun americanTextRoundTrip() {
        assertEquals("+150", ParlayGodEngine.americanText(2.5))
        assertEquals("-200", ParlayGodEngine.americanText(1.5))
        assertEquals("+100", ParlayGodEngine.americanText(2.0))
        // d <= 1 is not a price.
        assertEquals("-", ParlayGodEngine.americanText(1.0))
    }

    @Test
    fun combinedOddsMatchesHandMath() {
        // -176, +122, +114 → 1.568 * 2.22 * 2.14 = 7.4497 → +645
        val legs = listOf(
            makeLeg(subject = "A", game = "1", odds = -176),
            makeLeg(subject = "B", game = "2", odds = 122),
            makeLeg(subject = "C", game = "3", odds = 114),
        )
        assertEquals("+645", ParlayGodEngine.combinedOddsText(legs))
    }

    @Test
    fun roundingIsTiesAwayFromZero() {
        // Kotlin's roundToInt() is ties-toward-positive-infinity, so -112.5
        // would become -112 and silently under-price a leg. Swift's
        // Double.rounded() (which the iOS engine uses) is ties-away-from-zero.
        assertEquals(-113.0, ParlayGodEngine.roundAwayFromZero(-112.5), 1e-9)
        assertEquals(113.0, ParlayGodEngine.roundAwayFromZero(112.5), 1e-9)
        assertEquals(-112.0, ParlayGodEngine.roundAwayFromZero(-112.4), 1e-9)
        assertEquals(0.0, ParlayGodEngine.roundAwayFromZero(0.0), 1e-9)
    }

    // MARK: - Assembly

    @Test
    fun assemblePrefersDeeperStreaks() {
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 5),
            makeLeg(subject = "B", game = "2", odds = -110, n = 10),
            makeLeg(subject = "C", game = "3", odds = -110, n = 8),
        )
        val chosen = ParlayGodEngine.assemble(pool, maxLegs = 2, onePerGame = true)
        assertEquals(listOf("B", "C"), chosen.map { it.subject })
    }

    @Test
    fun assembleRejectsDuplicateSubjects() {
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 10, bet = "X ML"),
            makeLeg(subject = "A", game = "1", odds = -110, n = 8, bet = "X -1.5"),
            makeLeg(subject = "B", game = "2", odds = -110, n = 5),
        )
        val chosen = ParlayGodEngine.assemble(pool, onePerGame = true)
        assertEquals(listOf("A", "B"), chosen.map { it.subject })
    }

    @Test
    fun assembleOnePerGame() {
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 10),
            makeLeg(subject = "B", game = "1", odds = -110, n = 9),
            makeLeg(subject = "C", game = "2", odds = -110, n = 5),
        )
        val chosen = ParlayGodEngine.assemble(pool, onePerGame = true)
        assertEquals(listOf("A", "C"), chosen.map { it.subject })
        // Same pool without the constraint keeps all three.
        assertEquals(3, ParlayGodEngine.assemble(pool, onePerGame = false).size)
    }

    @Test
    fun assembleDedupsSameBetFromDifferentSources() {
        // The same "CWS ML" fade can qualify via Team Form AND an H2H record —
        // one ticket must never carry it twice, keeping the deeper sample.
        val pool = listOf(
            makeLeg(subject = "White Sox", game = "1", odds = 114, n = 5, bet = "CWS ML"),
            makeLeg(subject = "White Sox", game = "1", odds = 114, n = 3, bet = "CWS ML"),
        )
        val chosen = ParlayGodEngine.assemble(pool, onePerGame = false)
        assertEquals(1, chosen.size)
        assertEquals(5, chosen[0].streakN)
    }

    @Test
    fun assembleMarketDiversityCap() {
        val pool = (0 until 5).map { i ->
            makeLeg(subject = "P$i", game = "g$i", odds = -110, n = 10 - i, market = "batter_hits")
        } + makeLeg(subject = "Q", game = "g9", odds = -110, n = 3, market = "batter_rbis")
        val chosen = ParlayGodEngine.assemble(pool, onePerGame = true)
        assertEquals(2, chosen.count { it.marketKey == "batter_hits" })
        assertTrue(chosen.any { it.marketKey == "batter_rbis" })
    }

    @Test
    fun assembleBlocksOppositeTotalsSides() {
        val over = makeLeg(
            subject = "Overs", game = "1", odds = -105, n = 5,
            totalsFamily = "ou", totalsSide = "over",
        )
        val under = makeLeg(
            subject = "Unders", game = "1", odds = -115, n = 4,
            totalsFamily = "ou", totalsSide = "under",
        )
        val chosen = ParlayGodEngine.assemble(listOf(over, under), onePerGame = false)
        assertEquals(1, chosen.size)
        assertEquals("Overs", chosen[0].subject)
    }

    @Test
    fun assembleBlocksOpposingTeamsInSameGame() {
        val home = makeLeg(subject = "Yankees", game = "1", odds = -120, n = 6, backedTeam = "NYY")
        val away = makeLeg(subject = "Red Sox", game = "1", odds = 100, n = 5, backedTeam = "BOS")
        val chosen = ParlayGodEngine.assemble(listOf(home, away), onePerGame = false)
        assertEquals(1, chosen.size)
        assertEquals("Yankees", chosen[0].subject)
    }

    @Test
    fun assembleAllowsOpposingTeamsAcrossGames() {
        val a = makeLeg(subject = "Yankees", game = "1", odds = -120, n = 6, backedTeam = "NYY")
        val b = makeLeg(subject = "Red Sox", game = "2", odds = 100, n = 5, backedTeam = "BOS")
        assertEquals(2, ParlayGodEngine.assemble(listOf(a, b), onePerGame = true).size)
    }

    @Test
    fun assembleExclusionSupportsMultipleCards() {
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 10),
            makeLeg(subject = "B", game = "1", odds = -110, n = 9),
            makeLeg(subject = "C", game = "1", odds = -110, n = 8),
        )
        val first = ParlayGodEngine.assemble(pool, maxLegs = 2, onePerGame = false)
        val used = first.map { ParlayGodEngine.exclusionKey(it) }.toSet()
        val second = ParlayGodEngine.assemble(pool, maxLegs = 2, onePerGame = false, excluding = used)
        assertEquals(listOf("A", "B"), first.map { it.subject })
        assertEquals(listOf("C"), second.map { it.subject })
    }

    @Test
    fun assembleIsDeterministic() {
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 5),
            makeLeg(subject = "B", game = "2", odds = -110, n = 5),
            makeLeg(subject = "C", game = "3", odds = -110, n = 5),
        )
        val runs = (0 until 5).map { ParlayGodEngine.assemble(pool, onePerGame = true).map { leg -> leg.id } }
        assertTrue(runs.drop(1).all { it == runs[0] })
    }

    // MARK: - Tickets

    @Test
    fun slateTicketsDropThinCategories() {
        // Two recent-form legs (below minLegs) + three team-form legs.
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 10, category = ParlayGodCategory.RECENT_FORM),
            makeLeg(subject = "B", game = "2", odds = -110, n = 10, category = ParlayGodCategory.RECENT_FORM),
            makeLeg(subject = "C", game = "3", odds = -110, n = 5, category = ParlayGodCategory.TEAM_FORM),
            makeLeg(subject = "D", game = "4", odds = -110, n = 5, category = ParlayGodCategory.TEAM_FORM),
            makeLeg(subject = "E", game = "5", odds = -110, n = 5, category = ParlayGodCategory.TEAM_FORM),
        )
        val tickets = ParlayGodEngine.slateTickets(pool)
        assertEquals(1, tickets.size)
        assertEquals(ParlayGodCategory.TEAM_FORM, tickets.first().category)
        assertEquals(3, tickets.first().legs.size)
    }

    @Test
    fun slateTicketsExcludePropLegs() {
        // Parlay God (Outliers/Search) is game-markets only; props belong to
        // Props Cheats. Three deep prop legs must not leak onto the slate rail.
        val pool = listOf(
            makeLeg(subject = "P1", game = "1", odds = -110, n = 10, category = ParlayGodCategory.DAY_NIGHT, kind = ParlayLeg.Kind.PROP),
            makeLeg(subject = "P2", game = "2", odds = -110, n = 10, category = ParlayGodCategory.DAY_NIGHT, kind = ParlayLeg.Kind.PROP),
            makeLeg(subject = "P3", game = "3", odds = -110, n = 10, category = ParlayGodCategory.DAY_NIGHT, kind = ParlayLeg.Kind.PROP),
            makeLeg(subject = "A", game = "4", odds = -110, n = 5, category = ParlayGodCategory.TEAM_FORM),
            makeLeg(subject = "B", game = "5", odds = -110, n = 5, category = ParlayGodCategory.TEAM_FORM),
            makeLeg(subject = "C", game = "6", odds = -110, n = 5, category = ParlayGodCategory.TEAM_FORM),
        )
        val tickets = ParlayGodEngine.slateTickets(pool)
        assertEquals(listOf(ParlayGodCategory.TEAM_FORM), tickets.map { it.category })
        assertTrue(tickets.all { ticket -> ticket.legs.all { it.kind == ParlayLeg.Kind.TEAM } })
    }

    @Test
    fun slateTicketsKeepStaleSlatesSeparate() {
        // A slate with no parseable kickoffs — or entirely past dates, like the
        // NFL dry-run — never merges: each sport fields its own card (MLB first)
        // so a merged ticket is always a placeable parlay.
        val now = isoDate("2026-07-20T12:00:00+00:00")
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 5),
            makeLeg(subject = "B", game = "2", odds = -110, n = 5),
            makeLeg(subject = "C", game = "3", odds = -110, n = 5),
            makeLeg(subject = "D", game = "2025_12_A_B", odds = -110, n = 8, sport = ParlaySport.NFL, kickoff = "2025-11-23T18:00:00+00:00"),
            makeLeg(subject = "E", game = "2025_12_C_D", odds = -110, n = 8, sport = ParlaySport.NFL, kickoff = "2025-11-23T18:00:00+00:00"),
            makeLeg(subject = "F", game = "2025_12_E_F", odds = -110, n = 8, sport = ParlaySport.NFL, kickoff = "2025-11-23T18:00:00+00:00"),
        )
        val tickets = ParlayGodEngine.slateTickets(pool, now = now)
        assertEquals(
            listOf(listOf(ParlaySport.MLB), listOf(ParlaySport.NFL)),
            tickets.map { it.sports },
        )
        assertTrue(tickets.all { ticket -> ticket.legs.all { it.sport == ticket.sports[0] } })
        assertEquals(listOf(ParlaySport.MLB, ParlaySport.NFL), ParlayGodEngine.sports(tickets))
    }

    @Test
    fun slateTicketsMergeConcurrentLiveSlates() {
        // Both slates live (upcoming games) → ONE cross-sport card per category,
        // deepest streaks first regardless of league.
        val now = isoDate("2026-09-20T12:00:00+00:00")
        val mlbKick = "2026-09-20T23:00:00+00:00"
        val nflKick = "2026-09-21T17:00:00+00:00"
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 5, kickoff = mlbKick),
            makeLeg(subject = "B", game = "2", odds = -110, n = 4, kickoff = mlbKick),
            makeLeg(subject = "C", game = "2026_03_A_B", odds = -110, n = 8, sport = ParlaySport.NFL, kickoff = nflKick),
            makeLeg(subject = "D", game = "2026_03_C_D", odds = -110, n = 3, sport = ParlaySport.NFL, kickoff = nflKick),
        )
        val tickets = ParlayGodEngine.slateTickets(pool, now = now)
        assertEquals(1, tickets.size)
        assertEquals(listOf(ParlaySport.MLB, ParlaySport.NFL), tickets[0].sports)
        assertEquals(listOf("C", "A", "B", "D"), tickets[0].legs.map { it.subject })
    }

    @Test
    fun propsTicketsExcludeTeamLegs() {
        val pool = listOf(
            makeLeg(subject = "A", game = "1", odds = -110, n = 10, category = ParlayGodCategory.RECENT_FORM, kind = ParlayLeg.Kind.PROP),
            makeLeg(subject = "B", game = "1", odds = -110, n = 9, category = ParlayGodCategory.RECENT_FORM, kind = ParlayLeg.Kind.PROP),
            makeLeg(subject = "C", game = "2", odds = -110, n = 8, category = ParlayGodCategory.RECENT_FORM, kind = ParlayLeg.Kind.PROP),
            makeLeg(subject = "Team", game = "3", odds = -110, n = 10, category = ParlayGodCategory.RECENT_FORM),
        )
        val tickets = ParlayGodEngine.propsTickets(pool)
        assertEquals(1, tickets.size)
        assertFalse(tickets.first().legs.any { it.kind == ParlayLeg.Kind.TEAM })
    }

    @Test
    fun gameTicketsScopeAndCascade() {
        val pool = listOf(
            makeLeg(subject = "A", game = "g", odds = -110, n = 10),
            makeLeg(subject = "B", game = "g", odds = -110, n = 9),
            makeLeg(subject = "C", game = "g", odds = -110, n = 8),
            makeLeg(subject = "D", game = "other", odds = -110, n = 10),
        )
        val tickets = ParlayGodEngine.gameTickets(pool, gameKey = "g")
        assertEquals(1, tickets.size)
        assertTrue(tickets.first().legs.all { it.gameKey == "g" })
        assertEquals(3, tickets.first().legs.size)
        assertTrue(tickets.first().isSameGame)
    }

    @Test
    fun gameTicketsAllowRepeatSubjectsForTeamOnlyPools() {
        // A game only has two team subjects — same-game cards may stack one team
        // across markets (ML + F5 ML + Over), which is a legitimate SGP.
        val pool = listOf(
            makeLeg(subject = "Yankees", game = "g", odds = -120, n = 6, bet = "NYY ML", market = "ml", backedTeam = "NYY"),
            makeLeg(subject = "Yankees", game = "g", odds = -110, n = 5, bet = "F5 NYY ML", market = "f5_ml", backedTeam = "NYY"),
            makeLeg(subject = "Yankees", game = "g", odds = -105, n = 4, bet = "Over 8.5", market = "ou", totalsFamily = "ou", totalsSide = "over"),
        )
        val tickets = ParlayGodEngine.gameTickets(pool, gameKey = "g")
        assertEquals(3, tickets.first().legs.size)
    }

    // MARK: - Slate liveness

    @Test
    fun kickoffDateParsesOffsetAndDateOnlyForms() {
        assertEquals(
            isoDate("2026-07-20T23:05:00+00:00"),
            ParlayGodEngine.kickoffDate("2026-07-20T23:05:00Z"),
        )
        assertEquals(
            isoDate("2026-07-20T23:05:00.123+00:00"),
            ParlayGodEngine.kickoffDate("2026-07-20T23:05:00.123+00:00"),
        )
        // Date-only rows (`official_date` when `game_time_et` is missing) anchor
        // to noon ET so a whole slate isn't judged stale at midnight.
        val noonEt = LocalDate.parse("2026-07-20")
            .atStartOfDay(ZoneId.of("America/New_York"))
            .plusHours(12)
            .toInstant()
        assertEquals(noonEt, ParlayGodEngine.kickoffDate("2026-07-20"))
        assertNull(ParlayGodEngine.kickoffDate(null))
        assertNull(ParlayGodEngine.kickoffDate(""))
        assertNull(ParlayGodEngine.kickoffDate("not a date"))
    }

    @Test
    fun liveSportsHonorsTheSixHourGrace() {
        val now = isoDate("2026-09-20T12:00:00+00:00")
        // Started 5h ago → still counted live; 7h ago → stale.
        val fresh = makeLeg(subject = "A", game = "1", odds = -110, kickoff = "2026-09-20T07:00:00+00:00")
        val stale = makeLeg(subject = "B", game = "2", odds = -110, sport = ParlaySport.NFL, kickoff = "2026-09-20T05:00:00+00:00")
        assertEquals(setOf(ParlaySport.MLB), ParlayGodEngine.liveSports(listOf(fresh, stale), now))
    }

    // MARK: - Bet text

    @Test
    fun propBetTextThresholdStyle() {
        assertTrue(ParlayGodEngine.propBetText("batter_hits", 0.5, over = true).startsWith("1+"))
        assertTrue(ParlayGodEngine.propBetText("batter_hits", 1.5, over = true).startsWith("2+"))
        assertTrue(ParlayGodEngine.propBetText("batter_hits", 1.5, over = false).startsWith("Under 1.5"))
        assertEquals("Over 2 Hits", ParlayGodEngine.propBetText("batter_hits", 2.0, over = true))
    }

    @Test
    fun shortName() {
        assertEquals("A. Judge", ParlayGodEngine.shortName("Aaron Judge"))
        assertEquals("L. Gurriel Jr.", ParlayGodEngine.shortName("Luis Gurriel Jr."))
        assertEquals("Ichiro", ParlayGodEngine.shortName("Ichiro"))
    }

    // MARK: - MLB team legs

    @Test
    fun mlbTeamLegsFadeAPerfectLosingStreakOntoTheOpponent() {
        val game = mlbGame()
        val record = MLBTeamTrendRecord(
            teamAbbr = "NYY",
            teamName = "New York Yankees",
            season = 2026,
            throughDate = "2026-07-19",
            // 0-10 straight up: back BOS at its posted +130, not NYY.
            splits = splitsOf(Triple("ml", "overall", cell(h = 0, l = 10, n = 10, pct = 0.0))),
            matchups = emptyMap(),
        )
        val legs = ParlayGodEngine.teamLegs(
            MLBTrendsSlateBundle(games = listOf(game), season = 2026, throughDate = null, teams = listOf(record)),
        )
        assertEquals(1, legs.size)
        val leg = legs.first()
        assertEquals("BOS ML", leg.betText)
        assertEquals(130, leg.odds)
        assertEquals("BOS", leg.backedTeamAbbr)
        assertEquals("NYY lost 10 straight games", leg.evidence)
        assertEquals(ParlayGodCategory.TEAM_FORM, leg.category)
        assertEquals(ParlaySport.MLB, leg.sport)
        assertEquals("ml", leg.marketKey)
        assertEquals("777", leg.gameKey)
    }

    @Test
    fun mlbTeamLegsSkipCellsBelowMinSample() {
        val record = MLBTeamTrendRecord(
            teamAbbr = "NYY",
            teamName = "New York Yankees",
            season = 2026,
            throughDate = null,
            splits = splitsOf(Triple("ml", "overall", cell(h = 2, l = 0, n = 2, pct = 1.0))),
            matchups = emptyMap(),
        )
        val legs = ParlayGodEngine.teamLegs(
            MLBTrendsSlateBundle(games = listOf(mlbGame()), season = 2026, throughDate = null, teams = listOf(record)),
        )
        assertTrue(legs.isEmpty())
    }

    // MARK: - NFL team legs (Android injects the context iOS reads off the game)

    @Test
    fun nflTeamLegsPriceMoneylineOffTheInjectedContext() {
        val game = nflGame()
        val bundle = nflBundle(
            game,
            NFLTeamTrendRecord(
                teamAbbr = "KC",
                teamName = "Kansas City Chiefs",
                season = 2026,
                throughWeek = 2,
                splits = splitsOf(Triple("moneyline", "overall", cell(h = 5, l = 0, n = 5, pct = 1.0))),
                matchups = emptyMap(),
            ),
        )
        val legs = ParlayGodEngine.nflTeamLegs(
            bundle,
            mapOf(game.id to ParlayGodNFLContext(homeMl = -280.0, awayMl = 230.0)),
        )
        assertEquals(1, legs.size)
        val leg = legs.first()
        assertEquals(ParlaySport.NFL, leg.sport)
        assertEquals("Chiefs", leg.subject)
        assertEquals("KC ML", leg.betText)
        assertEquals(-280, leg.odds)
        assertEquals("Won 5 straight games", leg.evidence)
        assertEquals(ParlayGodCategory.TEAM_FORM, leg.category)
    }

    @Test
    fun nflTeamLegsFallBackToBookStandardJuiceWithoutContext() {
        // Empty odds map = the ParlayGodNflOddsService query failed or the slate
        // predates those columns. ML and 1H legs drop; the full-game spread
        // still prices off fg_spread_close at -110, home-relative and flipped
        // for the away side.
        val game = nflGame()
        val bundle = nflBundle(
            game,
            NFLTeamTrendRecord(
                teamAbbr = "KC", teamName = "Kansas City Chiefs", season = 2026, throughWeek = 2,
                splits = splitsOf(
                    Triple("moneyline", "overall", cell(h = 5, l = 0, n = 5, pct = 1.0)),
                    Triple("spread", "overall", cell(h = 5, l = 0, n = 5, pct = 1.0)),
                ),
                matchups = emptyMap(),
            ),
            NFLTeamTrendRecord(
                teamAbbr = "LV", teamName = "Las Vegas Raiders", season = 2026, throughWeek = 2,
                splits = splitsOf(Triple("spread", "overall", cell(h = 4, l = 0, n = 4, pct = 1.0))),
                matchups = emptyMap(),
            ),
        )
        val legs = ParlayGodEngine.nflTeamLegs(bundle, emptyMap())
        assertTrue(legs.none { it.marketKey == "moneyline" }, "ML needs closes we don't have")

        val home = legs.first { it.teamAbbr == "KC" }
        assertEquals("KC -6.5", home.betText)
        assertEquals(-110, home.odds)
        assertEquals("Covered 5 straight games", home.evidence)

        val away = legs.first { it.teamAbbr == "LV" }
        assertEquals("LV +6.5", away.betText)
        assertEquals(-110, away.odds)
    }

    @Test
    fun nflTeamLegsBuildFirstHalfLegsFromH1Closes() {
        val game = nflGame()
        val bundle = nflBundle(
            game,
            NFLTeamTrendRecord(
                teamAbbr = "KC", teamName = "Kansas City Chiefs", season = 2026, throughWeek = 2,
                // H1 is anchored to overall form only — a "home" split must not
                // produce a second 1H leg.
                splits = splitsOf(
                    Triple("h1_total", "overall", cell(h = 6, l = 0, n = 6, pct = 1.0)),
                    Triple("h1_total", "home", cell(h = 4, l = 0, n = 4, pct = 1.0)),
                ),
                matchups = emptyMap(),
            ),
        )
        val legs = ParlayGodEngine.nflTeamLegs(
            bundle,
            mapOf(game.id to ParlayGodNFLContext(h1TotalClose = 23.5, h1TotalOverPrice = -105.0)),
        )
        assertEquals(1, legs.size)
        val leg = legs.first()
        assertEquals(ParlayGodCategory.FIRST_HALF, leg.category)
        assertEquals("1H Over 23.5", leg.betText)
        assertEquals(-105, leg.odds)
        assertEquals("h1_total", leg.totalsFamily)
        assertEquals("over", leg.totalsSide)
    }

    @Test
    fun nflTeamLegsRespectTheOddsFloor() {
        val game = nflGame()
        val bundle = nflBundle(
            game,
            NFLTeamTrendRecord(
                teamAbbr = "KC", teamName = "Kansas City Chiefs", season = 2026, throughWeek = 2,
                splits = splitsOf(Triple("moneyline", "overall", cell(h = 9, l = 0, n = 9, pct = 1.0))),
                matchups = emptyMap(),
            ),
        )
        val tooSteep = ParlayGodEngine.nflTeamLegs(
            bundle,
            mapOf(game.id to ParlayGodNFLContext(homeMl = -400.0, awayMl = 310.0)),
        )
        assertTrue(tooSteep.isEmpty(), "-400 is past the -350 floor")

        val atFloor = ParlayGodEngine.nflTeamLegs(
            bundle,
            mapOf(game.id to ParlayGodNFLContext(homeMl = -350.0, awayMl = 280.0)),
        )
        assertEquals(-350, atFloor.single().odds)
    }

    @Test
    fun nflTeamLegsUseH2HRecordsForVersusOpponent() {
        val game = nflGame()
        val bundle = nflBundle(
            game,
            NFLTeamTrendRecord(
                teamAbbr = "KC", teamName = "Kansas City Chiefs", season = 2026, throughWeek = 2,
                splits = emptyMap(),
                matchups = mapOf(
                    "LV" to NFLTrendMatchupRecord(
                        meetings = 6,
                        markets = mapOf(
                            "moneyline" to NFLTrendH2HCell(h = 6, n = 6, pct = 1.0),
                        ),
                    ),
                ),
            ),
        )
        val legs = ParlayGodEngine.nflTeamLegs(
            bundle,
            mapOf(game.id to ParlayGodNFLContext(homeMl = -280.0, awayMl = 230.0)),
        )
        val leg = assertNotNull(legs.firstOrNull())
        assertEquals(ParlayGodCategory.VERSUS_OPPONENT, leg.category)
        assertEquals("Won 6 straight vs LV", leg.evidence)
        assertEquals(6, leg.streakN)
    }

    // MARK: - Window selection

    @Test
    fun bestPerfectCellRejectsAZeroPctWindowWithPushes() {
        // 0-4-1 is not a perfect losing streak — the push breaks the "N of N"
        // claim the card makes, so the fade must not be offered.
        assertNull(ParlayGodEngine.bestPerfectCell(mapOf("l5" to cell(h = 0, l = 4, n = 5, pct = 0.0, p = 1))))
        val perfect = ParlayGodEngine.bestPerfectCell(mapOf("l5" to cell(h = 0, l = 5, n = 5, pct = 0.0)))
        assertEquals(false, perfect?.second)
    }

    @Test
    fun bestPerfectCellPrefersTheLargestSample() {
        val block = mapOf(
            "l5" to cell(h = 5, l = 0, n = 5, pct = 1.0),
            "l10" to cell(h = 10, l = 0, n = 10, pct = 1.0),
            "l3" to cell(h = 3, l = 0, n = 3, pct = 1.0),
        )
        val best = assertNotNull(ParlayGodEngine.bestPerfectCell(block))
        assertEquals(10, best.first.n)
        assertEquals(true, best.second)
    }

    // MARK: - Helpers

    private fun isoDate(raw: String): Instant = OffsetDateTime.parse(raw).toInstant()

    private fun cell(h: Int, l: Int, n: Int, pct: Double, p: Int? = 0): NFLTrendSplitCell =
        NFLTrendSplitCell(h = h, l = l, p = p, n = n, pct = pct)

    /**
     * `(market, dimension, cell)` triples → the market/dimension/window nesting
     * the trend tables ship. One window per dimension is enough: the engine
     * picks the largest perfect window, which these fixtures never contest.
     */
    private fun splitsOf(vararg entries: Triple<String, String, NFLTrendSplitCell>): NFLTrendSplits {
        val out = mutableMapOf<String, MutableMap<String, Map<String, NFLTrendSplitCell>>>()
        for ((market, dimension, splitCell) in entries) {
            out.getOrPut(market) { mutableMapOf() }[dimension] = mapOf("window" to splitCell)
        }
        return out
    }

    private fun mlbGame(): OutliersTrendsGame = OutliersTrendsGame(
        id = "777",
        season = 2026,
        week = 1,
        awayAb = "BOS",
        homeAb = "NYY",
        awayTeam = "Boston Red Sox",
        homeTeam = "New York Yankees",
        fgSpreadClose = null,
        fgTotalClose = null,
        kickoff = "2026-07-20T23:05:00+00:00",
        slot = null,
        assignedReferee = null,
        mlbContext = OutliersTrendsMLBContext(
            homeMl = -150.0,
            awayMl = 130.0,
            homeSpread = -1.5,
            awaySpread = 1.5,
            totalLine = 8.5,
            f5HomeMl = null,
            f5AwayMl = null,
            f5HomeSpread = null,
            f5AwaySpread = null,
            f5TotalLine = null,
            isDivisional = true,
            isDayGame = false,
            seriesGameNumber = null,
        ),
    )

    private fun nflGame(): OutliersTrendsGame = OutliersTrendsGame(
        id = "2026_03_LV_KC",
        season = 2026,
        week = 3,
        awayAb = "LV",
        homeAb = "KC",
        awayTeam = "Las Vegas Raiders",
        homeTeam = "Kansas City Chiefs",
        fgSpreadClose = -6.5,
        fgTotalClose = 44.5,
        kickoff = "2026-09-21T17:00:00+00:00",
        slot = "sun_late_sat",
        assignedReferee = null,
    )

    private fun nflBundle(
        game: OutliersTrendsGame,
        vararg teams: NFLTeamTrendRecord,
    ): NFLTrendsSlateBundle = NFLTrendsSlateBundle(
        games = listOf(game),
        season = game.season,
        throughWeek = game.week - 1,
        teams = teams.toList(),
        coaches = emptyList(),
        referees = emptyList(),
        players = emptyList(),
    )

    /**
     * Default market is unique per subject so the per-market diversity cap stays
     * out of tests that aren't exercising it (pass `market` to opt in).
     */
    private fun makeLeg(
        subject: String,
        game: String,
        odds: Int,
        n: Int = 5,
        bet: String? = null,
        market: String? = null,
        category: ParlayGodCategory = ParlayGodCategory.TEAM_FORM,
        kind: ParlayLeg.Kind = ParlayLeg.Kind.TEAM,
        sport: ParlaySport = ParlaySport.MLB,
        kickoff: String? = null,
        backedTeam: String? = null,
        totalsFamily: String? = null,
        totalsSide: String? = null,
    ): ParlayLeg = ParlayLeg(
        kind = kind,
        sport = sport,
        category = category,
        gameKey = game,
        matchupLabel = "AWY @ HOM",
        gameTimeEt = kickoff,
        subject = subject,
        teamAbbr = backedTeam,
        playerId = null,
        betText = bet ?: "$subject bet",
        odds = odds,
        evidence = "Won $n straight",
        streakN = n,
        marketKey = market ?: "mkt-$subject",
        backedTeamAbbr = backedTeam,
        totalsFamily = totalsFamily,
        totalsSide = totalsSide,
    )
}
