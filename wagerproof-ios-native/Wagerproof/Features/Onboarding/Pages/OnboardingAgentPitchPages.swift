// OnboardingAgentPitchPages.swift
//
// Pages 10 + 11: the agent value pitch.
//   10 (agentValueIntro) — "Not another chatbot": a swipeable 3-slide
//      carousel. Slide 1 is the marker-style value page (highlighter blobs,
//      stamped in) fed by the research-time arc's DYNAMIC numbers, slide 2
//      is the win-rate distribution comparison, slide 3 is a live-style
//      Outliers example. (Inner swipe is safe: the OUTER pager has no
//      gesture surface.)
//   11 (agentValueProof) — "An analyst who never sleeps": 24/7 research
//      across thousands of data points; the pixel character seeds visual
//      continuity with the generation cinematic two pages later.

import Charts
import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

// MARK: - Page 10: Not another chatbot (3-reason carousel)

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
            title: "Not another chatbot"
        ) {
            TabView(selection: slideBinding) {
                valueMarkerSlide.tag(0)
                winRateSlide.tag(1)
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

    // MARK: Slide 1 — marker-style value rows (dynamic numbers)

    /// The reference-styled highlighter benefits, fed by the research-time
    /// arc instead of canned stats: the user's own reclaim range and yearly
    /// figure are the loud bold runs, backed by two coverage facts we can
    /// always stand behind.
    private var valueMarkerSlide: some View {
        let est = ResearchTimeEstimates(rawBucket: store.survey.researchTimeBucket)
        return VStack(spacing: 0) {
            slideHeading("With WagerProof you can:")

            VStack(spacing: 24) {
                OnboardingMarkerRow(
                    icon: "clock.badge.checkmark",
                    lines: ["Get back **\(est.weeklyRangeText)**", "every week you bet"],
                    color: .orange
                )
                .stampEntrance(index: 0)

                OnboardingMarkerRow(
                    icon: "calendar.badge.clock",
                    lines: ["Hand off **\(est.reclaimYearLowDisplay)+ hours**", "of research a year"],
                    color: .green,
                    iconTrailing: true
                )
                .stampEntrance(index: 1)

                OnboardingMarkerRow(
                    icon: "cpu",
                    lines: ["Every slate screened", "**24/7**, five leagues"],
                    color: .red
                )
                .stampEntrance(index: 2)

                OnboardingMarkerRow(
                    icon: "chart.line.uptrend.xyaxis",
                    lines: ["Model vs Vegas", "on **every** line"],
                    color: .blue,
                    iconTrailing: true
                )
                .stampEntrance(index: 3)
            }
            .padding(.top, 22)

            Spacer(minLength: 8)

            Text("Time estimates from your answers. Results vary.")
                .font(.system(size: 11))
                .foregroundStyle(Color.white.opacity(0.4))
        }
        .padding(.horizontal, 24)
    }

    // MARK: Slide 2 — the win-rate comparison

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
                .overlay(alignment: .topTrailing) {
                    Text("ILLUSTRATIVE")
                        .font(.system(size: 8, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Color.white.opacity(0.45))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.white.opacity(0.10)))
                        .padding(8)
                }

            Text("Most bettors' picks land around a 40% win rate. Our top agents peak far higher. See them on the leaderboard and tail their picks.")
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
        VStack(spacing: 0) {
            slideHeading("Edges served daily")

            Spacer(minLength: 0)

            // The REAL Outliers trend card fed with example data — the exact
            // component from the Outliers tab's Trends rail, display-only.
            // `.expanded` so all six trends render as full rows (compact mode
            // caps at 3 and rolls the rest into footer chips). Wrapped in a
            // tinted Liquid Glass tray so the example lifts off the dark
            // pixelwave backdrop and reads as a highlighted showcase.
            OutliersTrendCard(card: Self.exampleTrendCard, displayMode: .expanded)
                .allowsHitTesting(false)
                .padding(10)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous),
                    tint: accent.opacity(0.14)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .strokeBorder(accent.opacity(0.35), lineWidth: 1)
                )

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
        // Six full trends: four perfect splits + two high-80s, so the whole
        // stack reads green (trendColor goes appWin above 75%).
        rows: [
            .init(id: "onb-r1", text: "Won 5 of last 5 vs this opponent", coverageNote: nil, dominantPct: 1.0, sampleN: 5),
            .init(id: "onb-r2", text: "Covered 6 of last 6 as favorite", coverageNote: nil, dominantPct: 1.0, sampleN: 6),
            .init(id: "onb-r3", text: "Won 4 of last 4 road games", coverageNote: nil, dominantPct: 1.0, sampleN: 4),
            .init(id: "onb-r4", text: "Covered 5 of last 5 in division", coverageNote: nil, dominantPct: 1.0, sampleN: 5),
            .init(id: "onb-r5", text: "Covered 7 of last 8 primetime games", coverageNote: nil, dominantPct: 0.88, sampleN: 8),
            .init(id: "onb-r6", text: "Over hit in 6 of last 7 at home", coverageNote: nil, dominantPct: 0.86, sampleN: 7)
        ]
    )
}

// MARK: - Win-rate distribution chart

/// Two peak-normalized bell curves: the market's pick distribution centered
/// near 40% vs our agents' centered near 65%. Marketing visualization (the
/// on-card ILLUSTRATIVE tag says so) — swap the gaussians for the platform
/// win-rate distribution RPCs when that lands.
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

// MARK: - Page 11: An analyst who never sleeps

struct OnboardingAgentPitchProofPage: View {
    @Environment(OnboardingStore.self) private var store
    @Environment(\.onboardingPageIsActive) private var isActive

    private var accent: Color {
        OnboardingTheme.accent(for: store.survey.bettorType)
    }

    var body: some View {
        OnboardingPageScaffold(
            title: "An analyst who never sleeps",
            subtitle: "It runs the research grind. You just read the answer."
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
                    title: "Works while you sleep",
                    text: "Re-checks every game, every line move, and every injury update. You never start from a blank page.",
                    accent: accent
                )
                .pageEntrance(index: 3)

                OnboardingFeatureRow(
                    icon: "cpu",
                    title: "Thousands of data points per slate",
                    text: "Model probabilities, market prices, public money, and matchup stats turned into actual picks.",
                    accent: accent
                )
                .pageEntrance(index: 4)

                OnboardingFeatureRow(
                    icon: "text.magnifyingglass",
                    title: "Shows its work",
                    text: "Every pick comes with the reasoning behind it. Tail it or fade it in seconds.",
                    accent: accent
                )
                .pageEntrance(index: 5)
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
        }
    }
}
