import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Bottom sheet that reveals a single Outliers trend card in full. Carousel
/// cards are a fixed-size compact preview (capped rows + "+N more" footer);
/// tapping one presents this sheet so the entire card — every betting line and
/// every trend row — appears here instead of growing the card vertically in the
/// rail. Shared by the Outliers tab carousels and the Search "Outliers" rail.
///
/// Presentation: the sheet background is cleared (`.presentationBackground(.clear)`)
/// so ONLY the card floats — no nav bar, no surface panel behind it — while the
/// system still dims the page behind. The detent is sized to the measured card
/// height so the sheet hugs the card with even padding (no dead space beneath).
/// The drag indicator is the sole dismiss affordance: drag it down (or tap the
/// dimmed backdrop) to close.
struct OutliersTrendDetailSheet: View {
    let card: OutliersTrendsCard
    var sport: OutliersTrendsSport = .nfl
    var game: OutliersTrendsGame?

    /// Measured height of the card + its padding. Drives a fit-to-content detent
    /// so the sheet is exactly as tall as the card (a tall card clamps to the
    /// screen and the ScrollView takes over).
    @State private var contentHeight: CGFloat = 0

    // Even top/bottom insets so the card sits centered with matching whitespace;
    // the top inset also clears the system drag grabber.
    private static let vInset: CGFloat = 24

    var body: some View {
        ScrollView {
            // Same card the carousel renders, just unbounded — it carries its own
            // rounded surface, so with a clear sheet background it reads as a lone
            // floating card.
            OutliersTrendCard(card: card, sport: sport, game: game, displayMode: .expanded)
                .padding(.horizontal, 20)
                .padding(.vertical, Self.vInset)
                .background(
                    GeometryReader { proxy in
                        Color.clear
                            .preference(key: SheetContentHeightKey.self, value: proxy.size.height)
                    }
                )
        }
        .scrollIndicators(.hidden)
        .onPreferenceChange(SheetContentHeightKey.self) { contentHeight = $0 }
        .presentationDetents(detents)
        .presentationDragIndicator(.visible)
        .presentationBackground(.clear)
    }

    /// Fit-to-content once measured; a medium fallback until the first layout
    /// pass reports a height.
    private var detents: Set<PresentationDetent> {
        contentHeight > 0 ? [.height(contentHeight)] : [.medium]
    }
}

/// Reports the card's laid-out height up to the sheet so the detent can hug it.
private struct SheetContentHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
