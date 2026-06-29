import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Swipeable carousel of the CFB slate's game-detail pages. Thin wrapper around
/// the shared `GameDetailCarousel` engine — supplies CFB team colors/logos from
/// `cfb_teams`, the matchup-strip chip, and the page builder.
struct CFBGameCarousel: View {
    let games: [CFBPrediction]
    let initialGame: CFBPrediction
    var onClose: () -> Void = {}

    init(games: [CFBPrediction], initialGame: CFBPrediction, onClose: @escaping () -> Void = {}) {
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
                (CFBTeamColors.colorPair(for: game.awayTeam).primary,
                 CFBTeamColors.colorPair(for: game.homeTeam).primary)
            },
            chip: { game, isCurrent in
                CarouselMatchupChip(
                    awayAbbr: CFBTeamAssets.abbr(for: game.awayTeam),
                    homeAbbr: CFBTeamAssets.abbr(for: game.homeTeam),
                    isCurrent: isCurrent
                ) {
                    GameCardTeamAvatar(teamName: game.awayTeam, sport: "cfb", size: 18, colors: CFBTeamColors.colorPair(for: game.awayTeam))
                } homeLogo: {
                    GameCardTeamAvatar(teamName: game.homeTeam, sport: "cfb", size: 18, colors: CFBTeamColors.colorPair(for: game.homeTeam))
                }
            },
            page: { game, topInset, bottomInset in
                CFBGameBottomSheet(
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
