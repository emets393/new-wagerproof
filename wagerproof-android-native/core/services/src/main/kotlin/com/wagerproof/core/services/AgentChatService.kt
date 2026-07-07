package com.wagerproof.core.services

import com.wagerproof.core.models.AgentChatMessage
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Private user ↔ agent chat thread over `agent_chat_messages` (Main project,
 * RLS owner-only). Assistant replies come from the `agent_chat_reply` edge
 * action so the server can re-issue privileged queries against the agent's
 * personality + recent picks. Port of iOS `AgentChatService.swift`.
 */
object AgentChatService {

    /** Full thread for an agent, oldest → newest (the UI inverts for rendering). */
    suspend fun fetchThread(
        userId: String,
        agentId: String,
        limit: Int = 200,
    ): List<AgentChatMessage> =
        SupabaseClients.main.from("agent_chat_messages").select {
            filter {
                eq("user_id", userId)
                eq("avatar_id", agentId)
            }
            order("created_at", Order.ASCENDING)
            limit(limit.toLong())
        }.decodeList()

    /**
     * Insert a user message. Returns the persisted row so the caller can swap
     * the optimistic placeholder for the canonical id/timestamp.
     */
    suspend fun sendUserMessage(
        userId: String,
        agentId: String,
        content: String,
    ): AgentChatMessage {
        val row = buildJsonObject {
            put("user_id", userId)
            put("avatar_id", agentId)
            put("role", "user")
            put("content", content)
        }
        return SupabaseClients.main.from("agent_chat_messages")
            .insert(row) { select() }
            .decodeList<AgentChatMessage>()
            .firstOrNull()
            ?: throw IllegalStateException("Insert returned no rows")
    }

    /**
     * Ask the edge function to generate an assistant reply — it reads the
     * thread + personality, generates with the LLM, persists, and returns it.
     */
    suspend fun requestAssistantReply(agentId: String): AgentChatMessage =
        AgentAuthorizedActionsService.invoke(
            body = buildJsonObject {
                put("action", "agent_chat_reply")
                put("agent_id", agentId)
            },
            deserializer = AgentChatMessage.serializer(),
            fallbackMessage = "Failed to get agent reply",
        )

    /** Toggle follow on a public agent — insert/delete on `user_avatar_follows`. */
    suspend fun setFollow(userId: String, agentId: String, follow: Boolean) {
        if (follow) {
            SupabaseClients.main.from("user_avatar_follows").insert(
                buildJsonObject {
                    put("user_id", userId)
                    put("avatar_id", agentId)
                },
            )
        } else {
            SupabaseClients.main.from("user_avatar_follows").delete {
                filter {
                    eq("user_id", userId)
                    eq("avatar_id", agentId)
                }
            }
        }
    }
}
