import SwiftUI
import WagerproofDesign

/// Skeleton placeholder for `PropPlayerCard`, shown while the initial props
/// fetch is in flight (and there's no cached slate to fall back to).
/// Reproduces the real card's chrome (26pt lifted dark surface, hairline
/// border, soft shadow, leading-12/trailing-14/vertical-9 padding) and lays
/// skeleton shapes exactly where the headshot disc / name + vs-opponent / O-U
/// pills / labeled trend strip / bottom info row land, so the crossfade to
/// loaded content never shifts the layout.
///
/// The inner placeholder group carries the unified `.shimmering()` sweep; the
/// card chrome stays solid (applied via `.background` *after* the shimmer).
struct PropCardShimmer: View {
    @Environment(\.colorScheme) private var colorScheme

    // Same lifted card surface as PropPlayerCard.cardFill so the skeleton's
    // chrome is pixel-identical to the loaded card.
    private var cardFill: Color { Color(light: 0xFFFFFF, dark: 0x202024) }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        content
            .shimmering()
            .background {
                ZStack {
                    shape.fill(cardFill)
                    shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
                }
            }
            .clipShape(shape)
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            mainRow
            Divider().background(Color.appBorder.opacity(0.5))
            bottomInfoRow
        }
        .padding(.leading, 12)
        .padding(.trailing, 14)
        .padding(.vertical, 9)
    }

    // Main row: headshot disc · name/vs blocks · centered O/U pills · trend.
    private var mainRow: some View {
        HStack(alignment: .center, spacing: 10) {
            // Player headshot disc (44pt to match the real avatar frame).
            SkeletonCircle(44)

            // Player name + "vs OPP" beneath it.
            VStack(alignment: .leading, spacing: 4) {
                SkeletonBlock(width: 96, height: 13)
                SkeletonBlock(width: 48, height: 9)
            }

            Spacer(minLength: 8)

            // Over / Under odds pills.
            VStack(spacing: 4) {
                SkeletonCapsule(width: 58, height: 20)
                SkeletonCapsule(width: 58, height: 20)
            }

            Spacer(minLength: 8)

            // Labeled L10 trend strip (74x46 chart + tiny label above).
            VStack(alignment: .trailing, spacing: 3) {
                SkeletonBlock(width: 44, height: 8)
                SkeletonBlock(width: 74, height: 46, cornerRadius: 4)
            }
        }
    }

    // Bottom info row: BEST · L10 · HIT label/value pairs + time pill.
    private var bottomInfoRow: some View {
        HStack(alignment: .center, spacing: 16) {
            infoItemPlaceholder
            infoItemPlaceholder
            infoItemPlaceholder
            Spacer(minLength: 0)
            SkeletonCapsule(width: 44, height: 18)
        }
    }

    private var infoItemPlaceholder: some View {
        VStack(alignment: .leading, spacing: 3) {
            SkeletonBlock(width: 24, height: 8)
            SkeletonBlock(width: 40, height: 11)
        }
    }
}

#if DEBUG
#Preview {
    VStack(spacing: 8) {
        PropCardShimmer()
        PropCardShimmer()
    }
    .padding()
    .background(Color.appSurface)
}
#endif
