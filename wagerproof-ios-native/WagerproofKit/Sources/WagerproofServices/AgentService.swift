import Foundation
import Supabase
import WagerproofModels

/// Port of `wagerproof-mobile/services/agentService.ts`.
///
/// All reads/writes hit the **main** Supabase project (`gnjrklxotmbvnxbnnqgq`)
/// — the CFB project never touches `avatar_*` tables. RLS policies on
/// `avatar_profiles` constrain owner reads to `user_id = auth.uid()` plus
/// anonymous reads when `is_public = true`.
///
/// We deliberately split the column projection mirror so list calls fetch the
/// "slim" set (no JSONB) and detail calls fetch `*`. Matches the RN service
/// byte-for-byte — see `AGENT_LIST_COLUMNS` / `AGENT_DETAIL_COLUMNS`.
public enum AgentService {
    /// List projection — excludes `personality_params` + `custom_insights` so
    /// the grid query stays small. Same as `AGENT_LIST_COLUMNS` in RN.
    private static let listColumns = "id, user_id, name, avatar_emoji, avatar_color, preferred_sports, archetype, is_public, is_active, created_at, updated_at, auto_generate, auto_generate_time, auto_generate_timezone, is_widget_favorite, last_generated_at, last_auto_generated_at, owner_last_active_at, daily_generation_count, last_generation_date"

    /// Performance cache projection. Mirrors `PERF_COLUMNS` in RN.
    private static let performanceColumns = "avatar_id, wins, losses, pushes, total_picks, win_rate, net_units, current_streak, best_streak, worst_streak, last_calculated_at"

    /// Fetch a user's agents joined with their cached performance rows.
    /// Mirrors `fetchUserAgents` in `agentService.ts`.
    public static func fetchUserAgents(userId: String) async throws -> [AgentWithPerformance] {
        let main = await MainSupabase.shared.client

        // 1) Agents — slim list projection so we don't pull JSONB.
        let agents: [Agent] = try await main
            .from("avatar_profiles")
            .select(listColumns)
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value

        guard !agents.isEmpty else { return [] }

        // 2) Performance cache rows for every fetched agent. Failure here
        // doesn't blank the list — we return agents with `performance: nil`
        // (matches RN's defensive try/catch).
        var perfMap: [String: AgentPerformance] = [:]
        let ids = agents.map { $0.id }
        do {
            let perfs: [AgentPerformance] = try await main
                .from("avatar_performance_cache")
                .select(performanceColumns)
                .in("avatar_id", values: ids)
                .execute()
                .value
            for p in perfs { perfMap[p.avatarId] = p }
        } catch {
            // swallow — agents still render.
        }

        return agents.map { AgentWithPerformance(agent: $0, performance: perfMap[$0.id]) }
    }

    /// Fetch a single agent (with all JSONB fields) and its performance row.
    /// Mirrors `fetchAgentById`.
    public static func fetchAgent(id: String) async throws -> AgentWithPerformance? {
        let main = await MainSupabase.shared.client
        let agents: [Agent] = try await main
            .from("avatar_profiles")
            .select()
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        guard let agent = agents.first else { return nil }

        let perf: AgentPerformance? = await {
            do {
                let rows: [AgentPerformance] = try await main
                    .from("avatar_performance_cache")
                    .select(performanceColumns)
                    .eq("avatar_id", value: id)
                    .limit(1)
                    .execute()
                    .value
                return rows.first
            } catch {
                return nil
            }
        }()

        return AgentWithPerformance(agent: agent, performance: perf)
    }

    /// Delete an agent. Cascades pick + performance rows via FK ON DELETE
    /// CASCADE. Mirrors `deleteAgent`.
    public static func delete(agentId: String) async throws {
        let main = await MainSupabase.shared.client
        _ = try await main
            .from("avatar_profiles")
            .delete()
            .eq("id", value: agentId)
            .execute()
    }

    /// Toggle the `is_active` flag (used to pause autopilot without deleting).
    public static func setActive(agentId: String, isActive: Bool) async throws {
        let main = await MainSupabase.shared.client
        struct Patch: Encodable { let is_active: Bool; let updated_at: String }
        let patch = Patch(is_active: isActive, updated_at: Self.nowISO())
        _ = try await main
            .from("avatar_profiles")
            .update(patch)
            .eq("id", value: agentId)
            .execute()
    }

    /// Toggle `is_public`. Lands properly in B15 (detail/settings) — we expose
    /// it now so the long-press menu on AgentIdCard can flip it.
    public static func setPublic(agentId: String, isPublic: Bool) async throws {
        let main = await MainSupabase.shared.client
        struct Patch: Encodable { let is_public: Bool; let updated_at: String }
        let patch = Patch(is_public: isPublic, updated_at: Self.nowISO())
        _ = try await main
            .from("avatar_profiles")
            .update(patch)
            .eq("id", value: agentId)
            .execute()
    }

