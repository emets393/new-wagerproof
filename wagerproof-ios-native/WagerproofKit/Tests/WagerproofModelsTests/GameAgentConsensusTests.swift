import XCTest
@testable import WagerproofModels

/// Decoding tests for `get_game_agent_consensus` rows. The RPC mixes snake_case
/// row columns with a camelCase jsonb payload, so the mapping is easy to get
/// subtly wrong and impossible to notice at runtime — a mis-decoded row just
/// renders as "no consensus". See .claude/docs/18_agent_consensus.md.
final class GameAgentConsensusTests: XCTestCase {

    private func decode(_ json: String) throws -> [GameAgentConsensus] {
        try JSONDecoder().decode([GameAgentConsensus].self, from: Data(json.utf8))
    }

    func testDecodesFlaggedRow() throws {
        let rows = try decode("""
        [{
          "game_id": "776543",
          "game_date": "2026-07-26",
          "agents": 39,
          "side": "Over 7.5",
          "side_agents": 39,
          "market_agents": 39,
          "market_label": "total",
          "agreement": 1.0,
          "threshold": 8,
          "flagged": true,
          "avatars": [
            {"avatarId": "a1", "name": "Sharp Sam", "spriteIndex": 7, "color": "#6366f1"},
            {"avatarId": "a2", "name": "Chalk Carl", "spriteIndex": 3, "color": "gradient:#f97316,#facc15"}
          ]
        }]
        """)
        let row = try XCTUnwrap(rows.first)
        XCTAssertEqual(row.gameId, "776543")
        XCTAssertEqual(row.id, "776543")
        XCTAssertEqual(row.gameDate, "2026-07-26")
        XCTAssertEqual(row.agents, 39)
        XCTAssertEqual(row.side, "Over 7.5")
        XCTAssertEqual(row.sideAgents, 39)
        XCTAssertEqual(row.marketAgents, 39)
        XCTAssertEqual(row.marketLabel, "total")
        XCTAssertEqual(row.agreement, 1.0, accuracy: 1e-9)
        XCTAssertEqual(row.agreementPercent, 100)
        XCTAssertEqual(row.threshold, 8)
        XCTAssertTrue(row.flagged)
        XCTAssertEqual(row.avatars.count, 2)
        XCTAssertEqual(row.avatars.first?.avatarId, "a1")
        XCTAssertEqual(row.avatars.first?.spriteIndex, 7)
        XCTAssertEqual(row.avatars.last?.spriteIndex, 3)
        XCTAssertEqual(row.avatars.last?.color, "gradient:#f97316,#facc15")
    }

    /// Postgres numerics can arrive quoted depending on the connection's
    /// extended-types setting; a whole row must not be lost over that.
    func testDecodesQuotedNumericAgreement() throws {
        let rows = try decode("""
        [{"game_id":"1","game_date":"2026-07-26","agents":16,"side":"Under 10",
          "side_agents":14,"agreement":"0.8750","threshold":8,"flagged":true,"avatars":[]}]
        """)
        XCTAssertEqual(rows.first?.agreement ?? 0, 0.875, accuracy: 1e-9)
        XCTAssertEqual(rows.first?.agreementPercent, 88)
    }

    /// Agreement is scoped to one bet shape, not every agent who touched the
    /// game. This is the July regression case that read 5/17 instead of 5/6.
    func testKeepsMarketPopulationSeparateFromWholeGameParticipation() throws {
        let rows = try decode("""
        [{"game_id":"1","game_date":"2026-07-29","agents":17,
          "side":"Pittsburgh Pirates F5 -0.5","side_agents":5,
          "market_agents":6,"market_label":"F5 run line",
          "agreement":"0.8333","threshold":8,"flagged":false,"avatars":[]}]
        """)
        let row = try XCTUnwrap(rows.first)
        XCTAssertEqual(row.agents, 17)
        XCTAssertEqual(row.sideAgents, 5)
        XCTAssertEqual(row.marketAgents, 6)
        XCTAssertEqual(row.marketLabel, "F5 run line")
        XCTAssertEqual(row.agreementPercent, 83)
    }

