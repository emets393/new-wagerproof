import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Observable state for the Historical Analysis screen — debounced refetch,
/// dim-during-refetch (never unmount results on filter change).
@Observable
@MainActor
public final class HistoricalAnalysisStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public let sport: HistoricalAnalysisSport

    public var snapshot: HistoricalAnalysisUISnapshot
    public private(set) var analysis: HistoricalAnalysisResponse?
    public private(set) var upcoming: [HistoricalAnalysisUpcomingGame] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var isRefetching = false
    public private(set) var hasLoadedOnce = false

    public private(set) var coaches: [String] = []
    public private(set) var referees: [String] = []
    public private(set) var conferences: [String] = []
    public private(set) var conferenceTeamMap: [String: [String]] = [:]
    public private(set) var cfbLogos: [String: String] = [:]

    public private(set) var savedFilters: [HistoricalAnalysisSavedFilter] = []

    private var debounceTask: Task<Void, Never>?
    private let debounceNanos: UInt64 = 350_000_000

    public init(sport: HistoricalAnalysisSport) {
        self.sport = sport
        self.snapshot = .defaults(for: sport)
    }

    public var betType: String {
        get { snapshot.betType }
        set {
            snapshot.betType = newValue
            clampSeasonForBetType()
            resetLineControlsForBetType()
            scheduleFetch()
        }
    }

    public var seasonFloor: Int {
        HistoricalAnalysisFilterBuilder.seasonFloor(betType: betType, sport: sport)
    }

    public var isLimitedHistory: Bool {
        HistoricalAnalysisBetType.limitedHistory.contains(betType)
    }

    public func onAppear() async {
        await loadBootstrap()
        await refreshSaved(userId: nil)
        await fetchNow()
    }

    public func refreshSaved(userId: UUID?) async {
        guard let userId else {
            savedFilters = []
            return
        }
        do {
            savedFilters = try await HistoricalAnalysisSavedFiltersService.fetch(sport: sport, userId: userId)
        } catch {
            savedFilters = []
        }
    }

    public func saveCurrentFilter(name: String, userId: UUID) async throws {
        try await HistoricalAnalysisSavedFiltersService.save(
            sport: sport,
            userId: userId,
            name: name,
            betType: betType,
            snapshot: snapshot
        )
        await refreshSaved(userId: userId)
    }

    public func deleteSavedFilter(id: UUID, userId: UUID) async {
        try? await HistoricalAnalysisSavedFiltersService.delete(sport: sport, id: id)
        await refreshSaved(userId: userId)
    }

    public func restoreSaved(_ filter: HistoricalAnalysisSavedFilter) {
        var restored = filter.filters
        if restored.selectedConferences.isEmpty, restored.conference != "any" {
            restored.selectedConferences = [restored.conference]
            restored.conference = "any"
        }
        snapshot = restored
        clampSeasonForBetType()
        scheduleFetch()
    }

    public func resetAllFilters() {
        snapshot = .defaults(for: sport)
        snapshot.betType = betType
        resetLineControlsForBetType()
        scheduleFetch()
    }

    /// Replace the filter snapshot in one assignment so `@Observable` always
    /// notices changes (in-place struct field writes can be missed).
    public func updateSnapshot(_ block: (inout HistoricalAnalysisUISnapshot) -> Void) {
        var next = snapshot
        block(&next)
        snapshot = next
    }

    public func scheduleFetch() {
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            guard let self else { return }
            try? await Task.sleep(nanoseconds: debounceNanos)
            guard !Task.isCancelled else { return }
            await self.fetchNow()
        }
    }

    public func fetchNow() async {
        if hasLoadedOnce {
            isRefetching = true
        } else {
            loadState = .loading
        }

        let filters = HistoricalAnalysisFilterBuilder.buildRPCFilters(
            sport: sport,
            snapshot: snapshot,
            conferenceTeamMap: conferenceTeamMap
        )
        do {
            async let analysisTask = HistoricalAnalysisService.shared.fetchAnalysis(
                sport: sport, betType: betType, filters: filters
            )
            async let upcomingTask = HistoricalAnalysisService.shared.fetchUpcoming(
                sport: sport, betType: betType, filters: filters
            )
            let (a, u) = try await (analysisTask, upcomingTask)
            analysis = a
            upcoming = u
            loadState = .loaded
            hasLoadedOnce = true
        } catch {
            if !hasLoadedOnce {
                loadState = .failed(error.localizedDescription)
            }
        }
        isRefetching = false
    }

    private func loadBootstrap() async {
        do {
            let boot = try await HistoricalAnalysisService.shared.fetchBootstrap(sport: sport)
            switch sport {
            case .nfl:
                coaches = (boot.byCoach ?? []).map(\.label).filter { $0 != "—" }.sorted()
                referees = (boot.byReferee ?? []).map(\.label).filter { $0 != "—" }.sorted()
            case .cfb:
                conferences = (boot.byConference ?? []).compactMap(\.conference).filter { !$0.isEmpty }.sorted()
                conferenceTeamMap = (try? await HistoricalAnalysisService.shared.fetchConferenceTeamMap()) ?? [:]
                cfbLogos = (try? await HistoricalAnalysisService.shared.fetchCFBLogos()) ?? [:]
            }
        } catch {
            // Non-fatal — filter dropdowns stay empty.
        }
    }

    private func clampSeasonForBetType() {
        let floor = seasonFloor
        if snapshot.seasonMin < floor { snapshot.seasonMin = floor }
    }

    private func resetLineControlsForBetType() {
        let floor = seasonFloor
        if snapshot.seasonMin < floor { snapshot.seasonMin = floor }
        switch sport {
        case .nfl:
            snapshot.spreadMax = betType == "h1_spread" ? 14 : 20
            switch betType {
            case "fg_total": snapshot.lineMin = 30; snapshot.lineMax = 60
            case "h1_total": snapshot.lineMin = 15; snapshot.lineMax = 35
            case "team_total": snapshot.lineMin = 10; snapshot.lineMax = 40
            default: break
            }
        case .cfb:
            snapshot.spreadMax = betType == "h1_spread" ? 18 : 28
            switch betType {
            case "fg_total": snapshot.lineMin = 30; snapshot.lineMax = 80
            case "h1_total": snapshot.lineMin = 15; snapshot.lineMax = 45
            case "team_total": snapshot.lineMin = 10; snapshot.lineMax = 55
            default: break
            }
        }
    }
}
