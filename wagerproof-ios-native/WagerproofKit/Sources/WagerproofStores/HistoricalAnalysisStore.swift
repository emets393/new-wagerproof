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
    /// Non-nil when the LAST refetch failed while stale results stayed on
    /// screen. Silently keeping old data made broken filters look like
    /// "filter did nothing" — surface it instead.
    public private(set) var fetchErrorMessage: String?

    public private(set) var coaches: [String] = []
    public private(set) var referees: [String] = []
    public private(set) var conferences: [String] = []
    public private(set) var conferenceTeamMap: [String: [String]] = [:]
    public private(set) var cfbLogos: [String: String] = [:]
    /// NFL / CFB / MLB team picker options — `(id, displayName)` where `id` is
    /// the warehouse key (NFL abbr, CFB school name, MLB abbr).
    public private(set) var teamOptions: [(id: String, name: String)] = []
    public private(set) var mlbTeams: [(abbr: String, name: String)] = []

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
        sport == .mlb ? false : HistoricalAnalysisBetType.limitedHistory.contains(betType)
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
        let keepBet = betType
        snapshot = .defaults(for: sport)
        snapshot.betType = keepBet
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
        let upcomingFilters: [String: JSONValue]
        if sport == .mlb, HistoricalAnalysisFilterBuilder.mlbFiltersWeatherOnly(filters) {
            upcomingFilters = [:]
        } else {
            upcomingFilters = filters
        }
        do {
            // Analysis first so the hero paints even if upcoming is slow / times out.
            // Starting both as async-let still contended the warehouse and blocked loadState.
            let a = try await HistoricalAnalysisService.shared.fetchAnalysis(
                sport: sport, betType: betType, filters: filters
            )
            analysis = a
            loadState = .loaded
            hasLoadedOnce = true
            isRefetching = false
            fetchErrorMessage = nil

            let u = (try? await HistoricalAnalysisService.shared.fetchUpcoming(
                sport: sport, betType: betType, filters: upcomingFilters
            )) ?? []
            upcoming = u
        } catch {
            if !hasLoadedOnce {
                loadState = .failed(error.localizedDescription)
            } else {
                fetchErrorMessage = "Couldn't refresh with these filters — results may be stale."
            }
            isRefetching = false
        }
    }

    private func loadBootstrap() async {
        do {
            switch sport {
            case .nfl:
                let boot = try await HistoricalAnalysisService.shared.fetchBootstrap(sport: sport)
                coaches = (boot.byCoach ?? []).map(\.label).filter { $0 != "—" }.sorted()
                referees = (boot.byReferee ?? []).map(\.label).filter { $0 != "—" }.sorted()
                await NFLTeamsService.shared.ensureLoaded()
                teamOptions = NFLTeamAssets.byAbbr.values
                    .map { (id: $0.abbr, name: $0.name) }
                    .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            case .cfb:
                let boot = try await HistoricalAnalysisService.shared.fetchBootstrap(sport: sport)
                conferences = (boot.byConference ?? []).compactMap(\.conference).filter { !$0.isEmpty }.sorted()
                conferenceTeamMap = (try? await HistoricalAnalysisService.shared.fetchConferenceTeamMap()) ?? [:]
                cfbLogos = (try? await HistoricalAnalysisService.shared.fetchCFBLogos()) ?? [:]
                teamOptions = Array(Set(conferenceTeamMap.values.flatMap { $0 }))
                    .sorted()
                    .map { (id: $0, name: $0) }
            case .mlb:
                mlbTeams = (try? await HistoricalAnalysisService.shared.fetchMLBTeamAbbrs()) ?? []
                teamOptions = mlbTeams.map { (id: $0.abbr, name: $0.name) }
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
            break
        case .cfb:
            break
        case .mlb:
            switch betType {
            case "total": snapshot.lineMin = 5; snapshot.lineMax = 14
            case "f5_total": snapshot.lineMin = 2; snapshot.lineMax = 8
            // Other markets use the FG-total range as a cross-market filter.
            // Reset so stale F5 bounds (2–8) don't leak in as total_max.
            default: snapshot.lineMin = 5; snapshot.lineMax = 14
            }
        }
    }
    
    // MARK: - B2: Symmetric Split Hero
    
    /// True when the current snapshot shows the forced ~50% scenario on a two-sided market
    public var shouldShowSymmetricSplit: Bool {
        guard sport == .nfl || sport == .cfb else { return false }
        return snapshot.isSideSymmetric(sport: sport)
    }
    
    /// Get the more extreme side from bars for symmetric split display
    public func getSymmetricSplitData() -> (extremeSide: HistoricalAnalysisBarOption, homeAway: [HistoricalAnalysisBarOption], favDog: [HistoricalAnalysisBarOption])? {
        guard let analysis = analysis,
              shouldShowSymmetricSplit else { return nil }
        
        var homeAway: [HistoricalAnalysisBarOption] = []
        var favDog: [HistoricalAnalysisBarOption] = []
        var allOptions: [HistoricalAnalysisBarOption] = []
        
        for bar in analysis.bars {
            if bar.dimension == "home_away" {
                homeAway = bar.options
                allOptions.append(contentsOf: bar.options)
            } else if bar.dimension == "fav_dog" {
                favDog = bar.options
                allOptions.append(contentsOf: bar.options)
            }
        }
        
        // Stronger cover rate wins. Complements are equally far from 50%, so abs-from-50
        // ties and would arbitrarily keep RPC order (often the <50% side).
        let extremeSide = allOptions.max { a, b in
            a.hitPct < b.hitPct
        }
        
        guard let extreme = extremeSide else { return nil }
        return (extreme, homeAway, favDog)
    }
    
    // MARK: - B4: NL Filter Chat
    
    public struct NLFilterChatState {
        public var isProcessing = false
        public var inputText = ""
        public var lastResponse: NLFilterResponse?
        public var transcript: [NLFilterExchange] = []
    }
    
    public struct NLFilterResponse {
        public let applied: [String]
        public let rejected: [String]
        public let couldntMap: [String]
        public let ambiguous: [String]
        public let noChange: Bool
        public let error: String?
        
        public var hasChanges: Bool {
            !applied.isEmpty || !rejected.isEmpty || !couldntMap.isEmpty || !ambiguous.isEmpty
        }
    }
    
    public struct NLFilterExchange {
        public let id = UUID()
        public let input: String
        public let response: NLFilterResponse
        public let timestamp = Date()
    }
    
    public var nlChatState = NLFilterChatState()

    /// Persisted per-sport recent chat queries — feeds the suggestion row
    /// above the bottom chat input across app launches.
    public private(set) var recentQueries: [String] = []
    private var recentQueriesKey: String { "ha_recent_queries_\(sport.rawValue)" }

    public func loadRecentQueries() {
        recentQueries = UserDefaults.standard.stringArray(forKey: recentQueriesKey) ?? []
    }

    private func rememberQuery(_ sentence: String) {
        var list = recentQueries.filter { $0.caseInsensitiveCompare(sentence) != .orderedSame }
        list.insert(sentence, at: 0)
        if list.count > 8 { list = Array(list.prefix(8)) }
        recentQueries = list
        UserDefaults.standard.set(list, forKey: recentQueriesKey)
    }

    public func submitNLFilterQuery(_ sentence: String, isAuthenticated: Bool) async {
        guard isAuthenticated, !sentence.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }
        
        nlChatState.isProcessing = true
        
        do {
            // Serialize current filter in web snapshot shape for RPC
            let currentFilter = serializeCurrentFilterForNL()
            
            let response = try await HistoricalAnalysisService.shared.submitNLFilterPatch(
                sentence: sentence,
                currentFilter: currentFilter,
                coaches: coaches,
                referees: referees,
                sport: sport
            )
            
            // Apply the returned snapshot if successful
            if let newSnapshot = response.snapshot {
                restoreNLFilterSnapshot(newSnapshot)
                scheduleFetch()
            }
            
            // Create response object - extract dimension strings from AppliedChange
            let appliedDimensions = response.applied?.map { $0.dimension } ?? []
            let nlResponse = NLFilterResponse(
                applied: appliedDimensions,
                rejected: response.rejected ?? [],
                couldntMap: response.couldntMap ?? [],
                ambiguous: response.ambiguous ?? [],
                noChange: response.noChange ?? false,
                error: nil
            )
            
            // Add to transcript
            let exchange = NLFilterExchange(
                input: sentence,
                response: nlResponse
            )
            nlChatState.transcript.append(exchange)
            nlChatState.lastResponse = nlResponse
            nlChatState.inputText = ""
            rememberQuery(sentence)
            
        } catch {
            let errorResponse = NLFilterResponse(
                applied: [],
                rejected: [],
                couldntMap: [],
                ambiguous: [],
                noChange: false,
                error: error.localizedDescription
            )
            nlChatState.lastResponse = errorResponse
        }
        
        nlChatState.isProcessing = false
    }
    
    private func serializeCurrentFilterForNL() -> [String: JSONValue] {
        // Convert current snapshot to web shape for NL service using JSONValue
        var dict: [String: JSONValue] = [
            "betType": .string(snapshot.betType)
        ]
        
        // Only include non-default values (compact filter)
        let defaults = HistoricalAnalysisUISnapshot.defaults(for: sport)
        
        if snapshot.seasonMin != defaults.seasonMin || snapshot.seasonMax != defaults.seasonMax {
            dict["seasons"] = .array([.int(snapshot.seasonMin), .int(snapshot.seasonMax)])
        }
        if snapshot.weekMin != defaults.weekMin || snapshot.weekMax != defaults.weekMax {
            dict["weeks"] = .array([.int(snapshot.weekMin), .int(snapshot.weekMax)])
        }
        if snapshot.side != defaults.side {
            dict["side"] = .string(snapshot.side)
        }
        if snapshot.seasonType != defaults.seasonType {
            dict["seasonType"] = .string(snapshot.seasonType)
        }
        if snapshot.playoffRound != defaults.playoffRound {
            dict["playoffRound"] = .string(snapshot.playoffRound)
        }
        if snapshot.favDog != defaults.favDog {
            dict["favDog"] = .string(snapshot.favDog)
        }
        if snapshot.spreadSide != defaults.spreadSide {
            dict["spreadSide"] = .string(snapshot.spreadSide)
        }
        if snapshot.spreadMin != defaults.spreadMin || snapshot.spreadMax != defaults.spreadMax {
            dict["spreadSize"] = .array([.double(snapshot.spreadMin), .double(snapshot.spreadMax)])
        }
        if sport == .mlb {
            // One iOS slider backs two canonical dims: F5 bounds (2–8) on the F5
            // total market, FG total bounds (5–14) on every other market.
            if snapshot.betType == "f5_total" {
                if snapshot.lineMin != 2 || snapshot.lineMax != 8 {
                    dict["f5TotalRange"] = .array([.double(snapshot.lineMin), .double(snapshot.lineMax)])
                }
            } else if snapshot.lineMin != 5 || snapshot.lineMax != 14 {
                dict["lineRange"] = .array([.double(snapshot.lineMin), .double(snapshot.lineMax)])
            }
        } else if snapshot.lineMin != defaults.lineMin || snapshot.lineMax != defaults.lineMax {
            dict["lineRange"] = .array([.double(snapshot.lineMin), .double(snapshot.lineMax)])
        }
        if !snapshot.mlMin.isEmpty { dict["mlMin"] = .string(snapshot.mlMin) }
        if !snapshot.mlMax.isEmpty { dict["mlMax"] = .string(snapshot.mlMax) }
        func putLineRange(_ key: String, _ min: Double, _ max: Double, _ defaultMin: Double, _ defaultMax: Double) {
            if min != defaultMin || max != defaultMax {
                dict[key] = .array([.double(min), .double(max)])
            }
        }
        if snapshot.h1SpreadSide != defaults.h1SpreadSide {
            dict["h1SpreadSide"] = .string(snapshot.h1SpreadSide)
        }
        putLineRange("h1SpreadSize", snapshot.h1SpreadMin, snapshot.h1SpreadMax, defaults.h1SpreadMin, defaults.h1SpreadMax)
        if !snapshot.h1MlMin.isEmpty { dict["h1MlMin"] = .string(snapshot.h1MlMin) }
        if !snapshot.h1MlMax.isEmpty { dict["h1MlMax"] = .string(snapshot.h1MlMax) }
        putLineRange("h1TotalRange", snapshot.h1TotalMin, snapshot.h1TotalMax, defaults.h1TotalMin, defaults.h1TotalMax)
        putLineRange("ttLineRange", snapshot.ttLineMin, snapshot.ttLineMax, defaults.ttLineMin, defaults.ttLineMax)
        if snapshot.oppSpreadSide != defaults.oppSpreadSide {
            dict["oppSpreadSide"] = .string(snapshot.oppSpreadSide)
        }
        putLineRange("oppSpreadSize", snapshot.oppSpreadMin, snapshot.oppSpreadMax, defaults.oppSpreadMin, defaults.oppSpreadMax)
        if !snapshot.oppMlMin.isEmpty { dict["oppMlMin"] = .string(snapshot.oppMlMin) }
        if !snapshot.oppMlMax.isEmpty { dict["oppMlMax"] = .string(snapshot.oppMlMax) }
        putLineRange("oppTtLineRange", snapshot.oppTtLineMin, snapshot.oppTtLineMax, defaults.oppTtLineMin, defaults.oppTtLineMax)
        if let primetime = snapshot.primetime { dict["primetime"] = .bool(primetime) }
        if let division = snapshot.division { dict["division"] = .bool(division) }
        if snapshot.dome != defaults.dome {
            // MLB canonical dome is a TRISTATE bool; football is an enum string.
            if sport == .mlb {
                dict["dome"] = .bool(snapshot.dome == "dome")
            } else {
                dict["dome"] = .string(snapshot.dome)
            }
        }
        if snapshot.tempMin != defaults.tempMin || snapshot.tempMax != defaults.tempMax {
            dict["tempRange"] = .array([.int(snapshot.tempMin), .int(snapshot.tempMax)])
        }
        if snapshot.windMax != defaults.windMax { dict["windMax"] = .int(snapshot.windMax) }
        if let windMin = snapshot.windMin, windMin > 0 { dict["windMin"] = .int(windMin) }
        if (snapshot.windMin ?? 0) > 0 || snapshot.windMax != defaults.windMax {
            dict["windRange"] = .array([.int(snapshot.windMin ?? 0), .int(snapshot.windMax)])
        }
        if snapshot.precip != defaults.precip { dict["precip"] = .string(snapshot.precip) }
        if snapshot.restBye != defaults.restBye { dict["restBye"] = .string(snapshot.restBye) }
        if snapshot.coach != defaults.coach { dict["coach"] = .string(snapshot.coach) }
        if snapshot.referee != defaults.referee { dict["referee"] = .string(snapshot.referee) }
        if !snapshot.teams.isEmpty {
            dict["teams"] = .array(snapshot.teams.map { .string($0) })
        }
        if !snapshot.opponents.isEmpty {
            dict["opponents"] = .array(snapshot.opponents.map { .string($0) })
        }
        if !snapshot.daysOfWeek.isEmpty {
            dict["daysOfWeek"] = .array(snapshot.daysOfWeek.map { .string($0) })
        }
        if !snapshot.teamDivisions.isEmpty {
            dict["teamDivisions"] = .array(snapshot.teamDivisions.map { .string($0) })
        }
        
        // Add new NFL fields when they differ from defaults
        if sport == .nfl || sport == .cfb {
            func putRange(_ key: String, _ value: [Double], _ defaults: [Double]) {
                if value != defaults {
                    dict[key] = .array([.double(value[0]), .double(value[1])])
                }
            }
            func putIntRange(_ key: String, _ value: [Int], _ defaults: [Int]) {
                if value != defaults {
                    dict[key] = .array([.int(value[0]), .int(value[1])])
                }
            }
            func putTri(_ key: String, _ value: Bool?) {
                if let value { dict[key] = .bool(value) }
            }
            func putEnum(_ key: String, _ value: String, _ defaultValue: String = "any") {
                if value != defaultValue { dict[key] = .string(value) }
            }

            putRange("winPct", snapshot.winPct, defaults.winPct)
            putIntRange("winStreak", snapshot.winStreak, defaults.winStreak)
            putIntRange("lossStreak", snapshot.lossStreak, defaults.lossStreak)
            putTri("above500", snapshot.above500)
            putTri("winPctGtOpp", snapshot.winPctGtOpp)
            putRange("ppg", snapshot.ppg, defaults.ppg)
            putRange("paPg", snapshot.paPg, defaults.paPg)
            putRange("pointDiffPg", snapshot.pointDiffPg, defaults.pointDiffPg)
            if snapshot.minGames != defaults.minGames {
                dict["minGames"] = .int(snapshot.minGames)
            }

            putRange("atsWinPct", snapshot.atsWinPct, defaults.atsWinPct)
            putIntRange("atsWinStreak", snapshot.atsWinStreak, defaults.atsWinStreak)
            putRange("avgCoverMargin", snapshot.avgCoverMargin, defaults.avgCoverMargin)

            putRange("overPct", snapshot.overPct, defaults.overPct)
            putIntRange("overStreak", snapshot.overStreak, defaults.overStreak)
            putIntRange("underStreak", snapshot.underStreak, defaults.underStreak)

            putIntRange("prevWins", snapshot.prevWins, defaults.prevWins)
            putRange("prevWinPct", snapshot.prevWinPct, defaults.prevWinPct)
            putTri("madePlayoffsPrev", snapshot.madePlayoffsPrev)
            putTri("moreWinsThanOppPrev", snapshot.moreWinsThanOppPrev)

            putEnum("h2hLastWin", snapshot.h2hLastWin)
            putEnum("h2hLastAts", snapshot.h2hLastAts)
            putEnum("h2hLastOver", snapshot.h2hLastOver)
            putTri("h2hLastHome", snapshot.h2hLastHome)
            putTri("h2hLastFav", snapshot.h2hLastFav)
            putTri("h2hSameSeason", snapshot.h2hSameSeason)
            putEnum("h2hSpreadCmp", snapshot.h2hSpreadCmp)

            putRange("oppWinPct", snapshot.oppWinPct, defaults.oppWinPct)
            putRange("oppOverPct", snapshot.oppOverPct, defaults.oppOverPct)
            putIntRange("oppWinStreak", snapshot.oppWinStreak, defaults.oppWinStreak)
            putIntRange("oppLossStreak", snapshot.oppLossStreak, defaults.oppLossStreak)
            putRange("oppPpg", snapshot.oppPpg, defaults.oppPpg)
            putRange("oppPaPg", snapshot.oppPaPg, defaults.oppPaPg)
            putRange("oppPrevWinPct", snapshot.oppPrevWinPct, defaults.oppPrevWinPct)

            putEnum("lastResult", snapshot.lastResult)
            putEnum("lastAts", snapshot.lastAts)
            putEnum("lastTotal", snapshot.lastTotal)
            putEnum("lastRole", snapshot.lastRole)
            putTri("lastOt", snapshot.lastOt)
            putIntRange("lastMargin", snapshot.lastMargin, defaults.lastMargin)

            putEnum("oppLastResult", snapshot.oppLastResult)
            putEnum("oppLastAts", snapshot.oppLastAts)
            putEnum("oppLastTotal", snapshot.oppLastTotal)
            putEnum("oppLastRole", snapshot.oppLastRole)
            putTri("oppLastOt", snapshot.oppLastOt)
            putIntRange("oppLastMargin", snapshot.oppLastMargin, defaults.oppLastMargin)
        }

        // MLB-only dims (filterSchemaMlb canonical keys). Without these the
        // chat model never saw months/days/series filters the user already had
        // set, and its edits to them were dropped on restore.
        if sport == .mlb {
            if snapshot.monthMin != defaults.monthMin || snapshot.monthMax != defaults.monthMax {
                dict["months"] = .array([.int(snapshot.monthMin), .int(snapshot.monthMax)])
            }
            // iOS UI is single-day; canonical is a days array.
            if snapshot.dayOfWeek != "any" {
                dict["daysOfWeek"] = .array([.string(snapshot.dayOfWeek)])
            }
            if let v = snapshot.doubleheader { dict["doubleheader"] = .bool(v) }
            if let v = snapshot.interleague { dict["interleague"] = .bool(v) }
            if let v = snapshot.switchGame { dict["switchGame"] = .bool(v) }
            if snapshot.seriesGameMin != nil || snapshot.seriesGameMax != nil {
                dict["seriesGame"] = .array([.int(snapshot.seriesGameMin ?? 1), .int(snapshot.seriesGameMax ?? 6)])
            }
            if snapshot.tripMin != nil || snapshot.tripMax != nil {
                dict["trip"] = .array([.int(snapshot.tripMin ?? 1), .int(snapshot.tripMax ?? 5)])
            }
            if snapshot.restMin != nil || snapshot.restMax != nil {
                dict["restRange"] = .array([.int(snapshot.restMin ?? 0), .int(snapshot.restMax ?? 10)])
            }
            let streakLo = Double(snapshot.streakMin.trimmingCharacters(in: .whitespaces))
            let streakHi = Double(snapshot.streakMax.trimmingCharacters(in: .whitespaces))
            if streakLo != nil || streakHi != nil {
                dict["winLossStreak"] = .array([.double(streakLo ?? -25), .double(streakHi ?? 25)])
            }
            if snapshot.lastResult != "any" { dict["lastResult"] = .string(snapshot.lastResult) }
            let marginLo = Double(snapshot.lastMarginMin.trimmingCharacters(in: .whitespaces))
            let marginHi = Double(snapshot.lastMarginMax.trimmingCharacters(in: .whitespaces))
            if marginLo != nil || marginHi != nil {
                dict["lastMargin"] = .array([.double(marginLo ?? -30), .double(marginHi ?? 30)])
            }
            if snapshot.spHand != "any" { dict["spHand"] = .string(snapshot.spHand) }
            if snapshot.oppSpHand != "any" { dict["oppSpHand"] = .string(snapshot.oppSpHand) }
            if !snapshot.sp.isEmpty { dict["spNames"] = .array(snapshot.sp.map { .string($0.name) }) }
            if !snapshot.oppSp.isEmpty { dict["oppSpNames"] = .array(snapshot.oppSp.map { .string($0.name) }) }
            if snapshot.windDir != "any" { dict["windDir"] = .string(snapshot.windDir) }
            if snapshot.pfRunsMin != nil || snapshot.pfRunsMax != nil {
                dict["pfRuns"] = .array([.double(snapshot.pfRunsMin ?? 85), .double(snapshot.pfRunsMax ?? 115)])
            }
        }

        return dict
    }
    
    private func restoreNLFilterSnapshot(_ webSnapshot: [String: JSONValue]) {
        // Convert web snapshot back to UI snapshot format using JSONValue accessors
        updateSnapshot { snapshot in
            func pairDoubles(_ key: String) -> [Double]? {
                guard let arr = webSnapshot[key]?.arrayValue, arr.count >= 2 else { return nil }
                let a = arr[0].intValue.map(Double.init) ?? arr[0].doubleValue
                let b = arr[1].intValue.map(Double.init) ?? arr[1].doubleValue
                guard let a, let b else { return nil }
                return [a, b]
            }
            func pairInts(_ key: String) -> [Int]? {
                guard let arr = webSnapshot[key]?.arrayValue, arr.count >= 2 else { return nil }
                let a = arr[0].intValue ?? arr[0].doubleValue.map { Int($0.rounded()) }
                let b = arr[1].intValue ?? arr[1].doubleValue.map { Int($0.rounded()) }
                guard let a, let b else { return nil }
                return [a, b]
            }

            // Basic fields
            if let betType = webSnapshot["betType"]?.stringValue {
                snapshot.betType = betType
            }
            
            // Season range - web uses "seasons" as [min, max] array
            if let seasons = pairInts("seasons") {
                snapshot.seasonMin = seasons[0]
                snapshot.seasonMax = seasons[1]
            }
            
            // Week range - web uses "weeks" as [min, max] array  
            if let weeks = pairInts("weeks") {
                snapshot.weekMin = weeks[0]
                snapshot.weekMax = weeks[1]
            }
            
            if let side = webSnapshot["side"]?.stringValue {
                snapshot.side = side
            }
            
            if let seasonType = webSnapshot["seasonType"]?.stringValue {
                snapshot.seasonType = seasonType
            }
            
            if let playoffRound = webSnapshot["playoffRound"]?.stringValue {
                snapshot.playoffRound = playoffRound
            }
            
            if let favDog = webSnapshot["favDog"]?.stringValue {
                snapshot.favDog = favDog
            }
            
            if let spreadSide = webSnapshot["spreadSide"]?.stringValue {
                snapshot.spreadSide = spreadSide
            }
            
            // Spread size - web uses "spreadSize" as [min, max] array
            if let spread = pairDoubles("spreadSize") {
                snapshot.spreadMin = spread[0]
                snapshot.spreadMax = spread[1]
            }

            if let line = pairDoubles("lineRange") {
                snapshot.lineMin = line[0]
                snapshot.lineMax = line[1]
            }
            if let mlMin = webSnapshot["mlMin"]?.stringValue { snapshot.mlMin = mlMin }
            if let mlMax = webSnapshot["mlMax"]?.stringValue { snapshot.mlMax = mlMax }
            if let value = webSnapshot["h1SpreadSide"]?.stringValue { snapshot.h1SpreadSide = value }
            if let range = pairDoubles("h1SpreadSize") {
                snapshot.h1SpreadMin = range[0]; snapshot.h1SpreadMax = range[1]
            }
            if let value = webSnapshot["h1MlMin"]?.stringValue { snapshot.h1MlMin = value }
            if let value = webSnapshot["h1MlMax"]?.stringValue { snapshot.h1MlMax = value }
            if let range = pairDoubles("h1TotalRange") {
                snapshot.h1TotalMin = range[0]; snapshot.h1TotalMax = range[1]
            }
            if let range = pairDoubles("ttLineRange") {
                snapshot.ttLineMin = range[0]; snapshot.ttLineMax = range[1]
            }
            if let value = webSnapshot["oppSpreadSide"]?.stringValue { snapshot.oppSpreadSide = value }
            if let range = pairDoubles("oppSpreadSize") {
                snapshot.oppSpreadMin = range[0]; snapshot.oppSpreadMax = range[1]
            }
            if let value = webSnapshot["oppMlMin"]?.stringValue { snapshot.oppMlMin = value }
            if let value = webSnapshot["oppMlMax"]?.stringValue { snapshot.oppMlMax = value }
            if let range = pairDoubles("oppTtLineRange") {
                snapshot.oppTtLineMin = range[0]; snapshot.oppTtLineMax = range[1]
            }
            if let primetime = webSnapshot["primetime"]?.boolValue { snapshot.primetime = primetime }
            if let division = webSnapshot["division"]?.boolValue { snapshot.division = division }
            if let dome = webSnapshot["dome"]?.stringValue { snapshot.dome = dome }
            if let temp = pairInts("tempRange") {
                snapshot.tempMin = temp[0]
                snapshot.tempMax = temp[1]
            }
            if let windMax = webSnapshot["windMax"]?.intValue { snapshot.windMax = windMax }
            if let windMin = webSnapshot["windMin"]?.intValue { snapshot.windMin = windMin }
            if let wr = webSnapshot["windRange"]?.arrayValue, wr.count >= 2 {
                if let lo = wr[0].intValue { snapshot.windMin = lo > 0 ? lo : nil }
                if let hi = wr[1].intValue { snapshot.windMax = hi }
            }
            if let precip = webSnapshot["precip"]?.stringValue { snapshot.precip = precip }
            if let restBye = webSnapshot["restBye"]?.stringValue { snapshot.restBye = restBye }
            if let coach = webSnapshot["coach"]?.stringValue { snapshot.coach = coach }
            if let referee = webSnapshot["referee"]?.stringValue { snapshot.referee = referee }
            
            // Teams array
            if let teamsArray = webSnapshot["teams"]?.arrayValue {
                snapshot.teams = teamsArray.compactMap { $0.stringValue }
            }
            
            // Opponents array
            if let opponentsArray = webSnapshot["opponents"]?.arrayValue {
                snapshot.opponents = opponentsArray.compactMap { $0.stringValue }
            }
            
            // Days of week
            if let daysArray = webSnapshot["daysOfWeek"]?.arrayValue {
                snapshot.daysOfWeek = daysArray.compactMap { $0.stringValue }
            }
            
            // Team divisions
            if let divisionsArray = webSnapshot["teamDivisions"]?.arrayValue {
                snapshot.teamDivisions = divisionsArray.compactMap { $0.stringValue }
            }
            
            // NFL-specific fields
            if sport == .nfl || sport == .cfb {
                if let v = pairDoubles("winPct") { snapshot.winPct = v }
                if let v = pairInts("winStreak") { snapshot.winStreak = v }
                if let v = pairInts("lossStreak") { snapshot.lossStreak = v }
                if let v = webSnapshot["above500"]?.boolValue { snapshot.above500 = v }
                if let v = webSnapshot["winPctGtOpp"]?.boolValue { snapshot.winPctGtOpp = v }
                if let v = pairDoubles("ppg") { snapshot.ppg = v }
                if let v = pairDoubles("paPg") { snapshot.paPg = v }
                if let v = pairDoubles("pointDiffPg") { snapshot.pointDiffPg = v }
                if let v = webSnapshot["minGames"]?.intValue { snapshot.minGames = v }

                if let v = pairDoubles("atsWinPct") { snapshot.atsWinPct = v }
                if let v = pairInts("atsWinStreak") { snapshot.atsWinStreak = v }
                if let v = pairDoubles("avgCoverMargin") { snapshot.avgCoverMargin = v }

                if let v = pairDoubles("overPct") { snapshot.overPct = v }
                if let v = pairInts("overStreak") { snapshot.overStreak = v }
                if let v = pairInts("underStreak") { snapshot.underStreak = v }

                if let v = pairInts("prevWins") { snapshot.prevWins = v }
                if let v = pairDoubles("prevWinPct") { snapshot.prevWinPct = v }
                if let v = webSnapshot["madePlayoffsPrev"]?.boolValue { snapshot.madePlayoffsPrev = v }
                if let v = webSnapshot["moreWinsThanOppPrev"]?.boolValue { snapshot.moreWinsThanOppPrev = v }

                if let v = webSnapshot["h2hLastWin"]?.stringValue { snapshot.h2hLastWin = v }
                if let v = webSnapshot["h2hLastAts"]?.stringValue { snapshot.h2hLastAts = v }
                if let v = webSnapshot["h2hLastOver"]?.stringValue { snapshot.h2hLastOver = v }
                if let v = webSnapshot["h2hLastHome"]?.boolValue { snapshot.h2hLastHome = v }
                if let v = webSnapshot["h2hLastFav"]?.boolValue { snapshot.h2hLastFav = v }
                if let v = webSnapshot["h2hSameSeason"]?.boolValue { snapshot.h2hSameSeason = v }
                if let v = webSnapshot["h2hSpreadCmp"]?.stringValue { snapshot.h2hSpreadCmp = v }

                if let v = pairDoubles("oppWinPct") { snapshot.oppWinPct = v }
                if let v = pairDoubles("oppOverPct") { snapshot.oppOverPct = v }
                if let v = pairInts("oppWinStreak") { snapshot.oppWinStreak = v }
                if let v = pairInts("oppLossStreak") { snapshot.oppLossStreak = v }
                if let v = pairDoubles("oppPpg") { snapshot.oppPpg = v }
                if let v = pairDoubles("oppPaPg") { snapshot.oppPaPg = v }
                if let v = pairDoubles("oppPrevWinPct") { snapshot.oppPrevWinPct = v }

                if let v = webSnapshot["lastResult"]?.stringValue { snapshot.lastResult = v }
                if let v = webSnapshot["lastAts"]?.stringValue { snapshot.lastAts = v }
                if let v = webSnapshot["lastTotal"]?.stringValue { snapshot.lastTotal = v }
                if let v = webSnapshot["lastRole"]?.stringValue { snapshot.lastRole = v }
                if let v = webSnapshot["lastOt"]?.boolValue { snapshot.lastOt = v }
                if let v = pairInts("lastMargin") { snapshot.lastMargin = v }

                if let v = webSnapshot["oppLastResult"]?.stringValue { snapshot.oppLastResult = v }
                if let v = webSnapshot["oppLastAts"]?.stringValue { snapshot.oppLastAts = v }
                if let v = webSnapshot["oppLastTotal"]?.stringValue { snapshot.oppLastTotal = v }
                if let v = webSnapshot["oppLastRole"]?.stringValue { snapshot.oppLastRole = v }
                if let v = webSnapshot["oppLastOt"]?.boolValue { snapshot.oppLastOt = v }
                if let v = pairInts("oppLastMargin") { snapshot.oppLastMargin = v }
            }

            // MLB-only dims — the server returns the FULL canonical snapshot, so
            // canonical DEFAULTS must map back to the iOS "unset" sentinels
            // (nil / "any"), not become active filters.
            if sport == .mlb {
                // Tristate bool on MLB (football restores it as a string above).
                if let dome = webSnapshot["dome"]?.boolValue {
                    snapshot.dome = dome ? "dome" : "outdoor"
                }
                if let months = pairInts("months") {
                    snapshot.monthMin = months[0]
                    snapshot.monthMax = months[1]
                }
                // Canonical daysOfWeek is an array; iOS MLB UI is single-day.
                if let days = webSnapshot["daysOfWeek"]?.arrayValue {
                    snapshot.dayOfWeek = days.compactMap { $0.stringValue }.first ?? "any"
                }
                if let v = webSnapshot["doubleheader"]?.boolValue { snapshot.doubleheader = v }
                if let v = webSnapshot["interleague"]?.boolValue { snapshot.interleague = v }
                if let v = webSnapshot["switchGame"]?.boolValue { snapshot.switchGame = v }
                if let v = pairInts("seriesGame") {
                    snapshot.seriesGameMin = v == [1, 6] ? nil : v[0]
                    snapshot.seriesGameMax = v == [1, 6] ? nil : v[1]
                }
                if let v = pairInts("trip") {
                    snapshot.tripMin = v == [1, 5] ? nil : v[0]
                    snapshot.tripMax = v == [1, 5] ? nil : v[1]
                }
                if let v = pairInts("restRange") {
                    snapshot.restMin = v == [0, 10] ? nil : v[0]
                    snapshot.restMax = v == [0, 10] ? nil : v[1]
                }
                if let v = pairInts("winLossStreak") {
                    snapshot.streakMin = v == [-25, 25] ? "" : String(v[0])
                    snapshot.streakMax = v == [-25, 25] ? "" : String(v[1])
                }
                if let v = webSnapshot["lastResult"]?.stringValue { snapshot.lastResult = v }
                if let v = pairInts("lastMargin") {
                    snapshot.lastMarginMin = v == [-30, 30] ? "" : String(v[0])
                    snapshot.lastMarginMax = v == [-30, 30] ? "" : String(v[1])
                }
                if let v = webSnapshot["spHand"]?.stringValue { snapshot.spHand = v }
                if let v = webSnapshot["oppSpHand"]?.stringValue { snapshot.oppSpHand = v }
                if let v = webSnapshot["windDir"]?.stringValue { snapshot.windDir = v }
                if let v = pairDoubles("pfRuns") {
                    snapshot.pfRunsMin = v == [85, 115] ? nil : v[0]
                    snapshot.pfRunsMax = v == [85, 115] ? nil : v[1]
                }
                // F5 market keeps its own canonical dim in the shared line slider.
                if snapshot.betType == "f5_total", let v = pairDoubles("f5TotalRange") {
                    snapshot.lineMin = v[0]
                    snapshot.lineMax = v[1]
                }
                // Canonical tempRange floor is 30 (web slider), iOS "any" is -10.
                // A full-span [30,110] must NOT become temp_min=30 — that would
                // silently exclude dome games (NULL temps) after every chat turn.
                if snapshot.tempMin == 30 && snapshot.tempMax == 110 {
                    snapshot.tempMin = -10
                }
                // Same for windRange full span [0,40] vs iOS windMax sentinel 60.
                if (snapshot.windMin ?? 0) == 0 && snapshot.windMax == 40 {
                    snapshot.windMin = nil
                    snapshot.windMax = 60
                }
                // spNames/oppSpNames need a name→id lookup to restore; chat-set
                // pitcher filters are intentionally not applied yet.
            }
        }
    }
}
