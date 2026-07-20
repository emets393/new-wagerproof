import XCTest
import WagerproofModels
@testable import WagerproofServices

/// Pure-function tests for the Parlay God engine: odds math, leg assembly
/// rules (dedup / uniqueness / conflicts / market cap), and ticket building.
/// The extraction rules were validated against live data first — see
/// .context/parlay_god_demo.py for the reference implementation.
final class ParlayGodEngineTests: XCTestCase {
    // MARK: - Odds math

    func testDecimalOddsConversion() {
        XCTAssertEqual(ParlayGodEngine.decimalOdds(100), 2.0, accuracy: 1e-9)
        XCTAssertEqual(ParlayGodEngine.decimalOdds(-110), 1.909, accuracy: 0.001)
        XCTAssertEqual(ParlayGodEngine.decimalOdds(150), 2.5, accuracy: 1e-9)
        XCTAssertEqual(ParlayGodEngine.decimalOdds(-200), 1.5, accuracy: 1e-9)
    }

    func testAmericanTextRoundTrip() {
        XCTAssertEqual(ParlayGodEngine.americanText(fromDecimal: 2.5), "+150")
        XCTAssertEqual(ParlayGodEngine.americanText(fromDecimal: 1.5), "-200")
        XCTAssertEqual(ParlayGodEngine.americanText(fromDecimal: 2.0), "+100")
    }

    func testCombinedOddsMatchesHandMath() {
        // -176, +122, +114 → 1.568 * 2.22 * 2.14 = 7.4497 → +645
        let legs = [
            makeLeg(subject: "A", game: "1", odds: -176),
            makeLeg(subject: "B", game: "2", odds: 122),
            makeLeg(subject: "C", game: "3", odds: 114),
        ]
        XCTAssertEqual(ParlayGodEngine.combinedOddsText(legs), "+645")
    }

    // MARK: - Assembly

    func testAssemblePrefersDeeperStreaks() {
        let pool = [
            makeLeg(subject: "A", game: "1", odds: -110, n: 5),
            makeLeg(subject: "B", game: "2", odds: -110, n: 10),
            makeLeg(subject: "C", game: "3", odds: -110, n: 8),
        ]
        let chosen = ParlayGodEngine.assemble(pool, maxLegs: 2, onePerGame: true)
        XCTAssertEqual(chosen.map(\.subject), ["B", "C"])
    }

    func testAssembleRejectsDuplicateSubjects() {
        let pool = [
            makeLeg(subject: "A", game: "1", odds: -110, n: 10, bet: "X ML"),
            makeLeg(subject: "A", game: "1", odds: -110, n: 8, bet: "X -1.5"),
            makeLeg(subject: "B", game: "2", odds: -110, n: 5),
        ]
        let chosen = ParlayGodEngine.assemble(pool, onePerGame: true)
        XCTAssertEqual(chosen.map(\.subject), ["A", "B"])
    }

    func testAssembleOnePerGame() {
        let pool = [
            makeLeg(subject: "A", game: "1", odds: -110, n: 10),
            makeLeg(subject: "B", game: "1", odds: -110, n: 9),
            makeLeg(subject: "C", game: "2", odds: -110, n: 5),
        ]
        let chosen = ParlayGodEngine.assemble(pool, onePerGame: true)
        XCTAssertEqual(chosen.map(\.subject), ["A", "C"])
        // Same pool without the constraint keeps all three.
        XCTAssertEqual(ParlayGodEngine.assemble(pool, onePerGame: false).count, 3)
    }

    func testAssembleDedupsSameBetFromDifferentSources() {
        // The same "CWS ML" fade can qualify via Team Form AND an H2H record —
        // one ticket must never carry it twice, keeping the deeper sample.
        let pool = [
            makeLeg(subject: "White Sox", game: "1", odds: 114, n: 5, bet: "CWS ML"),
            makeLeg(subject: "White Sox", game: "1", odds: 114, n: 3, bet: "CWS ML"),
        ]
        let chosen = ParlayGodEngine.assemble(pool, onePerGame: false)
        XCTAssertEqual(chosen.count, 1)
        XCTAssertEqual(chosen[0].streakN, 5)
    }

    func testAssembleMarketDiversityCap() {
        let pool = (0..<5).map { i in
            makeLeg(subject: "P\(i)", game: "g\(i)", odds: -110, n: 10 - i, market: "batter_hits")
        } + [makeLeg(subject: "Q", game: "g9", odds: -110, n: 3, market: "batter_rbis")]
        let chosen = ParlayGodEngine.assemble(pool, onePerGame: true)
        XCTAssertEqual(chosen.filter { $0.marketKey == "batter_hits" }.count, 2)
        XCTAssertTrue(chosen.contains { $0.marketKey == "batter_rbis" })
    }

