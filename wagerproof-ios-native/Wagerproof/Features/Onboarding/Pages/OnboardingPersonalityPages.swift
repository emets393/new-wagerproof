// OnboardingPersonalityPages.swift
//
// Pages 13–17: the per-section agent personality walk. EVERY user goes
// through these — a preset pre-fills the dials, custom starts balanced —
// because each page explains how its section shapes the agent's behavior,
// and adjusting the dials is what makes the generation cinematic feel like
// watching YOUR analyst boot up, not a template.
//
// Styled like the app's Settings page: flat rows, hairline dividers, no
// glass card containers. Each page is a one-line explainer that replaces the
// old subtitle, then straight into the knobs. The knobs themselves are the
// SAME shared inputs the standalone wizard uses (SliderInput / ToggleInput /
// OddsInput bound to the shared AgentCreationStore draft), so everything set
// here is exactly what `create_agent` receives — only the framing is flatter.

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

// MARK: - Shared framing (settings-page aesthetic)

/// One-line explainer at the top of each section page — a small accent glyph +
/// terse sentence, NO container. Replaces the page subtitle and leads straight
/// into the knobs.
private struct PersonalityExplainer: View {
    let icon: String
    let text: String
    var accent: Color = .appPrimary

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(accent)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.6))
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Flat knob list in the settings-page style: each control is a plain row with
/// a hairline divider between — no card, no glass, no box. Rows are type-erased
/// so a page can assemble a mixed/conditional set inline.
private struct KnobList: View {
    let rows: [AnyView]

    init(_ rows: [AnyView]) { self.rows = rows }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(rows.indices, id: \.self) { i in
                rows[i]
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 14)
                if i < rows.count - 1 { KnobDivider() }
            }
        }
    }
}

/// Hairline row separator tuned for the dark pixelwave backdrop.
private struct KnobDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.white.opacity(0.08))
            .frame(height: 0.5)
    }
}

/// Muted, airy section header (settings-page style).
private struct KnobSectionHeader: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.system(size: 13, weight: .semibold))
            .tracking(0.4)
            .foregroundStyle(Color.white.opacity(0.4))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 18)
    }
}

/// "Pre-tuned by <preset>" note shown when the user picked an archetype.
private struct PresetNote: View {
    let archetype: AgentArchetype?

