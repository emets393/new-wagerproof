import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Step 4 of the wizard — data trust + odds limits + sport-conditional
/// sections. Mirrors `components/agents/creation/Screen4_DataAndConditions.tsx`.
///
/// Sport-conditional logic mirrors `getConditionalParams()` from
/// `wagerproof-mobile/types/agent.ts:494-516`:
///   - Football (NFL or CFB): Public-betting fade + weather sliders.
///   - Basketball (NBA or NCAAB): Team ratings + pace + back-to-backs.
///   - NBA only: Trends + streaks + ATS + luck regression.
///   - NCAAB only: Upset alert toggle.
///
/// Converted to native Form/Section — custom introCard + sectionCard helpers
/// removed. All `if` guards on preferredSports and every binding are
/// preserved verbatim.
struct Step4DataAndConditionsView: View {
    @Bindable var store: AgentCreationStore

    private let trustLabels = ["Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust"]
    private let sensitivityLabels = ["Minimal", "Low", "Moderate", "High", "Maximum"]
    private let publicThresholdLabels = ["55%", "60%", "65%", "70%", "75%"]
    private let homeBoostLabels = ["Ignore", "Slight", "Moderate", "Strong", "Maximum"]
    private let recentFormLabels = ["Ignore", "Light", "Moderate", "Heavy", "Primary"]

    private var sports: [AgentSport] { store.draft.preferredSports }
    private var hasFootball: Bool { sports.contains(.nfl) || sports.contains(.cfb) }
    private var hasBasketball: Bool { sports.contains(.nba) || sports.contains(.ncaab) }
    private var hasNBA: Bool { sports.contains(.nba) }
    private var hasNCAAB: Bool { sports.contains(.ncaab) }

