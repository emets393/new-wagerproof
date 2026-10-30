import XCTest
@testable import WagerproofModels

/// Same fixtures as `src/features/publicBetting/signals.test.ts`. A 52/48 ticket
/// split with the money on the other side is sharp money, and a line the public
/// is pounding is hammered — those two used to collapse into "even split" and
/// "sharp" respectively.
final class PublicBettingTests: XCTestCase {

    func testBoiseIsSharpMoneyOnTheDog() {
        let read = PublicBetting.read(row(
            market: .spread,
            away: "Boise State", home: "Washington St",
            awayOpen: -16.5, homeOpen: 16.5,
            awayCons: -13, homeCons: 13,
            bets: (52, 48), money: (15, 85)
        ))
        XCTAssertEqual(read.category, .sharpMoney)
        XCTAssertEqual(read.chip, "Sharp Money on Washington St")
        XCTAssertEqual(read.tiltPp, 37, accuracy: 0.001)
        XCTAssertEqual(read.current, -13)
        XCTAssertEqual(read.homeCurrent, 13)
        XCTAssertTrue(read.strong)
        XCTAssertFalse(read.excluded)
        let line = PublicBetting.quoteLine(
            market: .spread, awayName: "Boise State", homeName: "Washington St",
            quote: PublicLineQuote(movedToward: read.movedToward, moveSize: read.moveSize, open: read.open, current: read.current, homeOpen: read.homeOpen, homeCurrent: read.homeCurrent)
        )
        XCTAssertEqual(line, "Boise State -16.5 → -13 · Washington St +16.5 → +13")
        XCTAssertFalse(line.contains(".25"))
    }

    func testIndianaUnderIsSharpButNotStrong() {
        let read = PublicBetting.read(row(
            market: .total,
            away: "Over", home: "Under",
            awayOpen: 52.5, homeOpen: nil,
            awayCons: 41.5, homeCons: nil,
            bets: (83, 17), money: (64, 36)
        ))
        XCTAssertEqual(read.category, .sharpMoney)
        XCTAssertEqual(read.chip, "Sharp Money on the Under")
        XCTAssertEqual(read.tiltPp, 19, accuracy: 0.001)
        XCTAssertEqual(read.moveSize, 11)
        XCTAssertEqual(read.current, 41.5)
        XCTAssertFalse(read.strong)
        XCTAssertEqual(PublicBetting.lineCaption(market: .total, read: read)?.text, "11 points toward the Under")
        XCTAssertEqual(PublicBetting.lineCaption(market: .total, read: read)?.mark, "📉")
    }

    func testHammeredIsThePublicWithVolume() {
        let read = PublicBetting.read(row(
            market: .spread,
            away: "Cincinnati", home: "Oklahoma",
            awayOpen: 3.5, homeOpen: -3.5,
            awayCons: 3, homeCons: -3,
            bets: (73, 27), money: (87, 13)
        ))
        XCTAssertEqual(read.category, .hammered)
        XCTAssertNotEqual(read.category, .sharpMoney)
        XCTAssertTrue(read.sentence.contains("not sharp action"))
        XCTAssertEqual(read.emphasis, .medium)
    }

    func testFlatDivergingMoneyHasNotMoved() {
        let read = PublicBetting.read(row(
            market: .spread,
            away: "Houston", home: "Utah",
            awayOpen: 6.5, homeOpen: -6.5,
            awayCons: 6.5, homeCons: -6.5,
            bets: (69, 31), money: (47, 53)
        ))
        XCTAssertEqual(read.category, .moneyNoMove)
        XCTAssertEqual(read.chip, "Money on Utah")
    }

    func testQuarterPointDriftDoesNotCountAsAMove() {
        let read = PublicBetting.read(row(
            market: .total,
            away: "Over", home: "Under",
            awayOpen: 45, homeOpen: nil,
            awayCons: 44.75, homeCons: nil,
            bets: (70, 30), money: (40, 60)
        ))
        XCTAssertEqual(read.category, .moneyNoMove)
        XCTAssertNil(PublicBetting.lineDirection(row(
            market: .spread, away: "A", home: "B",
            awayOpen: nil, homeOpen: nil, awayCons: -3, homeCons: 3,
            bets: (60, 40), money: (60, 40)
        )).movedToward)
    }

