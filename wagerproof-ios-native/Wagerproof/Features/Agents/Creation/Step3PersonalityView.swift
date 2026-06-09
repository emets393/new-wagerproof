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

    private let betTypes: [(value: String, label: String)] = [
        ("any", "Any"),
        ("spread", "Spread"),
        ("moneyline", "ML"),
        ("total", "Total"),
    ]

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
        }
    }
}
