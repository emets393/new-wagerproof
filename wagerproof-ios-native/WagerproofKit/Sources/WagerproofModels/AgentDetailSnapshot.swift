import Foundation

/// Mirror of the RN `AgentDetailSnapshotV2` interface in
/// `services/agentPicksService.ts:35-43`. Returned by the
/// `agent-authorized-action-v1` edge function with action `detail_snapshot`.
///
/// The `agent` field is the full `Agent` row (includes JSONB), `performance`
/// is the cached row from `avatar_performance_cache`, `todaysPicks` is the
/// pre-filtered slice for today, and `todaysGenerationRun` is the most recent
/// successful generation run so the UI can distinguish "hasn't run" from
/// "ran and skipped".
public struct AgentDetailSnapshot: Codable, Sendable, Hashable {
    public let apiVersion: String
    public let agent: Agent?
    public let performance: AgentPerformance?
    public let todaysPicks: [AgentPick]
    public let todaysGenerationRun: AgentGenerationRunSummary?
    public let canViewAgentPicks: Bool
    public let isFollowing: Bool?

    enum CodingKeys: String, CodingKey {
        case apiVersion = "api_version"
        case agent
        case performance
        case todaysPicks = "todays_picks"
        case todaysGenerationRun = "todays_generation_run"
        case canViewAgentPicks = "can_view_agent_picks"
        case isFollowing = "is_following"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.apiVersion = (try? c.decode(String.self, forKey: .apiVersion)) ?? "v3"
        self.agent = try? c.decodeIfPresent(Agent.self, forKey: .agent)
        self.performance = try? c.decodeIfPresent(AgentPerformance.self, forKey: .performance)
        self.todaysPicks = AgentPick.decodeLossyArray(from: c, forKey: .todaysPicks)
        self.todaysGenerationRun = try? c.decodeIfPresent(AgentGenerationRunSummary.self, forKey: .todaysGenerationRun)
        self.canViewAgentPicks = (try? c.decode(Bool.self, forKey: .canViewAgentPicks)) ?? false
        self.isFollowing = try? c.decodeIfPresent(Bool.self, forKey: .isFollowing)
    }

    public init(
        apiVersion: String = "v3",
        agent: Agent? = nil,
        performance: AgentPerformance? = nil,
        todaysPicks: [AgentPick] = [],
        todaysGenerationRun: AgentGenerationRunSummary? = nil,
        canViewAgentPicks: Bool = false,
        isFollowing: Bool? = nil
    ) {
        self.apiVersion = apiVersion
        self.agent = agent
        self.performance = performance
        self.todaysPicks = todaysPicks
        self.todaysGenerationRun = todaysGenerationRun
        self.canViewAgentPicks = canViewAgentPicks
        self.isFollowing = isFollowing
    }
}

/// Page response for the agent pick history endpoint. Mirrors RN
/// `AgentPicksPageV2` in the same file.
public struct AgentPicksPage: Codable, Sendable, Hashable {
    public let apiVersion: String
    public let picks: [AgentPick]
    public let nextCursor: String?
    public let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case apiVersion = "api_version"
        case picks
        case nextCursor = "next_cursor"
        case hasMore = "has_more"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.apiVersion = (try? c.decode(String.self, forKey: .apiVersion)) ?? "v3"
        self.picks = AgentPick.decodeLossyArray(from: c, forKey: .picks)
        self.nextCursor = try? c.decodeIfPresent(String.self, forKey: .nextCursor)
        self.hasMore = (try? c.decode(Bool.self, forKey: .hasMore)) ?? false
    }

    public init(
        apiVersion: String = "v3",
        picks: [AgentPick] = [],
        nextCursor: String? = nil,
        hasMore: Bool = false
    ) {
        self.apiVersion = apiVersion
        self.picks = picks
        self.nextCursor = nextCursor
        self.hasMore = hasMore
    }
}

