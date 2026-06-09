// OnboardingAcquisitionView.swift
//
// Step 6: single-select chip grid "Where did you hear about us?".
// Port of `Step13_AcquisitionSource.tsx`.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`. CTA stays disabled until a source is picked.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingAcquisitionView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var selected: String?

    private let sources = [
        "TikTok", "X/Twitter", "YouTube", "Google", "Friend/Referral", "Other"
    ]

    private let columns = [GridItem(.adaptive(minimum: 130), spacing: 12)]

    var body: some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            isCTAEnabled: selected != nil && !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                ScrollView {
                    VStack(spacing: 12) {
                        Text("Where did you hear about us?")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding(.top, 16)
                            .padding(.horizontal, 24)
                            .padding(.bottom, 16)

                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(sources, id: \.self) { source in
                                ChipButton(
                                    label: source,
                                    isSelected: selected == source
                                ) {
                                    selected = source
                                }
                            }
                        }
                        .padding(.horizontal, 24)
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
                .sensoryFeedback(.selection, trigger: selected)
            },
            onContinue: {
                guard let s = selected else { return }
                store.setAcquisitionSource(s)
                store.advance()
            },
            onBack: { store.back() }
        )
    }
}

/// Shared chip used by acquisition / sports / similar grids.
struct ChipButton: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 48)
                .padding(.horizontal, 16)
                .background(
                    RoundedRectangle(cornerRadius: 50)
                        .fill(isSelected ? Color.appPrimary.opacity(0.25) : Color.white.opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 50)
                        .strokeBorder(isSelected ? Color.appPrimary : Color.white.opacity(0.2), lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
    }
}
