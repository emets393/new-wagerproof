import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Swipeable carousel of the NFL slate's game-detail pages. Thin wrapper around
/// the shared `GameDetailCarousel` engine — supplies NFL team colors, the
/// matchup-strip chip, and the page builder (`NFLGameBottomSheet`).
struct NFLGameCarousel: View {
    let games: [NFLPrediction]
    let initialGame: NFLPrediction
    var onClose: () -> Void = {}

    init(games: [NFLPrediction], initialGame: NFLPrediction, onClose: @escaping () -> Void = {}) {
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
                (NFLTeamColors.colorPair(for: game.awayTeam).primary,
                 NFLTeamColors.colorPair(for: game.homeTeam).primary)
            },
            chip: { game, isCurrent in
                CarouselMatchupChip(
                    awayAbbr: NFLTeamAssets.abbr(for: game.awayTeam),
                    homeAbbr: NFLTeamAssets.abbr(for: game.homeTeam),
                    isCurrent: isCurrent
                ) {
                    GameCardTeamAvatar(teamName: game.awayTeam, sport: "nfl", size: 18, colors: NFLTeamColors.colorPair(for: game.awayTeam))
                } homeLogo: {
                    GameCardTeamAvatar(teamName: game.homeTeam, sport: "nfl", size: 18, colors: NFLTeamColors.colorPair(for: game.homeTeam))
                }
            },
            page: { game, topInset, bottomInset in
                NFLGameBottomSheet(
                    game: game,
                    onClose: onClose,
                    showAura: false,
                    heroTopInset: topInset,
                    contentBottomInset: bottomInset
                )
            }
        )
    }
}
