import SwiftUI
import WagerproofDesign

/// Shimmer placeholder for `LiveScoreCard`. Reproduces the compact tile's exact
/// bounding box (50%-width grid cell: 8pt surface, hairline border, the
/// team-abbr/score row plus a centered prediction line) so the loaded-state
/// crossfade doesn't shift the grid.
///
/// Uses the unified `.shimmering()` sweep — applied to the inner placeholder
/// group, with the solid `appSurface` chrome added afterward.
struct LiveScoreCardShimmer: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                HStack(spacing: 4) {
                    SkeletonBlock(width: 26, height: 12)   // away abbr
                    SkeletonBlock(width: 18, height: 14)   // away score
                    SkeletonBlock(width: 18, height: 14)   // home score
                    SkeletonBlock(width: 26, height: 12)   // home abbr
                }
                Spacer()
                SkeletonBlock(width: 34, height: 10)       // period / clock
            }
            HStack {
                Spacer()
                SkeletonCapsule(width: 64, height: 10)     // prediction line
                Spacer()
            }
            .padding(.top, 4)
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .shimmering()
        .background(Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.appBorder, lineWidth: 1)
        )
    }
}

#Preview {
    LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
        ForEach(0..<6, id: \.self) { _ in
            LiveScoreCardShimmer()
        }
    }
    .padding()
    .background(Color.appSurface)
}
