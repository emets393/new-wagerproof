import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Owner agent detail screen. Ports `app/(drawer)/(tabs)/agents/[id]/index.tsx`.
///
/// Styled to match the shared sport detail theme (`MLBGameBottomSheet`): a
/// `CollapsingWidgetScroll` with a collapsing agent aura hero (`AgentGlassHero`)
/// over a stack of Liquid-Glass `WidgetCollapsingSection` cards that pin →
/// collapse under their header → fade out → hand off to the next. A single
/// continuous scroll (no segmented tabs) mirrors the RN source and the rest of
/// the app's detail surfaces.
///
/// Cards (top → bottom):
///   - Autopilot (auto-generate time + autopilot toggle + regenerate status)
///   - Today's Picks (today's picks list + audit/game-card actions + terminal
///     "no picks" conclusion + ThinkingAnimation while generating)
///   - Pick History (collapsible; filter chips + history list)
///   - Performance (Apple Charts, Pro-gated)
///   - Strategy (personality pills + archetype + generation timeline + disclaimer)
///
/// Settings is a toolbar push (gear); the audit modal is a `.sheet`. Chat is no
/// longer surfaced here (the RN detail page has none).
struct AgentDetailView: View {
    let agentId: String
    let initialAgent: AgentWithPerformance?

    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    @State private var store: AgentDetailStore
    @State private var auditStore = AgentPickAuditStore()
    @State private var showHistory: Bool = true
    @State private var loadingPickId: String? = nil
    @State private var errorMessage: String? = nil
    @State private var showPrinterSlip: Bool = false
    @State private var lastGenerationResultPicks: [AgentPick] = []

    init(agentId: String, initialAgent: AgentWithPerformance? = nil) {
        self.agentId = agentId
        self.initialAgent = initialAgent
        _store = State(initialValue: AgentDetailStore(agentId: agentId))
    }

    private var entitlements: AgentEntitlementsStore {
        AgentEntitlementsStore(proAccess: proAccess)
    }

