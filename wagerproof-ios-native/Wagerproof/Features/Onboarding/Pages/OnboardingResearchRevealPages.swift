// OnboardingResearchRevealPages.swift
//
// Pages 7 + 8: the staged time-value reveals driven by the bucket chosen on
// the daily-checking page. Framed as "years of your life" (see
// ResearchTime.swift) — the Orbital Focus screen-time beat.
//
//   7 (researchCost)    — the bad news: days-this-year count-up, then the
//                         years-of-your-life figure. Warning haptic landings.
//                         CTA "Fix this".
//   8 (researchReclaim) — the good news: a conservative reclaimed-years
//                         figure (floor+"+", weekly-hours anchor beneath), a
//                         close branched on the user's primary goal, and the
//                         always-visible disclosure. Success landing. CTA
//                         "Show me how".
//
// Both pages gate the shared chrome's Continue on their sequence landing
// (store.setCostRevealSeen / setReclaimRevealSeen) — the numbers ARE the
// page. Under Reduce Motion everything renders at once and the CTA enables
// immediately. Estimates are floors with on-screen disclosures — never
// outcomes, never profit language (see ResearchTime.swift).

import SwiftUI
import WagerproofDesign
import WagerproofStores

// MARK: - Page 7: the cost of doing it by hand

struct OnboardingResearchCostPage: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var showDays = false
    @State private var showMeaning = false
    @State private var showYears = false
    @State private var showClose = false
    @State private var sequenceStarted = false

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    private var estimates: ResearchTimeEstimates {
        ResearchTimeEstimates(rawBucket: store.survey.researchTimeBucket)
    }

    private var stakes: StakesEstimates {
        StakesEstimates(rawBucket: store.survey.weeklyStakesBucket)
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 22) {
                if showDays {
                    VStack(spacing: 8) {
                        Text("This year, you'll spend")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.75))
                            .multilineTextAlignment(.center)
                        ResearchRollingNumber(
                            target: estimates.daysThisYear,
                            suffix: " days",
                            numberFont: .system(size: 44, weight: .heavy),
                            suffixFont: .system(size: 26, weight: .bold),
                            style: AnyShapeStyle(Color.white),
                            isActive: true,
                            landing: .warning
                        )
                        ResearchRollingNumber(
                            prefix: "and risk $",
                            target: stakes.yearlyAction,
                            suffix: "",
                            groupsDigits: true,
                            numberFont: .system(size: 27, weight: .heavy),
                            suffixFont: .system(size: 27, weight: .heavy),
                            style: AnyShapeStyle(Color.white),
                            isActive: true,
                            landing: .warning,
                            firesHaptics: false   // the days figure carries the beat's haptic
                        )
                        Text("checking scores, odds, and apps")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.7))
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showMeaning {
                    Text("Across your life, you'll spend")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showYears {
                    VStack(spacing: 6) {
                        ResearchRollingNumber(
                            target: estimates.yearsOfLife,
                            suffix: " \(ResearchTimeEstimates.yearsWord(estimates.yearsOfLife))",
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
                        ResearchRollingNumber(
                            prefix: "and risk $",
                            target: stakes.lifetimeAction,
                            suffix: "",
                            groupsDigits: true,
                            numberFont: .system(size: 30, weight: .heavy),
                            suffixFont: .system(size: 30, weight: .heavy),
                            style: AnyShapeStyle(
                                LinearGradient(
                                    colors: [accent, accent.opacity(0.55)],
                                    startPoint: .leading, endPoint: .trailing
                                )
                            ),
                            isActive: true,
                            landing: .warning,
                            firesHaptics: false   // the years figure carries the beat's haptic
                        )
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                }

                if showClose {
                    VStack(spacing: 14) {
                        Text("on the board. **Yep — you read that right.**")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.85))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)

                        Text("Total wagered — money in play, not winnings or losses. Time at about 16 waking hours a day.")
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
                showDays = true; showMeaning = true
                showYears = true; showClose = true
            }
            store.setCostRevealSeen()
            AccessibilityNotification.Announcement(
                "This year, about \(estimates.daysThisYear) days and \(stakes.yearlyActionDisplay) on sports betting. Across your life, \(estimates.yearsOfLife) \(ResearchTimeEstimates.yearsWord(estimates.yearsOfLife)) and \(stakes.lifetimeActionDisplay)."
            ).post()
            return
        }

        withAnimation(.easeOut(duration: 0.5)) { showDays = true }
        // Days roll (~1.2s) + a beat to let it land.
        try? await Task.sleep(nanoseconds: 2_600_000_000)
        withAnimation(.easeOut(duration: 0.45)) { showMeaning = true }
        try? await Task.sleep(nanoseconds: 900_000_000)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { showYears = true }
        // Years roll (~1.2s) + hold so the number sinks in.
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

    private var stakes: StakesEstimates {
        StakesEstimates(rawBucket: store.survey.weeklyStakesBucket)
    }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 22) {
                if showLead {
                    Text("The good news: WagerProof researches for you.")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showNumber {
                    VStack(spacing: 10) {
                        ResearchRollingNumber(
                            target: estimates.reclaimYears,
                            suffix: "+ \(ResearchTimeEstimates.yearsWord(estimates.reclaimYears))",
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

                        Text("of your life back — about \(estimates.reclaimHoursPerWeek) hours a week you'll never scan again.")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.85))
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                }

                if showClose {
                    Text("Protect your **\(stakes.yearlyActionDisplay)** and spend more time enjoying the games.")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                        .padding(.horizontal, 8)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                if showNumber {
                    // Disclosure travels WITH the figure (never behind a tap):
                    // the estimate and its qualification are one unit. Covers
                    // both the time projection and the money (turnover only).
                    Text("Estimates from your answers. Time projected across a betting lifetime at about 16 waking hours a day; dollars are money wagered, not winnings or losses. WagerProof does not promise profits or outcomes.")
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
                "WagerProof can hand back an estimated \(estimates.reclaimYears) plus \(ResearchTimeEstimates.yearsWord(estimates.reclaimYears)) of your life — about \(estimates.reclaimHoursPerWeek) hours a week — so you can protect the \(stakes.yearlyActionDisplay) you bet and enjoy the games."
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

    /// Optional static leading text at `numberFont` (e.g. "and risk $"). The
    /// number rolls; the prefix stays put.
    var prefix: String = ""
    let target: Int
    let suffix: String
    /// Group the rolling value with the locale's thousands separators
    /// ("13,000") — for currency figures.
    var groupsDigits: Bool = false
    let numberFont: Font
    let suffixFont: Font
    let style: AnyShapeStyle
    /// Start trigger — the parent shows this view when its stage begins.
    let isActive: Bool
    let landing: Landing
    /// A companion roller (e.g. the money beside the time figure) can roll
    /// SILENTLY so the beat still lands on one haptic, not two overlapping.
    var firesHaptics: Bool = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var value = 0
    @State private var landed = false
    @State private var started = false

    private var valueText: String { groupsDigits ? value.formatted() : "\(value)" }
    private var targetText: String { groupsDigits ? target.formatted() : "\(target)" }

    var body: some View {
        (
            Text(prefix)
                .font(numberFont)
            + Text(valueText)
                .font(numberFont)
            + Text(suffix)
                .font(suffixFont)
        )
        .foregroundStyle(style)
        .monospacedDigit()
        .contentTransition(.numericText(value: Double(value)))
        .multilineTextAlignment(.center)
        .sensoryFeedback(.selection, trigger: firesHaptics ? value : -1)
        .sensoryFeedback(landing == .warning ? .impact(weight: .heavy) : .success, trigger: firesHaptics ? landed : false)
        .accessibilityLabel("\(prefix)\(targetText)\(suffix)")
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
