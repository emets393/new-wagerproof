import Foundation
import Supabase
import WagerproofModels

/// SSE streaming client for the `wagerbot-chat` Supabase Edge Function.
///
/// The edge function streams two interleaved kinds of SSE events on a
/// single response body:
///   1. Raw OpenAI `data:` chunks containing delta JSON (no `event:`
///      header) — these carry assistant text via `choices[0].delta.content`.
///   2. Custom `event: wagerbot.*` events (tool_start / tool_end /
///      thread / follow_ups / etc.) followed by a `data:` JSON line.
///
/// This service speaks both flavors and emits a single typed
/// `WagerBotStreamEvent` stream via `AsyncThrowingStream`. The contract
/// mirrors `wagerproof-mobile/services/wagerBotChatService.ts` so the
/// edge function is unchanged by the iOS port.
public actor WagerBotChatService {
    public static let shared = WagerBotChatService()

    private let session: URLSession

    public init() {
        let cfg = URLSessionConfiguration.default
        // SSE streams can run minutes — disable the body-idle timeout so
        // long-running tool sequences don't kill the connection. Request
        // timeout still applies to initial connect/headers (60s default).
        cfg.timeoutIntervalForRequest = 60
        cfg.timeoutIntervalForResource = 600
        cfg.httpAdditionalHeaders = ["Accept": "text/event-stream"]
        self.session = URLSession(configuration: cfg)
    }

    /// Start a streaming chat run. Returns an `AsyncThrowingStream` of
    /// typed events. The stream finishes when the server closes the
    /// connection or the client task is cancelled.
    public nonisolated func startRun(
        userMessage: String,
        threadId: String?
    ) -> AsyncThrowingStream<WagerBotStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    // Resolve auth — the edge function requires a logged-in user.
                    let main = await MainSupabase.shared.client
                    let session = try await main.auth.session

                    // Model selection is DEBUG-only: release builds always use
                    // the default option (production `wagerbot-chat`), so behavior
                    // is untouched. A non-default debug pick routes to the
                    // parallel `wagerbot-agent` function with the chosen model.
                    #if DEBUG
                    let option = WagerBotModelSelection.current
                    #else
                    let option = WagerBotModelSelection.defaultOption
                    #endif
                    let url = URL(
                        string: "\(SupabaseConfig.Main.url.absoluteString)/functions/v1/\(option.functionName)"
                    )!

                    var req = URLRequest(url: url)
                    req.httpMethod = "POST"
                    req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
                    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    req.setValue("text/event-stream", forHTTPHeaderField: "Accept")

                    // Request body — byte-identical to the RN client for the
                    // default option. `thread_id` and `model` are omitted when
                    // nil (synthesized Codable uses encodeIfPresent), so the
                    // production function sees the exact same payload as before.
                    struct Body: Encodable {
                        let user_message: String
                        let thread_id: String?
                        let model: String?
                    }
                    let body = Body(user_message: userMessage, thread_id: threadId, model: option.model)
                    req.httpBody = try JSONEncoder().encode(body)

                    let (bytes, response) = try await self.urlSession().bytes(for: req)

                    if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                        // Drain a chunk of the body for the error message
                        // — the edge function returns a small JSON object
                        // with `error: string` on failure.
                        var bodyData = Data()
                        for try await byte in bytes {
                            bodyData.append(byte)
                            if bodyData.count > 1024 { break }
                        }
                        let text = String(data: bodyData, encoding: .utf8) ?? ""
                        throw NSError(
                            domain: "WagerBotChatService",
                            code: http.statusCode,
                            userInfo: [
                                NSLocalizedDescriptionKey: "Chat request failed (\(http.statusCode)): \(text.prefix(200))"
                            ]
                        )
                    }

                    try await self.parse(bytes: bytes, into: continuation)
                    continuation.yield(.done)
                    continuation.finish()
                } catch is CancellationError {
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // Expose the session through a non-actor-isolated accessor so we can
    // hit it from the nonisolated `startRun` Task without crossing an
    // actor boundary on every byte.
    private nonisolated func urlSession() -> URLSession {
        // Hand back a shared default session — actor-local state is
        // unnecessary here, the underlying `URLSession` is thread-safe.
        URLSession.shared
    }

    /// Walk the SSE response body byte-by-byte, emitting parsed events.
    private nonisolated func parse(
        bytes: URLSession.AsyncBytes,
        into continuation: AsyncThrowingStream<WagerBotStreamEvent, Error>.Continuation
    ) async throws {
        // Hand-rolled SSE parser: lines are LF-separated; an empty line
        // resets the current event name. `event: foo` sets the name for
        // the next `data:` line; bare `data:` lines (no event header)
        // are raw OpenAI deltas. This is the same shape the RN client
        // parses — see wagerBotChatService.ts.
        var currentEventName = ""
        var lineBuffer = Data()

        for try await byte in bytes {
            if byte == 0x0A { // LF
                let line = String(data: lineBuffer, encoding: .utf8) ?? ""
                lineBuffer.removeAll(keepingCapacity: true)
                handleLine(line, currentEventName: &currentEventName, continuation: continuation)
            } else {
                lineBuffer.append(byte)
            }
        }
        // Flush any trailing line (no final newline).
        if !lineBuffer.isEmpty {
            let line = String(data: lineBuffer, encoding: .utf8) ?? ""
            handleLine(line, currentEventName: &currentEventName, continuation: continuation)
        }
    }

    private nonisolated func handleLine(
        _ line: String,
        currentEventName: inout String,
        continuation: AsyncThrowingStream<WagerBotStreamEvent, Error>.Continuation
    ) {
        if line.hasPrefix("event: ") {
            currentEventName = String(line.dropFirst("event: ".count))
                .trimmingCharacters(in: .whitespaces)
            return
        }
        if line.hasPrefix("data: ") {
            let dataPart = String(line.dropFirst("data: ".count))
                .trimmingCharacters(in: .whitespaces)
            if currentEventName.isEmpty {
                // Raw OpenAI chunk
                if let event = Self.parseOpenAIChunk(dataPart) {
                    continuation.yield(event)
                }
            } else {
                if let event = Self.parseCustomEvent(name: currentEventName, dataJSON: dataPart) {
                    continuation.yield(event)
                }
                currentEventName = ""
            }
            return
        }
        // Blank line resets the event name (per SSE spec). Comments
        // (`:` prefix) are ignored.
        if line.trimmingCharacters(in: .whitespaces).isEmpty {
            currentEventName = ""
        }
    }

    // MARK: - OpenAI delta parsing

    /// Parse a raw OpenAI SSE chunk (no `event:` header) and extract
    /// content deltas. Returns nil for chunks without useful content
    /// (e.g. role-only deltas, finish_reason chunks, the `[DONE]`
    /// sentinel).
    private static func parseOpenAIChunk(_ data: String) -> WagerBotStreamEvent? {
        if data == "[DONE]" { return nil }
        guard let raw = data.data(using: .utf8) else { return nil }
        guard let obj = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
              let choices = obj["choices"] as? [[String: Any]],
              let first = choices.first,
              let delta = first["delta"] as? [String: Any] else { return nil }
        if let content = delta["content"] as? String, !content.isEmpty {
            return .contentDelta(text: content)
        }
        return nil
    }

    // MARK: - Custom event parsing

    /// Parse a `wagerbot.*` SSE event by name + JSON data line. Unknown
    /// event names are dropped silently — the server may add new events
    /// the iOS client doesn't know about yet.
    private static func parseCustomEvent(name: String, dataJSON: String) -> WagerBotStreamEvent? {
        guard let raw = dataJSON.data(using: .utf8) else { return nil }
        let obj = (try? JSONSerialization.jsonObject(with: raw)) as? [String: Any] ?? [:]
        switch name {
        case "wagerbot.thread":
            guard let threadId = obj["thread_id"] as? String else { return nil }
            let created = (obj["created"] as? Bool) ?? false
            return .thread(id: threadId, created: created)

        case "wagerbot.tool_start":
            guard let id = obj["id"] as? String,
                  let toolName = obj["name"] as? String else { return nil }
            // arguments arrives as a JSON value — re-encode to a string so
            // the chip can display a summary.
            let argsString: String
            if let args = obj["arguments"] {
                let argsData = (try? JSONSerialization.data(withJSONObject: args)) ?? Data()
                argsString = String(data: argsData, encoding: .utf8) ?? "{}"
            } else {
                argsString = "{}"
            }
            return .toolStart(id: id, name: toolName, argumentsJSON: argsString)

        case "wagerbot.tool_end":
            guard let id = obj["id"] as? String,
                  let toolName = obj["name"] as? String else { return nil }
            let ms = (obj["ms"] as? Int) ?? Int((obj["ms"] as? Double) ?? 0)
            let ok = (obj["ok"] as? Bool) ?? false
            let summary = (obj["result_summary"] as? String) ?? ""
            return .toolEnd(id: id, name: toolName, ms: ms, ok: ok, summary: summary)

        case "wagerbot.follow_ups":
            let qs = (obj["questions"] as? [String]) ?? []
            return .followUps(questions: qs)

        case "wagerbot.thread_titled":
            guard let id = obj["thread_id"] as? String,
                  let title = obj["title"] as? String else { return nil }
            return .threadTitled(id: id, title: title)

        case "wagerbot.message_persisted":
            return .messagePersisted(role: (obj["role"] as? String) ?? "")

        case "wagerbot.thinking_delta":
            return .thinkingDelta(text: (obj["text"] as? String) ?? "")

        case "wagerbot.thinking_done":
            return .thinkingDone(summary: (obj["summary"] as? String) ?? "")

        case "wagerbot.game_cards":
            // Decode via JSONDecoder so the snake_case keys map cleanly
            // to our model's CodingKeys.
            let cardsArray = obj["cards"] ?? []
            let arrData = (try? JSONSerialization.data(withJSONObject: cardsArray)) ?? Data()
            let cards = (try? JSONDecoder().decode([WagerBotChatGameCard].self, from: arrData)) ?? []
            return .gameCards(cards: cards)

        case "wagerbot.chat_widgets":
            let widgetsArray = obj["widgets"] ?? []
            let arrData = (try? JSONSerialization.data(withJSONObject: widgetsArray)) ?? Data()
            let widgets = (try? JSONDecoder().decode([WagerBotChatWidget].self, from: arrData)) ?? []
            return .chatWidgets(widgets: widgets)

        case "wagerbot.app_components":
            // V2 chat (wagerbot-agent) rich, tappable components.
            let summary = obj["summary"] as? String
            let compArray = obj["components"] ?? []
            let arrData = (try? JSONSerialization.data(withJSONObject: compArray)) ?? Data()
            let comps = (try? JSONDecoder().decode([WagerBotAppComponent].self, from: arrData)) ?? []
            return .appComponents(summary: summary, components: comps)

        case "wagerbot.error":
            let code = (obj["code"] as? String) ?? "unknown"
            let message = (obj["message"] as? String) ?? "Unknown error"
            return .error(code: code, message: message)

        default:
            return nil
        }
    }
}

