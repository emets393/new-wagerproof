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
///   - Hub branch: vertical `ScrollView` with a hero banner + 7 horizontal
///     Spotify-style sections, each a `LazyHStack` of `OutlierMatchupCardView`.
///   - Each section header is a `NavigationLink(value: Category)` that pushes
///     a per-category `OutliersDetailView`.
///   - `.refreshable` re-runs the store's pipeline.
///
/// The hub still renders CTA-only cards for the trend / accuracy / regression
/// sections because the hub doesn't pre-fetch each per-sport store — that
/// would explode cold-start cost. Tapping the section header pushes the
/// dedicated list view which owns its own data hydration. See FIDELITY-WAIVER
/// #234 for the rationale on keeping hub sections CTA-only.
struct OutliersView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(MainTabStore.self) private var tabStore
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
    @State private var store: OutliersStore
    /// The Top Agent Picks + Leaderboard surfaces live in BOTH Agents and
    /// Outliers (per product direction). We instantiate a separate
    /// `LeaderboardStore` here — the Agents tab owns its own — so each tab's
    /// pill filters and refresh timestamp stay isolated.
    @State private var leaderboardStore: LeaderboardStore
    /// Live outlier sources for the merged hub list. Phase 1 = MLB Betting
    /// Trends + MLB F5 Splits (the only sources with live offseason-proof data);
    /// `OutlierAggregator` fans them into one ranked per-game feed. More sources
    /// (value/fade/accuracy/pitcher) join the aggregator in later phases.
    @State private var mlbTrendsStore: MLBBettingTrendsStore
    @State private var mlbF5Store: MLBF5SplitsStore
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

    init() {
        _store = State(initialValue: OutliersStore())
        _leaderboardStore = State(initialValue: LeaderboardStore())
        _mlbTrendsStore = State(initialValue: MLBBettingTrendsStore())
        _mlbF5Store = State(initialValue: MLBF5SplitsStore())
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
        _mlbTrendsStore = State(initialValue: MLBBettingTrendsStore())
        _mlbF5Store = State(initialValue: MLBF5SplitsStore())
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
            .navigationDestination(for: OutlierFeedItem.self) { item in
                OutlierMatchupDetailView(item: item)
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
            .wagerProofSettingsDestination(tabStore: tabStore, tab: .outliers)
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

    // MARK: - Hub branch

    @ViewBuilder
    private var hubScroll: some View {
        // Inner ScrollView removed — the outer body ScrollView now owns
        // scrolling so the pinned section-header pattern can attach to it.
        let items = outlierItems
        LazyVStack(alignment: .leading, spacing: 12, pinnedViews: []) {
            // How-to is now a tap-to-open tool button (see `OutliersHowToBanner`
            // → `OutliersLearnMoreSheet`) so the hub leads with the merged list.
            OutliersHowToBanner()

            if items.isEmpty {
                if outlierSourcesLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                } else {
                    outlierEmptyState
                }
            } else {
                // One ranked, merged tile per game — every live source
                // (Phase 1: MLB Trends + F5) folds into this single list.
                ForEach(items) { item in
                    NavigationLink(value: item) {
                        OutlierGameTile(item: item)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, Spacing.lg)
                }
            }
        }
        .padding(.vertical, Spacing.md)
    }

    /// Merged, ranked per-game outlier feed across the live sources.
    private var outlierItems: [OutlierFeedItem] {
        OutlierAggregator.build(
            trends: mlbTrendsStore.games,
            f5Games: mlbF5Store.games,
            f5Store: mlbF5Store
        )
    }

    private var outlierSourcesLoading: Bool {
        mlbTrendsStore.loading || mlbF5Store.isLoading
    }

    /// Hydrate the live outlier sources that feed the merged list.
    private func loadOutlierSources() async {
        await mlbTrendsStore.refresh()
        await mlbF5Store.refresh()
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

    // MARK: Hub section scaffolding

    /// Generic hub section: header (tap → detail), then either a horizontal
    /// scroll of cards, a row of shimmers (while loading), or a CTA card if
    /// the list is empty.
    @ViewBuilder
    private func section(
        category: OutliersStore.Category,
        title: String,
        icon: String,
        accent: Color,
        isLoading: Bool,
        @ViewBuilder cards: () -> AnyView,
        @ViewBuilder emptyCta: () -> AnyView
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NavigationLink(value: category) {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(accent.opacity(0.15))
                        Image(systemName: icon)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(accent)
                    }
                    .frame(width: 28, height: 28)

                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.lg)

            if isLoading {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 12) {
                        ForEach(0..<3, id: \.self) { i in
                            OutlierCardShimmerView(phase: i)
                        }
                    }
                    .padding(.horizontal, Spacing.lg)
                }
                .scrollTargetBehavior(.viewAligned)
            } else if isSectionEmpty(category) {
                emptyCta().padding(.horizontal, Spacing.lg)
            } else {
                cards()
            }
        }
    }

    /// CTA-only hub section. Tap pushes the dedicated detail view (which
    /// hydrates its own per-sport store). FIDELITY-WAIVER #234: the hub
    /// scroll row stays a single CTA card per section instead of paginating
    /// real preview cards — that would require pre-fetching every per-sport
    /// store on cold-start. The detail-view push is full-fidelity.
    private func deferredSection(
        category: OutliersStore.Category,
        title: String,
        icon: String,
        accent: Color,
        desc: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            NavigationLink(value: category) {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(accent.opacity(0.15))
                        Image(systemName: icon)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(accent)
                    }
                    .frame(width: 28, height: 28)
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.lg)

            ctaCard(icon: icon, title: title, desc: desc, accent: accent, category: category)
                .padding(.horizontal, Spacing.lg)
        }
    }

    private func ctaCard(icon: String, title: String, desc: String, accent: Color, category: OutliersStore.Category) -> some View {
        NavigationLink(value: category) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(accent)
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                HStack(spacing: 4) {
                    Text("View All")
                    Image(systemName: "arrow.right")
                }
                .font(.system(size: 11, weight: .bold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(accent.opacity(0.15))
                .foregroundStyle(accent)
                .clipShape(Capsule())
                .padding(.top, 4)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(accent.opacity(0.05))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(accent.opacity(0.25), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func isSectionEmpty(_ category: OutliersStore.Category) -> Bool {
        switch category {
        case .value: return searchedValueAlerts.isEmpty
        case .fade: return searchedFadeAlerts.isEmpty
        // Deferred sections (#017) — treat as empty so we always render the CTA card.
        default: return true
        }
    }

    // Per-view team-name filter was removed when search moved to the
    // global SearchView tab. These accessors pass through to the store's
    // already-filtered arrays.
    private var searchedValueAlerts: [OutlierValueAlert] { store.filteredValueAlerts }
    private var searchedFadeAlerts: [OutlierFadeAlert] { store.filteredFadeAlerts }

    // MARK: Hub rows

    private var valueHubRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 12) {
                ForEach(Array(searchedValueAlerts.prefix(4).enumerated()), id: \.offset) { _, alert in
                    OutlierMatchupCardView(
                        awayTeam: alert.game.awayTeam,
                        homeTeam: alert.game.homeTeam,
                        sport: alert.sport,
                        awayTeamLogo: alert.game.awayTeamLogo,
                        homeTeamLogo: alert.game.homeTeamLogo,
                        pickIcon: "chart.line.uptrend.xyaxis",
                        pickLabel: "\(alert.side) \(alert.marketType.rawValue)",
                        pickValue: "\(Int(alert.percentage))% consensus",
                        accentColor: Color(hex: 0x22C55E),
                        loading: store.loadingGameId == alert.gameId,
                        onTap: { handleGameTap(alert.gameId) }
                    )
                    .contextMenu {
                        Button {
                            handleGameTap(alert.gameId)
                        } label: { Label("Open game sheet", systemImage: "rectangle.expand.vertical") }
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
        .scrollTargetBehavior(.viewAligned)
    }

    private var fadeHubRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 12) {
                ForEach(Array(searchedFadeAlerts.prefix(4).enumerated()), id: \.offset) { _, alert in
                    OutlierMatchupCardView(
                        awayTeam: alert.game.awayTeam,
                        homeTeam: alert.game.homeTeam,
                        sport: alert.sport,
                        awayTeamLogo: alert.game.awayTeamLogo,
                        homeTeamLogo: alert.game.homeTeamLogo,
                        pickIcon: "bolt.fill",
                        pickLabel: "Fade \(alert.predictedTeam) \(alert.pickType.rawValue)",
                        pickValue: "\(alert.confidence)\(alert.sport == .nfl ? "%" : "pt") confidence",
                        accentColor: Color(hex: 0xF59E0B),
                        loading: store.loadingGameId == alert.gameId,
                        onTap: { handleGameTap(alert.gameId) }
                    )
                    .contextMenu {
                        Button {
                            handleGameTap(alert.gameId)
                        } label: { Label("Open game sheet", systemImage: "rectangle.expand.vertical") }
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
        .scrollTargetBehavior(.viewAligned)
    }

    // MARK: Card tap handler

    /// Look up the alert's underlying game by id, ask the matching sport's
    /// sheet store to open it, then jump the user to the Games tab where
    /// the `navigationDestination(item:)` push fires. `GamesStore` is the
    /// canonical source — sport stores carry the typed payloads keyed by
    /// `id: String`, which matches `OutlierValueAlert.gameId` / `OutlierFadeAlert.gameId`.
    private func handleGameTap(_ gameId: String) {
        // Try every sport — alerts don't always carry an unambiguous sport
        // marker, and the same id never overlaps across sport feeds.
        if let game = gamesStore.games.nfl.first(where: { $0.id == gameId }) {
            nflSheetStore.openGameSheet(game)
        } else if let game = gamesStore.games.cfb.first(where: { $0.id == gameId }) {
            cfbSheetStore.openGameSheet(game)
        } else if let game = gamesStore.games.nba.first(where: { $0.id == gameId }) {
            nbaSheetStore.openGameSheet(game)
        } else if let game = gamesStore.games.ncaab.first(where: { $0.id == gameId }) {
            ncaabSheetStore.openGameSheet(game)
        } else if let game = gamesStore.games.mlb.first(where: { $0.id == gameId }) {
            mlbSheetStore.openGameSheet(game)
        } else {
            // No matching game in cache — flash spinner so the tap isn't
            // silent. Falls through with no navigation; the next refresh
            // will populate the cache for a future tap.
            store.loadingGameId = gameId
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                await MainActor.run { store.loadingGameId = nil }
            }
            return
        }
        tabStore.select(.games)
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