    var body: some View {
        CollapsingWidgetScroll(heroMaxHeight: 244, heroMinHeight: 132) { progress in
            AgentAuraBackground(avatarColor: agent?.avatarColor ?? "#6366f1", progress: progress)
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            autopilotCard
            todaysPicksCard
            pickHistoryCard
            performanceCard
            strategyCard
        }
        .background(Color.appSurface.ignoresSafeArea())
        // Transparent nav bar so the agent aura glows continuously to the top
        // behind the back button (the collapsing hero is opaque and masks the
        // content scrolling under it). Mirrors the MLB sheet.
        .toolbarBackground(.hidden, for: .navigationBar)
        // Hide the app tab bar on the detail page so the collapsing aura hero
        // reads as a full-screen surface (pushed from the Agents tab).
        .toolbar(.hidden, for: .tabBar)
        .navigationTitle(agent?.name ?? "Agent")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    AgentSettingsView(agentId: agentId, initialAgent: store.snapshot?.agent)
                } label: {
                    Image(systemName: "gearshape")
                }
            }
        }
        .refreshable {
            await refresh()
        }
        .task(id: historyReloadKey) {
            if store.snapshot == nil {
                await store.refreshSnapshot()
            }
            if canSeePicks {
                async let history: Void = store.loadHistory(isOwner: isOwnAgent)
                async let performance: Void = store.loadPerformancePicks(isOwner: isOwnAgent)
                _ = await (history, performance)
            }
        }
        .sheet(isPresented: $auditStore.isPresented) {
            if let pick = auditStore.selectedPick {
                AgentPickPayloadAuditSheet(pick: pick, payload: auditStore.payload)
            }
        }
        .overlay {
            if showPrinterSlip, let agent = store.snapshot?.agent {
                PrinterSlipAnimation(
                    visible: showPrinterSlip,
                    picks: lastGenerationResultPicks,
                    agentName: agent.name,
                    agentEmoji: agent.avatarEmoji,
                    spriteIndex: agent.spriteIndex,
                    agentColor: AgentColorPalette.primary(for: agent.avatarColor),
                    sports: agent.preferredSports.map { $0.label },
                    onComplete: { showPrinterSlip = false }
                )
            }
        }
        .alert("Error", isPresented: errorAlertBinding, presenting: errorMessage) { _ in
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: { msg in
            Text(msg)
        }
    }

    // MARK: - Hero

    @ViewBuilder
    private func heroView(progress: CGFloat) -> some View {
        if let agent = agent {
            AgentGlassHero(
                agent: agent,
                performance: store.snapshot?.performance ?? initialAgent?.performance,
                lockedNetUnits: !canSeePicks,
                progress: progress
            )
            .padding(.horizontal, 16)
            .padding(.top, 6)
        } else {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.top, 40)
        }
    }

    // MARK: - Autopilot card

    @ViewBuilder
    private var autopilotCard: some View {
        WidgetCollapsingSection(title: "Autopilot", systemImage: "wand.and.stars", iconTint: Color(hex: 0x00E676)) {
            VStack(alignment: .leading, spacing: 10) {
                if let agent = store.snapshot?.agent, agent.autoGenerate {
                    HStack(spacing: 8) {
                        Image(systemName: "clock")
                        Text("Auto-generates daily at \(agent.autoGenerateTime) \(Self.tzAbbr(agent.autoGenerateTimezone))")
                        Spacer(minLength: 0)
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.appSurfaceMuted.opacity(0.6)))
                }

                HStack {
                    Label("Autopilot", systemImage: "bolt.badge.automatic")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Spacer()
                    Toggle(
                        "",
                        isOn: Binding(
                            get: { store.snapshot?.agent?.autoGenerate ?? false },
                            set: { value in Task { await store.setAutoGenerate(value) } }
                        )
                    )
                    .labelsHidden()
                    .tint(Color(hex: 0x00E676))
                }

                if !store.todaysPicks.isEmpty {
                    regenerateRow
                }
            }
        }
    }

    private var regenerateRow: some View {
        HStack {
            Text(regenerationSummary)
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
            Spacer()
            Button {
                Task { await runGeneration() }
            } label: {
                Label(canRegenerate ? "Regenerate" : "Locked", systemImage: canRegenerate ? "arrow.clockwise" : "lock.fill")
                    .font(.system(size: 12, weight: .heavy))
            }
            .buttonStyle(.bordered)
            .tint(canRegenerate ? Color(hex: 0x00E676) : Color.appBorder)
            .disabled(!canRegenerate || store.isGenerating)
        }
    }

    // MARK: - Today's Picks card

    @ViewBuilder
    private var todaysPicksCard: some View {
        WidgetCollapsingSection(
            title: "Today's Picks",
            systemImage: "doc.text.image",
            iconTint: Color(hex: 0x00E676),
            contentKey: todaysPicksContentKey
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if store.isGenerating {
                    ThinkingAnimation(variant: .generatingPicks)
                }

                if !canSeePicks {
                    lockedPickCardPlaceholder
                    lockedPickCardPlaceholder
                } else if case .loading = store.snapshotLoadState, store.todaysPicks.isEmpty {
                    PickCardSkeleton(); PickCardSkeleton()
                } else if store.todaysPicks.isEmpty {
                    emptyTodaysPicks
                } else {
                    ForEach(Array(store.todaysPicks.enumerated()), id: \.element.id) { index, pick in
                        AgentPickCard(
                            pick: pick,
                            loading: loadingPickId == pick.id,
                            onTap: { auditStore.present(pick: pick) }
                        )
                        .staggeredAppear(index: index)
                    }
                }

                if let runConclusion = noPicksConclusion {
                    terminalConclusion(text: runConclusion)
                }
            }
        }
    }

    // MARK: - Pick History card

    @ViewBuilder
    private var pickHistoryCard: some View {
        WidgetCollapsingSection(
            title: "Pick History",
            systemImage: "clock.arrow.circlepath",
            iconTint: Color.appPrimary,
            accessory: .chevron(expanded: showHistory),
            onHeaderTap: {
                showHistory.toggle()
                if showHistory {
                    Task { await store.loadHistory(isOwner: isOwnAgent) }
                }
            }
        ) {
            if showHistory {
                historyContent
            } else {
                Text("Tap to view this agent's graded pick history")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var historyContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(AgentDetailStore.PickFilter.allCases, id: \.self) { f in
                        Button {
                            store.pickFilter = f
                        } label: {
                            Text(f.label)
                                .font(.system(size: 12, weight: .semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(
                                    Capsule().fill(
                                        store.pickFilter == f
                                            ? Color(hex: 0x00E676).opacity(0.18)
                                            : Color.appBorder.opacity(0.3)
                                    )
                                )
                                .foregroundStyle(
                                    store.pickFilter == f
                                        ? Color(hex: 0x00E676)
                                        : Color.appTextSecondary
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if case .loading = store.historyLoadState, store.pickHistory.isEmpty {
                PickCardSkeleton(); PickCardSkeleton()
            } else if store.filteredPickHistory.isEmpty {
                Text(store.pickFilter == .all ? "No picks in history" : "No \(store.pickFilter.label.lowercased()) picks")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ForEach(Array(store.filteredPickHistory.enumerated()), id: \.element.id) { index, pick in
                    AgentPickItem(
                        pick: pick,
                        showReasoning: .none,
                        onTap: { auditStore.present(pick: pick) }
                    )
                    .staggeredAppear(index: index)
                }
            }
        }
    }

    // MARK: - Performance card

    @ViewBuilder
    private var performanceCard: some View {
        WidgetCollapsingSection(title: "Performance", systemImage: "chart.line.uptrend.xyaxis", iconTint: Color.appPrimary) {
            if !canSeePicks {
                VStack(spacing: 8) {
                    Image(systemName: "lock.fill").font(.system(size: 26))
                        .foregroundStyle(Color.appTextSecondary)
                    Text("Upgrade to view pick charts")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
            } else if case .loading = store.performanceLoadState, store.performancePicks.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 28)
            } else {
                AgentPerformanceCharts(
                    allPicks: store.performancePicks,
                    preferredSports: store.snapshot?.agent?.preferredSports ?? [],
                    agentColor: agent.map { AgentColorPalette.primary(for: $0.avatarColor) } ?? Color(hex: 0x00E676)
                )
                .task {
                    if store.performancePicks.isEmpty {
                        await store.loadPerformancePicks(isOwner: isOwnAgent)
                    }
                }
            }
        }
    }

    // MARK: - Strategy card

    @ViewBuilder
    private var strategyCard: some View {
        if let agent = agent {
            WidgetCollapsingSection(title: "Strategy", systemImage: "slider.horizontal.3", iconTint: Color(hex: 0xA855F7)) {
                VStack(alignment: .leading, spacing: 14) {
                    personalityPills(for: agent, tint: AgentColorPalette.primary(for: agent.avatarColor))

                    if let archetype = agent.archetype {
                        HStack(spacing: 6) {
                            Image(systemName: "person.crop.square.badge.camera")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextSecondary)
                            Text("Archetype: \(archetype.displayName)")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                        }
                    }

                    AgentTimeline(
                        agent: agent,
                        performance: store.snapshot?.performance,
                        todaysPicks: store.todaysPicks,
                        todaysRun: store.todaysGenerationRun
                    )

                    disclaimer
                }
            }
        }
    }

    // MARK: - Shared section bits

    @ViewBuilder
    private func personalityPills(for agent: Agent, tint: Color) -> some View {
        let pills = Self.personalityPills(for: agent.personalityParams)
        if !pills.isEmpty {
            FlowPills(pills: pills, tint: tint)
        }
    }

    private var noPicksConclusion: String? {
        guard let run = store.todaysGenerationRun, run.picksGenerated == 0 else { return nil }
        if run.noGames {
            return "No games were available in this agent's preferred sports today."
        }
        if run.weakSlate {
            return "This agent skipped today because the slate was too weak for its settings."
        }
        return run.slateNote ?? "The agent completed its analysis and passed on the slate."
    }

    private func terminalConclusion(text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("terminal://generation-result")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary)
            HStack(alignment: .top, spacing: 8) {
                Text("›").foregroundStyle(Color(hex: 0x00E676))
                Text("Analysis complete: no high-confidence picks found.")
                    .foregroundStyle(Color(hex: 0x00E676))
            }
            .font(.system(size: 12, design: .monospaced))
            HStack(alignment: .top, spacing: 8) {
                Text("›").foregroundStyle(Color(hex: 0x00E676))
                Text(text)
                    .foregroundStyle(Color.appTextSecondary)
            }
            .font(.system(size: 12, design: .monospaced))
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.appSurfaceMuted.opacity(0.6))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color(hex: 0x00E676).opacity(0.2), lineWidth: 1)
        )
    }

    private var emptyTodaysPicks: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Color.appTextSecondary)
            Text("No picks yet today")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text("Agents study throughout the day. Picks generate overnight when ready.")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)

            Button {
                Task { await runGeneration() }
            } label: {
                Label(generationLabel, systemImage: canRegenerate ? "bolt.fill" : "lock.fill")
                    .font(.system(size: 14, weight: .bold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .tint(canRegenerate ? Color(hex: 0x00E676) : Color.appBorder)
            .disabled(!canRegenerate || store.isGenerating)

            Text(regenerationSummary)
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private var lockedPickCardPlaceholder: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("LOCKED PICK")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(1.5)
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                Image(systemName: "lock.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Text("Upgrade to Pro to view this agent's picks")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appSurfaceMuted)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: - Disclaimer

    private var disclaimer: some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: "info.circle")
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
            Text("AI agents analyze data and perform research — they do not constitute betting advice. Always verify information independently and wager responsibly. Errors may occur.")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextSecondary)
        }
        .opacity(0.7)
    }

    // MARK: - Actions

    private func refresh() async {
        await store.refreshSnapshot()
        if canSeePicks {
            async let history: Void = store.loadHistory(isOwner: isOwnAgent)
            async let performance: Void = store.loadPerformancePicks(isOwner: isOwnAgent)
            _ = await (history, performance)
        }
    }

    private func runGeneration() async {
        let succeeded = await store.generatePicks()
        if succeeded {
            let fresh = store.todaysPicks
            if !fresh.isEmpty {
                lastGenerationResultPicks = fresh
                showPrinterSlip = true
            }
        } else if let err = store.lastGenerationError {
            errorMessage = err
        }
    }

    // MARK: - Derived

    private var agent: Agent? { store.snapshot?.agent ?? initialAgent?.agent }
    private var canViewPicks: Bool { entitlements.canViewAgentPicks }
    /// Owners can always view their own agent's picks/charts (web parity).
    private var isOwnAgent: Bool {
        guard let uid = currentUserId, let ownerId = agent?.userId else { return false }
        return uid == ownerId.lowercased()
    }
    private var canSeePicks: Bool { canViewPicks || isOwnAgent }
    private var historyReloadKey: String {
        "\(agentId)-\(canSeePicks)-\(isOwnAgent)-\(currentUserId ?? "")"
    }
    private var todaysPicksContentKey: String {
        let loading: Bool = {
            if case .loading = store.snapshotLoadState { return true }
            return false
        }()
        return "\(loading)-\(store.todaysPicks.count)-\(store.isGenerating)"
    }
    private var currentUserId: String? {
        if case .authenticated(let userId) = auth.phase {
            return userId.uuidString.lowercased()
        }
        return nil
    }
    private var canRegenerate: Bool {
        guard canViewPicks else { return entitlements.isAdmin }
        return store.regenerationsRemaining() > 0
    }

    private var generationLabel: String {
        if !canViewPicks { return "Generate Picks Locked" }
        if store.regenerationsRemaining() == 0 { return "Daily limit reached" }
        return "Generate Today's Picks"
    }

    private var regenerationSummary: String {
        if entitlements.isAdmin { return "Unlimited manual regenerations available." }
        if !canViewPicks { return "Upgrade to Pro to regenerate this agent's picks." }
        return "\(store.regenerationsRemaining()) of 3 manual regenerations remaining today."
    }

    private var errorAlertBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }

    // MARK: - Personality pill helper

    static func personalityPills(for p: AgentPersonalityParams) -> [String] {
        var pills: [String] = []
        let riskMap = [1: "Very Safe", 2: "Conservative", 4: "Aggressive", 5: "High Risk"]
        if let label = riskMap[p.riskTolerance] { pills.append(label) }
        let bt = p.preferredBetType.lowercased()
        if bt == "spread" { pills.append("Spreads") }
        else if bt == "moneyline" { pills.append("Moneylines") }
        else if bt == "total" { pills.append("Totals") }
        let dogMap = [1: "Chalk Only", 2: "Favors Favorites", 4: "Likes Underdogs", 5: "Underdog Hunter"]
        if let label = dogMap[p.underdogLean] { pills.append(label) }
        if p.chaseValue { pills.append("Value Hunter") }
        if p.fadePublic == true { pills.append("Fades Public") }
        return Array(pills.prefix(5))
    }

    static func tzAbbr(_ tz: String) -> String {
        if tz.contains("New_York") { return "ET" }
        if tz.contains("Chicago") { return "CT" }
        if tz.contains("Denver") { return "MT" }
        if tz.contains("Los_Angeles") { return "PT" }
        return tz
    }
}

