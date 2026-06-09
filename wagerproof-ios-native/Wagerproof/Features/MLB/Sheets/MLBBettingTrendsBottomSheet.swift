import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Detailed situational betting trends sheet for a selected MLB game.
/// Mirrors RN `components/MLBBettingTrendsBottomSheet.tsx`. Stacks seven
/// `MLBTrendsSituationSection` rows (last-game, home/away, fav/dog, rest
/// bucket, rest comparison, league, division) plus a "How To Use" guide.
///
/// The sheet is pushed by `MLBBettingTrendsStore.openTrendsSheet(_:)` and
/// dismissed via the sheet's standard drag-to-close gesture.
struct MLBBettingTrendsBottomSheet: View {
    let game: MLBGameTrends
    var onClose: () -> Void = {}

    // RN-defined tooltip copy — kept verbatim so parity holds.
    private static let lastGameTip = "How each team performs after a win vs. after a loss. Look for momentum or bounce-back patterns."
    private static let homeAwayTip = "Win rate and over rate when playing at home vs. on the road. Home-field advantage varies by park."
    private static let favDogTip = "Performance when favored vs. as underdog. Big win% gaps between the two teams suggest an ML edge."
    private static let restBucketTip = "Performance based on days of rest (1, 2-3, or 4+). Pitching rotations are heavily affected by rest."
    private static let restCompTip = "Rest advantage vs. opponent. Teams with more rest may have a pitching edge."
    private static let leagueTip = "Performance in league (AL/NL) vs. non-league games. Interleague games can shift dynamics."
    private static let divisionTip = "Performance in division vs. non-division games. Divisional familiarity can impact results."

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                headerCard
                MLBTrendsSituationSection(title: "Last Game Situation", icon: "clock",
                                          awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                                          situation: .lastGame, tooltip: Self.lastGameTip)
                MLBTrendsSituationSection(title: "Home / Away", icon: "house",
                                          awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                                          situation: .homeAway, tooltip: Self.homeAwayTip)
                MLBTrendsSituationSection(title: "Favorite / Underdog", icon: "rosette",
                                          awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                                          situation: .favDog, tooltip: Self.favDogTip)
                MLBTrendsSituationSection(title: "Rest Bucket", icon: "calendar.badge.clock",
                                          awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                                          situation: .restBucket, tooltip: Self.restBucketTip)
                MLBTrendsSituationSection(title: "Rest Comparison", icon: "scale.3d",
                                          awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                                          situation: .restComp, tooltip: Self.restCompTip)
                MLBTrendsSituationSection(title: "League Situation", icon: "shield",
                                          awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                                          situation: .league, tooltip: Self.leagueTip)
                MLBTrendsSituationSection(title: "Division Situation", icon: "trophy",
                                          awayTeam: game.awayTeam, homeTeam: game.homeTeam,
                                          situation: .division, tooltip: Self.divisionTip)
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
        let awayDisplay = MLBTeams.displayById(game.awayTeam.teamId)
        let homeDisplay = MLBTeams.displayById(game.homeTeam.teamId)
        let aw = MLBTeams.colors(for: game.awayTeam.teamName)
        let hm = MLBTeams.colors(for: game.homeTeam.teamName)

        VStack(spacing: 0) {
            LinearGradient(
                colors: [Color(hex: Int(aw.primary)), Color(hex: Int(aw.secondary)),
                         Color(hex: Int(hm.primary)), Color(hex: Int(hm.secondary))],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 4)
            VStack(spacing: 16) {
                Text("Situational Betting Trends")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                HStack(alignment: .top, spacing: 12) {
                    teamColumn(team: game.awayTeam, display: awayDisplay)
                    VStack(spacing: 8) {
                        Text("@")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted.opacity(0.5))
                        Text(formatGameTime(game.gameTimeEt))
                            .font(.system(size: 12, weight: .semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    teamColumn(team: game.homeTeam, display: homeDisplay)
                }
            }
            .padding(16)
        }
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.appBorder, lineWidth: 1))
    }

    @ViewBuilder
    private func teamColumn(team: MLBSituationalTrendRow, display: (abbrev: String, logoUrl: String)?) -> some View {
        VStack(spacing: 8) {
            MLBTeamLogo(logoUrl: display?.logoUrl, abbrev: display?.abbrev ?? "MLB", name: team.teamName, size: 64)
            Text(team.teamName)
                .font(.system(size: 12, weight: .semibold))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .foregroundStyle(Color.appTextPrimary)
        }
        .frame(maxWidth: .infinity)
    }

    private func formatGameTime(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "TBD" }
        return MLBFormatting.gameTime(raw)
    }

    // MARK: - How to use

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
                title: "Win % (Moneyline)",
                body: "Win percentage shows how often each team wins outright in this situation.\n\n• Strong signal: One team ≥60%, other ≤45% (≥15pt gap)\n• Key insight: Contrast matters — a big gap between teams suggests moneyline value"
            )
            guideSection(
                title: "Over % (Totals)",
                body: "• Strong Over: Both teams ≥55% Over rate\n• Strong Under: Both teams ≤45% Over rate\n• Key insight: For totals, alignment matters — both must lean the same way"
            )
            VStack(alignment: .leading, spacing: 6) {
                Text("Color Legend")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                legendRow(color: Color.appPrimary, text: "≥55% — Strong trend")
                legendRow(color: Color(hex: 0xEAB308), text: "45-54% — Neutral")
                legendRow(color: Color.appAccentRed, text: "<45% — Weak/Fade")
            }
            guideSection(
                title: "Quick Tips",
                body: "• Multiple situations aligning increases confidence\n• Rest and home/away are especially impactful in baseball\n• Division games carry familiarity edge — pitchers face same lineups more\n• Park factors can shift totals — pair with weather data on game cards"
            )
        }
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.appBorder, lineWidth: 1))
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
            Circle().fill(color).frame(width: 10, height: 10)
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
        }
    }
}
