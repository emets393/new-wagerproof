import SwiftUI
import WagerproofDesign

/// Glassmorphic banner pinned to the top of each Outliers detail view.
/// Mirrors `wagerproof-mobile/components/ToolExplainerBanner.tsx` — a header
/// with the tool name + headline + description, then a list of "Example
/// signals" rows showing what kind of insights the tool surfaces.
struct ToolExplainerBannerView: View {
    let accentColor: Color
    let title: String
    let titleIcon: String
    let headline: String
    let description: String
    let examples: [Example]

    struct Example: Hashable {
        let icon: String
        let label: String
        let value: String
        var valueColor: Color? = nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle()
                .fill(accentColor)
                .frame(height: 3)

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: titleIcon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(accentColor)
                    Text(title.uppercased())
                        .font(.system(size: 12, weight: .bold))
                        .tracking(0.3)
                        .foregroundStyle(accentColor)
                }
                Text(headline)
                    .font(.system(size: 18, weight: .heavy))
                    .tracking(-0.5)
                    .foregroundStyle(Color.appTextPrimary)

                Text(description)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineSpacing(2)

                Divider().padding(.top, 8)

                Text("Example signals:")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                    .textCase(.uppercase)

                VStack(spacing: 6) {
                    ForEach(examples, id: \.self) { ex in
                        exampleRow(ex)
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 14)
        }
        .background(
            ZStack {
                LinearGradient(
                    colors: [accentColor.opacity(0.12), .clear, accentColor.opacity(0.12)],
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
    }

    private func exampleRow(_ ex: Example) -> some View {
        HStack(spacing: 8) {
            ZStack {
                Circle().fill(accentColor.opacity(0.2))
                Image(systemName: ex.icon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(accentColor)
            }
            .frame(width: 28, height: 28)

            Text(ex.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(ex.value)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(ex.valueColor ?? accentColor)
                .lineLimit(1)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 10)
        .background(Color.appSurfaceMuted.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}
