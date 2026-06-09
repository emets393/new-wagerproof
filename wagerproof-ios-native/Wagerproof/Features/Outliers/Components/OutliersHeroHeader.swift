import SwiftUI
import WagerproofDesign

/// Glassmorphic hero banner at the top of the Outliers hub. Mirrors
/// `wagerproof-mobile/components/OutliersHeroHeader.tsx` — a tri-color
/// gradient accent stripe over a subtle background gradient, headline +
/// subheadline, plus a 3-step "We Scan → We Flag → You Act" flow.
struct OutliersHeroHeaderView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            LinearGradient(
                colors: [Color(hex: 0x00E676), Color(hex: 0x00B0FF), Color(hex: 0x7C4DFF)],
                startPoint: .leading, endPoint: .trailing
            )
            .frame(height: 3)

            VStack(alignment: .leading, spacing: 8) {
                Text("Spot the setup before the outcome.")
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .tracking(-0.5)

                Text("We scan every game across every sport for statistical outliers — the rare conditions that historically lead to profitable betting opportunities. When the data lines up like this, you want to know about it.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineSpacing(2)

                Divider()
                    .padding(.top, 8)

                HStack(alignment: .top, spacing: 0) {
                    flowStep(
                        icon: "dot.radiowaves.left.and.right",
                        iconColor: Color(hex: 0x22C55E),
                        iconBg: Color(hex: 0x22C55E).opacity(0.15),
                        title: "We Scan",
                        desc: "Every line, trend, and model signal across 5 sports"
                    )
                    chevron
                    flowStep(
                        icon: "chart.bar.xaxis",
                        iconColor: Color(hex: 0xF59E0B),
                        iconBg: Color(hex: 0xF59E0B).opacity(0.15),
                        title: "We Flag",
                        desc: "Rare setups where history says the edge is real"
                    )
                    chevron
                    flowStep(
                        icon: "scope",
                        iconColor: Color(hex: 0x7C4DFF),
                        iconBg: Color(hex: 0x7C4DFF).opacity(0.15),
                        title: "You Act",
                        desc: "Get the alert before the line moves"
                    )
                }
                .padding(.top, 8)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 18)
        }
        .background(
            ZStack {
                LinearGradient(
                    colors: [
                        Color(hex: 0x00E676).opacity(0.10),
                        Color(hex: 0x00B0FF).opacity(0.06),
                        Color(hex: 0x7C4DFF).opacity(0.10),
                    ],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                Color.appSurfaceElevated.opacity(0.6)
            }
            .background(.ultraThinMaterial)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.6), lineWidth: 1)
        )
        .padding(.horizontal, Spacing.lg)
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Color.appTextSecondary)
            .padding(.top, 10)
    }

    private func flowStep(icon: String, iconColor: Color, iconBg: Color, title: String, desc: String) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().fill(iconBg)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(iconColor)
            }
            .frame(width: 40, height: 40)

            Text(title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)

            Text(desc)
                .font(.system(size: 11))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity)
    }
}
