import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Per-game outlier detail, styled like an MLB matchup-details page: a
/// collapsing `TeamAuraBackground` + `MatchupGlassHero` hero over a stack of
/// Liquid Glass widgets — one per signal that flagged the game.
///
/// Phase 1 renders the Situational Trends and First-Five Splits widgets, reusing
/// the existing MLB components. New signal sources just add another `case` to
/// `widget(for:)`.
struct OutlierMatchupDetailView: View {
    let item: OutlierFeedItem

    /// Tapping the trends widget opens the full betting-trends sheet.
    @State private var trendsSheet: MLBGameTrends?

    var body: some View {
        CollapsingWidgetScroll(heroMaxHeight: 152, heroMinHeight: 96) { progress in
            TeamAuraBackground(
                awayColor: item.away.primary,
                homeColor: item.home.primary,
                progress: progress
            )
        } hero: { progress in
            hero(progress: progress)
        } content: {
            summaryCard
            ForEach(item.signals, id: \.self) { signal in
                widget(for: signal)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        // Same shared sheet the MLB Betting Trends tool presents — one trends
        // design across entry points. No "View matchup" action here: the user
        // is already on this matchup's detail page.
        .sheet(item: $trendsSheet) { game in
            BettingTrendsDetailSheet(
                awayName: game.awayTeam.teamName,
                homeName: game.homeTeam.teamName,
                timeDisplay: MLBTrendsMatrixAdapter.timeDisplay(for: game),
                stripeColors: MLBTrendsMatrixAdapter.stripeColors(for: game),
                accent: MLBTrendsMatrixAdapter.accent,
                sections: MLBTrendsMatrixAdapter.sections(for: game),
                guide: .mlb,
                avatar: MLBTrendsMatrixAdapter.avatarProvider(for: game)
            )
        }
    }

    // MARK: - Hero

    @ViewBuilder
    private func hero(progress p: CGFloat) -> some View {
        VStack(spacing: 6) {
            MatchupGlassHero(
                away: heroSide(item.away),
                home: heroSide(item.home),
                expandedStats: [],
                collapsedStats: [],
                progress: p
            )
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private func heroSide(_ team: OutlierFeedItem.Team) -> MatchupGlassHero.Side {
        MatchupGlassHero.Side(
            logoURL: team.logoURL,
            abbr: team.abbr,
            primary: team.primary,
            secondary: team.secondary,
            ml: nil
        )
    }

    // MARK: - "Why it's flagged" summary

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(item.signals, id: \.self) { signal in
                HStack(alignment: .top, spacing: 8) {
                    Text(signal.badge)
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.4)
                        .foregroundStyle(signal.tint)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(signal.tint.opacity(0.15)))
                        .overlay(Capsule().strokeBorder(signal.tint.opacity(0.35), lineWidth: 0.5))
                    Text(signal.headline)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .liquidGlassBackground(in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Per-signal widgets (reuse the existing MLB components)

    @ViewBuilder
    private func widget(for signal: OutlierSignal) -> some View {
        switch signal.kind {
        case .trends:
            if let trends = item.trends {
                WidgetCollapsingSection(title: "Situational Trends", systemImage: "chart.bar.xaxis", iconTint: signal.tint) {
                    MLBBettingTrendsMatchupCardView(game: trends) { trendsSheet = trends }
                }
            }
        case .f5:
            if let f5 = item.f5 {
                WidgetCollapsingSection(title: "First-Five Splits", systemImage: "5.circle.fill", iconTint: signal.tint) {
                    F5GameCardView(game: f5, lookup: item.f5Lookup)
                }
            }
        default:
            // Value / Fade / Accuracy / Pitcher widgets land in a later phase.
            EmptyView()
        }
    }
}