// MARK: - Thread persistence

/// Read/list/delete operations on `chat_threads` + `chat_messages`. The
/// edge function writes new messages itself; the iOS client only needs to
/// list threads for the history sheet and rehydrate messages when the
/// user reopens an existing thread.
public enum WagerBotThreadService {
    public static func listThreads(userId: String) async throws -> [WagerBotThreadSummary] {
        let main = await MainSupabase.shared.client
        let rows: [WagerBotThreadSummary] = try await main
            .from("chat_threads")
            .select("id, title, created_at, updated_at, message_count")
            .eq("user_id", value: userId)
            .order("updated_at", ascending: false)
            .execute()
            .value
        return rows
    }

    public static func deleteThread(threadId: String) async throws {
        let main = await MainSupabase.shared.client
        _ = try await main
            .from("chat_threads")
            .delete()
            .eq("id", value: threadId)
            .execute()
    }

    public static func deleteAllThreads(userId: String) async throws {
        let main = await MainSupabase.shared.client
        _ = try await main
            .from("chat_threads")
            .delete()
            .eq("user_id", value: userId)
            .execute()
    }

    /// Hydrate the message list for a thread. Mirrors RN `loadThread` —
    /// converts persisted `blocks` JSON back into `WagerBotContentBlock`
    /// values and drops `tool` role messages (they're internal to the
    /// agent loop and never user-facing).
    public static func loadMessages(threadId: String) async throws -> [WagerBotMessage] {
        let main = await MainSupabase.shared.client
        struct Row: Decodable {
            let id: String
            let role: String
            let content: String?
            let blocks: JSONFlex?
            let created_at: String
        }
        let rows: [Row] = try await main
            .from("chat_messages")
            .select("id, role, content, blocks, created_at")
            .eq("thread_id", value: threadId)
            .order("created_at", ascending: true)
            .execute()
            .value

        var messages: [WagerBotMessage] = []
        for row in rows {
            // Tool-result messages are internal to the agent loop —
            // never display them.
            if row.role == "tool" { continue }
            guard let role = WagerBotMessage.Role(rawValue: row.role) else { continue }

            var blocks: [WagerBotContentBlock] = []
            if let blocksAny = row.blocks?.value as? [[String: Any]] {
                for entry in blocksAny {
                    guard let type = entry["type"] as? String else { continue }
                    let blockId = (entry["id"] as? String) ?? "b_\(UUID().uuidString)"
                    switch type {
                    case "text":
                        if let s = entry["text"] as? String {
                            blocks.append(.text(id: blockId, text: s))
                        }
                    case "game_cards":
                        let cards = (entry["cards"] as? [Any]).flatMap { arr -> [WagerBotChatGameCard]? in
                            guard let data = try? JSONSerialization.data(withJSONObject: arr) else { return nil }
                            return try? JSONDecoder().decode([WagerBotChatGameCard].self, from: data)
                        } ?? []
                        blocks.append(.gameCards(id: blockId, cards: cards))
                    case "chat_widgets":
                        let widgets = (entry["widgets"] as? [Any]).flatMap { arr -> [WagerBotChatWidget]? in
                            guard let data = try? JSONSerialization.data(withJSONObject: arr) else { return nil }
                            return try? JSONDecoder().decode([WagerBotChatWidget].self, from: data)
                        } ?? []
                        blocks.append(.chatWidgets(id: blockId, widgets: widgets))
                    case "app_components":
                        let summary = entry["summary"] as? String
                        let comps = (entry["components"] as? [Any]).flatMap { arr -> [WagerBotAppComponent]? in
                            guard let data = try? JSONSerialization.data(withJSONObject: arr) else { return nil }
                            return try? JSONDecoder().decode([WagerBotAppComponent].self, from: data)
                        } ?? []
                        blocks.append(.appComponents(id: blockId, summary: summary, components: comps))
                    case "tool_use":
                        let name = (entry["name"] as? String) ?? ""
                        let argsAny = entry["arguments"]
                        let argsString: String
                        if let s = argsAny as? String {
                            argsString = s
                        } else if let any = argsAny,
                                  let data = try? JSONSerialization.data(withJSONObject: any) {
                            argsString = String(data: data, encoding: .utf8) ?? "{}"
                        } else {
                            argsString = "{}"
                        }
                        // Historic tool blocks lack live status; render
                        // them as completed with no timing.
                        blocks.append(.toolUse(
                            id: blockId,
                            name: name,
                            argumentsJSON: argsString,
                            status: .done(ms: 0, ok: true, summary: "")
                        ))
                    default:
                        continue
                    }
                }
            } else if let content = row.content, !content.isEmpty {
                blocks.append(.text(id: "legacy_\(row.id)", text: content))
            }

            if blocks.isEmpty { continue }
            messages.append(WagerBotMessage(
                id: row.id,
                role: role,
                blocks: blocks,
                timestamp: row.created_at
            ))
        }
        return messages
    }
}

