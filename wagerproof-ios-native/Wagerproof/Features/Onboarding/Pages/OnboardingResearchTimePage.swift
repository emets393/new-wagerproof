// OnboardingResearchTimePage.swift
//
// Page 6: the self-reported daily sports-app-checking question that seeds the
// whole time-value arc (cost reveal → reclaim reveal → personalized pitch →
// paywall reprise). Seven daily buckets — checking scores/odds/lines is a
// daily habit (like screen time), so users think in hours-per-day, and
// "Honestly, no idea" avoids forcing fake precision (it resolves to a median
// basis).
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
            title: "How much time do you spend checking sports apps each day?",
            subtitle: "Scores, odds, lines, and feeds. Your best guess is fine."
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

// MARK: - Page 7: weekly bet amount (money-in-play)

/// Fires right after the time question. Same conversational pattern — buckets
/// + a branched reply — but for weekly bet amount. The answer seeds the
/// "money in play" figures woven into the cost/reclaim/summary/paywall. It
/// SIZES RISK (turnover), never projects returns; "Prefer not to say" resolves
/// to a median basis so downstream math always has a number.
struct OnboardingStakesPage: View {
    @Environment(OnboardingStore.self) private var store

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    private var selected: StakesBucket? {
        guard let raw = store.survey.weeklyStakesBucket else { return nil }
        return StakesBucket(rawValue: raw)
    }

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        OnboardingPageScaffold(
            title: "How much do you bet in a typical week?",
            subtitle: "Your best guess is fine. Just sizing it up."
        ) {
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Array(StakesBucket.allCases.enumerated()), id: \.element.id) { index, bucket in
                    OnboardingChip(
                        label: bucket.optionLabel,
                        isSelected: selected == bucket,
                        accent: accent
                    ) {
                        store.setWeeklyStakesBucket(bucket.rawValue)
                    }
                    .pageEntrance(index: 2 + index / 2)
                }
            }
            .padding(.horizontal, 24)
            .sensoryFeedback(.selection, trigger: store.survey.weeklyStakesBucket)

            if let selected {
                reply(for: selected)
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(.appStandard, value: store.survey.weeklyStakesBucket)
    }

    /// Echoed answer (dimmed) + branched acknowledgment (bright, accent ring).
    private func reply(for bucket: StakesBucket) -> some View {
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
        .id(bucket)
    }
}
