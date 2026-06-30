import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Best Picks Report state — today's locked picks + graded performance archive.
/// Mirrors web `/mlb/picks-report` + `/mlb/picks-performance`.
@Observable
@MainActor
public final class MLBPlayerPropPicksStore {
    public enum LoadState: Equatable, Sendable {
        case idle, loading, loaded, failed(String)
    }

    public private(set) var todaysPicks: [MLBPlayerPropBestPick] = []
    public private(set) var summary: [MLBPlayerPropGradeSummary] = []
    public private(set) var history: [MLBPlayerPropGrade] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var lastFetched: Date?

    private let service: MLBPlayerPropPicksService
    private let cacheTTL: TimeInterval = 5 * 60

    public init(service: MLBPlayerPropPicksService = .shared) {
        self.service = service
    }

    public var overall: MLBPlayerPropPerformanceTotals {
        MLBPlayerPropPerformanceTotals.aggregate(summary)
    }

    public var tierGroups: [MLBPlayerPropTierSummary] {
        let order = MLBPlayerPropPickTier.allCases
        var map: [MLBPlayerPropPickTier: [MLBPlayerPropGradeSummary]] = [:]
        for row in summary {
            map[row.tier, default: []].append(row)
        }
        return order.compactMap { tier in
            guard let rows = map[tier], !rows.isEmpty else { return nil }
            let sorted = rows.sorted { ($0.unitsWon ?? 0) > ($1.unitsWon ?? 0) }
            return MLBPlayerPropTierSummary(
                tier: tier,
                totals: MLBPlayerPropPerformanceTotals.aggregate(sorted),
                markets: sorted
            )
        }
    }

    public var batterPicks: [MLBPlayerPropBestPick] {
        todaysPicks.filter { $0.kind == .batter }
    }

    public var pitcherPicks: [MLBPlayerPropBestPick] {
        todaysPicks.filter { $0.kind == .pitcher }
    }

    /// Most recent graded picks (newest first, capped at 10).
    public var recentHistory: [MLBPlayerPropGrade] {
        Array(history.prefix(10))
    }

    public func refreshIfStale(force: Bool = false) async {
        if !force,
           let last = lastFetched,
           Date().timeIntervalSince(last) < cacheTTL,
           loadState == .loaded {
            return
        }
        await refresh(force: force)
    }

    public func refreshSummaryOnly(force: Bool = false) async {
        if !force,
           let last = lastFetched,
           Date().timeIntervalSince(last) < cacheTTL,
           !summary.isEmpty {
            return
        }
        do {
            summary = try await service.fetchGradeSummary()
            lastFetched = Date()
        } catch {
            // Non-fatal for the banner — full page shows errors.
        }
    }

    public func refresh(force: Bool = false) async {
        if !force,
           let last = lastFetched,
           Date().timeIntervalSince(last) < cacheTTL,
           loadState == .loaded {
            return
        }
        loadState = .loading
        let reportDate = MLBPlayerPropPicksService.todayET()
        do {
            async let picksTask = service.fetchTodaysPicks(reportDate: reportDate)
            async let summaryTask = service.fetchGradeSummary()
            async let historyTask = service.fetchGradeHistory(limit: 10)
            let (picks, summaryRows, historyRows) = try await (picksTask, summaryTask, historyTask)
            todaysPicks = picks.sorted {
                if $0.tier.sortRank != $1.tier.sortRank { return $0.tier.sortRank < $1.tier.sortRank }
                return $0.score > $1.score
            }
            summary = summaryRows
            history = historyRows
            lastFetched = Date()
            loadState = .loaded
        } catch {
            loadState = .failed("Couldn't load Best Picks data.")
        }
    }

    #if DEBUG
    public func debugSet(
        picks: [MLBPlayerPropBestPick],
        summary: [MLBPlayerPropGradeSummary],
        history: [MLBPlayerPropGrade]
    ) {
        todaysPicks = picks
        self.summary = summary
        self.history = history
        loadState = .loaded
        lastFetched = Date()
    }
    #endif
}
