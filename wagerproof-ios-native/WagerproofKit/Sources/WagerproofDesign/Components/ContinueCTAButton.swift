import SwiftUI

/// Onboarding CTA pill — port of Honeydew's `ContinueCTAButton` with the
/// brand color swapped to WagerProof green (`Color.appPrimary` = #00E676).
/// Same shape, animations, specular highlight, and rim stroke as Honeydew.
/// Used as the canonical CTA in `OnboardingPageShell`. Replaces the older
/// `OnboardingLiquidGlassButton` inside the shell (legacy button stays
/// available for non-onboarding callers).
public struct ContinueCTAButton: View {
    public let label: String
    /// Optional trailing glyph (emoji or symbol) — e.g. "🎊" on the
    /// celebration screen, "→" elsewhere. Renders next to the label
    /// inside the pill. Pass `nil` to omit.
    public var trailingGlyph: String? = nil
    /// When false, the button dims to 50% and stops responding to taps.
    /// The single persistent CTA uses this to communicate "pick something
    /// first" without unmounting the view (which would cause an awkward
    /// pop-in/pop-out on page swaps).
    public var isEnabled: Bool = true
    /// When true, swaps the label out for a centered ProgressView and
    /// blocks taps. Used by callers that need to indicate a network
    /// request is in flight (paywall purchase, terms acceptance) without
    /// changing the button's footprint.
    public var isLoading: Bool = false
    public let action: () -> Void

    public init(
        label: String,
        trailingGlyph: String? = nil,
        isEnabled: Bool = true,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.label = label
        self.trailingGlyph = trailingGlyph
        self.isEnabled = isEnabled
        self.isLoading = isLoading
        self.action = action
    }

    /// Flips true on first onAppear so the SwiftUI animator interpolates
    /// from the initial offset/opacity to resting.
    @State private var hasAppeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Brand green — WagerProof primary (#00E676). Honeydew uses yellow;
    /// this is the only material deviation from the source button.
    private let tint = Color.appPrimary

    public var body: some View {
        Button(action: { if isEnabled && !isLoading { action() } }) {
            label_
                .frame(maxWidth: .infinity)
                .frame(height: 60)
                // Make the entire capsule tappable. Without this, SwiftUI
                // hit-tests only the Text's glyph rect — tapping the
                // colored area on either side of "Continue" does nothing.
                .contentShape(Capsule())
                // Liquid Glass surface with a translucent green tint so the
                // underlying onboarding gradient refracts through the pill
                // rather than being painted over. `interactive: true` enables
                // iOS 26 touch-response refraction so the pill physically
                // reacts to taps. Spec highlight and rim stroke remain as
                // overlays so the button still reads as a shaped CTA on iOS
                // 17 fallbacks (ultraThinMaterial + tint).
                .liquidGlassBackground(
                    in: Capsule(),
                    tint: tint.opacity(0.65),
                    interactive: true
                )
                .overlay(
                    // Specular highlight — white gradient fading top → mid.
                    Capsule()
                        .fill(LinearGradient(
                            colors: [Color.white.opacity(0.22), Color.white.opacity(0.0)],
                            startPoint: .top,
                            endPoint: .center
                        ))
                        .allowsHitTesting(false)
                )
                .overlay(
                    // Glass rim — stronger at top-leading, fades to
                    // bottom-trailing.
                    Capsule()
                        .strokeBorder(
                            LinearGradient(
                                colors: [Color.white.opacity(0.45), Color.white.opacity(0.06)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                        .allowsHitTesting(false)
                )
                .shadow(color: tint.opacity(0.30), radius: 8, x: 0, y: 4)
                .shadow(color: Color.black.opacity(0.08), radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        // Multiply the entrance opacity by the enabled-state dim so the
        // value smoothly animates when enabled flips (e.g. user picks a
        // goal on page 6 → button brightens from 0.5 → 1.0).
        .opacity((hasAppeared ? 1 : 0) * (isEnabled ? 1.0 : 0.5))
        .offset(y: hasAppeared ? 0 : 18)
        .animation(.easeInOut(duration: 0.2), value: isEnabled)
        .allowsHitTesting(isEnabled && !isLoading)
        .onAppear {
            // Delay lets the page-swap transition land before the CTA
            // rises — matches OnboardingLiquidGlassButton's entrance
            // choreography so swapping to the new pill doesn't feel
            // sudden on the surrounding chrome.
            withAnimation(
                reduceMotion
                    ? .linear(duration: 0.001)
                    : .spring(response: 0.55, dampingFraction: 0.82).delay(0.18)
            ) {
                hasAppeared = true
            }
        }
    }

    /// The pill's foreground content — either a centered `ProgressView`
    /// while loading, or the label + optional trailing glyph in a row.
    /// Kept under `label_` (underscored to avoid colliding with the
    /// public `label` property) so the body stays readable.
    @ViewBuilder
    private var label_: some View {
        if isLoading {
            ProgressView()
                .tint(.white)
        } else {
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                Text(label)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                if let g = trailingGlyph {
                    Text(g)
                        .font(.system(size: 22))
                        .foregroundColor(.white)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
        }
    }
}

#Preview {
    VStack(spacing: 24) {
        ContinueCTAButton(label: "Continue") {}
            .padding(.horizontal, 16)
        ContinueCTAButton(label: "Continue", trailingGlyph: "→") {}
            .padding(.horizontal, 16)
        ContinueCTAButton(label: "Get started", trailingGlyph: "🎊") {}
            .padding(.horizontal, 16)
        ContinueCTAButton(label: "Pick a goal", isEnabled: false) {}
            .padding(.horizontal, 16)
        ContinueCTAButton(label: "Processing…", isLoading: true) {}
            .padding(.horizontal, 16)
    }
    .padding()
    .background(
        LinearGradient(
            colors: [Color(hex: 0x0F1117), Color.appPrimary.opacity(0.14)],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    )
}
