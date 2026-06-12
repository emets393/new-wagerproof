import Foundation

/// Mirror of an `avatar_picks` row. Ports RN `AgentPick` from
/// `types/agent.ts:160-183`. The `archived_*` JSONB columns are decoded
/// loosely; only fields the iOS UI reads in B13 are typed explicitly.
public struct AgentPick: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let avatarId: String
    public let gameId: String
    public let sport: AgentSport
    public let matchup: String
    public let gameDate: String
    public let betType: String
    public let pickSelection: String
    public let odds: String?
    public let units: Double
    public let confidence: Int
    public let reasoningText: String
    public let keyFactors: [String]?
    public let result: PickResultStatus
    public let actualResult: String?
    public let gradedAt: String?
    public let createdAt: String
    /// Raw `ai_decision_trace` JSONB (leaned metrics, rationale, alignment).
    /// Loosely typed — schema drifts across generation versions (v2/v3).
    public let aiDecisionTrace: JSONValue?
    /// Raw `ai_audit_payload` JSONB. V3 payloads carry run_id, steering,
    /// model_response_payload, decision_trace, validator overrides.
    public let aiAuditPayload: JSONValue?

    public enum PickResultStatus: String, Codable, Sendable, Hashable {
        case won
        case lost
        case push
        case pending
    }

    enum CodingKeys: String, CodingKey {
        case id
        case avatarId = "avatar_id"
        case gameId = "game_id"
        case sport
        case matchup
        case gameDate = "game_date"
        case betType = "bet_type"
        case pickSelection = "pick_selection"
        case odds
        case units
        case confidence
        case reasoningText = "reasoning_text"
        case keyFactors = "key_factors"
        case result
        case actualResult = "actual_result"
        case gradedAt = "graded_at"
        case createdAt = "created_at"
        case aiDecisionTrace = "ai_decision_trace"
        case aiAuditPayload = "ai_audit_payload"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.avatarId = try c.decode(String.self, forKey: .avatarId)
        self.gameId = try c.decode(String.self, forKey: .gameId)
        self.sport = (try? c.decode(AgentSport.self, forKey: .sport)) ?? .nfl
        self.matchup = (try? c.decode(String.self, forKey: .matchup)) ?? ""
        self.gameDate = (try? c.decode(String.self, forKey: .gameDate)) ?? ""
        self.betType = (try? c.decode(String.self, forKey: .betType)) ?? ""
        self.pickSelection = (try? c.decode(String.self, forKey: .pickSelection)) ?? ""
        self.odds = try? c.decodeIfPresent(String.self, forKey: .odds)
        if let d = try? c.decode(Double.self, forKey: .units) {
            self.units = d
        } else if let s = try? c.decode(String.self, forKey: .units), let d = Double(s) {
            self.units = d
        } else {
            self.units = 1.0
        }
        self.confidence = (try? c.decode(Int.self, forKey: .confidence)) ?? 3
        self.reasoningText = (try? c.decode(String.self, forKey: .reasoningText)) ?? ""
        self.keyFactors = try? c.decodeIfPresent([String].self, forKey: .keyFactors)
        self.result = (try? c.decode(PickResultStatus.self, forKey: .result)) ?? .pending
        self.actualResult = try? c.decodeIfPresent(String.self, forKey: .actualResult)
        self.gradedAt = try? c.decodeIfPresent(String.self, forKey: .gradedAt)
        self.createdAt = try c.decode(String.self, forKey: .createdAt)
        self.aiDecisionTrace = try? c.decodeIfPresent(JSONValue.self, forKey: .aiDecisionTrace)
        self.aiAuditPayload = try? c.decodeIfPresent(JSONValue.self, forKey: .aiAuditPayload)
    }

    public init(
        id: String,
        avatarId: String,
        gameId: String,
        sport: AgentSport,
        matchup: String,
        gameDate: String,
        betType: String,
        pickSelection: String,
        odds: String?,
        units: Double,
        confidence: Int,
        reasoningText: String,
        keyFactors: [String]?,
        result: PickResultStatus,
        actualResult: String?,
        gradedAt: String?,
        createdAt: String,
        aiDecisionTrace: JSONValue? = nil,
        aiAuditPayload: JSONValue? = nil
    ) {
        self.id = id
        self.avatarId = avatarId
        self.gameId = gameId
        self.sport = sport
        self.matchup = matchup
        self.gameDate = gameDate
        self.betType = betType
        self.pickSelection = pickSelection
        self.odds = odds
        self.units = units
        self.confidence = confidence
        self.reasoningText = reasoningText
        self.keyFactors = keyFactors
        self.result = result
        self.actualResult = actualResult
        self.gradedAt = gradedAt
        self.createdAt = createdAt
        self.aiDecisionTrace = aiDecisionTrace
        self.aiAuditPayload = aiAuditPayload
    }
}

