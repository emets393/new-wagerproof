// OnboardingBettorTypePage.swift
//
// Page 4: bettor type. Selection is the flow's first THEME moment — each
// card carries its own accent (casual green / serious blue / professional
// purple), and picking one retunes the whole surface live: the pixel
// background's glyph tint, the CTA pill, and the next page's content all
// follow `OnboardingTheme.accent(for:)` before the user ever hits Continue.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingBettorTypePage: View {
    @Environment(OnboardingStore.self) private var store

    private struct Option {
        let id: OnboardingStore.BettorType
        let title: String
        let detail: String
        let icon: String
    }

    private let options: [Option] = [
        .init(id: .casual, title: "Casual",
              detail: "I bet for fun and want quick, trustworthy reads",
              icon: "face.smiling"),
        .init(id: .serious, title: "Serious",
              detail: "I research lines and trends before I play",
              icon: "chart.line.uptrend.xyaxis"),
        .init(id: .professional, title: "Professional",
              detail: "I track units, ROI, and closing-line value",
              icon: "target")
    ]

    var body: some View {
        OnboardingPageScaffold(
            title: "What kind of bettor are you?",
            subtitle: "We tune your experience around this."
        ) {
            VStack(spacing: 12) {
                ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                    OnboardingOptionCard(
                        title: option.title,
                        detail: option.detail,
                        icon: option.icon,
                        isSelected: store.survey.bettorType == option.id,
                        accent: OnboardingTheme.accent(for: option.id)
                    ) {
                        store.setBettorType(option.id)
                    }
                    .pageEntrance(index: 2 + index)
                }
            }
            .padding(.horizontal, 24)
            .sensoryFeedback(.selection, trigger: store.survey.bettorType)
        }
    }
}
