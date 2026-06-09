#if DEBUG
import Foundation
import WagerproofModels

/// Deterministic sample data for the Outliers tab parity screenshots.
/// Production code never touches these — gated behind `#if DEBUG`.
enum OutliersFixtures {
    static let nbaCelticsLakers = OutlierGame(
        gameId: "nba-401704933",
        sport: .nba,
        awayTeam: "Boston Celtics",
        homeTeam: "Los Angeles Lakers",
        gameTime: "2026-05-21T02:00:00Z",
        awaySpread: 3.5,
        homeSpread: -3.5,
        totalLine: 224.5,
        awayMl: 142,
        homeMl: -165,
        awayTeamLogo: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
        homeTeamLogo: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
        awayTeamAbbrev: "BOS",
        homeTeamAbbrev: "LAL"
    )

    static let nflChiefsBills = OutlierGame(
        gameId: "nfl-2026-W08-KC-BUF",
        sport: .nfl,
        awayTeam: "Buffalo",
        homeTeam: "Kansas City",
        gameTime: "2026-05-24T20:25:00Z",
        awaySpread: 2.5,
        homeSpread: -2.5,
        totalLine: 49.5,
        awayMl: 115,
        homeMl: -135,
        homeAwaySpreadCoverProb: 0.84,
        homeSpreadDiff: 4.2
    )

    static let ncaabDukeUNC = OutlierGame(
        gameId: "ncaab-987",
        sport: .ncaab,
        awayTeam: "North Carolina",
        homeTeam: "Duke",
        gameTime: "2026-05-22T00:00:00Z",
        awaySpread: 5.5,
        homeSpread: -5.5,
        totalLine: 154.5,
        awayMl: 220,
        homeMl: -260,
        awayTeamLogo: "https://a.espncdn.com/i/teamlogos/ncaa/500/153.png",
        homeTeamLogo: "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png",
        awayTeamAbbrev: "UNC",
        homeTeamAbbrev: "DUKE"
    )

    static let valueAlerts: [OutlierValueAlert] = [
        OutlierValueAlert(
            gameId: nbaCelticsLakers.gameId,
            sport: .nba,
            awayTeam: nbaCelticsLakers.awayTeam,
            homeTeam: nbaCelticsLakers.homeTeam,
            marketType: .moneyline,
            side: "Los Angeles Lakers",
            percentage: 67,
            game: nbaCelticsLakers
        ),
        OutlierValueAlert(
            gameId: ncaabDukeUNC.gameId,
            sport: .ncaab,
            awayTeam: ncaabDukeUNC.awayTeam,
            homeTeam: ncaabDukeUNC.homeTeam,
            marketType: .total,
            side: "Over",
            percentage: 62,
            game: ncaabDukeUNC
        ),
        OutlierValueAlert(
            gameId: nflChiefsBills.gameId,
            sport: .nfl,
            awayTeam: nflChiefsBills.awayTeam,
            homeTeam: nflChiefsBills.homeTeam,
            marketType: .spread,
            side: "Kansas City",
            percentage: 71,
            game: nflChiefsBills
        ),
    ]

    static let fadeAlerts: [OutlierFadeAlert] = [
        OutlierFadeAlert(
            gameId: nflChiefsBills.gameId,
            sport: .nfl,
            awayTeam: nflChiefsBills.awayTeam,
            homeTeam: nflChiefsBills.homeTeam,
            pickType: .spread,
            predictedTeam: "Kansas City",
            confidence: 84,
            game: nflChiefsBills
        ),
        OutlierFadeAlert(
            gameId: ncaabDukeUNC.gameId,
            sport: .ncaab,
            awayTeam: ncaabDukeUNC.awayTeam,
            homeTeam: ncaabDukeUNC.homeTeam,
            pickType: .total,
            predictedTeam: "Over",
            confidence: 8,
            game: ncaabDukeUNC
        ),
    ]
}
#endif
