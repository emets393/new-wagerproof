import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Ranks each live source into its own primitive section for the Outliers hub.
/// Unlike `OutlierAggregator` (which merges every source into one per-game
/// tile), this keeps the sources separate so the hub can browse by insight
/// type — a Trends rail, a First-5 rail, a Props rail — each ordered strongest
/// first off the same Kit insight adapters the game-sheet widgets use.
enum OutlierSections {
    /// The three primitive rails, used as nav values for each rail's "See all".
    enum Kind: String, Hashable, CaseIterable {
        case trends, f5, props

        var title: String {
            switch self {
            case .trends: return "Betting Trends"
            case .f5: return "First 5 Innings"
            case .props: return "Player Props"
            }
        }

        var icon: String {
            switch self {
            case .trends: return "chart.line.uptrend.xyaxis"
            case .f5: return "baseball.diamond.bases"
            case .props: return "figure.baseball"
            }
        }

        var accent: Color {
            switch self {
            case .trends: return Color(hex: 0x0EA5E9)
            case .f5: return Color(hex: 0xF97316)
            case .props: return Color(hex: 0x22C55E)
            }
        }
    }

    /// Games with at least one fired situational signal, strongest first
    /// (signal count, then combined consensus score).
    static func trends(_ games: [MLBGameTrends]) -> [MLBGameTrends] {
        games
            .compactMap { game -> (MLBGameTrends, Int, Double)? in
                let summary = MLBTrendsInsight.summary(for: game)
                guard !summary.signals.isEmpty else { return nil }
                return (game, summary.signals.count, game.ouConsensusScore * 0.25 + game.mlDominanceScore)
            }
            .sorted { a, b in a.1 != b.1 ? a.1 > b.1 : a.2 > b.2 }
            .map(\.0)
    }

    /// Games whose first-five split clears the showable floor and produces an
    /// edge summary, ranked by the peak F5 run/line divergence.
    @MainActor
    static func f5(_ games: [MLBF5Game], store: MLBF5SplitsStore) -> [MLBF5Game] {
        games
            .compactMap { game -> (MLBF5Game, Double)? in
                guard let matchup = store.matchup(for: game.gamePk),
                      MLBF5Insight.summary(for: matchup) != nil else { return nil }
                let away = store.split(for: game, side: "away")
                let home = store.split(for: game, side: "home")
                let peak = [away?.f5LineEdge, home?.f5LineEdge, away?.rsDiffVsSeason, home?.rsDiffVsSeason]
                    .compactMap { $0 }.map(abs).max() ?? 0
                return (game, peak)
            }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }

    /// Standout L10 prop streaks across the slate: a real sample (≥5 games)
    /// leaning hard either way (≥70% over, or ≤30%), strongest lean first.
    static func props(_ matchups: [MLBPropMatchup]) -> [PlayerPropFeedItem] {
        PlayerPropFeed.items(from: matchups)
            .filter { item in
                let l10 = item.headline.computed.l10
                guard l10.games >= 5, let pct = l10.pct else { return false }
                return pct >= 70 || pct <= 30
            }
            .sorted { lhs, rhs in
                let lp = abs((lhs.headline.computed.l10.pct ?? 50) - 50)
                let rp = abs((rhs.headline.computed.l10.pct ?? 50) - 50)
                return lp > rp
            }
    }
}

/// Single source of truth for the trends/F5 rail cards so the rail and the
/// "See all" list render identically (one resolves the F5 badge off the store,
/// the other reuses it).
@MainActor
enum OutlierCardBuilder {
    static func trends(_ game: MLBGameTrends, stretches: Bool = false, onTap: @escaping () -> Void) -> OutlierInsightCard {
        let summary = MLBTrendsInsight.summary(for: game)
        return OutlierInsightCard(
            awayAbbr: abbr(game.awayTeam.teamName),
            homeAbbr: abbr(game.homeTeam.teamName),
            awayLogoURL: MLBTeams.info(for: game.awayTeam.teamName)?.logoUrl,
            homeLogoURL: MLBTeams.info(for: game.homeTeam.teamName)?.logoUrl,
            awayColor: color(game.awayTeam.teamName),
            homeColor: color(game.homeTeam.teamName),
            badge: summary.badge,
            verdict: summary.verdicts.first?.text ?? "Situational angles",
            timeLabel: MLBFormatting.gameTime(game.gameTimeEt),
            stretches: stretches,
            onTap: onTap
        )
    }

    static func f5(_ game: MLBF5Game, store: MLBF5SplitsStore?, stretches: Bool = false, onTap: @escaping () -> Void) -> OutlierInsightCard {
        let summary = store?.matchup(for: game.gamePk).flatMap { MLBF5Insight.summary(for: $0) }
        return OutlierInsightCard(
            awayAbbr: game.awayAbbr,
            homeAbbr: game.homeAbbr,
            awayLogoURL: MLBTeams.info(for: game.awayTeamName)?.logoUrl,
            homeLogoURL: MLBTeams.info(for: game.homeTeamName)?.logoUrl,
            awayColor: color(game.awayTeamName),
            homeColor: color(game.homeTeamName),
            badge: summary?.badge,
            verdict: summary?.verdicts.first?.text ?? "First-five splits",
            timeLabel: MLBFormatting.gameTime(game.gameTimeEt),
            stretches: stretches,
            onTap: onTap
        )
    }

    private static func abbr(_ name: String) -> String {
        MLBTeams.info(for: name)?.team ?? String(name.prefix(3)).uppercased()
    }

    private static func color(_ name: String) -> Color {
        Color(hex: Int(MLBTeams.colors(for: name).primary))
    }
}
