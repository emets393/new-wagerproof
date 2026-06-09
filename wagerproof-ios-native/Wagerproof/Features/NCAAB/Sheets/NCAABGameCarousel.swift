import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Swipeable carousel of the NCAAB slate's game-detail pages. Thin wrapper around
/// the shared `GameDetailCarousel` engine — supplies NCAAB team colors (derived
/// from a stable name hash, since no real NCAAB brand table exists), the
/// matchup-strip chip, and the page builder (`NCAABGameBottomSheet`).
struct NCAABGameCarousel: View {
    let games: [NCAABGame]
    let initialGame: NCAABGame
    var onClose: () -> Void = {}

    init(games: [NCAABGame], initialGame: NCAABGame, onClose: @escaping () -> Void = {}) {
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
                (FallbackTeamColor.colorPair(for: game.awayTeam).primary,
                 FallbackTeamColor.colorPair(for: game.homeTeam).primary)
            },
            chip: { game, isCurrent in
                CarouselMatchupChip(
                    awayAbbr: game.awayTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
                        ?? TeamInitials.from(game.awayTeam),
                    homeAbbr: game.homeTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
                        ?? TeamInitials.from(game.homeTeam),
                    isCurrent: isCurrent
                ) {
                    GameCardTeamAvatar(teamName: game.awayTeam, sport: "ncaab", size: 18, colors: FallbackTeamColor.colorPair(for: game.awayTeam))
                } homeLogo: {
                    GameCardTeamAvatar(teamName: game.homeTeam, sport: "ncaab", size: 18, colors: FallbackTeamColor.colorPair(for: game.homeTeam))
                }
            },
            page: { game, topInset, bottomInset in
                NCAABGameBottomSheet(
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

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
