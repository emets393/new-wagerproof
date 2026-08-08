package com.wagerproof.app.features.agents

import com.wagerproof.app.features.agents.creation.AgentSpritePersistenceResult
import com.wagerproof.app.features.agents.creation.AgentSpritePersister
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlinx.coroutines.runBlocking

class AgentSpritePersisterTest {
    @Test
    fun failedRequiredWriteIsNotReportedAsSaved() = runBlocking {
        val persister = AgentSpritePersister { _, _ -> error("offline") }

        val result = persister.persist(
            agentId = "agent-1",
            currentSpriteIndex = null,
            desiredSpriteIndex = 4,
        )

        val failure = assertIs<AgentSpritePersistenceResult.Failed>(result)
        assertEquals("offline", failure.message)
    }

    @Test
    fun successfulRequiredWriteReturnsThePersistedSprite() = runBlocking {
        var update: Pair<String, Int>? = null
        val persister = AgentSpritePersister { id, sprite -> update = id to sprite }

        val result = persister.persist("agent-1", currentSpriteIndex = null, desiredSpriteIndex = 6)

        assertEquals("agent-1" to 6, update)
        assertEquals(6, assertIs<AgentSpritePersistenceResult.Saved>(result).spriteIndex)
    }

    @Test
    fun alreadyPersistedSpriteDoesNotIssueAnotherWrite() = runBlocking {
        var writes = 0
        val persister = AgentSpritePersister { _, _ -> writes += 1 }

        val result = persister.persist("agent-1", currentSpriteIndex = 2, desiredSpriteIndex = 2)

        assertEquals(0, writes)
        assertEquals(2, assertIs<AgentSpritePersistenceResult.Saved>(result).spriteIndex)
    }
}
