// OnboardingPrimaryGoalView.swift
//
// Step 7: single-select primary goal cards. Port of `Step5_PrimaryGoal.tsx`.
// RN uses MaterialCommunityIcons; we substitute SF Symbols per 08-spec.
//
// Chrome (back chevron / progress bar / Liquid Glass CTA) lives in
// `OnboardingPageShell`. CTA stays disabled until a goal is picked.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingPrimaryGoalView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var selected: String?

    private struct Goal: Identifiable {
        let id: String   // also the value persisted
        let icon: String
    }

    private let goals: [Goal] = [
        .init(id: "Find profitable edges faster", icon: "bolt.fill"),
        .init(id: "Analyze data to improve strategy", icon: "chart.line.uptrend.xyaxis"),
        .init(id: "Track my performance over time", icon: "chart.bar.fill"),
        .init(id: "Get timely alerts for model picks", icon: "bell.badge.fill")
    ]

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
                    VStack(spacing: 16) {
                        Text("What's your main goal?")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                            .padding(.top, 16)
                            .padding(.horizontal, 24)
                            .padding(.bottom, 8)

                        ForEach(goals) { goal in
                            Button {
                                selected = goal.id
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: goal.icon)
                                        .font(.system(size: 22))
                                        .foregroundStyle(selected == goal.id ? Color.appPrimary : Color.white)
                                        .frame(width: 28)
                                    Text(goal.id)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(.white)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .padding(.vertical, 16)
                                .padding(.horizontal, 16)
                                .background(
                                    RoundedRectangle(cornerRadius: 16)
                                        .fill(selected == goal.id ? Color.appPrimary.opacity(0.22) : Color.white.opacity(0.06))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .strokeBorder(selected == goal.id ? Color.appPrimary : Color.white.opacity(0.15), lineWidth: 1.5)
                                )
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, 24)
                        }
                        // Shell owns bottom-edge spacing; no Spacer needed.
                    }
                }
                .sensoryFeedback(.selection, trigger: selected)
            },
            onContinue: {
                guard let g = selected else { return }
                store.setMainGoal(g)
                store.advance()
            },
            onBack: { store.back() }
        )
    }
}