    func testLineFightingTheMoney() {
        let read = PublicBetting.read(row(
            market: .spread,
            away: "Oklahoma", home: "Mississippi St",
            awayOpen: -1.5, homeOpen: 1.5,
            awayCons: -4.5, homeCons: 4.5,
            bets: (59, 41), money: (42, 58)
        ))
        XCTAssertEqual(read.category, .lineFightsMoney)
        XCTAssertEqual(read.chip, "Line fighting the money")
    }

    func testLinePushingBackStaysQuiet() {
        let read = PublicBetting.read(row(
            market: .total,
            away: "Over", home: "Under",
            awayOpen: 50.5, homeOpen: nil,
            awayCons: 54.5, homeCons: nil,
            bets: (9, 91), money: (10, 90)
        ))
        XCTAssertEqual(read.category, .linePushesBack)
        XCTAssertEqual(read.emphasis, .quiet)
        XCTAssertEqual(read.chip, "Line pushing back")
    }

    func testPiledMoneyMovingWithTheCrowdIsHammered() {
        let read = PublicBetting.read(row(
            market: .spread,
            away: "Celtics", home: "Knicks",
            awayOpen: -3, homeOpen: 3,
            awayCons: -4.5, homeCons: 4.5,
            bets: (70, 30), money: (80, 20)
        ))
        XCTAssertEqual(read.category, .hammered)
    }

    func testPiledMoneyMovingAwayIsTheBookFadingThePublic() {
        let read = PublicBetting.read(row(
            market: .spread,
            away: "Celtics", home: "Knicks",
            awayOpen: -4.5, homeOpen: 4.5,
            awayCons: -3, homeCons: 3,
            bets: (70, 30), money: (80, 20)
        ))
        XCTAssertEqual(read.category, .linePushesBack)
        XCTAssertEqual(read.emphasis, .quiet)
    }

    func testMoneylineFloorDropsAOneBetDogAndKeepsALopsidedSpread() {
        let ml = PublicBetting.read(row(
            market: .ml,
            away: "Old Dominion", home: "LA Tech",
            awayOpen: 400, homeOpen: -550,
            awayCons: 450, homeCons: -600,
            bets: (4, 96), money: (79, 21)
        ))
        XCTAssertTrue(ml.excluded)
        let spread = PublicBetting.read(row(
            market: .spread,
            away: "Old Dominion", home: "LA Tech",
            awayOpen: 14, homeOpen: -14,
            awayCons: 13, homeCons: -13,
            bets: (12, 88), money: (30, 70)
        ))
        XCTAssertFalse(spread.excluded)
    }

    func testMissingTicketCountStillShowsTheSplit() {
        let read = PublicBetting.read(row(
            market: .spread,
            away: "Bucks", home: "Wizards",
            awayOpen: -3, homeOpen: 3,
            awayCons: -4.5, homeCons: 4.5,
            bets: (40, 60), money: (55, 45),
            tickets: nil
        ))
        XCTAssertFalse(read.excluded)
        let thin = PublicBetting.read(row(
            market: .spread,
            away: "Bucks", home: "Wizards",
            awayOpen: -3, homeOpen: 3,
            awayCons: -4.5, homeCons: 4.5,
            bets: (40, 60), money: (55, 45),
            tickets: 199
        ))
        XCTAssertTrue(thin.excluded)
    }

    func testMoneylineMoveUsesDeviggedPriceNotASubtraction() {
        let input = row(
            market: .ml,
            away: "Away", home: "Home",
            awayOpen: 105, homeOpen: -125,
            awayCons: -113, homeCons: 102,
            bets: (40, 60), money: (20, 80)
        )
        let quote = PublicBetting.lineDirection(input)
        XCTAssertEqual(quote.movedToward, .away)
        XCTAssertEqual(quote.current, -113)
        XCTAssertEqual(quote.homeCurrent, 102)
        let read = PublicBetting.read(input)
        XCTAssertEqual(read.category, .linePushesBack)
        XCTAssertNotEqual(read.category, .sharpMoney)
        XCTAssertNotEqual(read.category, .hammered)
    }

