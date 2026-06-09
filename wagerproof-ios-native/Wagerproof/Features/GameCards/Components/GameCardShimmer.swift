import SwiftUI
import WagerproofDesign

/// Skeleton placeholder for `GameRowCard`, shown while the initial games fetch
/// is in flight. Reproduces the real card's chrome (26pt Liquid-Glass surface,
/// hairline border, soft shadow) and lays skeleton blocks exactly where the
/// logos / abbreviations / lines pills / sparkline / edge pills land, so the
/// crossfade to loaded content never shifts the layout.
///
/// The inner placeholder group carries the unified `.shimmering()` sweep; the
/// card chrome stays solid (applied via `.background` *after* the shimmer).
struct GameCardShimmer: View {
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        content
            .shimmering()
            .background {
                ZStack {
                    shape.fill(.ultraThinMaterial).opacity(0.9)
                    shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
                }
            }
            .clipShape(shape)
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var content: some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 8) {
                // Main row: overlapping team discs + abbr/ML, lines pills, sparkline.
                HStack(alignment: .center, spacing: 10) {
                    VStack(spacing: 4) {
                        HStack(spacing: -10) {
                            SkeletonCircle(34)
                            SkeletonCircle(34)
                        }
                        HStack(spacing: 4) {
                            teamLinePlaceholder
                            teamLinePlaceholder
                        }
                    }
                    .frame(width: 96)

                    Spacer(minLength: 0)

                    // Spread + O/U pills.
                    VStack(alignment: .leading, spacing: 4) {
                        SkeletonCapsule(width: 70, height: 22)
                        SkeletonCapsule(width: 70, height: 22)
                    }

                    // Polymarket sparkline column.
                    VStack(alignment: .trailing, spacing: 2) {
                        SkeletonBlock(width: 44, height: 8)
                        SkeletonBlock(width: 98, height: 24, cornerRadius: 4)
                    }
                    .frame(width: 98)
                }

                Divider().background(Color.appBorder.opacity(0.5))

                // Bottom edge-pill row (O/U edge + ML edge).
                HStack(spacing: 6) {
                    SkeletonCapsule(width: 96, height: 22)
                    SkeletonCapsule(width: 80, height: 22)
                    Spacer(minLength: 0)
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, 6)
            .padding(.vertical, 9)

            // Upper-right time pill.
            SkeletonCapsule(width: 40, height: 16)
                .padding(.top, 8)
                .padding(.trailing, 10)
        }
    }

    private var teamLinePlaceholder: some View {
        VStack(spacing: 2) {
            SkeletonBlock(width: 24, height: 8)
            SkeletonBlock(width: 28, height: 9)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    VStack(spacing: 8) {
        GameCardShimmer()
        GameCardShimmer()
    }
    .padding()
    .background(Color.appSurface)
}
