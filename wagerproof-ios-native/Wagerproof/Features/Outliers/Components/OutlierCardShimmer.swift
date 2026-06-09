import SwiftUI
import WagerproofDesign

/// Shimmer placeholder matching `OutlierMatchupCardView` dimensions — the 160pt
/// square gradient card plus the subtext label + pick-value lines beneath it.
/// Used by the Outliers hub sections and the Top Agent Picks feed.
///
/// Uses the unified `.shimmering()` sweep. The legacy `phase` parameter is kept
/// for call-site compatibility (the old per-card stagger is now superseded by
/// the single travelling highlight) but no longer affects timing.
struct OutlierCardShimmerView: View {
    /// Retained for source compatibility with existing call sites; ignored now
    /// that all cards share one continuous shimmer sweep.
    var phase: Int = 0

    private let cardSize: CGFloat = 160

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.appSkeleton)
                .frame(width: cardSize, height: cardSize)
            SkeletonBlock(width: 110, height: 12)   // subtext label
            SkeletonBlock(width: 70, height: 11)    // pick value
        }
        .frame(width: cardSize, alignment: .leading)
        .shimmering()
    }
}

#Preview {
    ScrollView(.horizontal) {
        HStack(spacing: 12) {
            ForEach(0..<4, id: \.self) { i in
                OutlierCardShimmerView(phase: i % 3)
            }
        }
        .padding()
    }
    .background(Color.appSurface)
}
