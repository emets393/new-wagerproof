import SwiftUI
import WagerproofDesign
import WagerproofModels

/// NBA game row rendered in the home Games feed list. NBA ships a
/// `modelFairTotal`, so the O/U row gets the full triplet (direction,
/// model-vs-market delta, probability).
struct NBAGameCard: View {
    let game: NBAGame
    /// Public-agent consensus, looked up by the feed host. Surfaces that don't
    /// fetch it (Search) leave it nil and the strip simply doesn't render.
    var consensus: GameAgentConsensus? = nil
    var signalCount: Int = 0
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
                abbr: NBATeams.abbreviation(for: game.awayTeam),
                initials: NBATeams.abbreviation(for: game.awayTeam),
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: NBATeams.logoURL(for: game.awayTeam),
                colors: NBATeams.colorPair(for: game.awayTeam)
            ),
            home: GameRowCard.TeamSide(
                abbr: NBATeams.abbreviation(for: game.homeTeam),
                initials: NBATeams.abbreviation(for: game.homeTeam),
                moneyline: game.homeMl,
                spread: game.homeSpread,
                logoURL: NBATeams.logoURL(for: game.homeTeam),
                colors: NBATeams.colorPair(for: game.homeTeam)
            ),
            overLine: game.overLine,
            mlEdge: GameEdgeMath.mlEdge(
                modelHomeProb: game.homeAwayMlProb,
                homeMl: game.homeMl,
                awayMl: game.awayMl,
                homeAbbr: NBATeams.abbreviation(for: game.homeTeam),
                awayAbbr: NBATeams.abbreviation(for: game.awayTeam)
            ),
            ouEdge: GameEdgeMath.ouEdge(
                modelFairTotal: game.modelFairTotal,
                marketLine: game.overLine,
                ouResultProb: game.ouResultProb
            ),
            awayTeamFullName: game.awayTeam,
            homeTeamFullName: game.homeTeam,
            oddsBreakdown: oddsBreakdown,
            consensus: consensus,
            signalCount: signalCount > 0 ? signalCount : nil
        )
    }

    /// Spread / Money / Total table — matches the MLB card layout.
    private var oddsBreakdown: GameRowCard.OddsBreakdown {
        let totalText = GameCardFormatting.roundToNearestHalf(game.overLine)
        let hasTotal = game.overLine != nil
        return GameRowCard.OddsBreakdown(
            away: GameRowCard.OddsBreakdown.Row(
                abbr: NBATeams.abbreviation(for: game.awayTeam),
                spread: GameCardFormatting.formatSpread(game.awaySpread),
                moneyline: GameCardFormatting.formatMoneyline(game.awayMl),
                total: hasTotal ? "O\(totalText)" : "—"
            ),
            home: GameRowCard.OddsBreakdown.Row(
                abbr: NBATeams.abbreviation(for: game.homeTeam),
                spread: GameCardFormatting.formatSpread(game.homeSpread),
                moneyline: GameCardFormatting.formatMoneyline(game.homeMl),
                total: hasTotal ? "U\(totalText)" : "—"
            )
        )
    }
}
