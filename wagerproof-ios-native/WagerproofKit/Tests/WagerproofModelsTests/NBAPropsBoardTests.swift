import XCTest
@testable import WagerproofModels

final class NBAPropsBoardTests: XCTestCase {
    func testPickSideNeedsAFiredSignal() {
        XCTAssertNil(NbaPropCopy.pickSide(row(), defs: [:]))
        let over = NbaPropDef(signalKey: "hot_over", displayName: "Hot over", oneLiner: nil, definition: nil, recordText: nil, seasonRecordText: nil, betDirection: "Over")
        XCTAssertEqual(NbaPropCopy.pickSide(row(flags: ["hot_over"]), defs: ["hot_over": over]), .over)
        XCTAssertEqual(NbaPropCopy.pickSide(row(flags: ["nba_player_ref_under"]), defs: [:]), .under)
    }

    func testUnderReferenceNamesGamesBelowTheNorm() {
        let detail = NbaFlagDetail(above: nil, games: 10, chief: "Brunson", below: 8)
        let sentence = NbaPropCopy.signalSentence(key: "nba_player_ref_under", detail: ["nba_player_ref_under": detail], playerName: nil)
        XCTAssertEqual(sentence, "8 of 10 games below his norm with Brunson")
    }

    func testRecentFormIsOldestFirstAndClearsTonightLine() {
        let form = NbaPropCopy.recentForm(row(recent: [
            NbaRecentGame(date: "2026-10-22", opp: "PHI", value: 18, line: 25),
            NbaRecentGame(date: "2026-10-18", opp: "CHI", value: 30, line: 22),
            NbaRecentGame(date: "2026-10-26", opp: "MIL", value: 24.5, line: 24),
        ]), limit: 10)
        XCTAssertEqual(form.bars.map(\.opponent), ["CHI", "PHI", "MIL"])
        XCTAssertEqual(form.hits, 1)
        XCTAssertEqual(form.games, 3)
    }

    func testSignalFilterKeepsOnlyFlaggedPlayers() {
        let quiet = row(name: "Quiet", athleteId: "2")
        let flagged = row(name: "Flagged", flags: ["nba_player_ref_over"])
        let visible = NbaPropCopy.filter([quiet, flagged], game: nil, market: nil, signalsOnly: true, query: "")
        XCTAssertEqual(visible.map(\.featured.playerName), ["Flagged"])
    }

    func testListShowsEachPlayerOnceAndKeepsPointsOnTheGraph() {
        let points = row(market: "player_points", label: "Points", line: 15)
        let rebounds = row(market: "player_rebounds", label: "Rebounds", line: 4.5)
        let assists = row(market: "player_assists", label: "Assists", line: 6.5, flags: ["nba_player_ref_over"])
        let cards = NbaPropCopy.filter([rebounds, points, assists], game: nil, market: nil, signalsOnly: false, query: "")
        XCTAssertEqual(cards.count, 1)
        XCTAssertEqual(cards[0].chart.market, "player_points")
        XCTAssertEqual(cards[0].featured.market, "player_assists")
        XCTAssertTrue(cards[0].highlighted)
    }

    func testListUsesPointsWhenThePlayerHasNoSignal() {
        let points = row(market: "player_points", label: "Points", line: 15)
        let rebounds = row(market: "player_rebounds", label: "Rebounds", line: 4.5)
        let cards = NbaPropCopy.filter([rebounds, points], game: nil, market: nil, signalsOnly: false, query: "")
        XCTAssertEqual(cards.count, 1)
        XCTAssertEqual(cards[0].chart.market, "player_points")
        XCTAssertEqual(cards[0].featured.market, "player_points")
        XCTAssertFalse(cards[0].highlighted)
    }

    func testMarketFilterFeaturesThatMarket() {
        let points = row(market: "player_points", label: "Points", line: 15)
        let rebounds = row(market: "player_rebounds", label: "Rebounds", line: 4.5)
        let cards = NbaPropCopy.filter([points, rebounds], game: nil, market: "player_rebounds", signalsOnly: false, query: "")
        XCTAssertEqual(cards.count, 1)
        XCTAssertEqual(cards[0].chart.market, "player_rebounds")
        XCTAssertEqual(cards[0].featured.market, "player_rebounds")
    }

    private func row(
        name: String = "Jalen Brunson",
        athleteId: String = "1",
        market: String = "player_points",
        label: String = "Points",
        line: Double = 24.5,
        flags: [String] = [],
        recent: [NbaRecentGame] = []
    ) -> NbaSlateProp {
        NbaSlateProp(
            gameDate: "2026-10-28", athleteId: athleteId, playerName: name, position: "G", team: "NYK",
            opponent: "BOS", headshotURL: nil, market: market, marketLabel: label, line: line,
            lastGame: nil, l3Avg: nil, l5Avg: nil, l10Avg: nil, sznAvg: nil, priorSznAvg: nil, priorSznGp: nil,
            gpPrior: 10, minL5: nil, overRateL5: nil, overRateL10: nil, overRateSzn: nil, recentGames: recent,
            baseline: nil, baselineGap: nil, rankPos: 1, flags: flags, flagDetail: [:], reportStatus: nil,
            homeAbbr: "NYK", awayAbbr: "BOS"
        )
    }
}
