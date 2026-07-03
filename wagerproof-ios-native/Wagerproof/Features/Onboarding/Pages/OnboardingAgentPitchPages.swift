// OnboardingAgentPitchPages.swift
//
// Pages 8 + 9: the agent value pitch, rewritten for v2.
//   8 (agentValueIntro) — "Not another chatbot": a swipeable 3-slide
//     carousel of reasons we're different — the data comparison, the
//     win-rate distribution proof, and a live-style Outliers example.
//     (Inner swipe is safe: the OUTER pager has no gesture surface.)
//   9 (agentValueProof) — "An analyst who never sleeps": 24/7 research
//     across thousands of data points; the pixel character seeds visual
//     continuity with the generation cinematic two pages later.

import Charts
import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

// MARK: - Page 8: Not another chatbot (3-reason carousel)

struct OnboardingAgentPitchIntroPage: View {
    @Environment(OnboardingStore.self) private var store

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    /// Slide index lives on the store so the shared chrome's Continue can
    /// step through all three reasons before advancing the page.
    private var slideBinding: Binding<Int> {
        Binding(
            get: { store.agentPitchSlide },
            set: { store.setAgentPitchSlide($0) }
        )
    }

    var body: some View {
        OnboardingPageScaffold(
            title: "Not another chatbot",
            subtitle: "Three reasons this is nothing like asking ChatGPT for picks."
        ) {
            TabView(selection: slideBinding) {
                winRateSlide.tag(0)
                comparisonSlide.tag(1)
                outliersSlide.tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 452)
            .pageEntrance(index: 2)
            .sensoryFeedback(.selection, trigger: store.agentPitchSlide)

            // Custom dots — accent-tinted active, tappable.
            HStack(spacing: 8) {
                ForEach(0..<OnboardingStore.agentPitchSlideCount, id: \.self) { i in
                    Button {
                        withAnimation(.appCarousel) { store.setAgentPitchSlide(i) }
                    } label: {
                        Circle()
                            .fill(store.agentPitchSlide == i ? accent : Color.white.opacity(0.25))
                            .frame(width: store.agentPitchSlide == i ? 8 : 6,
                                   height: store.agentPitchSlide == i ? 8 : 6)
                    }
                    .buttonStyle(.plain)
                }
            }
            .animation(.appQuick, value: store.agentPitchSlide)
            .pageEntrance(index: 3)
        }
    }

    // MARK: Slide 1 — the data they don't have

    private var comparisonSlide: some View {
        VStack(spacing: 12) {
            slideHeading("The data they don't have")

            comparisonCard(
                heading: "Asking ChatGPT",
                headingColor: Color.white.opacity(0.55),
                rows: [
                    (false, "No live odds or line movement"),
                    (false, "No model probabilities"),
                    (false, "Confident-sounding guesswork")
                ],
                borderColor: Color.white.opacity(0.15)
            )

            comparisonCard(
                heading: "Your WagerProof agent",
                headingColor: accent,
                rows: [
                    (true, "Proprietary model predictions per game"),
                    (true, "Live odds, splits, weather, and market moves"),
                    (true, "Reasoning you can read on every pick")
                ],
                borderColor: accent
            )
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
    }

    // MARK: Slide 2 — the win-rate proof

    private var winRateSlide: some View {
        VStack(spacing: 12) {
            slideHeading("Picks that actually hit")

            WinRateBellCurves(accent: accent)
                .frame(height: 250)
                .padding(16)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 20, style: .continuous),
                    tint: Color.white.opacity(0.05)
                )

            Text("Most bettors' picks land around a 40% win rate. Our top agents peak far higher — see them on the leaderboard and tail their picks.")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .padding(.horizontal, 8)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
    }

    // MARK: Slide 3 — outliers example

    private var outliersSlide: some View {
        VStack(spacing: 12) {
            slideHeading("Edges served daily")

            // The REAL Outliers trend card fed with example data — the exact
            // component from the Outliers tab's Trends rail, display-only.
            OutliersTrendCard(card: Self.exampleTrendCard)
                .allowsHitTesting(false)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
    }

    private func slideHeading(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 17, weight: .heavy))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
    }

    /// Example trend card for the carousel — mirrors the Outliers tab's
    /// Trends rail card exactly ("Won 4 of last 5 …" splits + line chips).
    private static let exampleTrendCard = OutliersTrendsCard(
        id: "onboarding-trend-example",
        gameId: "onboarding-trend-example",
        matchupLabel: "BUF @ KC",
        subjectKind: .team,
        subjectName: "Kansas City Chiefs",
        subjectDetail: "Team trends",
        teamAbbr: "KC",
        playerId: nil,
        marketKey: "spread",
        betTypeLabel: "Spread",
        trendValue: 0.8,
        trendSampleN: 5,
        lineContext: nil,
        bettingLines: [
            .init(id: "onb-line-1", label: "Spread", lineText: "KC -2.5", oddsText: "-108", teamAbbr: "KC")
        ],
        rows: [
            .init(id: "onb-r1", text: "Won 4 of last 5 vs this opponent", coverageNote: nil, dominantPct: 0.80, sampleN: 5),
            .init(id: "onb-r2", text: "Covered 6 of last 8 as favorite", coverageNote: nil, dominantPct: 0.75, sampleN: 8),
            .init(id: "onb-r3", text: "Over hit in 5 of last 7 at home", coverageNote: nil, dominantPct: 0.71, sampleN: 7),
            .init(id: "onb-r4", text: "Won 7 of last 10 after a win", coverageNote: nil, dominantPct: 0.70, sampleN: 10),
            .init(id: "onb-r5", text: "Covered 4 of last 6 in division", coverageNote: nil, dominantPct: 0.67, sampleN: 6)
        ]
    )

    private func comparisonCard(
        heading: String,
        headingColor: Color,
        rows: [(Bool, String)],
        borderColor: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(heading)
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(headingColor)
                .textCase(.uppercase)
                .tracking(0.6)

            ForEach(rows, id: \.1) { good, text in
                HStack(spacing: 10) {
                    Image(systemName: good ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(good ? accent : Color.white.opacity(0.35))
                    Text(text)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.white.opacity(good ? 0.9 : 0.6))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 16, style: .continuous),
            tint: Color.white.opacity(0.05)
        )
        // The stroke stays here on purpose — it's the semantic contrast
        // between the dull ChatGPT card and the accent-ringed agent card.
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(borderColor, lineWidth: 1.2)
        )
    }
}