    /// A client can briefly see the pre-migration shape during staggered
    /// deployment; preserve the old population as a safe compatibility value.
    func testLegacyRowFallsBackToWholeGamePopulation() throws {
        let rows = try decode("""
        [{"game_id":"1","game_date":"2026-07-26","agents":16,"side":"Under 10",
          "side_agents":14,"agreement":"0.8750","threshold":8,"flagged":true,"avatars":[]}]
        """)
        let row = try XCTUnwrap(rows.first)
        XCTAssertEqual(row.marketAgents, 16)
        XCTAssertEqual(row.marketLabel, "")
    }

    /// An agent with no sprite override / avatar color is normal — the strip
    /// hashes the id for a stable sprite and falls back to a default bubble.
    func testDecodesNullAvatarFields() throws {
        let rows = try decode("""
        [{"game_id":"1","game_date":"2026-07-26","agents":3,"side":"Reds ML",
          "side_agents":2,"agreement":0.6667,"threshold":8,"flagged":false,
          "avatars":[{"avatarId":"a1","name":"Model Max","spriteIndex":null,"color":null}]}]
        """)
        let avatar = try XCTUnwrap(rows.first?.avatars.first)
        XCTAssertNil(avatar.spriteIndexOverride)
        XCTAssertEqual(avatar.spriteIndex, AgentSpriteIndex.forSeed("a1"))
        XCTAssertNil(avatar.color)
        XCTAssertFalse(try XCTUnwrap(rows.first).flagged)
    }

    /// `avatars` is COALESCEd to '[]' server-side, but the client must survive a
    /// missing key too rather than failing the whole slate.
    func testMissingAvatarsDecodesAsEmpty() throws {
        let rows = try decode("""
        [{"game_id":"1","game_date":"2026-07-26","agents":5,"side":"Over 8",
          "side_agents":3,"agreement":0.6,"threshold":8,"flagged":false}]
        """)
        XCTAssertEqual(rows.first?.avatars, [])
    }

    func testDecodesRunnerUpAndSlateRank() throws {
        let rows = try decode("""
        [{"game_id":"1","game_date":"2026-08-15","agents":41,"side":"TCU -6.5",
          "side_agents":18,"market_agents":35,"market_label":"spread",
          "agreement":"0.5143","threshold":13,"flagged":false,
          "runner_up_side":"Baylor +6.5","runner_up_agents":15,
          "slate_rank":3,"slate_games":14,"avatars":[]}]
        """)
        let row = try XCTUnwrap(rows.first)
        XCTAssertEqual(row.runnerUpSide, "Baylor +6.5")
        XCTAssertEqual(row.runnerUpAgents, 15)
        XCTAssertEqual(row.slateRank, 3)
        XCTAssertEqual(row.slateGames, 14)
        XCTAssertEqual(row.otherAgents, 2)
        XCTAssertEqual(row.slateRankLabel, "#3 of 14 today")
    }

    /// The four new columns are absent on a client deployed ahead of the
    /// migration — that must degrade the card, not fail the slate.
    func testRunnerUpAndRankAreOptional() throws {
        let rows = try decode("""
        [{"game_id":"1","game_date":"2026-07-26","agents":16,"side":"Under 10",
          "side_agents":14,"agreement":"0.8750","threshold":8,"flagged":true,"avatars":[]}]
        """)
        let row = try XCTUnwrap(rows.first)
        XCTAssertNil(row.runnerUpSide)
        XCTAssertNil(row.runnerUpAgents)
        XCTAssertNil(row.slateRankLabel)
        // Everything not on the leader is "other" when the runner-up is unknown.
        XCTAssertEqual(row.otherAgents, 2)
    }

    // MARK: - Verdict + copy
    //
    // These are the sentences the user reads. The old headline stated a
    // statistic and left the judging to them; the failure this guards is a card
    // that says "most-backed side" on a 51% coin flip.

    private func row(
        side: String = "TCU -6.5",
        sideAgents: Int,
        marketAgents: Int,
        marketLabel: String = "spread",
        flagged: Bool,
        runnerUpSide: String? = nil,
        runnerUpAgents: Int? = nil,
        slateRank: Int? = nil,
        slateGames: Int? = nil
    ) -> GameAgentConsensus {
        GameAgentConsensus(
            gameId: "g", gameDate: "2026-08-15", agents: marketAgents, side: side,
            sideAgents: sideAgents, marketAgents: marketAgents, marketLabel: marketLabel,
            agreement: Double(sideAgents) / Double(marketAgents),
            threshold: 13, flagged: flagged,
            runnerUpSide: runnerUpSide, runnerUpAgents: runnerUpAgents,
            slateRank: slateRank, slateGames: slateGames, avatars: []
        )
    }

