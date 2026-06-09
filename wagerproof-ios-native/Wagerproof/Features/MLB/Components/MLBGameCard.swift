import SwiftUI
import WagerproofDesign
import WagerproofModels

/// MLB game row rendered in the home Games feed list. MLB publishes
/// `homeMlEdgePct` / `awayMlEdgePct` directly so we don't have to
/// recompute the ML edge from probabilities, and `ouFairTotal` for the
/// O/U delta.
struct MLBGameCard: View {
    let game: MLBGame
    var onPress: () -> Void = {}

    var body: some View {
        GameRowCard(model: rowModel, onPress: onPress)
    }

    private var rowModel: GameRowCard.Model {
        let awayDisplayName = game.awayTeamName ?? game.awayTeam ?? "Away"
        let homeDisplayName = game.homeTeamName ?? game.homeTeam ?? "Home"

        let awayPair = MLBTeams.colors(for: awayDisplayName)
        let homePair = MLBTeams.colors(for: homeDisplayName)

        return GameRowCard.Model(
            id: game.id,
            league: "mlb",
            dateLabel: MLBFormatting.dateLabel(game.officialDate),
            timeLabel: MLBFormatting.gameTime(game.gameTimeEt),
            away: GameRowCard.TeamSide(
                abbr: game.awayAbbr,
                initials: game.awayAbbr,
                moneyline: game.awayMl,
                spread: game.awaySpread,
                logoURL: game.awayLogoUrl,
                colors: TeamColorPair(
                    primary: Color(hex: Int(awayPair.primary)),
                    secondary: Color(hex: Int(awayPair.secondary))
                )
            ),
            home: GameRowCard.TeamSide(
                abbr: game.homeAbbr,
                initials: game.homeAbbr,
                moneyline: game.homeMl,
                spread: game.homeSpread,
                logoURL: game.homeLogoUrl,
                colors: TeamColorPair(
                    primary: Color(hex: Int(homePair.primary)),
                    secondary: Color(hex: Int(homePair.secondary))
                )
            ),
            overLine: game.totalLine,
            mlEdge: mlbMlEdge,
            ouEdge: mlbOuEdge,
            awayTeamFullName: awayDisplayName,
            homeTeamFullName: homeDisplayName,
            oddsBreakdown: oddsBreakdown
        )
    }

    /// Build the Spread / Money / Total table for the row. MLB only stores
    /// the run line, moneyline, and a shared total (no spread/total juice),
    /// so each cell shows the line we have. Total uses the Over/Under
    /// convention: Over on the away row, Under on the home row.
    private var oddsBreakdown: GameRowCard.OddsBreakdown {
        let totalText = MLBFormatting.line(game.totalLine)
        return GameRowCard.OddsBreakdown(
            away: GameRowCard.OddsBreakdown.Row(
                abbr: game.awayAbbr,
                spread: MLBFormatting.spread(game.awaySpread),
                moneyline: MLBFormatting.moneyline(game.awayMl),
                total: game.totalLine != nil ? "O\(totalText)" : "—"
            ),
            home: GameRowCard.OddsBreakdown.Row(
                abbr: game.homeAbbr,
                spread: MLBFormatting.spread(game.homeSpread),
                moneyline: MLBFormatting.moneyline(game.homeMl),
                total: game.totalLine != nil ? "U\(totalText)" : "—"
            )
        )
    }

    /// Prefer the MLB predictions' published `*MlEdgePct` columns over
    /// recomputing edge from probabilities — the backend already does
    /// the line-shopping math we'd be redoing.
    private var mlbMlEdge: GameRowCard.MLEdgeInfo? {
        let homeEdge = game.homeMlEdgePct
        let awayEdge = game.awayMlEdgePct
        if let homeEdge, let awayEdge {
            if homeEdge >= awayEdge {
                return GameRowCard.MLEdgeInfo(
                    abbr: game.homeAbbr,
                    edgePoints: homeEdge,
                    color: GameEdgeMath.edgeColor(homeEdge)
                )
            } else {
                return GameRowCard.MLEdgeInfo(
                    abbr: game.awayAbbr,
                    edgePoints: awayEdge,
                    color: GameEdgeMath.edgeColor(awayEdge)
                )
            }
        }
        // Fall back to the model probability calc if edges are missing.
        return GameEdgeMath.mlEdge(
            modelHomeProb: game.mlHomeWinProb,
            homeMl: game.homeMl,
            awayMl: game.awayMl,
            homeAbbr: game.homeAbbr,
            awayAbbr: game.awayAbbr
        )
    }

    /// MLB has `ouDirection` ("OVER"/"UNDER") + `ouEdge` (signed pct
    /// points) + `ouFairTotal`. Use the published direction directly when
    /// present so it matches the back-end's bet labeling.
    private var mlbOuEdge: GameRowCard.OUEdgeInfo? {
        if let direction = game.ouDirection {
            let isOver = direction.uppercased() == "OVER"
            let delta: Double? = {
                guard let fair = game.ouFairTotal, let line = game.totalLine else { return nil }
                return fair - line
            }()
            let edgeMag = abs(game.ouEdge ?? 0)
            return GameRowCard.OUEdgeInfo(
                isOver: isOver,
                delta: delta,
                probability: nil,
                color: GameEdgeMath.edgeColor(edgeMag)
            )
        }
        return GameEdgeMath.ouEdge(
            modelFairTotal: game.ouFairTotal,
            marketLine: game.totalLine,
            ouResultProb: nil
        )
    }
}
