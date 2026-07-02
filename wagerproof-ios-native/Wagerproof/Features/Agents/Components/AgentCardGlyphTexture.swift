import SwiftUI
import WagerproofDesign

/// Subtle animated pixel-glyph wash for the agent list cards — a scaled-down
/// echo of the `PixelWaveBackground` field on the auth gate and the agent
/// detail hero. The glyphs bloom and poof in the agent's brand hue across the
/// whole card (a touch stronger on the avatar side), giving every row a "sneak
/// peek" of the detail-page pixelwave that ties the agent UI together.
///
/// Reuses `PixelGlyphField` verbatim (same automaton, same 300ms beat) and just
/// re-tints, re-seeds, and masks it for the card. Each instance passes a stable
/// per-agent `seed`, so no two cards bloom in lockstep. Drop it into a card's
/// `.background` ZStack above the material fill; it's inert
/// (`allowsHitTesting(false)`) so the row's tap/long-press still win. See
/// `AgentDetailHero` for the full-screen version and `PixelGlyphField` for the
/// automaton.
struct AgentCardGlyphTexture: View {
    /// Raw `avatar_color` (hex or "gradient:…") — the hue the glyphs glow in.
    let avatarColor: String
    /// Stable per-card string (the agent id) → distinct glyph pattern per card.
    var seedString: String = ""
    var cornerRadius: CGFloat = 26

    @Environment(\.colorScheme) private var colorScheme

    private var primary: Color { AgentColorPalette.primary(for: avatarColor) }

    /// FNV-1a hash of the seed string → a non-zero PRNG seed. Mirrors the form
    /// chart's hashing (`String.hashValue` is per-process randomized, so it
    /// can't be used for a stable-across-launch pattern).
    private var seedValue: UInt64 {
        guard !seedString.isEmpty else { return 0x5EED_1234 }
        var h: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in seedString.utf8 {
            h = (h ^ UInt64(byte)) &* 0x0000_0100_0000_01b3
        }
        return h | 1
    }

    var body: some View {
        // Dark mode mirrors the hero exactly: white glyphs that mix toward the
        // agent hue at their cores, glowing on the dark glass. Light mode can't
        // show white, so the glyphs ARE the agent hue and deepen at their cores.
        let base: Color = colorScheme == .dark ? .white : primary
        let accent: Color = colorScheme == .dark ? primary : primary.shaded(by: 0.72)

        PixelGlyphField(
            intervals: [0.3],   // same 300ms beat as the hero field
            baseColor: base,
            accentColor: accent,
            spacing: 22,        // a touch tighter than the hero (26) for the smaller card
            dotSize: 5,
            peakOpacity: colorScheme == .dark ? 0.4 : 0.46,
            seed: seedValue
        )
        .mask(spreadMask)
        // Belt-and-suspenders clip; the host card also clips to its own shape.
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .allowsHitTesting(false)
    }

    /// Spans the full card so glyphs pulse across the entire container, but eases
    /// down toward the trailing edge — the avatar's colored side reads as the
    /// origin, and the form chart / record on the right stay legible. Never
    /// reaches zero, so the texture is present edge to edge.
    private var spreadMask: some View {
        LinearGradient(
            stops: [
                .init(color: .white, location: 0.0),
                .init(color: .white.opacity(0.84), location: 0.5),
                .init(color: .white.opacity(0.64), location: 1.0)
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
    }
}