    func testVerdictStates() {
        XCTAssertEqual(row(sideAgents: 31, marketAgents: 35, flagged: true).verdict, .consensus)
        // 51% and unflagged — the screenshot case that read as a lean.
        XCTAssertEqual(row(sideAgents: 18, marketAgents: 35, flagged: false).verdict, .split)
        // Lopsided but too thin to clear the count gate.
        XCTAssertEqual(row(sideAgents: 5, marketAgents: 6, flagged: false).verdict, .lean)
        XCTAssertEqual(row(sideAgents: 1, marketAgents: 2, flagged: false).verdict, .tooFew)
    }

    /// `flagged` is the server's decision. A row the server flagged is
    /// `.consensus` even if the client's own share constant would disagree.
    func testFlaggedAlwaysWinsOverTheLocalShareConstant() {
        XCTAssertEqual(row(sideAgents: 9, marketAgents: 20, flagged: true).verdict, .consensus)
    }

    func testHeadlinesStateAVerdictAndQuoteNoThreshold() {
        XCTAssertEqual(
            row(side: "Over 7.5", sideAgents: 31, marketAgents: 35, marketLabel: "total", flagged: true).headline,
            "Agents are on Over 7.5 — 31 of the 35 betting the total."
        )
        XCTAssertEqual(
            row(sideAgents: 18, marketAgents: 35, flagged: false).headline,
            "Agents are split on the spread — TCU -6.5 leads with 18 of 35."
        )
        XCTAssertEqual(
            row(side: "Pirates F5 -0.5", sideAgents: 5, marketAgents: 6, marketLabel: "F5 run line", flagged: false).headline,
            "Agents lean Pirates F5 -0.5, but only 6 bet the F5 run line."
        )
        XCTAssertEqual(
            row(sideAgents: 1, marketAgents: 1, flagged: false).headline,
            "Only 1 agent bet the spread on this game."
        )
        for text in [
            row(sideAgents: 18, marketAgents: 35, flagged: false).headline,
            row(sideAgents: 31, marketAgents: 35, flagged: true).headline,
        ] {
            XCTAssertFalse(text.contains("13"), "headline must not leak the flag threshold: \(text)")
            XCTAssertFalse(text.lowercased().contains("flag"), "headline must not say 'flag': \(text)")
        }
    }

    /// A legacy row has no market label, and the copy must not fall back to the
    /// word "side" — a market with alt lines or odds-suffixed selections is not
    /// necessarily two-way.
    func testCopyDropsTheMarketClauseWhenTheLabelIsMissing() {
        let legacy = GameAgentConsensus(
            gameId: "g", gameDate: "2026-08-15", agents: 35, side: "TCU -6.5",
            sideAgents: 18, agreement: 18.0 / 35.0, threshold: 13, flagged: false, avatars: []
        )
        XCTAssertEqual(legacy.headline, "Agents are split — TCU -6.5 leads with 18 of 35 agents.")
        XCTAssertEqual(legacy.mostBackedLabel, "Most backed")
        XCTAssertEqual(legacy.sharePopulationLabel, "of agent bets")
        XCTAssertFalse(legacy.headline.contains("side"))
    }

    func testBarLegendNamesEverySegment() {
        XCTAssertEqual(
            row(sideAgents: 18, marketAgents: 35, flagged: false,
                runnerUpSide: "Baylor +6.5", runnerUpAgents: 15).barLegend,
            ["18 TCU -6.5", "15 Baylor +6.5", "2 other"]
        )
        // No third group when the two sides account for the whole market.
        XCTAssertEqual(
            row(sideAgents: 20, marketAgents: 35, flagged: false,
                runnerUpSide: "Baylor +6.5", runnerUpAgents: 15).barLegend,
            ["20 TCU -6.5", "15 Baylor +6.5"]
        )
        XCTAssertEqual(
            row(sideAgents: 12, marketAgents: 12, flagged: true).barLegend,
            ["12 TCU -6.5", "unanimous"]
        )
    }

    /// The feed strip's old flagged line ("39 agents on OVER 7.5") asserted a
    /// share with no visible denominator.
    func testLeaderLineCarriesTheDenominator() {
        XCTAssertEqual(row(sideAgents: 18, marketAgents: 35, flagged: false).leaderLine,
                       "18 of 35 on TCU -6.5")
    }
}