/// Returned by the `get_top_agent_picks_feed_v2` RPC — an `avatar_picks` row
/// joined with the agent's identity + cached perf snapshot. Mirrors RN
/// `TopAgentPickFeedV2Row` in `services/agentPicksService.ts:23-33`.
public struct TopAgentPickFeedRow: Codable, Identifiable, Sendable, Hashable {
    public let id: String
    public let avatarId: String
    public let gameId: String
    public let sport: AgentSport
    public let matchup: String
    public let gameDate: String
    public let betType: String
    public let pickSelection: String
    public let odds: String?
    public let units: Double
    public let confidence: Int
    public let reasoningText: String
    public let result: AgentPick.PickResultStatus
    public let createdAt: String

    public let agentName: String
    public let agentAvatarEmoji: String
    public let agentAvatarColor: String
    public let agentWins: Int
    public let agentLosses: Int
    public let agentPushes: Int
    public let agentNetUnits: Double
    public let agentRank: Int?
    /// Snapshot of the agent's personality at pick time (RPC
    /// `archived_personality`). Drives the strategy chips on the feed card.
    public let archivedPersonality: AgentPersonalityParams?
    /// Agent's current W/L streak (RPC `agent_current_streak`). 0 until the feed
    /// RPC is extended to return it; the form chart degrades to a blank streak.
    public let agentCurrentStreak: Int

    enum CodingKeys: String, CodingKey {
        case id
        case avatarId = "avatar_id"
        case gameId = "game_id"
        case sport
        case matchup
        case gameDate = "game_date"
        case betType = "bet_type"
        case pickSelection = "pick_selection"
        case odds
        case units
        case confidence
        case reasoningText = "reasoning_text"
        case result
        case createdAt = "created_at"
        case agentName = "agent_name"
        case agentAvatarEmoji = "agent_avatar_emoji"
        case agentAvatarColor = "agent_avatar_color"
        case agentWins = "agent_wins"
        case agentLosses = "agent_losses"
        case agentPushes = "agent_pushes"
        case agentNetUnits = "agent_net_units"
        case agentRank = "agent_rank"
        case archivedPersonality = "archived_personality"
        case agentCurrentStreak = "agent_current_streak"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try c.decode(String.self, forKey: .id)
        self.avatarId = try c.decode(String.self, forKey: .avatarId)
        self.gameId = try c.decode(String.self, forKey: .gameId)
        self.sport = (try? c.decode(AgentSport.self, forKey: .sport)) ?? .nfl
        self.matchup = (try? c.decode(String.self, forKey: .matchup)) ?? ""
        self.gameDate = (try? c.decode(String.self, forKey: .gameDate)) ?? ""
        self.betType = (try? c.decode(String.self, forKey: .betType)) ?? ""
        self.pickSelection = (try? c.decode(String.self, forKey: .pickSelection)) ?? ""
        self.odds = try? c.decodeIfPresent(String.self, forKey: .odds)
        if let d = try? c.decode(Double.self, forKey: .units) {
            self.units = d
        } else if let s = try? c.decode(String.self, forKey: .units), let d = Double(s) {
            self.units = d
        } else {
            self.units = 1.0
        }
        self.confidence = (try? c.decode(Int.self, forKey: .confidence)) ?? 3
        self.reasoningText = (try? c.decode(String.self, forKey: .reasoningText)) ?? ""
        self.result = (try? c.decode(AgentPick.PickResultStatus.self, forKey: .result)) ?? .pending
        self.createdAt = try c.decode(String.self, forKey: .createdAt)
        self.agentName = (try? c.decode(String.self, forKey: .agentName)) ?? "Agent"
        self.agentAvatarEmoji = (try? c.decode(String.self, forKey: .agentAvatarEmoji)) ?? "\u{1F916}"
        self.agentAvatarColor = (try? c.decode(String.self, forKey: .agentAvatarColor)) ?? "#6366f1"
        self.agentWins = (try? c.decode(Int.self, forKey: .agentWins)) ?? 0
        self.agentLosses = (try? c.decode(Int.self, forKey: .agentLosses)) ?? 0
        self.agentPushes = (try? c.decode(Int.self, forKey: .agentPushes)) ?? 0
        if let d = try? c.decode(Double.self, forKey: .agentNetUnits) {
            self.agentNetUnits = d
        } else if let s = try? c.decode(String.self, forKey: .agentNetUnits), let d = Double(s) {
            self.agentNetUnits = d
        } else {
            self.agentNetUnits = 0
        }
        self.agentRank = try? c.decodeIfPresent(Int.self, forKey: .agentRank)
        self.archivedPersonality = try? c.decodeIfPresent(AgentPersonalityParams.self, forKey: .archivedPersonality)
        self.agentCurrentStreak = (try? c.decode(Int.self, forKey: .agentCurrentStreak)) ?? 0
    }
}
