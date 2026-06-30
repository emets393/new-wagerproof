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
///   - `pickHistory` — recent preview for the history list.
///   - `performancePicks` — full history for performance charts.
@Observable
@MainActor
public final class AgentDetailStore {
    public static let pickHistoryPreviewLimit = 7

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

        public var label: String {
            switch self {
            case .all: return "All"
            case .won: return "Won"
            case .lost: return "Lost"
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
    public private(set) var performancePicks: [AgentPick] = []
    public private(set) var performanceLoadState: LoadState = .idle

    // MARK: - Generation state
    public private(set) var isGenerating: Bool = false
    public private(set) var lastGenerationError: String?
    public private(set) var liveRunState: TriggerV3RunStatus?

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
        let fromSnapshot = snapshot?.todaysPicks ?? []
        if !fromSnapshot.isEmpty { return fromSnapshot }
        // Snapshot only includes today's picks when the server grants Pro
        // entitlement. Owners on the free tier still load history via direct
        // reads — surface today's slice from that cache when available.
        let todayStr = Self.localDateString(Date())
        return performancePicks.filter { $0.gameDate == todayStr }
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
        }
    }

    /// Graded picks from prior game dates only — excludes today and pending rows.
    static func isPickHistoryEligible(_ pick: AgentPick, todayStr: String) -> Bool {
        guard pick.gameDate < todayStr else { return false }
        switch pick.result {
        case .won, .lost, .push: return true
        case .pending: return false
        }
    }

