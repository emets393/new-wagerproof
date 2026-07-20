// OnboardingResearchRevealPages.swift
//
// Pages 7 + 8: the staged time-value reveals driven by the bucket chosen on
// the research-time page.
//
//   7 (researchCost)    — the bad news: hours/month count-up, then the
//                         hours/year figure, reframed as full days. Warning
//                         haptic landings. CTA "Fix this".
//   8 (researchReclaim) — the good news: a conservative reclaimed-hours
//                         figure (floor+"+", weekly range beneath), a close
//                         branched on the user's primary goal, and the
//                         always-visible disclosure. Success landing. CTA
//                         "Show me how".
//
// Both pages gate the shared chrome's Continue on their sequence landing
// (store.setCostRevealSeen / setReclaimRevealSeen) — the numbers ARE the
// page. Under Reduce Motion everything renders at once and the CTA enables
// immediately. Estimates are ranges/floors with on-screen disclosures —
// never outcomes, never profit language (see ResearchTime.swift).

import SwiftUI
import WagerproofDesign
import WagerproofStores

// MARK: - Page 7: the cost of doing it by hand

struct OnboardingResearchCostPage: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var showMonthly = false
    @State private var showYearLead = false
    @State private var showYearNumber = false
    @State private var showClose = false
    @State private var sequenceStarted = false

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    private var estimates: ResearchTimeEstimates {
        ResearchTimeEstimates(rawBucket: store.survey.researchTimeBucket)
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 22) {
                if showMonthly {
                    VStack(spacing: 6) {
                        Text("In season, that's about")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.75))
                        ResearchRollingNumber(
                            target: estimates.hoursPerMonth,
                            suffix: " hours a month",
                            numberFont: .system(size: 34, weight: .heavy),
                            suffixFont: .system(size: 22, weight: .bold),
                            style: AnyShapeStyle(Color.white),
                            isActive: true,
                            landing: .warning
                        )
                        Text("spent researching bets")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.75))
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showYearLead {
                    Text("Over a year, you're on track to spend")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showYearNumber {
                    ResearchRollingNumber(
                        target: estimates.hoursPerYear,
                        suffix: " hours",
                        numberFont: .system(size: 58, weight: .black),
                        suffixFont: .system(size: 30, weight: .heavy),
                        style: AnyShapeStyle(
                            LinearGradient(
                                colors: [accent, accent.opacity(0.55)],
                                startPoint: .leading, endPoint: .trailing
                            )
                        ),
                        isActive: true,
                        landing: .warning
                    )
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                }

                if showClose {
                    VStack(spacing: 14) {
                        Text("That's **\(estimates.daysPerYearEquivalent) full days** of grinding through lines, trends, and stats.")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.85))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)

                        Text(ResearchTimeEstimates.costFootnote)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.white.opacity(0.45))
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, 8)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
            .padding(.horizontal, 28)

            Spacer(minLength: 0)
        }
        .onChange(of: isActive, initial: true) { _, active in
            guard active, !sequenceStarted else { return }
            sequenceStarted = true
            Task { await runSequence() }
        }
    }

    private func runSequence() async {
        if reduceMotion {
            var t = Transaction(); t.disablesAnimations = true
            withTransaction(t) {
                showMonthly = true; showYearLead = true
                showYearNumber = true; showClose = true
            }
            store.setCostRevealSeen()
            AccessibilityNotification.Announcement(
                "About \(estimates.hoursPerYear) hours a year spent researching — \(estimates.daysPerYearEquivalent) full days."
            ).post()
            return
        }

        withAnimation(.easeOut(duration: 0.5)) { showMonthly = true }
        // Monthly roll (~1.2s) + a beat to let it land.
        try? await Task.sleep(nanoseconds: 2_600_000_000)
        withAnimation(.easeOut(duration: 0.45)) { showYearLead = true }
        try? await Task.sleep(nanoseconds: 900_000_000)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { showYearNumber = true }
        // Year roll (~1.2s) + hold so the number sinks in.
        try? await Task.sleep(nanoseconds: 2_400_000_000)
        withAnimation(.easeOut(duration: 0.5)) { showClose = true }
        try? await Task.sleep(nanoseconds: 500_000_000)
        store.setCostRevealSeen()
    }
}

// MARK: - Page 8: the hours an agent hands back

