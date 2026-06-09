// OnboardingAgentBuilderView.swift
//
// Hosts the full 5-step agent-creation wizard inside the onboarding pager
// (steps 15..19). Reuses the standalone wizard's step views verbatim by
// instantiating a private `AgentCreationStore` and projecting its `draft`
// back into `OnboardingStore.agentDraft` on every change so the cinematic
// `AgentGenerationView` / `AgentBornView` (steps 20..21) and the eventual
// post-onboarding agent-creation pipeline see the same data the standalone
// wizard would have produced.
//
// Mapping of onboarding step -> wizard step:
//   15 agentBuilderSport       -> Step1SportArchetypeView (wizard idx 0)
//   16 agentBuilderIdentity    -> Step2IdentityView       (wizard idx 1)
//   17 agentBuilderPersonality -> Step3PersonalityView    (wizard idx 2)
//   18 agentBuilderData        -> Step4DataAndConditionsView (wizard idx 3)
//   19 agentBuilderInsights    -> Step5CustomInsightsView (wizard idx 4)
//
// Why we don't mount the wizard's Step6Review here:
//   Onboarding replaces Review with the cinematic AgentGenerationView (step
//   20) + AgentBornView (step 21). The eventual real submit happens in the
//   post-onboarding pipeline (see .claude/docs/agents/06_IMPLEMENTATION.md);
//   onboarding only collects the draft.
//
// State handoff approach: own-store + push-back-on-change. Cleanest option
// because the wizard views require `@Bindable AgentCreationStore` for their
// inputs (text fields, sliders, toggles). Projecting onto `OnboardingStore`
// at each mutation keeps the persisted draft (used by AgentBornView card)
// always fresh without rewriting the wizard views to read from a different
// store.
//
// RN source: `components/onboarding/steps/OnboardingAgentBuilder.tsx`.

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

struct OnboardingAgentBuilderView: View {
    @Environment(OnboardingStore.self) private var store

    // One store owned by the onboarding builder for the lifetime of these
    // five steps. Seeded from `store.agentDraft` on first appearance so a
    // user who taps Back into onboarding step 14 and forward again sees
    // their prior choices intact.
    @State private var agentCreationStore = AgentCreationStore()
    @State private var didSeed = false

    var body: some View {
        // Each step is its own `OnboardingPageShell` so the chrome
        // (back chevron, progress bar, Liquid Glass CTA) matches the rest
        // of onboarding. Steps render edge-to-edge over the parent gradient.
        Group {
            switch store.currentStep {
            case .agentBuilderSport:
                wizardStep(index: 0) {
                    Step1SportArchetypeView(store: agentCreationStore)
                }
            case .agentBuilderIdentity:
                wizardStep(index: 1) {
                    Step2IdentityView(store: agentCreationStore)
                }
            case .agentBuilderPersonality:
                wizardStep(index: 2) {
                    Step3PersonalityView(store: agentCreationStore)
                }
            case .agentBuilderData:
                wizardStep(index: 3) {
                    Step4DataAndConditionsView(store: agentCreationStore)
                }
            case .agentBuilderInsights:
                wizardStep(index: 4) {
                    Step5CustomInsightsView(store: agentCreationStore)
                }
            default:
                // Defensive — pager swaps to a different child for non-builder
                // steps. Should never render.
                EmptyView()
            }
        }
        .onAppear { seedDraftIfNeeded() }
        // Mirror every wizard mutation back into onboarding state so the
        // cinematic AgentBorn screen and the persisted onboarding payload
        // stay aligned with the live wizard draft.
        .onChange(of: agentCreationStore.draft) { _, _ in
            projectBackToOnboarding()
        }
        // Preload archetype presets so switching to the preset path on
        // step 15 doesn't flash an empty + spinner. Matches the
        // standalone AgentCreationView.task() behaviour.
        .task {
            await agentCreationStore.loadArchetypesIfNeeded()
        }
    }

    // MARK: - Seeding & projection

