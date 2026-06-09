import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Three-dot thinking indicator + cycling verb. Direct port of Honeydew's
/// `ChatV3ThinkingIndicator` adapted for WagerProof — instead of Honeydew's
/// cooking verbs we cycle a set of betting-themed phrases so the indicator
/// reads as on-brand instead of borrowed chrome.
///
/// Two pieces:
///   1. Three pulsing dots staggered by 0.15s.
///   2. Cycling italic verb text in the brand green — phrases rotate every
///      3s with a shimmer sweep so the surface reads alive.
struct WagerBotThinkingIndicator: View {
    let ui: WagerBotUiTokens

    @State private var verbIndex: Int = 0

    /// Betting-themed verbs. Cycles every 3s while the assistant is
    /// thinking. Kept short enough to fit on a single line in every
    /// dynamic type setting.
    private let verbs: [String] = [
        "crunching the numbers",
        "running the models",
        "checking the lines",
        "comparing odds",
        "weighing the matchup",
        "scanning Polymarket",
        "reading the splits",
        "looking up trends",
        "pulling predictions",
        "spotting the edge",
        "tracking the steam",
        "syncing live data"
    ]

    private func initialIndex() -> Int {
        let ms = Int(Date().timeIntervalSince1970 * 1000) % 1000
        return min(max(0, (verbs.count * ms) / 1000), verbs.count - 1)
    }

    var body: some View {
        HStack(spacing: 10) {
            WagerBotThinkingDots(color: ui.accent)
                .frame(width: 36, height: 18)
            WagerBotShimmerVerb(text: verbs[verbIndex], color: ui.accent)
                .id(verbIndex)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .offset(y: 8)),
                    removal: .opacity
                ))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
        .onAppear {
            verbIndex = initialIndex()
            // Use `Timer` not `withAnimation+repeatForever`: the verb
            // swap is an opacity/offset transition, not a continuous
            // animation, so we drive the index from a timer and let
            // SwiftUI's `.transition` animate the swap.
            Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { _ in
                Task { @MainActor in
                    withAnimation(.easeInOut(duration: 0.4)) {
                        verbIndex = (verbIndex + 1) % verbs.count
                    }
                }
            }
        }
    }
}

/// Three pulsing dots — staggered phase animator. Mirrors the dot
/// behavior in `ChatV3ToolUseChip`'s `.running` glyph but rendered as a
/// row of three so the bubble's "still thinking" state reads at a glance
/// without a Lottie sprite (Honeydew uses Lottie; we don't ship one
/// here, and three dots stay snappier).
private struct WagerBotThinkingDots: View {
    let color: Color

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color)
                .phaseAnimator([0.3, 1.0, 0.3]) { dot, phase in
                    dot.opacity(phase)
                } animation: { _ in .easeInOut(duration: 0.9) }
            Circle().fill(color)
                .phaseAnimator([1.0, 0.3, 1.0]) { dot, phase in
                    dot.opacity(phase)
                } animation: { _ in .easeInOut(duration: 0.9).delay(0.15) }
            Circle().fill(color)
                .phaseAnimator([0.3, 1.0, 0.3]) { dot, phase in
                    dot.opacity(phase)
                } animation: { _ in .easeInOut(duration: 0.9).delay(0.3) }
        }
        .frame(width: 36, height: 8)
    }
}

/// Verb text with the app's standard iOS shimmer applied to the glyphs: a
/// readable dim base with a bright copy on top, swept by the shared
/// `.shimmering()` modifier (the same shimmer vocabulary used by every
/// skeleton in the app) so the thinking line reads consistently.
private struct WagerBotShimmerVerb: View {
    let text: String
    let color: Color

    private var font: Font { .system(size: 14, weight: .medium).italic() }

    var body: some View {
        Text(text)
            .font(font)
            .foregroundStyle(color.opacity(0.45))
            .overlay {
                // Bright copy revealed in the travelling shimmer band, masked
                // to the glyphs so only the text lights up.
                Text(text)
                    .font(font)
                    .foregroundStyle(color)
                    .shimmering()
                    .allowsHitTesting(false)
            }
    }
}

#Preview {
    WagerBotThinkingIndicator(ui: WagerBotUiTokens.resolve(.dark))
        .padding()
        .background(Color.appSurface)
}
