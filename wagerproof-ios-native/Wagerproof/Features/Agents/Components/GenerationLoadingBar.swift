import SwiftUI
import WagerproofDesign

/// The polling progress bar — a plain native iOS linear progress bar tinted with
/// the agent accent. Small + simple; `fraction` is turn / maxTurns.
struct GenerationLoadingBar: View {
    var fraction: CGFloat
    var accent: Color

    var body: some View {
        ProgressView(value: min(1, max(0, fraction)))
            .progressViewStyle(.linear)
            .tint(accent)
            .animation(.easeInOut(duration: 0.5), value: fraction)
    }
}

#if DEBUG
#Preview("Generation loading bar") {
    ZStack {
        Color.black.ignoresSafeArea()
        VStack(spacing: 24) {
            GenerationLoadingBar(fraction: 0.25, accent: Color(hex: 0x6366F1))
            GenerationLoadingBar(fraction: 0.65, accent: Color(hex: 0xFF8A00))
            GenerationLoadingBar(fraction: 0.96, accent: Color(hex: 0x00E676))
        }
        .padding(24)
    }
    .preferredColorScheme(.dark)
}
#endif
