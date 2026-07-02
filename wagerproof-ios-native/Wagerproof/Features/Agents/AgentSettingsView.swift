import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Native port of `app/(drawer)/(tabs)/agents/[id]/settings.tsx`. Lets the
/// owner edit every personality + identity + autopilot + visibility setting
/// for an agent, with a dedicated Danger Zone for delete.
///
/// Submit routes through `agent-authorized-action-v1` with the `update_agent`
/// action so server-side Zod validation runs identically to the RN path.
///
/// Full parity with the creation wizard: identity, sports, the core
/// personality + bet-selection + data-trust + odds-limits inputs, the
/// sport-conditional football / basketball / NBA-trends / situational
/// sections, and the four custom-insight fields. Reuses the same
/// `SliderInput` / `ToggleInput` / `OddsInput` primitives as the wizard so
/// the two screens stay byte-for-byte consistent. The whole
/// `personality_params` + `custom_insights` payload round-trips through
/// `update_agent`.
struct AgentSettingsView: View {
    let agentId: String
    let initialAgent: Agent?

    @Environment(\.dismiss) private var dismiss
    @Environment(ProAccessStore.self) private var proAccess
    @State private var store: AgentDetailStore
    @State private var loadedAgent: Agent? = nil
    @State private var name: String = ""
    @State private var emoji: String = "🤖"
    /// Pixel-office character pick (0…7). Replaces the old emoji picker; the
    /// emoji value is still round-tripped untouched for the web/RN surfaces.
    @State private var spriteIndex: Int = 0
    @State private var color: String = "#3B82F6"
    @State private var sports: Set<AgentSport> = []
    @State private var personality: AgentPersonalityParams = .default
    @State private var customInsights: AgentCustomInsights = .empty
    @State private var autoGenerate: Bool = true
    @State private var autoGenerateTime: String = "09:00"
    @State private var autoGenerateTimezone: String = "America/New_York"
    @State private var isPublic: Bool = false
    @State private var hasChanges: Bool = false
    @State private var saving: Bool = false
    @State private var deleteConfirm: Bool = false
    @State private var errorMessage: String? = nil
    @State private var showTimePicker: Bool = false

    private static let colorOptions = [
        "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
        "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316"
    ]

    // Label sets mirror the creation wizard (Step3 / Step4) exactly.
    private let riskLabels = ["Very Safe", "Conservative", "Balanced", "Aggressive", "High Risk"]
    private let underdogLabels = ["Chalk Only", "Prefer Favs", "Balanced", "Prefer Dogs", "Dogs Only"]
    private let overUnderLabels = ["Unders Only", "Prefer Under", "Balanced", "Prefer Over", "Overs Only"]
    private let confidenceLabels = ["Any Edge", "Low Bar", "Moderate", "High Bar", "Very Picky"]
    private let maxPicksLabels = ["1 Pick", "2 Picks", "3 Picks", "4 Picks", "5 Picks"]
    private let parlayLabels = ["Straights Only", "Rarely", "Sometimes", "Often", "Loves Parlays"]
    private let trustLabels = ["Ignore", "Low Trust", "Moderate", "High Trust", "Full Trust"]
    private let sensitivityLabels = ["Minimal", "Low", "Moderate", "High", "Maximum"]
    private let publicThresholdLabels = ["55%", "60%", "65%", "70%", "75%"]
    private let homeBoostLabels = ["Ignore", "Slight", "Moderate", "Strong", "Maximum"]
    private let recentFormLabels = ["Ignore", "Light", "Moderate", "Heavy", "Primary"]
    private let betTypes: [(value: String, label: String)] = [
        ("any", "Any"), ("spread", "Spread"), ("moneyline", "ML"), ("total", "Total"),
    ]

    init(agentId: String, initialAgent: Agent?) {
        self.agentId = agentId
        self.initialAgent = initialAgent
        _store = State(initialValue: AgentDetailStore(agentId: agentId))
    }

    private var entitlements: AgentEntitlementsStore {
        AgentEntitlementsStore(proAccess: proAccess)
    }

