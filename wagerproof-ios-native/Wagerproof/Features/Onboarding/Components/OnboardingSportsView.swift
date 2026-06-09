// OnboardingSportsView.swift
//
// Step 3: multi-select sports chip grid. Port of `Step2_SportsSelection.tsx`.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`. CTA stays disabled until the user picks at least one
// sport (RN allowed advancing with an empty selection, but the Liquid Glass
// refresh standardises "require at least one" across selection screens).

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingSportsView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var selected: Set<String> = []

    private let sports = [
        "NFL", "College Football", "NBA", "MLB", "NCAAB", "Soccer", "Other"
    ]

    private let columns = [
        GridItem(.adaptive(minimum: 120), spacing: 12)
    ]

    var body: some View {
        OnboardingPageShell(
            progress: Double(store.currentStep.rawValue) / Double(OnboardingStep.allCases.count),
            continueTitle: "Continue",
            isCTAEnabled: !selected.isEmpty && !store.isTransitioning,
            isCTALoading: store.isTransitioning,
            canGoBack: store.currentStep.rawValue > 1,
            background: { Color.clear },
            content: {
                ScrollView {
                    VStack(spacing: 0) {
                        Text("Which sports do you follow most?")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding(.top, 16)
                            .padding(.bottom, 24)
                            .padding(.horizontal, 24)

                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(sports, id: \.self) { sport in
                                SportChip(
                                    label: sport,
                                    isSelected: selected.contains(sport)
                                ) {
                                    toggle(sport)
                                }
                            }
                        }
                        .padding(.horizontal, 24)

                        Text("You can change this later in Settings.")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.white.opacity(0.5))
                            .padding(.top, 24)
                        // No trailing Spacer here — the shell already pads
                        // the bottom safe-area + 16pt around the CTA. An
                        // extra Spacer would double the gap.
                    }
                }
                .sensoryFeedback(.selection, trigger: selected)
            },
            onContinue: {
                store.setFavoriteSports(Array(selected))
                store.advance()
            },
            onBack: { store.back() }
        )
    }

    private func toggle(_ sport: String) {
        if selected.contains(sport) {
            selected.remove(sport)
        } else {
            selected.insert(sport)
        }
    }
}

private struct SportChip: View {
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
                        .fill(isSelected
                              ? Color.appPrimary.opacity(0.25)
                              : Color.white.opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 50)
                        .strokeBorder(
                            isSelected ? Color.appPrimary : Color.white.opacity(0.2),
                            lineWidth: 1.5
                        )
                )
        }
        .buttonStyle(.plain)
    }
}
