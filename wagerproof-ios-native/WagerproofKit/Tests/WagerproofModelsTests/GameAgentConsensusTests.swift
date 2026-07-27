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
}
