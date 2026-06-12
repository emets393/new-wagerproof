import SwiftUI
import WagerproofDesign

/// Per-game situational betting trends detail sheet, shared by the MLB,
/// NBA, and NCAAB trends list pages. Ports the RN `*BettingTrendsBottomSheet`
/// trio onto a single sport-agnostic layout: header card → optional
/// "View matchup" secondary action → full `TrendsMatrixView` (every
/// situational pair, records, consensus badges) → "How to Use" guide.
///
/// The trends matrix is the sheet's PRIMARY content — the game matchup page
/// is reachable through the demoted "View matchup" button (the inverse of
/// the old iOS routing, which made the trends detail unreachable).
struct BettingTrendsDetailSheet: View {
    /// Which "How to Use This Tool" copy variant to render (RN keeps two:
    /// Win%/Over% for MLB, ATS/O-U for the basketball sports).
    enum Guide {
        case mlb, basketball
    }

    let awayName: String
    let homeName: String
    let timeDisplay: String
    let stripeColors: [Color]
    let accent: Color
    let sections: [TrendsMatrixSection]
    let guide: Guide
    let avatar: (TrendsTeamSide, CGFloat) -> AnyView
    /// Old `openGamePage()` navigation, demoted to a secondary button.
    /// nil (game not in the Games-tab cache) hides the button entirely.
    var onViewMatchup: (() -> Void)? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                headerCard
                TrendsMatrixView(sections: sections, accent: accent, avatar: avatar)
                howToUseSection
                Spacer().frame(height: 40)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
        .background(Color.appSurface)
        // Spec §1 freezes one expand presentation for all three insight
        // widgets — full-height, matching MatchupPropsDetailSheet/F5SplitsDetailSheet.
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.disabled)
    }

    // MARK: - Header

    @ViewBuilder
    private var headerCard: some View {
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        VStack(spacing: 0) {
            LinearGradient(colors: stripeColors, startPoint: .leading, endPoint: .trailing)
                .frame(height: 4)
            VStack(spacing: 16) {
                Text("Situational Betting Trends")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                HStack(alignment: .top, spacing: 12) {
                    teamColumn(side: .away, name: awayName)
                    VStack(spacing: 8) {
                        Text("@")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary.opacity(0.5))
                        Text(timeDisplay)
                            .font(.system(size: 12, weight: .semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    teamColumn(side: .home, name: homeName)
                }
                if let onViewMatchup {
                    Button(action: onViewMatchup) {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.up.right.square")
                                .font(.system(size: 13, weight: .semibold))
                            Text("View matchup")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(accent.opacity(0.12), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
        .background(shape.fill(.ultraThinMaterial))
        .clipShape(shape)
        .overlay(shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    @ViewBuilder
    private func teamColumn(side: TrendsTeamSide, name: String) -> some View {
        VStack(spacing: 8) {
            avatar(side, 64)
            Text(name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - How to use guide (RN copy, verbatim per variant)

    @ViewBuilder
    private var howToUseSection: some View {
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                Image(systemName: "book.fill")
                    .foregroundStyle(guide == .mlb ? Color(hex: 0x16A34A) : Color.appAccentBlue)
                Text("How to Use This Tool")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            switch guide {
            case .mlb:
                guideBlock(
                    title: "Win % (Moneyline)",
                    body: "Win percentage shows how often each team wins outright in this situation.\n\n• Strong signal: One team ≥60%, other ≤45% (≥15pt gap)\n• Key insight: Contrast matters — a big gap between teams suggests moneyline value"
                )
                guideBlock(
                    title: "Over % (Totals)",
                    body: "• Strong Over: Both teams ≥55% Over rate\n• Strong Under: Both teams ≤45% Over rate\n• Key insight: For totals, alignment matters — both must lean the same way"
                )
            case .basketball:
                guideBlock(
                    title: "ATS (Against The Spread)",
                    body: "ATS means betting on whether a team will \"cover\" the point spread — win by more than the spread (favorites) or lose by less than the spread (underdogs).\n\n• Strong signal: One team ≥60% ATS, other ≤45% (≥15pt difference)\n• Weak/No signal: Both teams 48-55% or both strong\n• Key insight: For ATS, contrast matters more than alignment"
                )
                guideBlock(
                    title: "Over/Under (Totals)",
                    body: "• Strong Over: Both teams ≥60% Over rate\n• Strong Under: Both teams ≥60% Under rate\n• No signal: One team leans Over, other leans Under\n• Key insight: For totals, alignment matters — both must agree"
                )
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Color Legend")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                legendRow(color: Color(hex: 0x22C55E), text: "≥55% — Strong trend")
                legendRow(color: Color(hex: 0xEAB308), text: "45-54% — Neutral")
                legendRow(color: Color(hex: 0xEF4444), text: "<45% — Weak/Fade")
            }
            switch guide {
            case .mlb:
                guideBlock(
                    title: "Quick Tips",
                    body: "• Multiple situations aligning increases confidence\n• Rest and home/away are especially impactful in baseball\n• Division games carry familiarity edge — pitchers face same lineups more\n• Park factors can shift totals — pair with weather data on game cards"
                )
            case .basketball:
                guideBlock(
                    title: "Quick Tips",
                    body: "• Require ≥4 game sample size for reliable signals\n• Multiple situations aligning increases confidence\n• Role-based trends (home favorite, away dog) are most predictive\n• Rest advantages amplify existing ATS edges"
                )
            }
        }
        .padding(16)
        .background(shape.fill(.ultraThinMaterial))
        .clipShape(shape)
        .overlay(shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    @ViewBuilder
    private func guideBlock(title: String, body: String) -> some View {
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

/// Remote team logo with the initials-on-gradient circle as fallback —
/// used by the NBA/NCAAB trends adapters (RN passes the resolved ESPN
/// logoUrl into the sheet avatars; initials only when no logo resolves).
struct TrendsTeamAvatar: View {
    let logoUrl: String?
    let teamName: String
    let sport: String
    let size: CGFloat
    var colors: TeamColorPair? = nil

    var body: some View {
        if let logoUrl, let url = URL(string: logoUrl) {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFit()
                } else {
                    GameCardTeamAvatar(teamName: teamName, sport: sport, size: size, colors: colors)
                }
            }
            .frame(width: size, height: size)
        } else {
            GameCardTeamAvatar(teamName: teamName, sport: sport, size: size, colors: colors)
        }
    }
}
