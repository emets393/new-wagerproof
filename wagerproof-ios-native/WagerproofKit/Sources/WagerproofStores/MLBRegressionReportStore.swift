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
        loading = true
        errorMessage = nil
        let today = MLBRegressionReportStore.todayInET()
        do {
            let cfb = await CFBSupabase.shared.client
            // `maybeSingle()`: returns null instead of throwing when no row.
            let row: MLBRegressionReport? = try? await cfb
                .from("mlb_regression_report")
                .select()
                .eq("report_date", value: today)
                .limit(1)
                .single()
                .execute()
                .value
            self.report = row
            self.lastFetchedKey = today
            self.lastFetched = Date()
        } catch {
            errorMessage = "Failed to load regression report."
        }
        loading = false
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
