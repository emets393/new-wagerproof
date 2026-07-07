package com.wagerproof.app.features.outliers

import com.wagerproof.core.models.OutlierFadeAlert
import com.wagerproof.core.models.OutlierGame
import com.wagerproof.core.models.OutlierValueAlert
import com.wagerproof.core.models.SportLeague

/**
 * Deterministic sample data for the Outliers tab parity screenshots. Port of
 * iOS `OutliersFixtures.swift`. Production code never touches these (iOS gates
 * them behind `#if DEBUG`; Android has no such guard, so it's a plain object).
 */
object OutliersFixtures {
    val nbaCelticsLakers = OutlierGame(
        gameId = "nba-401704933",
        sport = SportLeague.NBA,
        awayTeam = "Boston Celtics",
        homeTeam = "Los Angeles Lakers",
        gameTime = "2026-05-21T02:00:00Z",
        awaySpread = 3.5,
        homeSpread = -3.5,
        totalLine = 224.5,
        awayMl = 142,
        homeMl = -165,
        awayTeamLogo = "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
        homeTeamLogo = "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
        awayTeamAbbrev = "BOS",
        homeTeamAbbrev = "LAL",
    )

    val nflChiefsBills = OutlierGame(
        gameId = "nfl-2026-W08-KC-BUF",
        sport = SportLeague.NFL,
        awayTeam = "Buffalo",
        homeTeam = "Kansas City",
        gameTime = "2026-05-24T20:25:00Z",
        awaySpread = 2.5,
        homeSpread = -2.5,
        totalLine = 49.5,
        awayMl = 115,
        homeMl = -135,
        homeAwaySpreadCoverProb = 0.84,
        homeSpreadDiff = 4.2,
    )

    val ncaabDukeUNC = OutlierGame(
        gameId = "ncaab-987",
        sport = SportLeague.NCAAB,
        awayTeam = "North Carolina",
        homeTeam = "Duke",
        gameTime = "2026-05-22T00:00:00Z",
        awaySpread = 5.5,
        homeSpread = -5.5,
        totalLine = 154.5,
        awayMl = 220,
        homeMl = -260,
        awayTeamLogo = "https://a.espncdn.com/i/teamlogos/ncaa/500/153.png",
        homeTeamLogo = "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png",
        awayTeamAbbrev = "UNC",
        homeTeamAbbrev = "DUKE",
    )

    val valueAlerts: List<OutlierValueAlert> = listOf(
        OutlierValueAlert(
            gameId = nbaCelticsLakers.gameId,
            sport = SportLeague.NBA,
            awayTeam = nbaCelticsLakers.awayTeam,
            homeTeam = nbaCelticsLakers.homeTeam,
            marketType = OutlierValueAlert.MarketType.MONEYLINE,
            side = "Los Angeles Lakers",
            percentage = 67.0,
            game = nbaCelticsLakers,
        ),
        OutlierValueAlert(
            gameId = ncaabDukeUNC.gameId,
            sport = SportLeague.NCAAB,
            awayTeam = ncaabDukeUNC.awayTeam,
            homeTeam = ncaabDukeUNC.homeTeam,
            marketType = OutlierValueAlert.MarketType.TOTAL,
            side = "Over",
            percentage = 62.0,
            game = ncaabDukeUNC,
        ),
        OutlierValueAlert(
            gameId = nflChiefsBills.gameId,
            sport = SportLeague.NFL,
            awayTeam = nflChiefsBills.awayTeam,
            homeTeam = nflChiefsBills.homeTeam,
            marketType = OutlierValueAlert.MarketType.SPREAD,
            side = "Kansas City",
            percentage = 71.0,
            game = nflChiefsBills,
        ),
    )

    val fadeAlerts: List<OutlierFadeAlert> = listOf(
        OutlierFadeAlert(
            gameId = nflChiefsBills.gameId,
            sport = SportLeague.NFL,
            awayTeam = nflChiefsBills.awayTeam,
            homeTeam = nflChiefsBills.homeTeam,
            pickType = OutlierFadeAlert.PickType.SPREAD,
            predictedTeam = "Kansas City",
            confidence = 84,
            game = nflChiefsBills,
        ),
        OutlierFadeAlert(
            gameId = ncaabDukeUNC.gameId,
            sport = SportLeague.NCAAB,
            awayTeam = ncaabDukeUNC.awayTeam,
            homeTeam = ncaabDukeUNC.homeTeam,
            pickType = OutlierFadeAlert.PickType.TOTAL,
            predictedTeam = "Over",
            confidence = 8,
            game = ncaabDukeUNC,
        ),
    )
}
