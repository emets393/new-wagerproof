// OnboardingValueClaimView.swift
//
// Step 8: "Stop guessing." value claim with three stat cards.
// Port of `Step10_ValueClaim.tsx`. RN includes a Lottie animation; we
// substitute SF Symbols + stat tiles.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`. Headline + subtitle are inlined now that the legacy
// `OnboardingHeadline` helper has been retired.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingValueClaimView: View {
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
                    VStack(spacing: 16) {
                        VStack(spacing: 16) {
                            Text("Stop guessing.")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.center)
                                .lineSpacing(4)

                            Text("Users report cutting research time and \"wasting less on dumb bets.\" (their words not ours)")
                                .font(.system(size: 16))
                                .foregroundStyle(Color.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .lineSpacing(4)
                        }
                        .padding(.horizontal, 8)
                        .padding(.top, 16)
                        .padding(.horizontal, 24)

                        VStack(spacing: 16) {
                            StatTile(icon: "bolt.fill", value: "5x", label: "Faster Research")
                            StatTile(icon: "chart.line.uptrend.xyaxis", value: "68%", label: "Win Rate")
                            StatTile(icon: "target", value: "12+", label: "Value Edges/Week")
                        }
                        .padding(24)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.white.opacity(0.06))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
                        )
                        .padding(.horizontal, 24)
                        .padding(.top, 8)
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
            },
            onContinue: { store.advance() },
            onBack: { store.back() }
        )
    }
}

private struct StatTile: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(Color.appPrimary)
            Text(value)
                .font(.system(size: 36, weight: .bold))
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
    }
}
