import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Tappable banner on the MLB Props tab — opens the Best Picks hub (today's
/// AI picks + graded performance). Mirrors web `PerformanceSummary` link card.
struct MLBBestPicksBanner: View {
    let store: MLBPlayerPropPicksStore
    var onTap: () -> Void

    private var overall: MLBPlayerPropPerformanceTotals { store.overall }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.appPrimary.opacity(0.25), Color.appAccentBlue.opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Text("🎯")
                        .font(.system(size: 24))
                }
                .frame(width: 48, height: 48)
                .overlay(Circle().stroke(Color.appPrimary.opacity(0.45), lineWidth: 1.5))

                VStack(alignment: .leading, spacing: 3) {
                    Text("Best MLB Props")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                    if overall.settled > 0 {
                        Text(
                            "\(overall.settled) settled · \(MLBPlayerPropPerformanceFormatting.formatUnits(overall.unitsWon)) · \(MLBPlayerPropPerformanceFormatting.formatPct(overall.winPct)) win"
                        )
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(2)
                    } else {
                        Text("Today's AI picks + track record")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }

                Spacer(minLength: 4)

                VStack(alignment: .trailing, spacing: 2) {
                    Text("View all")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(
                    colors: [Color.appPrimary.opacity(0.14), Color.appAccentBlue.opacity(0.08)],
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.appPrimary.opacity(0.28), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Best MLB Props")
        .accessibilityHint("Opens today's AI picks and performance history")
    }
}