/// Mirror of `agent_generation_runs` row projection used by the snapshot.
/// Used to detect "ran and chose not to publish" outcomes so the detail
/// screen can render an empathetic terminal-style "Analysis complete" tile.
public struct AgentGenerationRunSummary: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let avatarId: String
    public let generationType: String?
    public let targetDate: String?
    public let status: String?
    public let weakSlate: Bool
    public let noGames: Bool
    public let picksGenerated: Int
    public let completedAt: String?
    public let createdAt: String?
    public let slateNote: String?

    enum CodingKeys: String, CodingKey {
        case id
        case avatarId = "avatar_id"
        case generationType = "generation_type"
        case targetDate = "target_date"
        case status
        case weakSlate = "weak_slate"
        case noGames = "no_games"
        case picksGenerated = "picks_generated"
        case completedAt = "completed_at"
        case createdAt = "created_at"
        case slateNote = "slate_note"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.avatarId = (try? c.decode(String.self, forKey: .avatarId)) ?? ""
        self.generationType = try? c.decodeIfPresent(String.self, forKey: .generationType)
        self.targetDate = try? c.decodeIfPresent(String.self, forKey: .targetDate)
        self.status = try? c.decodeIfPresent(String.self, forKey: .status)
        self.weakSlate = (try? c.decode(Bool.self, forKey: .weakSlate)) ?? false
        self.noGames = (try? c.decode(Bool.self, forKey: .noGames)) ?? false
        self.picksGenerated = (try? c.decode(Int.self, forKey: .picksGenerated)) ?? 0
        self.completedAt = try? c.decodeIfPresent(String.self, forKey: .completedAt)
        self.createdAt = try? c.decodeIfPresent(String.self, forKey: .createdAt)
        self.slateNote = try? c.decodeIfPresent(String.self, forKey: .slateNote)
    }

    public init(
        id: String,
        avatarId: String,
        generationType: String? = nil,
        targetDate: String? = nil,
        status: String? = nil,
        weakSlate: Bool = false,
        noGames: Bool = false,
        picksGenerated: Int = 0,
        completedAt: String? = nil,
        createdAt: String? = nil,
        slateNote: String? = nil
    ) {
        self.id = id
        self.avatarId = avatarId
        self.generationType = generationType
        self.targetDate = targetDate
        self.status = status
        self.weakSlate = weakSlate
        self.noGames = noGames
        self.picksGenerated = picksGenerated
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.slateNote = slateNote
    }
}

/// Returned by `request_generation`. Mirrors the structured response from the
/// V2 enqueue + worker pipeline.
public struct GenerationRequestResult: Codable, Sendable, Hashable {
    public let queued: Bool
    public let jobId: String?
    public let result: GenerationResult?

    enum CodingKeys: String, CodingKey {
        case queued
        case jobId = "job_id"
        case result
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.queued = (try? c.decode(Bool.self, forKey: .queued)) ?? false
        self.jobId = try? c.decodeIfPresent(String.self, forKey: .jobId)
        self.result = try? c.decodeIfPresent(GenerationResult.self, forKey: .result)
    }

    public init(queued: Bool, jobId: String?, result: GenerationResult?) {
        self.queued = queued
        self.jobId = jobId
        self.result = result
    }
}

public struct GenerationResult: Codable, Sendable, Hashable {
    public let picksGenerated: Int
    public let slateNote: String?
    public let picks: [AgentPick]

    enum CodingKeys: String, CodingKey {
        case picksGenerated = "picks_generated"
        case slateNote = "slate_note"
        case picks
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.picksGenerated = (try? c.decode(Int.self, forKey: .picksGenerated)) ?? 0
        self.slateNote = try? c.decodeIfPresent(String.self, forKey: .slateNote)
        self.picks = (try? c.decode([AgentPick].self, forKey: .picks)) ?? []
    }

    public init(picksGenerated: Int, slateNote: String?, picks: [AgentPick]) {
        self.picksGenerated = picksGenerated
        self.slateNote = slateNote
        self.picks = picks
    }
}

