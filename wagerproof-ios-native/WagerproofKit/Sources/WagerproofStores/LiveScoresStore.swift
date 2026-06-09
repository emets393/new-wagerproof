import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// `LiveScoresStore` mirrors the RN `useLiveScores` hook + the surrounding
/// `setInterval(fetchGames, 2 * 60 * 1000)` polling pattern. Lives at the
/// tab-shell level so the scoreboard tab and the floating WagerBot
/// assistant share one source of truth — re-mounting the tab does not
/// re-trigger a network fetch.
///
/// Pulls from `LiveScoresService.shared.getLiveScores()` every 120 seconds
/// while `start()` is active. `refresh()` is the manual entry point bound
/// to `.refreshable` in the scoreboard view.
@Observable
@MainActor
public final class LiveScoresStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Refresh cadence. Mirrors RN's hard-coded `2 * 60 * 1000` ms.
    public static let pollInterval: TimeInterval = 120

    public private(set) var games: [LiveGame] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var lastRefreshedAt: Date?

    public var hasLiveGames: Bool { !games.isEmpty }
    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }
    public var lastError: String? {
        if case .failed(let msg) = loadState { return msg }
        return nil
    }

    private var pollingTask: Task<Void, Never>?

    public init() {}

    /// Begin background polling. Safe to call multiple times (idempotent).
    /// Cancelled automatically on `stop()`.
    public func start() {
        guard pollingTask == nil else { return }
        pollingTask = Task { [weak self] in
            guard let self else { return }
            // Fire one immediate fetch on start so the UI populates fast.
            await self.refresh()
            while !Task.isCancelled {
                // FIDELITY-WAIVER #011: Polling fires unconditionally; network-state
                // gating (mirrors RN's useNetworkState check) lands in B22 hardening.
                // Sleep for the poll interval. Cancellation flows through
                // the throwing-Task.sleep API; we just exit on cancel.
                do {
                    try await Task.sleep(nanoseconds: UInt64(Self.pollInterval * 1_000_000_000))
                } catch {
                    return
                }
                await self.refresh()
            }
        }
    }

    public func stop() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    /// Manual refresh — wired to `.refreshable` in `ScoreboardView`. Swallows
    /// the LoadState `.failed` branch into `lastError` so the view can show
    /// an inline banner without throwing.
    public func refresh() async {
        loadState = .loading
        do {
            let next = try await LiveScoresService.shared.getLiveScores()
            games = next
            loadState = .loaded
            lastRefreshedAt = Date()
        } catch {
            // Keep stale games on screen if we have any — only show the
            // error banner; don't blank the board. Matches RN's
            // "try { ... } catch { setError(err) }" with prior games retained.
            loadState = .failed(error.localizedDescription)
        }
    }

    /// Filter helper used by the scoreboard's league grouping and by the
    /// WagerBot suggestion context for "any NBA games tonight?" lookups.
    public func byLeague(_ league: String) -> [LiveGame] {
        let upper = league.uppercased()
        return games.filter { $0.league.uppercased() == upper }
    }

    /// Group games by league, returning leagues sorted by the canonical
    /// LEAGUE_CONFIG.order (NFL → NCAAF → NBA → NCAAB → NHL → MLB → MLS → EPL).
    /// Mirrors RN's `gamesByLeague` reduce + `sortedLeagues` array build.
    public func groupedByLeague() -> [(league: String, games: [LiveGame])] {
        let grouped = Dictionary(grouping: games) { $0.league }
        return grouped
            .map { (league: $0.key, games: $0.value) }
            .sorted { Self.leagueOrder($0.league) < Self.leagueOrder($1.league) }
    }

    /// Canonical league ordering per RN `LEAGUE_CONFIG`. Unknown leagues
    /// fall back to 999 so they sort to the end.
    public static func leagueOrder(_ league: String) -> Int {
        switch league.uppercased() {
        case "NFL": return 1
        case "NCAAF", "CFB": return 2
        case "NBA": return 3
        case "NCAAB": return 4
        case "NHL": return 5
        case "MLB": return 6
        case "MLS": return 7
        case "EPL": return 8
        default: return 999
        }
    }

    // MARK: - Debug-only previews
    //
    // Used by `ScreenshotHarness` and SwiftUI Previews to drive the
    // empty / loaded / error states without standing up the real network.
    // Polling is intentionally NOT started in this mode so the previewed
    // state is stable for screenshot capture.

    #if DEBUG
    /// Inject preloaded games + a final load state for screenshot capture.
    /// Does not start the polling task; callers control the lifecycle.
    public func debugSet(games: [LiveGame], state: LoadState) {
        self.games = games
        self.loadState = state
        self.lastRefreshedAt = state == .loaded ? Date() : nil
    }
    #endif
}
