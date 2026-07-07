// OnboardingPageShell.swift
//
// The standardized container for every onboarding screen on the iOS 26
// Liquid Glass refresh. The shell owns:
//
//   1. A 44pt chrome band at the top:
//        - leading: native-style back chevron (chevron.left, 17pt semibold,
//          appPrimary tint, 44×44 hit target). Hidden when the active screen
//          has no predecessor (first step).
//        - center: standardized progress bar (when `progress != nil`).
//        - trailing: optional `Skip` plain button.
//   2. Per-screen content body sandwiched between the chrome and the CTA.
//   3. A bottom liquid-glass continue button, pinned 30pt above the home
//      indicator. Hidden when `continueTitle.isEmpty`.
//   4. The per-screen background (a ViewBuilder closure so each screen keeps
//      its own gradient).
//
// Why a custom band instead of NavigationStack (default variant):
//   The onboarding step pointer is a state-machine, not a navigation path.
//   A NavigationStack pop would either desync from the store (if pop didn't
//   advance the step) or double-advance (if it did). The ZStack swap in the
//   flow view drives the page transition; the chrome stays in place.
//
// Why a NavigationStack variant (`useNativeChrome: true`) exists:
//   Some screens want the system gradient blur header and the free Liquid
//   Glass capsule that the system applies to toolbar buttons on iOS 26+.
//   Opt in per-screen when the system chrome reads better than the custom
//   band against that screen's background.
//
// Store-agnostic by design: this primitive lives in `WagerproofDesign` which
// must not depend on `WagerproofStores`. Callers pass `canGoBack`, `onBack`,
// and `onSkip` explicitly. The typical wiring is:
//
//     OnboardingPageShell(
//         progress: 0.40,
//         canGoBack: onboarding.currentStep.rawValue > 1,
//         onContinue: { onboarding.advance() },
//         onBack: { onboarding.back() }
//     ) { ... }
//
// Ported from Honeydew's Honeydew/Features/Onboarding/OnboardingPageShell.swift
// on 2026-05-23. Adaptations vs. Honeydew:
//   - No `OnboardingStore` import — the shell is store-agnostic. `canGoBack`,
//     `onBack`, and `onSkip` are required closures the caller provides.
//   - SF system font instead of Manrope-Bold for the Skip label.
//   - No `#if DEBUG` ladybug exit button. Wagerproof's dev tools live in
//     secret-settings.

import SwiftUI

public struct OnboardingPageShell<Content: View, Background: View>: View {
    /// 0.0…1.0 — drives the progress bar. nil hides the bar (paywall, final
    /// celebration, sub-pages that render their own internal bar).
    public let progress: Double?
    /// CTA copy. Empty string hides the CTA (e.g. sub-pages with their own
    /// custom CTA buttons inside the body).
    public let continueTitle: String
    /// Optional trailing glyph on the CTA (emoji or short symbol).
    public let continueGlyph: String?
    /// CTA enabled state — usually "no required selections made yet".
    public let isCTAEnabled: Bool
    /// CTA loading state.
    public let isCTALoading: Bool
    /// Whether the back chevron should be shown. Callers typically pass
    /// `onboarding.currentStep.rawValue > 1`.
    public let canGoBack: Bool
    /// Show the Skip plain button in the toolbar trailing slot.
    public let showSkip: Bool
    /// When true, wraps content in a `NavigationStack` and uses native
    /// `.toolbar` items for back + Skip so the chevron picks up the system
    /// Liquid Glass background on iOS 26+ and the header gets the system
    /// gradient blur material. The progress bar is repositioned to a thin
    /// pinned band below the nav bar (since the principal slot stays empty
    /// for visual breathing room).
    public let useNativeChrome: Bool
    /// CTA pill tint. Defaults to the brand green; the onboarding carousel
    /// passes its live accent theme so the pill recolors with the reactive
    /// pixel background. Feeds the progress bar's fill color; the CTA
    /// button itself uses `ctaButtonColor` when set (see below), so a
    /// caller can keep the progress bar reactive while pinning the button.
    public let ctaTint: Color
    /// Overrides just the CTA button's Liquid Glass tint, independent of
    /// `ctaTint` (which still drives the progress bar fill). nil (default)
    /// keeps the CTA on `ctaTint` — the Agent Builder wizard, which reuses
    /// this shell, relies on that to recolor its button with the chosen
    /// archetype. The onboarding carousel passes `.white` here so its CTA
    /// stays a neutral white Liquid Glass pill regardless of bettor-type
    /// accent.
    public let ctaButtonColor: Color?
    /// Background — each screen passes its own gradient so the radial blob
    /// math doesn't get standardized away. Shell layers chrome over it.
    @ViewBuilder public let background: () -> Background
    /// Per-screen content sandwiched between chrome and CTA.
    @ViewBuilder public let content: () -> Content
    /// CTA tap handler. Almost always `onboarding.advance()` plus an analytics
    /// event from the calling site.
    public let onContinue: () -> Void
    /// Back chevron tap handler. Called when the user taps the leading
    /// chevron in the chrome band (or the system back button in the native
    /// chrome variant).
    public let onBack: () -> Void
    /// Skip tap handler. Required when `showSkip == true`.
    public let onSkip: (() -> Void)?

