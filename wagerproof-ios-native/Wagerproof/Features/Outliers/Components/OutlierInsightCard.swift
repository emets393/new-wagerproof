import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Compact matchup card for the Outliers hub's primitive-typed carousels
/// (Trends / First-5). Shows the matchup + that primitive's verdict badge and
/// one-line takeaway, sized to read as a thumbnail in a horizontal rail.
/// Tapping opens the primitive's detail sheet (the section owns the handler).
///
/// The badge text + tint come straight from the Kit `InsightVerdictBadge` so a
/// card here says exactly what the game-sheet widget's header badge says
/// ("6 SIGNALS", "NYY EDGE", "OVER") — one vocabulary across surfaces.
struct OutlierInsightCard: View {
    let awayAbbr: String
    let homeAbbr: String
    let awayLogoURL: String?
    let homeLogoURL: String?
    let awayColor: Color
    let homeColor: Color
    let badge: InsightVerdictBadge?
    let verdict: String
    let timeLabel: String?
    /// Fixed thumbnail width in a rail; full-width in a "See all" list.
    var stretches: Bool = false
    let onTap: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private let cardWidth: CGFloat = 178
    private let discSize: CGFloat = 30

    var body: some View {
        Button(action: onTap) {
            content
        }
        .buttonStyle(.plain)
    }

    private var content: some View {
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                discs
                Text("\(awayAbbr) @ \(homeAbbr)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
            if let badge {
                Text(badge.text)
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.4)
                    .foregroundStyle(Color(hex: Int(badge.tintHex)))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Color(hex: Int(badge.tintHex)).opacity(0.16), in: Capsule())
            }
            Text(verdict)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let timeLabel {
                Text(timeLabel)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
            }
        }
        .padding(12)
        .frame(width: stretches ? nil : cardWidth, alignment: .leading)
        .frame(maxWidth: stretches ? .infinity : nil, alignment: .leading)
        .background {
            ZStack {
                shape.fill(.ultraThinMaterial).opacity(colorScheme == .dark ? 0.8 : 1)
                shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
            }
        }
        .clipShape(shape)
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var discs: some View {
        LiquidGlassMergeContainer(spacing: 14) {
            HStack(spacing: -8) {
                disc(logoURL: awayLogoURL, color: awayColor, abbr: awayAbbr)
                disc(logoURL: homeLogoURL, color: homeColor, abbr: homeAbbr)
            }
        }
    }

    private func disc(logoURL: String?, color: Color, abbr: String) -> some View {
        let tint = color.teamVisible(in: colorScheme)
        return Group {
            if let logoURL, let url = URL(string: logoURL) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFit().padding(3)
                    } else {
                        initials(abbr, tint: tint)
                    }
                }
            } else {
                initials(abbr, tint: tint)
            }
        }
        .frame(width: discSize, height: discSize)
        .teamGlassDisc(primary: tint, secondary: tint)
    }

    private func initials(_ abbr: String, tint: Color) -> some View {
        Text(String(abbr.prefix(2)))
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(tint)
    }
}