    var body: some View {
        Form {
            // Intro copy in first Section header — replaces the custom introCard.
            Section {
                EmptyView()
            } header: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Data controls")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(1.1)
                        .textCase(.uppercase)
                        .foregroundStyle(Color(hex: 0x00E676))
                    Text("Choose the signals this agent should trust most.")
                        .font(.system(size: 20, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .textCase(nil)
                    Text("Keep the defaults lightweight, then layer in sport-specific rules only where they help.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.appTextSecondary)
                        .textCase(nil)
                        .padding(.bottom, 4)
                }
                .padding(.bottom, 6)
            }

            Section("Data Trust") {
                SliderInput(
                    value: $store.draft.personalityParams.trustModel,
                    label: "Trust WagerProof Model",
                    description: "How much weight to give our predictive model's probabilities",
                    labels: trustLabels
                )
                SliderInput(
                    value: $store.draft.personalityParams.trustPolymarket,
                    label: "Trust Polymarket",
                    description: "How much weight to give Polymarket prediction market odds",
                    labels: trustLabels
                )
                ToggleInput(
                    value: $store.draft.personalityParams.polymarketDivergenceFlag,
                    label: "Polymarket Divergence Flag",
                    description: "Flag games where Polymarket significantly differs from Vegas lines"
                )
            }

            Section("Odds Limits") {
                OddsInput(
                    value: $store.draft.personalityParams.maxFavoriteOdds,
                    label: "Max Favorite Odds",
                    type: .favorite
                )
                OddsInput(
                    value: $store.draft.personalityParams.minUnderdogOdds,
                    label: "Min Underdog Odds",
                    type: .underdog
                )
            }

            if hasFootball {
                footballSection
            }

            if hasBasketball {
                basketballSection
            }

            if hasNBA {
                nbaTrendsSection
            }

            // Situational always shown.
            situationalSection
        }
    }

    // MARK: - Football section

    @ViewBuilder
    private var footballSection: some View {
        Section {
            ToggleInput(
                value: boolBinding(\.fadePublic),
                label: "Fade the Public",
                description: "Bet against heavy public action on one side"
            )
            if store.draft.personalityParams.fadePublic == true {
                SliderInput(
                    value: intBinding(\.publicThreshold, defaultValue: 3),
                    label: "Public Threshold",
                    description: "Percentage of public bets required to trigger a fade",
                    labels: publicThresholdLabels
                )
            }
            ToggleInput(
                value: boolBinding(\.weatherImpactsTotals),
                label: "Weather Impacts Totals",
                description: "Factor in weather conditions for total bets (wind, rain, snow)"
            )
            if store.draft.personalityParams.weatherImpactsTotals == true {
                SliderInput(
                    value: intBinding(\.weatherSensitivity, defaultValue: 3),
                    label: "Weather Sensitivity",
                    description: "How aggressively to adjust for weather conditions",
                    labels: sensitivityLabels
                )
            }
        } header: {
            footballSectionHeader
        } footer: {
            Text("Football-specific betting conditions")
        }
    }

    private var footballSectionHeader: some View {
        HStack(spacing: 8) {
            Text("Football Settings")
            Spacer()
            HStack(spacing: 4) {
                if sports.contains(.nfl) {
                    Text("NFL")
                        .font(.system(size: 11, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .foregroundStyle(Color(hex: 0x93BBFD))
                        .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0x3B82F6).opacity(0.2)))
                }
                if sports.contains(.cfb) {
                    Text("CFB")
                        .font(.system(size: 11, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .foregroundStyle(Color(hex: 0xFCA5A5))
                        .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0xEF4444).opacity(0.2)))
                }
            }
        }
    }

    // MARK: - Basketball section

    @ViewBuilder
    private var basketballSection: some View {
        Section {
            SliderInput(
                value: intBinding(\.trustTeamRatings, defaultValue: 3),
                label: "Trust Team Ratings",
                description: "How much to trust advanced team ratings (e.g., NET, KenPom)",
                labels: trustLabels
            )
            ToggleInput(
                value: boolBinding(\.paceAffectsTotals),
                label: "Pace Affects Totals",
                description: "Factor team pace into over/under decisions"
            )
            // showBackToBacks == showTeamRatings (both basketball) — always on here.
            ToggleInput(
                value: boolBinding(\.fadeBackToBacks),
                label: "Fade Back-to-Backs",
                description: "Bet against teams playing on consecutive days"
            )
        } header: {
            basketballSectionHeader
        } footer: {
            Text("Basketball-specific betting conditions")
        }
    }

    private var basketballSectionHeader: some View {
        HStack(spacing: 8) {
            Text("Basketball Settings")
            Spacer()
            HStack(spacing: 4) {
                if sports.contains(.nba) {
                    Text("NBA")
                        .font(.system(size: 11, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .foregroundStyle(Color(hex: 0x93BBFD))
                        .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0x3B82F6).opacity(0.2)))
                }
                if sports.contains(.ncaab) {
                    Text("NCAAB")
                        .font(.system(size: 11, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .foregroundStyle(Color(hex: 0xFDBA74))
                        .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0xF97316).opacity(0.2)))
                }
            }
        }
    }

    // MARK: - NBA trends

    @ViewBuilder
    private var nbaTrendsSection: some View {
        Section {
            SliderInput(
                value: intBinding(\.weightRecentForm, defaultValue: 3),
                label: "Weight Recent Form",
                description: "How much to weigh a team's last 10 games vs. season averages",
                labels: recentFormLabels
            )
            ToggleInput(
                value: boolBinding(\.rideHotStreaks),
                label: "Ride Hot Streaks",
                description: "Bet on teams that are winning consistently"
            )
            ToggleInput(
                value: boolBinding(\.fadeColdStreaks),
                label: "Fade Cold Streaks",
                description: "Bet against teams that are losing consistently"
            )
            ToggleInput(
                value: boolBinding(\.trustAtsTrends),
                label: "Trust ATS Trends",
                description: "Factor in against-the-spread performance trends"
            )
            ToggleInput(
                value: boolBinding(\.regressLuck),
                label: "Regress Luck",
                description: "Expect teams on hot/cold streaks to regress to the mean"
            )
        } header: {
            HStack(spacing: 8) {
                Text("NBA Trends")
                Spacer()
                Text("NBA")
                    .font(.system(size: 11, weight: .bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .foregroundStyle(Color(hex: 0x93BBFD))
                    .background(RoundedRectangle(cornerRadius: 4).fill(Color(hex: 0x3B82F6).opacity(0.2)))
            }
        } footer: {
            Text("NBA-specific trend and streak analysis")
        }
    }

    // MARK: - Situational section (always shown)

    @ViewBuilder
    private var situationalSection: some View {
        Section {
            SliderInput(
                value: $store.draft.personalityParams.homeCourtBoost,
                label: "Home Court/Field Boost",
                description: "How much extra weight to give home teams",
                labels: homeBoostLabels
            )
            if hasNCAAB {
                ToggleInput(
                    value: boolBinding(\.upsetAlert),
                    label: "Upset Alert",
                    description: "Flag potential March Madness upsets based on tournament trends"
                )
            }
        } header: {
            Text("Situational Factors")
        } footer: {
            Text("Game situation adjustments")
        }
    }

    // MARK: - Optional binding helpers

    /// Bridge `Bool?` on AgentPersonalityParams to a non-optional `Binding<Bool>`
    /// expected by ToggleInput. Reads `false` when nil; writes wrap in
    /// `Optional` so we still send a value through to the server.
    private func boolBinding(_ keyPath: WritableKeyPath<AgentPersonalityParams, Bool?>) -> Binding<Bool> {
        Binding(
            get: { store.draft.personalityParams[keyPath: keyPath] ?? false },
            set: { store.draft.personalityParams[keyPath: keyPath] = $0 }
        )
    }

    /// Same pattern for nullable Int sliders — RN keeps these as optionals so
    /// they round-trip cleanly through Supabase JSONB.
    private func intBinding(_ keyPath: WritableKeyPath<AgentPersonalityParams, Int?>, defaultValue: Int) -> Binding<Int> {
        Binding(
            get: { store.draft.personalityParams[keyPath: keyPath] ?? defaultValue },
            set: { store.draft.personalityParams[keyPath: keyPath] = $0 }
        )
    }
}
