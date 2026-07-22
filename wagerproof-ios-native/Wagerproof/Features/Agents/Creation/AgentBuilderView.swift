import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

// =====================================================================
// AgentBuilderView — the in-app "build an agent from scratch" flow, rebuilt
// on the onboarding pixelwave carousel builder.
//
// It reuses the SAME eight builder pages onboarding uses (sports → archetype →
// mindset → bet style → data trust → sport rules → insights → identity), so the
// in-app create experience matches onboarding's look and feel instead of the
// old Step 1–6 wizard (AgentCreationView, now unused).
//
// Deliberately DROPS the onboarding-only pieces per product direction:
//   • no generation cinematic (OnboardingGenerationCinematic) and
//   • no automatic first-pick generation.
// On "Create my agent" it just submits the draft and hands the new agent back
// to AgentsView, which swaps this screen for the agent's detail page. The
// ticket-printer reveal then plays there when the agent generates picks — the
// app's existing behavior (AgentDetailView.maybeAutoplayUnreadPicks) — rather
// than onboarding's blurred-teaser reveal.
//
// Three of the builder pages (sports/archetype/identity) declare
// `@Environment(OnboardingStore.self)` (accent tint + the `hasChosenArchetype`
// flag), so they would crash without one in the environment. We own a LOCAL
// `OnboardingStore` purely as a state holder to satisfy that — it is never
// completed, never persisted, and never touches RootRouter or the real
// onboarding lifecycle.
// =====================================================================

struct AgentBuilderView: View {
    /// Optional seed draft — set by the "Copy build" CTA on
    /// `PublicAgentDetailView` (`AgentCreationStore.Draft.copying(fromPublicAgent:)`)
    /// so the wizard opens pre-filled with another agent's readable build
    /// instead of a blank draft. `nil` is the normal from-scratch path.
    var initialDraft: AgentCreationStore.Draft? = nil
    /// Fired with the freshly created agent so the host can navigate to its
    /// detail page (AgentsView swaps this screen for `.agentDetail`).
    var onCreated: (Agent) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The real wizard draft that gets submitted to `create_agent`.
    @State private var creation = AgentCreationStore()
    /// LOCAL state holder ONLY to satisfy the builder pages' OnboardingStore
    /// environment dependency (accent + `hasChosenArchetype`). See file header —
    /// never drives onboarding completion or persistence.
    @State private var builderState = OnboardingStore()
    /// Ripple channel shared by the pixelwave background and every selectable
    /// chip (via `\.glyphRippleEmitter`), matching OnboardingView's wiring.
    @State private var rippleEmitter = GlyphRippleEmitter()

    /// Current builder page (0…7).
    @State private var slot = 0
    /// Edge the incoming page slides from — set alongside `slot` so the
    /// outgoing page's removal matches travel direction (OnboardingCarousel
    /// pattern).
    @State private var slideEdge: Edge = .trailing
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var didSeed = false

    // Pixelwave tint interpolation (mirrors OnboardingView — Canvas can't tween
    // colors, so from/to/blend snapshot the painted color on every retarget so
    // an interrupted glide never jumps).
    @State private var tintFrom: Color = .appPrimary
    @State private var tintTo: Color = .appPrimary
    @State private var tintBlend: Double = 1

    /// The eight onboarding builder steps, in carousel order.
    private enum BuilderStep: Int, CaseIterable {
        case sports, archetype, mindset, betStyle, dataTrust, sportRules, insights, identity
    }
    private var step: BuilderStep { BuilderStep(rawValue: slot) ?? .sports }
    private var isLast: Bool { slot == BuilderStep.allCases.count - 1 }

