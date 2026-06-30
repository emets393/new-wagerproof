import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores
#if canImport(UIKit)
import UIKit
#endif

/// Owner agent detail screen. Ports `app/(drawer)/(tabs)/agents/[id]/index.tsx`.
///
/// Styled to match the shared sport detail theme (`MLBGameBottomSheet`): a
/// `CollapsingWidgetScroll` with a collapsing agent aura hero (`AgentGlassHero`)
/// over a stack of Liquid-Glass `WidgetCollapsingSection` cards that pin →
/// collapse under their header → fade out → hand off to the next. A single
/// continuous scroll (no segmented tabs) mirrors the RN source and the rest of
/// the app's detail surfaces.
///
/// Sections (top → bottom). Performance + Recent Activity are deliberately NOT
/// glass cards — they render inline under a plain `AgentSectionHeader` so the
/// chart and the timeline read as the page's highlights, not boxed-in content:
///   - Picks (inline — the headline section: a generate prompt with a shimmer
///     CTA + tucked autopilot chip, the live `AgentGeneratingView` while a run
///     is in flight, or today's pick cards once generated)
///   - Pick History (manila folder — opens the full rolodex sheet)
///   - Performance (inline — Apple Charts, Pro-gated)
///   - Recent Activity (inline — `AgentTimeline`, self-hides when empty)
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
    @State private var showHistorySheet: Bool = false
    @State private var loadingPickId: String? = nil
    @State private var errorMessage: String? = nil
    @State private var showPrinterSlip: Bool = false
    @State private var lastGenerationResultPicks: [AgentPick] = []
    /// Easter egg: tapping the hero avatar ripples the pixelwave background.
    @State private var rippleEmitter = GlyphRippleEmitter()

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
            AgentPixelWaveBackground(
                avatarColor: agent?.avatarColor ?? "#6366f1",
                progress: progress,
                rippleEmitter: rippleEmitter
            )
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            picksSection
            pickHistorySlot
            performanceSection
            recentActivitySection
        }
        // Commit the page to the always-dark pixelwave aesthetic of the auth
        // gate so the glass cards + text read correctly over the near-black
        // animated field (the opaque pixelwave base covers the full bleed, so no
        // separate appSurface base is needed).
        .preferredColorScheme(.dark)
        // Transparent nav bar so the agent aura glows continuously to the top
        // behind the back button (the collapsing hero is opaque and masks the
        // content scrolling under it). Mirrors the MLB sheet.
        .toolbarBackground(.hidden, for: .navigationBar)
        // Hide the app tab bar on the detail page so the collapsing aura hero
        // reads as a full-screen surface (pushed from the Agents tab).
        .toolbar(.hidden, for: .tabBar)
        // No nav-bar title — the collapsing hero header already shows the agent
        // name, so a toolbar title would just duplicate it.
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    AgentSettingsView(agentId: agentId, initialAgent: store.snapshot?.agent)
                } label: {
                    Image(systemName: "gearshape")
                }
                // White, not the brand-green accent the toolbar tints controls with.
                .tint(.white)
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
        .sheet(isPresented: $showHistorySheet) {
            PickHistorySheet(
                picks: store.fullPickHistory,
                agentName: agent?.name ?? "Agent",
                agentColor: agentTint
            )
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
                progress: progress,
                onAvatarTap: rippleAvatar
            )
            .padding(.horizontal, 16)
            .padding(.top, 6)
        } else {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.top, 40)
        }
    }

    // MARK: - Picks section (container-less)

    /// The headline first section. Three states, none boxed in a glass card:
    ///   • generating → `AgentGeneratingView` (glyph matrix + thinking verbs +
    ///     real progress bar over a dense pixel fill),
    ///   • has picks  → a plain `AgentSectionHeader` + the pick cards + a small
    ///     regenerate / autopilot footer,
    ///   • idle/empty → `AgentGeneratePrompt` (shimmer Generate button, with the
    ///     autopilot toggle tucked into a small chip).
    @ViewBuilder
    private var picksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if store.isGenerating {
                AgentGeneratingView(state: store.liveRunState, accent: agentTint)
            } else if !canSeePicks {
                lockedPickCardPlaceholder
                lockedPickCardPlaceholder
            } else if case .loading = store.snapshotLoadState, store.todaysPicks.isEmpty {
                PickCardSkeleton(); PickCardSkeleton()
            } else if !store.todaysPicks.isEmpty {
                AgentSectionHeader(title: "Today's Picks", systemImage: "doc.text.image")
                ForEach(Array(store.todaysPicks.enumerated()), id: \.element.id) { index, pick in
                    AgentPickCard(
                        pick: pick,
                        loading: loadingPickId == pick.id,
                        onTap: { auditStore.present(pick: pick) }
                    )
                    .staggeredAppear(index: index)
                }
                generateFooter
            } else {
                AgentGeneratePrompt(
                    accent: agentTint,
                    title: "You can generate your picks right now",
                    subtitle: idleSubtitle,
                    autoGenerate: agent?.autoGenerate ?? false,
                    onToggleAuto: { value in Task { await store.setAutoGenerate(value) } },
                    canGenerate: canRegenerate,
                    buttonLabel: generationLabel,
                    onGenerate: { Task { await runGeneration() } }
                )
            }

            if let runConclusion = noPicksConclusion {
                terminalConclusion(text: runConclusion)
            }
        }
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, WidgetCard.gap)
    }

    /// Small footer under an existing pick list: tucked autopilot chip + a
    /// low-emphasis regenerate control (the prominent CTA only shows when there
    /// are no picks yet).
    private var generateFooter: some View {
        HStack(spacing: 10) {
            AutopilotChip(
                isOn: agent?.autoGenerate ?? false,
                accent: agentTint,
                onToggle: { value in Task { await store.setAutoGenerate(value) } }
            )
            Spacer(minLength: 0)
            Button { Task { await runGeneration() } } label: {
                Label(canRegenerate ? "Regenerate" : "Limit reached",
                      systemImage: canRegenerate ? "arrow.clockwise" : "lock.fill")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(canRegenerate ? agentTint : Color.appTextSecondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(canRegenerate ? agentTint.opacity(0.14) : Color.appSurfaceMuted.opacity(0.5)))
                    .overlay(Capsule().strokeBorder(canRegenerate ? agentTint.opacity(0.4) : Color.clear, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(!canRegenerate)
        }
        .padding(.top, 2)
    }

    /// Subtitle under the idle generate prompt: surfaces the autopilot schedule
    /// as the "or wait" alternative, plus the remaining-regenerations note.
    private var idleSubtitle: String {
        if let agent = agent, agent.autoGenerate {
            return "Or wait — autopilot runs daily at \(agent.autoGenerateTime) \(Self.tzAbbr(agent.autoGenerateTimezone)). \(regenerationSummary)"
        }
        return regenerationSummary
    }

    // MARK: - Pick History folder

    /// Replaces the old Pick History list: the agent's recent pick tickets poke
    /// out of a manila folder embossed "PICK HISTORY". Tapping the folder opens
    /// the full rolodex + result/sport/sort filter sheet (`PickHistorySheet`).
    /// Ported from the Orbital Focus Mission Log — see AgentPickTicket.swift and
    /// PickHistoryFolder.swift.
    @ViewBuilder
    private var pickHistorySlot: some View {
        AgentPickFolderCard(
            recentPicks: canSeePicks ? store.fullPickHistory : [],
            totalCount: store.fullPickHistory.count,
            loading: canSeePicks && isHistoryLoading && store.fullPickHistory.isEmpty,
            locked: !canSeePicks,
            agentColor: agentTint,
            onTap: { showHistorySheet = true }
        )
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, WidgetCard.gap)
    }

    private var isHistoryLoading: Bool {
        if case .loading = store.historyLoadState { return true }
        if case .loading = store.performanceLoadState { return true }
        return false
    }

    // MARK: - Performance section

    /// Performance lives inline in the scroll — no Liquid-Glass container — so the
    /// cumulative-units chart reads as the highlight of the page. Just a plain
    /// section header over the chart component (which keeps its own elevated card).
    /// Header indents 16pt past the chart's left edge, mirroring how the cards
    /// above inset their header from their glass surface, so the header column
    /// still lines up with Autopilot / Today's Picks / Pick History.
    @ViewBuilder
    private var performanceSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            AgentSectionHeader(title: "Performance", systemImage: "chart.line.uptrend.xyaxis")

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
                // `showsTitle: false` — the section header above already names it.
                AgentPerformanceCharts(
                    allPicks: store.performancePicks,
                    preferredSports: store.snapshot?.agent?.preferredSports ?? [],
                    agentColor: agent.map { AgentColorPalette.primary(for: $0.avatarColor) } ?? Color(hex: 0x00E676),
                    showsTitle: false
                )
                .task {
                    if store.performancePicks.isEmpty {
                        await store.loadPerformancePicks(isOwner: isOwnAgent)
                    }
                }
            }
        }
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, WidgetCard.gap)
    }

    // MARK: - Recent Activity section

    /// The activity timeline, standing on its own directly under Performance.
    /// `AgentTimeline` renders its own section header and self-hides (EmptyView)
    /// when there are no events, so this whole section disappears for brand-new
    /// agents.
    @ViewBuilder
    private var recentActivitySection: some View {
        if let agent = agent {
            AgentTimeline(
                agent: agent,
                performance: store.snapshot?.performance,
                todaysPicks: store.todaysPicks,
                todaysRun: store.todaysGenerationRun
            )
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.bottom, WidgetCard.gap)
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

    // MARK: - Actions

    /// Easter egg: a tap on the hero avatar fires a glyph ripple from the disc's
    /// global center through the pixelwave background, plus a light haptic.
    private func rippleAvatar(at globalCenter: CGPoint) {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
        rippleEmitter.emit(at: globalCenter)
    }

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
    /// Agent brand tint for the pick tickets + folder (matches the perf chart).
    private var agentTint: Color {
        agent.map { AgentColorPalette.primary(for: $0.avatarColor) } ?? Color(hex: 0x00E676)
    }
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

    static func tzAbbr(_ tz: String) -> String {
        if tz.contains("New_York") { return "ET" }
        if tz.contains("Chicago") { return "CT" }
        if tz.contains("Denver") { return "MT" }
        if tz.contains("Los_Angeles") { return "PT" }
        return tz
    }
}

/// Plain section header for the inline (container-less) detail sections —
/// Performance and Recent Activity. Mirrors the `WidgetCollapsingSection` header
/// style (uppercase, translucent, leading icon) so the inline sections read as
/// peers of the Liquid-Glass cards above them, just without the glass body.
/// The 16pt horizontal padding matches the card header inset, so the header
/// column stays aligned across both the cards and these inline sections.
struct AgentSectionHeader: View {
    let title: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
            Text(title.uppercased())
                .font(.system(size: 13, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextSecondary)
            Spacer(minLength: 8)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
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
