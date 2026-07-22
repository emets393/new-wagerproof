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

/// Inner-tab sections of the Agents hub, surfaced by the pinned segmented
/// `Picker` below the "Agents" title. Mirrors the RN `AgentsHubScreen` tabs.
private enum AgentsTab: String, CaseIterable {
    case myAgents, leaderboard, topPicks

    var label: String {
        switch self {
        case .myAgents: return "My Agents"
        case .leaderboard: return "Leaderboard"
        case .topPicks: return "Top Picks"
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
///   - Large collapsing "Agents" title (matches Games/Props/Outliers)
///   - Inner-tab picker — My Agents / Leaderboard / Top Picks — with a
///     contextual filter menu on its right (see `tabPicker` / `filterMenu`).
///     It is NOT a toolbar bar (a frosted inset there covers the large title):
///     My Agents renders it as a pinned `List` section header; the other two
///     ride a surface-styled `.safeAreaInset`. The branch switch lives in
///     `tabbedContent`.
///   - Branch body:
///       * `.myAgents`  → pixel-office hero row + single-column `List` of
///         `AgentRowCard`, empty state, or skeleton
///       * `.leaderboard` → `AgentLeaderboardView` (rows route to public detail)
///       * `.topPicks` → `TopAgentPicksFeed` (RPC `get_top_agent_picks_feed_v2`;
///         rows/picks route to public detail)
///   - Create-agent "+" in the top bar (or lock glyph when the limit is hit)
///   - Long-press on an AgentRowCard → confirmation dialog (Settings / Autopilot
///     toggle / Delete) — matches RN `ActionSheetIOS.showActionSheetWithOptions`.
///
/// **PixelOffice ("Agent HQ")**: The pixel-office SKScene (`PixelOffice`, ported
/// as SpriteKit) is the hero — the FIRST row of the My Agents list (see
/// `officeRow`), so it scrolls away naturally with the content. The "Agent HQ —
/// Live" status pill and the agency-wide stats rollup (`AgencyStatsPill`) ride in
/// its corners. PixelOffice runs the full walk/pathfind/state-churn simulation
/// (FIDELITY-WAIVER #082 resolved).
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
    // B2 — app-wide follow list (see `WagerproofApp`). Powers the "Following"
    // rail in the My Agents list; the SAME instance is written to by
    // `PublicAgentDetailView`'s Follow toggle, so a follow/unfollow there is
    // reflected here the next time this list reloads/reappears.
    @Environment(FollowedAgentsStore.self) private var followedAgentsStore
    @State private var store: AgentsStore
    /// Owns the public leaderboard fetch. It needs no user binding (the
    /// leaderboard is public), so we just hand it to `AgentLeaderboardView`,
    /// which kicks off the first refresh via its own `.task`.
    @State private var leaderboardStore = LeaderboardStore()
    /// Top Picks feed store + favorites, lifted here (instead of being owned by
    /// `TopAgentPicksFeedContainer`) so the bar's contextual filter menu can
    /// drive `filterMode` — the feed renders with `showsFilters: false`.
    @State private var topPicksStore = TopAgentPicksFeedStore()
    @State private var topPicksFavorites = FavoriteAgentsStore()
    /// Active inner tab (My Agents / Leaderboard / Top Picks).
    @State private var selectedTab: AgentsTab = .myAgents
    @State private var pendingDeleteId: String?
    @State private var pendingLongPressAgent: AgentWithPerformance?
    @State private var navPath = NavigationPath()
    /// Sort order for the agent list (driven by the bar's filter menu).
    @State private var sortOption: AgentSortOption = .winRate
    /// Bumped on appear (incl. pop-back from a detail page) so the unread-picks
    /// dots re-read the device-local seen ledger and clear after viewing.
    @State private var unreadRefreshToken = 0
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
        _selectedTab = State(initialValue: Self.initialTab)
    }

    /// DEBUG-only forced inner tab (`-agentsTab myAgents|leaderboard|topPicks`),
    /// so the screenshot harness can land directly on each branch. Defaults to
    /// `.myAgents` in release.
    private static var initialTab: AgentsTab {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-agentsTab"), i + 1 < args.count {
            switch args[i + 1].lowercased() {
            case "leaderboard": return .leaderboard
            case "toppicks", "top-picks", "picks": return .topPicks
            default: return .myAgents
            }
        }
        #endif
        return .myAgents
    }