/// Per-pick "audit payload" the agent-pick audit widget renders. Returned by
/// the `agent-pick-audit` edge function and stored on `avatar_picks` row as
/// `ai_audit_payload` JSONB. We keep it loosely typed since the schema drifts
/// across model versions.
public struct AgentPickAuditPayload: Sendable, Hashable {
    public var leanedMetrics: [LeanedMetric]
    public var rationaleText: String
    public var personalityAlignmentText: String
    public var modelInputGameJSON: String
    public var modelInputPersonalityJSON: String
    public var modelResponseJSON: String
    public var payloadIsFormatted: Bool
    /// The COMPLETE audit dump (pick fields + ai_decision_trace +
    /// ai_audit_payload) as one pretty-printed JSON string — what the
    /// "Copy Full Trace" button puts on the clipboard for debugging.
    public var fullTraceJSON: String
    /// V3 only: the generation loop's tool calls (name, timing, result excerpt)
    /// embedded in `ai_audit_payload.tool_trace`. Empty for V2/legacy picks.
    public var toolTrace: [ToolTraceEntry]
    /// Raw `tool_trace` array pretty-printed for the section copy button.
    public var toolTraceJSON: String

    public struct ToolTraceEntry: Hashable, Sendable, Identifiable {
        public let id = UUID()
        public let seq: Int
        public let name: String
        public let ms: Int
        public let ok: Bool
        public let resultExcerpt: String

        public init(seq: Int, name: String, ms: Int, ok: Bool, resultExcerpt: String) {
            self.seq = seq
            self.name = name
            self.ms = ms
            self.ok = ok
            self.resultExcerpt = resultExcerpt
        }
    }

    public struct LeanedMetric: Hashable, Sendable, Identifiable {
        public let id = UUID()
        public let metricKey: String
        public let metricValue: String
        public let whyItMattered: String
        public let personalityTrait: String

        public init(metricKey: String, metricValue: String, whyItMattered: String, personalityTrait: String) {
            self.metricKey = metricKey
            self.metricValue = metricValue
            self.whyItMattered = whyItMattered
            self.personalityTrait = personalityTrait
        }
    }

    public init(
        leanedMetrics: [LeanedMetric] = [],
        rationaleText: String = "",
        personalityAlignmentText: String = "",
        modelInputGameJSON: String = "{}",
        modelInputPersonalityJSON: String = "{}",
        modelResponseJSON: String = "{}",
        payloadIsFormatted: Bool = false,
        fullTraceJSON: String = "{}",
        toolTrace: [ToolTraceEntry] = [],
        toolTraceJSON: String = "[]"
    ) {
        self.leanedMetrics = leanedMetrics
        self.rationaleText = rationaleText
        self.personalityAlignmentText = personalityAlignmentText
        self.modelInputGameJSON = modelInputGameJSON
        self.modelInputPersonalityJSON = modelInputPersonalityJSON
        self.modelResponseJSON = modelResponseJSON
        self.payloadIsFormatted = payloadIsFormatted
        self.fullTraceJSON = fullTraceJSON
        self.toolTrace = toolTrace
        self.toolTraceJSON = toolTraceJSON
    }
}

/// One message in the per-agent chat thread (user ↔ agent). Stored in
/// `agent_chat_messages` on main Supabase. Mirrors RN `AgentChatMessage`
/// from `services/agentChatService.ts`.
public struct AgentChatMessage: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let avatarId: String
    public let userId: String
    public let role: Role
    public let content: String
    public let createdAt: String

    public enum Role: String, Codable, Sendable, Hashable {
        case user
        case assistant
        case system
    }

    enum CodingKeys: String, CodingKey {
        case id
        case avatarId = "avatar_id"
        case userId = "user_id"
        case role
        case content
        case createdAt = "created_at"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.avatarId = (try? c.decode(String.self, forKey: .avatarId)) ?? ""
        self.userId = (try? c.decode(String.self, forKey: .userId)) ?? ""
        self.role = (try? c.decode(Role.self, forKey: .role)) ?? .user
        self.content = (try? c.decode(String.self, forKey: .content)) ?? ""
        self.createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ""
    }

    public init(id: String, avatarId: String, userId: String, role: Role, content: String, createdAt: String) {
        self.id = id
        self.avatarId = avatarId
        self.userId = userId
        self.role = role
        self.content = content
        self.createdAt = createdAt
    }
}
