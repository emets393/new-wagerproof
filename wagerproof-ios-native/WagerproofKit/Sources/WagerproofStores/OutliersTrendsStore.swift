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

    /// Max cards per market carousel — sections are sorted best-first, so this keeps the strongest trends.
    public static let sectionCardCap = 24

    public private(set) var loadState: LoadState = .idle
    public private(set) var precomputedCards: [OutliersTrendsCard] = []
    public private(set) var mlbBundle: MLBTrendsSlateBundle?
    public private(set) var lastRefreshedAt: Date?
    /// Slate games are available before trend cards finish loading.
    public private(set) var slateGames: [OutliersTrendsGame] = []
    public private(set) var isLoadingTrends = false

    // Sport / subject / matchup are the only filters now — market drives the section layout instead.
    public var sport: OutliersTrendsSport = .nfl
    public var matchupFilter: OutliersTrendsMatchupFilter = .allGames
    public var subject: OutliersTrendsSubject = .all

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

    /// Cards grouped into per-bet-type carousels, honoring the active sport/subject/matchup filters.
    /// Market is the layout axis, so the engines run unfiltered by market and we bucket the result.
    public var marketSections: [OutliersTrendsMarketSection] {
        guard sport.hasTrendsData else { return [] }

        let source: [OutliersTrendsCard]
        if sport == .mlb {
            guard let bundle = mlbBundle else { return [] }
            source = MLBTrendsEngine.buildCards(
                bundle: bundle,
                gameFilter: matchupFilter,
                subject: subject,
                gameMarket: .all,
                visibleLimit: Int.max
            )
        } else {
            guard !precomputedCards.isEmpty else { return [] }
            // Carousels scroll horizontally, so show every player — no per-team overflow capping.
            source = NFLTrendsEngine.filterPrecomputedCards(
                precomputedCards,
                games: slateGames,
                sport: sport,
                gameFilter: matchupFilter,
                subject: subject,
                gameMarket: .all,
                propMarket: .all,
                includeAllPlayers: true,
                visibleLimit: Int.max
            )
        }

        return OutliersTrendsMarketSection.sections(from: source, cap: Self.sectionCardCap)
    }

    // MARK: - Search index
    //
    // The global Search "Outliers" section scans EVERY trend-bearing sport, not just the
    // active tab sport, so a query matches across NFL / NCAAF / MLB. Loaded once, lazily,
    // and cached — kept independent of the tab's `sport` / `precomputedCards` view state.
    public private(set) var searchIndex: [OutliersTrendsSearchEntry] = []
    /// Observable so the Search surface can show a shimmer rail while the cross-sport
    /// index is fetching (it loads over the network, unlike the other in-memory sources).
    public private(set) var isLoadingSearchIndex = false

    /// Fetch + flatten all sports' trend cards into `searchIndex` (each tagged with its
    /// sport + game so Search can render the full `OutliersTrendCard`). No-op once loaded
    /// or while a load is in flight; a sport that fails is skipped, not fatal.
    public func loadSearchIndexIfNeeded() async {
        guard searchIndex.isEmpty, !isLoadingSearchIndex else { return }
        isLoadingSearchIndex = true
        defer { isLoadingSearchIndex = false }

        var all: [OutliersTrendsSearchEntry] = []

        // NFL + NCAAF: server-rendered cards keyed by the current slate week.
        for s in [OutliersTrendsSport.nfl, .ncaaf] {
            do {
                let games = try await OutliersTrendsService.shared.fetchSlateGames(sport: s)
                guard let first = games.first else { continue }
                let cards = try await OutliersTrendsService.shared.fetchPrecomputedCards(
                    sport: s, season: first.season, week: first.week
                )
                let gamesById = Dictionary(uniqueKeysWithValues: games.map { ($0.id, $0) })
                let flat = NFLTrendsEngine.filterPrecomputedCards(
                    cards, games: games, sport: s,
                    gameFilter: .allGames, subject: .all, gameMarket: .all, propMarket: .all,
                    includeAllPlayers: true, visibleLimit: Int.max
                )
                all += flat.map { OutliersTrendsSearchEntry(card: $0, sport: s, game: gamesById[$0.gameId]) }
            } catch {
                // Skip this sport — search still covers whatever else loaded.
            }
        }

        // MLB: client-built cards from the splits bundle.
        do {
            let bundle = try await OutliersTrendsService.shared.fetchMLBBundle()
            let gamesById = Dictionary(uniqueKeysWithValues: bundle.games.map { ($0.id, $0) })
            let flat = MLBTrendsEngine.buildCards(
                bundle: bundle, gameFilter: .allGames, subject: .all,
                gameMarket: .all, visibleLimit: Int.max
            )
            all += flat.map { OutliersTrendsSearchEntry(card: $0, sport: .mlb, game: gamesById[$0.gameId]) }
        } catch {}

        searchIndex = all
    }

    public func onSportChanged() {
        if sport == .mlb {
            subject = .teams
        } else if !sport.allowedSubjects.contains(subject) {
            subject = .all
        }
        matchupFilter = .allGames
    }
}
