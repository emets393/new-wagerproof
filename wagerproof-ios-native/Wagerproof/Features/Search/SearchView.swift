import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

// MARK: - Environment Injection Contract
//
// SearchView is mounted by `MainTabView` inside the iOS 18 `Tab(role: .search)`
// slot. For results to populate, MainTabView MUST inject these env values:
//
//   .environment(MainTabStore.self)        — required (tab switch on result tap)
//
// Optional but strongly recommended (without them, the corresponding result
// scope returns empty rows but the UI degrades gracefully):
//
//   .environment(GamesStore.self)          — matchup results across NFL/CFB/NBA/NCAAB/MLB
//   .environment(AgentsStore.self)         — own-agent name matches
//   .environment(OutliersTrendsStore.self) — Outliers trend-card matches (loaded sport)
//   .environment(NFLGameSheetStore.self)   — opens NFL detail sheet on game tap
//   .environment(CFBGameSheetStore.self)   — opens CFB detail sheet on game tap
//   .environment(NBAGameSheetStore.self)   — opens NBA detail sheet on game tap
//   .environment(NCAABGameSheetStore.self) — opens NCAAB detail sheet on game tap
//   .environment(MLBGameSheetStore.self)   — opens MLB detail sheet on game tap
//
// Today GamesView/AgentsView/OutliersView/ScoreboardView each own their tab's
// store as `@State`. The concurrent MainTabView refactor is expected to lift
// those stores up to the tab shell (so they live for the full session and the
// search surface can read them). Until that happens, SearchView still mounts
// cleanly — it just shows the empty-state suggestion grid for any scope that
// has no upstream data.

/// Global cross-tab search experience. Lives behind iOS 18's detached
/// `Tab(role: .search)` slot. Owns its own `NavigationStack` because the
/// search role slot does not supply one (unlike a regular tab cell).
///
/// Empty-state layout (no query yet):
///   - "Recent searches" — last 5 committed queries (UserDefaults-backed)
///   - "Suggestions" — sport chips + browse-by-section entry points
///
/// Active search layout:
///   - Segmented scope chip row (`All / Matchup / Props / Agents / Outliers`)
///   - One `Section` per scope with a count header
///   - Each row is a `SearchResultRow` — tap fires the navigation handoff
///
/// Navigation handoff: SearchView does not own the destinations (game sheets,
/// agent detail, outlier detail). Instead it switches the active tab via
/// `MainTabStore.select(...)` and asks the destination tab's store to open
/// the right thing. The destination tab then handles the actual push or
/// sheet presentation in its own NavigationStack — search rows reliably
/// land the user on the correct surface no matter which tab they came from.
struct SearchView: View {
    @Environment(MainTabStore.self) private var tabStore

    // Optional upstream stores. We use Bindable-via-env so SwiftUI re-renders
    // result sections when the underlying data refreshes. Each is optional
    // because the concurrent MainTabView refactor controls when stores get
    // lifted to the shell.
    @Environment(GamesStore.self) private var gamesEnv: GamesStore?
    @Environment(AgentsStore.self) private var agentsEnv: AgentsStore?
    @Environment(OutliersTrendsStore.self) private var trendsEnv: OutliersTrendsStore?

    // Per-sport game sheet stores. Optional for the same reason — until
    // MainTabView lifts them, tapping a game result falls back to a tab
    // switch only (the user still lands on the right tab and can find the
    // game manually).
    @Environment(NFLGameSheetStore.self) private var nflSheetEnv: NFLGameSheetStore?
    @Environment(CFBGameSheetStore.self) private var cfbSheetEnv: CFBGameSheetStore?
    @Environment(NBAGameSheetStore.self) private var nbaSheetEnv: NBAGameSheetStore?
    @Environment(NCAABGameSheetStore.self) private var ncaabSheetEnv: NCAABGameSheetStore?
    @Environment(MLBGameSheetStore.self) private var mlbSheetEnv: MLBGameSheetStore?

    // Shell-hoisted MLB insight slates — drive the per-game insight chips and
    // the Players results. Optional: without them the chips/players simply
    // don't render (graceful degrade, same convention as the stores above).
    @Environment(PropsStore.self) private var propsEnv: PropsStore?
    @Environment(MLBBettingTrendsStore.self) private var mlbTrendsEnv: MLBBettingTrendsStore?
    @Environment(MLBF5SplitsStore.self) private var mlbF5Env: MLBF5SplitsStore?

    @State private var store = SearchStore()

