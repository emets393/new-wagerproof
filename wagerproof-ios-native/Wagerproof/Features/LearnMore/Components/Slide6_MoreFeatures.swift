import SwiftUI
import WagerproofDesign

/// Mirrors `wagerproof-mobile/components/learn-wagerproof/slides/Slide6_MoreFeatures.tsx`.
///
/// 2x2 grid of gradient feature cards. Each card has a translucent rounded
/// icon container, a bold title, and a subtitle. Colors match the RN gradients
/// (Discord blurple, purple, emerald, amber).
struct Slide6_MoreFeatures: View {

    private struct Feature: Identifiable {
        let id = UUID()
        let systemImage: String
        let title: String
        let description: String
        let colors: [Color]
    }

    private let features: [Feature] = [
        Feature(systemImage: "bubble.left.and.bubble.right.fill",
                title: "Discord Community",
                description: "Join 500+ bettors for real-time alerts",
                colors: [Color(hex: 0x5865F2), Color(hex: 0x7289DA)]),
        Feature(systemImage: "chart.line.uptrend.xyaxis",
                title: "Betting Trends",
                description: "NBA situational trends, ATS records",
                colors: [Color(hex: 0x8B5CF6), Color(hex: 0xA78BFA)]),
        Feature(systemImage: "sportscourt.fill",
                title: "Live Scoreboard",
                description: "Real-time scores with prediction overlay",
                colors: [Color(hex: 0x10B981), Color(hex: 0x34D399)]),
        Feature(systemImage: "checkmark.seal.fill",
                title: "Bet Slip Grader",
                description: "Grade your parlays before placing",
                colors: [Color(hex: 0xF59E0B), Color(hex: 0xFBBF24)]),
    ]

    var body: some View {
        VStack(spacing: Spacing.md) {
            HStack(spacing: Spacing.md) {
                card(features[0])
                card(features[1])
            }
            HStack(spacing: Spacing.md) {
                card(features[2])
                card(features[3])
            }
        }
    }

    private func card(_ f: Feature) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.2))
                Image(systemName: f.systemImage)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(width: 40, height: 40)

            Text(f.title)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)

            Text(f.description)
                .font(.system(size: 11))
                .lineSpacing(2)
                .foregroundStyle(Color.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
        .background(
            LinearGradient(colors: f.colors, startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
