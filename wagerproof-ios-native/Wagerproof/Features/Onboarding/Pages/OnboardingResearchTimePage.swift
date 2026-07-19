// OnboardingResearchTimePage.swift
//
// Page 6: the self-reported research-time question that seeds the whole
// time-value arc (cost reveal → reclaim reveal → personalized pitch →
// paywall reprise). Six weekly buckets — betting research is slate-shaped,
// so users think in hours-per-week, and "Honestly, no idea" avoids forcing
// fake precision (it resolves to a median basis).
//
// After a tap the page acknowledges the answer conversationally: the echoed
// answer sits dimmed with the branched reply beneath it, so the reveal two
// pages later reads as a response to THEIR number, not a canned stat.

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingResearchTimePage: View {
    @Environment(OnboardingStore.self) private var store

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    private var selected: ResearchTimeBucket? {
        guard let raw = store.survey.researchTimeBucket else { return nil }
        return ResearchTimeBucket(rawValue: raw)
    }

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        OnboardingPageScaffold(
            title: "How much time do you spend researching each week?",
            subtitle: "Games, lines, and trends. Your best guess is fine."
        ) {
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Array(ResearchTimeBucket.allCases.enumerated()), id: \.element.id) { index, bucket in
                    OnboardingChip(
                        label: bucket.optionLabel,
                        isSelected: selected == bucket,
                        accent: accent
                    ) {
                        store.setResearchTimeBucket(bucket.rawValue)
                    }
                    .pageEntrance(index: 2 + index / 2)
                }
            }
            .padding(.horizontal, 24)
            .sensoryFeedback(.selection, trigger: store.survey.researchTimeBucket)

            if let selected {
                reply(for: selected)
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(.appStandard, value: store.survey.researchTimeBucket)
    }

    /// Echoed answer (dimmed) + branched acknowledgment (bright, accent ring)
    /// — a two-line transcript, newest brightest.
    private func reply(for bucket: ResearchTimeBucket) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(bucket.echoLine)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color.white.opacity(0.5))
                .padding(.horizontal, 4)

            Text(bucket.replyLine)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous),
                    tint: accent.opacity(0.18)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(accent.opacity(0.8), lineWidth: 1.2)
                )
        }
        // Replies swap in place when the user changes their answer — id makes
        // the transition fire per bucket instead of diffing text.
        .id(bucket)
    }
}
