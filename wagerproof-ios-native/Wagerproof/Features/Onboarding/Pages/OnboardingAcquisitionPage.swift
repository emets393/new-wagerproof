// OnboardingAcquisitionPage.swift
//
// Page 6: single-select "Where did you hear about us?" chips. Values are
// the exact strings persisted to `profiles.onboarding_data`.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingAcquisitionPage: View {
    @Environment(OnboardingStore.self) private var store

    private let sources = [
        "TikTok", "X/Twitter", "YouTube", "Google", "Friend/Referral", "Other"
    ]

    private let columns = [GridItem(.adaptive(minimum: 140), spacing: 12)]

    var body: some View {
        OnboardingPageScaffold(title: "Where did you hear about us?") {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(Array(sources.enumerated()), id: \.element) { index, source in
                    OnboardingChip(
                        label: source,
                        isSelected: store.survey.acquisitionSource == source
                    ) {
                        store.setAcquisitionSource(source)
                    }
                    .pageEntrance(index: 2 + index)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .sensoryFeedback(.selection, trigger: store.survey.acquisitionSource)
        }
    }
}
