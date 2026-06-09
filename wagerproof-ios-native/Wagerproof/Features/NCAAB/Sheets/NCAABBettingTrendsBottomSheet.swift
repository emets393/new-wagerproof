import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Detailed situational betting trends sheet for a selected NCAAB game.
/// Mirrors RN `components/NCAABBettingTrendsBottomSheet.tsx`. Stacks five
/// `NCAABTrendsSituationSection` rows (last-game, fav/dog, side+fav/dog,
/// rest bucket, rest comparison) plus a "How To Use" guide.
///
/// The sheet is pushed by `NCAABBettingTrendsStore.openTrendsSheet(_:)` and
/// dismissed via the sheet's standard drag-to-close gesture.
struct NCAABBettingTrendsBottomSheet: View {
    let game: NCAABGameTrendsData
    var onClose: () -> Void = {}

    // RN-defined tooltip copy — kept identical so reviewer parity holds.
    private static let lastGameTip = "How each team performs ATS and O/U after a win vs. after a loss. Look for momentum patterns."
    private static let favDogTip = "Performance when favored vs. as underdog. Strong ATS contrast (≥15%) suggests an edge."
    private static let sideFavDogTip = "Combines home/away with favorite/underdog role. Home favorites and away underdogs often have distinct patterns."
    private static let restBucketTip = "Performance based on days of rest (1, 2-3, or 4+). Fatigue or rust can impact both ATS and totals."
    private static let restCompTip = "Rest advantage vs. opponent. Teams with more rest often cover, but totals can swing either way."

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                headerCard
                NCAABTrendsSituationSection(
                    title: "Last Game Situation",
                    icon: "clock",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .lastGame,
                    tooltip: Self.lastGameTip
                )
                NCAABTrendsSituationSection(
                    title: "Favorite/Underdog Situation",
                    icon: "rosette",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .favDog,
                    tooltip: Self.favDogTip
                )
                NCAABTrendsSituationSection(
                    title: "Side Spread Situation",
                    icon: "house",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .sideFavDog,
                    tooltip: Self.sideFavDogTip
                )
                NCAABTrendsSituationSection(
                    title: "Rest Bucket",
                    icon: "calendar.badge.clock",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .restBucket,
                    tooltip: Self.restBucketTip
                )
                NCAABTrendsSituationSection(
                    title: "Rest Comparison",
                    icon: "scale.3d",
                    awayTeam: game.awayTeam,
                    homeTeam: game.homeTeam,
                    situationType: .restComp,
                    tooltip: Self.restCompTip
                )
                howToUseSection
                Spacer().frame(height: 40)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
        .background(Color.appSurface)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
    }

    // MARK: - Header

    @ViewBuilder
    private var headerCard: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [
                    TeamColorPair.neutralNCAAB.primary,
                    TeamColorPair.neutralNCAAB.secondary,
                    TeamColorPair.neutralNCAAB.primary.opacity(0.8),
                    TeamColorPair.neutralNCAAB.secondary.opacity(0.8)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 4)
            VStack(spacing: 16) {
                Text("Situational Betting Trends")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                HStack(alignment: .top, spacing: 12) {
                    teamColumn(name: game.awayTeam.teamName)
                    VStack(spacing: 8) {
                        Text("@")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted.opacity(0.5))
                        Text(formatTipoff(game.tipoffTime))
                            .font(.system(size: 12, weight: .semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    teamColumn(name: game.homeTeam.teamName)
                }
            }
            .padding(16)
        }
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func teamColumn(name: String) -> some View {
        VStack(spacing: 8) {
            GameCardTeamAvatar(teamName: name, sport: "ncaab", size: 64)
            Text(name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }

    /// Format tipoff time mirrors RN `formatTipoffTime` — best-effort parse
    /// of the UTC ISO timestamp into an EST/EDT `h:mm a` string.
    private func formatTipoff(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "TBD" }
        return GameCardFormatting.convertTimeToEST(raw)
    }

    // MARK: - How to use guide

    @ViewBuilder
    private var howToUseSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Image(systemName: "book.fill")
                    .foregroundStyle(Color.appAccentBlue)
                Text("How to Use This Tool")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            guideSection(
                title: "ATS (Against The Spread)",
                body: "ATS means betting on whether a team will \"cover\" the point spread — win by more than the spread (favorites) or lose by less than the spread (underdogs).\n\n• Strong signal: One team ≥60% ATS, other ≤45% (≥15pt difference)\n• Weak/No signal: Both teams 48-55% or both strong\n• Key insight: For ATS, contrast matters more than alignment"
            )
            guideSection(
                title: "Over/Under (Totals)",
                body: "• Strong Over: Both teams ≥60% Over rate\n• Strong Under: Both teams ≥60% Under rate\n• No signal: One team leans Over, other leans Under\n• Key insight: For totals, alignment matters — both must agree"
            )
            VStack(alignment: .leading, spacing: 6) {
                Text("Color Legend")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                legendRow(color: Color(red: 0.13, green: 0.77, blue: 0.37), text: "≥55% — Strong trend")
                legendRow(color: Color(red: 0.92, green: 0.70, blue: 0.03), text: "45-54% — Neutral")
                legendRow(color: Color(red: 0.94, green: 0.27, blue: 0.27), text: "<45% — Weak/Fade")
            }
            guideSection(
                title: "Quick Tips",
                body: "• Require ≥4 game sample size for reliable signals\n• Multiple situations aligning increases confidence\n• Role-based trends (home favorite, away dog) are most predictive\n• Rest advantages amplify existing ATS edges"
            )
        }
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func guideSection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text(body)
                .font(.system(size: 12))
                .lineSpacing(4)
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    @ViewBuilder
    private func legendRow(color: Color, text: String) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 10, height: 10)
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
        }
    }
}