    private var hasFootball: Bool { sports.contains(.nfl) || sports.contains(.cfb) }
    private var hasBasketball: Bool { sports.contains(.nba) || sports.contains(.ncaab) }
    private var hasNBA: Bool { sports.contains(.nba) }
    private var hasNCAAB: Bool { sports.contains(.ncaab) }

    var body: some View {
        // Grouped into a few @ViewBuilder properties so the Form's builder
        // stays under the ~10-child ViewBuilder cap as the section count grew
        // to full wizard parity.
        Form {
            identitySection
            sportsSection
            personalitySections
            conditionalSections
            customInsightsSections
            accountSections
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await save() }
                } label: {
                    if saving {
                        ProgressView()
                    } else {
                        Text("Save").bold()
                    }
                }
                .disabled(!hasChanges || saving)
            }
        }
        .task(id: agentId) {
            // Paint instantly from the pushed-in agent, but ALWAYS re-fetch —
            // the parent screen's snapshot can be stale (it isn't refreshed
            // after a save from this screen), which made saved settings appear
            // to revert on reopen. `hydrate` is a no-op once the user edits.
            if let agent = initialAgent {
                hydrate(from: agent)
            }
            await store.refreshSnapshot()
            if let agent = store.snapshot?.agent {
                hydrate(from: agent)
            }
        }
        .sheet(isPresented: $showTimePicker) {
            TimePickerModal(
                isPresented: $showTimePicker,
                time: Binding(get: { autoGenerateTime }, set: { autoGenerateTime = $0; hasChanges = true }),
                timezone: Binding(get: { autoGenerateTimezone }, set: { autoGenerateTimezone = $0; hasChanges = true })
            )
        }
        .alert("Delete Agent?", isPresented: $deleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task {
                    let ok = await store.delete()
                    if ok { dismiss() }
                }
            }
        } message: {
            Text("Are you sure you want to delete \"\(name)\"? This cannot be undone.")
        }
        .alert("Error", isPresented: errorAlertBinding, presenting: errorMessage) { _ in
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: { msg in
            Text(msg)
        }
    }

    // MARK: - Section groups (keep Form builder under the ViewBuilder cap)

    @ViewBuilder
    private var personalitySections: some View {
        corePersonalitySection
        betSelectionSection
        dataTrustSection
        oddsLimitsSection
    }

    @ViewBuilder
    private var conditionalSections: some View {
        if hasFootball { footballSection }
        if hasBasketball { basketballSection }
        if hasNBA { nbaTrendsSection }
        situationalSection
    }

    @ViewBuilder
    private var accountSections: some View {
        autopilotSection
        visibilitySection
        dangerZoneSection
    }

    // MARK: - Identity

    private var identitySection: some View {
        Section {
            TextField("Agent name", text: $name)
                .onChange(of: name) { _, _ in hasChanges = true }

            VStack(alignment: .leading, spacing: 6) {
                Text("Character").font(.system(size: 13, weight: .semibold))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        // The 8 pixel-office people (avatar_0…avatar_7) replace
                        // the old emoji grid — this is the same character that
                        // sits at the agent's desk and fronts its cards.
                        ForEach(0..<8, id: \.self) { idx in
                            let isSelected = spriteIndex == idx
                            Button {
                                spriteIndex = idx
                                hasChanges = true
                            } label: {
                                PixelSpriteAvatar(spriteIndex: idx, animated: isSelected)
                                    .frame(width: 42, height: 56)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 6)
                                    .background(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .fill(isSelected ? Color(hex: 0x00E676).opacity(0.18) : Color.appBorder.opacity(0.3))
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .strokeBorder(isSelected ? Color(hex: 0x00E676) : .clear, lineWidth: 2)
                                    )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Character \(idx + 1)")
                            .accessibilityAddTraits(isSelected ? .isSelected : [])
                        }
                    }
                }
            }
            .padding(.vertical, 4)

            VStack(alignment: .leading, spacing: 6) {
                Text("Color").font(.system(size: 13, weight: .semibold))
                let cols = [GridItem(.adaptive(minimum: 44), spacing: 8)]
                LazyVGrid(columns: cols, spacing: 8) {
                    ForEach(Self.colorOptions, id: \.self) { c in
                        let isSelected = color.lowercased() == c.lowercased()
                        Button {
                            color = c
                            hasChanges = true
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Color(hexString: c) ?? .blue)
                                    .frame(width: 40, height: 40)
                                if isSelected {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                            .overlay(
                                Circle().strokeBorder(.white, lineWidth: isSelected ? 3 : 0)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.vertical, 4)
        } header: {
            Text("Identity")
        }
    }

    private var sportsSection: some View {
        Section {
            ForEach(AgentSport.allCases, id: \.self) { sport in
                Button {
                    if sports.contains(sport) {
                        if sports.count > 1 { sports.remove(sport) }
                    } else {
                        sports.insert(sport)
                    }
                    hasChanges = true
                } label: {
                    HStack {
                        Image(systemName: sport.sfSymbol)
                            .foregroundStyle(Color.appPrimary)
                            .frame(width: 24)
                        Text(sport.label)
                            .foregroundStyle(Color.appTextPrimary)
                        Spacer()
                        if sports.contains(sport) {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Color(hex: 0x00E676))
                                .font(.system(size: 14, weight: .bold))
                        }
                    }
                }
            }
        } header: {
            Text("Sports")
        } footer: {
            Text("Pick at least one sport this agent should cover.")
                .font(.system(size: 11))
        }
    }

    // MARK: - Personality

    private var corePersonalitySection: some View {
        Section {
            SliderInput(value: intBind(\.riskTolerance), label: "Risk Tolerance",
                        description: "How much risk is your agent willing to take?", labels: riskLabels)
            SliderInput(value: intBind(\.underdogLean), label: "Underdog Lean",
                        description: "Does your agent prefer favorites or underdogs?", labels: underdogLabels)
            SliderInput(value: intBind(\.overUnderLean), label: "Over/Under Lean",
                        description: "Does your agent lean towards overs or unders on totals?", labels: overUnderLabels)
            SliderInput(value: intBind(\.confidenceThreshold), label: "Confidence Threshold",
                        description: "How confident should your agent be before making a pick?", labels: confidenceLabels)
            ToggleInput(value: boolBind(\.chaseValue), label: "Chase Value",
                        description: "Seek out bets where odds exceed model probability (positive expected value)")
            SliderInput(value: intBind(\.parlayAppetite), label: "Parlay Appetite",
                        description: "Can your agent combine its best plays into multi-leg parlays?", labels: parlayLabels)
            ToggleInput(value: boolBind(\.parlaysOnly), label: "Parlays Only",
                        description: "Force every play into multi-leg parlay tickets — the agent never submits straight picks")
        } header: {
            Text("Core Personality")
        }
    }

    private var betSelectionSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text("Preferred Bet Type")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Picker("Bet Type", selection: betTypeBind) {
                    ForEach(betTypes, id: \.value) { entry in
                        Text(entry.label).tag(entry.value)
                    }
                }
                .pickerStyle(.segmented)
            }
            .padding(.vertical, 4)
            SliderInput(value: intBind(\.maxPicksPerDay), label: "Max Picks Per Day",
                        description: "Maximum number of picks your agent will make on any given day", labels: maxPicksLabels)
            ToggleInput(value: boolBind(\.skipWeakSlates), label: "Skip Weak Slates",
                        description: "Pass on days with few games or poor betting opportunities")
        } header: {
            Text("Bet Selection")
        }
    }

    private var dataTrustSection: some View {
        Section {
            SliderInput(value: intBind(\.trustModel), label: "Trust WagerProof Model",
                        description: "How much weight to give our predictive model's probabilities", labels: trustLabels)
            SliderInput(value: intBind(\.trustPolymarket), label: "Trust Polymarket",
                        description: "How much weight to give Polymarket prediction market odds", labels: trustLabels)
            ToggleInput(value: boolBind(\.polymarketDivergenceFlag), label: "Polymarket Divergence Flag",
                        description: "Flag games where Polymarket significantly differs from Vegas lines")
        } header: {
            Text("Data Trust")
        }
    }

    private var oddsLimitsSection: some View {
        Section {
            OddsInput(value: oddsBind(\.maxFavoriteOdds), label: "Max Favorite Odds", type: .favorite)
            OddsInput(value: oddsBind(\.minUnderdogOdds), label: "Min Underdog Odds", type: .underdog)
        } header: {
            Text("Odds Limits")
        }
    }

    // MARK: - Sport-conditional

    private var footballSection: some View {
        Section {
            ToggleInput(value: optBoolBind(\.fadePublic), label: "Fade the Public",
                        description: "Bet against heavy public action on one side")
            if personality.fadePublic == true {
                SliderInput(value: optIntBind(\.publicThreshold, 3), label: "Public Threshold",
                            description: "Percentage of public bets required to trigger a fade", labels: publicThresholdLabels)
            }
            ToggleInput(value: optBoolBind(\.weatherImpactsTotals), label: "Weather Impacts Totals",
                        description: "Factor in weather conditions for total bets (wind, rain, snow)")
            if personality.weatherImpactsTotals == true {
                SliderInput(value: optIntBind(\.weatherSensitivity, 3), label: "Weather Sensitivity",
                            description: "How aggressively to adjust for weather conditions", labels: sensitivityLabels)
            }
        } header: {
            Text("Football Settings")
        } footer: {
            Text("Football-specific betting conditions")
        }
    }

    private var basketballSection: some View {
        Section {
            SliderInput(value: optIntBind(\.trustTeamRatings, 3), label: "Trust Team Ratings",
                        description: "How much to trust advanced team ratings (e.g., NET, KenPom)", labels: trustLabels)
            ToggleInput(value: optBoolBind(\.paceAffectsTotals), label: "Pace Affects Totals",
                        description: "Factor team pace into over/under decisions")
            ToggleInput(value: optBoolBind(\.fadeBackToBacks), label: "Fade Back-to-Backs",
                        description: "Bet against teams playing on consecutive days")
        } header: {
            Text("Basketball Settings")
        } footer: {
            Text("Basketball-specific betting conditions")
        }
    }

    private var nbaTrendsSection: some View {
        Section {
            SliderInput(value: optIntBind(\.weightRecentForm, 3), label: "Weight Recent Form",
                        description: "How much to weigh a team's last 10 games vs. season averages", labels: recentFormLabels)
            ToggleInput(value: optBoolBind(\.rideHotStreaks), label: "Ride Hot Streaks",
                        description: "Bet on teams that are winning consistently")
            ToggleInput(value: optBoolBind(\.fadeColdStreaks), label: "Fade Cold Streaks",
                        description: "Bet against teams that are losing consistently")
            ToggleInput(value: optBoolBind(\.trustAtsTrends), label: "Trust ATS Trends",
                        description: "Factor in against-the-spread performance trends")
            ToggleInput(value: optBoolBind(\.regressLuck), label: "Regress Luck",
                        description: "Expect teams on hot/cold streaks to regress to the mean")
        } header: {
            Text("NBA Trends")
        } footer: {
            Text("NBA-specific trend and streak analysis")
        }
    }

    private var situationalSection: some View {
        Section {
            SliderInput(value: intBind(\.homeCourtBoost), label: "Home Court/Field Boost",
                        description: "How much extra weight to give home teams", labels: homeBoostLabels)
            if hasNCAAB {
                ToggleInput(value: optBoolBind(\.upsetAlert), label: "Upset Alert",
                            description: "Flag potential March Madness upsets based on tournament trends")
            }
        } header: {
            Text("Situational Factors")
        } footer: {
            Text("Game situation adjustments")
        }
    }

    // MARK: - Custom insights

    @ViewBuilder
    private var customInsightsSections: some View {
        insightSection("Betting Philosophy", icon: "book.fill",
                       binding: insightBind(\.bettingPhilosophy), maxLength: 500,
                       description: "Describe your overall approach to betting.")
        insightSection("Perceived Edges", icon: "chart.line.uptrend.xyaxis",
                       binding: insightBind(\.perceivedEdges), maxLength: 500,
                       description: "What unique insights or edges do you think you have?")
        insightSection("Situations to Avoid", icon: "xmark.octagon",
                       binding: insightBind(\.avoidSituations), maxLength: 300,
                       description: "What types of games or situations should your agent avoid?")
        insightSection("Target Situations", icon: "target",
                       binding: insightBind(\.targetSituations), maxLength: 300,
                       description: "What types of games or situations should your agent prioritize?")
    }

    @ViewBuilder
    private func insightSection(_ title: String, icon: String, binding: Binding<String>, maxLength: Int, description: String) -> some View {
        let charCount = binding.wrappedValue.count
        let isOverLimit = charCount > maxLength
        let isFilled = !binding.wrappedValue.isEmpty
        Section {
            TextField("Add your notes…", text: binding, axis: .vertical)
                .font(.system(size: 15))
                .lineLimit(3...8)
        } header: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundStyle(isFilled ? Color(hex: 0x00E676) : Color.secondary)
                Text(title).textCase(nil)
                if isFilled {
                    Text("Filled")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .foregroundStyle(Color(hex: 0x00E676))
                        .background(Capsule().fill(Color(hex: 0x00E676).opacity(0.18)))
                }
            }
        } footer: {
            VStack(alignment: .leading, spacing: 2) {
                Text(description).font(.system(size: 12))
                HStack {
                    Spacer()
                    Text("\(charCount)/\(maxLength)")
                        .font(.system(size: 11))
                        .foregroundStyle(isOverLimit ? Color(hex: 0xEF4444) : Color.secondary)
                }
            }
        }
    }

    // MARK: - Account

    private var autopilotSection: some View {
        Section {
            Toggle(
                "Auto-generate picks",
                isOn: Binding(
                    get: { autoGenerate },
                    set: {
                        if !entitlements.canUseAutopilot && $0 {
                            errorMessage = "Upgrade to Pro to enable autopilot."
                            return
                        }
                        autoGenerate = $0
                        hasChanges = true
                    }
                )
            )
            .tint(Color(hex: 0x00E676))
            .disabled(!entitlements.canUseAutopilot)

            if autoGenerate {
                Button {
                    showTimePicker = true
                } label: {
                    HStack {
                        Text("Preferred time").foregroundStyle(Color.appTextPrimary)
                        Spacer()
                        Text("\(autoGenerateTime) \(AgentSettingsView.tzAbbr(autoGenerateTimezone))")
                            .font(.system(size: 14, design: .monospaced))
                            .foregroundStyle(Color.appPrimary)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
                .buttonStyle(.plain)
            }
        } header: {
            Text("Autopilot")
        } footer: {
            Text(
                entitlements.canUseAutopilot
                ? "When on, the agent will analyze games and generate picks daily."
                : "Pro subscribers get daily auto-generation. Free users can still manually generate."
            )
            .font(.system(size: 11))
        }
    }

    private var visibilitySection: some View {
        Section {
            Toggle(
                "Public agent",
                isOn: Binding(
                    get: { isPublic },
                    set: {
                        if !entitlements.canCreatePublicAgent && $0 {
                            errorMessage = "Only Pro users can make agents public."
                            return
                        }
                        isPublic = $0
                        hasChanges = true
                    }
                )
            )
            .tint(Color(hex: 0x00E676))
            .disabled(!entitlements.canCreatePublicAgent)
        } header: {
            Text("Visibility")
        } footer: {
            Text("Public agents appear on the leaderboard. Pick history and performance become visible.")
                .font(.system(size: 11))
        }
    }

    private var dangerZoneSection: some View {
        Section {
            Button {
                deleteConfirm = true
            } label: {
                Label("Delete Agent", systemImage: "trash")
                    .foregroundStyle(Color.appLoss)
            }
        } header: {
            Text("Danger Zone")
        } footer: {
            Text("Deleting is permanent. Picks and performance history are lost.")
                .font(.system(size: 11))
        }
    }

    // MARK: - Binding helpers (each flips `hasChanges`)

    private func intBind(_ kp: WritableKeyPath<AgentPersonalityParams, Int>) -> Binding<Int> {
        Binding(get: { personality[keyPath: kp] }, set: { personality[keyPath: kp] = $0; hasChanges = true })
    }
    private func optIntBind(_ kp: WritableKeyPath<AgentPersonalityParams, Int?>, _ def: Int) -> Binding<Int> {
        Binding(get: { personality[keyPath: kp] ?? def }, set: { personality[keyPath: kp] = $0; hasChanges = true })
    }
    private func boolBind(_ kp: WritableKeyPath<AgentPersonalityParams, Bool>) -> Binding<Bool> {
        Binding(get: { personality[keyPath: kp] }, set: { personality[keyPath: kp] = $0; hasChanges = true })
    }
    private func optBoolBind(_ kp: WritableKeyPath<AgentPersonalityParams, Bool?>) -> Binding<Bool> {
        Binding(get: { personality[keyPath: kp] ?? false }, set: { personality[keyPath: kp] = $0; hasChanges = true })
    }
    private func oddsBind(_ kp: WritableKeyPath<AgentPersonalityParams, Int?>) -> Binding<Int?> {
        Binding(get: { personality[keyPath: kp] }, set: { personality[keyPath: kp] = $0; hasChanges = true })
    }
    private var betTypeBind: Binding<String> {
        Binding(get: { personality.preferredBetType }, set: { personality.preferredBetType = $0; hasChanges = true })
    }
    private func insightBind(_ kp: WritableKeyPath<AgentCustomInsights, String?>) -> Binding<String> {
        Binding(
            get: { customInsights[keyPath: kp] ?? "" },
            set: { customInsights[keyPath: kp] = $0.isEmpty ? nil : $0; hasChanges = true }
        )
    }

    // MARK: - Load / save

    private func hydrate(from agent: Agent) {
        // Re-hydrate freely until the user touches the form — the fresh fetch
        // must be able to replace a stale initialAgent, but must never clobber
        // in-progress edits.
        guard !hasChanges else { return }
        loadedAgent = agent
        name = agent.name
        emoji = agent.avatarEmoji
        // Resolved pick: the stored override, else the legacy hash-derived
        // character — so the picker highlights what the agent already shows.
        spriteIndex = agent.spriteIndex
        color = agent.avatarColor
        sports = Set(agent.preferredSports)
        personality = agent.personalityParams
        customInsights = agent.customInsights
        autoGenerate = agent.autoGenerate
        autoGenerateTime = agent.autoGenerateTime
        autoGenerateTimezone = agent.autoGenerateTimezone
        isPublic = agent.isPublic
        hasChanges = false
    }

    private func save() async {
        saving = true
        defer { saving = false }
        // Build the payload that mirrors the RN update_agent call.
        let payload: [String: AnyEncodable] = [
            "name": AnyEncodable(name),
            "avatar_emoji": AnyEncodable(emoji),
            "sprite_index": AnyEncodable(spriteIndex),
            "avatar_color": AnyEncodable(color),
            "preferred_sports": AnyEncodable(Array(sports).map { $0.rawValue }),
            "personality_params": AnyEncodable(personality),
            "custom_insights": AnyEncodable(customInsights),
            "auto_generate": AnyEncodable(autoGenerate),
            "auto_generate_time": AnyEncodable(autoGenerateTime),
            "auto_generate_timezone": AnyEncodable(autoGenerateTimezone),
            "is_public": AnyEncodable(isPublic)
        ]
        let succeeded = await store.saveSettings(payload: payload)
        if succeeded {
            hasChanges = false
            dismiss()
        } else {
            errorMessage = store.lastGenerationError ?? "Failed to save settings."
        }
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    private static func tzAbbr(_ tz: String) -> String {
        if tz.contains("New_York") { return "ET" }
        if tz.contains("Chicago") { return "CT" }
        if tz.contains("Denver") { return "MT" }
        if tz.contains("Los_Angeles") { return "PT" }
        return tz
    }
}