    static func filterPickHistoryPreview(_ picks: [AgentPick], limit: Int) -> [AgentPick] {
        let todayStr = Self.localDateString(Date())
        return Array(
            picks
                .filter { isPickHistoryEligible($0, todayStr: todayStr) }
                .prefix(limit)
        )
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

    /// Load the recent pick-history preview (last `pickHistoryPreviewLimit` picks).
    public func loadHistory(isOwner: Bool = false) async {
        historyLoadState = .loading
        do {
            let preview: [AgentPick]
            if isOwner {
                preview = try await loadHistoryPreviewPreferringDirectRead()
            } else {
                preview = try await loadHistoryPreviewPreferringAuthorizedPage()
            }
            self.pickHistory = preview
            self.historyLoadState = .loaded
        } catch {
            self.historyLoadState = .failed(Self.message(from: error))
        }
    }

    /// Load the full pick set used by performance charts.
    public func loadPerformancePicks(isOwner: Bool = false) async {
        performanceLoadState = .loading
        do {
            let allPicks: [AgentPick]
            if isOwner {
                allPicks = try await loadAllPicksPreferringDirectRead()
            } else {
                allPicks = try await loadAllPicksPreferringAuthorizedPage()
            }
            self.performancePicks = allPicks
            self.performanceLoadState = .loaded
        } catch {
            self.performanceLoadState = .failed(Self.message(from: error))
        }
    }

    private func loadHistoryPreviewPreferringDirectRead() async throws -> [AgentPick] {
        let limit = Self.pickHistoryPreviewLimit
        let direct = try await AgentPicksService.fetchGradedPickHistory(agentId: agentId, limit: limit)
        if !direct.isEmpty { return direct }
        return try await loadHistoryPage(limit: limit)
    }

    private func loadHistoryPreviewPreferringAuthorizedPage() async throws -> [AgentPick] {
        let limit = Self.pickHistoryPreviewLimit
        let paged = try await loadHistoryPage(limit: limit)
        if !paged.isEmpty { return paged }
        return try await AgentPicksService.fetchGradedPickHistory(agentId: agentId, limit: limit)
    }

    private func loadAllPicksPreferringDirectRead() async throws -> [AgentPick] {
        let direct = try await AgentPicksService.fetchPicks(agentId: agentId)
        if !direct.isEmpty { return direct }
        return try await loadAllPicksViaAuthorizedPage()
    }

    private func loadAllPicksPreferringAuthorizedPage() async throws -> [AgentPick] {
        let paged = try await loadAllPicksViaAuthorizedPage()
        if !paged.isEmpty { return paged }
        return try await AgentPicksService.fetchPicks(agentId: agentId)
    }

    private func loadHistoryPage(limit: Int) async throws -> [AgentPick] {
        let page = try await AgentPicksService.fetchPicksPage(
            agentId: agentId,
            filter: "all",
            pageSize: 50,
            cursor: nil,
            includeOverlap: false
        )
        return Self.filterPickHistoryPreview(page.picks, limit: limit)
    }

    private func loadAllPicksViaAuthorizedPage() async throws -> [AgentPick] {
        var allPicks: [AgentPick] = []
        var cursor: String? = nil
        repeat {
            let page = try await AgentPicksService.fetchPicksPage(
                agentId: agentId,
                filter: "all",
                pageSize: 50,
                cursor: cursor,
                includeOverlap: false
            )
            allPicks.append(contentsOf: page.picks)
            guard page.hasMore, let next = page.nextCursor, !next.isEmpty else { break }
            cursor = next
        } while true
        return allPicks
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
        liveRunState = nil
        defer {
            isGenerating = false
            liveRunState = nil
        }
        do {
            // V3 opt-in is a Secret Settings debug toggle persisted to UserDefaults;
            // a fresh store reads the current values. Off → nil params → V2 path.
            let v3 = AgentV3SettingsStore()
            // Generation runs ASYNC on the server (enqueue → queue → worker).
            // request_generation returns immediately with {queued}; the worker
            // then takes seconds (V2) to ~2 min (V3 deepseek-reasoner). Capture
            // the current run id so we can poll until a NEW completed run lands —
            // otherwise the spinner would clear in ~1s and the user sees nothing.
            let priorRunId = todaysGenerationRun?.id
            if v3.useV3Engine {
                let trigger = try await AgentPicksService.requestTriggerV3Generation(
                    agentId: agentId,
                    dryRun: v3.dryRun,
                    modelName: v3.model
                )
                if let runId = trigger.runId, let token = trigger.publicAccessToken {
                    await pollTriggerRunUntilComplete(runId: runId, publicAccessToken: token, priorRunId: priorRunId)
                } else {
                    await pollUntilGenerationCompletes(priorRunId: priorRunId)
                }
            } else {
                _ = try await AgentPicksService.requestGeneration(
                    agentId: agentId,
                    engineVersion: nil,
                    dryRun: nil,
                    modelName: nil
                )
                await pollUntilGenerationCompletes(priorRunId: priorRunId)
            }
            await loadHistory(isOwner: true)
            await loadPerformancePicks(isOwner: true)
            return true
        } catch {
            lastGenerationError = Self.message(from: error)
            return false
        }
    }

    /// Poll Trigger.dev's run-retrieve endpoint for real metadata while the task
    /// executes. Snapshot polling remains the completion/fallback source of
    /// truth because picks still land in Supabase.
    private func pollTriggerRunUntilComplete(runId: String, publicAccessToken: String, priorRunId: String?) async {
        let maxAttempts = 440 // ~11 min at 1.5s; task maxDuration is 600s
        let intervalNanos: UInt64 = 1_500_000_000
        for _ in 0..<maxAttempts {
            if Task.isCancelled { return }
            if let state = try? await TriggerRunStatusService.fetch(runId: runId, publicAccessToken: publicAccessToken) {
                liveRunState = state
                if state.isTerminal { break }
            }
            try? await Task.sleep(nanoseconds: intervalNanos)
        }
        await pollUntilGenerationCompletes(priorRunId: priorRunId)
    }

    /// Poll the detail snapshot until a NEW succeeded run appears (its id differs
    /// from `priorRunId`) or we hit the cap. The snapshot RPC only surfaces
    /// `status='succeeded'` runs, so a changed id == "this generation finished".
    /// Failed runs never surface here, so we also cap the wait (~4 min) to cover
    /// the V3 worst case (210s wall-clock + dispatch/lease latency). Uses a
    /// silent fetch so `snapshotLoadState` doesn't flicker under the spinner.
    private func pollUntilGenerationCompletes(priorRunId: String?) async {
        let maxAttempts = 60
        let intervalNanos: UInt64 = 4_000_000_000 // 4s
        for _ in 0..<maxAttempts {
            try? await Task.sleep(nanoseconds: intervalNanos)
            guard let snap = try? await AgentPicksService.fetchDetailSnapshot(agentId: agentId) else { continue }
            self.snapshot = snap
            if let cur = snap.todaysGenerationRun?.id, cur != priorRunId { return }
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