// MARK: - Win-rate distribution chart

/// Two peak-normalized bell curves: the market's pick distribution centered
/// near 40% vs our agents' centered near 65%. Marketing visualization (not
/// live data) — the numbers match the copy beneath it.
private struct WinRateBellCurves: View {
    let accent: Color

    private struct CurveSample: Identifiable {
        let id = UUID()
        let x: Double
        let y: Double
    }

    private static func gaussian(mean: Double, sigma: Double) -> [CurveSample] {
        stride(from: 15.0, through: 90.0, by: 1.5).map { x in
            let z = (x - mean) / sigma
            return CurveSample(x: x, y: exp(-0.5 * z * z))
        }
    }

    private static let bettors = gaussian(mean: 40, sigma: 9)
    private static let agents = gaussian(mean: 65, sigma: 6.5)

    var body: some View {
        Chart {
            ForEach(Self.bettors) { p in
                AreaMark(
                    x: .value("Win rate", p.x),
                    yStart: .value("Base", 0),
                    yEnd: .value("Density", p.y),
                    series: .value("Who", "Most bettors")
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(Color.white.opacity(0.10))
                LineMark(
                    x: .value("Win rate", p.x),
                    y: .value("Density", p.y),
                    series: .value("Who", "Most bettors")
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(Color.white.opacity(0.45))
                .lineStyle(StrokeStyle(lineWidth: 2))
            }

            ForEach(Self.agents) { p in
                AreaMark(
                    x: .value("Win rate", p.x),
                    yStart: .value("Base", 0),
                    yEnd: .value("Density", p.y),
                    series: .value("Who", "Our agents")
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(accent.opacity(0.18))
                LineMark(
                    x: .value("Win rate", p.x),
                    y: .value("Density", p.y),
                    series: .value("Who", "Our agents")
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(accent)
                .lineStyle(StrokeStyle(lineWidth: 2.5))
            }

            RuleMark(x: .value("Win rate", 40))
                .foregroundStyle(Color.white.opacity(0.25))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .annotation(
                    position: .top, alignment: .center, spacing: 4,
                    overflowResolution: .init(x: .fit(to: .chart), y: .fit(to: .chart))
                ) {
                    Text("Most bettors\n~40%")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.white.opacity(0.65))
                        .multilineTextAlignment(.center)
                }

            RuleMark(x: .value("Win rate", 65))
                .foregroundStyle(accent.opacity(0.5))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                .annotation(
                    position: .top, alignment: .center, spacing: 4,
                    overflowResolution: .init(x: .fit(to: .chart), y: .fit(to: .chart))
                ) {
                    Text("Our agents\n~65%")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(accent)
                        .multilineTextAlignment(.center)
                }
        }
        .chartYAxis(.hidden)
        .chartXScale(domain: 15...90)
        .chartYScale(domain: 0...1.35)   // headroom for the peak labels
        .chartLegend(.hidden)
        .chartXAxis {
            AxisMarks(values: [40, 65]) { value in
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int(v))%")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.white.opacity(0.5))
                    }
                }
            }
        }
    }
}

// MARK: - Page 9: An analyst who never sleeps

struct OnboardingAgentPitchProofPage: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.onboardingPageIsActive) private var isActive

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    var body: some View {
        OnboardingPageScaffold(
            title: "An analyst who never sleeps",
            subtitle: "Like having an intern grind hours of research — you just get the answer."
        ) {
            // The seated pixel character — the same rig the generation
            // cinematic uses, so the agent the user meets here is the one
            // they watch work two pages later. Compact height: this page
            // must fit title + avatar + three rows above the CTA without
            // scrolling on a 6.3" screen.
            WorkingDeskAvatar(spriteIndex: 0, accent: accent, charHeight: 92)
                .padding(.top, 2)
                .pageEntrance(index: 2)
                .opacity(isActive ? 1 : 0.4)

            VStack(spacing: 10) {
                OnboardingFeatureRow(
                    icon: "clock.arrow.2.circlepath",
                    title: "Works around the clock",
                    text: "Scans every game, line, and edge on schedule — no prompting needed.",
                    accent: accent
                )
                .pageEntrance(index: 3)

                OnboardingFeatureRow(
                    icon: "cpu",
                    title: "Thousands of data points per slate",
                    text: "Models, market prices, public money, matchup context — digested for you.",
                    accent: accent
                )
                .pageEntrance(index: 4)

                OnboardingFeatureRow(
                    icon: "text.magnifyingglass",
                    title: "Shows its work",
                    text: "Every pick ships with its reasoning — value at your fingertips.",
                    accent: accent
                )
                .pageEntrance(index: 5)
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
        }
    }
}
