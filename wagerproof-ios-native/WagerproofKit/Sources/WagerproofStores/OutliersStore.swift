import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// `OutliersStore` mirrors the RN `OutliersScreen`'s React-Query trio:
///   - `useQuery(['week-games'], fetchWeekGames)`
///   - `useQuery(['value-alerts'], fetchValueAlerts)`
///   - `useQuery(['fade-alerts'], fetchFadeAlerts)`
///
/// Refresh is parallel — pulling week games first, then fanning out the two
/// alert queries (which both depend on the week-games result). This matches
/// RN's `enabled: !!weekGames && weekGames.length > 0` gate.
///
/// The trend/accuracy sections (NBA / NCAAB / MLB) have their own stores —
/// see `NBABettingTrendsStore` etc. (deferred; tracked by waivers).
@Observable
@MainActor
public final class OutliersStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public enum InnerTab: String, CaseIterable, Hashable, Sendable {
        case outliers
        case agentPicks
        case leaderboard

        public var label: String {
            switch self {
            case .outliers: return "Outliers"
            case .agentPicks: return "Top Agent Picks"
            case .leaderboard: return "Leaderboard"
            }
        }
    }

    /// Hub categories. The situational-trends / F5 / pitcher-matchup tool
    /// categories retired when those datasets became per-matchup insight
    /// widgets on the game detail sheets (and search chips).
    public enum Category: String, Hashable, Sendable {
        case value
        case fade
        case nbaAccuracy = "nba-accuracy"
        case ncaabAccuracy = "ncaab-accuracy"
        case mlbRegression = "mlb-regression"
        case mlbHistoricalAnalysis = "mlb-historical-analysis"
        case nflHistoricalAnalysis = "nfl-historical-analysis"
        case cfbHistoricalAnalysis = "cfb-historical-analysis"

        public var displayName: String {
            switch self {
            case .value: return "Prediction Market Alerts"
            case .fade: return "Model Fade Alerts"
            case .nbaAccuracy: return "NBA Model Accuracy"
            case .ncaabAccuracy: return "NCAAB Model Accuracy"
            case .mlbRegression: return "MLB Regression Report"
            case .mlbHistoricalAnalysis: return "MLB Historical Trends"
            case .nflHistoricalAnalysis: return "NFL Historical Trends"
            case .cfbHistoricalAnalysis: return "CFB Historical Trends"
            }
        }
    }

    // MARK: - Observable state

    public private(set) var weekGames: [OutlierGame] = []
    public private(set) var valueAlerts: [OutlierValueAlert] = []
    public private(set) var fadeAlerts: [OutlierFadeAlert] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var lastRefreshedAt: Date?

    /// Inner-tab selection. Mirrors RN `activeTab`.
    public var activeTab: InnerTab = .outliers

    /// Sport filter on value-alerts detail view.
    public var valueAlertsSportFilter: SportLeague? = nil
    /// Sport filter on fade-alerts detail view.
    public var fadeAlertsSportFilter: SportLeague? = nil
    /// Loading-spinner overlay key. Set when the user taps a card.
    public var loadingGameId: String? = nil

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }
    public var lastError: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }

    public init() {}

    // MARK: - Lifecycle

    /// Pull-to-refresh / first-load entry point. Re-runs the whole pipeline.
    // FIDELITY-WAIVER #062: After every successful refresh, RN's outliers.tsx
    // calls wagerBotSuggestionStore.setOutliersData(valueAlerts, fadeAlerts)
    // and onPageChange('outliers'). The suggestion store lands in B17 (Chat);
    // those calls wire in once it exists.
    public func refresh() async {
        loadState = .loading
        do {
            let games = try await OutliersService.shared.fetchWeekGames()
            // Fan out the two alert queries — they only need the week games.
            async let values = OutliersService.shared.fetchValueAlerts(weekGames: games)
            async let fades = OutliersService.shared.fetchFadeAlerts(weekGames: games)
            let (v, f) = await (values, fades)
            self.weekGames = games
            self.valueAlerts = v
            self.fadeAlerts = f
            self.loadState = .loaded
            self.lastRefreshedAt = Date()
        } catch {
            self.loadState = .failed(error.localizedDescription)
        }
    }

    // MARK: - Selectors
    //
    // Mirrors RN's `filterBySport` + `isGameUpcoming` predicates.

    /// Filtered + game-time-upcoming value alerts. Used by both hub and
    /// detail views.
    public var filteredValueAlerts: [OutlierValueAlert] {
        let filtered = valueAlertsSportFilter.map { sport in
            valueAlerts.filter { $0.sport == sport }
        } ?? valueAlerts
        return filtered.filter { Self.isUpcoming($0.game.gameTime) }
    }

    public var filteredFadeAlerts: [OutlierFadeAlert] {
        let filtered = fadeAlertsSportFilter.map { sport in
            fadeAlerts.filter { $0.sport == sport }
        } ?? fadeAlerts
        return filtered.filter { Self.isUpcoming($0.game.gameTime) }
    }

    /// Per-sport counts for the filter pills (renders "NFL (3)" labels).
    public func valueAlertsCount(by sport: SportLeague) -> Int {
        valueAlerts.filter { $0.sport == sport && Self.isUpcoming($0.game.gameTime) }.count
    }
    public func fadeAlertsCount(by sport: SportLeague) -> Int {
        fadeAlerts.filter { $0.sport == sport && Self.isUpcoming($0.game.gameTime) }.count
    }

    private static func isUpcoming(_ gameTime: String?) -> Bool {
        guard let raw = gameTime else { return true } // No time info → keep.
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return d > Date() }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d > Date() }
        // Bare date string — give it the benefit of the doubt.
        return true
    }

    // MARK: - Debug helpers (screenshot harness)

    #if DEBUG
    public func debugSet(
        weekGames: [OutlierGame] = [],
        valueAlerts: [OutlierValueAlert] = [],
        fadeAlerts: [OutlierFadeAlert] = [],
        state: LoadState = .loaded
    ) {
        self.weekGames = weekGames
        self.valueAlerts = valueAlerts
        self.fadeAlerts = fadeAlerts
        self.loadState = state
        self.lastRefreshedAt = state == .loaded ? Date() : nil
    }
    #endif
}
