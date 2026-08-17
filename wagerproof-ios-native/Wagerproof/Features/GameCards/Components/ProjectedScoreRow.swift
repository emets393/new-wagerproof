import SwiftUI
import WagerproofDesign

/// The projected final score, drawn with the SAME team discs as the matchup
/// hero.
///
/// The first cut used `GameCardTeamAvatar`, whose solid primary→secondary
/// gradient disc reads as a completely different logo treatment from the
/// hero directly above it — two visual languages for the same two teams on one
/// screen. This uses the hero's Liquid Glass disc (team-tinted glass +
/// contrast plate) so the card looks like it belongs to the page.
struct ProjectedScoreRow: View {
    struct Side {
        var logoURL: String?
        var abbr: String
        var primary: Color
        var secondary: Color
        var score: Double
    }

    let away: Side
    let home: Side

    var discSize: CGFloat = 46

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: 12) {
            teamCluster(away)
            scoreText(away.score, isWinner: away.score > home.score)
            Text("–")
                .font(.system(size: 20, weight: .black))
                .foregroundStyle(Color.appTextMuted)
            scoreText(home.score, isWinner: home.score > away.score)
            teamCluster(home)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background {
            // A whisper of both team colors, away on the left and home on the
            // right — the same left/right identity the hero and the aura use.
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            away.primary.teamVisible(in: colorScheme).opacity(0.16),
                            Color.clear,
                            home.primary.teamVisible(in: colorScheme).opacity(0.16),
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
        }
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.35), lineWidth: 0.5)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Projected score: \(away.abbr) \(scoreLabel(away.score)), \(home.abbr) \(scoreLabel(home.score))"
        )
    }

    private func teamCluster(_ side: Side) -> some View {
        VStack(spacing: 5) {
            glassDisc(side)
            Text(side.abbr)
                .font(.system(size: 11, weight: .black))
                .tracking(0.6)
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
    }

    /// Mirrors `MatchupGlassHero.glassDisc`.
    @ViewBuilder
    private func glassDisc(_ side: Side) -> some View {
        let primary = side.primary.teamVisible(in: colorScheme)
        let secondary = side.secondary.teamVisible(in: colorScheme)
        let plate = logoPlate(for: primary)
        ZStack {
            if let logoURL = side.logoURL, let url = URL(string: logoURL) {
                CachedAsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        ZStack {
                            if let plate { Circle().fill(plate) }
                            img.resizable().scaledToFit()
                                .padding(plate != nil ? discSize * 0.07 : 0)
                        }
                    default:
                        initials(side)
                    }
                }
                .frame(width: discSize * 0.82, height: discSize * 0.82)
                .clipShape(Circle())
            } else {
                initials(side)
            }
        }
        .frame(width: discSize, height: discSize)
        .teamGlassDisc(primary: primary, secondary: secondary, tint: 0.5)
        .shadow(color: primary.opacity(0.28), radius: 5, x: 0, y: 2)
    }

    private func initials(_ side: Side) -> some View {
        Text(side.abbr)
            .font(.system(size: discSize * 0.3, weight: .bold))
            .foregroundStyle(.white)
    }

    /// The projected winner carries full weight; the other side steps back, so
    /// the result reads before either number does.
    private func scoreText(_ score: Double, isWinner: Bool) -> some View {
        Text(scoreLabel(score))
            .font(.system(size: 38, weight: .heavy, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(isWinner ? Color.appTextPrimary : Color.appTextSecondary)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }

    /// Whole points: a fast final-score read, not a decimal-precision claim.
    private func scoreLabel(_ score: Double) -> String {
        String(Int(score.rounded()))
    }

    /// Faint plate behind a same-color logo so it doesn't vanish into a
    /// same-hue glass tint. Mirrors `MatchupGlassHero`.
    private func logoPlate(for primary: Color) -> Color? {
        let lum = primary.relativeLuminance
        switch colorScheme {
        case .dark:
            return lum < 0.45 ? Color(white: 0.78).opacity(0.15) : nil
        default:
            return lum > 0.6 ? Color.black.opacity(0.55) : nil
        }
    }
}
