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

    /// This test previously asserted the DEFECT: ten games the generator had
    /// already graded as misses (`cleared: false`) were re-graded against
    /// today's line and reported as 10 hits. A hit rate is a claim about
    /// beating the posted price, so the served grade wins.
    func testHitsUseTheGradeFromTheGamesOwnPrice() {
        let games = (1...10).map { week in
            NFLPropRecentGame(opp: "CHI", week: week, actual: 90, cleared: false)
        }
        let market = Self.market(closeLine: 84.5, games: games)
        XCTAssertEqual(market.l10Hits.hits, 0, "served misses must not become hits")
        XCTAssertEqual(market.l10Hits.n, 10)
    }

    /// Calvin Ridley, 2026 wk4: today's receiving-yards line was 5.5, so every
    /// one of his last ten games cleared it and the app read "10/10". Against
    /// the lines he was actually priced at he was 5-10. Numbers are the real
    /// shape of that row — five games over their own line, five under.
    func testLowCurrentLineCannotManufactureAPerfectStreak() {
        let hist: [(Double, Double)] = [            // (actual, line posted then)
            (84, 60.5), (40, 55.5), (90, 70.5), (22, 48.5), (65, 44.5),
            (31, 52.5), (12, 39.5), (77, 58.5), (18, 41.5), (26, 49.5),
        ]
        let games = hist.enumerated().map { i, g in
            NFLPropRecentGame(opp: "IND", week: i + 1, actual: g.0, cleared: nil, line: g.1)
        }
        let market = Self.market(closeLine: 5.5, games: games)
        XCTAssertEqual(market.l10Hits, (hits: 5, n: 10), "must grade at each game's own price")
        XCTAssertEqual(market.l10HistoricalBasisShare, 1.0)
        // The strip and the fraction have to agree — that mismatch is the bug.
        XCTAssertEqual(market.miniStrip.filter(\.cleared).count, 5)
    }

    /// A push is not a miss: it leaves the denominator.
    func testPushDropsOutOfTheDenominator() {
        let games = [
            NFLPropRecentGame(opp: "IND", week: 1, actual: 60, cleared: nil, line: 50.5),
            NFLPropRecentGame(opp: "IND", week: 2, actual: 50, cleared: nil, line: 50),
            NFLPropRecentGame(opp: "IND", week: 3, actual: 70, cleared: nil, line: 50.5),
        ]
        let market = Self.market(closeLine: 50.5, games: games)
        XCTAssertEqual(market.l10Hits, (hits: 2, n: 2))
    }

    /// With no historical basis at all we fall back to today's line, and the
    /// basis share has to say so rather than passing it off as a hit rate.
    func testNoHistoricalBasisIsReported() {
        let games = (1...4).map { NFLPropRecentGame(opp: "IND", week: $0, actual: 90) }
        let market = Self.market(closeLine: 84.5, games: games)
        XCTAssertEqual(market.l10Hits, (hits: 4, n: 4))
        XCTAssertEqual(market.l10HistoricalBasisShare, 0.0)
    }

    private static func market(closeLine: Double, games: [NFLPropRecentGame]) -> NFLPropMarket {
        NFLPropMarket(
            market: "player_reception_yds",
            closeLine: closeLine,
            openLine: nil, lineDelta: nil, lineRange: nil,
            overPrice: -110, underPrice: -110,
            nBooks: nil, closeYesProb: nil, openYesProb: nil,
            lastGame: nil, l3Avg: nil, l5Avg: nil, l10Avg: nil,
            sznAvg: nil, sznMax: nil, sznMin: nil,
            overRateL5: nil, overRateL10: nil, defMatchupIdx: nil,
            flags: [],
            recentGames: games
        )
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
