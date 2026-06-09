import SwiftUI
import WagerproofDesign
import WagerproofModels

/// CFB game row rendered in the home Games feed list. Thin wrapper around
/// `GameRowCard`. CFB ships a model fair total (`predOverLine` /
/// `predTotal`) so we can populate the O/U delta alongside `ouResultProb`.
struct CFBGameCard: View {
    let game: CFBPrediction
    var onPress: () -> Void = {}

    var body: some View {
        GameRowCard(model: rowModel, onPress: onPress)
    }

    private var rowModel: GameRowCard.Model {
        let awayAbbr = TeamInitials.from(game.awayTeam)
        let homeAbbr = TeamInitials.from(game.homeTeam)
        return GameRowCard.Model(
            id: game.id,
            league: "cfb",
            dateLabel: GameCardFormatting.formatCompactDate(game.gameDate),
            timeLabel: GameCardFormatting.convertTimeToEST(game.gameTime),
            away: GameRowCard.TeamSide(
                abbr: awayAbbr,
                initials: awayAbbr,
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: nil,
                colors: FallbackTeamColor.colorPair(for: game.awayTeam)
            ),
            home: GameRowCard.TeamSide(
                abbr: homeAbbr,
                initials: homeAbbr,
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
            // CFB publishes the model's predicted total directly —
            // prefer that for the fair-total delta calc.
            ouEdge: GameEdgeMath.ouEdge(
                modelFairTotal: game.predOverLine ?? game.predTotal,
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
