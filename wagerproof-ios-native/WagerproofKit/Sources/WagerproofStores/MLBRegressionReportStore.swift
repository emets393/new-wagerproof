import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Loads + caches the daily `mlb_regression_report` row. Mirrors RN
/// `hooks/useMLBRegressionReport.ts`. One row per day in ET timezone;
/// we re-key the cache by the current ET date.
@Observable
@MainActor
public final class MLBRegressionReportStore {
    public private(set) var report: MLBRegressionReport?
    public private(set) var loading: Bool = false
    public private(set) var errorMessage: String?
    public private(set) var lastFetchedKey: String?

    /// 5-minute stale window — matches RN `staleTime: 5 * 60 * 1000`.
    private let staleWindow: TimeInterval = 5 * 60
    private var lastFetched: Date?
    /// Coalesces overlapping `.task` / pull-to-refresh / toolbar refresh calls.
    private var inFlightRefresh: Task<Void, Never>?

    // Not observed: the MLB game sheet reads `suggestedPicks(for:)` from a view
    // body, and mutating observed state during view update is illegal. Views
    // still invalidate off `report`, which IS observed. (Precedent:
    // `ParlayGodStore.gameTicketCache`.)
    //
    // INVALIDATION KEY: the report row — rebuilt in `setReport`, the single
    // funnel through which `report` is ever assigned.
    @ObservationIgnored private var picksByGame: [Int: [MLBSuggestedPick]] = [:]

    public init() {}

    /// The only place `report` is assigned. Groups the whole day's suggested
    /// picks by `game_pk` once instead of filtering the slate per body pass.
    private func setReport(_ new: MLBRegressionReport?) {
        report = new
        picksByGame = Dictionary(grouping: new?.suggestedPicks ?? [], by: { $0.gamePk })
    }

    public static func todayInET() -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    public func refreshIfStale(force: Bool = false) async {
        let today = MLBRegressionReportStore.todayInET()
        if !force, lastFetchedKey == today,
           let last = lastFetched,
           Date().timeIntervalSince(last) < staleWindow {
            return
        }
        await refresh()
    }

    public func refresh() async {
        if let inFlightRefresh {
            await inFlightRefresh.value
            return
        }
        let task = Task { @MainActor in
            await performRefresh()
        }
        inFlightRefresh = task
        await task.value
        inFlightRefresh = nil
    }

    private func performRefresh() async {
        loading = true
        errorMessage = nil
        defer { loading = false }
        let today = MLBRegressionReportStore.todayInET()
        do {
            try Task.checkCancellation()
            let cfb = await CFBSupabase.shared.client
            // RN uses `maybeSingle()` — fetch as an array and take the first
            // row so a missing report returns nil instead of throwing.
            let rows: [MLBRegressionReport] = try await cfb
                .from("mlb_regression_report")
                .select()
                .eq("report_date", value: today)
                .limit(1)
                .execute()
                .value
            try Task.checkCancellation()
            setReport(rows.first)
            self.lastFetchedKey = today
            self.lastFetched = Date()
            self.errorMessage = nil
        } catch is CancellationError {
            // SwiftUI `.task` cancellation — keep any cached report/error state.
            return
        } catch {
            // Preserve a previously loaded report (matches MLBBucketAccuracyStore
            // and friends) so a stale-window re-fetch or cancelled overlap
            // doesn't wipe a good payload.
            if report == nil {
                errorMessage = "Failed to load regression report."
            }
        }
    }

    /// Picks generated for the given `game_pk`. Mirrors the
    /// `MLBRegressionPicksSection` filter in RN.
    public func suggestedPicks(for gamePk: Int) -> [MLBSuggestedPick] {
        picksByGame[gamePk] ?? []
    }

    #if DEBUG
    public func debugSet(report: MLBRegressionReport) {
        setReport(report)
        self.lastFetchedKey = MLBRegressionReportStore.todayInET()
        self.lastFetched = Date()
    }
    #endif
}
