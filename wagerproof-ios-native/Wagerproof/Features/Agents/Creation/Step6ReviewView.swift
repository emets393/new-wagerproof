import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Step 6 of the wizard — summary card, auto-generate toggle + time picker,
/// and the final Create button. Ports
/// `components/agents/creation/Screen6_Review.tsx`.
///
/// Converted to native Form/Section — the custom previewCard, autoGenerateCard,
/// and autoLimitCard helpers are replaced by Sections. All params (autoModeForcedOff,
/// liveAutoAgentsCount, maxLiveAutoAgents, onCreate) and the submit-state spinner
/// are preserved verbatim. The TimePickerModal sheet and autoGenerateBinding
/// (notification-permission request) are also unchanged.
struct Step6ReviewView: View {
    @Bindable var store: AgentCreationStore
    /// Pro-only "auto-slot full" flag. When true, the autopilot toggle is
    /// forced off + disabled (mirrors RN `autoModeForcedOff`).
    let autoModeForcedOff: Bool
    /// How many of the user's existing agents already run live auto. Used to
    /// render the "X/Y live auto agents running" badge.
    let liveAutoAgentsCount: Int
    /// `nil` for admin (unlimited) or non-pro (no cap displayed).
    let maxLiveAutoAgents: Int?
    /// Called when the user taps "Create Agent".
    let onCreate: () -> Void

    @State private var timePickerOpen: Bool = false

    private var archetypeRow: PresetArchetypeRow? {
        guard let id = store.draft.archetype?.rawValue else { return nil }
        return store.archetypeRows.first(where: { $0.id == id })
    }

