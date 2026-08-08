package com.wagerproof.app.features.agents.creation

import com.wagerproof.core.services.AgentAuthorizedActionsService
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

internal sealed interface AgentSpritePersistenceResult {
    data class Saved(val spriteIndex: Int?) : AgentSpritePersistenceResult
    data class Failed(val message: String) : AgentSpritePersistenceResult
}

/**
 * The create_agent action does not accept sprite_index, so creation completes
 * with a required second write when the user chose a character. Keeping that
 * write injectable makes the success/failure navigation boundary testable.
 */
internal class AgentSpritePersister(
    private val updateSprite: suspend (agentId: String, spriteIndex: Int) -> Unit = { agentId, spriteIndex ->
        AgentAuthorizedActionsService.updateAgent(
            agentId = agentId,
            payload = buildJsonObject { put("sprite_index", spriteIndex) },
        )
    },
) {
    suspend fun persist(
        agentId: String,
        currentSpriteIndex: Int?,
        desiredSpriteIndex: Int?,
    ): AgentSpritePersistenceResult {
        if (desiredSpriteIndex == null || desiredSpriteIndex == currentSpriteIndex) {
            return AgentSpritePersistenceResult.Saved(currentSpriteIndex)
        }

        return try {
            updateSprite(agentId, desiredSpriteIndex)
            AgentSpritePersistenceResult.Saved(desiredSpriteIndex)
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (t: Throwable) {
            AgentSpritePersistenceResult.Failed(
                t.message?.takeIf(String::isNotBlank)
                    ?: "Couldn't save your selected character.",
            )
        }
    }
}