    /// MLB player-prop detail pushed locally (Players row tap, props chip tap).
    @State private var selectedProp: PlayerPropSelection?
    /// NFL player-prop detail pushed locally from Players search results.
    @State private var selectedNFLProp: NFLPlayerPropSelection?
    @Namespace private var propNS
    /// Expanded insight surface pushed locally (insight chip tap).
    @State private var insightDestination: SearchInsightDestination?
    /// Tapped Outliers trend card → presented full in a bottom sheet (the same
    /// one the Outliers tab uses), keeping the user in their search results.
    @State private var selectedTrend: SearchStore.SearchResult.Trend?

    /// `initialQuery` pre-seeds the search field — screenshot harness only.
    init(initialQuery: String = "") {
        let seeded = SearchStore()
        if !initialQuery.isEmpty {
            seeded.query = initialQuery
            seeded.flushDebounce()
        }
        _store = State(initialValue: seeded)
    }

    var body: some View {
        @Bindable var binding = store
        NavigationStack {
            List {
                if !store.debouncedQuery.isEmpty {
                    activeSearchSections
                } else if let browse = store.browseScope {
                    // Explore card tapped → keep the rail as a category switcher
                    // and show that category's full list below it.
                    exploreCardsSection
                    browseSections(browse)
                } else {
                    emptyStateSections
                }
            }
            // Plain (not insetGrouped) so rows span the full screen width — that's
            // what lets the horizontal scrollers (Explore / sport chips / Outliers
            // rail) run true edge-to-edge instead of being clipped at grouped margins.
            .listStyle(.plain)
            // Hide the system list backing so our appSurface shows through every row /
            // section header uniformly (no stray plain-list cell shading behind sections).
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Color.appSurface)
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .searchable(
                text: $binding.query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search games, players, agents\u{2026}"
            )
            // Scope chips render in the system-provided slot just under the
            // search field. `.onTextEntry` shows them only while the field
            // has text — an empty query has nothing to scope. Must be
            // attached unconditionally: wrapping this in an if/else keyed on
            // the query flips the view's structural identity on the first
            // keystroke, which rebuilds the search field and drops focus.
            .searchScopes($binding.scope, activation: .onTextEntry) {
                ForEach(SearchStore.SearchScope.allCases, id: \.self) { s in
                    Text(s.label).tag(s)
                }
            }
            // Pressing return/search records the query into Recents — without
            // this, a search was only ever captured when the user tapped a
            // result, so submitted-but-not-tapped searches were lost. Flush the
            // 200ms debounce first so the live text (not the lagging debounced
            // value) is what gets committed.
            .onSubmit(of: .search) {
                store.flushDebounce()
                store.commitCurrentQueryToRecents()
            }
            .task {
                // Wire the SearchStore to whatever upstream stores the tab
                // shell injected. Safe to re-call if any env value changes
                // (it just overwrites the weak refs).
                store.bind(
                    games: gamesEnv,
                    agents: agentsEnv,
                    trends: trendsEnv,
                    props: propsEnv
                )
                // A harness-seeded query skips the keystroke hook below, so
                // hydrate the insight slates here too (all TTL-idempotent).
                if !store.debouncedQuery.isEmpty { hydrateInsightSources() }
            }
            .navigationDestination(item: $insightDestination) { dest in
                insightDestinationView(dest)
            }
            .navigationDestination(item: $selectedProp) { selection in
                PlayerPropDetailView(selection: selection)
                    .navigationTransition(.zoom(sourceID: selection.transitionID, in: propNS))
            }
            .navigationDestination(item: $selectedNFLProp) { selection in
                NFLPropDetailView(selection: selection)
                    .navigationTransition(.zoom(sourceID: selection.transitionID, in: propNS))
            }
            .sheet(item: $selectedTrend) { trend in
                OutliersTrendDetailSheet(card: trend.card, sport: trend.sport, game: trend.game)
            }
            .onChange(of: store.debouncedQuery) { _, newQuery in
                // First real keystroke that produces a debounced query →
                // fetch the public agents leaderboard so cross-user agent
                // matches start surfacing, plus the MLB insight slates that
                // feed the matchup cards' chips. All idempotent/TTL-guarded.
                if !newQuery.isEmpty {
                    Task { await store.loadPublicAgentsIfNeeded() }
                    hydrateInsightSources()
                }
            }
        }
    }

    /// Explore card tapped → enter browse mode for that category and kick off
    /// whatever upstream fetch its results need (same lazy sources the query
    /// path uses, all idempotent/TTL-guarded).
    private func startBrowse(_ scope: SearchStore.SearchScope) {
        store.commitCurrentQueryToRecents()
        store.browse(scope)
        switch scope {
        case .players, .outliers:
            hydrateInsightSources()
        case .agents:
            Task { await store.loadPublicAgentsIfNeeded() }
        default:
            break
        }
    }

    /// Lazily hydrate the slates behind the insight chips — fired on the
    /// first non-empty query, not at shell mount (search may never be used).
    private func hydrateInsightSources() {
        // Lazy-load the cross-sport Outliers trend index the first time search is
        // used (internally guarded — no-op once loaded or while a load is in flight).
        if let outlierTrends = trendsEnv {
            Task { await outlierTrends.loadSearchIndexIfNeeded() }
        }
        if let trends = mlbTrendsEnv {
            Task { await trends.refreshIfNeeded() }
        }
        if let f5 = mlbF5Env {
            Task { await f5.refreshIfStale() }
        }
        if let props = propsEnv {
            Task {
                await props.refreshMLB()
                await props.refreshNFL()
            }
        }
    }

    // MARK: - Empty state (no query)

    /// Two-section empty state. "Recent searches" only renders when there's
    /// history — first-launch users see the Suggestions section alone so the
    /// surface never looks barren.
    @ViewBuilder
    private var emptyStateSections: some View {
        exploreCardsSection

        if !store.recentQueries.isEmpty {
            Section {
                // Recents as a single edge-to-edge chip rail (tap to re-run).
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(store.recentQueries, id: \.self) { recent in
                            Button {
                                store.applyRecent(recent)
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(Color.appTextSecondary)
                                    Text(recent)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(Color.appTextPrimary)
                                        .lineLimit(1)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Capsule().fill(Color.appSurfaceMuted))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .contentMargins(.horizontal, 16, for: .scrollContent)
                .scrollClipDisabled()
                .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            } header: {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 11, weight: .bold))
                    Text("Recent")
                        .textCase(.uppercase)
                    Spacer()
                    Button("Clear") {
                        store.clearRecentQueries()
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .textCase(nil)
                    .tint(Color.appPrimary)
                }
                .foregroundStyle(.secondary)
            }
        }

        Section {
            sportChipsRow
            ForEach(BrowseEntry.allCases, id: \.self) { entry in
                Button {
                    activate(entry)
                } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(entry.tint.opacity(0.16))
                            Image(systemName: entry.icon)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(entry.tint)
                        }
                        .frame(width: 36, height: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.title)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text(entry.subtitle)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                    }
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        } header: {
            sectionHeader("Suggestions", icon: "lightbulb.fill")
        }
    }

    /// Explore rail — animated feature cards for the app's browsable sections
    /// and tools (see SearchToolCards.swift for the looping graphics) in a
    /// horizontal scroller with view-aligned snapping. Fixed card width keeps
    /// ~2 cards visible with the next one peeking in from the trailing edge.
    private var exploreCardsSection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                SearchToolCard(
                    title: "Props",
                    subtitle: "Player prop matchups",
                    isSelected: store.browseScope == .players,
                    action: { startBrowse(.players) }
                ) {
                    AngledStatSheetGraphic(rows: [
                        ("figure.baseball", "Judge O 1.5 total bases"),
                        ("target", "Has 4 hits in last 10"),
                        ("flame.fill", "8+ K's in 3 straight"),
                        ("baseball.fill", "Ohtani O 0.5 HR +320"),
                        ("chart.bar.fill", "Hits prop cashing 70%"),
                        ("bolt.fill", "Skenes 7+ K streak"),
                    ], startDelay: 0.8)
                }
                .frame(width: Self.exploreCardWidth)

                SearchToolCard(
                    title: "Agents",
                    subtitle: "Top performing AI experts",
                    isSelected: store.browseScope == .agents,
                    action: { startBrowse(.agents) }
                ) {
                    StackedStatCardsGraphic(items: [
                        ("100%", "10/10"),
                        ("+12.4u", "Last 30"),
                        ("73%", "ATS picks"),
                        ("58-31", "Season"),
                    ], startDelay: 0.4)
                }
                .frame(width: Self.exploreCardWidth)

                SearchToolCard(
                    title: "Outliers",
                    subtitle: "Situational betting trends",
                    isSelected: store.browseScope == .outliers,
                    action: { startBrowse(.outliers) }
                ) { RadarSweepGraphic() }
                .frame(width: Self.exploreCardWidth)
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            // Full-bleed row (leading/trailing insets 0) + 16pt content margin gives
            // the cards breathing room while the scroller itself runs screen-edge to
            // screen-edge; scrollClipDisabled lets cards bleed past the edges, unmasked.
            .contentMargins(.horizontal, 16, for: .scrollContent)
            .scrollClipDisabled()
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 8, trailing: 0))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
        } header: {
            sectionHeader("Explore", icon: "sparkles")
        }
    }

    /// Width of one explore card — sized so two cards show on a 393pt screen
    /// with the third peeking ~30pt in from the trailing edge to invite the
    /// scroll.
    private static let exploreCardWidth: CGFloat = 158

    /// Horizontal row of one-tap sport pills — pre-seeds the search field
    /// with the sport's label so the user can drill into "NBA" without
    /// typing it. Each pill is a button rather than a NavigationLink so the
    /// activation pattern is consistent with the result rows below.
    private var sportChipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(SearchStore.GamesStoreSport.allCases, id: \.self) { sport in
                    Button {
                        store.query = sport.label
                        store.flushDebounce()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: sportIcon(sport))
                                .font(.system(size: 13, weight: .semibold))
                            Text(sport.label)
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            Capsule().fill(Color.appSurfaceMuted)
                        )
                        .foregroundStyle(Color.appTextPrimary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        }
        // Full-bleed, edge-to-edge, unmasked — same treatment as the other scrollers.
        .contentMargins(.horizontal, 16, for: .scrollContent)
        .scrollClipDisabled()
        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    // MARK: - Active search (with query)

    @ViewBuilder
    private var activeSearchSections: some View {
        // The Outliers cross-sport index loads over the network; the other sources
        // are in-memory, so this is the one section that needs a real loading state.
        let trendsLoading = trendsEnv?.isLoadingSearchIndex ?? false

        // Outliers is the only async scope; its in-flight load should suppress
        // the empty state only when the user is actually viewing it (or All).
        let outliersScopeLoading = trendsLoading && (store.scope == .all || store.scope == .outliers)

        if store.isDebouncing && store.totalResultCount == 0 {
            // Card-shaped scaffold while the 200ms debounce settles, so the loading
            // state reads as result cards arriving rather than a spinner.
            searchLoadingScaffold
        } else if visibleResultCount == 0 && !outliersScopeLoading && !store.isDebouncing {
            // Scope-aware: when a specific tab (Matchup / Props / Agents /
            // Outliers) has no matches we still show the empty state, even if a
            // *different* scope has results.
            ContentUnavailableView.search(text: store.debouncedQuery)
                .listRowBackground(Color.clear)
        } else {
            if showsScope(.games) && !store.gameResults.isEmpty {
                Section(header: sectionHeader("Matchup", icon: "sportscourt.fill", count: store.gameResults.count)) {
                    ForEach(store.gameResults) { result in
                        // Render the EXACT per-sport matchup card from the Games feed.
                        matchupCard(result)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 4)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }
            }
            if showsScope(.players) {
                let players = store.playerResults
                if !players.isEmpty {
                    Section(header: sectionHeader("Props", icon: "figure.run", count: players.count)) {
                        ForEach(players) { player in
                            playerResultRow(player)
                        }
                    }
                }
            }
            if showsScope(.agents) && !store.agentResults.isEmpty {
                Section(header: sectionHeader("Agents", icon: "brain.head.profile", count: store.agentResults.count)) {
                    ForEach(store.agentResults) { result in
                        // The same AgentRowCard the Agents tab renders.
                        AgentRowCard(agent: result.model, onTap: { openAgent(result) })
                            .padding(.vertical, 4)
                            .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }
            }
            if showsScope(.outliers) {
                if !store.trendResults.isEmpty {
                    Section(header: sectionHeader("Outliers", icon: "chart.line.uptrend.xyaxis", count: store.trendResults.count)) {
                        outliersRail(store.trendResults)
                    }
                } else if trendsLoading {
                    // Cross-sport index still fetching → shimmer rail in its place.
                    Section(header: sectionHeader("Outliers", icon: "chart.line.uptrend.xyaxis")) {
                        outliersShimmerRail
                    }
                }
            }
        }
    }

    /// Real Outliers carousel — the OutliersTrendCard rail, edge-to-edge + unmasked.
    private func outliersRail(_ results: [SearchStore.SearchResult.Trend]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(alignment: .top, spacing: 12) {
                ForEach(results) { result in
                    // The same OutliersTrendCard the Outliers tab renders.
                    Button { openTrend(result) } label: {
                        OutliersTrendCard(card: result.card, sport: result.sport, game: result.game)
                            .frame(width: 300)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        }
        .contentMargins(.horizontal, 16, for: .scrollContent)
        .scrollClipDisabled()
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    // MARK: - Loading shimmer scaffolding

    /// Shown the instant a search is submitted (debounce window): representative
    /// card skeletons under real section headers so the result cards appear to
    /// fade in rather than pop after a blank pause. Reuses each feed's own shimmer.
    @ViewBuilder
    private var searchLoadingScaffold: some View {
        Section(header: sectionHeader("Matchup", icon: "sportscourt.fill")) {
            GameCardShimmer()
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
        }
        Section(header: sectionHeader("Outliers", icon: "chart.line.uptrend.xyaxis")) {
            outliersShimmerRail
        }
    }

    /// Shimmer placeholder rail for the Outliers section while the cross-sport
    /// index fetches — same geometry as `outliersRail` so the swap doesn't shift.
    private var outliersShimmerRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    OutliersTrendCardShimmer()
                        .frame(width: 300)
                }
            }
            .padding(.vertical, 4)
        }
        .contentMargins(.horizontal, 16, for: .scrollContent)
        .scrollClipDisabled()
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    // MARK: - Browse (Explore card tapped, no query)

    /// One full-category result list shown when an Explore card is tapped. Each
    /// case reuses the exact result rows the query path renders, falls back to
    /// that feed's shimmer while its slate loads, and to a Back-to-Explore
    /// empty state when nothing is available.
    @ViewBuilder
    private func browseSections(_ scope: SearchStore.SearchScope) -> some View {
        switch scope {
        case .players:
            let players = store.browsePlayerResults
            if !players.isEmpty {
                Section(header: browseHeader("Props", icon: "figure.run", count: players.count)) {
                    ForEach(players) { playerResultRow($0) }
                }
            } else if (propsEnv?.isLoadingMLB ?? false) || (propsEnv?.isLoadingNFL ?? false) {
                Section(header: browseHeader("Props", icon: "figure.run")) {
                    ForEach(0..<4, id: \.self) { _ in
                        PropCardShimmer()
                            .padding(.horizontal, 16)
                            .padding(.vertical, 4)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }
            } else {
                browseEmpty("No props available", "Player props load in-season. Check back when games are on the board.")
            }
        case .agents:
            let agents = store.browseAgentResults
            if !agents.isEmpty {
                Section(header: browseHeader("Agents", icon: "brain.head.profile", count: agents.count)) {
                    ForEach(agents) { result in
                        AgentRowCard(agent: result.model, onTap: { openAgent(result) })
                            .padding(.vertical, 4)
                            .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }
            } else if store.isLoadingPublicAgents {
                Section(header: browseHeader("Agents", icon: "brain.head.profile")) {
                    ForEach(0..<4, id: \.self) { _ in
                        AgentRowCardShimmer()
                            .padding(.vertical, 4)
                            .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }
            } else {
                browseEmpty("No agents yet", "Create an agent or follow the leaderboard to see picks experts here.")
            }
        case .outliers:
            let trends = store.browseTrendResults
            if !trends.isEmpty {
                Section(header: browseHeader("Outliers", icon: "chart.line.uptrend.xyaxis", count: trends.count)) {
                    outliersRail(trends)
                }
            } else if trendsEnv?.isLoadingSearchIndex ?? false {
                Section(header: browseHeader("Outliers", icon: "chart.line.uptrend.xyaxis")) {
                    outliersShimmerRail
                }
            } else {
                browseEmpty("No outliers available", "Situational trends load per sport. Try again once games are scheduled.")
            }
        default:
            EmptyView()
        }
    }

    /// Section header for a browse list — same look as `sectionHeader` plus a
    /// trailing Clear button that returns to the empty-state launchpad.
    private func browseHeader(_ title: String, icon: String, count: Int? = nil) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
            Text(title)
                .textCase(.uppercase)
            if let count {
                Text("\(count)")
                    .foregroundStyle(Color.appTextMuted)
                    .textCase(nil)
            }
            Spacer()
            Button("Clear") { store.exitBrowse() }
                .font(.system(size: 12, weight: .semibold))
                .textCase(nil)
                .tint(Color.appPrimary)
        }
        .foregroundStyle(.secondary)
    }

    /// Empty state for a browse category whose slate has no rows — offers a way
    /// back to the launchpad rather than dead-ending.
    private func browseEmpty(_ title: String, _ message: String) -> some View {
        ContentUnavailableView {
            Label(title, systemImage: "magnifyingglass")
        } description: {
            Text(message)
        } actions: {
            Button("Back to Explore") { store.exitBrowse() }
        }
        .listRowBackground(Color.clear)
    }

    private func showsScope(_ s: SearchStore.SearchScope) -> Bool {
        store.scope == .all || store.scope == s
    }

    /// Result count for the currently selected scope — drives the scope-aware
    /// empty state. `.all` sums every scope; a single scope counts only itself.
    private var visibleResultCount: Int {
        switch store.scope {
        case .all: return store.totalResultCount
        case .games: return store.gameResults.count
        case .players: return store.playerResults.count
        case .agents: return store.agentResults.count
        case .outliers: return store.trendResults.count
        }
    }

    private func sectionHeader(_ title: String, icon: String, count: Int? = nil) -> some View {
        HStack(spacing: 6) {
            // Icon inherits the header's secondary label color so it matches the title.
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
            Text(title)
                .textCase(.uppercase)
            Spacer()
            if let count {
                Text("\(count)")
                    .foregroundStyle(Color.appTextMuted)
                    .textCase(nil)
            }
        }
        .foregroundStyle(.secondary)
    }

    // MARK: - Result cards

    /// The exact per-sport matchup card from the Games feed, resolved from the
    /// bound GamesStore by `resolvedId`. Tapping hands off to the Games tab and
    /// opens the detail sheet (same `openGame` path the plain row used).
    @ViewBuilder
    private func matchupCard(_ result: SearchStore.SearchResult.Game) -> some View {
        let onPress = { openGame(result) }
        switch result.sport {
        case .nfl:
            if let g = gamesEnv?.games.nfl.first(where: { $0.uniqueId == result.resolvedId }) {
                NFLGameCard(game: g, onPress: onPress)
            }
        case .cfb:
            if let g = gamesEnv?.games.cfb.first(where: { $0.uniqueId == result.resolvedId }) {
                CFBGameCard(game: g, onPress: onPress)
            }
        case .nba:
            if let g = gamesEnv?.games.nba.first(where: { $0.id == result.resolvedId }) {
                NBAGameCard(game: g, onPress: onPress)
            }
        case .ncaab:
            if let g = gamesEnv?.games.ncaab.first(where: { $0.id == result.resolvedId }) {
                NCAABGameCard(game: g, onPress: onPress)
            }
        case .mlb:
            if let g = gamesEnv?.games.mlb.first(where: { $0.id == result.resolvedId }) {
                MLBGameCard(game: g, onPress: onPress)
            }
        }
    }

    private func sportIcon(_ sport: SearchStore.GamesStoreSport) -> String {
        switch sport {
        case .nfl, .cfb: return "football.fill"
        case .nba, .ncaab: return "basketball.fill"
        case .mlb: return "baseball.fill"
        }
    }

    // MARK: - Navigation handoff
    //
    // SearchView lives in its own NavigationStack — we can't push into the
    // Games / Agents / Outliers / Scoreboard stacks directly. The handoff
    // pattern: commit the query to recents, set the target tab on the
    // shared `MainTabStore`, then ask the destination tab's store to open
    // its detail surface. The destination tab's view (which is already
    // mounted as part of the TabView's lazy lifecycle) reacts to the store
    // mutation in its existing `.sheet(item:)` / `.navigationDestination`
    // observers — no extra wiring needed.

    private func openGame(_ result: SearchStore.SearchResult.Game) {
        store.commitCurrentQueryToRecents()
        // Switch the tab first so the destination view has a frame to mount
        // its sheet against. Setting selected is idempotent if the user is
        // already on .games.
        tabStore.select(.games)
        // Resolve the actual game model from the upstream GamesStore and
        // open the per-sport sheet. If GamesStore wasn't injected (i.e.
        // the concurrent MainTabView refactor hasn't lifted stores yet), we
        // still land the user on Games — they can find the game manually.
        guard let games = gamesEnv else { return }
        switch result.sport {
        case .nfl:
            if let g = games.games.nfl.first(where: { $0.uniqueId == result.resolvedId }) {
                nflSheetEnv?.openGameSheet(g)
            }
        case .cfb:
            if let g = games.games.cfb.first(where: { $0.uniqueId == result.resolvedId }) {
                cfbSheetEnv?.openGameSheet(g)
            }
        case .nba:
            if let g = games.games.nba.first(where: { $0.id == result.resolvedId }) {
                nbaSheetEnv?.openGameSheet(g)
            }
        case .ncaab:
            if let g = games.games.ncaab.first(where: { $0.id == result.resolvedId }) {
                ncaabSheetEnv?.openGameSheet(g)
            }
        case .mlb:
            if let g = games.games.mlb.first(where: { $0.id == result.resolvedId }) {
                mlbSheetEnv?.openGameSheet(g)
            }
        }
    }

    private func openAgent(_ result: SearchStore.SearchResult.Agent) {
        store.commitCurrentQueryToRecents()
        // Agents detail lives inside AgentsView's NavigationStack — we can't
        // push into another tab's stack directly. So switch to the Agents tab,
        // then hand it the exact detail route to open: AgentsView observes
        // `pendingAgentRoute` and appends the matching `AgentsRoute` to its own
        // path (own agent → owner detail, public/leaderboard → public detail).
        tabStore.select(.agents)
        tabStore.pendingAgentRoute = .init(agentId: result.agentId, isPublic: result.isPublic)
    }

    private func openTrend(_ result: SearchStore.SearchResult.Trend) {
        store.commitCurrentQueryToRecents()
        // Present the full trend card in the same bottom sheet the Outliers tab
        // uses, rather than switching tabs — the user stays in their results.
        selectedTrend = result
    }

    // MARK: - MLB insight chips (matchup cards)

    /// Resolve the typed MLB game for a search result — chips key off gamePk.
    private func mlbGamePk(for result: SearchStore.SearchResult.Game) -> Int? {
        gamesEnv?.games.mlb.first(where: { $0.id == result.resolvedId })?.gamePk
    }

    /// Teasers computed from the Kit insight adapters over the env slates.
    /// Absent kind (slate loaded, game missing) = chip hidden; SwiftUI
    /// observation re-renders the chips as the stores land.
    private func insightTeasers(for result: SearchStore.SearchResult.Game, gamePk: Int) -> [InsightTeaser] {
        var out: [InsightTeaser] = []
        if let trends = mlbTrendsEnv?.trends(for: gamePk) {
            out.append(MLBTrendsInsight.teaser(for: trends, matchedAbbr: result.matchedAbbr))
        }
        if let matchup = mlbF5Env?.matchup(for: gamePk),
           let teaser = MLBF5Insight.teaser(for: matchup, matchedAbbr: result.matchedAbbr) {
            out.append(teaser)
        }
        if let matchup = propsEnv?.matchup(for: gamePk),
           let teaser = MLBPropsInsight.teaser(for: matchup) {
            out.append(teaser)
        }
        return out
    }

    /// First-hydrate shimmer chips — only while a slate has never loaded.
    private func insightLoadingKinds(gamePk: Int) -> Set<InsightTeaser.Kind> {
        var kinds: Set<InsightTeaser.Kind> = []
        if let trends = mlbTrendsEnv, trends.loading, trends.lastFetched == nil { kinds.insert(.trends) }
        if let f5 = mlbF5Env, f5.isLoading, f5.lastFetched == nil { kinds.insert(.f5) }
        if let props = propsEnv, props.isLoadingMLB, !props.hasLoadedMLB { kinds.insert(.props) }
        return kinds
    }

    /// Insight chips push their expanded surface LOCALLY in Search's stack
    /// (only the matchup header row does the cross-tab handoff).
    private func openInsight(_ kind: InsightTeaser.Kind, gamePk: Int) {
        store.commitCurrentQueryToRecents()
        switch kind {
        case .trends:
            insightDestination = SearchInsightDestination(kind: .trends(gamePk: gamePk))
        case .f5:
            insightDestination = SearchInsightDestination(kind: .f5(gamePk: gamePk))
        case .props:
            // One unambiguous hot play (≥70% L10) goes straight to that
            // player's detail page; otherwise the full list.
            if let matchup = propsEnv?.matchup(for: gamePk) {
                let hot = PlayerPropFeed.items(from: [matchup]).filter {
                    $0.headline.computed.l10.games > 0 && ($0.headline.computed.l10.pct ?? 0) >= 70
                }
                if hot.count == 1, let only = hot.first {
                    selectedProp = only.selection
                    return
                }
            }
            insightDestination = SearchInsightDestination(kind: .propsList(gamePk: gamePk))
        }
    }

    @ViewBuilder
    private func playerResultRow(_ player: SearchStore.SearchResult.Player) -> some View {
        switch player.kind {
        case .mlb:
            if let item = mlbPropItem(for: player) {
                PropPlayerCard(item: item, namespace: propNS) { selection in
                    store.commitCurrentQueryToRecents()
                    selectedProp = selection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 4)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        case .nfl:
            if let item = nflPropItem(for: player) {
                NFLPropPlayerCard(item: item, namespace: propNS) { selection in
                    store.commitCurrentQueryToRecents()
                    selectedNFLProp = selection
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 4)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
        }
    }

    /// Resolve an MLB player result's feed item at render time.
    private func mlbPropItem(for player: SearchStore.SearchResult.Player) -> PlayerPropFeedItem? {
        guard case .mlb(let gamePk, let playerId, _) = player.kind else { return nil }
        guard let matchup = propsEnv?.matchup(for: gamePk) else { return nil }
        return PlayerPropFeed.items(from: [matchup]).first { $0.selection.playerId == playerId }
    }

    /// Resolve an NFL player result's feed item at render time.
    private func nflPropItem(for player: SearchStore.SearchResult.Player) -> NFLPropFeedItem? {
        guard case .nfl(let playerKey, _) = player.kind else { return nil }
        guard let nflPlayer = propsEnv?.nflPlayers.first(where: { $0.id == playerKey }) else { return nil }
        return NFLPropFeed.items(from: [nflPlayer]).first
    }

    @ViewBuilder
    private func insightDestinationView(_ dest: SearchInsightDestination) -> some View {
        switch dest.kind {
        case .trends(let gamePk):
            if let trends = mlbTrendsEnv?.trends(for: gamePk) {
                BettingTrendsDetailSheet(
                    awayName: trends.awayTeam.teamName,
                    homeName: trends.homeTeam.teamName,
                    timeDisplay: MLBTrendsMatrixAdapter.timeDisplay(for: trends),
                    stripeColors: MLBTrendsMatrixAdapter.stripeColors(for: trends),
                    accent: MLBTrendsMatrixAdapter.accent,
                    sections: MLBTrendsMatrixAdapter.sections(for: trends),
                    guide: .mlb,
                    avatar: MLBTrendsMatrixAdapter.avatarProvider(for: trends),
                    onViewMatchup: mlbMatchupHandoff(gamePk: gamePk)
                )
            } else {
                insightUnavailable
            }
        case .f5(let gamePk):
            if let matchup = mlbF5Env?.matchup(for: gamePk) {
                F5SplitsDetailSheet(matchup: matchup)
            } else {
                insightUnavailable
            }
        case .propsList(let gamePk):
            if let matchup = propsEnv?.matchup(for: gamePk) {
                ScrollView {
                    MatchupPropsListBody(matchup: matchup, zoomNamespace: propNS) { selectedProp = $0 }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 32)
                }
                .background(Color.appSurface)
                .navigationTitle("\(matchup.awayAbbr) @ \(matchup.homeAbbr) Props")
                .navigationBarTitleDisplayMode(.inline)
            } else {
                insightUnavailable
            }
        }
    }

    private var insightUnavailable: some View {
        ContentUnavailableView(
            "Not available",
            systemImage: "chart.bar",
            description: Text("This data isn't loaded right now. Pull the source tab to refresh and try again.")
        )
    }

    /// Game-page handoff for the trends detail's "View matchup" button —
    /// ported from the retired MLBBettingTrendsView.matchupAction. nil (game
    /// not in the Games cache) hides the button instead of dead-ending.
    private func mlbMatchupHandoff(gamePk: Int) -> (() -> Void)? {
        guard let game = gamesEnv?.games.mlb.first(where: { $0.gamePk == gamePk }) else { return nil }
        return {
            insightDestination = nil
            tabStore.select(.games)
            mlbSheetEnv?.openGameSheet(game)
        }
    }

    private func activate(_ entry: BrowseEntry) {
        store.commitCurrentQueryToRecents()
        switch entry {
        case .trendingAgents:
            tabStore.select(.agents)
        case .topOutliers:
            tabStore.select(.outliers)
        }
    }
}

/// Which expanded insight surface an insight chip pushes (locally, inside
/// Search's own NavigationStack — the Angles-card precedent).
struct SearchInsightDestination: Identifiable, Hashable {
    enum Kind: Hashable {
        case trends(gamePk: Int)
        case f5(gamePk: Int)
        case propsList(gamePk: Int)
    }
    let kind: Kind
    var id: Kind { kind }
}

// MARK: - Browse entries

/// Suggestion-row destinations shown in the empty state. Each lands the user
/// on a top-of-hierarchy tab; we don't try to deep-link into a specific
/// category because the search experience is meant to be a launchpad, not a
/// router.
private enum BrowseEntry: CaseIterable, Hashable {
    case trendingAgents
    case topOutliers

    var icon: String {
        switch self {
        case .trendingAgents: return "brain.head.profile"
        case .topOutliers: return "bell.badge.fill"
        }
    }

    var tint: Color {
        switch self {
        case .trendingAgents: return Color.appAccentPurple
        case .topOutliers: return Color.appAccentAmber
        }
    }

    var title: String {
        switch self {
        case .trendingAgents: return "Trending agents"
        case .topOutliers: return "Top outliers"
        }
    }

    var subtitle: String {
        switch self {
        case .trendingAgents: return "Browse the leaderboard"
        case .topOutliers: return "Situational betting trends"
        }
    }
}