    var body: some View {
        ZStack {
            // Persistent reactive backdrop — same params as OnboardingView.
            // Hit-inert (the pager sits over it); ripples arrive via the emitter.
            // `.ignoresSafeArea(.keyboard)` matters: a keyboard resize would
            // reconfigure the glyph grid and visibly reset the field while the
            // agent-name keyboard is up on the identity page.
            AnimatedAccentPixelWave(
                from: tintFrom,
                to: tintTo,
                blend: tintBlend,
                rippleEmitter: rippleEmitter
            )
            .ignoresSafeArea()
            .ignoresSafeArea(.keyboard)
            .allowsHitTesting(false)

            OnboardingPageShell(
                progress: Double(slot + 1) / Double(BuilderStep.allCases.count),
                continueTitle: isLast ? "Create my agent" : "Continue",
                isCTAEnabled: ctaEnabled && !isSubmitting,
                isCTALoading: isSubmitting,
                canGoBack: true,
                // Custom (transparent) chrome, NOT the NavigationStack variant:
                // the native chrome paints an opaque background that would hide
                // the pixelwave (same reason OnboardingCarouselContainer opts out).
                useNativeChrome: false,
                ctaTint: accent,
                background: { Color.clear },
                content: { pager },
                onContinue: onContinue,
                onBack: onBack
            )
        }
        .preferredColorScheme(.dark)
        // Satisfy the builder pages' OnboardingStore dependency + share the
        // ripple channel with the pixelwave (chip taps emit ripples).
        .environment(builderState)
        .environment(\.glyphRippleEmitter, rippleEmitter)
        // The shell owns navigation chrome; hide the host NavigationStack bar so
        // the pixelwave bleeds to the top edge.
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .light), trigger: slot)
        .onChange(of: accent) { _, target in retargetTint(to: target) }
        // Pre-warm archetype presets so the archetype page never opens to a
        // spinner (same pre-fetch the standalone wizard + onboarding do).
        .task { await creation.loadArchetypesIfNeeded() }
        .onAppear(perform: seedIfNeeded)
        .alert(
            "Couldn't create agent",
            isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
        ) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: - Pager

    /// Button-driven directional slide over the eight builder pages — only the
    /// active page is mounted (answers live in the store, so mount/unmount is
    /// free). Degrades to a cross-fade under Reduce Motion. Mirrors
    /// OnboardingCarouselContainer.pager.
    private var pager: some View {
        ZStack {
            pageContent(for: slot)
                .id(slot)
                .transition(
                    reduceMotion
                        ? .opacity
                        : .asymmetric(
                            insertion: .move(edge: slideEdge),
                            removal: .move(edge: slideEdge == .trailing ? .leading : .trailing)
                        )
                )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(reduceMotion ? .linear(duration: 0.15) : .appCarousel, value: slot)
    }

    @ViewBuilder
    private func pageContent(for slot: Int) -> some View {
        switch BuilderStep(rawValue: slot) ?? .sports {
        case .sports:     OnboardingBuilderSportsPage(creation: creation)
        case .archetype:  OnboardingBuilderArchetypePage(creation: creation)
        case .mindset:    OnboardingBuilderMindsetPage(creation: creation)
        case .betStyle:   OnboardingBuilderBetStylePage(creation: creation)
        case .dataTrust:  OnboardingBuilderDataTrustPage(creation: creation)
        case .sportRules: OnboardingBuilderSportRulesPage(creation: creation)
        case .insights:   OnboardingBuilderInsightsPage(creation: creation)
        case .identity:   OnboardingBuilderIdentityPage(creation: creation)
        }
    }

    // MARK: - CTA gating (mirrors OnboardingStore.canAdvance for builder steps)

    private var ctaEnabled: Bool {
        switch step {
        case .sports:
            return !creation.draft.preferredSports.isEmpty
        case .archetype:
            return builderState.hasChosenArchetype
        case .identity:
            let trimmed = creation.draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
            return !trimmed.isEmpty && trimmed.count <= 50
        default:
            return true
        }
    }

    // MARK: - Accent

    /// Archetype accent wins once chosen (matches onboarding's tint logic);
    /// before that the chosen avatar gradient drives, falling back to the brand
    /// green via the Draft's default gradient.
    private var accent: Color {
        if builderState.hasChosenArchetype,
           let id = creation.draft.archetype?.rawValue,
           let hex = creation.archetypeRows.first(where: { $0.id == id })?.color,
           let archetypeColor = Color(hexString: hex) {
            return archetypeColor
        }
        return AgentColorPalette.primary(for: creation.draft.avatarColor)
    }

    // MARK: - Navigation

    private func onContinue() {
        guard ctaEnabled, !isSubmitting else { return }
        if isLast {
            Task { await submit() }
        } else {
            slideEdge = .trailing
            slot += 1
        }
    }

    private func onBack() {
        if slot > 0 {
            slideEdge = .leading
            slot -= 1
        } else {
            // First page — leaving the builder pops back to the Agents hub.
            dismiss()
        }
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }

        guard var agent = await creation.submit(autoModeForcedOff: false) else {
            if case .failed(let reason) = creation.submitState {
                errorMessage = reason
            } else {
                errorMessage = "Something went wrong creating your agent. Please try again."
            }
            return
        }

        // `create_agent` has no sprite field — persist the chosen pixel
        // character via update_agent right after creation (same pattern the
        // onboarding genesis model uses). Patch the local copy immediately so
        // the detail page matches even if the network write lags.
        if let sprite = creation.draft.spriteIndex, agent.spriteIndex != sprite {
            agent.spriteIndexOverride = sprite
            let agentId = agent.id
            Task.detached {
                _ = try? await AgentAuthorizedActionsService.updateAgent(
                    agentId: agentId,
                    payload: ["sprite_index": AnyEncodable(sprite)]
                )
            }
        }

        onCreated(agent)
    }

    // MARK: - Seeding

    /// Pick the pixel character once so the identity preview doesn't reshuffle
    /// per keystroke (the user can change it on the identity page). Sports stay
    /// empty — the first builder page collects them from scratch — UNLESS an
    /// `initialDraft` was supplied (Copy build), in which case we seed the
    /// whole draft from it so every page opens pre-filled.
    private func seedIfNeeded() {
        guard !didSeed else { return }
        didSeed = true
        if let initialDraft {
            creation.draft = initialDraft
            // Copy build already chose an archetype (if any) — flip the local
            // OnboardingStore flag so the archetype page's CTA gate + accent
            // logic treat it as already-chosen instead of asking the viewer
            // to pick one again.
            if initialDraft.archetype != nil {
                builderState.setArchetypeChosen()
            }
        }
        if creation.draft.spriteIndex == nil {
            creation.draft.spriteIndex = Int.random(in: 0...7)
        }
    }

    /// Glide the pixelwave tint to `newColor`, restarting from whatever color is
    /// currently painted (interruption-safe) — copied from OnboardingView.
    private func retargetTint(to newColor: Color) {
        tintFrom = tintFrom.mix(with: tintTo, by: tintBlend)
        tintTo = newColor
        tintBlend = 0
        withAnimation(reduceMotion ? .linear(duration: 0.001) : .appSlow) {
            tintBlend = 1
        }
    }
}