    var body: some View {
        Form {
            // Preview / summary Section — avatar + name + archetype + sports.
            Section {
                HStack(alignment: .center, spacing: 16) {
                    ZStack {
                        avatarGradient
                            .frame(width: 64, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        PixelSpriteAvatar(spriteIndex: AgentSpriteIndex.forSeed(store.draft.name))
                            .padding(4)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.draft.name.isEmpty ? "Agent Name" : store.draft.name)
                            .font(.system(size: 24, weight: .heavy))
                            .foregroundStyle(Color.appTextPrimary)
                        if let row = archetypeRow {
                            Text(row.name)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color(hex: 0x00E676))
                        }
                    }
                    Spacer()
                }
                .padding(.vertical, 4)

                // Sport badges row.
                if !store.draft.preferredSports.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(store.draft.preferredSports, id: \.self) { sport in
                                sportBadge(sport)
                            }
                        }
                    }
                }
            } header: {
                Text("Agent Summary")
            }

            // Generated description Section.
            Section("This Agent Will…") {
                Text(generatedDescription)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 2)
            }

            // Key traits as individual rows.
            Section("Key Traits") {
                ForEach(personalityTraits, id: \.self) { trait in
                    Label {
                        Text(trait)
                            .font(.system(size: 15))
                            .foregroundStyle(Color.appTextPrimary)
                    } icon: {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color(hex: 0x00E676))
                    }
                }
            }

            // Custom insights indicator (shown only when present).
            if hasCustomInsights {
                Section {
                    Label {
                        Text("Custom insights will personalize this agent's behavior")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.appTextSecondary)
                    } icon: {
                        Image(systemName: "text.badge.checkmark")
                            .foregroundStyle(Color(hex: 0x00E676))
                    }
                }
            }

            // Autopilot Section — native Toggle + conditional time row.
            Section {
                Toggle(isOn: autoGenerateBinding) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Auto-Generate Picks")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("Let this agent automatically generate picks each day based on its settings")
                            .font(.footnote)
                            .foregroundStyle(Color.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .tint(Color(hex: 0x10B981))
                .disabled(autoModeForcedOff)

                // Time picker row — only when autopilot is on and not forced off.
                if store.draft.autoGenerate && !autoModeForcedOff {
                    Button {
                        timePickerOpen = true
                    } label: {
                        HStack {
                            Text("Preferred Time")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            HStack(spacing: 6) {
                                Image(systemName: "clock")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color(hex: 0x00E676))
                                Text("\(store.draft.autoGenerateTime) \(AgentTimezoneOption.abbr(for: store.draft.autoGenerateTimezone))")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                Text("Autopilot")
            } footer: {
                // Entitlement warning when auto-mode slots are full.
                if autoModeForcedOff, let max = maxLiveAutoAgents {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Image(systemName: "bolt.slash")
                                .foregroundStyle(Color(hex: 0xFBBF24))
                            Text("Auto mode is full")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                        }
                        Text("\(liveAutoAgentsCount)/\(max) live auto agents running")
                            .font(.system(size: 16, weight: .heavy))
                            .foregroundStyle(Color.appTextPrimary)
                        Text("This new agent will start in manual mode. Turn off one live auto agent to free up a slot later.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    .padding(.top, 4)
                }
            }

            // Create Agent button — prominent Section button.
            Section {
                Button(action: onCreate) {
                    Group {
                        if case .submitting = store.submitState {
                            HStack(spacing: 10) {
                                ProgressView().tint(.white)
                                Text("Creating Agent...")
                            }
                        } else {
                            Text("Create Agent")
                        }
                    }
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color(hex: 0x00E676))
                    )
                }
                .buttonStyle(.plain)
                .disabled({
                    if case .submitting = store.submitState { return true }
                    return false
                }())
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
            } footer: {
                Text("You can edit your agent's settings at any time after creation.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.secondary)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
        }
        .sheet(isPresented: $timePickerOpen) {
            TimePickerModal(
                isPresented: $timePickerOpen,
                time: $store.draft.autoGenerateTime,
                timezone: $store.draft.autoGenerateTimezone
            )
        }
    }

    // MARK: - Sport badge

    private func sportBadge(_ sport: AgentSport) -> some View {
        let (text, bg, border) = sportBadgeColors(sport)
        return Text(sport.label)
            .font(.system(size: 12, weight: .bold))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .foregroundStyle(text)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(bg)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(border, lineWidth: 1)
            )
    }

    private func sportBadgeColors(_ sport: AgentSport) -> (Color, Color, Color) {
        switch sport {
        case .nfl:
            return (Color(hex: 0x93BBFD), Color(hex: 0x3B82F6).opacity(0.2), Color(hex: 0x3B82F6).opacity(0.4))
        case .cfb:
            return (Color(hex: 0xFCA5A5), Color(hex: 0xEF4444).opacity(0.2), Color(hex: 0xEF4444).opacity(0.4))
        case .nba:
            return (Color(hex: 0x93BBFD), Color(hex: 0x3B82F6).opacity(0.2), Color(hex: 0x3B82F6).opacity(0.4))
        case .ncaab:
            return (Color(hex: 0xFDBA74), Color(hex: 0xF97316).opacity(0.2), Color(hex: 0xF97316).opacity(0.4))
        case .mlb:
            return (Color(hex: 0x6B9FD4), Color(hex: 0x002D72).opacity(0.2), Color(hex: 0x002D72).opacity(0.4))
        }
    }

    // MARK: - Auto-generate binding

    /// Triggers the notification permission prompt when the user turns auto
    /// on for the first time. Mirrors `ensureAutoPickNotificationPermission(user.id)`
    /// in Screen6_Review.tsx:176-181.
    private var autoGenerateBinding: Binding<Bool> {
        Binding(
            get: { store.draft.autoGenerate },
            set: { newValue in
                store.draft.autoGenerate = newValue
                if newValue {
                    Task { _ = await NotificationService.shared.requestPermission() }
                }
            }
        )
    }

    // MARK: - Helpers

    private var avatarGradient: some View {
        gradientView(for: store.draft.avatarColor)
    }

    @ViewBuilder
    private func gradientView(for raw: String) -> some View {
        if raw.hasPrefix("gradient:") {
            let stripped = String(raw.dropFirst("gradient:".count))
            let parts = stripped.split(separator: ",")
            let colors: [Color] = parts.compactMap { Color(hexString: String($0)) }
            if colors.count >= 2 {
                LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            } else if let first = colors.first {
                first
            } else {
                Color(hex: 0x6366F1)
            }
        } else {
            Color(hexString: raw) ?? Color(hex: 0x6366F1)
        }
    }

    private var hasCustomInsights: Bool {
        let i = store.draft.customInsights
        return (i.bettingPhilosophy?.isEmpty == false)
            || (i.perceivedEdges?.isEmpty == false)
            || (i.avoidSituations?.isEmpty == false)
            || (i.targetSituations?.isEmpty == false)
    }

    // MARK: - Generated copy

    private var personalityTraits: [String] {
        let p = store.draft.personalityParams
        var out: [String] = []

        if p.riskTolerance <= 2 {
            out.append("Plays it safe with conservative picks")
        } else if p.riskTolerance >= 4 {
            out.append("Aggressive risk-taker looking for big payouts")
        } else {
            out.append("Balanced approach to risk")
        }

        if p.underdogLean <= 2 {
            out.append("Prefers betting on favorites")
        } else if p.underdogLean >= 4 {
            out.append("Loves hunting for underdog value")
        }

        if p.overUnderLean <= 2 {
            out.append("Tends to bet unders on totals")
        } else if p.overUnderLean >= 4 {
            out.append("Leans towards overs on totals")
        }

        if p.confidenceThreshold >= 4 {
            out.append("Very selective, only picks high-confidence plays")
        } else if p.confidenceThreshold <= 2 {
            out.append("Willing to take smaller edges")
        }

        if p.chaseValue {
            out.append("Seeks positive expected value opportunities")
        }
        if p.trustModel >= 4 {
            out.append("Heavily relies on WagerProof model predictions")
        }
        if p.trustPolymarket >= 4 {
            out.append("Incorporates Polymarket prediction data")
        }
        if p.preferredBetType != "any" {
            // Only the three explicit values produce a trait line; unknown
            // bet-type strings (e.g. future server-added values) are skipped
            // rather than mislabeled.
            let betLabel: String?
            switch p.preferredBetType {
            case "spread": betLabel = "spreads"
            case "moneyline": betLabel = "moneylines"
            case "total": betLabel = "totals"
            default: betLabel = nil
            }
            if let betLabel {
                out.append("Focuses primarily on \(betLabel)")
            }
        }
        return Array(out.prefix(7))
    }

    private var generatedDescription: String {
        let p = store.draft.personalityParams
        // Fallback prevents an awkward "will analyze  games" blank when the
        // user lands on Review without any sport selected (defensive — the
        // wizard's step-1 validation should block this, but rendering must
        // stay safe regardless).
        let sportNames = store.draft.preferredSports.isEmpty
            ? "your selected"
            : store.draft.preferredSports.map { $0.label }.joined(separator: ", ")

        if let row = archetypeRow {
            return "This agent follows the \"\(row.name)\" style and will analyze \(sportNames) games to find betting opportunities that match your preferences."
        }
        let risk: String
        if p.riskTolerance >= 4 { risk = "an aggressive" }
        else if p.riskTolerance <= 2 { risk = "a conservative" }
        else { risk = "a balanced" }

        let focus: String
        if p.underdogLean >= 4 { focus = "underdog hunting" }
        else if p.underdogLean <= 2 { focus = "chalk grinding" }
        else { focus = "value betting" }

        return "This is \(risk) \(focus) agent that will analyze \(sportNames) games. It will generate picks based on your custom settings and preferences."
    }
}
