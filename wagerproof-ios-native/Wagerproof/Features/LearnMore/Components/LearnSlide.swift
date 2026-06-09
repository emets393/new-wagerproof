import SwiftUI
import WagerproofDesign

/// Single carousel slide. Mirrors `wagerproof-mobile/components/learn-wagerproof/LearnSlide.tsx`.
///
/// Layout:
///   1. Glassmorphic title card (icon badge + title + description).
///   2. Custom mockup content (one of the `Slide<N>_*` views).
///   3. Optional "Why this matters" glassmorphic callout pinned beneath.
///
/// The RN version uses `BlurView` + `LinearGradient` for the glass effect. In
/// SwiftUI we lean on `.background(.ultraThinMaterial)` for the same visual,
/// with a brand-green tint gradient overlay for the value-prop card so the
/// accent reads even on light mode where `ultraThinMaterial` is near-white.
struct LearnSlide<Content: View>: View {
    let systemImage: String
    let title: String
    let description: String
    let valueProposition: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.md) {
                titleCard
                content()
                if let valueProposition {
                    valueCard(valueProposition)
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.xs)
            .padding(.bottom, Spacing.lg)
        }
    }

    // MARK: - Cards

    private var titleCard: some View {
        HStack(spacing: Spacing.md) {
            // Icon badge — gradient green pill matching RN `iconBadge`.
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color.appPrimary, Color.appPrimaryStrong],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.black)
            }
            .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(description)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, Spacing.lg)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
        )
    }

    private func valueCard(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "lightbulb.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                Text("Why This Matters")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.5)
                    .textCase(.uppercase)
                    .foregroundStyle(Color.appPrimary)
            }
            Text(text)
                .font(.system(size: 12))
                .lineSpacing(2)
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [
                    Color.appPrimary.opacity(0.10),
                    Color.appPrimaryStrong.opacity(0.05),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.appPrimary.opacity(0.2), lineWidth: 1)
        )
    }
}
