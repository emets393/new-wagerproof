// OnboardingFeatureSpotlightView.swift
//
// Step 9: feature spotlight demo. RN runs a multi-phase tutorial with the
// Dynamic-Island-style "Scan this page" pill, animated wave, and a demo
// game card → bottom sheet. The native port collapses this into a static
// spotlight card with a `.symbolEffect(.bounce, options: .repeating)` per
// 08-spec §5 — the full interactive tutorial depends on `NFLGameCard` /
// `DemoGameBottomSheet` which land in B14.
//
// FIDELITY-WAIVER #028: Multi-phase scan tutorial collapsed to single static
// spotlight; full tutorial port deferred until B14 lands NFLGameCard.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingFeatureSpotlightView: View {
    @Environment(OnboardingStore.self) private var store

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
                        Text("Scan any page to highlight edges")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding(.top, 16)
                            .padding(.horizontal, 24)

                        // FIDELITY-WAIVER #028: Animated scan-wave + demo cards
                        // replaced by single icon. Full port deferred to B14.
                        ZStack {
                            RoundedRectangle(cornerRadius: 20)
                                .fill(Color.appPrimary.opacity(0.1))
                                .frame(height: 260)
                            VStack(spacing: 16) {
                                Image(systemName: "sparkles.rectangle.stack")
                                    .font(.system(size: 80))
                                    .foregroundStyle(Color.appPrimary)
                                    .symbolEffect(.bounce, options: .repeating)
                                Text("Tap any matchup for pro-grade data")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Color.white.opacity(0.85))
                                    .multilineTextAlignment(.center)
                            }
                        }
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .strokeBorder(Color.appPrimary.opacity(0.5), lineWidth: 1.5)
                        )
                        .padding(.horizontal, 24)

                        Text("See the pro-grade data we surface for every matchup.")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                            .padding(.horizontal, 32)
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
            },
            onContinue: { store.advance() },
            onBack: { store.back() }
        )
    }
}
