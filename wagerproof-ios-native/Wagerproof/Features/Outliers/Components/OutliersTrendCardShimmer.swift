import SwiftUI
import WagerproofDesign

/// Skeleton placeholder for `OutliersTrendCard`'s compact carousel layout —
/// reproduces the fixed 240pt card chrome (header avatar + title block, a
/// betting-line chip, three trend rows, and the footer divider) so the
/// crossfade to real cards never shifts the carousel's layout. Shared by
/// `OutliersTrendsView` (the Outliers tab) and Search's "Outliers" rail —
/// both render `OutliersTrendCard` in `.compact` mode.
///
/// Uses the unified `.shimmering()` sweep, applied to the inner placeholder
/// group only — the card chrome (fill + border) stays solid, added after.
struct OutliersTrendCardShimmer: View {
    private let compactRowCap = 3
    private let compactCardHeight: CGFloat = 240

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        content
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: compactCardHeight, alignment: .top)
            .shimmering()
            .background(Color.appSurfaceElevated, in: shape)
            .overlay(shape.stroke(Color.appBorder.opacity(0.35), lineWidth: 0.5))
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 9) {
            header
            SkeletonBlock(height: 36, cornerRadius: 10) // betting-line chip row
            VStack(alignment: .leading, spacing: 6) {
                ForEach(0..<compactRowCap, id: \.self) { _ in trendRow }
            }
            Spacer(minLength: 0)
            footer
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            SkeletonCircle(36)
            VStack(alignment: .leading, spacing: 3) {
                SkeletonBlock(width: 150, height: 13)
                SkeletonBlock(width: 100, height: 11)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                SkeletonBlock(width: 36, height: 9)
                SkeletonBlock(width: 30, height: 9)
            }
        }
    }

    private var trendRow: some View {
        HStack(alignment: .center, spacing: 7) {
            SkeletonBlock(width: 14, height: 14, cornerRadius: 4)
            SkeletonBlock(height: 10)
            SkeletonBlock(width: 26, height: 10)
        }
    }

    private var footer: some View {
        VStack(spacing: 6) {
            Rectangle()
                .fill(Color.appBorder.opacity(0.25))
                .frame(height: 0.5)
            HStack(spacing: 5) {
                SkeletonCapsule(width: 36, height: 16)
                SkeletonCapsule(width: 36, height: 16)
                SkeletonCapsule(width: 36, height: 16)
                Spacer(minLength: 4)
                SkeletonBlock(width: 60, height: 11)
            }
        }
    }
}

#Preview {
    ScrollView(.horizontal) {
        HStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                OutliersTrendCardShimmer()
                    .frame(width: 300)
            }
        }
        .padding()
    }
    .background(Color.appSurface)
}
