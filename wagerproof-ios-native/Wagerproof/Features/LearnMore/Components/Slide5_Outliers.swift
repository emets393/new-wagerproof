import SwiftUI
import WagerproofDesign

/// Mirrors `wagerproof-mobile/components/learn-wagerproof/slides/Slide5_Outliers.tsx`.
///
/// Two alert cards (one VALUE, one FADE) followed by a small legend explaining
/// what each alert type means. Each card carries a pro-lock badge in the
/// top-right corner per the RN design.
struct Slide5_Outliers: View {

    private struct Alert: Identifiable {
        let id = UUID()
        let kind: Kind
        let sport: String
        let matchup: String
        let description: String
        let confidence: Int
        let suggestedBet: String?
        enum Kind { case value, fade }
    }

    private let alerts: [Alert] = [
        Alert(
            kind: .value, sport: "NFL", matchup: "Patriots @ Dolphins",
            description: "Polymarket shows 67% on Patriots +3.5",
            confidence: 67, suggestedBet: nil
        ),
        Alert(
            kind: .fade, sport: "NFL", matchup: "Bills @ Jets",
            description: "Model predicts Bills at 82% - Historical fade opportunity",
            confidence: 82, suggestedBet: "Jets +7"
        ),
    ]

    var body: some View {
        VStack(spacing: Spacing.lg) {
            VStack(spacing: Spacing.md) {
                ForEach(alerts) { alert in
                    alertCard(alert)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.sm) {
                legendRow(color: Color(hex: 0x22C55E), text: "Value alerts: Market disagrees with Vegas")
                legendRow(color: Color(hex: 0xF59E0B), text: "Fade alerts: High confidence = fade opportunity")
            }
        }
    }

    private func alertCard(_ a: Alert) -> some View {
        let color: Color = a.kind == .value ? Color(hex: 0x22C55E) : Color(hex: 0xF59E0B)
        return VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Text(a.sport)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.appSurfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                HStack(spacing: 4) {
                    Image(systemName: a.kind == .value ? "chart.line.uptrend.xyaxis" : "bolt.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(color)
                    Text(a.kind == .value ? "VALUE" : "FADE")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(color)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(color.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                Text("\(a.confidence)%")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(color.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                Spacer()
            }

            Text(a.matchup)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)

            Text(a.description)
                .font(.system(size: 12))
                .lineSpacing(2)
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if let suggested = a.suggestedBet {
                HStack(spacing: 8) {
                    Text("Suggested:")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                    Text(suggested)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(color)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(color.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(color.opacity(0.3), lineWidth: 1)
                )
            }
        }
        .padding(Spacing.md)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(color.opacity(0.25), lineWidth: 1)
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(color)
                .frame(height: 3)
                .clipShape(
                    UnevenRoundedRectangle(
                        topLeadingRadius: 14, bottomLeadingRadius: 0,
                        bottomTrailingRadius: 0, topTrailingRadius: 14
                    )
                )
        }
        .overlay(alignment: .topTrailing) {
            HStack(spacing: 4) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(Color.appAccentAmber)
                Text("Pro Feature")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Color.appAccentAmber)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.appSurfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .padding(10)
        }
        .shadow(color: .black.opacity(0.1), radius: 3, x: 0, y: 1)
    }

    private func legendRow(color: Color, text: String) -> some View {
        HStack(spacing: 8) {
            Circle().fill(color).frame(width: 12, height: 12)
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            Spacer()
        }
    }
}
