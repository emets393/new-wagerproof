import Foundation
import Supabase
import WagerproofModels

/// Port of `wagerproof-mobile/services/agentAuthorizedActions.ts`.
///
/// Wraps every server action that requires an authenticated user against the
/// main Supabase project. Every call routes through the
/// `agent-authorized-action-v1` edge function which enforces RLS-by-action and
/// returns a `{ success, data | error }` envelope. We never short-circuit the
/// envelope — a missing `success: true` translates into a thrown error to keep
/// parity with the RN service.
///
/// All function names + payload field names are byte-identical to the TS source
/// so the same edge function code path executes regardless of client.
public enum AgentAuthorizedActionsService {
    public enum ActionError: LocalizedError {
        case noSession
        case server(String)
        case malformedResponse

        public var errorDescription: String? {
            switch self {
            case .noSession: return "Not signed in"
            case .server(let msg): return msg
            case .malformedResponse: return "Unexpected server response"
            }
        }
    }

    /// Generic invoke. Body is encoded as JSON and a bearer token is attached
    /// explicitly — the supabase-swift functions wrapper sometimes drops it for
    /// edge functions configured with `verify_jwt=false`.
    public static func invoke<Body: Encodable, Response: Decodable>(
        body: Body,
        as type: Response.Type = Response.self,
        fallbackMessage: String = "Request failed"
    ) async throws -> Response {
        let client = await MainSupabase.shared.client

        // Resolve the active access token — the edge function reads it to gate
        // the action against the caller's auth.uid().
        let session = try? await client.auth.session
        guard let token = session?.accessToken else {
            throw ActionError.noSession
        }

        let response: ActionEnvelope<Response> = try await client.functions
            .invoke(
                "agent-authorized-action-v1",
                options: FunctionInvokeOptions(
                    headers: ["Authorization": "Bearer \(token)"],
                    body: body
                )
            )

        if response.success, let data = response.data {
            return data
        }
        throw ActionError.server(response.error ?? fallbackMessage)
    }

    // MARK: - Public action helpers (mirror RN `AgentAuthorizedActionRequest` cases)

    /// Snapshot RPC for the agent detail screen. Returns agent + perf +
    /// today's picks + today's generation run + can_view + is_following.
    /// Mirrors `fetchAgentDetailSnapshotV2`.
    public static func detailSnapshot(agentId: String) async throws -> AgentDetailSnapshot {
        struct Body: Encodable {
            let action: String
            let agent_id: String
        }
        return try await invoke(
            body: Body(action: "detail_snapshot", agent_id: agentId),
            as: AgentDetailSnapshot.self,
            fallbackMessage: "Failed to load agent detail snapshot"
        )
    }

    /// Paginated pick history. Mirrors `fetchAgentPicksPageV2`.
    public static func picksPage(
        agentId: String,
        filter: String = "all",
        pageSize: Int = 20,
        cursor: String? = nil,
        includeOverlap: Bool = false,
        gameDate: String? = nil
    ) async throws -> AgentPicksPage {
        struct Body: Encodable {
            let action: String
            let agent_id: String
            let filter: String
            let page_size: Int
            let cursor: String?
            let include_overlap: Bool
            let game_date: String?
        }
        return try await invoke(
            body: Body(
                action: "picks_page",
                agent_id: agentId,
                filter: filter,
                page_size: pageSize,
                cursor: cursor,
                include_overlap: includeOverlap,
                game_date: gameDate
            ),
            as: AgentPicksPage.self,
            fallbackMessage: "Failed to load agent picks"
        )
    }

    /// Create agent — full payload as a dictionary. B14 owns the form that
    /// builds this; we expose the entry point here so settings and detail
    /// screens can pre-stage updates if needed.
    public static func createAgent(payload: [String: AnyEncodable]) async throws -> Agent {
        struct Body: Encodable {
            let action: String
            let data: [String: AnyEncodable]
        }
        return try await invoke(
            body: Body(action: "create_agent", data: payload),
            as: Agent.self,
            fallbackMessage: "Failed to create agent"
        )
    }

    /// Update agent — partial payload. Mirrors RN's `useUpdateAgent`.
    public static func updateAgent(
        agentId: String,
        payload: [String: AnyEncodable]
    ) async throws -> Agent {
        struct Body: Encodable {
            let action: String
            let agent_id: String
            let data: [String: AnyEncodable]
        }
        return try await invoke(
            body: Body(action: "update_agent", agent_id: agentId, data: payload),
            as: Agent.self,
            fallbackMessage: "Failed to update agent"
        )
    }

    /// Ack for the swipe-to-trash delete actions. The server RPC also reruns
    /// the performance recalc synchronously, so a snapshot refresh right after
    /// a successful delete sees updated stats.
    public struct DeleteAck: Decodable, Sendable {
        public let deleted: Bool?
    }

    /// Delete one pending straight pick (owner-only; graded picks are on the
    /// record and the server refuses with a 409-style error message).
    public static func deletePick(agentId: String, pickId: String) async throws {
        struct Data: Encodable { let pick_id: String }
        struct Body: Encodable {
            let action: String
            let agent_id: String
            let data: Data
        }
        _ = try await invoke(
            body: Body(action: "delete_pick", agent_id: agentId, data: Data(pick_id: pickId)),
            as: DeleteAck.self,
            fallbackMessage: "Failed to delete pick"
        )
    }

    /// Delete one pending parlay ticket (owner-only; refused once any leg has
    /// settled — the ticket is then on the record).
    public static func deleteParlay(agentId: String, parlayId: String) async throws {
        struct Data: Encodable { let parlay_id: String }
        struct Body: Encodable {
            let action: String
            let agent_id: String
            let data: Data
        }
        _ = try await invoke(
            body: Body(action: "delete_parlay", agent_id: agentId, data: Data(parlay_id: parlayId)),
            as: DeleteAck.self,
            fallbackMessage: "Failed to delete parlay"
        )
    }

}

// MARK: - Envelope

/// Generic envelope returned by the edge function. Mirrors RN
/// `AgentAuthorizedActionSuccess` / `…Failure` discriminated union.
private struct ActionEnvelope<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case success
        case data
        case error
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.success = (try? c.decode(Bool.self, forKey: .success)) ?? false
        self.data = try? c.decodeIfPresent(T.self, forKey: .data)
        self.error = try? c.decodeIfPresent(String.self, forKey: .error)
    }
}

// MARK: - AnyEncodable

/// Box for heterogeneous JSON payloads. Used so we can keep RN's "send the
/// raw dictionary" style without losing Swift's static typing on the wire.
public struct AnyEncodable: Encodable {
    private let encoder: (Encoder) throws -> Void

    public init<T: Encodable>(_ value: T) {
        self.encoder = { try value.encode(to: $0) }
    }

    public func encode(to encoder: Encoder) throws {
        try self.encoder(encoder)
    }
}