    /// Pre-fill the wizard store from any prior choices, plus seed sports
    /// from the user's survey if they haven't picked agent sports yet.
    /// Runs once when this view first appears at step 15.
    private func seedDraftIfNeeded() {
        guard !didSeed else { return }
        didSeed = true

        var draft = AgentCreationStore.Draft()

        // Carry forward stored choices first.
        if !store.agentDraft.preferredSports.isEmpty {
            draft.preferredSports = store.agentDraft.preferredSports.compactMap {
                AgentSport(rawValue: $0.rawValue)
            }
        } else {
            // Mirror RN pre-fill: map the survey's favoriteSports labels to
            // AgentSport enums. Fallback to NFL if the user picked nothing
            // mappable so the wizard isn't stuck at the empty-state CTA.
            let map: [String: AgentSport] = [
                "NFL": .nfl,
                "College Football": .cfb,
                "NBA": .nba,
                "NCAAB": .ncaab,
                "MLB": .mlb
            ]
            let mapped = store.survey.favoriteSports.compactMap { map[$0] }
            draft.preferredSports = mapped.isEmpty ? [.nfl] : mapped
        }

        if let archetypeRaw = store.agentDraft.archetype,
           let archetype = AgentArchetype(rawValue: archetypeRaw) {
            draft.archetype = archetype
        }
        if !store.agentDraft.name.isEmpty {
            draft.name = store.agentDraft.name
        }
        if !store.agentDraft.avatarEmoji.isEmpty {
            draft.avatarEmoji = store.agentDraft.avatarEmoji
        }
        if !store.agentDraft.avatarColor.isEmpty {
            draft.avatarColor = store.agentDraft.avatarColor
        }
        draft.personalityParams = store.agentDraft.personalityParams
        draft.customInsights = store.agentDraft.customInsights
        draft.autoGenerate = store.agentDraft.autoGenerate
        draft.autoGenerateTime = store.agentDraft.autoGenerateTime
        draft.autoGenerateTimezone = store.agentDraft.autoGenerateTimezone

        agentCreationStore.draft = draft

        // Push the seeded state back so onboarding's persisted snapshot has
        // the survey-derived sports immediately (even if the user advances
        // without touching the picker).
        projectBackToOnboarding()
    }

    /// Copy the wizard draft back into `OnboardingStore.agentDraft`. Called
    /// on every wizard mutation so the cinematic screens and the eventual
    /// `markComplete()` payload see the latest values.
    private func projectBackToOnboarding() {
        var next = OnboardingStore.AgentDraft()
        next.preferredSports = agentCreationStore.draft.preferredSports.compactMap {
            SportLeague(rawValue: $0.rawValue)
        }
        next.archetype = agentCreationStore.draft.archetype?.rawValue
        next.name = agentCreationStore.draft.name
        next.avatarEmoji = agentCreationStore.draft.avatarEmoji
        next.avatarColor = agentCreationStore.draft.avatarColor
        next.personalityParams = agentCreationStore.draft.personalityParams
        next.customInsights = agentCreationStore.draft.customInsights
        next.autoGenerate = agentCreationStore.draft.autoGenerate
        next.autoGenerateTime = agentCreationStore.draft.autoGenerateTime
        next.autoGenerateTimezone = agentCreationStore.draft.autoGenerateTimezone
        store.setAgentDraft(next)
    }

    // MARK: - Step shell

    /// Wrap a wizard step in `OnboardingPageShell` so it picks up the
    /// onboarding chrome (back, progress bar, Liquid Glass CTA). The CTA's
    /// enabled state mirrors the wizard's own `canProceed(from:)` so the
    /// validation gates match the standalone builder exactly.
    // `content` is plain `@escaping` (not `@ViewBuilder`) because Swift drops
    // the escaping attribute when a closure parameter is also `@ViewBuilder`,
    // which trips the OnboardingPageShell content slot (it requires escaping).
    // Each call site already returns a single child View, so multi-statement
    // ViewBuilder semantics aren't needed at this seam.
    @ViewBuilder
    private func wizardStep<Content: View>(
        index wizardIndex: Int,
        content: @escaping () -> Content
    ) -> some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            isCTAEnabled: agentCreationStore.canProceed(from: wizardIndex) && !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                ScrollView {
                    VStack(spacing: 16) {
                        content()
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    // Shell handles the CTA's safe-area inset; only a thin
                    // tail buffer here so the last interactive control
                    // isn't visually flush with the CTA's glass rim.
                    .padding(.bottom, 8)
                }
                .scrollDismissesKeyboard(.immediately)
            },
            onContinue: {
                // Just advance — markComplete() is owned by AgentBornView's
                // "Let's go!" CTA on step 21. Calling it here would flip
                // `isComplete=true` which immediately drives RootRouter to
                // `.ready`, swapping OnboardingView → MainTabView and never
                // rendering the cinematic AgentGeneration (20) / AgentBorn
                // (21) screens. The full draft is captured in
                // `onboarding.agentDraft` via `projectBackToOnboarding()` so
                // markComplete() at the cinematic still has the right data.
                store.advance()
            },
            onBack: { store.back() }
        )
    }
}
