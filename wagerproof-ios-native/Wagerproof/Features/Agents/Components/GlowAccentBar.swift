import SwiftUI

/// Native SwiftUI port of `components/agents/GlowAccentBar.tsx`. The RN
/// component uses the `react-native-animated-glow` library to render a
/// 5-color shifting glow above each AgentIdCard. We approximate that with a
/// `LinearGradient` plus a low-opacity blur halo — visually similar at a
/// distance, no third-party dependency required.
///
/// FIDELITY-WAIVER #071: The continuous color-cycle animation is dropped. iOS
/// users see a static brand-gradient bar instead of the glowing animated bar.
/// Re-implementing the animated multi-stop glow in SwiftUI is a meaningful
/// rendering effort that we defer; the static version is on-brand and ships.
struct GlowAccentBar: View {
    let color: String

    var body: some View {
        let (primary, secondary) = AgentColorPalette.gradient(for: color)
        LinearGradient(
            colors: [primary, secondary],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 2)
        .overlay(
            LinearGradient(
                colors: [primary.opacity(0.5), secondary.opacity(0.5)],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 2)
            .blur(radius: 3)
        )
    }
}
