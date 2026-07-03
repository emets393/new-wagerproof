// OnboardingPrimaryGoalPage.swift
//
// Page 7: single-select primary goal. Goal ids are the persisted strings.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingPrimaryGoalPage: View {
    @Environment(OnboardingStore.self) private var store

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

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    var body: some View {
        OnboardingPageScaffold(title: "What's your main goal?") {
            VStack(spacing: 12) {
                ForEach(Array(goals.enumerated()), id: \.element.id) { index, goal in
                    OnboardingOptionCard(
                        title: goal.id,
                        icon: goal.icon,
                        isSelected: store.survey.mainGoal == goal.id,
                        accent: accent,
                        // Equalize 1-line and 2-line titles — every card in
                        // the stack renders the same height.
                        minHeight: 84
                    ) {
                        store.setMainGoal(goal.id)
                    }
                    .pageEntrance(index: 2 + index)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .sensoryFeedback(.selection, trigger: store.survey.mainGoal)
        }
    }
}
