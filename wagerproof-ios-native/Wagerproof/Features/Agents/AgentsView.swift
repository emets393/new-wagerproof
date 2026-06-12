import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Sort orders for the My Agents list, surfaced by the liquid-glass sort pill
/// above it.
private enum AgentSortOption: String, CaseIterable {
    case winRate, units, streak, name, newest

    var label: String {
        switch self {
        case .winRate: return "Win %"
        case .units: return "Units"
        case .streak: return "Streak"
        case .name: return "Name"
        case .newest: return "Newest"
        }
    }

    var icon: String {
        switch self {
        case .winRate: return "percent"
        case .units: return "dollarsign.circle"
        case .streak: return "flame"
        case .name: return "textformat"
        case .newest: return "clock"
        }
    }
}

/// Agents tab landing view. Ports the RN `AgentsHubScreen` at
/// `app/(drawer)/(tabs)/agents/index.tsx`.
///
/// Layout (mirrors the RN inner-tab variant — RN's flat hub is split here into
/// an iOS-idiomatic `Picker(.segmented)`):
///   - `NavigationStack` rooted in the tab cell
///   - Title row "Wager**Proof** Agents" (matches `headerTop` brand pill)
///   - Inner-tab `Picker(.segmented)` — My Agents / Leaderboard / Top Picks
///   - Branch body:
///       * `.myAgents`  → 2-up `LazyVGrid` of `AgentIdCard`, empty state, or skeleton
///       * `.leaderboard` → `AgentLeaderboardView`
///       * `.topPicks` → list of `TopPickRow` (RPC `get_top_agent_picks_feed_v2`)
///   - Floating "+" FAB on the My Agents branch (or lock chip when limit hit)
///   - Long-press on an AgentIdCard → confirmation dialog (Settings / Autopilot
///     toggle / Delete) — matches RN `ActionSheetIOS.showActionSheetWithOptions`.
///
/// **PixelOffice + CompanyDashboardBanner**: The RN hub embeds two hero
/// surfaces above the agent grid — the pixel-office SKScene
/// (`PixelOffice` here, ported as SpriteKit) and the agency-wide stats
/// rollup (`CompanyDashboardBanner`). Both are wired on the My Agents
/// branch once the agent list has loaded. PixelOffice now runs the full
/// walk/pathfind/state-churn simulation (FIDELITY-WAIVER #082 resolved).
///
/// **Integration history**:
/// - B14 wired `.createAgent` → real `AgentCreationView` wizard.
/// - B15 wired `.agentDetail` → real `AgentDetailView` and
///   `.publicAgentDetail` → real `PublicAgentDetailView` (via
///   `AgentsRouterB15` factory). Resolved waiver #072.
/// - B16 wired the Top Picks branch to `TopAgentPicksFeedContainer` (with
///   filter modes + favorites + search). Resolved waiver #070.
struct AgentsView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(MainTabStore.self) private var tabStore
    // Re-injected explicitly into the Settings navigationDestination so iOS 18+
    // configurePreferredTransition can resolve them before the nav environment
    // chain is established. See MainTabToolbar.wagerProofSettingsDestination.
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    @State private var store: AgentsStore
    @State private var pendingDeleteId: String?
    @State private var pendingLongPressAgent: AgentWithPerformance?
    @State private var navPath = NavigationPath()
    /// Vertical scroll offset of the agent list, used to drive the collapsing
    /// pixel-office hero header.
    @State private var scrollY: CGFloat = 0
    /// Which screen corner the collapsed floating office is docked to (the user
    /// can drag it between corners while collapsed).
    @State private var officeCorner: OfficeCorner = .topTrailing
    /// Sort order for the agent list (driven by the sort pill above the list).
    @State private var sortOption: AgentSortOption = .winRate
    /// Mirrors the office's persisted day/night toggle so the relocated
    /// "Agent HQ — Live" pill reads the same Live/Night status.
    @AppStorage("pixel-office-time-mode") private var officeTimeMode: String = "auto"
    /// Locally-pinned agent ids (comma-joined UUIDs) — pinned agents sort to the
    /// top of the list regardless of the chosen sort. Local-only preference.
    @AppStorage("agents-pinned-ids") private var pinnedIdsRaw: String = ""
    /// Shown when the user tries to activate a 9th agent (8-active cap).
    @State private var activeCapAlert = false

    init() {
        _store = State(initialValue: AgentsStore())
    }

    /// DEBUG-only forced collapse progress (`-agentsCollapse <0..1>`), so the
    /// scroll-driven header's end-states can be captured without a live swipe.
    private var debugCollapseOverride: CGFloat? {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-agentsCollapse"), i + 1 < args.count, let v = Double(args[i + 1]) {
            return CGFloat(min(max(v, 0), 1))
        }
        #endif
        return nil
    }

    #if DEBUG
    init(store: AgentsStore) {
        _store = State(initialValue: store)
    }
    #endif

    /// `AgentEntitlementsStore` is a thin facade over `ProAccessStore` from
    /// the environment. We rebuild it per-render so entitlement changes
    /// propagate without needing a separate store lifecycle. SwiftUI's
    /// observation tracking still fires correctly because the underlying
    /// `proAccess.isPro` / `isAdmin` are observed via the env.
    private var entitlements: AgentEntitlementsStore {
        AgentEntitlementsStore(proAccess: proAccess)
    }

    var body: some View {
        @Bindable var binding = store
        NavigationStack(path: $navPath) {
            // The populated branch uses a custom collapsing hero: the pixel
            // office shrinks into the top-right corner as the user scrolls,
            // the agency stats slide into the freed space, and the agent list
            // scrolls underneath (see `collapsingPopulatedBody`). Large title
            // mode gives the tab a prominent "Agents" heading that matches the
            // other main tabs (Games / Props / Outliers).
            myAgentsContent
            .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Agents")
                .navigationBarTitleDisplayMode(.large)
                // Per-tab `.searchable()` removed — search lives in the
                // dedicated `Tab(role: .search)` slot now.
                // Inner-tab picker (My Agents / Leaderboard / Top Picks)
                // removed — Leaderboard + Top Picks live in the Outliers
                // tab. AgentsView is now the My Agents surface only.
                .toolbar {
                    // Top-leading WagerProof wordmark (shared across main tabs);
                    // passive brand mark — Settings now lives on the trailing gear.
                    WagerProofLeadingToolbarItem()
                    // Trailing group (left → right): create-agent (+), WagerBot,
                    // then the Settings gear pinned rightmost. The "+" replaces
                    // the old floating action button so all chrome lives in the
                    // top bar; it locks when the agent limit is hit (mirrors the
                    // old FAB's lock chip).
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        createAgentToolbarButton
                        WagerBotToolbarButton(tabStore: tabStore)
                        SettingsToolbarButton(tabStore: tabStore)
                    }
                }
                .navigationDestination(for: AgentsRoute.self) { route in
                    routeDestination(route)
                }
                // Settings pushes onto this stack (tapping the trailing gear) instead
                // of covering the screen as a modal — see MainTabToolbar.swift.
                .wagerProofSettingsDestination(tabStore: tabStore, tab: .agents, auth: auth, settingsStore: settingsStore, revenueCat: revenueCat, adminMode: adminMode, proAccess: proAccess)
                .wagerProofChatDestination(tabStore: tabStore, tab: .agents)
                .task {
                    // Bind the active user and trigger the first refresh.
                    store.bind(userId: currentUserId)
                    if case .idle = store.loadState {
                        await store.refresh()
                    }
                }
                .onChange(of: currentUserId) { _, newId in
                    store.bind(userId: newId)
                    Task { await store.refresh() }
                }
                .refreshable {
                    await refreshActive()
                }
                .confirmationDialog(
                    pendingLongPressAgent?.agent.name ?? "Agent",
                    isPresented: longPressSheetBinding,
                    titleVisibility: .visible
                ) {
                    if let agent = pendingLongPressAgent {
                        longPressActions(for: agent)
                    }
                }
                // Swipe / long-press "Delete" → confirm before removing.
                .alert("Delete agent?", isPresented: deleteAlertBinding, presenting: pendingDeleteName) { _ in
                    Button("Delete", role: .destructive) {
                        if let id = pendingDeleteId { performDelete(id) }
                    }
                    Button("Cancel", role: .cancel) { pendingDeleteId = nil }
                } message: { name in
                    Text("“\(name)” and its picks will be permanently removed. This can't be undone.")
                }
                // 8-active cap reached when trying to activate another agent.
                .alert("Active limit reached", isPresented: $activeCapAlert) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text("You can have up to \(AgentEntitlementsStore.maxConcurrentActiveAgents) agents active at once. Pause one to activate another.")
                }
        }
        // Push the facade entitlements store into the env so the leaderboard
        // child can read it via @Environment(AgentEntitlementsStore.self).
        .environment(entitlements)
    }

    // MARK: - My Agents content

    @ViewBuilder
    private var myAgentsContent: some View {
        switch store.loadState {
        case .idle, .loading:
            if store.agents.isEmpty {
                ScrollView { myAgentsSkeleton }
            } else {
                collapsingPopulatedBody
            }
        case .loaded:
            if store.agents.isEmpty {
                ScrollView { emptyState }
            } else {
                collapsingPopulatedBody
            }
        case .failed(let msg):
            ScrollView {
                ContentUnavailableView {
                    Label("Couldn't load agents", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(msg)
                } actions: {
                    Button {
                        Task { await store.refresh() }
                    } label: {
                        Label("Retry", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(hex: 0x00E676))
                }
            }
        }
    }

    /// Populated hub: the agent list scrolls full-screen beneath a scroll-driven
    /// floating pixel-office widget. At the top the office fills the page above
    /// the list; as the user scrolls it shrinks into a small draggable minimap
    /// (`FloatingOfficeWidget`) pinned to a screen corner with the agency stats
    /// as a liquid-glass pill over it. A constant top spacer = `expandedHeight`
    /// (the full collapse distance) means the list reaches the top of the screen
    /// exactly as the office finishes collapsing — no reserved header bar.
    @ViewBuilder
    private var collapsingPopulatedBody: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let progress = debugCollapseOverride
                ?? min(1, max(0, scrollY / AgentsHeaderMetrics.collapseDistance(width)))
            ZStack(alignment: .topLeading) {
                agentsList(width: width)
                    .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { _, y in
                        scrollY = max(0, y)
                    }

                // Floating office. It only intercepts touches once collapsed
                // (so it's draggable), passing scroll drags through otherwise.
                FloatingOfficeWidget(
                    agents: store.agents,
                    progress: progress,
                    width: width,
                    height: geo.size.height,
                    corner: $officeCorner
                )
            }
        }
    }

    /// Single-column agent feed rendered as a `List` so rows get NATIVE swipe
    /// actions — leading: activate/pause, pin, edit, details; trailing: delete.
    /// A clear header row reserves the office's `expandedHeight`, so the scroll-
    /// driven collapse still works (the office is a sibling overlay; `scrollY`
    /// comes from `onScrollGeometryChange`). All List chrome (separators, row
    /// backgrounds, default insets) is stripped so the cards read identically to
    /// the old VStack feed; `listRowSpacing(10)` restores the 10pt gaps.
    private func agentsList(width: CGFloat) -> some View {
        List {
            // Office spacer — reserves the collapsing hero's vertical space.
            Color.clear
                .frame(height: AgentsHeaderMetrics.expandedHeight(width))
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

            sortRow
                .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

            ForEach(Array(sortedAgents.enumerated()), id: \.element.id) { index, agent in
                AgentRowCard(
                    agent: agent,
                    onTap: { navPath.append(AgentsRoute.agentDetail(agentId: agent.id)) },
                    onLongPress: { pendingLongPressAgent = agent }
                )
                // Cascade each card in when it replaces the loading shimmer.
                .staggeredAppear(index: index)
                .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .swipeActions(edge: .leading, allowsFullSwipe: false) {
                    ForEach(leadingSwipeActions(for: agent)) { a in
                        Button { a.action() } label: {
                            Label(a.title, systemImage: a.systemImage)
                        }
                        .tint(a.tint)
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    ForEach(trailingSwipeActions(for: agent)) { a in
                        Button(role: .destructive) { a.action() } label: {
                            Label(a.title, systemImage: a.systemImage)
                        }
                        .tint(a.tint)
                    }
                }
            }

            // Bottom clearance for the floating tab bar.
            Color.clear
                .frame(height: 96)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
        .listStyle(.plain)
        .listRowSpacing(10)
        .scrollContentBackground(.hidden)
        .contentMargins(.top, 0, for: .scrollContent)
        .environment(\.defaultMinListRowHeight, 1)
        // Slide cards into place when the sort order (or pin set) changes.
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: sortOption)
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: pinnedIdsRaw)
    }

    // MARK: - Sort row (relocated Agent HQ status + sort control)

    /// Row just above the list: the "Agent HQ — Live" status pill (moved out of
    /// the office HUD) on the left, and a liquid-glass sort control on the right.
    private var sortRow: some View {
        HStack(spacing: 8) {
            agentHQStatusPill
            Spacer(minLength: 8)
            sortByMenu
        }
        .padding(.bottom, 2)
    }

    /// Day/night resolution mirroring `PixelOffice` so the pill matches the
    /// office's "Live / Night Shift" state.
    private var officeIsNight: Bool {
        switch officeTimeMode {
        case "day": return false
        case "night": return true
        default:
            let hour = Calendar.current.component(.hour, from: Date())
            return hour >= 19 || hour < 6
        }
    }

    private var agentHQStatusPill: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(Color(hex: 0x22C55E))
                .frame(width: 6, height: 6)
            Text("Agent HQ — \(officeIsNight ? "Night Shift" : "Live")")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.3)
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .liquidGlassBackground(in: Capsule())
        .overlay(Capsule().strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5))
    }

    private var sortByMenu: some View {
        Menu {
            Picker("Sort by", selection: $sortOption) {
                ForEach(AgentSortOption.allCases, id: \.self) { opt in
                    Label(opt.label, systemImage: opt.icon).tag(opt)
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.system(size: 10, weight: .bold))
                Text(sortOption.label)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(Color.appTextPrimary)
            .padding(.horizontal, 11)
            .padding(.vertical, 6)
            .liquidGlassBackground(in: Capsule())
            .overlay(Capsule().strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5))
        }
    }

    /// `store.agents` ordered by the selected sort, with pinned agents floated to
    /// the top (preserving the chosen order within each group). Agents with no
    /// settled record sort last on the performance-based orders.
    private var sortedAgents: [AgentWithPerformance] {
        let base: [AgentWithPerformance]
        switch sortOption {
        case .winRate:
            base = store.agents.sorted { listWinPct($0) > listWinPct($1) }
        case .units:
            base = store.agents.sorted { ($0.performance?.netUnits ?? 0) > ($1.performance?.netUnits ?? 0) }
        case .streak:
            base = store.agents.sorted { ($0.performance?.currentStreak ?? 0) > ($1.performance?.currentStreak ?? 0) }
        case .name:
            base = store.agents.sorted { $0.agent.name.localizedCaseInsensitiveCompare($1.agent.name) == .orderedAscending }
        case .newest:
            base = store.agents.sorted { $0.agent.createdAt > $1.agent.createdAt }
        }
        let pins = pinnedIds
        guard !pins.isEmpty else { return base }
        // Stable partition (filter preserves order) → pinned first.
        return base.filter { pins.contains($0.agent.id) } + base.filter { !pins.contains($0.agent.id) }
    }

    private func listWinPct(_ x: AgentWithPerformance) -> Double {
        guard let p = x.performance else { return -1 }
        let settled = p.wins + p.losses
        guard settled > 0 else { return -1 }
        return Double(p.wins) / Double(settled)
    }

    // MARK: - Pinning

    private var pinnedIds: Set<String> {
        Set(pinnedIdsRaw.split(separator: ",").map(String.init))
    }

    private func togglePin(_ id: String) {
        var s = pinnedIds
        if s.contains(id) { s.remove(id) } else { s.insert(id) }
        pinnedIdsRaw = s.sorted().joined(separator: ",")
    }

    // MARK: - Swipe actions

    /// Left→right swipe actions: toggle active, pin, edit, view details.
    private func leadingSwipeActions(for row: AgentWithPerformance) -> [RowSwipeAction] {
        let a = row.agent
        let isPinned = pinnedIds.contains(a.id)
        return [
            RowSwipeAction(
                id: "active",
                title: a.isActive ? "Pause" : "Activate",
                systemImage: a.isActive ? "pause.circle.fill" : "play.circle.fill",
                tint: a.isActive ? Color(hex: 0xF97316) : Color.appWin
            ) { toggleActive(row) },
            RowSwipeAction(
                id: "pin",
                title: isPinned ? "Unpin" : "Pin",
                systemImage: isPinned ? "pin.slash.fill" : "pin.fill",
                tint: Color(hex: 0xEAB308)
            ) { togglePin(a.id) },
            RowSwipeAction(
                id: "edit",
                title: "Edit",
                systemImage: "slider.horizontal.3",
                tint: Color.appAccentBlue
            ) { navPath.append(AgentsRoute.editAgent(agentId: a.id)) },
            RowSwipeAction(
                id: "details",
                title: "Details",
                systemImage: "info.circle.fill",
                tint: Color(hex: 0x6366F1)
            ) { navPath.append(AgentsRoute.agentDetail(agentId: a.id)) },
        ]
    }

    /// Right→left swipe action: delete.
    private func trailingSwipeActions(for row: AgentWithPerformance) -> [RowSwipeAction] {
        [
            RowSwipeAction(
                id: "delete",
                title: "Delete",
                systemImage: "trash.fill",
                tint: Color.appLoss
            ) { pendingDeleteId = row.id }
        ]
    }

    /// Enforce the 8-active cap on activation; deactivation is always allowed.
    private func toggleActive(_ row: AgentWithPerformance) {
        let willActivate = !row.agent.isActive
        if willActivate && store.activeCount >= AgentEntitlementsStore.maxConcurrentActiveAgents {
            activeCapAlert = true
            return
        }
        Task { _ = await store.setActive(agentId: row.id, isActive: willActivate) }
    }

    private func performDelete(_ id: String) {
        pendingDeleteId = nil
        Task { _ = await store.delete(agentId: id) }
    }

    private var deleteAlertBinding: Binding<Bool> {
        Binding(get: { pendingDeleteId != nil }, set: { if !$0 { pendingDeleteId = nil } })
    }

    private var pendingDeleteName: String? {
        guard let id = pendingDeleteId else { return nil }
        return store.agents.first { $0.id == id }?.agent.name
    }

    private var myAgentsSkeleton: some View {
        LazyVStack(spacing: 10) {
            ForEach(0..<4, id: \.self) { _ in
                AgentRowCardShimmer()
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, Spacing.sm)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        // Inner ScrollView removed — outer body ScrollView owns scrolling.
        VStack(spacing: 16) {
            Text("Your AI Picks Expert")
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
            Text("Build a virtual analyst that thinks the way you bet.")
                .font(.system(size: 15))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.md)

            journeyStep(icon: "slider.horizontal.3", title: "Build Your Strategy", desc: "Choose risk level, bet types, and sports. Pick a preset archetype or go fully custom.")
            journeyStep(icon: "brain.head.profile", title: "AI Analyzes Every Game", desc: "Your agent scans today's slate using WagerProof model data, odds, and market signals.")
            journeyStep(icon: "bolt.fill", title: "Get Daily Picks", desc: "Picks generate automatically each morning with reasoning and confidence levels.")

            Button {
                navPath.append(AgentsRoute.createAgent)
            } label: {
                Label("Create Your First Agent", systemImage: "plus")
                    .font(.system(size: 16, weight: .bold))
                    .padding(.vertical, 12)
                    .padding(.horizontal, 24)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(hex: 0x00E676))
            .padding(.top, Spacing.lg)
        }
        .padding(.horizontal, Spacing.xl)
        .padding(.top, Spacing.xxl)
        .padding(.bottom, Spacing.xxl)
    }

    private func journeyStep(icon: String, title: String, desc: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color(hex: 0x00E676).opacity(0.1))
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color(hex: 0x00E676))
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.appBorder.opacity(0.25))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color(hex: 0x00E676).opacity(0.12), lineWidth: 1)
        )
    }

    // Top Picks + Leaderboard branches removed — those surfaces live in the
    // Outliers tab now. The container types still exist in
    // `Features/Agents/...` and `WagerproofStores/...` for Outliers' use.

    // MARK: - Create-agent toolbar button

    /// Top-bar "+" that replaces the old floating action button. Navigates to
    /// the creation wizard when the user can still add an agent; otherwise it
    /// renders a disabled lock glyph (the entitlement limit was hit) — the
    /// toolbar equivalent of the old FAB's "Agent limit reached" chip.
    @ViewBuilder
    private var createAgentToolbarButton: some View {
        let canCreate = entitlements.canCreateAnotherAgent(activeCount: store.activeCount, totalCount: store.totalCount)
        if canCreate {
            Button {
                navPath.append(AgentsRoute.createAgent)
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .semibold))
            }
            .tint(Color.appTextPrimary)
            .accessibilityLabel("Create new agent")
            .sensoryFeedback(.impact(weight: .medium), trigger: navPath.count)
        } else {
            Button {} label: {
                Image(systemName: "lock.fill")
                    .font(.system(size: 15, weight: .semibold))
            }
            .tint(Color.appTextSecondary)
            .disabled(true)
            .accessibilityLabel("Agent limit reached")
        }
    }

    // MARK: - Long-press menu

    private var longPressSheetBinding: Binding<Bool> {
        Binding(
            get: { pendingLongPressAgent != nil },
            set: { if !$0 { pendingLongPressAgent = nil } }
        )
    }

    @ViewBuilder
    private func longPressActions(for agent: AgentWithPerformance) -> some View {
        Button("Settings") {
            navPath.append(AgentsRoute.agentDetail(agentId: agent.id))
            pendingLongPressAgent = nil
        }
        Button(agent.agent.autoGenerate ? "Turn Autopilot Off" : "Turn Autopilot On") {
            Task { await store.setAutoGenerate(agentId: agent.id, autoGenerate: !agent.agent.autoGenerate) }
            pendingLongPressAgent = nil
        }
        Button("Delete Agent", role: .destructive) {
            pendingDeleteId = agent.id
            pendingLongPressAgent = nil
        }
        Button("Cancel", role: .cancel) {
            pendingLongPressAgent = nil
        }
    }

    // MARK: - Route destinations

    @ViewBuilder
    private func routeDestination(_ route: AgentsRoute) -> some View {
        switch route {
        case .agentDetail(let id):
            // B15 — real owner detail. Prefetch the row from `AgentsStore` if
            // we already have it so the header paints before the snapshot
            // resolves (matches RN's instant-paint behavior).
            AgentsRouterB15.ownerDetail(
                agentId: id,
                prefetched: store.agents.first { $0.id == id }
            )
        case .createAgent:
            // B14 — real wizard. Reads `AgentsStore` + `AgentEntitlementsStore`
            // from env; both already injected on the parent NavigationStack.
            AgentCreationView()
                .environment(store)
                .environment(entitlements)
        case .publicAgentDetail(let id):
            // B15 — real public read-only detail w/ follow CTA.
            AgentsRouterB15.publicDetail(agentId: id)
        case .editAgent(let id):
            // Swipe "Edit" → straight into the agent's editor. It owns its own
            // AgentDetailStore and reads ProAccessStore from the env (already
            // present), so no extra injection is needed.
            AgentSettingsView(
                agentId: id,
                initialAgent: store.agents.first { $0.id == id }?.agent
            )
        }
    }

    // MARK: - Helpers

    private var currentUserId: String? {
        if case .authenticated(let userId) = auth.phase {
            return userId.uuidString.lowercased()
        }
        return nil
    }

    private func refreshActive() async {
        await store.refresh()
    }
}

