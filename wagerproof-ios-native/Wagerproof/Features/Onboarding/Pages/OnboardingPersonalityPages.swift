// OnboardingPersonalityPages.swift
//
// Pages 13–17: the per-section agent personality walk. EVERY user goes
// through these — a preset pre-fills the dials, custom starts balanced —
// because each page explains how its section shapes the agent's behavior,
// and adjusting the dials is what makes the generation cinematic feel like
// watching YOUR analyst boot up, not a template.
//
// Controls are the SAME inputs the standalone wizard uses (SliderInput /
// ToggleInput / OddsInput bound to the shared AgentCreationStore draft), so
// everything set here is exactly what `create_agent` receives.

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

// MARK: - Shared framing

/// "How this shapes your agent" callout at the top of each section page.
private struct PersonalityExplainer: View {
    let icon: String
    let text: String
    var accent: Color = .appPrimary

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(accent)
                .frame(width: 36, height: 36)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous),
                    tint: accent.opacity(0.18)
                )
            Text(text)
                .font(.system(size: 13))
                .foregroundStyle(Color.white.opacity(0.75))
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 16, style: .continuous),
            tint: Color.white.opacity(0.04)
        )
    }
}

/// Glass card that groups a page's controls.
private struct PersonalityCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            content()
        }
        .padding(16)
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 20, style: .continuous),
            tint: Color.white.opacity(0.05)
        )
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
                Text("Pre-tuned by \(archetype.displayName) — adjust anything")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(Color.appPrimary)
            .frame(maxWidth: .infinity)
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
        OnboardingPageScaffold(
            title: "Set its instincts",
            subtitle: "Four dials that define your agent's temperament."
        ) {
            VStack(spacing: 12) {
                PersonalityExplainer(
                    icon: "brain.head.profile",
                    text: "These write your agent's temperament into every research brief. A High-Risk, Dogs-Only agent hunts a completely different board than a chalk grinder — same games, different picks."
                )
                .pageEntrance(index: 2)

                PresetNote(archetype: creation.draft.archetype)
                    .pageEntrance(index: 3)

                PersonalityCard {
                    SliderInput(
                        value: $creation.draft.personalityParams.riskTolerance,
                        label: "Risk Tolerance",
                        description: "How much risk is your agent willing to take?",
                        labels: riskLabels
                    )
                    SliderInput(
                        value: $creation.draft.personalityParams.underdogLean,
                        label: "Underdog Lean",
                        description: "Does your agent prefer favorites or underdogs?",
                        labels: underdogLabels
                    )
                    SliderInput(
                        value: $creation.draft.personalityParams.overUnderLean,
                        label: "Over/Under Lean",
                        description: "Does your agent lean overs or unders on totals?",
                        labels: overUnderLabels
                    )
                    SliderInput(
                        value: $creation.draft.personalityParams.confidenceThreshold,
                        label: "Confidence Threshold",
                        description: "How confident must it be before firing a pick?",
                        labels: confidenceLabels
                    )
                }
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
        OnboardingPageScaffold(
            title: "Choose its playbook",
            subtitle: "What it bets, how often it fires, and when it sits out."
        ) {
            VStack(spacing: 12) {
                PersonalityExplainer(
                    icon: "list.clipboard",
                    text: "This decides what actually lands on your ticket rail: the markets it plays, how many picks per day, and whether it builds parlays or sticks to straights."
                )
                .pageEntrance(index: 2)

                PersonalityCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Preferred Bet Type")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("Which market should your agent focus on?")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextSecondary)
                        Picker("Bet Type", selection: $creation.draft.personalityParams.preferredBetType) {
                            ForEach(betTypes, id: \.value) { entry in
                                Text(entry.label).tag(entry.value)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    SliderInput(
                        value: $creation.draft.personalityParams.maxPicksPerDay,
                        label: "Max Picks Per Day",
                        description: "Its daily ceiling — quality over volume",
                        labels: maxPicksLabels
                    )
                    ToggleInput(
                        value: $creation.draft.personalityParams.skipWeakSlates,
                        label: "Skip Weak Slates",
                        description: "Pass entirely on days with few games or thin edges"
                    )
                    ToggleInput(
                        value: $creation.draft.personalityParams.chaseValue,
                        label: "Chase Value",
                        description: "Hunt bets where the odds beat our model's probability (positive EV)"
                    )
                    SliderInput(
                        value: $creation.draft.personalityParams.parlayAppetite,
                        label: "Parlay Appetite",
                        description: "Can it combine its best plays into multi-leg tickets?",
                        labels: parlayLabels
                    )
                    ToggleInput(
                        value: $creation.draft.personalityParams.parlaysOnly,
                        label: "Parlays Only",
                        description: "Every play becomes a parlay leg — no straight picks"
                    )

                    // Markets allowlist (+ NFL player-props emphasis). See plan D2.
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Markets")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("Which bet markets it may stake — also used as parlay legs.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextSecondary)
                        ForEach(marketOptions.filter { $0.value != "prop" || hasNFL }, id: \.value) { market in
                            Button {
                                toggleMarket(market.value)
                            } label: {
                                HStack {
                                    Text(market.label).foregroundStyle(Color.appTextPrimary)
                                    Spacer()
                                    Image(systemName: effectiveMarkets.contains(market.value) ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(effectiveMarkets.contains(market.value) ? Color(hex: 0x00E676) : Color.appTextSecondary)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                        if hasNFL && effectiveMarkets.contains("prop") {
                            Text("Player Props Emphasis")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
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
                .pageEntrance(index: 3)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
    }
}

// MARK: - Page 15: Data trust (signals + price limits)

struct OnboardingBuilderDataTrustPage: View {
    @Bindable var creation: AgentCreationStore

    private let trustLabels = ["Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust"]

    var body: some View {
        OnboardingPageScaffold(
            title: "Pick its data diet",
            subtitle: "Who your agent listens to when the signals disagree."
        ) {
            VStack(spacing: 12) {
                PersonalityExplainer(
                    icon: "cylinder.split.1x2",
                    text: "Your agent weighs our model, Polymarket's prediction markets, and the Vegas price against each other on every game. These dials set whose voice wins the argument."
                )
                .pageEntrance(index: 2)

                PersonalityCard {
                    SliderInput(
                        value: $creation.draft.personalityParams.trustModel,
                        label: "Trust WagerProof Model",
                        description: "Weight given to our predictive model's probabilities",
                        labels: trustLabels
                    )
                    SliderInput(
                        value: $creation.draft.personalityParams.trustPolymarket,
                        label: "Trust Polymarket",
                        description: "Weight given to prediction-market odds",
                        labels: trustLabels
                    )
                    ToggleInput(
                        value: $creation.draft.personalityParams.polymarketDivergenceFlag,
                        label: "Polymarket Divergence Flag",
                        description: "Flag games where Polymarket splits hard from the Vegas line"
                    )
                }
                .pageEntrance(index: 3)

                PersonalityCard {
                    Text("Price limits")
                        .font(.system(size: 13, weight: .heavy))
                        .tracking(0.6)
                        .textCase(.uppercase)
                        .foregroundStyle(Color.white.opacity(0.5))
                    OddsInput(
                        value: $creation.draft.personalityParams.maxFavoriteOdds,
                        label: "Max Favorite Odds",
                        type: .favorite
                    )
                    OddsInput(
                        value: $creation.draft.personalityParams.minUnderdogOdds,
                        label: "Min Underdog Odds",
                        type: .underdog
                    )
                }
                .pageEntrance(index: 4)
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
        OnboardingPageScaffold(
            title: "Teach it your sports",
            subtitle: "Edges that only exist in the sports you picked."
        ) {
            VStack(spacing: 12) {
                PersonalityExplainer(
                    icon: "figure.run",
                    text: "These rules apply only where they're real signals — weather only moves football totals, back-to-backs only matter in hoops. Your agent cites them in its reasoning when they fire."
                )
                .pageEntrance(index: 2)

                if hasFootball {
                    sectionLabel("FOOTBALL")
                        .pageEntrance(index: 3)
                    PersonalityCard {
                        ToggleInput(
                            value: boolBinding(\.fadePublic),
                            label: "Fade the Public",
                            description: "Bet against heavy public action on one side"
                        )
                        if creation.draft.personalityParams.fadePublic == true {
                            SliderInput(
                                value: intBinding(\.publicThreshold, defaultValue: 3),
                                label: "Public Threshold",
                                description: "How lopsided the public money must be to trigger a fade",
                                labels: publicThresholdLabels
                            )
                        }
                        ToggleInput(
                            value: boolBinding(\.weatherImpactsTotals),
                            label: "Weather Impacts Totals",
                            description: "Wind, rain, and snow adjust its totals math"
                        )
                        if creation.draft.personalityParams.weatherImpactsTotals == true {
                            SliderInput(
                                value: intBinding(\.weatherSensitivity, defaultValue: 3),
                                label: "Weather Sensitivity",
                                description: "How aggressively weather moves its numbers",
                                labels: sensitivityLabels
                            )
                        }
                    }
                    .pageEntrance(index: 4)
                }

                if hasBasketball {
                    sectionLabel("BASKETBALL")
                        .pageEntrance(index: 5)
                    PersonalityCard {
                        SliderInput(
                            value: intBinding(\.trustTeamRatings, defaultValue: 3),
                            label: "Trust Team Ratings",
                            description: "Weight for advanced ratings (NET, KenPom-style)",
                            labels: trustLabels
                        )
                        ToggleInput(
                            value: boolBinding(\.paceAffectsTotals),
                            label: "Pace Affects Totals",
                            description: "Team pace feeds its over/under decisions"
                        )
                        ToggleInput(
                            value: boolBinding(\.fadeBackToBacks),
                            label: "Fade Back-to-Backs",
                            description: "Bet against teams on consecutive game days"
                        )
                    }
                    .pageEntrance(index: 6)
                }

                if hasNBA {
                    sectionLabel("NBA TRENDS")
                        .pageEntrance(index: 7)
                    PersonalityCard {
                        SliderInput(
                            value: intBinding(\.weightRecentForm, defaultValue: 3),
                            label: "Weight Recent Form",
                            description: "Last 10 games vs season averages",
                            labels: recentFormLabels
                        )
                        ToggleInput(
                            value: boolBinding(\.rideHotStreaks),
                            label: "Ride Hot Streaks",
                            description: "Back teams that keep winning"
                        )
                        ToggleInput(
                            value: boolBinding(\.fadeColdStreaks),
                            label: "Fade Cold Streaks",
                            description: "Bet against teams in freefall"
                        )
                        ToggleInput(
                            value: boolBinding(\.trustAtsTrends),
                            label: "Trust ATS Trends",
                            description: "Factor in against-the-spread form"
                        )
                        ToggleInput(
                            value: boolBinding(\.regressLuck),
                            label: "Regress Luck",
                            description: "Expect hot/cold runs to snap back to the mean"
                        )
                    }
                    .pageEntrance(index: 8)
                }

                sectionLabel("SITUATIONAL")
                    .pageEntrance(index: 9)
                PersonalityCard {
                    SliderInput(
                        value: $creation.draft.personalityParams.homeCourtBoost,
                        label: "Home Court/Field Boost",
                        description: "Extra weight for the home team",
                        labels: homeBoostLabels
                    )
                    if hasNCAAB {
                        ToggleInput(
                            value: boolBinding(\.upsetAlert),
                            label: "Upset Alert",
                            description: "Flag potential tournament upsets from historical trends"
                        )
                    }
                }
                .pageEntrance(index: 10)
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .heavy))
            .tracking(1.0)
            .foregroundStyle(Color.white.opacity(0.4))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
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
        let description: String
        let placeholder: String
        let maxLength: Int
        let keyPath: WritableKeyPath<AgentCustomInsights, String?>
    }

    private let fields: [FieldConfig] = [
        .init(
            title: "Betting Philosophy",
            icon: "book.fill",
            description: "The principles behind your decisions.",
            placeholder: "e.g., Only take plays with a real edge over the market...",
            maxLength: 500,
            keyPath: \.bettingPhilosophy
        ),
        .init(
            title: "Perceived Edges",
            icon: "chart.line.uptrend.xyaxis",
            description: "Where do you think you beat the market?",
            placeholder: "e.g., Mispriced totals in divisional games, especially in bad weather...",
            maxLength: 500,
            keyPath: \.perceivedEdges
        ),
        .init(
            title: "Situations to Avoid",
            icon: "xmark.octagon",
            description: "Games it should never touch.",
            placeholder: "e.g., No primetime games, skip uncertain QB situations...",
            maxLength: 300,
            keyPath: \.avoidSituations
        ),
        .init(
            title: "Target Situations",
            icon: "target",
            description: "Spots it should hunt for.",
            placeholder: "e.g., Home dogs off a bye, early-season totals before lines adjust...",
            maxLength: 300,
            keyPath: \.targetSituations
        ),
    ]

    var body: some View {
        OnboardingPageScaffold(
            title: "Tell it your rules",
            subtitle: "Optional — but this is where it becomes YOURS."
        ) {
            VStack(spacing: 12) {
                PersonalityExplainer(
                    icon: "text.quote",
                    text: "Anything you write here goes verbatim into your agent's research brief — it follows these like standing orders and cites them in its reasoning."
                )
                .pageEntrance(index: 2)

                ForEach(Array(fields.enumerated()), id: \.element.title) { index, field in
                    insightCard(field)
                        .pageEntrance(index: 3 + index)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 4)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func insightCard(_ field: FieldConfig) -> some View {
        let binding = Binding<String>(
            get: { creation.draft.customInsights[keyPath: field.keyPath] ?? "" },
            set: { newValue in
                creation.draft.customInsights[keyPath: field.keyPath] =
                    String(newValue.prefix(field.maxLength))
            }
        )

        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: field.icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                Text(field.title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("\(binding.wrappedValue.count)/\(field.maxLength)")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.white.opacity(0.45))
                    .monospacedDigit()
            }

            Text(field.description)
                .font(.system(size: 13))
                .foregroundStyle(Color.white.opacity(0.6))

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
        .padding(14)
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 16, style: .continuous),
            tint: Color.white.opacity(0.05)
        )
    }
}
