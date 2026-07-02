import Foundation
import Supabase

public struct TriggerV3RunStatus: Decodable, Sendable, Hashable {
    public let id: String
    public let status: String
    public let metadata: TriggerV3RunMetadata
    public let updatedAt: String?
    public let startedAt: String?
    public let finishedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case metadata
        case updatedAt
        case startedAt
        case finishedAt
    }

    public var isTerminal: Bool {
        let upper = status.uppercased()
        // Trigger.dev's real terminal set (RunStatus in @trigger.dev/core) also
        // includes TIMED_OUT (hit maxDuration, e.g. a runaway LLM loop) and
        // SYSTEM_FAILURE — both were missing here, which let a genuinely-dead
        // run poll for its full ~11 min budget before the client gave up.
        return upper == "COMPLETED" || upper == "CANCELED" || upper == "FAILED" || upper == "CRASHED" || upper == "INTERRUPTED" || upper == "EXPIRED" || upper == "TIMED_OUT" || upper == "SYSTEM_FAILURE"
    }

    public var isSuccessful: Bool {
        status.uppercased() == "COMPLETED"
    }
}

public struct TriggerV3RunMetadata: Decodable, Sendable, Hashable {
    public let phase: String?
    public let phaseDetail: String?
    public let currentTool: String?
    public let currentToolDetail: String?
    public let turn: Int?
    public let maxTurns: Int?
    public let toolCalls: Int?
    public let picksAccepted: Int?
    public let picksRejected: Int?
    public let submitAttempt: Int?
    public let note: String?

    enum CodingKeys: String, CodingKey {
        case phase
        case phaseDetail
        case currentTool
        case currentToolDetail
        case turn
        case maxTurns
        case toolCalls
        case picksAccepted
        case picksRejected
        case submitAttempt
        case note
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.phase = try? c.decodeIfPresent(String.self, forKey: .phase)
        self.phaseDetail = try? c.decodeIfPresent(String.self, forKey: .phaseDetail)
        self.currentTool = try? c.decodeIfPresent(String.self, forKey: .currentTool)
        self.currentToolDetail = try? c.decodeIfPresent(String.self, forKey: .currentToolDetail)
        self.turn = Self.decodeLossyInt(c, .turn)
        self.maxTurns = Self.decodeLossyInt(c, .maxTurns)
        self.toolCalls = Self.decodeLossyInt(c, .toolCalls)
        self.picksAccepted = Self.decodeLossyInt(c, .picksAccepted)
        self.picksRejected = Self.decodeLossyInt(c, .picksRejected)
        self.submitAttempt = Self.decodeLossyInt(c, .submitAttempt)
        self.note = try? c.decodeIfPresent(String.self, forKey: .note)
    }

    private static func decodeLossyInt(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> Int? {
        if let int = try? c.decodeIfPresent(Int.self, forKey: key) { return int }
        if let double = try? c.decodeIfPresent(Double.self, forKey: key) { return Int(double) }
        if let string = try? c.decodeIfPresent(String.self, forKey: key) { return Int(string) }
        return nil
    }
}

public enum TriggerRunStatusService {
    public enum StatusError: LocalizedError {
        case noSession

        public var errorDescription: String? {
            switch self {
            case .noSession: return "Not signed in"
            }
        }
    }

    /// Fetch a Trigger.dev run's live status + metadata via the `trigger-run-status`
    /// Supabase edge function.
    ///
    /// We deliberately do NOT hit Trigger.dev directly: its run-retrieve API rejects
    /// hand-rolled "public access token" JWTs with 401 (those must be minted by
    /// Trigger's own SDK). The edge function fetches the run with the Trigger SECRET
    /// key server-side (verified working) and returns just the fields we render.
    public static func fetch(runId: String) async throws -> TriggerV3RunStatus {
        let client = await MainSupabase.shared.client
        let session = try? await client.auth.session
        guard let token = session?.accessToken else { throw StatusError.noSession }
        struct Body: Encodable { let run_id: String }
        let response: TriggerV3RunStatus = try await client.functions.invoke(
            "trigger-run-status",
            options: FunctionInvokeOptions(
                headers: ["Authorization": "Bearer \(token)"],
                body: Body(run_id: runId)
            )
        )
        return response
    }
}