/// Flexible JSON column wrapper. Supabase rows surface JSONB columns as
/// AnyJSON in supabase-swift; we re-expose them as `Any?` so the
/// `loadMessages` shaper can walk them without us declaring an exhaustive
/// Codable shape for every block kind.
struct JSONFlex: Decodable, Sendable {
    let value: Any?

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self.value = nil
            return
        }
        if let b = try? c.decode(Bool.self) { self.value = b; return }
        if let i = try? c.decode(Int.self) { self.value = i; return }
        if let d = try? c.decode(Double.self) { self.value = d; return }
        if let s = try? c.decode(String.self) {
            // Some Supabase deployments persist the blocks column as a
            // JSON string rather than a structured value. Try to
            // re-parse so downstream walks land on the same `[[String: Any]]`
            // shape either way.
            if let data = s.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data) {
                self.value = parsed
            } else {
                self.value = s
            }
            return
        }
        if let arr = try? c.decode([JSONValueShim].self) {
            self.value = arr.map(\.asAny)
            return
        }
        if let obj = try? c.decode([String: JSONValueShim].self) {
            self.value = obj.mapValues(\.asAny)
            return
        }
        self.value = nil
    }
}

// Local shim because JSONValue (in WagerproofModels) is internal there
// and we need to walk arbitrary subtrees here. Kept private to this file.
private enum JSONValueShim: Decodable, Sendable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([JSONValueShim])
    case object([String: JSONValueShim])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Int.self) { self = .int(v); return }
        if let v = try? c.decode(Double.self) { self = .double(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([JSONValueShim].self) { self = .array(v); return }
        if let v = try? c.decode([String: JSONValueShim].self) { self = .object(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported JSON value")
    }

    var asAny: Any {
        switch self {
        case .null: return NSNull()
        case .bool(let v): return v
        case .int(let v): return v
        case .double(let v): return v
        case .string(let v): return v
        case .array(let v): return v.map(\.asAny)
        case .object(let v): return v.mapValues(\.asAny)
        }
    }
}
