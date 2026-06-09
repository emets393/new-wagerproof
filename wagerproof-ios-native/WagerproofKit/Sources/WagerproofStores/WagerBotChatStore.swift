import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Owns the in-memory chat state for the WagerBot sheet — current thread
/// id + title, message list, streaming state, history list, last error.
///
/// Streaming flow:
///   1. `send(text:)` appends a user message + an empty assistant
///      placeholder, flips `isStreaming = true`, and kicks off an async
///      task that consumes the SSE stream from `WagerBotChatService`.
///   2. Each `WagerBotStreamEvent` mutates the last assistant message
///      (append text deltas to the current text block, push tool_use
///      blocks on tool_start, flip status on tool_end, etc.). Mirrors the
///      RN reducer in `wagerBotChatService.ts`.
///   3. When the stream finishes the task closes the placeholder and
///      refreshes the history list so the sheet's drawer picks up the
///      new (or updated) thread.
///
/// History persistence is server-side — the edge function writes both
/// user and assistant messages to `chat_messages` itself, so the store
/// never inserts directly. On thread switch we hydrate via
/// `WagerBotThreadService.loadMessages`.
@Observable
@MainActor
public final class WagerBotChatStore {
    public private(set) var messages: [WagerBotMessage] = []
    public private(set) var isStreaming: Bool = false
    public private(set) var threadId: String?
    public private(set) var threadTitle: String?
    public private(set) var lastError: String?

    public private(set) var threads: [WagerBotThreadSummary] = []
    public private(set) var historyLoadState: HistoryLoadState = .idle

    public var draft: String = ""

    private var streamTask: Task<Void, Never>?
    private weak var authProvider: WagerBotAuthProvider?

    public enum HistoryLoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public init() {}

    /// The store can't reach into AuthStore without a circular
    /// dependency (Stores → Services, Services don't see Stores). The
    /// owning view passes the current Supabase user id once at first
    /// appear via this hook.
    public func bind(userId: String?) {
        self.boundUserId = userId
    }

    public private(set) var boundUserId: String?

    /// Are we still waiting for the first assistant block to arrive?
    /// Drives the thinking indicator that replaces the empty bubble body
    /// until the first text / tool / widget lands.
    public var isWaitingForFirstBlock: Bool {
        guard isStreaming, let last = messages.last, last.role == .assistant else { return false }
        return last.blocks.isEmpty
    }

    // MARK: - Send / cancel

    /// Submit a new user message and start streaming the response. Safe
    /// to call while a previous stream is running — the active task is
    /// cancelled first.
    public func send(text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        streamTask?.cancel()

        let userMsg = WagerBotMessage.user(trimmed)
        let assistantMsg = WagerBotMessage.assistantPlaceholder()
        messages.append(userMsg)
        messages.append(assistantMsg)
        isStreaming = true
        draft = ""

        let assistantId = assistantMsg.id
        let pinnedThreadId = threadId

        streamTask = Task { [weak self] in
            guard let self else { return }
            do {
                let stream = WagerBotChatService.shared.startRun(
                    userMessage: trimmed,
                    threadId: pinnedThreadId
                )
                for try await event in stream {
                    if Task.isCancelled { break }
                    await MainActor.run {
                        self.apply(event: event, toMessageId: assistantId)
                    }
                }
            } catch {
                await MainActor.run {
                    self.applyTransportError(error, toMessageId: assistantId)
                }
            }
            await MainActor.run {
                self.isStreaming = false
                self.streamTask = nil
            }
            // Best-effort: refresh history so the drawer picks up the
            // new thread or the updated title without the user opening
            // and closing the sheet.
            if let uid = await self.boundUserId {
                await self.refreshHistory(userId: uid)
            }
        }
    }

