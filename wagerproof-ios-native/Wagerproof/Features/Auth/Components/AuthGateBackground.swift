// AuthGateBackground.swift
//
// Shared backdrop for every unauthenticated screen (gate, email sign-in,
// sign-up, forgot-password). A near-black gradient with the animated
// `PixelGlyphField` on top, so the whole auth stack carries the same minimalist
// pixel-glyph aesthetic introduced on the welcome gate.

import SwiftUI
import WagerproofDesign

struct AuthGateBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(hex: 0x111111),
                    Color(hex: 0x111111),
                    Color(hex: 0x0F100F)
                ],
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

            // Three background-colored "sheets" stacked at different heights,
            // each with a wavy bottom edge whose soft drop shadow paints a gentle
            // wave contour. They breathe amplitude + wavelength so the deep
            // background feels layered and alive without drawing attention.
            WaveBackground(
                sheetColor: Color(hex: 0x111111),
                shadowStrength: 0.28,
                shadowRadius: 18,
                shadowOffset: 8
            )

            // Small, focused pixel "glyphs" that bloom and poof away like
            // bacteria colonies / cloud poofs on a steady 300ms beat. See
            // PixelGlyphField in WagerproofDesign.
            PixelGlyphField(
                intervals: [0.3],
                accentColor: .appPrimary,
                spacing: 26,
                dotSize: 5.5,
                peakOpacity: 0.45
            )
        }
        .ignoresSafeArea()
    }
}
