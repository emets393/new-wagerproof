import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// `AgentsStore` is the source of truth for the My Agents inner tab on the
/// agents hub. Ports the React-Query trio in
/// `wagerproof-mobile/hooks/useAgents.ts` (useUserAgents + useUpdateAgent +
/// useDeleteAgent) into a single observable.
///
/// State model:
///   - `loadState` mirrors RN's `isLoading`/`error` pair (sum type instead).
///   - `agents` is sorted by `net_units` descending (best-first), matching
///     the `sortedAgents` memo in `agents/index.tsx:215-218`.
///   - The `userId` is set via `bind(userId:)` once `AuthStore` resolves; the
///     store no-ops every refresh until then so we never make an unscoped
///     query against the user's RLS-protected rows.
///
/// FIDELITY-WAIVER #070: The Top Agent Picks inner tab is hosted on this
/// store too — it fetches the cross-agent RPC feed lazily on first activation.
/// The full filter UI (top10/following/favorites) lands in B16.
@Observable
@MainActor
public final class AgentsStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public enum InnerTab: String, CaseIterable, Hashable, Sendable {
        case myAgents
        case leaderboard
        case topPicks

        public var label: String {
            switch self {
            case .myAgents: return "My Agents"
            case .leaderboard: return "Leaderboard"
            case .topPicks: return "Top Picks"
            }
        }
    }

    // MARK: - State

    public private(set) var agents: [AgentWithPerformance] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var topPicks: [TopAgentPickFeedRow] = []
    public private(set) var topPicksLoadState: LoadState = .idle
    public private(set) var lastRefreshedAt: Date?

    public var activeTab: InnerTab = .myAgents

    public private(set) var userId: String?

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }

    public var lastError: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }

    public init() {}

    // MARK: - Lifecycle

    /// Set the active user. Called by the view from `.task` once it can read
    /// `AuthStore.phase`. Resets state when the user changes.
    public func bind(userId: String?) {
        if userId == self.userId { return }
        self.userId = userId
        self.agents = []
        self.topPicks = []
        self.loadState = .idle
        self.topPicksLoadState = .idle
    }

    /// Pull-to-refresh / first-load. Re-fetches `avatar_profiles` for the
    /// active user. Mirrors `useUserAgents.refetch`.
    public func refresh() async {
        guard let userId else {
            // No user yet — leave state idle so the view shows skeleton.
            loadState = .idle
            return
        }
        loadState = .loading
        do {
            let fetched = try await AgentService.fetchUserAgents(userId: userId)
            // Sort best-first by net_units; agents without performance sink
            // to the bottom (-inf treatment matches RN's sortedAgents memo).
            self.agents = fetched.sorted { a, b in
                let av = a.performance?.netUnits ?? -.infinity
                let bv = b.performance?.netUnits ?? -.infinity
                return av > bv
            }
            self.loadState = .loaded
            self.lastRefreshedAt = Date()
        } catch {
            self.loadState = .failed(Self.message(from: error))
        }
    }

    /// Lazy fetch for the Top Agent Picks inner tab. Idempotent — only runs
    /// once per session unless `forceRefresh` is true.
    public func refreshTopPicks(forceRefresh: Bool = false) async {
        if !forceRefresh, case .loaded = topPicksLoadState { return }
        topPicksLoadState = .loading
        do {
            let feed = try await AgentPicksService.fetchTopAgentPicksFeed(
                filterMode: "top10",
                viewerUserId: userId,
                limit: 50
            )
            self.topPicks = feed
            self.topPicksLoadState = .loaded
        } catch {
            self.topPicksLoadState = .failed(Self.message(from: error))
        }
    }

    // MARK: - Mutations

    /// Optimistically delete an agent locally, then call the service. If the
    /// service throws we re-fetch to restore truth.
    @discardableResult
    public func delete(agentId: String) async -> Bool {
        let snapshot = agents
        agents.removeAll { $0.id == agentId }
        do {
            try await AgentService.delete(agentId: agentId)
            return true
        } catch {
            self.agents = snapshot
            self.loadState = .failed(Self.message(from: error))
            return false
        }
    }

    /// Flip `is_active` (autopilot pause). Optimistic — re-fetch on failure.
    @discardableResult
    public func setActive(agentId: String, isActive: Bool) async -> Bool {
        let snapshot = agents
        if let idx = agents.firstIndex(where: { $0.id == agentId }) {
            agents[idx].agent.isActive = isActive
        }
        do {
            try await AgentService.setActive(agentId: agentId, isActive: isActive)
            return true
        } catch {
            self.agents = snapshot
            return false
        }
    }

    /// Flip `auto_generate` (autopilot on/off). Same optimistic pattern.
    @discardableResult
    public func setAutoGenerate(agentId: String, autoGenerate: Bool) async -> Bool {
        let snapshot = agents
        if let idx = agents.firstIndex(where: { $0.id == agentId }) {
            agents[idx].agent.autoGenerate = autoGenerate
        }
        do {
            try await AgentService.setAutoGenerate(agentId: agentId, autoGenerate: autoGenerate)
            return true
        } catch {
            self.agents = snapshot
            return false
        }
    }

    /// Toggle `is_public`. Same optimistic pattern.
    @discardableResult
    public func setPublic(agentId: String, isPublic: Bool) async -> Bool {
        let snapshot = agents
        if let idx = agents.firstIndex(where: { $0.id == agentId }) {
            agents[idx].agent.isPublic = isPublic
        }
        do {
            try await AgentService.setPublic(agentId: agentId, isPublic: isPublic)
            return true
        } catch {
            self.agents = snapshot
            return false
        }
    }

    // MARK: - Derived

    public var totalCount: Int { agents.count }
    public var activeCount: Int { agents.filter { $0.agent.isActive }.count }
    public var hasAgents: Bool { !agents.isEmpty }

    // MARK: - Helpers

    private static func message(from error: Error) -> String {
        let raw = (error as NSError).localizedDescription
        return raw.isEmpty ? "Unknown error" : raw
    }

    #if DEBUG
    public func debugSet(agents: [AgentWithPerformance], state: LoadState = .loaded) {
        self.agents = agents
        self.loadState = state
        self.lastRefreshedAt = state == .loaded ? Date() : nil
    }
    #endif
}
