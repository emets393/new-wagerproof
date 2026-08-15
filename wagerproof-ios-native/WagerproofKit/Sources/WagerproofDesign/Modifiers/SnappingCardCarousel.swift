import SwiftUI

/// Horizontal card rails that page one card at a time and always rest on the page gutter.
///
/// A plain `ScrollView(.horizontal)` stops wherever momentum leaves it, usually with a card
/// sliced by the screen edge and no clear "current" card. This pins every resting position
/// instead: each swipe pulls the next card fully into view at `inset` from the leading edge,
/// with the following card peeking behind it, and a light impact ticks as each card lands.
///
/// Apply to the `ScrollView`; the stack inside MUST carry `.scrollTargetLayout()` or nothing
/// snaps. Pass the gutter here rather than padding the stack — `safeAreaPadding` is what puts
/// the snap target ON the gutter instead of flush against the raw scroll-view edge, which is
/// the whole point. Rails that bleed edge-to-edge keep their outer negative padding.
public struct SnappingCardCarousel: ViewModifier {
    let inset: CGFloat

    /// Leading-most card. SwiftUI rewrites this as the rail crosses each card, so a fling
    /// across several cards ticks once per card, like a picker's detents.
    @State private var restingCard: AnyHashable?

    public init(inset: CGFloat) {
        self.inset = inset
    }

    public func body(content: Content) -> some View {
        content
            .scrollTargetBehavior(.viewAligned)
            .safeAreaPadding(.horizontal, inset)
            .scrollPosition(id: $restingCard, anchor: .leading)
            .sensoryFeedback(.impact(weight: .light, intensity: 0.55), trigger: restingCard) { old, new in
                // Skip nil→first-card on layout and card→nil when a filter empties the
                // rail — neither is a movement the user made.
                old != nil && new != nil
            }
    }
}

public extension View {
    /// Snap-to-gutter paging + a haptic per card. See ``SnappingCardCarousel``.
    /// - Parameter inset: the page gutter cards should come to rest against.
    func snappingCardCarousel(inset: CGFloat) -> some View {
        modifier(SnappingCardCarousel(inset: inset))
    }
}
