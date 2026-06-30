import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Shared "pixelwave" backdrop: a near-black gradient under three breathing wavy
/// shadow sheets (`WaveBackground`) with the animated `PixelGlyphField` on top.
/// Introduced on the auth gate (`AuthGateBackground`) and reused as the basis for
/// the agent detail surfaces, where it's tinted per-agent via `accentColor`.
///
/// `progress` (0 = expanded … 1 = collapsed) gently calms the wave + glyph layer
/// so the field settles as a collapsing hero shrinks. The opaque gradient base
/// never fades, so this can double as a collapsing hero's masking background.
///
/// `screenAnchored` pins the wave + glyph field to GLOBAL screen coordinates and
/// sizes it to the full screen. A `CollapsingWidgetScroll` paints the same
/// background twice — once full-bleed behind the page, once as the opaque hero
/// mask — and without anchoring each instance would compute its own grid from its
/// own (differently clipped) frame, so the two wouldn't line up at the hero's
/// bottom seam. Anchored, both render an identical full-screen field: the waves
/// (pure functions of time) align exactly and the sparse glyph colonies share one
/// grid. Mirrors the global-anchoring trick `TeamAuraBackground` uses.
public struct PixelWaveBackground: View {
    private let accentColor: Color
    private let progress: CGFloat
    private let screenAnchored: Bool
    private let rippleEmitter: GlyphRippleEmitter?

    public init(
        accentColor: Color = .appPrimary,
        progress: CGFloat = 0,
        screenAnchored: Bool = false,
        rippleEmitter: GlyphRippleEmitter? = nil
    ) {
        self.accentColor = accentColor
        self.progress = progress
        self.screenAnchored = screenAnchored
        self.rippleEmitter = rippleEmitter
    }

    public var body: some View {
        // Field opacity eases 1.0 → 0.5 as the hero collapses, so the animation
        // calms into a compact bar instead of churning behind the small stats.
        let calm = 1 - 0.5 * min(1, max(0, progress))
        ZStack {
            // Opaque near-black base — doubles as the collapsing hero's mask.
            LinearGradient(
                colors: [Color(hex: 0x111111), Color(hex: 0x111111), Color(hex: 0x0F100F)],
                startPoint: .top,
                endPoint: .bottom
            )
            LinearGradient(
                stops: [
                    .init(color: .white.opacity(0.035), location: 0),
                    .init(color: .white.opacity(0.0), location: 0.5),
                    .init(color: .white.opacity(0.025), location: 1)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            field.opacity(calm)
        }
        // When anchored behind a scroll (agent detail), the field must be inert:
        // `PixelGlyphField` installs a tap-ripple gesture (`contentShape` +
        // `onTapGesture`) that otherwise swallows the widget scroller's drags. The
        // auth gate keeps the ripples — there it sits behind static buttons, not a
        // ScrollView.
        .allowsHitTesting(!screenAnchored)
    }

    @ViewBuilder
    private var field: some View {
        let content = ZStack {
            // Three background-colored "sheets" with wavy bottom edges whose soft
            // drop shadows paint gentle wave contours; they breathe amplitude +
            // wavelength so the deep background feels layered and alive.
            WaveBackground(
                sheetColor: Color(hex: 0x111111),
                shadowStrength: 0.28,
                shadowRadius: 18,
                shadowOffset: 8
            )
            // Small pixel "glyphs" that bloom and poof away on a steady 300ms beat,
            // tinted with `accentColor` (the app primary on auth, the agent color
            // on the agent detail).
            PixelGlyphField(
                intervals: [0.3],
                accentColor: accentColor,
                spacing: 26,
                dotSize: 5.5,
                peakOpacity: 0.45,
                rippleEmitter: rippleEmitter
            )
        }

        if screenAnchored {
            // Pin a full-screen field to GLOBAL (0,0) regardless of this instance's
            // own (possibly hero-clipped) frame, so every instance paints the same
            // pixels in the same place. `.offset` is render-only — no layout impact.
            GeometryReader { geo in
                let g = geo.frame(in: .global)
                content
                    .frame(width: screenSize.width, height: screenSize.height)
                    // Concentrate the field in the hero zone: full strength behind
                    // the hero, dissolving to a clean dark surface below so the
                    // collapsing widget cards scroll over a cohesive base instead
                    // of a mid-screen wave line + scattered glyphs. The mask is in
                    // the (screen-sized) local space and rides the same global
                    // offset, so every anchored instance fades identically.
                    .mask(heroFadeMask)
                    .offset(x: -g.minX, y: -g.minY)
            }
        } else {
            content
        }
    }

    /// Top-weighted vertical fade (white → clear) spanning the full screen height,
    /// so the wave + glyph field lives behind the hero and gracefully dissolves
    /// into the card stack. Fractions are of screen height: solid through the hero,
    /// gone by roughly the top third's end.
    private var heroFadeMask: some View {
        LinearGradient(
            stops: [
                .init(color: .white, location: 0),
                .init(color: .white, location: 0.26),
                .init(color: .clear, location: 0.58)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .frame(width: screenSize.width, height: screenSize.height)
    }

    private var screenSize: CGSize {
        #if canImport(UIKit)
        let b = UIScreen.main.bounds.size
        return CGSize(width: max(b.width, 1), height: max(b.height, 1))
        #else
        return CGSize(width: 400, height: 900)
        #endif
    }
}
