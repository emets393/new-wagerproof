import SwiftUI
import WagerproofDesign

/// The Outliers hub's how-to header, restyled as a tool button (the same
/// `HoneydewOptionCard` treatment used for the Games-page tool banners): a
/// gradient card with drifting icon chrome and a "Learn more" action pill that
/// opens the `OutliersLearnMoreSheet` glass sheet.
///
/// Replaces the old always-expanded `OutliersHeroHeaderView` — the hub now
/// leads with the merged outlier list and tucks the explanation behind a tap.
struct OutliersHowToBanner: View {
    @State private var showLearnMore = false

    var body: some View {
        HoneydewOptionCard(
            title: "How Outliers work",
            subtitle: "Spot the setup before the outcome",
            actionWord: "Learn more",
            // Outliers' signature scan→flag→act gradient (cyan → violet).
            primaryColor: Color(hex: 0x00B0FF),
            secondaryColor: Color(hex: 0x7C4DFF),
            symbols: [
                "dot.radiowaves.left.and.right", "chart.line.uptrend.xyaxis",
                "scope", "bolt.fill", "target", "sparkles", "chart.bar.xaxis"
            ],
            seed: 0.21,
            onTap: { showLearnMore = true }
        )
        .padding(.horizontal, Spacing.lg)
        .sheet(isPresented: $showLearnMore) {
            OutliersLearnMoreSheet()
        }
    }
}