    func testAssembleBlocksOppositeTotalsSides() {
        let over = makeLeg(subject: "Overs", game: "1", odds: -105, n: 5,
                           totalsFamily: "ou", totalsSide: "over")
        let under = makeLeg(subject: "Unders", game: "1", odds: -115, n: 4,
                            totalsFamily: "ou", totalsSide: "under")
        let chosen = ParlayGodEngine.assemble([over, under], onePerGame: false)
        XCTAssertEqual(chosen.count, 1)
        XCTAssertEqual(chosen[0].subject, "Overs")
    }

    func testAssembleBlocksOpposingTeamsInSameGame() {
        let home = makeLeg(subject: "Yankees", game: "1", odds: -120, n: 6, backedTeam: "NYY")
        let away = makeLeg(subject: "Red Sox", game: "1", odds: 100, n: 5, backedTeam: "BOS")
        let chosen = ParlayGodEngine.assemble([home, away], onePerGame: false)
        XCTAssertEqual(chosen.count, 1)
        XCTAssertEqual(chosen[0].subject, "Yankees")
    }

    func testAssembleAllowsOpposingTeamsAcrossGames() {
        let a = makeLeg(subject: "Yankees", game: "1", odds: -120, n: 6, backedTeam: "NYY")
        let b = makeLeg(subject: "Red Sox", game: "2", odds: 100, n: 5, backedTeam: "BOS")
        XCTAssertEqual(ParlayGodEngine.assemble([a, b], onePerGame: true).count, 2)
    }

    func testAssembleExclusionSupportsMultipleCards() {
        let pool = [
            makeLeg(subject: "A", game: "1", odds: -110, n: 10),
            makeLeg(subject: "B", game: "1", odds: -110, n: 9),
            makeLeg(subject: "C", game: "1", odds: -110, n: 8),
        ]
        let first = ParlayGodEngine.assemble(pool, maxLegs: 2, onePerGame: false)
        let used = Set(first.map(ParlayGodEngine.exclusionKey))
        let second = ParlayGodEngine.assemble(pool, maxLegs: 2, onePerGame: false, excluding: used)
        XCTAssertEqual(first.map(\.subject), ["A", "B"])
        XCTAssertEqual(second.map(\.subject), ["C"])
    }

    func testAssembleIsDeterministic() {
        let pool = [
            makeLeg(subject: "A", game: "1", odds: -110, n: 5),
            makeLeg(subject: "B", game: "2", odds: -110, n: 5),
            makeLeg(subject: "C", game: "3", odds: -110, n: 5),
        ]
        let runs = (0..<5).map { _ in ParlayGodEngine.assemble(pool, onePerGame: true).map(\.id) }
        XCTAssertTrue(runs.dropFirst().allSatisfy { $0 == runs[0] })
    }

    // MARK: - Tickets

    func testSlateTicketsDropThinCategories() {
        // Two recent-form legs (below minLegs) + three team-form legs.
        let pool = [
            makeLeg(subject: "A", game: "1", odds: -110, n: 10, category: .recentForm),
            makeLeg(subject: "B", game: "2", odds: -110, n: 10, category: .recentForm),
            makeLeg(subject: "C", game: "3", odds: -110, n: 5, category: .teamForm),
            makeLeg(subject: "D", game: "4", odds: -110, n: 5, category: .teamForm),
            makeLeg(subject: "E", game: "5", odds: -110, n: 5, category: .teamForm),
        ]
        let tickets = ParlayGodEngine.slateTickets(from: pool)
        XCTAssertEqual(tickets.count, 1)
        XCTAssertEqual(tickets.first?.category, .teamForm)
        XCTAssertEqual(tickets.first?.legs.count, 3)
    }

    func testSlateTicketsExcludePropLegs() {
        // Parlay God (Outliers/Search) is game-markets only; props belong to
        // Props Cheats. Three deep prop legs must not leak onto the slate rail.
        let pool = [
            makeLeg(subject: "P1", game: "1", odds: -110, n: 10, category: .dayNight, kind: .prop),
            makeLeg(subject: "P2", game: "2", odds: -110, n: 10, category: .dayNight, kind: .prop),
            makeLeg(subject: "P3", game: "3", odds: -110, n: 10, category: .dayNight, kind: .prop),
            makeLeg(subject: "A", game: "4", odds: -110, n: 5, category: .teamForm, kind: .team),
            makeLeg(subject: "B", game: "5", odds: -110, n: 5, category: .teamForm, kind: .team),
            makeLeg(subject: "C", game: "6", odds: -110, n: 5, category: .teamForm, kind: .team),
        ]
        let tickets = ParlayGodEngine.slateTickets(from: pool)
        XCTAssertEqual(tickets.map(\.category), [.teamForm])
        XCTAssertTrue(tickets.allSatisfy { $0.legs.allSatisfy { $0.kind == .team } })
    }

