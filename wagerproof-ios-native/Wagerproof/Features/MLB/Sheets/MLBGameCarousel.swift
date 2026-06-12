import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Swipeable carousel of the MLB slate's game-detail pages. Thin wrapper around
/// the shared `GameDetailCarousel` engine — supplies MLB team colors, the
/// matchup-strip chip, and the page builder (`MLBGameBottomSheet`).
struct MLBGameCarousel: View {
    let games: [MLBGame]
    let initialGame: MLBGame
    var onClose: () -> Void = {}

    /// Player-prop drill-down state. One navigationDestination here (not per
    /// page) avoids duplicate-destination conflicts across the TabView pages.
    @State private var selectedProp: PlayerPropSelection?
    @Namespace private var propTransition

    /// Shell-hoisted insight slates (trends + F5) injected by GamesView so the
    /// carousel pages, SearchView chips, and the game sheets all read one
    /// fetch. nil (previews/harness) falls back to carousel-local stores.
    var trendsStore: MLBBettingTrendsStore? = nil
    var f5Store: MLBF5SplitsStore? = nil
    @State private var localTrendsStore = MLBBettingTrendsStore()
    @State private var localF5Store = MLBF5SplitsStore()
    private var resolvedTrendsStore: MLBBettingTrendsStore { trendsStore ?? localTrendsStore }
    private var resolvedF5Store: MLBF5SplitsStore { f5Store ?? localF5Store }

    /// Slate-wide widget stores, shared by every carousel page — one fetch
    /// serves all pages (per-page stores would refetch the whole slate on
    /// each swipe). Hydrated once in `.task` below.
    @State private var accuracyStore = MLBBucketAccuracyStore()
    @State private var regressionStore = MLBRegressionReportStore()

    init(
        games: [MLBGame],
        initialGame: MLBGame,
        trendsStore: MLBBettingTrendsStore? = nil,
        f5Store: MLBF5SplitsStore? = nil,
        onClose: @escaping () -> Void = {}
    ) {
        self.games = games
        self.initialGame = initialGame
        self.trendsStore = trendsStore
        self.f5Store = f5Store
        self.onClose = onClose
    }

    var body: some View {
        GameDetailCarousel(
            games: games,
            initialGame: initialGame,
            onClose: onClose,
            teamColors: { game in
                let aw = MLBTeams.colors(for: game.awayTeamName ?? game.awayAbbr)
                let hm = MLBTeams.colors(for: game.homeTeamName ?? game.homeAbbr)
                return (Color(hex: Int(aw.primary)), Color(hex: Int(hm.primary)))
            },
            chip: { game, isCurrent in
                CarouselMatchupChip(
                    awayAbbr: game.awayAbbr,
                    homeAbbr: game.homeAbbr,
                    isCurrent: isCurrent
                ) {
                    MLBTeamLogo(logoUrl: game.awayLogoUrl, abbrev: game.awayAbbr, name: game.awayTeamName ?? "", size: 18)
                } homeLogo: {
                    MLBTeamLogo(logoUrl: game.homeLogoUrl, abbrev: game.homeAbbr, name: game.homeTeamName ?? "", size: 18)
                }
            },
            page: { game, topInset, bottomInset in
                MLBGameBottomSheet(
                    game: game,
                    onClose: onClose,
                    showAura: false,
                    heroTopInset: topInset,
                    contentBottomInset: bottomInset,
                    propNamespace: propTransition,
                    onSelectProp: { selectedProp = $0 },
                    trendsStore: resolvedTrendsStore,
                    f5Store: resolvedF5Store,
                    accuracyStore: accuracyStore,
                    regressionStore: regressionStore
                )
            }
        )
        // Player-prop page push — shared across all carousel pages, with the
        // same zoom transition the Props tab uses.
        .navigationDestination(item: $selectedProp) { selection in
            PlayerPropDetailView(selection: selection)
                .navigationTransition(.zoom(sourceID: selection.transitionID, in: propTransition))
        }
        .task {
            // Independent slate fetches — hydrate in parallel so a cold open
            // costs one round trip; each store no-ops when already fresh.
            async let t: () = resolvedTrendsStore.refreshIfNeeded()
            async let f: () = resolvedF5Store.refreshIfStale()
            async let a: () = accuracyStore.refreshIfStale()
            async let r: () = regressionStore.refreshIfStale()
            _ = await (t, f, a, r)
        }
    }
}
