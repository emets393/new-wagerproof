import Foundation
import Observation

/// `AgentEntitlementsStore` ports `wagerproof-mobile/hooks/useAgentEntitlements.ts`
/// — the freemium/pro gating layer for agent creation, viewing picks, and
/// leaderboard ranks.
///
/// Backed by `ProAccessStore` so changes to the user's RC entitlement
/// propagate automatically.
///
/// Limits mirror the RN constants:
///   - FREE: 1 active agent
///   - PRO: 10 active / 30 total
///   - Admin: unlimited
@Observable
@MainActor
public final class AgentEntitlementsStore {
    public static let freeAgentLimit = 1
    public static let proMaxActiveAgents = 10
    public static let proMaxTotalAgents = 30
    public static let freeLeaderboardMinRank = 6
    public static let freeLeaderboardMaxRank = 10
    /// Hard cap on how many agents may be *active* at once, for any tier — the
    /// office has 8 desks, so at most 8 agents run concurrently. Users may still
    /// create up to the total-agent limit; the rest sit inactive on the bench.
    public static let maxConcurrentActiveAgents = 8

    private let proAccess: ProAccessStore

    public init(proAccess: ProAccessStore) {
        self.proAccess = proAccess
    }

    public var isPro: Bool { proAccess.isPro }
    public var isAdmin: Bool { proAccess.isAdmin }
    public var isLoading: Bool { proAccess.isLoading }

    public var canViewAgentPicks: Bool { isPro || isAdmin }
    public var canCreatePublicAgent: Bool { isPro || isAdmin }
    public var canUseAutopilot: Bool { isPro || isAdmin }

    public var maxActiveAgents: Int? {
        if isAdmin { return nil }
        return isPro ? Self.proMaxActiveAgents : Self.freeAgentLimit
    }

    public var maxTotalAgents: Int? {
        if isAdmin { return nil }
        return isPro ? Self.proMaxTotalAgents : Self.freeAgentLimit
    }

    /// Mirrors RN `canCreateAnotherAgent`. Pro users gate on TOTAL count,
    /// free users gate on ACTIVE count.
    public func canCreateAnotherAgent(activeCount: Int, totalCount: Int) -> Bool {
        if isAdmin { return true }
        if isPro { return totalCount < Self.proMaxTotalAgents }
        return activeCount < Self.freeAgentLimit
    }

    /// Mirrors RN `canViewLeaderboardRank`. Free users can preview ranks 6–10
    /// (the "you could be here" tease); Pro/admin see all.
    public func canViewLeaderboardRank(_ rank: Int) -> Bool {
        if isPro || isAdmin { return true }
        return rank >= Self.freeLeaderboardMinRank && rank <= Self.freeLeaderboardMaxRank
    }
}
