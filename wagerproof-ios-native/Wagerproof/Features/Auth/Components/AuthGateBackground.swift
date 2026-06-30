// AuthGateBackground.swift
//
// Shared backdrop for every unauthenticated screen (gate, email sign-in,
// sign-up, forgot-password). A thin wrapper over the reusable
// `PixelWaveBackground` (WagerproofDesign) tinted with the app primary, so the
// whole auth stack carries the same minimalist pixel-glyph aesthetic — now
// shared with the agent detail surfaces.

import SwiftUI
import WagerproofDesign

struct AuthGateBackground: View {
    var body: some View {
        PixelWaveBackground(accentColor: .appPrimary)
            .ignoresSafeArea()
    }
}
