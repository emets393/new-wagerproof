import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Source of truth for a single agent's detail screen (owner *or* public view).
/// Ports the React-Query trio in `hooks/useAgentPicks.ts`
/// (`useAgentDetailSnapshot`, `useAgentPicks`, `useGeneratePicks`) into one
/// observable store.
///
/// The store fetches:
///   - `snapshot` (agent + perf + today's picks + today's run + can_view +
///     is_following) via `agent-authorized-action-v1 / detail_snapshot`.
///   - `pickHistory` (all picks, newest first) via direct table reads. Loaded
///     lazily when the user expands the history section.
///
/// Generation is a separate concern handled by `requestGeneration` — the
/// detail screen drives the loading state and refreshes the snapshot when
/// the call resolves.
@Observable
@MainActor
public final class AgentDetailStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public enum PickFilter: String, CaseIterable, Sendable, Hashable {
        case all
        case won
        case lost
        case pending

        public var label: String {
            switch self {
            case .all: return "All"
            case .won: return "Won"
            case .lost: return "Lost"
            case .pending: return "Pending"
            }
        }
    }

    // MARK: - Identity / lifecycle
    public private(set) var agentId: String

    // MARK: - Snapshot state
    public private(set) var snapshot: AgentDetailSnapshot?
    public private(set) var snapshotLoadState: LoadState = .idle

    // MARK: - History state
    public private(set) var pickHistory: [AgentPick] = []
    public private(set) var historyLoadState: LoadState = .idle

    // MARK: - Generation state
    public private(set) var isGenerating: Bool = false
    public private(set) var lastGenerationError: String?

    // MARK: - View-driven filter (history)
    public var pickFilter: PickFilter = .all

    public init(agentId: String) {
        self.agentId = agentId
    }

    // MARK: - Derived

    /// The Agent + Performance pair, surfaced as `AgentWithPerformance` so
    /// view code can reuse the existing helpers (`AgentSparkline`, etc.).
    public var agentWithPerformance: AgentWithPerformance? {
        guard let agent = snapshot?.agent else { return nil }
        return AgentWithPerformance(agent: agent, performance: snapshot?.performance)
    }

    public var todaysPicks: [AgentPick] {
        snapshot?.todaysPicks ?? []
    }

    public var todaysGenerationRun: AgentGenerationRunSummary? {
        snapshot?.todaysGenerationRun
    }

    /// Server-reported visibility flag. We deliberately keep this here for
    /// callers that want raw access — the UI gates on the local entitlements
    /// store, mirroring the RN screen's "trust local RC SDK" comment.
    public var serverCanViewAgentPicks: Bool {
        snapshot?.canViewAgentPicks ?? false
    }

    public var isFollowingFromSnapshot: Bool? {
        snapshot?.isFollowing
    }

    /// Filtered slice of `pickHistory` matching `pickFilter`. Driven entirely
    /// from local state so flipping filters never re-hits the network.
    public var filteredPickHistory: [AgentPick] {
        switch pickFilter {
        case .all: return pickHistory
        case .won: return pickHistory.filter { $0.result == .won }
        case .lost: return pickHistory.filter { $0.result == .lost }
        case .pending: return pickHistory.filter { $0.result == .pending }
        }
    }

    /// Mirrors RN's `regensRemaining` derivation: 3-per-day, reset at midnight.
    public func regenerationsRemaining(maxDaily: Int = 3) -> Int {
        guard let agent = snapshot?.agent else { return maxDaily }
        let todayStr = Self.localDateString(Date())
        // Reset if the stored date doesn't match today.
        if agent.lastGenerationDate != todayStr { return maxDaily }
        return max(0, maxDaily - agent.dailyGenerationCount)
    }

    // MARK: - Loaders

    /// Refresh the snapshot. Always re-runs; the view drives debouncing.
    public func refreshSnapshot() async {
        snapshotLoadState = .loading
        do {
            let snap = try await AgentPicksService.fetchDetailSnapshot(agentId: agentId)
            self.snapshot = snap
            self.snapshotLoadState = .loaded
        } catch {
            self.snapshotLoadState = .failed(Self.message(from: error))
        }
    }

    /// Load the full pick history. Called when the history section expands,
    /// or on pull-to-refresh once already loaded.
    public func loadHistory() async {
        historyLoadState = .loading
        do {
            let picks = try await AgentPicksService.fetchPicks(agentId: agentId)
            self.pickHistory = picks
            self.historyLoadState = .loaded
        } catch {
            self.historyLoadState = .failed(Self.message(from: error))
        }
    }

    // MARK: - Mutations

    /// Trigger a fresh generation run. Sets `isGenerating` while the edge
    /// function executes; the view shows ThinkingAnimation during that time.
    /// On success, the snapshot is refreshed so today's picks appear.
    @discardableResult
    public func generatePicks() async -> Bool {
        guard !isGenerating else { return false }
        isGenerating = true
        lastGenerationError = nil
        defer { isGenerating = false }
        do {
            _ = try await AgentPicksService.requestGeneration(agentId: agentId)
            await refreshSnapshot()
            // Reload history so the new picks show up there too.
            if case .loaded = historyLoadState {
                await loadHistory()
            }
            return true
        } catch {
            lastGenerationError = Self.message(from: error)
            return false
        }
    }

    /// Toggle autopilot via the granular service. Optimistic — refresh on
    /// failure restores truth.
    @discardableResult
    public func setAutoGenerate(_ value: Bool) async -> Bool {
        do {
            try await AgentService.setAutoGenerate(agentId: agentId, autoGenerate: value)
            await refreshSnapshot()
            return true
        } catch {
            return false
        }
    }

    /// Full-form save (called from AgentSettingsView). Routes through the
    /// `update_agent` action. On success, refreshes the snapshot.
    @discardableResult
    public func saveSettings(payload: [String: AnyEncodable]) async -> Bool {
        do {
            _ = try await AgentAuthorizedActionsService.updateAgent(
                agentId: agentId,
                payload: payload
            )
            await refreshSnapshot()
            return true
        } catch {
            lastGenerationError = Self.message(from: error)
            return false
        }
    }

    /// Delete the agent. Mirrors RN's destroy path. View navigates back.
    @discardableResult
    public func delete() async -> Bool {
        do {
            try await AgentService.delete(agentId: agentId)
            return true
        } catch {
            lastGenerationError = Self.message(from: error)
            return false
        }
    }

    // MARK: - Helpers

    private static func message(from error: Error) -> String {
        let raw = (error as NSError).localizedDescription
        return raw.isEmpty ? "Unknown error" : raw
    }

    private static func localDateString(_ date: Date) -> String {
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", comps.year ?? 1970, comps.month ?? 1, comps.day ?? 1)
    }
}
