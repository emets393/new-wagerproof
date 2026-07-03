// OnboardingSportsPage.swift
//
// Page 2: multi-select sports chips (now with SF Symbol icons). Every tap
// ripples the pixel background at the chip and writes straight to the store
// so the shared chrome's CTA gates on ≥1 selection.
//
// Labels are the exact strings persisted to `profiles.onboarding_data`
// (`favoriteSports`) — do not localize/rename without a data migration.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingSportsPage: View {
    @Environment(OnboardingStore.self) private var store

    private struct SportOption {
        let label: String
        let icon: String
    }

    private let sports: [SportOption] = [
        .init(label: "NFL", icon: "football.fill"),
        .init(label: "College Football", icon: "football"),
        .init(label: "NBA", icon: "basketball.fill"),
        .init(label: "MLB", icon: "baseball.fill"),
        .init(label: "NCAAB", icon: "basketball"),
        .init(label: "Soccer", icon: "soccerball"),
        .init(label: "Other", icon: "sparkles")
    ]

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        OnboardingPageScaffold(
            title: "Which sports do you follow most?",
            subtitle: "You can change this later in Settings."
        ) {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(Array(sports.enumerated()), id: \.element.label) { index, sport in
                    OnboardingChip(
                        label: sport.label,
                        icon: sport.icon,
                        isSelected: store.survey.favoriteSports.contains(sport.label)
                    ) {
                        store.toggleFavoriteSport(sport.label)
                    }
                    .pageEntrance(index: 2 + index)
                }
            }
            .padding(.horizontal, 24)
            .sensoryFeedback(.selection, trigger: store.survey.favoriteSports)
        }
    }
}
