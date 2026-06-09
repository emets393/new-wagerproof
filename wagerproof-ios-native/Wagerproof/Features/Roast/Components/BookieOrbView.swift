import SwiftUI
import WagerproofDesign

/// Animated orb that sits above the status text and mic button. Replaces the
/// RN `LottieView` driven off `assets/ChattingRobot.json`.
///
/// The spec (08-screen-native-spec.md §5) calls for `LottieView(animation:
/// .named("ChattingRobot"))` via `lottie-ios`. The Wagerproof iOS native
/// project doesn't yet include `lottie-ios` as a SwiftPM dependency — adding
/// it implicitly here would balloon the binary for a single asset. Instead
/// we render an equivalent native animated orb in a similar style to
/// Honeydew's `RoastChefView` orb (pulsing scale + glow), themed in the
/// Wagerproof green. A future batch can swap this for the Lottie file
/// without touching the view that uses it.
///
/// Visual: 80pt circle with a soft green glow + a microphone glyph in the
/// center, both gently scaling. Loops indefinitely so the empty state has
/// visual presence even when idle.
struct BookieOrbView: View {
    @State private var phase: CGFloat = 0
    /// Reduce-motion respects the system preference — when on, we render the
    /// orb static so the screen doesn't drive perpetual motion (HIG).
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            // Outer soft glow — scales 1 → 1.15 while fading.
            Circle()
                .fill(Color.appPrimary.opacity(0.12))
                .frame(width: 96, height: 96)
                .scaleEffect(reduceMotion ? 1 : (1 + 0.15 * phase))
                .opacity(reduceMotion ? 0.6 : (0.6 + 0.4 * (1 - phase)))
                .blur(radius: 8)

            // Mid ring — solid 30% green.
            Circle()
                .fill(Color.appPrimary.opacity(0.3))
                .frame(width: 72, height: 72)
                .scaleEffect(reduceMotion ? 1 : (1 + 0.08 * phase))

            // Inner disk — dark surface with the mic glyph centered.
            Circle()
                .fill(Color(white: 0.09))
                .frame(width: 56, height: 56)
                .overlay(
                    Image(systemName: "mic.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                )
        }
        .frame(width: 96, height: 96)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
                phase = 1
            }
        }
        .accessibilityHidden(true)
    }
}

#if DEBUG
#Preview("Bookie Orb") {
    BookieOrbView()
        .padding(40)
        .background(Color.black)
        .preferredColorScheme(.dark)
}
#endif