    public init(
        progress: Double? = nil,
        continueTitle: String = "Continue",
        continueGlyph: String? = nil,
        isCTAEnabled: Bool = true,
        isCTALoading: Bool = false,
        canGoBack: Bool = false,
        showSkip: Bool = false,
        // Default to native chrome — system NavigationStack with blurred
        // gradient toolbar background, system `chevron.left` back button,
        // and Liquid Glass toolbar buttons on iOS 26+. Honeydew chose this
        // as the canonical onboarding chrome; matching default keeps the
        // WagerProof flow visually consistent.
        useNativeChrome: Bool = true,
        ctaTint: Color = .appPrimary,
        ctaButtonColor: Color? = nil,
        @ViewBuilder background: @escaping () -> Background,
        @ViewBuilder content: @escaping () -> Content,
        onContinue: @escaping () -> Void,
        onBack: @escaping () -> Void = {},
        onSkip: (() -> Void)? = nil
    ) {
        self.progress = progress
        self.continueTitle = continueTitle
        self.continueGlyph = continueGlyph
        self.isCTAEnabled = isCTAEnabled
        self.isCTALoading = isCTALoading
        self.canGoBack = canGoBack
        self.showSkip = showSkip
        self.useNativeChrome = useNativeChrome
        self.ctaTint = ctaTint
        self.ctaButtonColor = ctaButtonColor
        self.background = background
        self.content = content
        self.onContinue = onContinue
        self.onBack = onBack
        self.onSkip = onSkip
    }

    public var body: some View {
        if useNativeChrome {
            nativeChromeBody
        } else {
            customChromeBody
        }
    }

    // MARK: - Custom chrome (default)

