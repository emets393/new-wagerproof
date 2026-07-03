import SwiftUI

/// A `PixelWaveBackground` whose accent tint can be ANIMATED.
///
/// `PixelGlyphField` samples its `accentColor` inside `Canvas.draw` each
/// frame, so handing it a new color snaps on the next frame — SwiftUI can't
/// interpolate a Canvas fill. This wrapper makes the transition smooth by
/// animating a scalar `blend` (via `Animatable`) and re-initializing the
/// background each frame with `from.mix(with: to, by: blend)`. The glyph
/// automaton inside the field is `@State` with stable identity, so colonies
/// keep evolving while their tint glides.
///
/// Usage (the onboarding container):
///
///     AnimatedAccentPixelWave(from: previousAccent, to: accent, blend: blend,
///                             rippleEmitter: emitter)
///     // on theme change:
///     from = currentMixed; to = newAccent; blend = 0
///     withAnimation(.appSlow) { blend = 1 }
public struct AnimatedAccentPixelWave: View, Animatable {
    public var from: Color
    public var to: Color
    public var blend: Double
    private let intensity: PixelWaveIntensity
    private let rippleEmitter: GlyphRippleEmitter?

    public init(
        from: Color,
        to: Color,
        blend: Double,
        intensity: PixelWaveIntensity = .ambient,
        rippleEmitter: GlyphRippleEmitter? = nil
    ) {
        self.from = from
        self.to = to
        self.blend = min(1, max(0, blend))
        self.intensity = intensity
        self.rippleEmitter = rippleEmitter
    }

    public var animatableData: Double {
        get { blend }
        set { blend = newValue }
    }

    /// The tint currently painted — callers snapshot this as the next
    /// transition's `from` so an interrupted animation restarts from the
    /// on-screen color rather than jumping.
    public var currentMixedColor: Color {
        from.mix(with: to, by: blend)
    }

    public var body: some View {
        PixelWaveBackground(
            accentColor: currentMixedColor,
            intensity: intensity,
            rippleEmitter: rippleEmitter
        )
    }
}
