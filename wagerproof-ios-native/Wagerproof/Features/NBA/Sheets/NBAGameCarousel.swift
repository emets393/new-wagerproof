import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Swipeable carousel of the NBA slate's game-detail pages. Thin wrapper around
/// the shared `GameDetailCarousel` engine — supplies NBA team colors, the
/// matchup-strip chip, and the page builder (`NBAGameBottomSheet`).
struct NBAGameCarousel: View {
    let games: [NBAGame]
    let initialGame: NBAGame
    var onClose: () -> Void = {}

    init(games: [NBAGame], initialGame: NBAGame, onClose: @escaping () -> Void = {}) {
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
                (NBATeams.colorPair(for: game.awayTeam).primary,
                 NBATeams.colorPair(for: game.homeTeam).primary)
            },
            chip: { game, isCurrent in
                CarouselMatchupChip(
                    awayAbbr: TeamInitials.from(game.awayTeam),
                    homeAbbr: TeamInitials.from(game.homeTeam),
                    isCurrent: isCurrent
                ) {
                    GameCardTeamAvatar(teamName: game.awayTeam, sport: "nba", size: 18, colors: NBATeams.colorPair(for: game.awayTeam))
                } homeLogo: {
                    GameCardTeamAvatar(teamName: game.homeTeam, sport: "nba", size: 18, colors: NBATeams.colorPair(for: game.homeTeam))
                }
            },
            page: { game, topInset, bottomInset in
                NBAGameBottomSheet(
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
