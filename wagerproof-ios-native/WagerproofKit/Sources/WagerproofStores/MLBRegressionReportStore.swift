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

    public init() {}

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
            self.report = rows.first
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
        (report?.suggestedPicks ?? []).filter { $0.gamePk == gamePk }
    }

    #if DEBUG
    public func debugSet(report: MLBRegressionReport) {
        self.report = report
        self.lastFetchedKey = MLBRegressionReportStore.todayInET()
        self.lastFetched = Date()
    }
    #endif
}
