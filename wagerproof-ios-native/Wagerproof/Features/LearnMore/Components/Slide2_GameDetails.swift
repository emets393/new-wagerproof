import SwiftUI
import WagerproofDesign

/// Mirrors `wagerproof-mobile/components/learn-wagerproof/slides/Slide2_GameDetails.tsx`.
///
/// Renders a miniature mockup of the Game Details bottom sheet — team gradient
/// header, model prediction block, public-betting split bar. Followed by a
/// "tap any game card" callout.
struct Slide2_GameDetails: View {
    // Hardcoded mock; matches RN `MOCK_DETAILS`.
    private let awayAbbr = "LAL"
    private let homeAbbr = "BOS"
    private let awaySpread = 4.5
    private let homeSpread = -4.5
    private let awayML = "+165"
    private let homeML = "-195"
    private let modelEdge = 2.3
    private let modelSpread = -6.8
    private let vegasSpread = -4.5
    private let publicHome = 62
    private let publicAway = 38

    // Team palette tints — Lakers / Celtics, matching the RN reference.
    private let lakersColor = Color(hex: 0x552583)
    private let celticsColor = Color(hex: 0x007A33)

    var body: some View {
        VStack(spacing: Spacing.lg) {
            sheetMockup
            calloutRow
        }
    }

    private var sheetMockup: some View {
        VStack(spacing: 0) {
            // Drag handle
            Capsule()
                .fill(Color.appTextMuted.opacity(0.4))
                .frame(width: 36, height: 4)
                .padding(.top, 8)
                .padding(.bottom, 4)

            // Team gradient header
            ZStack {
                LinearGradient(
                    colors: [
                        lakersColor.opacity(0.25),
                        .clear,
                        celticsColor.opacity(0.25),
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )

                HStack(alignment: .center) {
                    teamCol(abbr: awayAbbr, line: "+\(String(format: "%.1f", awaySpread)) | \(awayML)")
                    Spacer()
                    ZStack {
                        Circle().fill(Color.appTextMuted.opacity(0.15))
                        Image(systemName: "at")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .frame(width: 28, height: 28)
                    Spacer()
                    teamCol(abbr: homeAbbr, line: "\(String(format: "%.1f", homeSpread)) | \(homeML)")
                }
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.md)
            }

            // Model prediction
            VStack(alignment: .leading, spacing: Spacing.sm) {
                sectionHeader(icon: "brain.head.profile", iconColor: Color.appWin, title: "Model Prediction")
                VStack(spacing: 4) {
                    predRow(label: "Vegas Spread:", value: "BOS \(String(format: "%.1f", vegasSpread))", color: Color.appTextPrimary)
                    predRow(label: "Model Spread:", value: "BOS \(String(format: "%.1f", modelSpread))", color: Color.appTextPrimary)
                    predRow(label: "Edge:", value: "+\(String(format: "%.1f", modelEdge)) to BOS", color: Color.appWin, bold: true)
                }
                .padding(10)
                .background(Color.appSurfaceMuted)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 10)

            // Public betting
            VStack(alignment: .leading, spacing: Spacing.sm) {
                sectionHeader(icon: "person.3.fill", iconColor: Color.appPrimary, title: "Public Betting")
                HStack(spacing: 0) {
                    ZStack {
                        Color.appLoss
                        Text("\(publicAway)%")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(width: nil)
                    ZStack {
                        Color.appWin
                        Text("\(publicHome)%")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity)
                }
                .frame(height: 24)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                HStack {
                    Text(awayAbbr)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    Spacer()
                    Text(homeAbbr)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .padding(.horizontal, 4)
                .padding(.top, 4)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, 10)
        }
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.15), radius: 6, x: 0, y: 2)
    }

    private func teamCol(abbr: String, line: String) -> some View {
        VStack(spacing: 4) {
            ZStack {
                Circle().fill(Color.appSurfaceMuted)
                Text(String(abbr.prefix(1)))
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            .frame(width: 40, height: 40)
            Text(abbr)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text(line)
                .font(.system(size: 10))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    private func sectionHeader(icon: String, iconColor: Color, title: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(iconColor)
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    private func predRow(label: String, value: String, color: Color, bold: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: bold ? .bold : .semibold))
                .foregroundStyle(color)
        }
    }

    private var calloutRow: some View {
        HStack(spacing: 8) {
            Image(systemName: "hand.tap.fill")
                .font(.system(size: 13))
                .foregroundStyle(Color.appPrimary)
            Text("Tap any game card to view full analysis")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            Spacer()
        }
    }
}
