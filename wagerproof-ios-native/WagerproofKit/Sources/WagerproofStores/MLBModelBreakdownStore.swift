import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Loads `mlb_model_breakdown_accuracy` (refreshed nightly server-side):
/// model record/ROI per bet type split by team and by day-of-week. Mirrors
/// RN `hooks/useMLBModelBreakdownAccuracy.ts`. Feeds both the breakdown
/// tables and the per-pick alignment boxes on the regression report.
@Observable
@MainActor
public final class MLBModelBreakdownStore {
    public private(set) var rows: [MLBModelBreakdownRow] = []
    public private(set) var loading: Bool = false
    public private(set) var errorMessage: String?
    public private(set) var lastFetched: Date?

    /// 15-minute stale window — matches RN `staleTime: 15 * 60 * 1000`.
    private let staleWindow: TimeInterval = 15 * 60

    public init() {}

    public func refreshIfStale(force: Bool = false) async {
        if !force, let last = lastFetched, Date().timeIntervalSince(last) < staleWindow {
            return
        }
        await refresh()
    }

    public func refresh() async {
        loading = true
        errorMessage = nil
        do {
            let cfb = await CFBSupabase.shared.client
            let fetched: [MLBModelBreakdownRow] = try await cfb
                .from("mlb_model_breakdown_accuracy")
                .select("bet_type, breakdown_type, breakdown_value, games, wins, losses, pushes, units_won, win_pct, roi_pct")
                .execute()
                .value
            self.rows = fetched
            self.lastFetched = Date()
        } catch {
            errorMessage = "Failed to load model breakdown."
        }
        loading = false
    }

    /// "By Team" rows for a bet type, ranked best ROI first (RN parity).
    public func teamRows(betType: String) -> [MLBModelBreakdownRow] {
        rows.filter { $0.betType == betType && $0.breakdownType == "team" }
            .sorted { $0.roiPct > $1.roiPct }
    }

    /// "By Day of Week" rows for a bet type, Mon..Sun (RN parity).
    public func dowRows(betType: String) -> [MLBModelBreakdownRow] {
        let order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return rows.filter { $0.betType == betType && $0.breakdownType == "dow" }
            .sorted { (order.firstIndex(of: $0.breakdownValue) ?? 7) < (order.firstIndex(of: $1.breakdownValue) ?? 7) }
    }

    #if DEBUG
    public func debugSet(rows: [MLBModelBreakdownRow]) {
        self.rows = rows
        self.lastFetched = Date()
    }
    #endif
}
