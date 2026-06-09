// OnboardingDataTransparencyView.swift
//
// Step 10: ATT mockup + explanation. Port of `Step14_DataTransparency.tsx`.
// On iOS the real ATT prompt is triggered via `ATTrackingManager.requestTrackingAuthorization`.
// We mirror RN: ask on appear (if status is undetermined), then continue
// regardless of the user's choice.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`.

import SwiftUI
import AppTrackingTransparency
import WagerproofDesign
import WagerproofStores

struct OnboardingDataTransparencyView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var didRequestATT = false

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
                    VStack(spacing: 14) {
                        Text("One quick thing")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.top, 16)

                        (Text("Please tap ")
                            + Text("Allow").foregroundColor(Color.appPrimary).bold()
                            + Text(" so that we can prevent you from seeing advertising in the future and also find more users that would like to use the app."))
                            .font(.system(size: 16))
                            .foregroundStyle(Color.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                            .padding(.horizontal, 24)

                        attMockup
                            .padding(.horizontal, 40)
                            .padding(.top, 16)

                        HStack(spacing: 6) {
                            Image(systemName: "arrow.up")
                                .foregroundStyle(Color.white.opacity(0.5))
                            Text("Tap Allow when the pop-up appears")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.white.opacity(0.5))
                        }
                        .padding(.top, 12)
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
            },
            onContinue: { store.advance() },
            onBack: { store.back() }
        )
        .task {
            await requestATTIfNeeded()
        }
    }

    private var attMockup: some View {
        VStack(spacing: 0) {
            // App icon
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(hex: 0x0F1117))
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 28))
                    .foregroundStyle(Color.appPrimary)
            }
            .frame(width: 48, height: 48)
            .padding(.top, 24)
            .padding(.bottom, 12)

            Text("Allow \"WagerProof\" to track your\nactivity across other companies'\napps and websites?")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 24)
                .padding(.bottom, 8)

            Text("Your data will be used to deliver personalized ads to you.")
                .font(.system(size: 12))
                .foregroundStyle(Color.white.opacity(0.5))
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)

            Divider().background(Color.white.opacity(0.15))
            Text("Allow")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.appPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)

            Divider().background(Color.white.opacity(0.15))
            Text("Ask App Not to Track")
                .font(.system(size: 17))
                .foregroundStyle(Color.white.opacity(0.5))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white.opacity(0.12))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(Color.white.opacity(0.15), lineWidth: 1)
        )
    }

    /// Mirrors RN's ATT request inside Step14. Fires on first appearance only.
    /// Result is ignored — onboarding always advances; ATT controls IDFA.
    @MainActor
    private func requestATTIfNeeded() async {
        guard !didRequestATT else { return }
        didRequestATT = true
        let status = ATTrackingManager.trackingAuthorizationStatus
        if status == .notDetermined {
            _ = await ATTrackingManager.requestTrackingAuthorization()
        }
    }
}
