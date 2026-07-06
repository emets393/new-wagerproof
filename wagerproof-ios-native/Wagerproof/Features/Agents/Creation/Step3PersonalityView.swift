import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Step 3 of the wizard — core personality (risk, lean, confidence) +
/// bet selection. Ports `components/agents/creation/Screen3_Personality.tsx`.
///
/// Converted to native Form/Section — the custom introCard + sectionCard
/// helpers are gone; data bindings and all validation are unchanged.
struct Step3PersonalityView: View {
    @Bindable var store: AgentCreationStore

    // Labels mirror RN's *_LABELS constants in Screen3_Personality.tsx.
    private let riskLabels = ["Very Safe", "Conservative", "Balanced", "Aggressive", "High Risk"]
    private let underdogLabels = ["Chalk Only", "Prefer Favs", "Balanced", "Prefer Dogs", "Dogs Only"]
    private let overUnderLabels = ["Unders Only", "Prefer Under", "Balanced", "Prefer Over", "Overs Only"]
    private let confidenceLabels = ["Any Edge", "Low Bar", "Moderate", "High Bar", "Very Picky"]
    private let maxPicksLabels = ["1 Pick", "2 Picks", "3 Picks", "4 Picks", "5 Picks"]
    private let parlayLabels = ["Straights Only", "Rarely", "Sometimes", "Often", "Loves Parlays"]

    private let betTypes: [(value: String, label: String)] = [
        ("any", "Any"),
        ("spread", "Spread"),
        ("moneyline", "ML"),
        ("total", "Total"),
        ("prop", "Props"),
    ]

    // Flat market allowlist options (mirrors agents-v3 ALL_MARKETS). 'prop' is
    // NFL-only and only shown when the agent includes NFL. See plan D2.
    private let marketOptions: [(value: String, label: String)] = [
        ("spread", "Spread"), ("moneyline", "Moneyline"), ("total", "Total"),
        ("team_total", "Team Total"), ("prop", "Player Props"),
    ]
    private let propsEmphasisOptions: [(value: String, label: String)] = [
        ("off", "Off"), ("allow", "Allow"), ("emphasize", "Emphasize"),
    ]

    private var hasNFL: Bool { store.draft.preferredSports.contains(.nfl) }

    /// Effective allowlist: nil/empty ⇒ all markets (excluding 'prop' without NFL).
    private var effectiveMarkets: Set<String> {
        if let m = store.draft.personalityParams.allowedMarkets, !m.isEmpty { return Set(m) }
        return Set(marketOptions.map { $0.value }.filter { $0 != "prop" || hasNFL })
    }

    private func toggleMarket(_ key: String) {
        var set = effectiveMarkets
        if set.contains(key) {
            if set.count > 1 { set.remove(key) }   // keep at least one market
        } else {
            set.insert(key)
        }
        store.draft.personalityParams.allowedMarkets = marketOptions.map { $0.value }.filter { set.contains($0) }
    }

    private var propsEmphasisBind: Binding<String> {
        Binding(get: { store.draft.personalityParams.propsEmphasis ?? "allow" },
                set: { store.draft.personalityParams.propsEmphasis = $0 })
    }

    var body: some View {
        Form {
            // Intro copy lives in the first Section header/footer so it
            // reads naturally without a custom card.
            Section {
                EmptyView()
            } header: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Agent mindset")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(1.1)
                        .textCase(.uppercase)
                        .foregroundStyle(Color(hex: 0x00E676))
                    Text("Tune how this agent thinks before you fine-tune the data rules.")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .textCase(nil)
                    Text("Start with broad instincts first. The goal is a readable personality profile, not a wall of settings.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                        .textCase(nil)
                        .padding(.bottom, 4)
                }
                .padding(.bottom, 6)
            }

            Section("Core Personality") {
                SliderInput(
                    value: $store.draft.personalityParams.riskTolerance,
                    label: "Risk Tolerance",
                    description: "How much risk is your agent willing to take?",
                    labels: riskLabels
                )
                SliderInput(
                    value: $store.draft.personalityParams.underdogLean,
                    label: "Underdog Lean",
                    description: "Does your agent prefer favorites or underdogs?",
                    labels: underdogLabels
                )
                SliderInput(
                    value: $store.draft.personalityParams.overUnderLean,
                    label: "Over/Under Lean",
                    description: "Does your agent lean towards overs or unders on totals?",
                    labels: overUnderLabels
                )
                SliderInput(
                    value: $store.draft.personalityParams.confidenceThreshold,
                    label: "Confidence Threshold",
                    description: "How confident should your agent be before making a pick?",
                    labels: confidenceLabels
                )
                ToggleInput(
                    value: $store.draft.personalityParams.chaseValue,
                    label: "Chase Value",
                    description: "Seek out bets where odds exceed model probability (positive expected value)"
                )
                SliderInput(
                    value: $store.draft.personalityParams.parlayAppetite,
                    label: "Parlay Appetite",
                    description: "Can your agent combine its best plays into multi-leg parlays?",
                    labels: parlayLabels
                )
                ToggleInput(
                    value: $store.draft.personalityParams.parlaysOnly,
                    label: "Parlays Only",
                    description: "Force every play into multi-leg parlay tickets — the agent never submits straight picks"
                )
            }

            Section("Bet Selection") {
                // Picker row — label + description above the segmented control.
                VStack(alignment: .leading, spacing: 8) {
                    Text("Preferred Bet Type")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("Which bet type should your agent focus on?")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                    Picker("Bet Type", selection: $store.draft.personalityParams.preferredBetType) {
                        ForEach(betTypes, id: \.value) { entry in
                            Text(entry.label).tag(entry.value)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                .padding(.vertical, 4)

                SliderInput(
                    value: $store.draft.personalityParams.maxPicksPerDay,
                    label: "Max Picks Per Day",
                    description: "Maximum number of picks your agent will make on any given day",
                    labels: maxPicksLabels
                )
                ToggleInput(
                    value: $store.draft.personalityParams.skipWeakSlates,
                    label: "Skip Weak Slates",
                    description: "Pass on days with few games or poor betting opportunities"
                )
            }

            Section {
                ForEach(marketOptions.filter { $0.value != "prop" || hasNFL }, id: \.value) { market in
                    Button {
                        toggleMarket(market.value)
                    } label: {
                        HStack {
                            Text(market.label).foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            if effectiveMarkets.contains(market.value) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color(hex: 0x00E676))
                                    .font(.system(size: 14, weight: .bold))
                            }
                        }
                    }
                }
                if hasNFL && effectiveMarkets.contains("prop") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Player Props Emphasis")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("How hard should this agent lean into signal-backed player props?")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextSecondary)
                        Picker("Props Emphasis", selection: propsEmphasisBind) {
                            ForEach(propsEmphasisOptions, id: \.value) { entry in
                                Text(entry.label).tag(entry.value)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Markets & Props")
            } footer: {
                Text(hasNFL
                     ? "Which bet markets this agent may stake — also used as parlay legs. Player props are NFL-only and signal-gated."
                     : "Which bet markets this agent may stake. Add NFL to enable player props.")
            }
        }
    }
}