    /// Toggle `auto_generate` (autopilot on/off).
    public static func setAutoGenerate(agentId: String, autoGenerate: Bool) async throws {
        let main = await MainSupabase.shared.client
        struct Patch: Encodable { let auto_generate: Bool; let updated_at: String }
        let patch = Patch(auto_generate: autoGenerate, updated_at: Self.nowISO())
        _ = try await main
            .from("avatar_profiles")
            .update(patch)
            .eq("id", value: agentId)
            .execute()
    }

    /// Create a new agent via the `agent-authorized-action-v1` edge function.
    /// Mirrors `createAgent` in `agentService.ts:174` → `invokeAgentAuthorizedAction`
    /// with `action: 'create_agent'`. The edge function performs RevenueCat
    /// gating + Zod validation server-side; if the user can't create another
    /// agent (free tier saturated, etc.) it returns a 4xx that surfaces as a
    /// thrown error here.
    public static func create(input: CreateAgentInput) async throws -> Agent {
        let payload = CreateAgentEdgePayload(
            action: "create_agent",
            data: input
        )
        return try await invokeAgentAuthorizedAction(payload: payload, fallback: "Failed to create agent")
    }

    /// Wraps the supabase edge invoke with the explicit bearer header behavior
    /// from `agentAuthorizedActions.ts:60-77`. Without the explicit header the
    /// SDK occasionally drops auth on `verify_jwt=false` functions and returns
    /// 401 even with an active session.
    private static func invokeAgentAuthorizedAction<Payload: Encodable, Response: Decodable>(
        payload: Payload,
        fallback: String
    ) async throws -> Response {
        let main = await MainSupabase.shared.client
        let session = try await main.auth.session
        // Explicit Authorization mirrors the RN explicit-bearer workaround for
        // SDK regressions where the auto-attached header gets dropped on
        // `verify_jwt=false` functions. See agentAuthorizedActions.ts:60-77.
        let options = FunctionInvokeOptions(
            headers: ["Authorization": "Bearer \(session.accessToken)"],
            body: payload
        )

        let envelope: AgentAuthorizedActionResponse<Response> = try await main.functions.invoke(
            "agent-authorized-action-v1",
            options: options
        )
        if let data = envelope.data, envelope.success == true {
            return data
        }
        throw NSError(
            domain: "AgentAuthorizedAction",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: envelope.error ?? fallback]
        )
    }

    private static func nowISO() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date())
    }
}

// MARK: - Edge function payloads

/// Encoded payload for the `create_agent` action. Matches the RN type union in
/// `services/agentAuthorizedActions.ts:3-30` byte-for-byte — `action` discriminator
/// + nested `data` object.
private struct CreateAgentEdgePayload<T: Encodable>: Encodable {
    let action: String
    let data: T
}

/// Standard envelope returned by `agent-authorized-action-v1` — matches the
/// `AgentAuthorizedActionSuccess<T> | Failure` union from the RN client.
private struct AgentAuthorizedActionResponse<T: Decodable>: Decodable {
    let success: Bool?
    let data: T?
    let error: String?
}

/// Input payload for creating an agent — the wizard collects these fields and
/// the edge function validates server-side via the Zod schema mirrored at
/// `wagerproof-mobile/types/agent.ts::CreateAgentSchema`. Field-for-field
/// match so the same JSON shape the RN app posts is what we post here.
public struct CreateAgentInput: Encodable, Sendable {
    public let name: String
    public let avatarEmoji: String
    public let avatarColor: String
    public let preferredSports: [AgentSport]
    public let archetype: AgentArchetype?
    public let personalityParams: AgentPersonalityParams
    public let customInsights: AgentCustomInsights
    public let autoGenerate: Bool
    public let autoGenerateTime: String
    public let autoGenerateTimezone: String

    public init(
        name: String,
        avatarEmoji: String,
        avatarColor: String,
        preferredSports: [AgentSport],
        archetype: AgentArchetype?,
        personalityParams: AgentPersonalityParams,
        customInsights: AgentCustomInsights,
        autoGenerate: Bool,
        autoGenerateTime: String,
        autoGenerateTimezone: String
    ) {
        self.name = name
        self.avatarEmoji = avatarEmoji
        self.avatarColor = avatarColor
        self.preferredSports = preferredSports
        self.archetype = archetype
        self.personalityParams = personalityParams
        self.customInsights = customInsights
        self.autoGenerate = autoGenerate
        self.autoGenerateTime = autoGenerateTime
        self.autoGenerateTimezone = autoGenerateTimezone
    }

    enum CodingKeys: String, CodingKey {
        case name
        case avatarEmoji = "avatar_emoji"
        case avatarColor = "avatar_color"
        case preferredSports = "preferred_sports"
        case archetype
        case personalityParams = "personality_params"
        case customInsights = "custom_insights"
        case autoGenerate = "auto_generate"
        case autoGenerateTime = "auto_generate_time"
        case autoGenerateTimezone = "auto_generate_timezone"
    }
}
