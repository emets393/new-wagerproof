import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Tappable banner on the MLB Props tab — opens the Best Picks hub (today's
/// AI picks + graded performance). Rendered as a `HoneydewOptionCard` so it
/// reads as a sibling of the Games-page tool banners (e.g. MLB Regression
/// Report); the subtitle swaps in live graded performance once picks settle.
struct MLBBestPicksBanner: View {
    let store: MLBPlayerPropPicksStore
    var onTap: () -> Void

    private var overall: MLBPlayerPropPerformanceTotals { store.overall }

    private var subtitle: String {
        guard overall.settled > 0 else { return "Today's AI picks + track record" }
        return "\(overall.settled) settled · \(MLBPlayerPropPerformanceFormatting.formatUnits(overall.unitsWon)) · \(MLBPlayerPropPerformanceFormatting.formatPct(overall.winPct)) win"
    }

    var body: some View {
        HoneydewOptionCard(
            title: "Best MLB Props",
            subtitle: subtitle,
            actionWord: "View all",
            // Emerald gradient — winning/value picks read green, and it stays
            // distinct from the purple MLB Regression Report tool banner.
            primaryColor: Color(hex: 0x10B981),
            secondaryColor: Color(hex: 0x6EE7B7),
            symbols: ["target", "trophy.fill", "dollarsign.circle.fill", "chart.line.uptrend.xyaxis",
                      "flame.fill", "baseball.fill", "checkmark.seal.fill", "rosette", "bolt.fill", "star.fill"],
            seed: 0.21, speedFactor: 1.0, yJitter: -0.02,
            onTap: onTap
        )
        .accessibilityLabel("Best MLB Props")
        .accessibilityHint("Opens today's AI picks and performance history")
    }
}
