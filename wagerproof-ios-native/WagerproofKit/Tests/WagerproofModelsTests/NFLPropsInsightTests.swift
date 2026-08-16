import XCTest
@testable import WagerproofModels

final class NFLPropsInsightTests: XCTestCase {

    func testSynthesizedGameIdUsesHomeAway() {
        let id = NFLPlayerProps.synthesizedGameId(
            season: 2026, week: 1, team: "MIN", opponent: "GB", isHome: true
        )
        XCTAssertEqual(id, "2026_1_GB_MIN")
    }

    func testPlayersFromPagesCarryMarketsAndLogs() {
        let page = NFLPropPlayerPage(
            playerId: "00-0036322",
            season: 2026,
            week: 1,
            playerName: "Justin Jefferson",
            position: "WR",
            team: "MIN",
            opponent: "GB",
            isHome: true,
            kickoff: "2026-09-13T17:00:00Z",
            markets: [
                NFLPropPageMarket(
                    key: "player_reception_yds",
                    label: "Rec Yards",
                    line: 84.5,
                    overPrice: -110,
                    underPrice: -110,
                    status: "posted"
                ),
            ]
        )
        let log = (1...8).map { week in
            NFLPropRecentGame(opp: "CHI", week: week, actual: 90, cleared: true)
        }
        let players = NFLPlayerProps.players(
            from: [page],
            recentGames: ["00-0036322|player_reception_yds": log]
        )
        XCTAssertEqual(players.count, 1)
        XCTAssertEqual(players[0].gameId, "2026_1_GB_MIN")
        XCTAssertEqual(players[0].markets.first?.closeLine, 84.5)
        XCTAssertEqual(players[0].markets.first?.l10Hits.hits, 8)
        XCTAssertEqual(players[0].markets.first?.l10Hits.n, 8)
    }

    func testSummaryFeaturesHottestQualifiedL10() {
        let hot = player(
            name: "Justin Jefferson",
            id: "jj",
            team: "MIN",
            hits: 8,
            misses: 2,
            line: 84.5
        )
        let mild = player(
            name: "Jordan Love",
            id: "jl",
            team: "GB",
            hits: 6,
            misses: 4,
            line: 247.5,
            market: "player_pass_yds"
        )
        let summary = NFLPropsInsight.summary(for: [hot, mild])
        XCTAssertEqual(summary?.featuredPlayerId, "jj")
        XCTAssertEqual(summary?.badge?.text, "1 STREAK")
        XCTAssertTrue(summary?.headline.contains("Justin Jefferson") == true)
        XCTAssertTrue(summary?.headline.contains("8 of 10") == true)
    }

    func testSummaryColdPatternPointsUnder() {
        let cold = player(
            name: "Josh Jacobs",
            id: "jacobs",
            team: "GB",
            hits: 2,
            misses: 8,
            line: 78.5,
            market: "player_rush_yds"
        )
        let summary = NFLPropsInsight.summary(for: [cold])
        XCTAssertEqual(summary?.featuredPlayerId, "jacobs")
        XCTAssertTrue(summary?.headline.contains("only 2 of 10") == true)
        XCTAssertTrue(summary?.headline.contains("Under") == true)
        XCTAssertEqual(summary?.verdict.lean, .under)
    }

    func testSummaryFeaturesHottestOverZeroFer() {
        let hot = player(
            name: "Justin Jefferson",
            id: "jj",
            team: "MIN",
            hits: 8,
            misses: 2,
            line: 84.5
        )
        let zero = player(
            name: "Backup Back",
            id: "bb",
            team: "GB",
            hits: 0,
            misses: 10,
            line: 45.5,
            market: "player_rush_yds"
        )
        let summary = NFLPropsInsight.summary(for: [zero, hot])
        XCTAssertEqual(summary?.featuredPlayerId, "jj")
        XCTAssertEqual(summary?.signals.map(\.playerId), ["jj"])
        XCTAssertTrue(summary?.headline.contains("8 of 10") == true)
        XCTAssertFalse(summary?.headline.contains("Backup Back") == true)
    }

    func testHitsUsePostedLineNotHistoricalGrade() {
        let games = (1...10).map { week in
            NFLPropRecentGame(opp: "CHI", week: week, actual: 90, cleared: false)
        }
        let market = NFLPropMarket(
            market: "player_reception_yds",
            closeLine: 84.5,
            openLine: nil, lineDelta: nil, lineRange: nil,
            overPrice: -110, underPrice: -110,
            nBooks: nil, closeYesProb: nil, openYesProb: nil,
            lastGame: nil, l3Avg: nil, l5Avg: nil, l10Avg: nil,
            sznAvg: nil, sznMax: nil, sznMin: nil,
            overRateL5: nil, overRateL10: nil, defMatchupIdx: nil,
            flags: [],
            recentGames: games
        )
        XCTAssertEqual(market.l10Hits.hits, 10)
        XCTAssertEqual(market.l10Hits.n, 10)
    }
        let empty = NFLPropPlayer(
            playerName: "Rookie",
            playerId: "x",
            headshotUrl: nil,
            team: "MIN",
            opponent: "GB",
            isHome: true,
            position: "WR",
            gameId: "g",
            eventId: nil,
            gameDate: "2026-09-13",
            slot: nil,
            week: 1,
            season: 2026,
            reportStatus: nil,
            practiceStatus: nil,
            markets: []
        )
        XCTAssertNil(NFLPropsInsight.summary(for: [empty]))
    }

    private func player(
        name: String,
        id: String,
        team: String,
        hits: Int,
        misses: Int,
        line: Double,
        market: String = "player_reception_yds"
    ) -> NFLPropPlayer {
        let games = (0..<(hits + misses)).map { index in
            NFLPropRecentGame(
                opp: "CHI",
                week: index + 1,
                actual: index < hits ? line + 10 : line - 10,
                cleared: index < hits
            )
        }
        return NFLPropPlayer(
            playerName: name,
            playerId: id,
            headshotUrl: nil,
            team: team,
            opponent: team == "MIN" ? "GB" : "MIN",
            isHome: team == "MIN",
            position: "WR",
            gameId: "2026_1_GB_MIN",
            eventId: nil,
            gameDate: "2026-09-13",
            slot: nil,
            week: 1,
            season: 2026,
            reportStatus: nil,
            practiceStatus: nil,
            markets: [
                NFLPropMarket(
                    market: market,
                    closeLine: line,
                    openLine: nil, lineDelta: nil, lineRange: nil,
                    overPrice: -110, underPrice: -110,
                    nBooks: nil, closeYesProb: nil, openYesProb: nil,
                    lastGame: nil, l3Avg: nil, l5Avg: nil, l10Avg: nil,
                    sznAvg: nil, sznMax: nil, sznMin: nil,
                    overRateL5: nil, overRateL10: nil, defMatchupIdx: nil,
                    flags: [],
                    recentGames: games
                ),
            ]
        )
    }
}