/// Wrapping pill row for the personality tags. Uses a simple flow layout so the
/// pills wrap onto a second line when they overflow (the strategy card is full
/// width, unlike the old single-line profile-card row).
struct FlowPills: View {
    let pills: [String]
    let tint: Color

    var body: some View {
        AgentPillFlowLayout(spacing: 6, lineSpacing: 6) {
            ForEach(pills, id: \.self) { pill in
                Text(pill)
                    .font(.system(size: 11, weight: .semibold))
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(tint.opacity(0.15)))
                    .foregroundStyle(tint)
            }
        }
    }
}

/// Minimal flow layout — lays children left-to-right, wrapping to the next line
/// when the row width is exceeded. Used for the wrapping personality pills.
/// (File-private to avoid clashing with the other per-file `FlowLayout` copies.)
private struct AgentPillFlowLayout: Layout {
    var spacing: CGFloat = 6
    var lineSpacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        let maxWidth = bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += lineHeight + lineSpacing
                lineHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

/// Modal sheet wrapper around `AgentPickPayloadAuditWidget`.
struct AgentPickPayloadAuditSheet: View {
    let pick: AgentPick
    let payload: AgentPickAuditPayload

    var body: some View {
        NavigationStack {
            ScrollView {
                AgentPickPayloadAuditWidget(pick: pick, payload: payload)
                    .padding(16)
            }
            .background(Color(hex: 0x0B1011))
            .navigationTitle("Pick Audit")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.large])
    }
}