struct OnboardingResearchReclaimPage: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var showLead = false
    @State private var showNumber = false
    @State private var showClose = false
    @State private var sequenceStarted = false

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    private var estimates: ResearchTimeEstimates {
        ResearchTimeEstimates(rawBucket: store.survey.researchTimeBucket)
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 22) {
                if showLead {
                    Text("The good news: your agent takes over the repetitive part.")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showNumber {
                    VStack(spacing: 10) {
                        ResearchRollingNumber(
                            target: estimates.reclaimYearLowDisplay,
                            suffix: "+ hours",
                            numberFont: .system(size: 58, weight: .black),
                            suffixFont: .system(size: 30, weight: .heavy),
                            style: AnyShapeStyle(
                                LinearGradient(
                                    colors: [accent, accent.opacity(0.55)],
                                    startPoint: .leading, endPoint: .trailing
                                )
                            ),
                            isActive: true,
                            landing: .success
                        )

                        Text("back every year. Roughly \(estimates.weeklyRangeText) each week of the season.")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.85))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                }

                if showClose {
                    Text(ResearchTimeEstimates.reclaimClose(forGoal: store.survey.mainGoal))
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(Color.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .padding(.horizontal, 8)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showNumber {
                    // Disclosure travels WITH the figure (never behind a tap):
                    // the estimate and its qualification are one unit.
                    Text(ResearchTimeEstimates.reclaimDisclosure)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Color.white.opacity(0.45))
                        .multilineTextAlignment(.center)
                        .lineSpacing(2)
                        .padding(.top, 6)
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 28)

            Spacer(minLength: 0)
        }
        .onChange(of: isActive, initial: true) { _, active in
            guard active, !sequenceStarted else { return }
            sequenceStarted = true
            Task { await runSequence() }
        }
    }

    private func runSequence() async {
        if reduceMotion {
            var t = Transaction(); t.disablesAnimations = true
            withTransaction(t) { showLead = true; showNumber = true; showClose = true }
            store.setReclaimRevealSeen()
            AccessibilityNotification.Announcement(
                "A WagerProof agent can hand back an estimated \(estimates.reclaimYearLowDisplay) plus hours a year — roughly \(estimates.weeklyRangeText) each week."
            ).post()
            return
        }

        withAnimation(.easeOut(duration: 0.5)) { showLead = true }
        try? await Task.sleep(nanoseconds: 1_600_000_000)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { showNumber = true }
        // Roll (~1.2s) + hold.
        try? await Task.sleep(nanoseconds: 2_400_000_000)
        withAnimation(.easeOut(duration: 0.5)) { showClose = true }
        try? await Task.sleep(nanoseconds: 500_000_000)
        store.setReclaimRevealSeen()
    }
}

// MARK: - Rolling number

/// Count-up figure with a static suffix. Rolls 0 → target with an
/// ease-out-cubic cadence over ~26 frames using the app-wide
/// `.numericText` content transition (digits roll like an odometer),
/// selection ticks per visible change, and a landing haptic. Reduce Motion
/// renders the final value immediately (the parent decides whether the
/// whole block is even staged).
private struct ResearchRollingNumber: View {
    enum Landing { case warning, success }

    let target: Int
    let suffix: String
    let numberFont: Font
    let suffixFont: Font
    let style: AnyShapeStyle
    /// Start trigger — the parent shows this view when its stage begins.
    let isActive: Bool
    let landing: Landing

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var value = 0
    @State private var landed = false
    @State private var started = false

    var body: some View {
        (
            Text("\(value)")
                .font(numberFont)
            + Text(suffix)
                .font(suffixFont)
        )
        .foregroundStyle(style)
        .monospacedDigit()
        .contentTransition(.numericText(value: Double(value)))
        .multilineTextAlignment(.center)
        .sensoryFeedback(.selection, trigger: value)
        .sensoryFeedback(landing == .warning ? .impact(weight: .heavy) : .success, trigger: landed)
        .accessibilityLabel("\(target)\(suffix)")
        .onChange(of: isActive, initial: true) { _, active in
            guard active, !started else { return }
            started = true
            Task { await roll() }
        }
    }

    private func roll() async {
        if reduceMotion {
            value = target
            return
        }
        let frames = 26
        for frame in 1...frames {
            let t = Double(frame) / Double(frames)
            let eased = 1 - pow(1 - t, 3)
            let next = Int((Double(target) * eased).rounded())
            if next != value {
                withAnimation(.snappy(duration: 0.12)) { value = next }
            }
            try? await Task.sleep(nanoseconds: 45_000_000)
        }
        withAnimation(.snappy(duration: 0.12)) { value = target }
        landed = true
    }
}
