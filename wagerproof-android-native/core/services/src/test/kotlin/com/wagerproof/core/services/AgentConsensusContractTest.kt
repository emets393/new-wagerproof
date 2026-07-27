package com.wagerproof.core.services

import com.wagerproof.core.models.AgentSpriteIndex
import com.wagerproof.core.models.GameAgentConsensus
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.serialization.builtins.ListSerializer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Wire contract for `get_game_agent_consensus`. The RPC mixes snake_case column
 * names with a camelCase `jsonb_build_object` blob and returns NUMERIC for
 * `agreement`, so this is the shape most likely to break silently.
 * See .claude/docs/18_agent_consensus.md.
 */
class AgentConsensusContractTest {

    @Test
    fun decodesFlaggedRowWithNumericAgreementAsString() {
        // PostgREST renders NUMERIC as a JSON string on some deployments.
        val rows = WagerproofJson.decodeFromString(
            ListSerializer(GameAgentConsensus.serializer()),
            """
            [{
              "game_id": "776543",
              "game_date": "2026-07-26",
              "agents": 39,
              "side": "Over 7.5",
              "side_agents": 39,
              "agreement": "1.0000",
              "threshold": 12,
              "flagged": true,
              "avatars": [
                {"avatarId": "a1", "name": "Sharp Sam", "spriteIndex": 7, "color": "#10b981"},
                {"avatarId": "a2", "name": "Gradient Gus", "spriteIndex": 3, "color": "gradient:#6366f1,#ec4899"}
              ]
            }]
            """.trimIndent(),
        )

        val row = rows.single()
        assertEquals("776543", row.gameId)
        assertEquals("Over 7.5", row.side)
        assertEquals(39, row.sideAgents)
        assertEquals(100, row.agreementPercent)
        assertTrue(row.flagged)
        assertEquals(2, row.avatars.size)
        assertEquals(7, row.avatars[0].resolvedSpriteIndex)
        assertEquals(3, row.avatars[1].resolvedSpriteIndex)
        assertEquals("gradient:#6366f1,#ec4899", row.avatars[1].color)
    }

    @Test
    fun decodesUnflaggedRowWithNumericAgreementAsNumber() {
        val row = WagerproofJson.decodeFromString(
            GameAgentConsensus.serializer(),
            """
            {
              "game_id": "776544",
              "game_date": "2026-07-26",
              "agents": 45,
              "side": "Cleveland Guardians ML",
              "side_agents": 14,
              "agreement": 0.3111,
              "threshold": 12,
              "flagged": false,
              "avatars": []
            }
            """.trimIndent(),
        )

        // 45 agents but only 31% on one side — the case that proves participation
        // alone must not flag a card.
        assertEquals(45, row.agents)
        assertEquals(31, row.agreementPercent)
        assertFalse(row.flagged)
        assertTrue(row.avatars.isEmpty())
    }

    @Test
    fun toleratesMissingAvatarFieldsAndUnknownColumns() {
        val row = WagerproofJson.decodeFromString(
            GameAgentConsensus.serializer(),
            """
            {
              "game_id": "776545",
              "game_date": "2026-07-27",
              "agents": 9,
              "side": "Under 8",
              "side_agents": 9,
              "agreement": 1,
              "threshold": 8,
              "flagged": true,
              "avatars": [{"avatarId": "a3", "name": "No Art", "spriteIndex": null, "color": null}],
              "some_future_column": 1
            }
            """.trimIndent(),
        )

        val avatar = row.avatars.single()
        assertEquals("a3", avatar.avatarId)
        // Null sprite/color are normal — the strip hashes the id and uses slate-500.
        assertNull(avatar.spriteIndex)
        assertEquals(AgentSpriteIndex.forSeed("a3"), avatar.resolvedSpriteIndex)
        assertNull(avatar.color)
    }
}