    var body: some View {
        if let archetype {
            HStack(spacing: 6) {
                Image(systemName: "wand.and.stars")
                    .font(.system(size: 11, weight: .bold))
                Text("Pre-tuned by \(archetype.displayName)")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(Color.appPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Page 13: Mindset (core temperament)

struct OnboardingBuilderMindsetPage: View {
    @Bindable var creation: AgentCreationStore

    private let riskLabels = ["Very Safe", "Conservative", "Balanced", "Aggressive", "High Risk"]
    private let underdogLabels = ["Chalk Only", "Prefer Favs", "Balanced", "Prefer Dogs", "Dogs Only"]
    private let overUnderLabels = ["Unders Only", "Prefer Under", "Balanced", "Prefer Over", "Overs Only"]
    private let confidenceLabels = ["Any Edge", "Low Bar", "Moderate", "High Bar", "Very Picky"]

    var body: some View {
        OnboardingPageScaffold(title: "Set its instincts") {
            VStack(alignment: .leading, spacing: 0) {
                PersonalityExplainer(
                    icon: "brain.head.profile",
                    text: "Its temperament — a high-risk dog hunter reads a whole different board than a chalk grinder."
                )
                .pageEntrance(index: 2)

                PresetNote(archetype: creation.draft.archetype)
                    .padding(.top, 10)
                    .pageEntrance(index: 3)

                KnobList([
                    AnyView(SliderInput(value: $creation.draft.personalityParams.riskTolerance,
                                        label: "Risk Tolerance", labels: riskLabels)),
                    AnyView(SliderInput(value: $creation.draft.personalityParams.underdogLean,
                                        label: "Underdog Lean", labels: underdogLabels)),
                    AnyView(SliderInput(value: $creation.draft.personalityParams.overUnderLean,
                                        label: "Over/Under Lean", labels: overUnderLabels)),
                    AnyView(SliderInput(value: $creation.draft.personalityParams.confidenceThreshold,
                                        label: "Confidence Threshold", labels: confidenceLabels)),
                ])
                .padding(.top, 8)
                .pageEntrance(index: 4)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
    }
}

// MARK: - Page 14: Bet style (playbook)

struct OnboardingBuilderBetStylePage: View {
    @Bindable var creation: AgentCreationStore

    private let maxPicksLabels = ["1 Pick", "2 Picks", "3 Picks", "4 Picks", "5 Picks"]
    private let parlayLabels = ["Straights Only", "Rarely", "Sometimes", "Often", "Loves Parlays"]

    private let betTypes: [(value: String, label: String)] = [
        ("any", "Any"),
        ("spread", "Spread"),
        ("moneyline", "ML"),
        ("total", "Total"),
        ("prop", "Props"),
    ]

    // Flat market allowlist (mirrors agents-v3 ALL_MARKETS). 'prop' is NFL-only.
    private let marketOptions: [(value: String, label: String)] = [
        ("spread", "Spread"), ("moneyline", "Moneyline"), ("total", "Total"),
        ("team_total", "Team Total"), ("prop", "Player Props"),
    ]
    private let propsEmphasisOptions: [(value: String, label: String)] = [
        ("off", "Off"), ("allow", "Allow"), ("emphasize", "Emphasize"),
    ]
    private var hasNFL: Bool { creation.draft.preferredSports.contains(.nfl) }
    private var effectiveMarkets: Set<String> {
        if let m = creation.draft.personalityParams.allowedMarkets, !m.isEmpty { return Set(m) }
        return Set(marketOptions.map { $0.value }.filter { $0 != "prop" || hasNFL })
    }
    private func toggleMarket(_ key: String) {
        var set = effectiveMarkets
        if set.contains(key) {
            if set.count > 1 { set.remove(key) }
        } else {
            set.insert(key)
        }
        creation.draft.personalityParams.allowedMarkets = marketOptions.map { $0.value }.filter { set.contains($0) }
    }
    private var propsEmphasisBind: Binding<String> {
        Binding(get: { creation.draft.personalityParams.propsEmphasis ?? "allow" },
                set: { creation.draft.personalityParams.propsEmphasis = $0 })
    }

    var body: some View {
        OnboardingPageScaffold(title: "Choose its playbook") {
            VStack(alignment: .leading, spacing: 0) {
                PersonalityExplainer(
                    icon: "list.clipboard",
                    text: "What lands on your rail — the markets it plays, how often it fires, straights or parlays."
                )
                .pageEntrance(index: 2)

                KnobList(betStyleRows)
                    .padding(.top, 8)
                    .pageEntrance(index: 3)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
    }

    private var betStyleRows: [AnyView] {
        [
            AnyView(
                VStack(alignment: .leading, spacing: 10) {
                    rowTitle("Preferred Bet Type")
                    Picker("Bet Type", selection: $creation.draft.personalityParams.preferredBetType) {
                        ForEach(betTypes, id: \.value) { entry in
                            Text(entry.label).tag(entry.value)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            ),
            AnyView(SliderInput(value: $creation.draft.personalityParams.maxPicksPerDay,
                                label: "Max Picks Per Day", labels: maxPicksLabels)),
            AnyView(ToggleInput(value: $creation.draft.personalityParams.skipWeakSlates,
                                label: "Skip Weak Slates")),
            AnyView(ToggleInput(value: $creation.draft.personalityParams.chaseValue,
                                label: "Chase Value", description: "Take positive-EV prices")),
            AnyView(SliderInput(value: $creation.draft.personalityParams.parlayAppetite,
                                label: "Parlay Appetite", labels: parlayLabels)),
            AnyView(ToggleInput(value: $creation.draft.personalityParams.parlaysOnly,
                                label: "Parlays Only")),
            AnyView(marketsRow),
        ]
    }

    private var marketsRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            rowTitle("Markets")
            ForEach(marketOptions.filter { $0.value != "prop" || hasNFL }, id: \.value) { market in
                Button {
                    toggleMarket(market.value)
                } label: {
                    HStack {
                        Text(market.label)
                            .font(.system(size: 15))
                            .foregroundStyle(.white)
                        Spacer()
                        Image(systemName: effectiveMarkets.contains(market.value) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(effectiveMarkets.contains(market.value) ? Color(hex: 0x00E676) : Color.white.opacity(0.35))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 5)
            }
            if hasNFL && effectiveMarkets.contains("prop") {
                Text("Player Props Emphasis")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.top, 4)
                Picker("Props Emphasis", selection: propsEmphasisBind) {
                    ForEach(propsEmphasisOptions, id: \.value) { entry in
                        Text(entry.label).tag(entry.value)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
    }

    private func rowTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(.white)
    }
}

// MARK: - Page 15: Data trust (signals + price limits)

struct OnboardingBuilderDataTrustPage: View {
    @Bindable var creation: AgentCreationStore

    private let trustLabels = ["Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust"]

    var body: some View {
        OnboardingPageScaffold(title: "Pick its data diet") {
            VStack(alignment: .leading, spacing: 0) {
                PersonalityExplainer(
                    icon: "cylinder.split.1x2",
                    text: "Whose voice wins when our model, Polymarket, and the Vegas price disagree."
                )
                .pageEntrance(index: 2)

                KnobList([
                    AnyView(SliderInput(value: $creation.draft.personalityParams.trustModel,
                                        label: "Trust WagerProof Model", labels: trustLabels)),
                    AnyView(SliderInput(value: $creation.draft.personalityParams.trustPolymarket,
                                        label: "Trust Polymarket", labels: trustLabels)),
                    AnyView(ToggleInput(value: $creation.draft.personalityParams.polymarketDivergenceFlag,
                                        label: "Polymarket Divergence Flag",
                                        description: "Flag hard Vegas/Polymarket splits")),
                ])
                .padding(.top, 8)
                .pageEntrance(index: 3)

                KnobSectionHeader(title: "Price limits")
                    .pageEntrance(index: 4)

                KnobList([
                    AnyView(OddsInput(value: $creation.draft.personalityParams.maxFavoriteOdds,
                                      label: "Max Favorite Odds", type: .favorite)),
                    AnyView(OddsInput(value: $creation.draft.personalityParams.minUnderdogOdds,
                                      label: "Min Underdog Odds", type: .underdog)),
                ])
                .pageEntrance(index: 5)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
    }
}

// MARK: - Page 16: Sport rules (conditional edges)

struct OnboardingBuilderSportRulesPage: View {
    @Bindable var creation: AgentCreationStore

    private let trustLabels = ["Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust"]
    private let sensitivityLabels = ["Minimal", "Low", "Moderate", "High", "Maximum"]
    private let publicThresholdLabels = ["55%", "60%", "65%", "70%", "75%"]
    private let homeBoostLabels = ["Ignore", "Slight", "Moderate", "Strong", "Maximum"]
    private let recentFormLabels = ["Ignore", "Light", "Moderate", "Heavy", "Primary"]

    private var sports: [AgentSport] { creation.draft.preferredSports }
    private var hasFootball: Bool { sports.contains(.nfl) || sports.contains(.cfb) }
    private var hasBasketball: Bool { sports.contains(.nba) || sports.contains(.ncaab) }
    private var hasNBA: Bool { sports.contains(.nba) }
    private var hasNCAAB: Bool { sports.contains(.ncaab) }

    var body: some View {
        OnboardingPageScaffold(title: "Teach it your sports") {
            VStack(alignment: .leading, spacing: 0) {
                PersonalityExplainer(
                    icon: "figure.run",
                    text: "Edges that only fire where they're real — weather in football, back-to-backs in hoops."
                )
                .pageEntrance(index: 2)

                if hasFootball {
                    KnobSectionHeader(title: "Football")
                        .pageEntrance(index: 3)
                    KnobList(footballRows)
                        .pageEntrance(index: 4)
                }

                if hasBasketball {
                    KnobSectionHeader(title: "Basketball")
                        .pageEntrance(index: 5)
                    KnobList(basketballRows)
                        .pageEntrance(index: 6)
                }

                if hasNBA {
                    KnobSectionHeader(title: "NBA trends")
                        .pageEntrance(index: 7)
                    KnobList(nbaRows)
                        .pageEntrance(index: 8)
                }

                KnobSectionHeader(title: "Situational")
                    .pageEntrance(index: 9)
                KnobList(situationalRows)
                    .pageEntrance(index: 10)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
    }

    private var footballRows: [AnyView] {
        var rows: [AnyView] = [
            AnyView(ToggleInput(value: boolBinding(\.fadePublic),
                                label: "Fade the Public", description: "Bet against the crowd")),
        ]
        if creation.draft.personalityParams.fadePublic == true {
            rows.append(AnyView(SliderInput(value: intBinding(\.publicThreshold, defaultValue: 3),
                                            label: "Public Threshold", labels: publicThresholdLabels)))
        }
        rows.append(AnyView(ToggleInput(value: boolBinding(\.weatherImpactsTotals),
                                        label: "Weather Impacts Totals")))
        if creation.draft.personalityParams.weatherImpactsTotals == true {
            rows.append(AnyView(SliderInput(value: intBinding(\.weatherSensitivity, defaultValue: 3),
                                            label: "Weather Sensitivity", labels: sensitivityLabels)))
        }
        return rows
    }

    private var basketballRows: [AnyView] {
        [
            AnyView(SliderInput(value: intBinding(\.trustTeamRatings, defaultValue: 3),
                                label: "Trust Team Ratings", labels: trustLabels)),
            AnyView(ToggleInput(value: boolBinding(\.paceAffectsTotals),
                                label: "Pace Affects Totals")),
            AnyView(ToggleInput(value: boolBinding(\.fadeBackToBacks),
                                label: "Fade Back-to-Backs", description: "Bet against tired teams")),
        ]
    }

    private var nbaRows: [AnyView] {
        [
            AnyView(SliderInput(value: intBinding(\.weightRecentForm, defaultValue: 3),
                                label: "Weight Recent Form", labels: recentFormLabels)),
            AnyView(ToggleInput(value: boolBinding(\.rideHotStreaks), label: "Ride Hot Streaks")),
            AnyView(ToggleInput(value: boolBinding(\.fadeColdStreaks), label: "Fade Cold Streaks")),
            AnyView(ToggleInput(value: boolBinding(\.trustAtsTrends), label: "Trust ATS Trends")),
            AnyView(ToggleInput(value: boolBinding(\.regressLuck),
                                label: "Regress Luck", description: "Expect runs to snap back")),
        ]
    }

    private var situationalRows: [AnyView] {
        var rows: [AnyView] = [
            AnyView(SliderInput(value: $creation.draft.personalityParams.homeCourtBoost,
                                label: "Home Court/Field Boost", labels: homeBoostLabels)),
        ]
        if hasNCAAB {
            rows.append(AnyView(ToggleInput(value: boolBinding(\.upsetAlert),
                                            label: "Upset Alert", description: "Flag tournament upsets")))
        }
        return rows
    }

    // Bridge optional params to the non-optional bindings the shared inputs
    // expect — same pattern as the standalone wizard's Step 4.
    private func boolBinding(_ keyPath: WritableKeyPath<AgentPersonalityParams, Bool?>) -> Binding<Bool> {
        Binding(
            get: { creation.draft.personalityParams[keyPath: keyPath] ?? false },
            set: { creation.draft.personalityParams[keyPath: keyPath] = $0 }
        )
    }

    private func intBinding(_ keyPath: WritableKeyPath<AgentPersonalityParams, Int?>, defaultValue: Int) -> Binding<Int> {
        Binding(
            get: { creation.draft.personalityParams[keyPath: keyPath] ?? defaultValue },
            set: { creation.draft.personalityParams[keyPath: keyPath] = $0 }
        )
    }
}

// MARK: - Page 17: Custom insights (free-form standing orders)

struct OnboardingBuilderInsightsPage: View {
    @Bindable var creation: AgentCreationStore

    @FocusState private var focusedField: String?

    private struct FieldConfig {
        let title: String
        let icon: String
        let placeholder: String
        let maxLength: Int
        let keyPath: WritableKeyPath<AgentCustomInsights, String?>
    }

    private let fields: [FieldConfig] = [
        .init(
            title: "Betting Philosophy",
            icon: "book.fill",
            placeholder: "e.g., Only take plays with a real edge over the market...",
            maxLength: 500,
            keyPath: \.bettingPhilosophy
        ),
        .init(
            title: "Perceived Edges",
            icon: "chart.line.uptrend.xyaxis",
            placeholder: "e.g., Mispriced totals in divisional games, especially in bad weather...",
            maxLength: 500,
            keyPath: \.perceivedEdges
        ),
        .init(
            title: "Situations to Avoid",
            icon: "xmark.octagon",
            placeholder: "e.g., No primetime games, skip uncertain QB situations...",
            maxLength: 300,
            keyPath: \.avoidSituations
        ),
        .init(
            title: "Target Situations",
            icon: "target",
            placeholder: "e.g., Home dogs off a bye, early-season totals before lines adjust...",
            maxLength: 300,
            keyPath: \.targetSituations
        ),
    ]

    var body: some View {
        OnboardingPageScaffold(title: "Tell it your rules") {
            VStack(alignment: .leading, spacing: 0) {
                PersonalityExplainer(
                    icon: "text.quote",
                    text: "Optional. Anything here goes straight into its research brief as standing orders."
                )
                .pageEntrance(index: 2)

                VStack(spacing: 0) {
                    ForEach(Array(fields.enumerated()), id: \.element.title) { index, field in
                        insightRow(field)
                            .padding(.vertical, 16)
                        if index < fields.count - 1 { KnobDivider() }
                    }
                }
                .padding(.top, 8)
                .pageEntrance(index: 3)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func insightRow(_ field: FieldConfig) -> some View {
        let binding = Binding<String>(
            get: { creation.draft.customInsights[keyPath: field.keyPath] ?? "" },
            set: { newValue in
                creation.draft.customInsights[keyPath: field.keyPath] =
                    String(newValue.prefix(field.maxLength))
            }
        )

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: field.icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                Text(field.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(binding.wrappedValue.count)/\(field.maxLength)")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.4))
                    .monospacedDigit()
            }

            TextField(
                "",
                text: binding,
                prompt: Text(field.placeholder).foregroundColor(Color.white.opacity(0.35)),
                axis: .vertical
            )
            .lineLimit(3...6)
            .focused($focusedField, equals: field.title)
            .font(.system(size: 14))
            .foregroundStyle(.white)
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.black.opacity(0.25))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(
                        focusedField == field.title ? Color.appPrimary : Color.white.opacity(0.12),
                        lineWidth: 1
                    )
            )
        }
    }
}
