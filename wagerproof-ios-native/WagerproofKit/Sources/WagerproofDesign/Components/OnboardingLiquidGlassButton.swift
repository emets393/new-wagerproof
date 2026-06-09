// OnboardingLiquidGlassButton.swift
//
// The standardized Continue CTA used by every onboarding screen on the
// iOS 26 Liquid Glass refresh.
//
// Visual: Capsule pill, h=60, full-width minus 16pt horizontal inset, system
// bold 18pt white label with optional trailing glyph (emoji or short symbol),
// brand green tint (Color.appPrimary, ≈ #22C55E) over Liquid Glass on iOS 26+
// / ultraThinMaterial fallback on iOS 17-25.
//
// The shell pins this to the safe-area bottom with 30pt extra padding to
// match the bottom inset used across the Wagerproof onboarding screens.
//
// Ported from Honeydew's HoneydewDesign/Components/OnboardingLiquidGlassButton.swift
// on 2026-05-23. Adaptations vs. Honeydew:
//   - SF system font instead of Manrope-Bold (Wagerproof has no custom font).
//   - Default tint is Color.appPrimary (brand green) instead of #F7BE00.

import SwiftUI

public struct OnboardingLiquidGlassButton: View {
    public let title: String
    public let trailingGlyph: String?
    public let tint: Color
    public let isEnabled: Bool
    public let isLoading: Bool
    /// When true, the button performs a deliberate fade + slide-up entrance
    /// on first appearance (and on each onAppear after a step-swap). Disable
    /// only if the caller owns its own appearance choreography.
    public let animatesIn: Bool
    public let action: () -> Void

    /// Trigger value for the .impact(.light) haptic. Bumped each tap so
    /// `.sensoryFeedback` fires every press, not just once.
    @State private var hapticTick: Int = 0
    /// Drives the entrance animation. Starts false so the button is hidden +
    /// offset; flips true on appear so SwiftUI animates it into resting state.
    @State private var hasAppeared: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        title: String,
        trailingGlyph: String? = nil,
        tint: Color = Color.appPrimary,
        isEnabled: Bool = true,
        isLoading: Bool = false,
        animatesIn: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.trailingGlyph = trailingGlyph
        self.tint = tint
        self.isEnabled = isEnabled
        self.isLoading = isLoading
        self.animatesIn = animatesIn
        self.action = action
    }

    public var body: some View {
        Button(action: {
            guard isEnabled && !isLoading else { return }
            hapticTick &+= 1
            action()
        }) {
            label
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isLoading)
        // Combine the entrance opacity with the disabled-state dim. The
        // entrance value (0 → 1) and the disabled value (1 → 0.5) multiply,
        // so the button still respects isEnabled once it has appeared.
        .opacity(entranceOpacity * (isEnabled ? 1.0 : 0.5))
        .offset(y: entranceOffset)
        .sensoryFeedback(.impact(weight: .light), trigger: hapticTick)
        .onAppear {
            // Step-swaps recycle the same OnboardingLiquidGlassButton view
            // identity in some flows, so we only run the entrance once per
            // mount. Reduce Motion downgrades to a snap (no slide).
            guard !hasAppeared else { return }
            guard animatesIn else {
                hasAppeared = true
                return
            }
            // Small delay lets the step's slide-in transition settle so the
            // button lands as the final visual beat rather than competing
            // with the page slide.
            withAnimation(
                reduceMotion
                    ? .linear(duration: 0.001)
                    : .spring(response: 0.55, dampingFraction: 0.82).delay(0.18)
            ) {
                hasAppeared = true
            }
        }
    }

    /// Opacity factor for the entrance. 1 when not animating in or already
    /// appeared, 0 before the first appearance fires.
    private var entranceOpacity: Double {
        animatesIn ? (hasAppeared ? 1.0 : 0.0) : 1.0
    }

    /// Vertical offset for the entrance slide-up. Starts 18pt below resting
    /// position so the button visibly rises into place.
    private var entranceOffset: CGFloat {
        animatesIn ? (hasAppeared ? 0 : 18) : 0
    }

    private var label: some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            if isLoading {
                ProgressView()
                    .tint(.white)
            } else {
                Text(title)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                if let g = trailingGlyph {
                    Text(g)
                        .font(.system(size: 22))
                        .foregroundStyle(.white)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity)
        .frame(height: 60)
        // Lower-alpha tint so the Liquid Glass surface reads more like the
        // system material on iOS 26+: the underlying gradient blooms through
        // the green rather than being painted over by it. 0.65 keeps brand
        // recognition while letting the glass refraction actually show.
        .liquidGlassBackground(in: Capsule(), tint: tint.opacity(0.65))
        // Subtle brand-tinted shadow under the pill — mirrors the warm drop
        // shadow Honeydew uses on its yellow CTAs, recoloured for green.
        .shadow(color: tint.opacity(0.40), radius: 8, x: 0, y: 4)
        .shadow(color: Color.black.opacity(0.10), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Preview

#Preview("Default") {
    VStack(spacing: 20) {
        OnboardingLiquidGlassButton(title: "Continue") { }
        OnboardingLiquidGlassButton(title: "Continue", trailingGlyph: "→") { }
        OnboardingLiquidGlassButton(title: "Let's go!", trailingGlyph: "🎉") { }
        OnboardingLiquidGlassButton(title: "Continue", isEnabled: false) { }
        OnboardingLiquidGlassButton(title: "Continue", isLoading: true) { }
    }
    .padding(.horizontal, 16)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
        // Standard Wagerproof onboarding backdrop — near-black with a green
        // glow rising from the bottom so the glass refraction has something
        // chromatic to bend.
        LinearGradient(
            colors: [
                Color(hex: 0x0F1117),
                Color.appPrimary.opacity(0.25)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    )
}
