import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Outliers tab body. Ports `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx`.
///
/// Layout (mirrors spec §8.1):
///   - `NavigationStack` rooted in the tab cell
///   - Inner-tab `Picker(.segmented)`: Outliers / Top Agent Picks / Leaderboard.
///     All three branches render real content — Top Agent Picks reuses the
///     `TopAgentPicksFeedContainer` (B16) and Leaderboard reuses
///     `AgentLeaderboardView`, both duplicated from the Agents tab by product
///     direction (resolved waiver #022).
///   - Hub branch: vertical `ScrollView` of **primitive-typed rails** — a
///     Betting Trends rail, a First-5 rail, and a Player Props rail, each a
///     horizontal `ScrollView` of the strongest cards across the slate
///     (`OutlierSections` ranks each source off the shared Kit insight
///     adapters). A card opens that primitive's detail surface (trends/F5
///     sheet, or the player-prop detail); the rail header's "See all" pushes
///     the full ranked list.
///   - `.refreshable` re-hydrates the three shared stores.
///
/// The rails read the SAME hoisted stores (`MLBBettingTrendsStore`,
/// `MLBF5SplitsStore`, `PropsStore`) the Games tab + Search use, so the hub
/// surfaces the real matchup/widget/prop primitives rather than abstract tiles.
/// The old merged `OutlierGameTile` feed + `OutlierMatchupDetailView` are no
/// longer mounted here.
struct OutliersView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(MainTabStore.self) private var tabStore
    // Re-injected explicitly into the Settings navigationDestination so iOS 18+
    // configurePreferredTransition can resolve them before the nav environment
    // chain is established. See MainTabToolbar.wagerProofSettingsDestination.
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    // For matchup-card tap routing: look up the typed game from GamesStore
    // by sport + gameId, then ask the corresponding sport's sheet store to
    // open it. GamesView's NavigationStack observes the sheet store and
    // pushes the detail page. Switch to .games tab so the user lands on it.
    @Environment(GamesStore.self) private var gamesStore
    @Environment(NFLGameSheetStore.self) private var nflSheetStore
    @Environment(CFBGameSheetStore.self) private var cfbSheetStore
    @Environment(NBAGameSheetStore.self) private var nbaSheetStore
    @Environment(NCAABGameSheetStore.self) private var ncaabSheetStore
    @Environment(MLBGameSheetStore.self) private var mlbSheetStore
    // The hub's three primitive rails read the SAME hydrated stores the Games
    // tab + Search use (hoisted to MainTabView), so the data is shared, not
    // re-fetched. Optional because the SwiftUI preview / some harness mounts
    // don't inject them — the rails degrade to empty in that case.
    @Environment(MLBBettingTrendsStore.self) private var mlbTrendsStore: MLBBettingTrendsStore?
    @Environment(MLBF5SplitsStore.self) private var mlbF5Store: MLBF5SplitsStore?
    @Environment(PropsStore.self) private var propsStore: PropsStore?
    @State private var store: OutliersStore
    /// The Top Agent Picks + Leaderboard surfaces live in BOTH Agents and
    /// Outliers (per product direction). We instantiate a separate
    /// `LeaderboardStore` here — the Agents tab owns its own — so each tab's
    /// pill filters and refresh timestamp stay isolated.
    @State private var leaderboardStore: LeaderboardStore
    /// Top Agent Picks feed state, owned here (not in a child container) so its
    /// Top 10 / Following / Favorites filter can be lifted into the pinned glass
    /// header alongside the inner-tab picker — matching how Games/Props pin
    /// their sport picker.
    @State private var topPicksStore: TopAgentPicksFeedStore
    @State private var topPicksFavorites: FavoriteAgentsStore
    /// Navigation path for the Agents-derived destinations
    /// (`publicAgentDetail`) pushed from the Top Picks + Leaderboard branches.
    /// The Outliers hub's existing `OutliersStore.Category` destination still
    /// works via `.navigationDestination(for: Category.self)`; both routes
    /// coexist on the same stack.
    @State private var navPath = NavigationPath()
    /// Detail surfaces a rail card opens. Trends/F5 present as sheets (the same
    /// expand surfaces the game-sheet widgets use); a prop pushes its detail.
    @State private var trendsSheet: MLBGameTrends?
    @State private var f5Sheet: MLBF5Matchup?
    @State private var selectedProp: PlayerPropSelection?

    init() {
        _store = State(initialValue: OutliersStore())
        _leaderboardStore = State(initialValue: LeaderboardStore())
        _topPicksStore = State(initialValue: TopAgentPicksFeedStore())
        _topPicksFavorites = State(initialValue: FavoriteAgentsStore())
    }

    #if DEBUG
    // Default-arg dropped: `LeaderboardStore.init()` is @MainActor-isolated, so
    // Swift 6 strict concurrency rejects calling it in a synchronous nonisolated
    // default-arg position. Callers pass the store explicitly when constructing
    // this view from a preview / test harness.
    init(store: OutliersStore, leaderboardStore: LeaderboardStore) {
        _store = State(initialValue: store)
        _leaderboardStore = State(initialValue: leaderboardStore)
        _topPicksStore = State(initialValue: TopAgentPicksFeedStore())
        _topPicksFavorites = State(initialValue: FavoriteAgentsStore())
    }
    #endif

    /// Mirrors `AgentsView`'s entitlement facade — `AgentLeaderboardView` reads
    /// `AgentEntitlementsStore` from the environment to decide whether to lock
    /// the net-units stat. Rebuilt per-render so entitlement changes propagate.
    private var entitlements: AgentEntitlementsStore {
        AgentEntitlementsStore(proAccess: proAccess)
    }

    /// Active user id in the format the agents feed + leaderboard stores
    /// expect. Mirrors the accessor in `AgentsView` so favorites / follow
    /// state resolves consistently across both surfaces.
    private var currentUserId: String? {
        if case .authenticated(let userId) = auth.phase {
            return userId.uuidString.lowercased()
        }
        return nil
    }

    var body: some View {
        @Bindable var binding = store
        NavigationStack(path: $navPath) {
            // Outer ScrollView + `LazyVStack(pinnedViews: [.sectionHeaders])`
            // replaces `safeAreaInset(.top)`. iOS 26 was collapsing the
            // `.large` title to zero rendered height when `safeAreaInset` +
            // `.searchable(.always)` competed for chrome space. Section-
            // header pinning keeps the title slot intact (big title +
            // shrink-on-scroll transition) AND pins the inner-tab picker
            // to the top of the viewport with `.ultraThinMaterial` blur.
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                    Section {
                        switch store.activeTab {
                        case .outliers:
                            hubScroll
                        case .agentPicks:
                            agentPicksPlaceholder
                        case .leaderboard:
                            leaderboardPlaceholder
                        }
                    } header: {
                        // Pinned glass header, matching the Games/Props bar:
                        // the inner-tab picker plus the active tab's filter in an
                        // embedded menu button right next to it (Leaderboard sort,
                        // Top Agent Picks filter). Pins so the controls stay
                        // reachable instead of scrolling away inside each branch.
                        HStack(spacing: 8) {
                            innerTabPicker
                            headerTrailingControl
                        }
                        .padding(.horizontal, 4)
                        .padding(.vertical, 4)
                        .modifier(LiquidGlassCapsule())
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                    }
                }
            }
            .background(Color.appSurface.ignoresSafeArea())
            // Pattern §1 — flip `.inline` → `.large` so the title shrinks
            // into the inline slot on scroll, matching every Honeydew main
            // page. The custom WagerProof wordmark `.principal` toolbar item
            // was dropped because `.large` doesn't render `.principal` — the
            // bare "Outliers" title is now the source of truth.
            .navigationTitle("Outliers")
            .navigationBarTitleDisplayMode(.large)
            // Per-tab `.searchable()` removed — search now lives in the
            // dedicated `Tab(role: .search)` slot.
            .refreshable {
                // Branch-aware pull-to-refresh — the Top Picks branch's
                // `TopAgentPicksFeedContainer` owns its own internal refresh
                // (via the feed's pull-to-refresh inside the container), so
                // here we only need to drive the outer ScrollView's refresh
                // for the two branches whose stores live on `OutliersView`.
                switch store.activeTab {
                case .outliers:
                    await store.refresh()
                    await loadOutlierSources()
                case .leaderboard:
                    await leaderboardStore.refresh()
                case .agentPicks:
                    // `TopAgentPicksFeedContainer` wraps `TopAgentPicksFeed`
                    // which already has its own `.refreshable` on its inner
                    // ScrollView. The outer refresh is a no-op so we don't
                    // double-fire the RPC.
                    break
                }
            }
            .task {
                if case .idle = store.loadState {
                    await store.refresh()
                }
                await loadOutlierSources()
            }
            .navigationDestination(for: OutliersStore.Category.self) { category in
                OutliersDetailView(store: store, category: category)
            }
            // "See all" on a rail header pushes that primitive's full ranked
            // list (re-derived from the same stores).
            .navigationDestination(for: OutlierSections.Kind.self) { kind in
                OutlierSectionListView(
                    kind: kind,
                    trends: trendsItems,
                    f5Games: f5Items,
                    props: propItems,
                    onTrends: { trendsSheet = $0 },
                    onF5: { f5Sheet = mlbF5Store?.matchup(for: $0.gamePk) },
                    onProp: { selectedProp = $0 }
                )
            }
            .navigationDestination(item: $selectedProp) { selection in
                PlayerPropDetailView(selection: selection)
            }
            // Trends/F5 rail cards open the same expand surfaces the game-sheet
            // widgets present — one detail design per primitive across surfaces.
            .sheet(item: $trendsSheet) { game in
                BettingTrendsDetailSheet(
                    awayName: game.awayTeam.teamName,
                    homeName: game.homeTeam.teamName,
                    timeDisplay: MLBTrendsMatrixAdapter.timeDisplay(for: game),
                    stripeColors: MLBTrendsMatrixAdapter.stripeColors(for: game),
                    accent: MLBTrendsMatrixAdapter.accent,
                    sections: MLBTrendsMatrixAdapter.sections(for: game),
                    guide: .mlb,
                    avatar: MLBTrendsMatrixAdapter.avatarProvider(for: game)
                )
            }
            .sheet(item: $f5Sheet) { matchup in
                F5SplitsDetailSheet(matchup: matchup)
            }
            .navigationDestination(for: AgentsRoute.self) { route in
                // Reuse the B15 factory so the public-agent detail screen is
                // identical to what Agents tab pushes — single source of truth
                // for the destination, avoids state drift across surfaces.
                switch route {
                case .publicAgentDetail(let id):
                    AgentsRouterB15.publicDetail(agentId: id)
                case .agentDetail(let id):
                    AgentsRouterB15.ownerDetail(agentId: id)
                case .createAgent, .editAgent:
                    // Outliers never pushes `.createAgent` / `.editAgent`, but
                    // the enum is shared with AgentsView — handle them for
                    // exhaustiveness.
                    EmptyView()
                }
            }
            .toolbar { mainToolbar }
            // Settings pushes onto this stack (tapping the trailing gear) instead
            // of covering the screen as a modal — see MainTabToolbar.swift.
            .wagerProofSettingsDestination(tabStore: tabStore, tab: .outliers, auth: auth, settingsStore: settingsStore, revenueCat: revenueCat, adminMode: adminMode, proAccess: proAccess)
            .wagerProofChatDestination(tabStore: tabStore, tab: .outliers)
            .sensoryFeedback(.selection, trigger: store.activeTab)
        }
        // Push the entitlements facade into the env so `AgentLeaderboardView`
        // can read it via `@Environment(AgentEntitlementsStore.self)`.
        .environment(entitlements)
    }

    // MARK: - Toolbar

    /// Native large-title toolbar. Top-leading is the WagerProof wordmark
    /// (tap to open Settings); the trailing group hosts the WagerBot launcher
    /// (shared across every main tab — see `MainTabToolbar.swift`).
    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        WagerProofLeadingToolbarItem()
        ToolbarItemGroup(placement: .topBarTrailing) {
            WagerBotToolbarButton(tabStore: tabStore)
            SettingsToolbarButton(tabStore: tabStore)
        }
    }

    // MARK: - Inner-tab Picker

    private var innerTabPicker: some View {
        @Bindable var binding = store
        return Picker("Inner tab", selection: $binding.activeTab) {
            ForEach(OutliersStore.InnerTab.allCases, id: \.self) { tab in
                Text(tab.label).tag(tab)
            }
        }
        .pickerStyle(.segmented)
        // No inner padding — `safeAreaInset(.top)` (pattern §3) already
        // applies horizontal+vertical padding around this view, so adding
        // more here would double-pad. Matches the `sportPicker` shape in
        // `GamesView` after Agent 1's refactor.
        .onChange(of: store.activeTab) { _, tab in
            // First-load trigger for the leaderboard branch — mirrors the
            // identical pattern in `AgentsView.innerTabPicker`. Outliers / Top
            // Picks both already self-load via their own .task hooks (the
            // OutliersStore via the outer .task, the Top Picks container via
            // TopAgentPicksFeedContainer.task), so they need no kick here.
            if case .leaderboard = tab, case .idle = leaderboardStore.loadState {
                Task { await leaderboardStore.refresh() }
            }
        }
    }

    // MARK: - Pinned per-tab filters

    /// The active inner tab's filter, rendered as an embedded menu button next
    /// to the inner-tab picker (Games/Props pattern). Outliers has no secondary
    /// filter, so its header is just the picker.
    @ViewBuilder
    private var headerTrailingControl: some View {
        switch store.activeTab {
        case .outliers:
            EmptyView()
        case .agentPicks:
            topPicksFilterMenu
        case .leaderboard:
            leaderboardSortMenu
        }
    }

    /// Top Agent Picks' Top 10 / Following / Favorites selector as an embedded
    /// menu button — same treatment as `leaderboardSortMenu`.
    private var topPicksFilterMenu: some View {
        @Bindable var binding = topPicksStore
        return Menu {
            Picker("Show", selection: $binding.filterMode) {
                ForEach(TopAgentPicksFeedStore.FilterMode.allCases, id: \.self) { mode in
                    Text(mode.label).tag(mode)
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 32, height: 32)
        }
        .tint(Color.appTextPrimary)
        .sensoryFeedback(.selection, trigger: topPicksStore.filterMode)
        .accessibilityLabel("Filter top agent picks")
    }

    /// Leaderboard sort/timeframe as an embedded menu button — same pattern as
    /// the Games/Props sort menu (an `arrow.up.arrow.down` button that opens a
    /// context menu). Binds straight to `leaderboardStore`; each selection's
    /// didSet re-runs the fetch.
    private var leaderboardSortMenu: some View {
        @Bindable var binding = leaderboardStore
        return Menu {
            Picker("Sort by", selection: $binding.sortMode) {
                ForEach(LeaderboardStore.SortMode.allCases, id: \.self) { mode in
                    Text(mode.label).tag(mode)
                }
            }
            Picker("Timeframe", selection: $binding.timeframe) {
                ForEach(LeaderboardStore.Timeframe.allCases, id: \.self) { tf in
                    Text(tf.label).tag(tf)
                }
            }
            Divider()
            Toggle("10+ picks only", isOn: $binding.excludeUnder10Picks)
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 32, height: 32)
        }
        .tint(Color.appTextPrimary)
        .sensoryFeedback(.selection, trigger: leaderboardStore.sortMode)
        .accessibilityLabel("Sort leaderboard")
    }

    // MARK: - Hub branch (primitive-typed rails)

    @ViewBuilder
    private var hubScroll: some View {
        let trends = trendsItems
        let f5 = f5Items
        let props = propItems
        LazyVStack(alignment: .leading, spacing: 18, pinnedViews: []) {
            // How-to is a tap-to-open tool button (`OutliersHowToBanner` →
            // `OutliersLearnMoreSheet`) so the hub leads with the rails.
            OutliersHowToBanner()
                .padding(.horizontal, Spacing.lg)

            if trends.isEmpty && f5.isEmpty && props.isEmpty {
                if outlierSourcesLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                } else {
                    outlierEmptyState
                }
            } else {
                // One horizontal rail per primitive type, each ranked strongest
                // first. Empty rails hide entirely (no dead headers).
                if !trends.isEmpty {
                    rail(.trends) {
                        ForEach(trends) { game in
                            trendsCard(game)
                        }
                    }
                }
                if !f5.isEmpty {
                    rail(.f5) {
                        ForEach(f5) { game in
                            f5Card(game)
                        }
                    }
                }
                if !props.isEmpty {
                    rail(.props) {
                        ForEach(props) { item in
                            OutlierPropCard(item: item) { selectedProp = $0 }
                        }
                    }
                }
            }
        }
        .padding(.vertical, Spacing.md)
    }

    /// Section shell: header (icon + title + "See all") over a horizontal rail.
    @ViewBuilder
    private func rail<Content: View>(_ kind: OutlierSections.Kind, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NavigationLink(value: kind) {
                HStack(spacing: 7) {
                    Image(systemName: kind.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(kind.accent)
                    Text(kind.title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Spacer(minLength: 0)
                    Text("See all")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.lg)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    content()
                }
                .padding(.horizontal, Spacing.lg)
            }
        }
    }

    private func trendsCard(_ game: MLBGameTrends) -> some View {
        OutlierCardBuilder.trends(game) { trendsSheet = game }
    }

    private func f5Card(_ game: MLBF5Game) -> some View {
        OutlierCardBuilder.f5(game, store: mlbF5Store) { f5Sheet = mlbF5Store?.matchup(for: game.gamePk) }
    }

    // MARK: - Rail data (ranked off the shared stores)

    private var trendsItems: [MLBGameTrends] {
        OutlierSections.trends(mlbTrendsStore?.games ?? [])
    }

    private var f5Items: [MLBF5Game] {
        guard let store = mlbF5Store else { return [] }
        return OutlierSections.f5(store.games, store: store)
    }

    private var propItems: [PlayerPropFeedItem] {
        OutlierSections.props(propsStore?.matchups ?? [])
    }

    private var outlierSourcesLoading: Bool {
        (mlbTrendsStore?.loading ?? false) || (mlbF5Store?.isLoading ?? false) || (propsStore?.isLoadingMLB ?? false)
    }

    /// Hydrate the three live sources that feed the rails. All read the shared
    /// hoisted stores, so this is a no-op when the Games tab already loaded them.
    private func loadOutlierSources() async {
        await mlbTrendsStore?.refresh()
        await mlbF5Store?.refresh()
        await propsStore?.refreshMLB()
    }

    private var outlierEmptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "scope")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Color.appTextMuted)
            Text("No outliers right now")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text("We're watching every game — flagged matchups will show up here as the slate fills in.")
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    // MARK: Inner-tab content branches
    //
    // Both surfaces below are intentionally duplicated across the Agents tab
    // and the Outliers tab (product direction: discoverability for users who
    // live in the Outliers hub). They share the same underlying stores
    // (`TopAgentPicksFeedStore`, `LeaderboardStore`) — but each tab owns its
    // own instance so filters/scroll state don't leak across tabs.

    /// Top community-agent picks feed. We drive `TopAgentPicksFeed` directly
    /// (rather than `TopAgentPicksFeedContainer`) so this view owns the feed
    /// store and can lift its Top 10/Following/Favorites picker into the pinned
    /// header. `showsFilters: false` hides the feed's own inline picker; the
    /// bind/refresh plumbing the container used to do is inlined here.
    @ViewBuilder
    private var agentPicksPlaceholder: some View {
        TopAgentPicksFeed(
            store: topPicksStore,
            showsFilters: false,
            onAgentTap: { id in
                navPath.append(AgentsRoute.publicAgentDetail(agentId: id))
            },
            onPickTap: { row in
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

    /// Public agent leaderboard. `showsFilters: false` — its sort/timeframe
    /// pills are lifted into the pinned header (`pinnedFilterBar`).
    @ViewBuilder
    private var leaderboardPlaceholder: some View {
        AgentLeaderboardView(store: leaderboardStore, showsFilters: false) { entry in
            navPath.append(AgentsRoute.publicAgentDetail(agentId: entry.avatarId))
        }
    }
}

#Preview("Empty hub") {
    OutliersView()
        .environment(AuthStore())
        .environment(ProAccessStore(revenueCat: RevenueCatStore(), adminMode: AdminModeStore()))
}
