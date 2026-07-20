import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Hosts carousel steps 1...18 in ONE `OnboardingPageShell` wrapping a
/// custom directional-slide pager. The chrome (progress bar, Liquid Glass
/// back chevron, Continue CTA) stays fixed while pages slide beneath it —
/// the pre-redesign flow gave every step its own shell, which made the
/// chrome ride each cross-fade.
///
/// Navigation is STRICTLY button-driven. This intentionally does NOT use
/// `TabView(.page)`: the paging style's internal pan recognizer ignores
/// `.scrollDisabled(true)` on device, letting users swipe past unanswered
/// questions. A ZStack with directional `.move` transitions gives the same
/// native slide with no gesture surface at all — there is simply nothing
/// to swipe.
struct OnboardingCarouselContainer: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The wizard draft store shared with the genesis cinematic — owned by
    /// `OnboardingView` so it outlives this container when the carousel
    /// fades out for the generation phase.
    let creationStore: AgentCreationStore
    /// Live accent (bettor type / archetype) — tints the CTA pill in sync
    /// with the pixel background.
    let accent: Color

    /// Slot the container starts on — `store.currentStep` at creation time,
    /// so harness/debug entry lands directly without a first-frame slide.
    let initialSlot: Int

    /// Local mirror of `store.currentStep.carouselIndex`, animated by the
    /// `.animation(value:)` on the pager below.
    @State private var selection: Int
    /// Which edge the INCOMING page enters from. Set alongside `selection`
    /// in the same update so the outgoing page's removal edge matches.
    @State private var slideEdge: Edge = .trailing
    /// One-shot guard for pre-filling the agent draft from the survey.
    @State private var didSeedBuilder = false

    init(creationStore: AgentCreationStore, accent: Color, initialSlot: Int) {
        self.creationStore = creationStore
        self.accent = accent
        self.initialSlot = initialSlot
        self._selection = State(initialValue: initialSlot)
    }

    var body: some View {
        let spec = OnboardingPageSpec.spec(for: store.currentStep)

        OnboardingPageShell(
            progress: store.currentStep.progress,
            continueTitle: spec.ctaTitle,
            isCTAEnabled: spec.isCTAEnabled(store) && !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep > .terms,
            // Custom chrome, NOT the NavigationStack variant: the nav
            // stack's hosting layer paints an opaque system background that
            // hides the root pixelwave. The custom band is transparent and
            // renders the progress bar + glass chevron as one toolbar strip.
            useNativeChrome: false,
            ctaTint: accent,
            // Continue always reads as a bright white Liquid Glass pill with
            // black label for contrast — only the progress bar fill (still
            // `ctaTint` above) recolors with the bettor-type/archetype accent.
            ctaButtonColor: .white,
            ctaButtonForeground: .black,
            ctaButtonSurfaceOpacity: 0.92,
            background: { Color.clear },   // the root pixelwave shows through
            content: { pager },
            onContinue: { spec.onContinue(store) },
            onBack: { store.back() }
        )
        // Value-scoped: only accent changes animate here (CTA tint glide in
        // step with the background's AnimatedAccentPixelWave).
        .animation(reduceMotion ? nil : .appSlow, value: accent)
        .onAppear { seedBuilderIfNeeded() }
        .onChange(of: store.currentStep) { old, step in
            // Cinematic steps hold the last index — the container is fading
            // out and must not slide pages during its exit transition.
            if let idx = step.carouselIndex {
                // Both edges derive from the SAME update as `selection` so
                // the outgoing page's removal matches the travel direction.
                slideEdge = step.rawValue >= old.rawValue ? .trailing : .leading
                selection = idx
            }
            // Pre-fill the agent draft before the builder pages appear.
            if step >= .agentValueIntro { seedBuilderIfNeeded() }
        }
        // Mirror every wizard mutation into onboarding state so `canAdvance`,
        // the persisted payload, and the cinematic screens all read one
        // source of truth.
        .onChange(of: creationStore.draft) { _, _ in
            projectDraftToStore()
        }
    }

    // MARK: - Pager

    /// Button-driven directional slide. Only the active page is mounted
    /// (plus the outgoing one for the duration of the transition) — pages
    /// are stateless (answers live in the store), so mount/unmount is free.
    /// Under Reduce Motion the slide degrades to a fast cross-fade.
    private var pager: some View {
        ZStack {
            pageContent(for: selection)
                .id(selection)
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
        // Deliberately NOT clipped: page ScrollViews must draw under the
        // transparent toolbar band and the floating CTA (both are safe-area
        // insets), so scrolled content stays visible through the chrome.
        // Horizontal slide travel is clipped by the screen edges anyway.
        .animation(
            reduceMotion ? .linear(duration: 0.15) : .appCarousel,
            value: selection
        )
    }

    @ViewBuilder
    private func pageContent(for slot: Int) -> some View {
        switch OnboardingStep(rawValue: slot + 1) {
        case .terms:             OnboardingTermsPage()
        case .bettorType:        OnboardingBettorTypePage()
        case .bettingPitfalls:   OnboardingBettingPitfallsPage()
        case .acquisitionSource: OnboardingAcquisitionPage()
        case .primaryGoal:       OnboardingPrimaryGoalPage()
        case .researchTime:      OnboardingResearchTimePage()
        case .weeklyStakes:      OnboardingStakesPage()
        case .researchCost:      OnboardingResearchCostPage()
        case .researchReclaim:   OnboardingResearchReclaimPage()
        case .agentHQ:           OnboardingAgentHQPage()
        case .agentValueIntro:   OnboardingAgentPitchIntroPage()
        case .agentValueProof:   OnboardingAgentPitchProofPage()
        case .agentLeaderboard:  OnboardingLeaderboardPage()
        case .attPriming:        OnboardingATTPage()
        case .builderSports:     OnboardingBuilderSportsPage(creation: creationStore)
        case .builderArchetype:  OnboardingBuilderArchetypePage(creation: creationStore)
        case .builderMindset:    OnboardingBuilderMindsetPage(creation: creationStore)
        case .builderBetStyle:   OnboardingBuilderBetStylePage(creation: creationStore)
        case .builderDataTrust:  OnboardingBuilderDataTrustPage(creation: creationStore)
        case .builderSportRules: OnboardingBuilderSportRulesPage(creation: creationStore)
        case .builderInsights:   OnboardingBuilderInsightsPage(creation: creationStore)
        case .builderIdentity:   OnboardingBuilderIdentityPage(creation: creationStore)
        default:                 Color.clear
        }
    }

    // MARK: - Draft seeding & projection

    /// Pre-fill the wizard store's sprite (and a default sport) so the
    /// builder never opens to a blank state. Runs once, right before the
    /// builder pages pre-mount.
    private func seedBuilderIfNeeded() {
        guard !didSeedBuilder, store.currentStep >= .agentValueIntro else { return }
        didSeedBuilder = true

        // Pick the pixel character ONCE — the identity preview must not
        // reshuffle per keystroke (the legacy look derived it from a name
        // hash). The user can change it with the picker on the identity page.
        if creationStore.draft.spriteIndex == nil {
            creationStore.draft.spriteIndex = Int.random(in: 0...7)
        }

        guard creationStore.draft.preferredSports.isEmpty else { return }
        // No survey signal to seed from anymore (the redundant "which
        // sports do you follow" question was removed — `.builderSports` is
        // the one place preferred sports get chosen). Default to NFL so
        // that page doesn't open to an empty, CTA-disabled state.
        creationStore.draft.preferredSports = [.nfl]
        projectDraftToStore()
    }

    /// Copy the wizard draft into `OnboardingStore.agentDraft` so
    /// `markComplete()` persists it and the reveal card renders live values.
    private func projectDraftToStore() {
        var next = OnboardingStore.AgentDraft()
        next.preferredSports = creationStore.draft.preferredSports.compactMap {
            SportLeague(rawValue: $0.rawValue)
        }
        next.archetype = creationStore.draft.archetype?.rawValue
        next.name = creationStore.draft.name
        next.avatarEmoji = creationStore.draft.avatarEmoji
        next.avatarColor = creationStore.draft.avatarColor
        next.spriteIndex = creationStore.draft.spriteIndex
        next.personalityParams = creationStore.draft.personalityParams
        next.customInsights = creationStore.draft.customInsights
        next.autoGenerate = creationStore.draft.autoGenerate
        next.autoGenerateTime = creationStore.draft.autoGenerateTime
        next.autoGenerateTimezone = creationStore.draft.autoGenerateTimezone
        store.setAgentDraft(next)
    }
}
