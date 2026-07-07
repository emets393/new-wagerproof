// OnboardingPersonalizedValuePage.swift
//
// Page 5: personalized value pitch, branched on the bettor type chosen one
// page earlier (mounts on slide-in, reading the store's answer directly).
//
//   Casual        → animated time-saved comparison chart (~4 hrs/week of
//                   research vs minutes with agents). Bars grow in when the
//                   page becomes ACTIVE, not on mount.
//   Serious / Pro → "With WagerProof You Can:" — reference-styled marker
//                   benefits with outcome stats (value, hit rate, hours saved,
//                   units tailed) on per-line highlighter blobs, one color
//                   each, matched icons alternating sides, stamped in. (Agent
//                   tuning is pitched later, on the agent-pitch/builder pages.)

import Charts
import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingPersonalizedValuePage: View {
    @Environment(OnboardingStore.self) private var store

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    var body: some View {
        switch store.survey.bettorType {
        case .none, .casual:
            CasualTimeSavedView(accent: accent)
        case .serious, .professional:
            SharpFeaturesView()
        }
    }
}

// MARK: - Casual: time-saved chart

private struct CasualTimeSavedView: View {
    let accent: Color

    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Bars grow from 0 → target when the page lands; values are weekly hours.
    @State private var typicalHours: Double = 0
    @State private var wagerproofHours: Double = 0
    @State private var barsLanded = false

    var body: some View {
        OnboardingPageScaffold(
            title: "Get your weekends back",
            subtitle: "Bettors put hours into research every week. Your agents compress it to minutes."
        ) {
            Chart {
                BarMark(
                    x: .value("Approach", "Doing it yourself"),
                    y: .value("Hours", typicalHours),
                    width: .ratio(0.55)
                )
                .cornerRadius(10)
                .foregroundStyle(Color.white.opacity(0.22))
                .annotation(position: .top, spacing: 8) {
                    Text("~4 hrs/week")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.8))
                        .opacity(barsLanded ? 1 : 0)
                }

                BarMark(
                    x: .value("Approach", "With WagerProof"),
                    y: .value("Hours", wagerproofHours),
                    width: .ratio(0.55)
                )
                .cornerRadius(10)
                .foregroundStyle(
                    LinearGradient(colors: [accent, accent.opacity(0.55)],
                                   startPoint: .top, endPoint: .bottom)
                )
                .annotation(position: .top, spacing: 8) {
                    Text("~15 min")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(accent)
                        .opacity(barsLanded ? 1 : 0)
                }
            }
            .chartYAxis(.hidden)
            .chartYScale(domain: 0...4.6)
            .chartXAxis {
                AxisMarks { _ in
                    AxisValueLabel()
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.white.opacity(0.75))
                }
            }
            .frame(height: 240)
            .padding(20)
            .liquidGlassBackground(
                in: RoundedRectangle(cornerRadius: 20, style: .continuous),
                tint: Color.white.opacity(0.05)
            )
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .pageEntrance(index: 2)
            .sensoryFeedback(.impact(weight: .light), trigger: barsLanded)

            OnboardingFeatureRow(
                icon: "clock.badge.checkmark",
                title: "Answers, not homework",
                text: "Your agent reads the models, odds, and splits overnight — you just review its picks.",
                accent: accent
            )
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .pageEntrance(index: 3)
        }
        .onChange(of: isActive, initial: true) { _, active in
            guard active, !barsLanded else { return }
            guard !reduceMotion else {
                typicalHours = 4; wagerproofHours = 0.25; barsLanded = true
                return
            }
            withAnimation(.spring(response: 0.9, dampingFraction: 0.85).delay(0.25)) {
                typicalHours = 4
            }
            withAnimation(.spring(response: 0.9, dampingFraction: 0.85).delay(0.55)) {
                wagerproofHours = 0.25
            }
            // Annotations + haptic land after both bars settle.
            Task {
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                withAnimation(.easeInOut(duration: 0.3)) { barsLanded = true }
            }
        }
    }
}

// MARK: - Serious / Professional: depth pitch

private struct SharpFeaturesView: View {
    var body: some View {
        OnboardingPageScaffold(
            title: "With WagerProof\nYou Can:"
        ) {
            // Reference-styled marker benefits: outcome stats on per-line
            // highlighter blobs, one color each, icons matched to the copy and
            // alternating sides, each stamped in. Agent tuning intentionally
            // lives later (agent-pitch + builder pages).
            VStack(spacing: 32) {
                OnboardingMarkerRow(
                    icon: "dollarsign.circle.fill",
                    lines: ["Catch **2×** more value", "bets every slate"],
                    color: .orange
                )
                .stampEntrance(index: 0)

                OnboardingMarkerRow(
                    icon: "target",
                    lines: ["Boost your hit rate", "by up to **30%**"],
                    color: .green,
                    iconTrailing: true
                )
                .stampEntrance(index: 1)

                OnboardingMarkerRow(
                    icon: "clock.badge.checkmark",
                    lines: ["Save **2+** hours a week", "on research"],
                    color: .red
                )
                .stampEntrance(index: 2)

                OnboardingMarkerRow(
                    icon: "trophy.fill",
                    lines: ["Tail sharp bettors up", "**+40** units this season"],
                    color: .blue,
                    iconTrailing: true
                )
                .stampEntrance(index: 3)
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
        }
    }
}
