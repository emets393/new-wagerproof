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
    public private(set) var parlayHistory: [AgentParlay] = []
    public private(set) var historyLoadState: LoadState = .idle
    public private(set) var performancePicks: [AgentPick] = []
    public private(set) var performanceParlays: [AgentParlay] = []
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

    /// Today's parlay tickets — same snapshot-first / direct-read-fallback
    /// shape as `todaysPicks` (the snapshot only carries them when the server
    /// grants pick visibility).
    public var todaysParlays: [AgentParlay] {
        let fromSnapshot = snapshot?.todaysParlays ?? []
        if !fromSnapshot.isEmpty { return fromSnapshot }
        let todayStr = Self.localDateString(Date())
        return performanceParlays.filter { $0.displayDate == todayStr }
    }

    /// Today's picks + parlays interleaved (newest first) — feeds the unified
    /// Today's Picks rail.
    public var todaysBetItems: [AgentBetItem] {
        let items = todaysPicks.map(AgentBetItem.pick) + todaysParlays.map(AgentBetItem.parlay)
        return items.sorted { $0.createdAt > $1.createdAt }
    }

    public var todaysGenerationRun: AgentGenerationRunSummary? {
        snapshot?.todaysGenerationRun
    }

    /// A run that's live RIGHT NOW (queued/processing, per the snapshot).
    /// Non-nil ⇒ the UI should show the generating state and resume polling
    /// rather than offering a fresh trigger.
    public var activeGenerationRun: AgentGenerationRunSummary? {
        snapshot?.activeGenerationRun
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

    /// The COMPLETE graded pick history (prior-date won/lost/push picks),
    /// newest first. Backs the Pick History folder + its browse sheet. Derived
    /// from the full `performancePicks` set; falls back to the loaded preview
    /// when performance picks haven't arrived yet, so the folder is never empty
    /// while history exists.
    public var fullPickHistory: [AgentPick] {
        let todayStr = Self.localDateString(Date())
        let graded = performancePicks.filter { Self.isPickHistoryEligible($0, todayStr: todayStr) }
        let base = graded.isEmpty ? pickHistory : graded
        return base.sorted { lhs, rhs in
            if lhs.gameDate != rhs.gameDate { return lhs.gameDate > rhs.gameDate }
            return lhs.createdAt > rhs.createdAt
        }
    }

    /// The graded pick history interleaved with graded parlay tickets, newest
    /// first — backs the unified Pick History folder/rolodex.
    public var fullBetHistory: [AgentBetItem] {
        let todayStr = Self.localDateString(Date())
        let gradedParlays = (performanceParlays.isEmpty ? parlayHistory : performanceParlays)
            .filter { Self.isParlayHistoryEligible($0, todayStr: todayStr) }
        let items = fullPickHistory.map(AgentBetItem.pick) + gradedParlays.map(AgentBetItem.parlay)
        return items.sorted { lhs, rhs in
            if lhs.gameDate != rhs.gameDate { return lhs.gameDate > rhs.gameDate }
            return lhs.createdAt > rhs.createdAt
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

    /// Parlay mirror of `isPickHistoryEligible`, keyed on the ticket's
    /// target/display date and rolled-up result.
    static func isParlayHistoryEligible(_ parlay: AgentParlay, todayStr: String) -> Bool {
        let date = parlay.displayDate
        guard !date.isEmpty, date < todayStr else { return false }
        switch parlay.result {
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

    /// Load the recent pick-history preview (last `pickHistoryPreviewLimit`
    /// picks) plus the parlay preview. Both fetches run concurrently; a parlay
    /// failure never blanks the pick history (parlays are additive).
    public func loadHistory(isOwner: Bool = false) async {
        historyLoadState = .loading
        do {
            let preview: [AgentPick]
            if isOwner {
                async let parlaysTask = loadParlayHistoryPreviewPreferringDirectRead()
                preview = try await loadHistoryPreviewPreferringDirectRead()
                self.parlayHistory = (try? await parlaysTask) ?? self.parlayHistory
            } else {
                async let parlaysTask = loadParlayHistoryPreviewPreferringAuthorizedPage()
                preview = try await loadHistoryPreviewPreferringAuthorizedPage()
                self.parlayHistory = (try? await parlaysTask) ?? self.parlayHistory
            }
            self.pickHistory = preview
            self.historyLoadState = .loaded
        } catch {
            self.historyLoadState = .failed(Self.message(from: error))
        }
    }

    /// Load the full pick + parlay sets used by performance charts.
    public func loadPerformancePicks(isOwner: Bool = false) async {
        performanceLoadState = .loading
        do {
            let allPicks: [AgentPick]
            if isOwner {
                async let parlaysTask = loadAllParlaysPreferringDirectRead()
                allPicks = try await loadAllPicksPreferringDirectRead()
                self.performanceParlays = (try? await parlaysTask) ?? self.performanceParlays
            } else {
                async let parlaysTask = loadAllParlaysPreferringAuthorizedPage()
                allPicks = try await loadAllPicksPreferringAuthorizedPage()
                self.performanceParlays = (try? await parlaysTask) ?? self.performanceParlays
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

    // MARK: - Parlay loaders (same dual-path shape as the pick loaders)

    private func loadParlayHistoryPreviewPreferringDirectRead() async throws -> [AgentParlay] {
        let limit = Self.pickHistoryPreviewLimit
        let direct = try await AgentPicksService.fetchGradedParlayHistory(agentId: agentId, limit: limit)
        if !direct.isEmpty { return direct }
        return try await loadParlayHistoryPage(limit: limit)
    }

    private func loadParlayHistoryPreviewPreferringAuthorizedPage() async throws -> [AgentParlay] {
        let limit = Self.pickHistoryPreviewLimit
        let paged = try await loadParlayHistoryPage(limit: limit)
        if !paged.isEmpty { return paged }
        return try await AgentPicksService.fetchGradedParlayHistory(agentId: agentId, limit: limit)
    }

    private func loadAllParlaysPreferringDirectRead() async throws -> [AgentParlay] {
        let direct = try await AgentPicksService.fetchParlays(agentId: agentId)
        if !direct.isEmpty { return direct }
        return try await loadParlaysViaAuthorizedPage()
    }

    private func loadAllParlaysPreferringAuthorizedPage() async throws -> [AgentParlay] {
        let paged = try await loadParlaysViaAuthorizedPage()
        if !paged.isEmpty { return paged }
        return try await AgentPicksService.fetchParlays(agentId: agentId)
    }

    private func loadParlayHistoryPage(limit: Int) async throws -> [AgentParlay] {
        let todayStr = Self.localDateString(Date())
        return Array(
            try await loadParlaysViaAuthorizedPage()
                .filter { Self.isParlayHistoryEligible($0, todayStr: todayStr) }
                .prefix(limit)
        )
    }

    /// The picks-page RPC carries parlays on the FIRST page only (tickets are
    /// few — they don't join the pick cursor), so one uncursored fetch is the
    /// complete set.
    private func loadParlaysViaAuthorizedPage() async throws -> [AgentParlay] {
        let page = try await AgentPicksService.fetchPicksPage(
            agentId: agentId,
            filter: "all",
            pageSize: 50,
            cursor: nil,
            includeOverlap: false
        )
        return page.parlays
    }

    // MARK: - Mutations

    /// Result of watching a Trigger.dev run through to a terminal status.
    private enum TriggerPollOutcome {
        case succeeded
        case failed(String)
        /// Never observed a terminal Trigger.dev status within budget.
        case timedOutWaiting
    }

    /// Trigger a fresh generation run. Sets `isGenerating` while the edge
    /// function executes; the view shows ThinkingAnimation during that time.
    /// On success, the snapshot is refreshed so today's picks appear.
    /// If the snapshot reports a run in flight (user left the page mid-run and
    /// came back), flip into the generating state and ride the EXISTING run to
    /// completion instead of leaving the page idle — an idle page invites a
    /// second trigger that would race the live run. Call after snapshot loads.
    public func resumeActiveGenerationIfNeeded() async {
        guard !isGenerating,
              let active = activeGenerationRun,
              let runId = active.triggerRunId
        else { return }
        isGenerating = true
        lastGenerationError = nil
        liveRunState = nil
        defer {
            isGenerating = false
            liveRunState = nil
        }
        // priorRunId: the last SUCCEEDED run — completion is detected by a new
        // succeeded id appearing, exactly like a fresh trigger.
        let priorRunId = todaysGenerationRun?.id
        let outcome = await pollTriggerRunUntilComplete(runId: runId, priorRunId: priorRunId)
        switch outcome {
        case .succeeded:
            await pollUntilGenerationCompletes(priorRunId: priorRunId)
        case .failed(let reason):
            lastGenerationError = reason
        case .timedOutWaiting:
            if let snap = try? await AgentPicksService.fetchDetailSnapshot(agentId: agentId) {
                self.snapshot = snap
            }
        }
        await loadHistory(isOwner: true)
        await loadPerformancePicks(isOwner: true)
        switch outcome {
        case .succeeded: await notifyGenerationFinished(succeeded: true)
        case .failed(let reason): await notifyGenerationFinished(succeeded: false, note: reason)
        case .timedOutWaiting: break // uncertain — don't claim an outcome
        }
    }

    /// Local "run finished" banner — only shows when the app is backgrounded
    /// (the service gates on application state), so the on-screen live card
    /// never doubles up with a notification.
    private func notifyGenerationFinished(succeeded: Bool, note: String? = nil) async {
        let name = snapshot?.agent?.name ?? "Your agent"
        await NotificationService.shared.postGenerationFinishedNotification(
            agentId: agentId,
            agentName: name,
            picksGenerated: todaysGenerationRun?.picksGenerated ?? todaysPicks.count,
            parlaysGenerated: todaysParlays.count,
            succeeded: succeeded,
            note: note ?? todaysGenerationRun?.slateNote
        )
    }

    @discardableResult
    public func generatePicks() async -> Bool {
        guard !isGenerating else { return false }
        // A run is already live (e.g. re-entered the page mid-run) — join it
        // rather than triggering a duplicate. The server coalesces too; this
        // just keeps the UI on the existing run without a round-trip.
        if activeGenerationRun?.triggerRunId != nil {
            await resumeActiveGenerationIfNeeded()
            return lastGenerationError == nil
        }
        isGenerating = true
        lastGenerationError = nil
        liveRunState = nil
        defer {
            isGenerating = false
            liveRunState = nil
        }
        do {
            // This client is V3-only: generation always runs on the Trigger.dev
            // agentic engine. `model`/`dryRun` are DEBUG tuning knobs (Secret
            // Settings); defaults are used when unset.
            let v3 = AgentV3SettingsStore()
            // Generation runs ASYNC on the server (enqueue → Trigger.dev queue →
            // worker, ~2 min for deepseek). Capture the current run id so we can
            // poll until a NEW completed run lands — otherwise the spinner would
            // clear in ~1s and the user sees nothing.
            let priorRunId = todaysGenerationRun?.id
            let trigger = try await AgentPicksService.requestTriggerV3Generation(
                agentId: agentId,
                dryRun: v3.dryRun,
                modelName: v3.model
            )
            #if DEBUG
            NSLog("%@", "[V3Gen] triggered runId=\(trigger.runId ?? "nil")")
            #endif
            let outcome: TriggerPollOutcome
            if let runId = trigger.runId {
                outcome = await pollTriggerRunUntilComplete(runId: runId, priorRunId: priorRunId)
            } else {
                outcome = .succeeded
            }
            switch outcome {
            case .succeeded:
                // The ledger only surfaces `status='succeeded'` runs, so this is
                // still needed to pick up the freshly-written picks/no-picks note.
                await pollUntilGenerationCompletes(priorRunId: priorRunId)
                await loadHistory(isOwner: true)
                await loadPerformancePicks(isOwner: true)
                await notifyGenerationFinished(succeeded: true)
                return true
            case .failed(let reason):
                // A failed run's ledger row never flips to 'succeeded', so
                // pollUntilGenerationCompletes would just burn its full 4-minute
                // budget for nothing — surface the failure immediately instead.
                lastGenerationError = reason
                await loadHistory(isOwner: true)
                await loadPerformancePicks(isOwner: true)
                await notifyGenerationFinished(succeeded: false, note: reason)
                return false
            case .timedOutWaiting:
                // Never saw a terminal Trigger.dev status within budget. Do one
                // quiet snapshot check in case it actually finished right at the
                // edge, then give up rather than blocking on a second long poll.
                if let snap = try? await AgentPicksService.fetchDetailSnapshot(agentId: agentId) {
                    self.snapshot = snap
                }
                await loadHistory(isOwner: true)
                await loadPerformancePicks(isOwner: true)
                guard todaysGenerationRun?.id != priorRunId else {
                    lastGenerationError = "This is taking longer than usual — check back in a few minutes for your picks."
                    return false
                }
                return true
            }
        } catch {
            lastGenerationError = Self.message(from: error)
            return false
        }
    }

    /// Poll the run's live status + metadata (via the `trigger-run-status` edge
    /// function, which uses the Trigger secret key server-side) until it reaches
    /// a terminal status or the budget runs out.
    private func pollTriggerRunUntilComplete(runId: String, priorRunId: String?) async -> TriggerPollOutcome {
        let maxAttempts = 440 // ~11 min at 1.5s; task maxDuration is 600s
        let intervalNanos: UInt64 = 1_500_000_000
        for attempt in 0..<maxAttempts {
            if Task.isCancelled { return .timedOutWaiting }
            do {
                let state = try await TriggerRunStatusService.fetch(runId: runId)
                liveRunState = state
                #if DEBUG
                let m = state.metadata
                NSLog("%@", "[V3Poll] #\(attempt) status=\(state.status) turn=\(m.turn ?? -1)/\(m.maxTurns ?? -1) tools=\(m.toolCalls ?? -1) picks=\(m.picksAccepted ?? -1)")
                #endif
                if state.isTerminal {
                    if state.isSuccessful { return .succeeded }
                    return .failed(state.metadata.note ?? "Generation failed (\(state.status)). Please try again.")
                }
            } catch {
                // Surface the failure (the poll used to swallow it silently, which
                // hid that the direct-to-Trigger fetch was 401'ing).
                #if DEBUG
                NSLog("%@", "[V3Poll] #\(attempt) fetch FAILED: \(error)")
                #endif
            }
            try? await Task.sleep(nanoseconds: intervalNanos)
        }
        return .timedOutWaiting
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

    /// Persist just the autopilot schedule (partial `update_agent`). Used by the
    /// AutoPilot bottom sheet on the detail page so the user can retime autopilot
    /// without opening full Settings. Refreshes the snapshot on success.
    @discardableResult
    public func setAutoGenerateTime(_ time: String, timezone: String) async -> Bool {
        await saveSettings(payload: [
            "auto_generate_time": AnyEncodable(time),
            "auto_generate_timezone": AnyEncodable(timezone)
        ])
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
