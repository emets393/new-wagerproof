import SwiftUI

/// Cascade-in entrance for freshly-loaded list rows / cards.
///
/// Each row fades and lifts into place with a short per-index delay, so a list
/// assembles top-to-bottom instead of every row popping in at once — the
/// "modern dynamic" feel when content replaces a shimmer skeleton.
///
/// The delay is capped at `maxStaggered` so rows deep in a long (lazy) list
/// don't wait noticeably as they scroll into view — only the first screenful
/// visibly cascades; everything past the cap shares the same small delay.
public struct StaggeredAppear: ViewModifier {
    let index: Int
    var delayPerItem: Double
    var maxStaggered: Int
    var yOffset: CGFloat

    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        index: Int,
        delayPerItem: Double = 0.04,
        maxStaggered: Int = 6,
        yOffset: CGFloat = 12
    ) {
        self.index = index
        self.delayPerItem = delayPerItem
        self.maxStaggered = maxStaggered
        self.yOffset = yOffset
    }

    public func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : yOffset)
            .onAppear {
                guard !shown else { return }
                guard !reduceMotion else { shown = true; return }
                let delay = Double(min(index, maxStaggered)) * delayPerItem
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82).delay(delay)) {
                    shown = true
                }
            }
    }
}

public extension View {
    /// Fade + lift a row into place, staggered by its position in the list.
    /// Apply to each loaded row/card (pass its index) so the list cascades in
    /// when it replaces a skeleton.
    func staggeredAppear(
        index: Int,
        delayPerItem: Double = 0.04,
        yOffset: CGFloat = 12
    ) -> some View {
        modifier(StaggeredAppear(index: index, delayPerItem: delayPerItem, yOffset: yOffset))
    }
}
