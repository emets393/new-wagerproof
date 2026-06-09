import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Per-agent chat thread state. Mirrors RN `useAgentChat` hook (lives in
/// `services/agentChatService.ts` + screen-local state inside AgentChatRoom).
///
/// Optimistic update flow:
///   1. User taps Send → we append a synthetic `AgentChatMessage` to
///      `messages` with a temp id and `role = .user`.
///   2. Service insert fires → on success we swap the temp message for the
///      persisted one (canonical id + timestamp). On failure we strip it and
///      surface the error.
///   3. We then call `requestAssistantReply` which spins up the assistant's
///      response and persists it server-side. The reply lands in `messages`
///      on success.
@Observable
@MainActor
public final class AgentChatStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var agentId: String
    public private(set) var userId: String?

    public private(set) var messages: [AgentChatMessage] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var isAssistantTyping: Bool = false
    public private(set) var lastError: String?

    public var draft: String = ""

    public init(agentId: String, userId: String? = nil) {
        self.agentId = agentId
        self.userId = userId
    }

    public func bind(userId: String?) {
        if userId == self.userId { return }
        self.userId = userId
        self.messages = []
        self.loadState = .idle
    }

    /// Load the full thread. Mirrors useAgentChatHistory.
    public func refresh() async {
        guard let userId else { return }
        loadState = .loading
        do {
            let rows = try await AgentChatService.fetchThread(userId: userId, agentId: agentId)
            self.messages = rows
            self.loadState = .loaded
        } catch {
            self.loadState = .failed(Self.message(from: error))
        }
    }

    /// Send a user message + request an assistant reply. Optimistic on the user
    /// side; the assistant reply blocks `isAssistantTyping`.
    public func send() async {
        guard let userId, !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        let body = draft
        draft = ""
        let tempId = "temp-\(UUID().uuidString)"
        let temp = AgentChatMessage(
            id: tempId,
            avatarId: agentId,
            userId: userId,
            role: .user,
            content: body,
            createdAt: Self.nowISO()
        )
        messages.append(temp)

        do {
            let persisted = try await AgentChatService.sendUserMessage(
                userId: userId,
                agentId: agentId,
                content: body
            )
            // Swap temp with persisted row so we have the canonical id.
            if let idx = messages.firstIndex(where: { $0.id == tempId }) {
                messages[idx] = persisted
            }
        } catch {
            // Strip the temp on failure and surface the error.
            messages.removeAll { $0.id == tempId }
            lastError = Self.message(from: error)
            return
        }

        isAssistantTyping = true
        defer { isAssistantTyping = false }
        do {
            let reply = try await AgentChatService.requestAssistantReply(agentId: agentId)
            messages.append(reply)
        } catch {
            lastError = Self.message(from: error)
        }
    }

    // MARK: - Helpers

    private static func message(from error: Error) -> String {
        let raw = (error as NSError).localizedDescription
        return raw.isEmpty ? "Unknown error" : raw
    }

    private static func nowISO() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date())
    }
}
