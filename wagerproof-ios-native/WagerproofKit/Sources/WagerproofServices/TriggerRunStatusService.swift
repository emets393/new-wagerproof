import Foundation

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
        return upper == "COMPLETED" || upper == "CANCELED" || upper == "FAILED" || upper == "CRASHED" || upper == "INTERRUPTED" || upper == "EXPIRED"
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
        case badURL
        case badResponse(Int)

        public var errorDescription: String? {
            switch self {
            case .badURL: return "Invalid Trigger.dev run URL"
            case .badResponse(let code): return "Trigger.dev status request failed (\(code))"
            }
        }
    }

    public static func fetch(runId: String, publicAccessToken: String) async throws -> TriggerV3RunStatus {
        guard let url = URL(string: "https://api.trigger.dev/api/v3/runs/\(runId)") else {
            throw StatusError.badURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(publicAccessToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw StatusError.badResponse((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(TriggerV3RunStatus.self, from: data)
    }
}
