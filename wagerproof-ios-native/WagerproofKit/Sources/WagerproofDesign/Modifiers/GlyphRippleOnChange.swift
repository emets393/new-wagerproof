import SwiftUI

public extension EnvironmentValues {
    /// The pixel-background ripple channel for the current surface. A
    /// container that hosts a `PixelWaveBackground` injects its emitter here
    /// so descendant chips/cards can spawn ripples without prop-drilling.
    /// nil when no reactive background is present (modifiers become no-ops).
    @Entry var glyphRippleEmitter: GlyphRippleEmitter? = nil
}

public extension View {
    /// Fires a glyph-field ripple centered on this view whenever `trigger`
    /// changes — attach to selectable chips/cards so the pixel background
    /// reacts at the tapped element. Pairs with (does not replace) the
    /// page's own `.sensoryFeedback` haptics.
    ///
    /// Coordinates: the emitter expects the field's coordinate space; when
    /// the background fills the screen from the container root (onboarding,
    /// auth), global coordinates map 1:1. Recipe generalized from the
    /// agent-detail avatar easter egg (`AgentDetailHero`).
    func glyphRipple(on trigger: some Equatable) -> some View {
        modifier(GlyphRippleOnChange(trigger: trigger))
    }
}

private struct GlyphRippleOnChange<Trigger: Equatable>: ViewModifier {
    @Environment(\.glyphRippleEmitter) private var emitter
    let trigger: Trigger

    @State private var globalCenter: CGPoint = .zero

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .global)
            } action: { frame in
                globalCenter = CGPoint(x: frame.midX, y: frame.midY)
            }
            .onChange(of: trigger) { _, _ in
                emitter?.emit(at: globalCenter)
            }
    }
}
