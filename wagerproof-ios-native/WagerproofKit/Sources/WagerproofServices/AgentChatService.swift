import Foundation
import Supabase
import WagerproofModels

/// Per-agent chat thread (user ↔ agent). Mirrors the read+send paths in the
/// RN `agentChatService` so a user can have a private back-and-forth with one
/// of their agents about its picks.
///
/// Backed by the `agent_chat_messages` table on the main Supabase project.
/// RLS restricts reads/writes to the row owner (`user_id = auth.uid()`).
/// Assistant replies are produced by the `agent-chat-reply` edge function;
/// we invoke that with the user's bearer token so the function can re-issue
/// privileged queries against the agent's personality and recent picks.
public enum AgentChatService {
    /// Fetch the full thread for an agent (oldest → newest). The UI inverts
    /// for rendering. Limit defaults to 200 messages — newer messages can be
    /// fetched on demand if/when we add pagination.
    public static func fetchThread(
        userId: String,
        agentId: String,
        limit: Int = 200
    ) async throws -> [AgentChatMessage] {
        let main = await MainSupabase.shared.client
        let rows: [AgentChatMessage] = try await main
            .from("agent_chat_messages")
            .select()
            .eq("user_id", value: userId)
            .eq("avatar_id", value: agentId)
            .order("created_at", ascending: true)
            .limit(limit)
            .execute()
            .value
        return rows
    }

    /// Insert a user message into the thread. Returns the persisted row so the
    /// caller can swap the optimistic placeholder for the canonical id/timestamp.
    public static func sendUserMessage(
        userId: String,
        agentId: String,
        content: String
    ) async throws -> AgentChatMessage {
        let main = await MainSupabase.shared.client
        struct InsertRow: Encodable {
            let user_id: String
            let avatar_id: String
            let role: String
            let content: String
        }
        let row = InsertRow(user_id: userId, avatar_id: agentId, role: "user", content: content)
        let inserted: [AgentChatMessage] = try await main
            .from("agent_chat_messages")
            .insert(row, returning: .representation)
            .select()
            .execute()
            .value
        guard let first = inserted.first else {
            throw NSError(
                domain: "AgentChatService",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Insert returned no rows"]
            )
        }
        return first
    }

    /// Ask the edge function to generate an assistant reply. The function
    /// reads the existing thread + the agent's personality, generates a
    /// response with the LLM, persists it, and returns it.
    public static func requestAssistantReply(agentId: String) async throws -> AgentChatMessage {
        struct Body: Encodable {
            let action: String
            let agent_id: String
        }
        return try await AgentAuthorizedActionsService.invoke(
            body: Body(action: "agent_chat_reply", agent_id: agentId),
            as: AgentChatMessage.self,
            fallbackMessage: "Failed to get agent reply"
        )
    }

    /// Toggle follow on a public agent. Inserts/deletes a row on
    /// `user_avatar_follows`. Mirrors the follow toggle in
    /// `app/(drawer)/(tabs)/agents/public/[id].tsx`.
    public static func setFollow(userId: String, agentId: String, follow: Bool) async throws {
        let main = await MainSupabase.shared.client
        if follow {
            struct Row: Encodable {
                let user_id: String
                let avatar_id: String
            }
            _ = try await main
                .from("user_avatar_follows")
                .insert(Row(user_id: userId, avatar_id: agentId))
                .execute()
        } else {
            _ = try await main
                .from("user_avatar_follows")
                .delete()
                .eq("user_id", value: userId)
                .eq("avatar_id", value: agentId)
                .execute()
        }
    }
}
