// OnboardingView.swift
//
// Onboarding v2 root. Three persistent strata:
//
//   Layer 0 — ONE `AnimatedAccentPixelWave` (the login screen's pixelwave,
//             identical entry params so RootView's auth → onboarding
//             cross-fade reads as one continuous surface). Never torn down
//             while the phase lasts; reacts to chip taps (ripples) and to
//             bettor-type / archetype selections (tint glide).
//   Layer 1 — phase switch derived from `store.currentStep`:
//             carousel (steps 1–20, native page slides inside one shell) →
//             generation cinematic (21) → reveal (22) → time-value summary
//             + fist bump (23). Only the foreground cross-fades; the
//             background never re-identifies.
//
// The cinematic views are transparent by design — the pixelwave is their
// backdrop. Completion (`markComplete()`) fires from the reveal CTA; the
// paywall stays owned by RootView over MainTabView.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingView: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Ripple channel shared by the background and every selectable chip
    /// (via the `\.glyphRippleEmitter` environment).
    @State private var rippleEmitter = GlyphRippleEmitter()
    /// The agent wizard draft — owned here (not in the carousel) so it
    /// survives the carousel → cinematic swap and the genesis model can
    /// submit it.
    @State private var creationStore = AgentCreationStore()
    /// Generation theater + real agent creation + teaser picks. Created on
    /// entry to `.generation`; survives into `.reveal`.
    @State private var genesis: OnboardingGenesisModel?

    // Accent tint interpolation (Canvas can't tween colors — see
    // AnimatedAccentPixelWave). from/to/blend snapshot the on-screen color
    // on every retarget so interrupted transitions never jump.
    @State private var tintFrom: Color = .appPrimary
    @State private var tintTo: Color = .appPrimary
    @State private var tintBlend: Double = 1

    private enum Phase: Equatable { case carousel, generation, reveal, summary }

    private var phase: Phase {
        switch store.currentStep {
        case .generation: .generation
        case .reveal: .reveal
        case .timeSummary: .summary
        default: .carousel
        }
    }

    /// Where the tint should be heading right now. Archetype accent wins
    /// once chosen; before that the bettor type drives; generation gets a
    /// white-lifted boost so the field reads energized during the theater.
    private var accentTarget: Color {
        var base = OnboardingTheme.accent(for: store.survey.bettorType)
        if store.hasChosenArchetype,
           let id = store.agentDraft.archetype,
           let hex = creationStore.archetypeRows.first(where: { $0.id == id })?.color,
           let archetypeColor = Color(hexString: hex) {
            base = archetypeColor
        }
        return phase == .generation ? OnboardingTheme.generationBoost(base) : base
    }

    var body: some View {
        ZStack {
            // Layer 0 — persistent reactive backdrop. Hit-inert (the field's
            // own tap gesture would sit under the pager); ripples arrive via
            // the emitter instead. `.ignoresSafeArea(.keyboard)` matters: a
            // keyboard resize would reconfigure the glyph grid and visibly
            // reset every colony while the agent-name field is up.
            AnimatedAccentPixelWave(
                from: tintFrom,
                to: tintTo,
                blend: tintBlend,
                rippleEmitter: rippleEmitter
            )
            .ignoresSafeArea()
            .ignoresSafeArea(.keyboard)
            .allowsHitTesting(false)

            // Layer 1 — foreground content, cross-faded per phase.
            Group {
                switch phase {
                case .carousel:
                    OnboardingCarouselContainer(
                        creationStore: creationStore,
                        accent: accentTarget,
                        initialSlot: store.currentStep.carouselIndex ?? 0
                    )
                    .transition(.opacity)
                case .generation:
                    OnboardingGenerationCinematic(model: genesis, accent: accentTarget)
                        .transition(.opacity)
                case .reveal:
                    OnboardingRevealView(model: genesis, accent: accentTarget)
                        .transition(.opacity)
                case .summary:
                    OnboardingTimeSummaryView(accent: accentTarget)
                        .transition(.opacity)
                }
            }
            .animation(reduceMotion ? .linear(duration: 0.001) : .appSlow, value: phase)
        }
        .preferredColorScheme(.dark)
        .environment(\.glyphRippleEmitter, rippleEmitter)
        // Trigger on the step (not advanceCount) so BACK navigation gets the
        // same light tick as forward.
        .sensoryFeedback(.impact(weight: .light), trigger: store.currentStep)
        .onChange(of: accentTarget) { _, target in
            retargetTint(to: target)
        }
        .onChange(of: store.currentStep) { _, step in
            startGenesisIfNeeded(for: step)
        }
        .onAppear {
            // Harness/debug can land directly on a cinematic step.
            startGenesisIfNeeded(for: store.currentStep)
        }
        // Archetype presets load early so the builder page never opens to a
        // spinner (same pre-warm the standalone wizard does).
        .task { await creationStore.loadArchetypesIfNeeded() }
    }

    /// Glide the field tint to `newColor`, restarting from whatever color is
    /// currently painted (interruption-safe).
    private func retargetTint(to newColor: Color) {
        tintFrom = tintFrom.mix(with: tintTo, by: tintBlend)
        tintTo = newColor
        tintBlend = 0
        withAnimation(reduceMotion ? .linear(duration: 0.001) : .appSlow) {
            tintBlend = 1
        }
    }

    private func startGenesisIfNeeded(for step: OnboardingStep) {
        guard step.isCinematic, genesis == nil else { return }
        let model = OnboardingGenesisModel(
            onboarding: store,
            creation: creationStore,
            rippleEmitter: rippleEmitter
        )
        genesis = model
        // Landing directly on .reveal (harness) skips the theater — the
        // reveal falls back to rendering the draft card.
        if step == .generation {
            model.start()
        }
    }
}

#if DEBUG
#Preview("Onboarding — terms") {
    OnboardingView()
        .environment(OnboardingStore())
}
#endif
