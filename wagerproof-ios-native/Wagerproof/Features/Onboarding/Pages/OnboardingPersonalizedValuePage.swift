// OnboardingPersonalizedValuePage.swift
//
// Page 5: personalized value pitch, branched on the bettor type chosen one
// page earlier (mounts on slide-in, reading the store's answer directly).
//
//   Casual        → animated time-saved comparison chart (~4 hrs/week of
//                   research vs minutes with agents). Bars grow in when the
//                   page becomes ACTIVE, not on mount.
//   Serious / Pro → drill-downs, market-trend coverage, and
//                   strategy-tunable agents that show their work.

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
            SharpFeaturesView(accent: accent, isProfessional: store.survey.bettorType == .professional)
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
    let accent: Color
    let isProfessional: Bool

    private let marketChips = [
        "1H spread", "Team totals", "SP strikeouts", "F5 ML",
        "ATS form", "Public splits", "Line moves", "Park factors"
    ]

    var body: some View {
        OnboardingPageScaffold(
            title: isProfessional ? "Built for sharp process" : "Built for how you bet",
            subtitle: "Depth where it matters — markets, trends, and agents that show their work."
        ) {
            VStack(spacing: 12) {
                OnboardingFeatureRow(
                    icon: "square.stack.3d.up.fill",
                    title: "Game & prop drill-downs",
                    text: "Model probabilities vs the market for every game, with matchup data and weather baked in.",
                    accent: accent
                )
                .pageEntrance(index: 2)

                OnboardingFeatureRow(
                    icon: "chart.xyaxis.line",
                    title: "Trends across dozens of markets",
                    text: "Hit rates and movement across the markets you actually play:",
                    accent: accent
                )
                .pageEntrance(index: 3)

                // Market example chips — wrap grid under the trends row.
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
                    ForEach(marketChips, id: \.self) { chip in
                        Text(chip)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.85))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .frame(maxWidth: .infinity)
                            .background(
                                Capsule().fill(accent.opacity(0.14))
                            )
                            .overlay(
                                Capsule().strokeBorder(accent.opacity(0.4), lineWidth: 1)
                            )
                    }
                }
                .pageEntrance(index: 4)

                OnboardingFeatureRow(
                    icon: "slider.horizontal.3",
                    title: "Agents tuned to your strategy",
                    text: "Dial in fade-the-public, chalk, plus-money — your agent researches with your rules and shows the reasoning behind every pick.",
                    accent: accent
                )
                .pageEntrance(index: 5)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
    }
}
