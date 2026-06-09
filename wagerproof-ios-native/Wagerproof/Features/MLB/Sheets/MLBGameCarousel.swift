import SwiftUI
import WagerproofDesign
import WagerproofModels

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

    init(games: [MLBGame], initialGame: MLBGame, onClose: @escaping () -> Void = {}) {
        self.games = games
        self.initialGame = initialGame
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
                    onSelectProp: { selectedProp = $0 }
                )
            }
        )
        // Player-prop page push — shared across all carousel pages, with the
        // same zoom transition the Props tab uses.
        .navigationDestination(item: $selectedProp) { selection in
            PlayerPropDetailView(selection: selection)
                .navigationTransition(.zoom(sourceID: selection.transitionID, in: propTransition))
        }
    }
}
