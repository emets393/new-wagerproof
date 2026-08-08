package com.wagerproof.core.stores

import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.services.CreateAgentInput
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlinx.coroutines.runBlocking

class AgentCreationStoreTest {
    @Test
    fun duplicateNameFailsBeforeCreateServiceIsCalled() = runBlocking {
        var createCalls = 0
        val store = AgentCreationStore { input ->
            createCalls += 1
            agent(name = input.name)
        }
        store.existingAgentNames = listOf("  Sharp Shooter  ")
        store.draft = validDraft(name = "sharp shooter")

        val result = store.submit(autoModeForcedOff = false)

        assertNull(result)
        assertEquals(0, createCalls)
        assertIs<AgentCreationStore.SubmitState.Failed>(store.submitState)
        store.close()
    }

    @Test
    fun validIdentityIsTrimmedAndSubmittedOnce() = runBlocking {
        var captured: CreateAgentInput? = null
        val store = AgentCreationStore { input ->
            captured = input
            agent(name = input.name)
        }
        store.draft = validDraft(name = "  The Oracle  ")

        val result = store.submit(autoModeForcedOff = false)

        assertNotNull(result)
        assertEquals("The Oracle", captured?.name)
        store.close()
    }

    @Test
    fun copiedDraftRetainsDisplayOnlySourceProvenance() {
        val source = agent(name = "Public Sharp", spriteIndex = 5)

        val draft = AgentCreationStore.Draft.copying(fromPublicAgent = source)

        assertEquals("Copy of Public Sharp", draft.name)
        assertEquals(source.id, draft.copySource?.agentId)
        assertEquals("Public Sharp", draft.copySource?.name)
        assertEquals(5, draft.copySource?.spriteIndex)
    }

    private fun validDraft(name: String) = AgentCreationStore.Draft(
        preferredSports = listOf(AgentSport.NFL),
        name = name,
        spriteIndex = 1,
    )

    private fun agent(name: String, spriteIndex: Int? = null) = Agent(
        id = "agent-1",
        userId = "user-1",
        name = name,
        spriteIndexOverride = spriteIndex,
        preferredSports = listOf(AgentSport.NFL),
        createdAt = "2026-07-31T00:00:00.000Z",
    )
}