    func testLeanAndEvenSplit() {
        let lean = PublicBetting.read(row(
            market: .spread,
            away: "Celtics", home: "Knicks",
            awayOpen: -3, homeOpen: 3,
            awayCons: -3, homeCons: 3,
            bets: (56, 44), money: (56, 44)
        ))
        XCTAssertEqual(lean.category, .split)
        XCTAssertEqual(lean.chip, "Leaning Celtics")
        XCTAssertEqual(lean.emphasis, .none)

        let even = PublicBetting.read(row(
            market: .spread,
            away: "Celtics", home: "Knicks",
            awayOpen: -3, homeOpen: 3,
            awayCons: -3, homeCons: 3,
            bets: (50, 50), money: (50, 50)
        ))
        XCTAssertEqual(even.chip, "Split")
    }

    func testDifferenceCaptionAndBoardSort() {
        let wide = PublicBetting.read(row(
            market: .spread,
            away: "Boise State", home: "Washington St",
            awayOpen: -16.5, homeOpen: 16.5,
            awayCons: -13, homeCons: 13,
            bets: (52, 48), money: (15, 85)
        ))
        let gap = PublicBetting.moneyGap(for: wide)
        XCTAssertEqual(gap?.points, 37)
        XCTAssertEqual(gap?.side, .home)
        XCTAssertEqual(gap?.name, "Washington St")
        let moved = PublicBetting.lineCaption(market: .spread, read: wide)
        XCTAssertEqual(moved?.text, "3.5 points toward Washington St")
        XCTAssertEqual(moved?.mark, "👉")
        XCTAssertEqual(moved?.flat, false)

        let even = PublicBetting.read(row(
            market: .spread,
            away: "Chiefs", home: "Bills",
            awayOpen: -3, homeOpen: 3,
            awayCons: -3, homeCons: 3,
            bets: (50, 50), money: (50, 50)
        ))
        XCTAssertNil(PublicBetting.moneyGap(for: even))
        XCTAssertEqual(PublicBetting.lineCaption(market: .spread, read: even)?.text, "Unchanged")
        XCTAssertEqual(PublicBetting.lineCaption(market: .spread, read: even)?.mark, "⏸️")

        let early = boardGame(1, "Chiefs", "Bills", "2026-10-25T17:00:00Z", even)
        let late = boardGame(2, "Boise State", "Washington St", "2026-10-25T20:00:00Z", wide)
        XCTAssertEqual(
            PublicBetting.ordered([early, late], sport: "nfl", market: .spread, sharpOnly: false, query: "", sort: .diff).map(\.gameId),
            [2, 1]
        )
        XCTAssertEqual(
            PublicBetting.ordered([late, early], sport: "nfl", market: .spread, sharpOnly: false, query: "", sort: .time).map(\.gameId),
            [1, 2]
        )
        XCTAssertEqual(
            PublicBetting.ordered([early, late], sport: "nfl", market: .spread, sharpOnly: false, query: "kc", sort: .sharp).map(\.gameId),
            [1]
        )
        XCTAssertEqual(
            PublicBetting.ordered([early, late], sport: "nfl", market: .spread, sharpOnly: true, query: "", sort: .sharp).map(\.gameId),
            [2]
        )
    }

    private func boardGame(
        _ id: Int,
        _ away: String,
        _ home: String,
        _ start: String,
        _ read: PublicMarketRead
    ) -> PublicBettingGame {
        PublicBettingGame(
            gameId: id,
            sport: "nfl",
            away: away,
            home: home,
            startTime: start,
            capturedAt: nil,
            tickets: read.tickets.map { Int($0.rounded()) },
            reads: [read.market: read]
        )
    }

    private func row(
        market: PublicMarket,
        away: String,
        home: String,
        awayOpen: Double?,
        homeOpen: Double?,
        awayCons: Double?,
        homeCons: Double?,
        bets: (Double, Double),
        money: (Double, Double),
        tickets: Double? = 800
    ) -> PublicMarketInput {
        PublicMarketInput(
            market: market,
            awayName: away,
            homeName: home,
            awayOpen: awayOpen,
            homeOpen: homeOpen,
            awayCons: awayCons,
            homeCons: homeCons,
            betsAway: bets.0,
            betsHome: bets.1,
            moneyAway: money.0,
            moneyHome: money.1,
            tickets: tickets,
            hasSplit: true
        )
    }
}