    #if DEBUG
    init(store: AgentsStore) {
        _store = State(initialValue: store)
        _selectedTab = State(initialValue: Self.initialTab)
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
            // The My Agents branch uses a custom collapsing hero: the pixel
            // office shrinks into the top-right corner as the user scrolls,
            // the agency stats slide into the freed space, and the agent list
            // scrolls underneath (see `collapsingPopulatedBody`). Large title
            // mode gives the tab a prominent "Agents" heading that matches the
            // other main tabs (Games / Props / Outliers). The pinned segmented
            // picker (see `.safeAreaInset` below) switches between the three
            // inner sections.
            tabbedContent
            .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Agents")
                // Large collapsing title (matches Games/Props/Outliers): the
                // big "Agents" header shrinks into the bar as you scroll. The
                // inner-tab picker is NOT a toolbar / safe-area bar — a frosted
                // `.bar` inset sits over the large title and hides it. Each
                // branch instead renders the picker as a pinned section header
                // INSIDE its scroll content (the GamesView pattern), so it sits
                // below the title and the title stays visible.
                .navigationBarTitleDisplayMode(.large)
                // Per-tab `.searchable()` removed — search lives in the
                // dedicated `Tab(role: .search)` slot now.
                .toolbar {
                    // Top-leading WagerProof wordmark (shared across main tabs);
                    // passive brand mark — Settings now lives on the trailing gear.
                    WagerProofLeadingToolbarItem()
                    // Trailing group (left → right): create-agent (+), then the
                    // Settings gear pinned rightmost. The "+" replaces the old
                    // floating action button so all chrome lives in the top bar;
                    // it locks when the agent limit is hit (mirrors the old FAB's
                    // lock chip). WagerBot launcher hidden app-wide — see
                    // MainTabToolbar.swift's WagerBotToolbarButton.
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        createAgentToolbarButton
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
                    followedAgentsStore.bind(userId: currentUserId)
                    if case .idle = followedAgentsStore.loadState {
                        await followedAgentsStore.refresh()
                    }
                }
                .onChange(of: currentUserId) { _, newId in
                    store.bind(userId: newId)
                    Task { await store.refresh() }
                    followedAgentsStore.bind(userId: newId)
                    Task { await followedAgentsStore.refresh() }
                }
                // Consume a Search-originated deep link into an agent's detail.
                // `initial: true` covers the cold-mount case (the user tapped a
                // search result before ever visiting this tab, so the route was
                // set before this view existed); the nil guard makes the extra
                // fires on inner-tab switches harmless.
                .onChange(of: tabStore.pendingAgentRoute, initial: true) {
                    consumePendingAgentRoute()
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

    // MARK: - Inner-tab switcher

    /// Segmented control that selects the inner section, plus a contextual
    /// filter menu on the right (mirrors GamesView's sport-picker + sort menu).
    /// Rendered as a pinned section header inside each branch's scroll content
    /// (NOT a toolbar / safe-area bar — a frosted inset there covers the large
    /// title). Styled as a floating Liquid Glass capsule like GamesView's
    /// pickerBar (no full-width opaque bar behind it).
    private var tabPicker: some View {
        HStack(spacing: 8) {
            Picker("Section", selection: $selectedTab) {
                ForEach(AgentsTab.allCases, id: \.self) { tab in
                    Text(tab.label).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .clipShape(.capsule)
            .sensoryFeedback(.selection, trigger: selectedTab)

            filterMenu
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 4)
        .modifier(LiquidGlassCapsule())
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    /// Filter/sort menu whose options switch with the active tab (like the
    /// GamesView sort menu adapts to the selected sport):
    ///   - My Agents → sort the agent list (Win % / Units / Streak / Name / …)
    ///   - Leaderboard → sort mode + timeframe + 10+ picks toggle
    ///   - Top Picks → Top 10 / Following / Favorites
    private var filterMenu: some View {
        Menu {
            filterMenuContent
        } label: {
            Image(systemName: "line.3.horizontal.decrease")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 32, height: 32)
        }
        .tint(Color.appTextPrimary)
        .accessibilityLabel("Filter")
    }

    @ViewBuilder
    private var filterMenuContent: some View {
        switch selectedTab {
        case .myAgents:
            Picker("Sort by", selection: $sortOption) {
                ForEach(AgentSortOption.allCases, id: \.self) { opt in
                    Label(opt.label, systemImage: opt.icon).tag(opt)
                }
            }
        case .leaderboard:
            Picker("Sort", selection: Bindable(leaderboardStore).sortMode) {
                ForEach(LeaderboardStore.SortMode.allCases, id: \.self) { mode in
                    Text(mode.label).tag(mode)
                }
            }
            Picker("Timeframe", selection: Bindable(leaderboardStore).timeframe) {
                ForEach(LeaderboardStore.Timeframe.allCases, id: \.self) { tf in
                    Text(tf.label).tag(tf)
                }
            }
            Toggle("10+ picks only", isOn: Bindable(leaderboardStore).excludeUnder10Picks)
        case .topPicks:
            Picker("Show", selection: Bindable(topPicksStore).filterMode) {
                ForEach(TopAgentPicksFeedStore.FilterMode.allCases, id: \.self) { mode in
                    Text(mode.label).tag(mode)
                }
            }
        }
    }

    /// Branches the body by the selected inner tab. My Agents keeps its full
    /// collapsing-office experience; the other two reuse the existing public
    /// surfaces (`AgentLeaderboardView`, `TopAgentPicksFeedContainer`) whose
    /// row/pick taps route into the public agent detail.
    @ViewBuilder
    private var tabbedContent: some View {
        switch selectedTab {
        case .myAgents:
            // My Agents renders the picker as a pinned List section header (so
            // its large title shows — see `agentsList`).
            myAgentsContent
        case .leaderboard:
            // The picker rides a PINNED SECTION HEADER inside the feed's scroll
            // content (`pinnedHeader`), exactly like My Agents — a `safeAreaInset`
            // bar would cover the large title. `showsFilters: false` — the
            // sort/timeframe filters live in the bar's contextual filter menu.
            AgentLeaderboardView(
                store: leaderboardStore,
                showsFilters: false,
                pinnedHeader: AnyView(tabPicker)
            ) { entry in
                navPath.append(AgentsRoute.publicAgentDetail(agentId: entry.avatarId))
            }
        case .topPicks:
            // Feed driven by the lifted `topPicksStore` so the bar's filter menu
            // controls its Top 10 / Following / Favorites mode (`showsFilters:
            // false` hides the feed's own picker). The picker is the feed's
            // pinned section header. Binding/refresh plumbing here mirrors the
            // old `TopAgentPicksFeedContainer`.
            TopAgentPicksFeed(
                store: topPicksStore,
                showsFilters: false,
                pinnedHeader: AnyView(tabPicker),
                onAgentTap: { id in
                    navPath.append(AgentsRoute.publicAgentDetail(agentId: id))
                },
                onPickTap: { row in
                    // No public pick-detail sheet yet — open the picking agent.
                    navPath.append(AgentsRoute.publicAgentDetail(agentId: row.avatarId))
                }
            )
            .environment(topPicksFavorites)
            .task {
                topPicksStore.bind(viewerUserId: currentUserId)
                if case .idle = topPicksStore.loadState {
                    await topPicksStore.refresh()
                }
            }
            .onChange(of: currentUserId) { _, newId in
                topPicksStore.bind(viewerUserId: newId)
                Task { await topPicksStore.refresh() }
            }
        }
    }

    // MARK: - My Agents content

    @ViewBuilder
    private var myAgentsContent: some View {
        switch store.loadState {
        case .idle, .loading:
            if store.agents.isEmpty {
                // Empty/loading/failed aren't the populated `List`, so they wrap
                // their content in the same pinned-section-header pattern (the
                // picker as scroll content, never a title-hiding inset).
                pickerHeaderScroll { myAgentsSkeleton }
            } else {
                collapsingPopulatedBody
            }
        case .loaded:
            if store.agents.isEmpty {
                pickerHeaderScroll { emptyState }
            } else {
                collapsingPopulatedBody
            }
        case .failed(let msg):
            pickerHeaderScroll {
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

    /// Wraps a non-`List` My Agents state (skeleton / empty / error) so the tab
    /// picker rides a pinned section header — matching the populated list and
    /// keeping the large title visible (a `safeAreaInset` bar would hide it).
    private func pickerHeaderScroll<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                Section {
                    content()
                } header: {
                    tabPicker
                }
            }
        }
    }

    /// Populated hub: the agent list. The inner-tab picker is the list's pinned
    /// section header (under the collapsing large "Agents" title); the pixel
    /// office ("Agent HQ") is the first row and scrolls away naturally with the
    /// content. (A scroll-driven "minimize" was tried but removed — shrinking a
    /// list row on scroll feeds back into the scroll and jitters.)
    @ViewBuilder
    private var collapsingPopulatedBody: some View {
        agentsList
    }

    /// The Agent HQ hero — a normal list row that scrolls with the content. The
    /// "Agent HQ — Live" pill rides its top-leading corner, the agency stats its
    /// top-trailing corner.
    private var officeRow: some View {
        PixelOffice(agents: store.agents, isActive: true)
            .overlay(alignment: .topLeading) {
                agentHQStatusPill.padding(10)
            }
            .overlay(alignment: .topTrailing) {
                AgencyStatsPill(agents: store.agents).padding(10)
            }
    }

    /// Single-column agent feed rendered as a `List` so rows get NATIVE swipe
    /// actions — leading: activate/pause, pin, edit, details; trailing: delete.
    /// All List chrome (separators, row backgrounds, default insets) is stripped
    /// so the cards read identically to the old VStack feed; `listRowSpacing(10)`
    /// restores the 10pt gaps.
    private var agentsList: some View {
        List {
            // The inner-tab picker is the section's PINNED header — it stays
            // under the (collapsing) large title while the office + cards scroll
            // beneath it. Keeping it here (not a safe-area inset) is what lets
            // the large "Agents" title render.
            Section {
                // Agent HQ hero — the first row; scrolls away with the content.
                officeRow
                    .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                if !followedAgentsStore.follows.isEmpty {
                    followingRail
                        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 4, trailing: 0))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                sortRow
                    .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                ForEach(Array(sortedAgents.enumerated()), id: \.element.id) { index, agent in
                    AgentRowCard(
                        agent: agent,
                        hasUnreadPicks: hasUnreadPicks(agent),
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
            } header: {
                // Picker only is the pinned header. `listRowBackground(.clear)`
                // removes the List header's default material (the "weird bar" the
                // other tabs don't have).
                tabPicker
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .textCase(nil)
            }
        }
        .listStyle(.plain)
        .listRowSpacing(10)
        .scrollContentBackground(.hidden)
        .environment(\.defaultMinListRowHeight, 1)
        // Slide cards into place when the sort order (or pin set) changes.
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: sortOption)
        .animation(.spring(response: 0.45, dampingFraction: 0.82), value: pinnedIdsRaw)
        // Re-read the device-local seen ledger when the list re-appears (incl.
        // pop-back from a detail visit) so unread dots clear after viewing.
        .onAppear {
            unreadRefreshToken &+= 1
            // B4 — pop back from a public agent detail (follow/unfollow) and
            // pick up the change immediately rather than waiting on a manual
            // pull-to-refresh.
            Task { await followedAgentsStore.refresh() }
        }
    }

    /// Horizontal rail of followed public agents — tapping opens the
    /// read-only `PublicAgentDetailView` (never treated as owned; no
    /// Generate/autopilot controls render there for non-owners).
    private var followingRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Following")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 12)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(followedAgentsStore.follows) { followed in
                        Button {
                            navPath.append(AgentsRoute.publicAgentDetail(agentId: followed.avatarId))
                        } label: {
                            VStack(spacing: 6) {
                                ZStack {
                                    Circle()
                                        .fill(
                                            LinearGradient(
                                                colors: AgentColorPalette.avatarGradient(for: followed.avatarColor),
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                        .frame(width: 52, height: 52)
                                    Text(followed.avatarEmoji)
                                        .font(.system(size: 24))
                                }
                                Text(followed.name)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(Color.appTextPrimary)
                                    .lineLimit(1)
                                    .frame(width: 64)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
            }
        }
        .padding(.vertical, 4)
    }

    /// Unread-picks dot state for a row. References `unreadRefreshToken` so
    /// SwiftUI recomputes rows after a detail visit marks picks seen
    /// (UserDefaults itself isn't observable).
    private func hasUnreadPicks(_ agent: AgentWithPerformance) -> Bool {
        _ = unreadRefreshToken
        return AgentPicksSeenStore.hasUnread(
            agentId: agent.id,
            latestActivity: agent.agent.lastGeneratedAt
        )
    }

    // MARK: - Sort row (active-sort indicator)

    /// Slim row between the office hero and the cards: a read-only indicator of
    /// the active sort, right-aligned. The sort *control* lives in the bar's
    /// filter menu; the "Agent HQ — Live" pill moved back into the office hero.
    private var sortRow: some View {
        HStack(spacing: 8) {
            Spacer(minLength: 8)
            sortIndicator
        }
        .padding(.bottom, 2)
    }

    /// Non-interactive label showing how the list is currently sorted (the
    /// control moved to the bar's filter menu). Muted styling, no capsule, so it
    /// doesn't read as a tappable button.
    private var sortIndicator: some View {
        HStack(spacing: 4) {
            Image(systemName: "arrow.up.arrow.down")
                .font(.system(size: 10, weight: .bold))
            Text(sortOption.label)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(Color.appTextMuted)
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
                .font(.system(size: 11, weight: .bold))
                .tracking(0.3)
                // White text — the pill sits over the colorful pixel office.
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        // Liquid glass to match the office's Auto/Future control pills.
        .liquidGlassBackground(in: Capsule())
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
            AgentHQShimmer()
                .transition(.opacity)

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

    // Leaderboard + Top Picks branches are wired in `tabbedContent` above via
    // `AgentLeaderboardView` and `TopAgentPicksFeedContainer`.

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
            // Onboarding-style pixelwave carousel builder (replaces the old
            // Step 1–6 AgentCreationView wizard). On create it swaps this screen
            // for the new agent's detail page, where the ticket-printer reveal
            // plays once the agent generates picks.
            AgentBuilderView(onCreated: { agent in
                Task { await store.refresh() }
                navPath.removeLast()
                navPath.append(AgentsRoute.agentDetail(agentId: agent.id))
            })
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

    /// Push the agent detail requested from the global Search tab, then clear
    /// the flag so it fires exactly once. Public/leaderboard agents open the
    /// read-only detail; the user's own agents open the owner detail — matching
    /// how this view routes its own list rows. See `SearchView.openAgent`.
    private func consumePendingAgentRoute() {
        guard let route = tabStore.pendingAgentRoute else { return }
        tabStore.pendingAgentRoute = nil
        navPath.append(
            route.isPublic
                ? AgentsRoute.publicAgentDetail(agentId: route.agentId)
                : AgentsRoute.agentDetail(agentId: route.agentId)
        )
    }

    private func refreshActive() async {
        await store.refresh()
    }
}

// MARK: - Agent HQ shimmer

/// Skeleton placeholder for the Agent HQ hero (`officeRow` — the `PixelOffice`
/// scene plus its `agentHQStatusPill` / `AgencyStatsPill` corner overlays),
/// shown while the first agents fetch is in flight. The real scene needs live
/// agent data to populate desks, so this swaps in a flat skeleton plate at the
/// same footprint (864:800 aspect, 20pt corner radius) instead of spinning up
/// SpriteKit with nothing to show — and reproduces both corner pills so the
/// crossfade to the real hero never shifts the layout.
struct AgentHQShimmer: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color.appSkeleton.opacity(0.55))

            // Mirrors agentHQStatusPill's position/size.
            SkeletonCapsule(width: 112, height: 20)
                .padding(10)
        }
        .overlay(alignment: .topTrailing) {
            // Mirrors AgencyStatsPill's position/size.
            SkeletonCapsule(width: 92, height: 20)
                .padding(10)
        }
        .aspectRatio(PixelOfficeGeo.mapWidth / PixelOfficeGeo.mapHeight, contentMode: .fit)
        .shimmering()
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
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
/// Internal (not private) so the Search "Agents" section reuses it for loading parity.
struct AgentRowCardShimmer: View {
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
