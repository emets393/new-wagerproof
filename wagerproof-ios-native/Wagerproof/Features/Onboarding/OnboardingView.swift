// OnboardingView.swift
//
// 21-step onboarding wizard. 1:1 SwiftUI port of
// `wagerproof-mobile/app/(onboarding)/index.tsx` + every file under
// `wagerproof-mobile/components/onboarding/steps/`.
//
// Wired to the real `OnboardingStore`:
//   - `store.currentStep` drives the pager selection and the cinematic branch.
//   - `store.advance()` / `store.back()` are the only navigation surfaces.
//   - `store.markComplete()` is called from `AgentBornView`'s "Let's go!" CTA.
//
// Container choreography mirrors RN exactly:
//   - Steps 1..14 → individual pages in a `TabView(.page(indexDisplayMode: .never))`.
//   - Steps 15..19 → a single pager page (`pagerIndex == 14`) hosted by
//     `OnboardingAgentBuilderView` which owns its own sub-flow.
//   - Steps 20..21 → cinematic full-screen views rendered OUTSIDE the pager.
//
// Spec: docs/wagerproof-migration/08-screen-native-spec.md §5.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingView: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            // Layer 1: base background — solid dark + bottom-up teal
            // gradient. Matches RN's #0F1117 +
            // LinearGradient(transparent → rgba(34,197,94,.14)).
            Color(hex: 0x0F1117).ignoresSafeArea()
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.3),
                    .init(color: Color.appPrimary.opacity(0.14), location: 1)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Layer 2: per-step view, ZStack-switched on `currentStep`.
            // Mirrors Honeydew's `OnboardingFlowView` (no TabView, no
            // swipe — the system can never page horizontally because
            // there's no pager container). Each branch attaches a
            // `.transition(.opacity)` so SwiftUI cross-fades the swap
            // when `store.currentStep` flips. AgentBuilder steps 15..19
            // share one branch (the builder owns its own sub-flow).
            stepLayer
        }
        .preferredColorScheme(.dark)
        // `.appSlow` per the motion spec — onboarding transitions are
        // deliberately weighty so the user perceives the swap, not a
        // hard cut. Reduce Motion gets a near-instant linear so the UI
        // still updates but doesn't dissolve.
        .animation(
            reduceMotion ? .linear(duration: 0.001) : .appSlow,
            value: store.currentStep
        )
        .sensoryFeedback(.impact(weight: .light), trigger: store.advanceCount)
    }

    // MARK: - Step switcher

    @ViewBuilder
    private var stepLayer: some View {
        switch store.currentStep {
        case .personalizationIntro:
            OnboardingPersonalizationIntroView().transition(.opacity)
        case .termsAcceptance:
            OnboardingTermsView().transition(.opacity)
        case .sportsSelection:
            OnboardingSportsView().transition(.opacity)
        case .ageConfirmation:
            OnboardingAgeView().transition(.opacity)
        case .bettorType:
            OnboardingBettorTypeView().transition(.opacity)
        case .acquisitionSource:
            OnboardingAcquisitionView().transition(.opacity)
        case .primaryGoal:
            OnboardingPrimaryGoalView().transition(.opacity)
        case .valueClaim:
            OnboardingValueClaimView().transition(.opacity)
        case .featureSpotlight:
            OnboardingFeatureSpotlightView().transition(.opacity)
        case .dataTransparency:
            OnboardingDataTransparencyView().transition(.opacity)
        case .agentValue247:
            OnboardingAgentValue247View().transition(.opacity)
        case .agentValueAssistant:
            OnboardingAgentValueAssistantView().transition(.opacity)
        case .agentValueStrategies:
            OnboardingAgentValueStrategiesView().transition(.opacity)
        case .agentValueLeaderboard:
            OnboardingAgentValueLeaderboardView().transition(.opacity)
        case .agentBuilderSport,
             .agentBuilderIdentity,
             .agentBuilderPersonality,
             .agentBuilderData,
             .agentBuilderInsights:
            // The builder is a single host that internally swaps its
            // five sub-pages off `currentStep`. ZStack-switch all five
            // step values to the same view so the transition only fires
            // when entering / leaving the builder, not between its inner
            // sub-pages (the builder owns those animations).
            OnboardingAgentBuilderView().transition(.opacity)
        case .agentGeneration:
            AgentGenerationView().transition(.opacity)
        case .agentBorn:
            AgentBornView().transition(.opacity)
        }
    }
}

#if DEBUG
#Preview("Onboarding — step 1") {
    OnboardingView()
        .environment(OnboardingStore())
}
#endif
