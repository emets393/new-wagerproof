import SwiftUI
import WagerproofDesign
import WagerproofModels

/// NCAAB game row rendered in the home Games feed list. NCAAB ships
/// `predTotalPoints` as the model's fair-total figure.
struct NCAABGameCard: View {
    let game: NCAABGame
    var onPress: () -> Void = {}

    var body: some View {
        GameRowCard(model: rowModel, onPress: onPress)
    }

    private var rowModel: GameRowCard.Model {
        let awayAbbr = game.awayTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
            ?? game.awayTeam
        let homeAbbr = game.homeTeamAbbrev?.trimmingCharacters(in: .whitespaces).nonEmpty
            ?? game.homeTeam

        return GameRowCard.Model(
            id: game.id,
            league: "ncaab",
            dateLabel: GameCardFormatting.formatCompactDate(game.gameDate),
            timeLabel: GameCardFormatting.convertTimeToEST(game.gameTime),
            away: GameRowCard.TeamSide(
                abbr: awayAbbr,
                initials: TeamInitials.from(game.awayTeam),
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: nil,
                colors: FallbackTeamColor.colorPair(for: game.awayTeam)
            ),
            home: GameRowCard.TeamSide(
                abbr: homeAbbr,
                initials: TeamInitials.from(game.homeTeam),
                moneyline: game.homeMl,
                spread: game.homeSpread,
                logoURL: nil,
                colors: FallbackTeamColor.colorPair(for: game.homeTeam)
            ),
            overLine: game.overLine,
            mlEdge: GameEdgeMath.mlEdge(
                modelHomeProb: game.homeAwayMlProb,
                homeMl: game.homeMl,
                awayMl: game.awayMl,
                homeAbbr: homeAbbr,
                awayAbbr: awayAbbr
            ),
            ouEdge: GameEdgeMath.ouEdge(
                modelFairTotal: game.predTotalPoints,
                marketLine: game.overLine,
                ouResultProb: game.ouResultProb
            ),
            awayTeamFullName: game.awayTeam,
            homeTeamFullName: game.homeTeam,
            oddsBreakdown: oddsBreakdown(awayAbbr: awayAbbr, homeAbbr: homeAbbr)
        )
    }

    /// Spread / Money / Total table — matches the MLB card layout.
    private func oddsBreakdown(awayAbbr: String, homeAbbr: String) -> GameRowCard.OddsBreakdown {
        let totalText = GameCardFormatting.roundToNearestHalf(game.overLine)
        let hasTotal = game.overLine != nil
        return GameRowCard.OddsBreakdown(
            away: GameRowCard.OddsBreakdown.Row(
                abbr: awayAbbr,
                spread: GameCardFormatting.formatSpread(game.awaySpread),
                moneyline: GameCardFormatting.formatMoneyline(game.awayMl),
                total: hasTotal ? "O\(totalText)" : "—"
            ),
            home: GameRowCard.OddsBreakdown.Row(
                abbr: homeAbbr,
                spread: GameCardFormatting.formatSpread(game.homeSpread),
                moneyline: GameCardFormatting.formatMoneyline(game.homeMl),
                total: hasTotal ? "U\(totalText)" : "—"
            )
        )
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