    public func cancel() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
    }

    /// Drop the in-memory thread and start a fresh conversation. Does
    /// NOT touch the server — the existing thread stays in history.
    public func newConversation() {
        cancel()
        messages.removeAll()
        threadId = nil
        threadTitle = nil
        draft = ""
        lastError = nil
    }

    /// Switch to an existing thread, hydrating its persisted messages.
    public func loadThread(_ summary: WagerBotThreadSummary) async {
        cancel()
        messages.removeAll()
        threadId = summary.id
        threadTitle = summary.title
        do {
            let loaded = try await WagerBotThreadService.loadMessages(threadId: summary.id)
            self.messages = loaded
        } catch {
            self.lastError = error.localizedDescription
        }
    }

    // MARK: - History

    public func refreshHistory(userId: String) async {
        historyLoadState = .loading
        do {
            let rows = try await WagerBotThreadService.listThreads(userId: userId)
            self.threads = rows
            self.historyLoadState = .loaded
        } catch {
            self.historyLoadState = .failed(error.localizedDescription)
        }
    }

    public func deleteThread(_ id: String) async {
        do {
            try await WagerBotThreadService.deleteThread(threadId: id)
            threads.removeAll { $0.id == id }
            if threadId == id { newConversation() }
        } catch {
            lastError = error.localizedDescription
        }
    }

    public func deleteAllThreads() async {
        guard let userId = boundUserId else { return }
        do {
            try await WagerBotThreadService.deleteAllThreads(userId: userId)
            threads = []
            newConversation()
        } catch {
            lastError = error.localizedDescription
        }
    }

    // MARK: - Event application

    /// Apply one SSE event to the in-flight assistant message. Indexed
    /// by message id (not position) so a parallel `loadThread` swap
    /// doesn't smash the stream's target.
    private func apply(event: WagerBotStreamEvent, toMessageId targetId: String) {
        guard let idx = messages.firstIndex(where: { $0.id == targetId }) else { return }

        switch event {
        case .thread(let id, _):
            if threadId == nil { threadId = id }

        case .contentDelta(let text):
            appendText(text, to: idx)

        case .thinkingDelta(let text):
            appendThinking(text, to: idx)

        case .thinkingDone:
            // Drop the thinking block entirely once the model finishes
            // reasoning — the visible answer is in the upcoming text
            // deltas. Keeps the bubble from showing the chain-of-thought
            // alongside the answer.
            messages[idx].blocks.removeAll {
                if case .thinking = $0 { return true }
                return false
            }

        case .toolStart(let id, let name, let argumentsJSON):
            messages[idx].blocks.append(.toolUse(
                id: id,
                name: name,
                argumentsJSON: argumentsJSON,
                status: .running
            ))

        case .toolEnd(let id, _, let ms, let ok, let summary):
            for (bIdx, block) in messages[idx].blocks.enumerated() {
                if case .toolUse(let bid, let name, let args, _) = block, bid == id {
                    messages[idx].blocks[bIdx] = .toolUse(
                        id: bid,
                        name: name,
                        argumentsJSON: args,
                        status: .done(ms: ms, ok: ok, summary: summary)
                    )
                    break
                }
            }

        case .gameCards(let cards):
            // Game cards are no longer rendered as a primary surface in
            // RN (widgets from present_analysis replaced them) — keep
            // the parse path so existing threads load, but don't append
            // a new block when the stream emits one.
            _ = cards

        case .chatWidgets(let widgets):
            messages[idx].blocks.append(.chatWidgets(
                id: "w_\(UUID().uuidString)",
                widgets: widgets
            ))

        case .appComponents(let summary, let components):
            // V2 chat: rich tappable components (wagerbot-agent). Appended as a
            // single block; the bubble renders them via WagerBotAppComponentsView.
            messages[idx].blocks.append(.appComponents(
                id: "ac_\(UUID().uuidString)",
                summary: summary,
                components: components
            ))

        case .followUps(let questions):
            // Replace any existing follow-ups block so the final list
            // is the union of any earlier-emitted suggestions plus the
            // latest round.
            messages[idx].blocks.removeAll {
                if case .followUps = $0 { return true }
                return false
            }
            messages[idx].blocks.append(.followUps(
                id: "f_\(UUID().uuidString)",
                questions: questions
            ))

        case .threadTitled(let id, let title):
            if threadId == id { threadTitle = title }

        case .messagePersisted:
            break

        case .error(let code, let message):
            // Surface the error as a text block in the assistant bubble
            // so the user sees what went wrong instead of an empty
            // bubble.
            messages[idx].blocks.append(.text(
                id: "err_\(UUID().uuidString)",
                text: "Sorry, something went wrong (\(code)): \(message)"
            ))
            lastError = message

        case .done:
            break
        }
    }

    private func appendText(_ delta: String, to msgIdx: Int) {
        // Append to the last existing text block, or push a new one.
        if let bIdx = messages[msgIdx].blocks.lastIndex(where: { block in
            if case .text = block { return true }
            return false
        }), case .text(let id, let existing) = messages[msgIdx].blocks[bIdx] {
            messages[msgIdx].blocks[bIdx] = .text(id: id, text: existing + delta)
        } else {
            messages[msgIdx].blocks.append(.text(
                id: "t_\(UUID().uuidString)",
                text: delta
            ))
        }
    }

    private func appendThinking(_ delta: String, to msgIdx: Int) {
        if let bIdx = messages[msgIdx].blocks.lastIndex(where: { block in
            if case .thinking = block { return true }
            return false
        }), case .thinking(let id, let existing) = messages[msgIdx].blocks[bIdx] {
            messages[msgIdx].blocks[bIdx] = .thinking(id: id, text: existing + delta)
        } else {
            messages[msgIdx].blocks.append(.thinking(
                id: "th_\(UUID().uuidString)",
                text: delta
            ))
        }
    }

    private func applyTransportError(_ error: Error, toMessageId targetId: String) {
        guard let idx = messages.firstIndex(where: { $0.id == targetId }) else { return }
        // Only inject a friendly error text if the assistant hasn't
        // already streamed anything visible — otherwise the bubble
        // already has content and a trailing error message reads as
        // noise.
        let hasVisibleContent = messages[idx].blocks.contains { block in
            if case .text(_, let s) = block { return !s.isEmpty }
            return false
        }
        if !hasVisibleContent {
            messages[idx].blocks.append(.text(
                id: "err_\(UUID().uuidString)",
                text: "Sorry, I couldn't reach the chat service. Please try again."
            ))
        }
        lastError = error.localizedDescription
    }
}

/// Hook for the chat view to hand the store an auth token resolver. Not
/// currently used — the service walks Supabase auth itself — but kept so
/// future variants (refresh-on-401, programmatic token injection in
/// tests) can plug in without a public-API break.
public protocol WagerBotAuthProvider: AnyObject {
    func currentAccessToken() async -> String?
    func currentUserId() async -> String?
}
