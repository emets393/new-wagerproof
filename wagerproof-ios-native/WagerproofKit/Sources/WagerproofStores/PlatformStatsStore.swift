import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Holds the whole-population agent distribution rows for the Agents "Platform
/// Statistics" screen. Mirrors `LeaderboardStore`'s shape (LoadState + refresh +
/// debugSet), but deliberately owns NO filter state: the screen's controls
/// (metric / sport / threshold / bin width) are pure view `@State` because they
/// re-bucket the already-loaded rows in memory and never trigger a refetch. This
/// store just fetches the raw set once and exposes cache freshness.
@Observable
@MainActor
public final class PlatformStatsStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var data: [AgentStatDatum] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var lastRefreshedAt: Date?

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }

    public var lastError: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }

    /// Most recent `last_calculated_at` across all rows — drives the "Updated …"
    /// freshness label (parsed from the ISO strings the RPC returns).
    public var lastCalculatedAt: Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        return data.compactMap { row -> Date? in
            guard let s = row.lastCalculatedAt else { return nil }
            return formatter.date(from: s) ?? plain.date(from: s)
        }.max()
    }

    public init() {}

    /// First-load / pull-to-refresh. Fetches the broad set (min 1 settled pick);
    /// the interactive ≥N threshold is applied client-side by the view.
    public func refresh() async {
        loadState = .loading
        do {
            self.data = try await PlatformStatsService.fetchAgentDistribution(minDecided: 1)
            self.loadState = .loaded
            self.lastRefreshedAt = Date()
        } catch {
            self.loadState = .failed((error as NSError).localizedDescription)
        }
    }

    #if DEBUG
    public func debugSet(data: [AgentStatDatum], state: LoadState = .loaded) {
        self.data = data
        self.loadState = state
        self.lastRefreshedAt = state == .loaded ? Date() : nil
    }
    #endif
}
