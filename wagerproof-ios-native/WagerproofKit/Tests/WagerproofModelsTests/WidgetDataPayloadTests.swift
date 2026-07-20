import XCTest
@testable import WagerproofModels

final class WidgetDataPayloadTests: XCTestCase {
    func testLegacyPayloadWithoutLastUpdatedStillDecodes() throws {
        let json = #"{"topAgentPicks":[],"topOutliers":[]}"#

        let payload = try JSONDecoder().decode(
            WidgetDataPayload.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(payload.lastUpdated, "")
        XCTAssertTrue(payload.editorPicks.isEmpty)
        XCTAssertTrue(payload.fadeAlerts.isEmpty)
        XCTAssertTrue(payload.polymarketValues.isEmpty)
        XCTAssertTrue(payload.topAgentPicks.isEmpty)
        XCTAssertTrue(payload.topOutliers.isEmpty)
        XCTAssertTrue(payload.outlierMarkets.isEmpty)
    }

    func testCombinedWidgetDomainsSurviveRoundTrip() throws {
        let agent = TopAgentWidgetData(
            agentId: "agent-1",
            agentName: "Sharp Edge",
            agentEmoji: "\u{1F916}",
            agentColor: "#6366f1",
            isFavorite: true,
            netUnits: 4.5,
            winRate: 62,
            currentStreak: 3,
            record: "8-5",
            picks: []
        )
        let outlier = OutlierAlertForWidget(
            id: "value-game-1",
            kind: .value,
            sport: "nfl",
            awayTeam: "Away",
            homeTeam: "Home",
            marketType: "Spread",
            side: "Away",
            confidence: 64
        )
        let original = WidgetDataPayload(
            topAgentPicks: [agent],
            topOutliers: [outlier],
            outlierMarkets: [
                OutliersWidgetMarketData(
                    id: "moneyline",
                    title: "Moneyline",
                    symbolName: "dollarsign.circle.fill",
                    items: [
                        OutliersWidgetItem(
                            id: "moneyline-game-1",
                            sport: "MLB",
                            matchup: "Away @ Home",
                            subject: "Home",
                            selection: "Moneyline",
                            oddsText: "-110",
                            hitCount: 9,
                            sampleSize: 10,
                            additionalTrendCount: 2
                        )
                    ],
                    totalCount: 3
                )
            ],
            lastUpdated: "2026-07-19T12:00:00Z"
        )

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(WidgetDataPayload.self, from: data)

        XCTAssertEqual(decoded.topAgentPicks, [agent])
        XCTAssertEqual(decoded.topOutliers, [outlier])
        XCTAssertEqual(decoded.outlierMarkets, original.outlierMarkets)
        XCTAssertEqual(decoded.outlierMarkets.first?.items.first?.fractionText, "9/10")
        XCTAssertEqual(decoded.lastUpdated, original.lastUpdated)
    }

    func testLegacyAgentGetsStableAvatarAndEmptyForm() throws {
        let json = #"{"agentId":"agent-legacy","agentName":"Legacy","currentStreak":2,"record":"5-3","picks":[]}"#

        let agent = try JSONDecoder().decode(
            TopAgentWidgetData.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(agent.bestStreak, 0)
        XCTAssertEqual(agent.spriteIndex, AgentSpriteIndex.forSeed("agent-legacy"))
        XCTAssertTrue(agent.form.isEmpty)
    }

    func testTrendOutlierKindRoundTrips() throws {
        let original = OutlierAlertForWidget(
            id: "trend-1",
            kind: .trend,
            sport: "mlb",
            awayTeam: "Away",
            homeTeam: "Home",
            marketType: "Moneyline",
            side: "Home",
            confidence: 72
        )

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(OutlierAlertForWidget.self, from: data)

        XCTAssertEqual(decoded, original)
        XCTAssertEqual(decoded.kind, .trend)
    }
}