// MARK: - My Agents row shimmer

/// Skeleton placeholder for `AgentRowCard`, shown while the first agents fetch
/// is in flight. Reproduces the real card's chrome exactly (26pt continuous
/// Liquid-Glass surface, 0.5pt appBorder hairline, soft shadow, dark-mode
/// thinned material) and lays Skeleton* primitives where the avatar / name /
/// strategy chips / form-chart bars / sport pills / record land, so the
/// crossfade to loaded `AgentRowCard`s never shifts the layout.
///
/// The inner placeholder group carries the unified `.shimmering()` sweep; the
/// card chrome stays solid (applied via `.background` *after* the shimmer).
private struct AgentRowCardShimmer: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        content
            .padding(.horizontal, 14)
            .padding(.top, 12)
            .padding(.bottom, 9)
            .shimmering()
            .background {
                ZStack {
                    // Match AgentRowCard: thin the material in dark mode.
                    shape.fill(.ultraThinMaterial)
                        .opacity(colorScheme == .dark ? 0.55 : 1)
                    shape.strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
                }
            }
            .clipShape(shape)
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    private var content: some View {
        VStack(spacing: 6) {
            // Identity row: rounded-square avatar, name + chips, form chart.
            HStack(spacing: 12) {
                SkeletonBlock(width: 52, height: 52, cornerRadius: 14)
                VStack(alignment: .leading, spacing: 8) {
                    SkeletonBlock(width: 120, height: 14)
                    HStack(spacing: 6) {
                        SkeletonCapsule(width: 56, height: 16)
                        SkeletonCapsule(width: 44, height: 16)
                    }
                }
                Spacer(minLength: 8)
                // Form chart column: streak badge over stacked W/L bars.
                VStack(alignment: .trailing, spacing: 5) {
                    SkeletonCapsule(width: 58, height: 16)
                    HStack(alignment: .bottom, spacing: 3) {
                        ForEach(0..<6, id: \.self) { i in
                            SkeletonBlock(
                                width: 8,
                                height: [14, 22, 10, 26, 18, 12][i],
                                cornerRadius: 2
                            )
                        }
                    }
                    .frame(height: 28, alignment: .bottom)
                }
                .frame(width: 96)
            }
            Divider().background(Color.appBorder.opacity(0.5))
            // Bottom info row: sport pills on the left, record on the right.
            HStack(spacing: 4) {
                SkeletonCapsule(width: 40, height: 18)
                SkeletonCapsule(width: 40, height: 18)
                Spacer(minLength: 8)
                SkeletonBlock(width: 88, height: 12)
            }
        }
    }
}

#Preview("AgentsView") {
    AgentsView()
        .environment(AuthStore())
        .environment(ProAccessStore(revenueCat: RevenueCatStore(), adminMode: AdminModeStore()))
}
