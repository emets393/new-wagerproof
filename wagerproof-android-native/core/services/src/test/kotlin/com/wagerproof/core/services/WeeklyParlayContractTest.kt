package com.wagerproof.core.services

import com.wagerproof.core.models.AgentDetailSnapshot
import com.wagerproof.core.models.AgentParlay
import com.wagerproof.core.models.AgentParlayScope
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class WeeklyParlayContractTest {
    @Test
    fun decodesWeeklySnapshotAndResumableRunScope() {
        val snapshot = WagerproofJson.decodeFromString(
            AgentDetailSnapshot.serializer(),
            """
            {
              "api_version": "v3",
              "weekly_parlays": [{
                "id": "parlay-1",
                "avatar_id": "agent-1",
                "scope": "weekly",
                "week_key": "2026-07-07",
                "target_date": "2026-07-13",
                "legs": []
              }],
              "weekly_generations_remaining": 2,
              "week_key": "2026-07-07",
              "active_generation_run": {
                "id": "run-1",
                "run_scope": "weekly"
              }
            }
            """.trimIndent(),
        )

        assertEquals(2, snapshot.weeklyGenerationsRemaining)
        assertEquals("2026-07-07", snapshot.weekKey)
        assertEquals("weekly", snapshot.activeGenerationRun?.runScope)
        assertTrue(snapshot.weeklyParlays.single().isWeekly)
    }

    @Test
    fun decodesWeeklyPersonalitySettings() {
        val params = WagerproofJson.decodeFromString(
            AgentPersonalityParams.serializer(),
            """
            {
              "weekly_parlay_enabled": true,
              "weekly_parlay_legs": 5,
              "allowed_markets": ["spread", "prop"],
              "props_emphasis": "emphasize"
            }
            """.trimIndent(),
        )

        assertTrue(params.weeklyParlayEnabled == true)
        assertEquals(5, params.weeklyParlayLegs)
        assertEquals(listOf("spread", "prop"), params.allowedMarkets)
        assertEquals("emphasize", params.propsEmphasis)
    }

    @Test
    fun unknownParlayScopeFallsBackToDaily() {
        val parlay = WagerproofJson.decodeFromString(
            AgentParlay.serializer(),
            """
            {
              "id": "parlay-legacy",
              "avatar_id": "agent-1",
              "scope": "future_scope",
              "legs": []
            }
            """.trimIndent(),
        )

        assertEquals(AgentParlayScope.DAILY, parlay.scope)
        assertFalse(parlay.isWeekly)
    }
}
