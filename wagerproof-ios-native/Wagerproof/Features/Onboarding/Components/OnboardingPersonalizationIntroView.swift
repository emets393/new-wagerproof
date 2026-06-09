// OnboardingPersonalizationIntroView.swift
//
// Step 1 of 21. Port of `components/onboarding/steps/Step1_PersonalizationIntro.tsx`.
// RN renders a Lottie `face-recognition-mobile.json` animation deferred via
// `InteractionManager.runAfterInteractions`. The Swift port mirrors that by
// gating mount on a 200ms `Task.sleep` so text paints first.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) is owned by
// `OnboardingPageShell` from WagerproofDesign. The shell paints a Color.clear
// background so the orchestrator's base gradient (rendered by OnboardingView)
// remains visible through the page.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingPersonalizationIntroView: View {
    @Environment(OnboardingStore.self) private var store

    // Deferred mount mirrors RN's `InteractionManager.runAfterInteractions`:
    // text renders instantly, Lottie composes after the screen transition.
    @State private var lottieReady = false

    var body: some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            isCTAEnabled: !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                ScrollView {
                    VStack(spacing: 24) {
                        Spacer(minLength: 16)
                        Text("Welcome!")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                        Text("Let's personalize your experience.")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.white.opacity(0.7))

                        // RN renders `face-recognition-mobile.json` in a 280×280
                        // square. We match those dimensions exactly.
                        ZStack {
                            if lottieReady {
                                LottieView(name: "face-recognition-mobile")
                            }
                        }
                        .frame(width: 280, height: 280)
                        .padding(.vertical, 8)

                        Text("Answer a few quick questions so we can tune your dashboard and picks.")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 24)
                }
            },
            onContinue: { store.advance() },
            onBack: { store.back() }
        )
        .task {
            // Defer Lottie mount ~200ms so the screen transition finishes
            // before we hand the runloop to animation decoding.
            try? await Task.sleep(nanoseconds: 200_000_000)
            lottieReady = true
        }
    }
}
