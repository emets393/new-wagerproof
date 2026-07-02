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
/// glass cards — they render inline under a plain `AgentSectionHeader` (Search
/// style) so the chart and the timeline read as the page's highlights, not boxed-in content:
///   - Picks (inline — the headline section: the `AgentGenerationCard` that
///     morphs from the idle "research" tile into the live polling run, or today's
///     pick cards once generated)
///   - Performance (inline — Apple Charts, Pro-gated)
///   - Recent Activity (inline — `AgentTimeline`, self-hides when empty)
///   - Pick History (manila folder — opens the full rolodex sheet)
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
    @State private var showRegenSheet: Bool = false
    @State private var showAutoPilotSheet: Bool = false
    @State private var errorMessage: String? = nil
    /// Full-screen pick focus/print presentation. `focusStartIndex` non-nil = the
    /// overlay is up; `focusPrintIntro` plays the printer feed + fan-out (used to
    /// reveal freshly generated picks).
    @State private var focusStartIndex: Int? = nil
    @State private var focusPrintIntro: Bool = false
    @State private var lastGenerationResultItems: [AgentBetItem] = []
    /// Easter egg: tapping the hero avatar ripples the pixelwave background.
    @State private var rippleEmitter = GlyphRippleEmitter()

    /// Gap below each top-level section (Picks / Performance / Recent Activity /
    /// Pick History). Wider than `WidgetCard.gap` (12pt, shared by the other
    /// collapsing-widget pages) — this page's sections read as page highlights
    /// rather than a stack of cards, so they need more breathing room between
    /// them than the standard card-to-card gap.
    private let sectionGap: CGFloat = 28

    init(agentId: String, initialAgent: AgentWithPerformance? = nil) {
        self.agentId = agentId
        self.initialAgent = initialAgent
        _store = State(initialValue: AgentDetailStore(agentId: agentId))
    }

    private var entitlements: AgentEntitlementsStore {
        AgentEntitlementsStore(proAccess: proAccess)
    }

    var body: some View {
        CollapsingWidgetScroll(heroMaxHeight: 196, heroMinHeight: 60) { progress in
            AgentPixelWaveBackground(
                avatarColor: agent?.avatarColor ?? "#6366f1",
                progress: progress,
                rippleEmitter: rippleEmitter
            )
        } hero: { progress in
            heroView(progress: progress)
        } content: {
            picksSection
            performanceSection
            recentActivitySection
            pickHistorySlot
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
        // While the pick focus/print overlay is up, hide the whole nav bar (the
        // system back button + the settings gear) so the ONLY control is the
        // overlay's own chevron, which just dismisses the focused view. Otherwise
        // there'd be two competing back buttons.
        .toolbar(focusStartIndex == nil ? .visible : .hidden, for: .navigationBar)
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
        // Re-sync when returning from a pushed screen (Settings saves through
        // its OWN store, so this view's snapshot goes stale after an edit).
        // Guarded so the initial load stays owned by the .task below. Also
        // resumes an in-flight generation run surfaced by the fresh snapshot.
        .onAppear {
            guard store.snapshot != nil else { return }
            Task {
                await store.refreshSnapshot()
                await store.resumeActiveGenerationIfNeeded()
            }
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
            // If a run is in flight (user left mid-run and came back), pick it
            // back up: shows the generating card + polls the SAME run instead
            // of leaving an idle screen that invites a racing re-trigger.
            await store.resumeActiveGenerationIfNeeded()
            // Unseen picks (autopilot / finished-while-away) → printer cinematic.
            maybeAutoplayUnreadPicks()
        }
        .sheet(isPresented: $auditStore.isPresented) {
            if let pick = auditStore.selectedPick {
                AgentPickPayloadAuditSheet(pick: pick, payload: auditStore.payload)
            }
        }
        .sheet(isPresented: $showHistorySheet) {
            PickHistorySheet(
                items: store.fullBetHistory,
                agentName: agent?.name ?? "Agent",
                agentColor: agentTint
            )
        }
        .sheet(isPresented: $showRegenSheet) {
            RegenerateBottomSheet(
                remaining: store.regenerationsRemaining(),
                maxDaily: 3,
                accent: agentTint,
                canRegenerate: canRegenerate,
                onRequest: {
                    showRegenSheet = false
                    Task { await runGeneration() }
                }
            )
        }
        .sheet(isPresented: $showAutoPilotSheet) {
            AutoPilotBottomSheet(
                agentName: agent?.name ?? "This agent",
                accent: agentTint,
                canUseAutopilot: entitlements.canUseAutopilot,
                remaining: store.regenerationsRemaining(),
                maxDaily: 3,
                initialAutoOn: agent?.autoGenerate ?? false,
                initialTime: agent?.autoGenerateTime ?? "09:00",
                initialTimezone: agent?.autoGenerateTimezone ?? "America/New_York",
                recentRuns: recentRuns,
                onSetAuto: { value in await store.setAutoGenerate(value) },
                onSaveTime: { time, tz in await store.setAutoGenerateTime(time, timezone: tz) }
            )
        }
        .overlay {
            if let start = focusStartIndex {
                AgentPickFocusView(
                    items: focusItems,
                    accent: agentTint,
                    startIndex: start,
                    printIntro: focusPrintIntro,
                    onAudit: { pick in auditStore.present(pick: pick) },
                    onClose: { focusStartIndex = nil }
                )
                .transition(.opacity)
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
                isGenerating: store.isGenerating,
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

    /// The headline first section. States, none boxed in a glass card:
    ///   • idle/generating → the `AgentGenerationCard` (one card that morphs the
    ///     research tile → live polling run in place),
    ///   • has picks  → a plain `AgentSectionHeader` + the pick cards + a small
    ///     regenerate / autopilot footer,
    ///   • locked / loading → the locked rail / skeleton.
    @ViewBuilder
    private var picksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // `checklist` (thin line glyph) matches the Performance
            // (`chart.line.uptrend.xyaxis`) and Recent Activity (`clock`) header
            // icons — the old `doc.text.image` was a heavier filled symbol that
            // read darker/busier and broke the shared section-header family.
            AgentSectionHeader(title: "Today's Picks", systemImage: "checklist")

            if !canSeePicks {
                AgentLockedPicksRail(accent: agentTint)
                    .padding(.horizontal, -WidgetCard.hInset)
            } else if case .loading = store.snapshotLoadState, store.todaysPicks.isEmpty {
                AgentTodaysPicksRailSkeleton()
                    .padding(.horizontal, -WidgetCard.hInset)
            } else {
                // Live rail ↔ generation-card swap. The idle rail (has picks) and
                // the generation card (no picks OR generating) crossfade IN PLACE
                // in one top-anchored slot under the fixed section header — no hard
                // component swap / page flash. A ZStack (not if/else in the VStack)
                // so the two states overlap during the dissolve instead of stacking
                // vertically and ballooning the section height.
                ZStack(alignment: .top) {
                    if showsPicksRail {
                        picksRail.transition(.opacity)
                    } else {
                        generationCard.transition(.opacity)
                    }
                }
                // Scoped to THIS slot only (never the outer VStack — that would drag
                // the rail's ScrollView internals into the transaction). The store
                // flips `isGenerating` async inside generatePicks(), off the tap, so
                // `withAnimation` at the tap site can't catch it; an ancestor
                // `.animation(value:)` is the only hook. Keyed on `showsPicksRail`
                // (not `isGenerating`) so only rail↔card crossings animate here —
                // the in-card idle→polling morph stays owned by AgentGenerationCard.
                .animation(.easeInOut(duration: 0.3), value: showsPicksRail)
            }
        }
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, sectionGap)
    }

    /// The single boundary the picks crossfade keys on: the idle rail shows only
    /// when picks exist and no run is in flight; otherwise the generation card owns
    /// the slot (idle-no-picks tile → live polling run).
    private var showsPicksRail: Bool {
        !store.todaysBetItems.isEmpty && !store.isGenerating
    }

    /// Has-picks state: the horizontal rail (date circle + mini tickets), edge-
    /// bleeding past the section's `hInset` so cards scroll under the screen edge,
    /// plus the small regenerate / autopilot footer.
    private var picksRail: some View {
        VStack(alignment: .leading, spacing: 12) {
            AgentTodaysPicksRail(
                items: store.todaysBetItems,
                accent: agentTint,
                onTapPick: { pick in
                    // Tap → large card into focus (print/page presentation). Audit is
                    // reachable from the focused card's "View data audit" button.
                    if let idx = store.todaysBetItems.firstIndex(where: { $0.id == AgentBetItem.pick(pick).id }) {
                        focusPrintIntro = false
                        focusStartIndex = idx
                    }
                },
                onTapParlay: { parlay in
                    // Parlays ride the same focus pager as picks (share included).
                    if let idx = store.todaysBetItems.firstIndex(where: { $0.id == AgentBetItem.parlay(parlay).id }) {
                        focusPrintIntro = false
                        focusStartIndex = idx
                    }
                }
            )
            .padding(.horizontal, -WidgetCard.hInset)
            generateFooter
        }
    }

    /// Idle / generating state: one persistent card for BOTH the idle "control
    /// room" tile and the live run — it morphs research → polling in place (avatar
    /// shrinks to the corner, glyph speeds up + oranges, verbs track the current
    /// tool, tool skeletons stack) driven by `isGenerating`. A no-picks run
    /// surfaces its green console conclusion at the top of the card. Swiping the
    /// pill kicks off the real run.
    private var generationCard: some View {
        AgentGenerationCard(
            spriteIndex: agent?.spriteIndex ?? 0,
            accent: agentTint,
            state: store.liveRunState,
            isGenerating: store.isGenerating,
            canGenerate: canRegenerate,
            lockedLabel: generationLabel,
            conclusion: noPicksConclusion,
            onGenerate: { Task { await runGeneration() } }
        )
    }

    /// Small footer under an existing pick list: the AutoPilot chip (opens the
    /// autopilot sheet) + a Regenerate chip showing the runs left (opens the
    /// regenerate sheet). Both are entry points now — the actual toggle/swipe live
    /// in their sheets. See AgentGenerationControlSheets.swift.
    private var generateFooter: some View {
        HStack(spacing: 10) {
            AutoPilotControlButton(
                isOn: agent?.autoGenerate ?? false,
                accent: agentTint
            ) { showAutoPilotSheet = true }
            Spacer(minLength: 0)
            RegenerateControlButton(
                remaining: store.regenerationsRemaining(),
                accent: agentTint,
                enabled: canRegenerate
            ) { showRegenSheet = true }
        }
        .padding(.top, 2)
    }

    /// The agent's recent runs, derived from its picks (grouped by slate date) +
    /// today's run summary. Deduped across the performance + today's pick sets so
    /// a pick loaded by both paths counts once.
    private var recentRuns: [AgentRunSummaryRow] {
        var seen = Set<String>()
        var merged: [AgentPick] = []
        for pick in store.performancePicks + store.todaysPicks where seen.insert(pick.id).inserted {
            merged.append(pick)
        }
        return AgentRunSummaryRow.derive(
            picks: merged,
            todaysRun: store.todaysGenerationRun,
            todayStr: AgentRunSummaryRow.todayString()
        )
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
            recentItems: canSeePicks ? store.fullBetHistory : [],
            totalCount: store.fullBetHistory.count,
            loading: canSeePicks && isHistoryLoading && store.fullBetHistory.isEmpty,
            locked: !canSeePicks,
            agentColor: agentTint,
            onTap: { showHistorySheet = true }
        )
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, sectionGap)
    }

    private var isHistoryLoading: Bool {
        if case .loading = store.historyLoadState { return true }
        if case .loading = store.performanceLoadState { return true }
        return false
    }

    // MARK: - Performance section

    /// Performance lives inline in the scroll — no Liquid-Glass container — so the
    /// cumulative-units chart reads as the highlight of the page. Just a plain
    /// section header (Search style) over the chart component (which keeps its own
    /// elevated card). The header sits flush at the section's `WidgetCard.hInset`,
    /// lined up with Today's Picks / Recent Activity / Pick History above and below.
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
            } else if isPerformanceSettling {
                // Idle AND first-load both show the chart-shaped skeleton — never
                // the empty-state card or a bare spinner — so the section doesn't
                // flash empty → spinner → chart as performance picks stream in.
                // (The top-level `.task(id:)` is the sole loader; no `.task` here.)
                AgentPerformanceChartSkeleton()
                    .transition(.opacity)
            } else {
                // `showsTitle: false` — the section header above already names it.
                AgentPerformanceCharts(
                    items: store.performancePicks.map(AgentBetItem.pick)
                        + store.performanceParlays.map(AgentBetItem.parlay),
                    preferredSports: store.snapshot?.agent?.preferredSports ?? [],
                    agentColor: agent.map { AgentColorPalette.primary(for: $0.avatarColor) } ?? Color(hex: 0x00E676),
                    showsTitle: false
                )
                .transition(.opacity)
            }
        }
        .padding(.horizontal, WidgetCard.hInset)
        .padding(.bottom, sectionGap)
        // Crossfade skeleton → chart so the handoff reads as one smooth reveal.
        .animation(.easeOut(duration: 0.25), value: isPerformanceSettling)
    }

    /// True while performance picks are doing their FIRST load (idle or loading
    /// with nothing cached). Distinct from "loaded but empty", which hands off to
    /// the chart's own graded-picks empty state rather than the skeleton.
    private var isPerformanceSettling: Bool {
        guard store.performancePicks.isEmpty && store.performanceParlays.isEmpty else { return false }
        switch store.performanceLoadState {
        case .idle, .loading: return true
        case .loaded, .failed: return false
        }
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
                todaysParlays: store.todaysParlays,
                todaysRun: store.todaysGenerationRun
            )
            .padding(.horizontal, WidgetCard.hInset)
            .padding(.bottom, sectionGap)
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
            let fresh = store.todaysBetItems
            if !fresh.isEmpty {
                // Reveal the fresh picks + parlays with the printer feed.
                lastGenerationResultItems = fresh
                focusPrintIntro = true
                focusStartIndex = 0
            }
            markPicksSeen()
        } else if let err = store.lastGenerationError {
            errorMessage = err
        }
    }

    /// Items backing the focus overlay: the just-generated set during the print
    /// reveal, otherwise today's live picks + parlays (tap-to-focus from the rail).
    private var focusItems: [AgentBetItem] {
        focusPrintIntro ? lastGenerationResultItems : store.todaysBetItems
    }

    /// If this agent produced picks the device hasn't seen yet (autopilot ran, or
    /// a manual run finished while the user was elsewhere), open straight into
    /// the printer cinematic — the same reveal a live generation gets.
    private func maybeAutoplayUnreadPicks() {
        guard canSeePicks, focusStartIndex == nil, !store.isGenerating else { return }
        let items = store.todaysBetItems
        guard let newest = items.map(\.createdAt).max(), !newest.isEmpty else {
            markPicksSeen() // no items — still clear the lastGeneratedAt-driven badge
            return
        }
        if AgentPicksSeenStore.hasUnread(agentId: agentId, latestActivity: newest) {
            lastGenerationResultItems = items
            focusPrintIntro = true
            focusStartIndex = 0
        }
        markPicksSeen()
    }

    /// Advance the device-local read receipt past everything currently visible
    /// (newest item + the agent's lastGeneratedAt, whichever is later) so the
    /// agents-list unread dot clears.
    private func markPicksSeen() {
        let newestItem = store.todaysBetItems.map(\.createdAt).max()
        let candidates = [newestItem, agent?.lastGeneratedAt].compactMap { $0 }
        AgentPicksSeenStore.markSeen(agentId: agentId, upTo: candidates.max())
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

    private var errorAlertBinding: Binding<Bool> {
        Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
    }
}

/// Section header for the inline (container-less) detail sections — Today's
/// Picks, Performance, Recent Activity. Matches the Search page's section
/// headers exactly: a small bold leading icon + an uppercased, secondary-color
/// title (footnote weight). Carries no internal horizontal padding, so it sits
/// flush at the section's outer `WidgetCard.hInset` and every header on the
/// page shares one left edge with the content beneath it — the same uniform,
/// low-key section labeling Search uses.
struct AgentSectionHeader: View {
    let title: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 6) {
            // Icon inherits the header's secondary label color so it matches the title.
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .bold))
            Text(title)
                .font(.footnote.weight(.semibold))
                .textCase(.uppercase)
            Spacer(minLength: 8)
        }
        .foregroundStyle(.secondary)
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