    private var customChromeBody: some View {
        ZStack {
            // --- Layer 1: per-screen background ----------------------------
            background()
                .ignoresSafeArea()

            // --- Layer 2: content -----------------------------------------
            content()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        // Chrome band pinned as a top inset, FULLY TRANSPARENT — no bar
        // background. Scrollable content passes underneath and stays
        // visible; only the individual controls carry material (the
        // chevron's Liquid Glass disc), so the animated backdrop reads
        // uninterrupted to the top edge.
        .safeAreaInset(edge: .top, spacing: 0) {
            chromeBand
        }
        // CTA pinned to bottom — `safeAreaInset` is the canonical SwiftUI
        // pattern for pinning chrome above the home indicator without
        // ZStack overlap math.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !continueTitle.isEmpty {
                ctaBar
            }
        }
    }

    // MARK: - Native chrome (iOS gradient blur header + system back button)

    /// Wraps content in a `NavigationStack` so the top chrome uses the
    /// system navigation bar: gradient blur material header, automatic
    /// Liquid Glass styling for toolbar buttons on iOS 26+, and a real
    /// `chevron.left` back button placed in the leading slot.
    ///
    /// The progress bar can't live inside the nav bar without crowding the
    /// principal slot, so it's pinned as a thin band immediately below the
    /// nav via `.safeAreaInset(edge: .top)`. The per-screen background still
    /// sits behind everything so the gradient blur reads against the brand
    /// color rather than a plain system surface.
    private var nativeChromeBody: some View {
        NavigationStack {
            ZStack {
                background()
                    .ignoresSafeArea()

                content()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            // Inline title with empty text gives us a 44pt nav bar — the
            // smallest standard height. Title text would compete with the
            // progress bar visually.
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            // Force the gradient blur material to render even when no
            // content is scrolled under the bar. `.automatic` would leave
            // the bar transparent until scroll, which defeats the request.
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                // Leading: native back chevron. On iOS 26+, toolbar buttons
                // receive the system Liquid Glass capsule background for
                // free. On earlier OS versions, this renders as the standard
                // chevron tinted with the app primary color.
                if canGoBack {
                    ToolbarItem(placement: .topBarLeading) {
                        Button(action: onBack) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 17, weight: .semibold))
                        }
                        .tint(Color.appPrimary)
                        .accessibilityLabel("Back")
                    }
                }

                // Center: the progress bar lives IN the nav bar (principal
                // slot) — one chrome strip instead of a bar-below-the-bar.
                if let progress {
                    ToolbarItem(placement: .principal) {
                        OnboardingProgressBar(value: progress, widthFraction: 1.0)
                            .frame(width: 170, height: 12)
                            .accessibilityLabel("Progress")
                            .accessibilityValue("\(Int((progress * 100).rounded())) percent")
                    }
                }

                // Trailing: optional Skip.
                if showSkip, let onSkip {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(action: onSkip) {
                            Text("Skip")
                                .font(.system(size: 14, weight: .bold))
                        }
                        .tint(Color.appTextSecondary)
                    }
                }
            }
            // CTA pinned to the bottom — attached INSIDE the NavigationStack
            // alongside the top inset so SwiftUI subtracts BOTH from the
            // same content-region scope. With both insets at the same scope,
            // SwiftUI's centering matches the visible region between
            // progress bar and CTA.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !continueTitle.isEmpty {
                    ctaBar
                }
            }
        }
    }

    // MARK: - Chrome band

    /// 48pt chrome at the top: Liquid Glass back chevron (leading), fixed-
    /// width accent progress bar (center), optional Skip (trailing). Fully
    /// transparent behind the controls so an animated parent background
    /// (the onboarding pixelwave) reads through — this is why onboarding
    /// uses the custom band instead of a NavigationStack, whose hosting
    /// layer paints an opaque system background over the parent.
    private var chromeBand: some View {
        ZStack {
            // Progress bar centered at a fixed width so it reads as one
            // stable element across pages regardless of chevron visibility.
            if let progress {
                OnboardingProgressBar(
                    value: progress,
                    widthFraction: 1.0,
                    height: 10,
                    trackColor: Color.white.opacity(0.12),
                    fillColor: ctaTint.opacity(0.9)
                )
                .frame(width: 168)
            }

            HStack(spacing: 0) {
                // Leading: back chevron in a Liquid Glass disc (or an equal
                // placeholder so the centered bar never shifts).
                if canGoBack {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 40, height: 40)
                            .contentShape(Circle())
                            .liquidGlassBackground(
                                in: Circle(),
                                tint: Color.white.opacity(0.10),
                                interactive: true
                            )
                    }
                    .buttonStyle(.plain)
                    .padding(.leading, 12)
                    .accessibilityLabel("Back")
                    .transition(.opacity.combined(with: .scale(scale: 0.8)))
                } else {
                    Color.clear.frame(width: 52, height: 44)
                }

                Spacer(minLength: 0)

                // Trailing slot: optional Skip. Wagerproof has no DEBUG
                // ladybug exit button — dev tools live in secret-settings.
                if showSkip, let onSkip {
                    Button(action: onSkip) {
                        Text("Skip")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.7))
                            .padding(.horizontal, 12)
                            .frame(height: 44)
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, 8)
                } else {
                    // Placeholder mirrors the leading chevron width so the
                    // centered progress bar stays balanced even when there's
                    // no trailing affordance.
                    Color.clear.frame(width: 52, height: 44)
                }
            }
        }
        .frame(height: 48)
        .padding(.top, 2)
        .animation(.easeInOut(duration: 0.2), value: canGoBack)
    }

    // MARK: - CTA bar

    /// Liquid-glass continue button pinned to the safe-area bottom. Ports
    /// Honeydew's `ContinueCTAButton` choreography — specular highlight +
    /// glass rim + entrance spring — with WagerProof's green brand tint.
    /// 16pt bottom inset matches Honeydew's unified shell.
    private var ctaBar: some View {
        ContinueCTAButton(
            label: continueTitle,
            trailingGlyph: continueGlyph,
            isEnabled: isCTAEnabled,
            isLoading: isCTALoading,
            tint: ctaButtonColor ?? ctaTint
        ) {
            onContinue()
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        // iPad: cap CTA pill width so it doesn't stretch across the screen.
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Preview

/// Standard Wagerproof onboarding backdrop — near-black with a teal/green
/// glow rising from the bottom. Reused across previews so they all share
/// the canonical look.
private struct WagerproofOnboardingBackdrop: View {
    var body: some View {
        LinearGradient(
            colors: [
                Color(hex: 0x0F1117),
                Color.appPrimary.opacity(0.30)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

#Preview("Mid-flow") {
    OnboardingPageShell(
        progress: 0.65,
        continueTitle: "Continue",
        continueGlyph: "→",
        canGoBack: true,
        background: { WagerproofOnboardingBackdrop() },
        content: {
            VStack(spacing: 16) {
                Spacer()
                Text("Sample headline")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)
                Text("Sample subhead copy goes here")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
                Spacer()
            }
        },
        onContinue: { print("Continue tapped") },
        onBack: { print("Back tapped") }
    )
}

#Preview("First step (no back)") {
    OnboardingPageShell(
        progress: 0.10,
        continueTitle: "Get started",
        canGoBack: false,
        background: { WagerproofOnboardingBackdrop() },
        content: {
            Text("First page")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(.white)
                .frame(maxHeight: .infinity)
        },
        onContinue: { },
        onBack: { }
    )
}

#Preview("Terminal — no progress, no back") {
    OnboardingPageShell(
        progress: nil,
        continueTitle: "Let's go!",
        continueGlyph: "🎉",
        canGoBack: false,
        background: { Color(hex: 0x0F1117) },
        content: {
            Text("Celebration")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.white)
                .frame(maxHeight: .infinity)
        },
        onContinue: { },
        onBack: { }
    )
}

#Preview("Native chrome variant") {
    OnboardingPageShell(
        progress: 0.40,
        continueTitle: "Continue",
        canGoBack: true,
        showSkip: true,
        useNativeChrome: true,
        background: { WagerproofOnboardingBackdrop() },
        content: {
            VStack(spacing: 16) {
                Spacer()
                Text("Native iOS chrome")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(.white)
                Text("System gradient blur header + Liquid Glass back button")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                Spacer()
            }
            .padding(.horizontal, 24)
        },
        onContinue: { },
        onBack: { },
        onSkip: { }
    )
}
