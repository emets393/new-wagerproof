package com.wagerproof.core.models

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class NFLPropsInsightTest {

    @Test
    fun synthesizedGameIdUsesHomeAway() {
        val id = NFLPlayerProps.synthesizedGameId(
            season = 2026, week = 1, team = "MIN", opponent = "GB", isHome = true,
        )
        assertEquals("2026_1_GB_MIN", id)
    }

    @Test
    fun playersFromPagesCarryMarketsAndLogs() {
        val page = NFLPropPlayerPage(
            playerId = "00-0036322",
            season = 2026,
            week = 1,
            playerName = "Justin Jefferson",
            position = "WR",
            team = "MIN",
            opponent = "GB",
            isHome = true,
            kickoff = "2026-09-13T17:00:00Z",
            markets = listOf(
                NFLPropPageMarket(
                    key = "player_reception_yds",
                    label = "Rec Yards",
                    line = 84.5,
                    overPrice = -110,
                    underPrice = -110,
                    status = "posted",
                ),
            ),
        )
        val log = (1..8).map { week ->
            NFLPropRecentGame(opp = "CHI", week = week, actual = 90.0, cleared = true)
        }
        val players = NFLPlayerProps.players(
            from = listOf(page),
            recentGames = mapOf("00-0036322|player_reception_yds" to log),
        )
        assertEquals(1, players.size)
        assertEquals("2026_1_GB_MIN", players[0].gameId)
        assertEquals(84.5, players[0].markets.first().closeLine)
        assertEquals(8, players[0].markets.first().l10Hits.hits)
        assertEquals(8, players[0].markets.first().l10Hits.n)
    }

    @Test
    fun summaryFeaturesHottestQualifiedL10() {
        val hot = player("Justin Jefferson", "jj", "MIN", hits = 8, misses = 2, line = 84.5)
        val mild = player(
            "Jordan Love", "jl", "GB", hits = 6, misses = 4, line = 247.5,
            market = "player_pass_yds",
        )
        val summary = NFLPropsInsight.summary(listOf(hot, mild))
        assertEquals("jj", summary?.featuredPlayerId)
        assertEquals("1 STREAK", summary?.badge?.text)
        assertTrue(summary?.headline?.contains("Justin Jefferson") == true)
        assertTrue(summary?.headline?.contains("8 of 10") == true)
    }

    @Test
    fun summaryColdPatternPointsUnder() {
        val cold = player(
            "Josh Jacobs", "jacobs", "GB", hits = 2, misses = 8, line = 78.5,
            market = "player_rush_yds",
        )
        val summary = NFLPropsInsight.summary(listOf(cold))
        assertEquals("jacobs", summary?.featuredPlayerId)
        assertTrue(summary?.headline?.contains("only 2 of 10") == true)
        assertTrue(summary?.headline?.contains("Under") == true)
        assertEquals(InsightVerdict.Lean.Under, summary?.verdict?.lean)
    }

    @Test
    fun summaryFeaturesHottestOverZeroFer() {
        val hot = player("Justin Jefferson", "jj", "MIN", hits = 8, misses = 2, line = 84.5)
        val zero = player(
            "Backup Back", "bb", "GB", hits = 0, misses = 10, line = 45.5,
            market = "player_rush_yds",
        )
        val summary = NFLPropsInsight.summary(listOf(zero, hot))
        assertEquals("jj", summary?.featuredPlayerId)
        assertEquals(listOf("jj"), summary?.signals?.map { it.playerId })
        assertTrue(summary?.headline?.contains("8 of 10") == true)
        assertFalse(summary?.headline?.contains("Backup Back") == true)
    }

    @Test
    fun hitsUsePostedLineNotHistoricalGrade() {
        val games = (1..10).map { week ->
            NFLPropRecentGame(opp = "CHI", week = week, actual = 90.0, cleared = false)
        }
        val market = market("player_reception_yds", 84.5, games)
        assertEquals(10, market.l10Hits.hits)
        assertEquals(10, market.l10Hits.n)
    }

    @Test
    fun summaryHidesPlayersWithNoMarkets() {
        val empty = NFLPropPlayer(
            playerName = "Rookie",
            playerId = "x",
            headshotUrl = null,
            team = "MIN",
            opponent = "GB",
            isHome = true,
            position = "WR",
            gameId = "g",
            eventId = null,
            gameDate = "2026-09-13",
            slot = null,
            week = 1,
            season = 2026,
            reportStatus = null,
            practiceStatus = null,
            markets = emptyList(),
        )
        assertNull(NFLPropsInsight.summary(listOf(empty)))
    }

    private fun player(
        name: String,
        id: String,
        team: String,
        hits: Int,
        misses: Int,
        line: Double,
        market: String = "player_reception_yds",
    ): NFLPropPlayer {
        val games = (0 until (hits + misses)).map { index ->
            NFLPropRecentGame(
                opp = "CHI",
                week = index + 1,
                actual = if (index < hits) line + 10 else line - 10,
                cleared = index < hits,
            )
        }
        return NFLPropPlayer(
            playerName = name,
            playerId = id,
            headshotUrl = null,
            team = team,
            opponent = if (team == "MIN") "GB" else "MIN",
            isHome = team == "MIN",
            position = "WR",
            gameId = "2026_1_GB_MIN",
            eventId = null,
            gameDate = "2026-09-13",
            slot = null,
            week = 1,
            season = 2026,
            reportStatus = null,
            practiceStatus = null,
            markets = listOf(market(market, line, games)),
        )
    }

    private fun market(
        market: String,
        line: Double,
        games: List<NFLPropRecentGame>,
    ) = NFLPropMarket(
        market = market,
        closeLine = line,
        openLine = null, lineDelta = null, lineRange = null,
        overPrice = -110, underPrice = -110,
        nBooks = null, closeYesProb = null, openYesProb = null,
        lastGame = null, l3Avg = null, l5Avg = null, l10Avg = null,
        sznAvg = null, sznMax = null, sznMin = null,
        overRateL5 = null, overRateL10 = null, defMatchupIdx = null,
        flags = emptyList(),
        recentGames = games,
    )
}
