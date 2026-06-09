import SwiftUI
import WagerproofDesign
import WagerproofModels

/// CFB public betting bars used inside the CFB game bottom sheet. Mirrors
/// RN `components/cfb/PublicBettingBars.tsx`. CFB stores its splits as
/// labels rather than raw percentages (the `*_splits_label` columns), so
/// this view renders the labels as pill badges.
struct CFBPublicBettingBars: View {
    let game: CFBPrediction

    var body: some View {
        // Title now lives in the hosting `WidgetSection` ("Public Betting").
        VStack(alignment: .leading, spacing: 10) {
            VStack(spacing: 8) {
                if let ml = game.mlSplitsLabel {
                    labelRow(title: "Moneyline", label: ml)
                }
                if let spread = game.spreadSplitsLabel {
                    labelRow(title: "Spread", label: spread)
                }
                if let total = game.totalSplitsLabel {
                    labelRow(title: "Total", label: total)
                }
            }
        }
    }

    @ViewBuilder
    private func labelRow(title: String, label: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
            Spacer()
            Text(label.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.appAccentAmber.opacity(0.15), in: Capsule())
                .foregroundStyle(Color.appAccentAmber)
        }
    }
}
