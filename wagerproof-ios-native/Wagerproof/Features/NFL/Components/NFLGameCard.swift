import SwiftUI
import WagerproofDesign
import WagerproofModels

/// NFL game row rendered in the home Games feed list. Thin wrapper around
/// `GameRowCard` — populates the model ML edge from `homeAwayMlProb` vs
/// vegas implied probabilities. NFL's predictions table doesn't publish a
/// fair-total figure, so the O/U row surfaces direction + confidence only.
struct NFLGameCard: View {
    let game: NFLPrediction
    var onPress: () -> Void = {}

    var body: some View {
        GameRowCard(model: rowModel, onPress: onPress)
    }

    private var rowModel: GameRowCard.Model {
        let awayAbbr = TeamInitials.from(game.awayTeam)
        let homeAbbr = TeamInitials.from(game.homeTeam)
        return GameRowCard.Model(
            id: game.id,
            league: "nfl",
            dateLabel: GameCardFormatting.formatCompactDate(game.gameDate),
            timeLabel: GameCardFormatting.convertTimeToEST(game.gameTime),
            away: GameRowCard.TeamSide(
                abbr: awayAbbr,
                initials: awayAbbr,
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: nil,
                colors: NFLTeamColors.colorPair(for: game.awayTeam)
            ),
            home: GameRowCard.TeamSide(
                abbr: homeAbbr,
                initials: homeAbbr,
                moneyline: game.homeMl,
                spread: game.homeSpread,
                logoURL: nil,
                colors: NFLTeamColors.colorPair(for: game.homeTeam)
            ),
            overLine: game.overLine,
            mlEdge: GameEdgeMath.mlEdge(
                modelHomeProb: game.homeAwayMlProb,
                homeMl: game.homeMl,
                awayMl: game.awayMl,
                homeAbbr: homeAbbr,
                awayAbbr: awayAbbr
            ),
            // NFL has no fair-total — direction + probability only.
            ouEdge: GameEdgeMath.ouEdge(
                modelFairTotal: nil,
                marketLine: game.overLine,
                ouResultProb: game.ouResultProb
            ),
            awayTeamFullName: game.awayTeam,
            homeTeamFullName: game.homeTeam,
            oddsBreakdown: oddsBreakdown
        )
    }

    /// Spread / Money / Total table — matches the MLB card layout. Over on the
    /// away row, Under on the home row.
    private var oddsBreakdown: GameRowCard.OddsBreakdown {
        let totalText = GameCardFormatting.roundToNearestHalf(game.overLine)
        let hasTotal = game.overLine != nil
        return GameRowCard.OddsBreakdown(
            away: GameRowCard.OddsBreakdown.Row(
                abbr: TeamInitials.from(game.awayTeam),
                spread: GameCardFormatting.formatSpread(game.awaySpread),
                moneyline: GameCardFormatting.formatMoneyline(game.awayMl),
                total: hasTotal ? "O\(totalText)" : "—"
            ),
            home: GameRowCard.OddsBreakdown.Row(
                abbr: TeamInitials.from(game.homeTeam),
                spread: GameCardFormatting.formatSpread(game.homeSpread),
                moneyline: GameCardFormatting.formatMoneyline(game.homeMl),
                total: hasTotal ? "U\(totalText)" : "—"
            )
        )
    }
}
