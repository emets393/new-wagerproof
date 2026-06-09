import SwiftUI

/// Native SwiftUI port of `components/agents/GlowingCardWrapper.tsx`. RN uses
/// the `react-native-animated-glow` library to draw a shifting multi-stop
/// halo around top-3 leaderboard avatars. We approximate the effect with a
/// `RoundedRectangle` `.stroke` + `.blur` ring.
///
/// FIDELITY-WAIVER #071: Same as `GlowAccentBar` — the animated color cycle
/// is dropped. The static brand-tinted halo still calls out the top three
/// leaderboard rows but doesn't pulse.
struct GlowingCardWrapper<Content: View>: View {
    let color: String
    var cornerRadius: CGFloat = 20
    let content: () -> Content

    init(color: String, cornerRadius: CGFloat = 20, @ViewBuilder content: @escaping () -> Content) {
        self.color = color
        self.cornerRadius = cornerRadius
        self.content = content
    }

    var body: some View {
        let (primary, secondary) = AgentColorPalette.gradient(for: color)
        content()
            .background(
                ZStack {
                    // Outer halo (large, soft).
                    RoundedRectangle(cornerRadius: cornerRadius + 4, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [primary.opacity(0.6), secondary.opacity(0.6)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 4
                        )
                        .blur(radius: 6)

                    // Inner ring (tight, vivid).
                    RoundedRectangle(cornerRadius: cornerRadius + 2, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [primary, secondary],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                        .blur(radius: 1)
                }
                .padding(-3)
            )
    }
}
