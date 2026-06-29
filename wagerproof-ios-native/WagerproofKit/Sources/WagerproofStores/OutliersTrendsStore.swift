import Foundation
import Observation
import WagerproofModels
import WagerproofServices

@Observable
@MainActor
public final class OutliersTrendsStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var loadState: LoadState = .idle
    public private(set) var precomputedCards: [OutliersTrendsCard] = []
    public private(set) var mlbBundle: MLBTrendsSlateBundle?
    public private(set) var lastRefreshedAt: Date?
    /// Slate games are available before trend cards finish loading.
    public private(set) var slateGames: [OutliersTrendsGame] = []
    public private(set) var isLoadingTrends = false

    public var sport: OutliersTrendsSport = .nfl
    public var matchupFilter: OutliersTrendsMatchupFilter = .allGames
    public var subject: OutliersTrendsSubject = .all
    public var gameMarket: OutliersTrendsGameMarket = .all
    public var propMarket: OutliersTrendsPropMarket = .all
    public var visibleLimit: Int = NFLTrendsEngine.allGamesPreviewCap
    public var expandedPlayerGames: Set<String> = []

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return isLoadingTrends
    }

    public var lastError: String? {
        if case .failed(let message) = loadState { return message }
        return nil
    }

    public init() {}

    public func refresh() async {
        guard sport.hasTrendsData else {
            loadState = .loaded
            precomputedCards = []
            mlbBundle = nil
            slateGames = []
            return
        }

        loadState = .loading
        isLoadingTrends = true
        slateGames = []
        precomputedCards = []
        mlbBundle = nil

        do {
            switch sport {
            case .nfl:
                await NFLTeamsService.shared.ensureLoaded()
            case .ncaaf:
                await CFBTeamsService.shared.ensureLoaded()
            default:
                break
            }

            if sport == .mlb {
                let bundle = try await OutliersTrendsService.shared.fetchMLBBundle()
                mlbBundle = bundle
                slateGames = bundle.games
                precomputedCards = []
                loadState = .loaded
                lastRefreshedAt = Date()
                isLoadingTrends = false
                return
            }

            mlbBundle = nil
            let games = try await OutliersTrendsService.shared.fetchSlateGames(sport: sport)
            slateGames = games
            loadState = .loaded

            guard let first = games.first else {
                precomputedCards = []
                isLoadingTrends = false
                return
            }

            precomputedCards = try await OutliersTrendsService.shared.fetchPrecomputedCards(
                sport: sport,
                season: first.season,
                week: first.week
            )
            lastRefreshedAt = Date()
            isLoadingTrends = false
        } catch {
            isLoadingTrends = false
            if slateGames.isEmpty {
                loadState = .failed(error.localizedDescription)
            } else {
                loadState = .failed("Trends data: \(error.localizedDescription)")
            }
        }
    }

    public var games: [OutliersTrendsGame] { slateGames }

    public var effectiveGameMarket: OutliersTrendsGameMarket {
        if sport == .mlb {
            let allowed = OutliersTrendsGameMarket.markets(for: .mlb, subject: subject)
            return allowed.contains(gameMarket) ? gameMarket : .all
        }
        return NFLTrendsEngine.effectiveGameMarket(for: subject, selected: gameMarket)
    }

    public var cards: [OutliersTrendsCard] {
        guard sport.hasTrendsData else { return [] }

        if sport == .mlb {
            guard let bundle = mlbBundle else { return [] }
            return MLBTrendsEngine.buildCards(
                bundle: bundle,
                gameFilter: matchupFilter,
                subject: subject,
                gameMarket: effectiveGameMarket,
                visibleLimit: visibleLimit
            )
        }

        guard !precomputedCards.isEmpty else { return [] }
        let includeAllPlayers: Bool
        if case .game(let id) = matchupFilter {
            includeAllPlayers = expandedPlayerGames.contains(id)
        } else {
            includeAllPlayers = false
        }
        return NFLTrendsEngine.filterPrecomputedCards(
            precomputedCards,
            games: slateGames,
            sport: sport,
            gameFilter: matchupFilter,
            subject: subject,
            gameMarket: effectiveGameMarket,
            propMarket: propMarket,
            includeAllPlayers: includeAllPlayers,
            visibleLimit: visibleLimit
        )
    }

    public var canShowMore: Bool {
        guard case .allGames = matchupFilter else { return false }
        if sport == .mlb {
            guard let bundle = mlbBundle else { return false }
            let total = MLBTrendsEngine.buildCards(
                bundle: bundle,
                gameFilter: .allGames,
                subject: subject,
                gameMarket: effectiveGameMarket,
                visibleLimit: Int.max
            ).count
            return total > visibleLimit
        }
        guard !precomputedCards.isEmpty else { return false }
        let total = NFLTrendsEngine.filterPrecomputedCards(
            precomputedCards,
            games: slateGames,
            sport: sport,
            gameFilter: .allGames,
            subject: subject,
            gameMarket: effectiveGameMarket,
            propMarket: propMarket,
            includeAllPlayers: false,
            visibleLimit: Int.max
        ).count
        return total > visibleLimit
    }

    public func showMore() {
        let cap = sport == .mlb ? MLBTrendsEngine.allGamesPreviewCap : NFLTrendsEngine.allGamesPreviewCap
        visibleLimit += cap
    }

    public func expandPlayers(for gameId: String) {
        expandedPlayerGames.insert(gameId)
    }

    public func resetPagination() {
        visibleLimit = sport == .mlb ? MLBTrendsEngine.allGamesPreviewCap : NFLTrendsEngine.allGamesPreviewCap
    }

    public func onSubjectChanged() {
        gameMarket = .all
        propMarket = .all
        resetPagination()
    }

    public func onSportChanged() {
        if sport == .mlb {
            subject = .teams
        } else if !sport.allowedSubjects.contains(subject) {
            subject = .all
        }
        matchupFilter = .allGames
        onSubjectChanged()
    }

    public func onFiltersChanged() {
        resetPagination()
    }

    public func onMatchupChanged() {
        onFiltersChanged()
    }
}
