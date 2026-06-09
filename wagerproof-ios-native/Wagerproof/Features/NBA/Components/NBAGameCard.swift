import SwiftUI
import WagerproofDesign
import WagerproofModels

/// NBA game row rendered in the home Games feed list. NBA ships a
/// `modelFairTotal`, so the O/U row gets the full triplet (direction,
/// model-vs-market delta, probability).
struct NBAGameCard: View {
    let game: NBAGame
    var onPress: () -> Void = {}

    var body: some View {
        GameRowCard(model: rowModel, onPress: onPress)
    }

    private var rowModel: GameRowCard.Model {
        GameRowCard.Model(
            id: game.id,
            league: "nba",
            dateLabel: GameCardFormatting.formatCompactDate(game.gameDate),
            timeLabel: GameCardFormatting.convertTimeToEST(game.gameTime),
            away: GameRowCard.TeamSide(
                abbr: game.awayAbbr,
                initials: TeamInitials.from(game.awayTeam),
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: nil,
                colors: NBATeams.colorPair(for: game.awayTeam)
            ),
            home: GameRowCard.TeamSide(
                abbr: game.homeAbbr,
                initials: TeamInitials.from(game.homeTeam),
                moneyline: game.homeMl,
                spread: game.homeSpread,
                logoURL: nil,
                colors: NBATeams.colorPair(for: game.homeTeam)
            ),
            overLine: game.overLine,
            mlEdge: GameEdgeMath.mlEdge(
                modelHomeProb: game.homeAwayMlProb,
                homeMl: game.homeMl,
                awayMl: game.awayMl,
                homeAbbr: game.homeAbbr,
                awayAbbr: game.awayAbbr
            ),
            ouEdge: GameEdgeMath.ouEdge(
                modelFairTotal: game.modelFairTotal,
                marketLine: game.overLine,
                ouResultProb: game.ouResultProb
            ),
            awayTeamFullName: game.awayTeam,
            homeTeamFullName: game.homeTeam,
            oddsBreakdown: oddsBreakdown
        )
    }

    /// Spread / Money / Total table — matches the MLB card layout.
    private var oddsBreakdown: GameRowCard.OddsBreakdown {
        let totalText = GameCardFormatting.roundToNearestHalf(game.overLine)
        let hasTotal = game.overLine != nil
        return GameRowCard.OddsBreakdown(
            away: GameRowCard.OddsBreakdown.Row(
                abbr: game.awayAbbr,
                spread: GameCardFormatting.formatSpread(game.awaySpread),
                moneyline: GameCardFormatting.formatMoneyline(game.awayMl),
                total: hasTotal ? "O\(totalText)" : "—"
            ),
            home: GameRowCard.OddsBreakdown.Row(
                abbr: game.homeAbbr,
                spread: GameCardFormatting.formatSpread(game.homeSpread),
                moneyline: GameCardFormatting.formatMoneyline(game.homeMl),
                total: hasTotal ? "U\(totalText)" : "—"
            )
        )
    }
}