    func testPropsTicketsExcludeTeamLegs() {
        let pool = [
            makeLeg(subject: "A", game: "1", odds: -110, n: 10, category: .recentForm, kind: .prop),
            makeLeg(subject: "B", game: "1", odds: -110, n: 9, category: .recentForm, kind: .prop),
            makeLeg(subject: "C", game: "2", odds: -110, n: 8, category: .recentForm, kind: .prop),
            makeLeg(subject: "Team", game: "3", odds: -110, n: 10, category: .recentForm, kind: .team),
        ]
        let tickets = ParlayGodEngine.propsTickets(from: pool)
        XCTAssertEqual(tickets.count, 1)
        XCTAssertFalse(tickets.first?.legs.contains { $0.kind == .team } ?? true)
    }

    func testGameTicketsScopeAndCascade() {
        let pool = [
            makeLeg(subject: "A", game: "g", odds: -110, n: 10),
            makeLeg(subject: "B", game: "g", odds: -110, n: 9),
            makeLeg(subject: "C", game: "g", odds: -110, n: 8),
            makeLeg(subject: "D", game: "other", odds: -110, n: 10),
        ]
        let tickets = ParlayGodEngine.gameTickets(from: pool, gameKey: "g")
        XCTAssertEqual(tickets.count, 1)
        XCTAssertTrue(tickets.first?.legs.allSatisfy { $0.gameKey == "g" } ?? false)
        XCTAssertEqual(tickets.first?.legs.count, 3)
    }

    func testGameTicketsAllowRepeatSubjectsForTeamOnlyPools() {
        // A game only has two team subjects — same-game cards may stack one
        // team across markets (ML + F5 ML + Over), which is a legitimate SGP.
        let pool = [
            makeLeg(subject: "Yankees", game: "g", odds: -120, n: 6, bet: "NYY ML", market: "ml", backedTeam: "NYY"),
            makeLeg(subject: "Yankees", game: "g", odds: -110, n: 5, bet: "F5 NYY ML", market: "f5_ml", backedTeam: "NYY"),
            makeLeg(subject: "Yankees", game: "g", odds: -105, n: 4, bet: "Over 8.5", market: "ou", totalsFamily: "ou", totalsSide: "over"),
        ]
        let tickets = ParlayGodEngine.gameTickets(from: pool, gameKey: "g")
        XCTAssertEqual(tickets.first?.legs.count, 3)
    }

    // MARK: - Bet text

    func testPropBetTextThresholdStyle() {
        XCTAssertEqual(ParlayGodEngine.propBetText(market: "batter_hits", line: 0.5, over: true).hasPrefix("1+"), true)
        XCTAssertEqual(ParlayGodEngine.propBetText(market: "batter_hits", line: 1.5, over: true).hasPrefix("2+"), true)
        XCTAssertTrue(ParlayGodEngine.propBetText(market: "batter_hits", line: 1.5, over: false).hasPrefix("Under 1.5"))
    }

    func testShortName() {
        XCTAssertEqual(ParlayGodEngine.shortName("Aaron Judge"), "A. Judge")
        XCTAssertEqual(ParlayGodEngine.shortName("Luis Gurriel Jr."), "L. Gurriel Jr.")
        XCTAssertEqual(ParlayGodEngine.shortName("Ichiro"), "Ichiro")
    }

    // MARK: - Helpers

    /// Default market is unique per subject so the per-market diversity cap
    /// stays out of tests that aren't exercising it (pass `market:` to opt in).
    private func makeLeg(
        subject: String,
        game: String,
        odds: Int,
        n: Int = 5,
        bet: String? = nil,
        market: String? = nil,
        category: ParlayGodCategory = .teamForm,
        kind: ParlayLeg.Kind = .team,
        backedTeam: String? = nil,
        totalsFamily: String? = nil,
        totalsSide: String? = nil
    ) -> ParlayLeg {
        ParlayLeg(
            kind: kind,
            category: category,
            gameKey: game,
            matchupLabel: "AWY @ HOM",
            gameTimeEt: nil,
            subject: subject,
            teamAbbr: backedTeam,
            playerId: nil,
            betText: bet ?? "\(subject) bet",
            odds: odds,
            evidence: "Won \(n) straight",
            streakN: n,
            marketKey: market ?? "mkt-\(subject)",
            backedTeamAbbr: backedTeam,
            totalsFamily: totalsFamily,
            totalsSide: totalsSide
        )
    }
}
