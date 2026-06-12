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
//   .environment(GamesStore.self)          — game results across NFL/CFB/NBA/NCAAB/MLB
//   .environment(AgentsStore.self)         — own-agent name matches
//   .environment(OutliersStore.self)       — value & fade alert matches
//   .environment(LiveScoresStore.self)     — live-score team matches
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
///   - Segmented scope chip row (`All / Games / Agents / Alerts / Live`)
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
    @Environment(OutliersStore.self) private var outliersEnv: OutliersStore?
    @Environment(LiveScoresStore.self) private var liveScoresEnv: LiveScoresStore?

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

    /// Player-prop detail pushed locally (Players row tap, props chip tap).
    @State private var selectedProp: PlayerPropSelection?
    @Namespace private var propNS
    /// Expanded insight surface pushed locally (insight chip tap).
    @State private var insightDestination: SearchInsightDestination?

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
                if store.debouncedQuery.isEmpty {
                    emptyStateSections
                } else {
                    activeSearchSections
                }
            }
            .listStyle(.insetGrouped)
            .scrollDismissesKeyboard(.interactively)
            .background(Color.appSurface)
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .searchable(
                text: $binding.query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search games, agents, alerts\u{2026}"
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
            .task {
                // Wire the SearchStore to whatever upstream stores the tab
                // shell injected. Safe to re-call if any env value changes
                // (it just overwrites the weak refs).
                store.bind(
                    games: gamesEnv,
                    agents: agentsEnv,
                    outliers: outliersEnv,
                    liveScores: liveScoresEnv,
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

    /// Lazily hydrate the slates behind the insight chips — fired on the
    /// first non-empty query, not at shell mount (search may never be used).
    private func hydrateInsightSources() {
        if let trends = mlbTrendsEnv {
            Task { await trends.refreshIfNeeded() }
        }
        if let f5 = mlbF5Env {
            Task { await f5.refreshIfStale() }
        }
        if let props = propsEnv {
            Task { await props.refreshMLB() }
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
                ForEach(store.recentQueries, id: \.self) { recent in
                    Button {
                        store.applyRecent(recent)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "clock.arrow.circlepath")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.appTextSecondary)
                                .frame(width: 24)
                            Text(recent)
                                .font(.system(size: 16))
                                .foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            Image(systemName: "arrow.up.left")
                                .font(.system(size: 13))
                                .foregroundStyle(Color.appTextMuted)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                HStack {
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
            }
        } header: {
            Text("Suggestions").textCase(.uppercase)
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
                    action: {
                        store.commitCurrentQueryToRecents()
                        tabStore.select(.props)
                    }
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
                    action: {
                        store.commitCurrentQueryToRecents()
                        tabStore.select(.agents)
                    }
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
                    subtitle: "Value & fade alerts",
                    action: {
                        store.commitCurrentQueryToRecents()
                        tabStore.select(.outliers)
                    }
                ) { RadarSweepGraphic() }
                .frame(width: Self.exploreCardWidth)
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            // The insetGrouped List keeps ~16pt section margins no matter
            // what the row insets say. Disabling the scroll clip lets cards
            // draw across those margins to the physical screen edges while
            // scrolling; at rest they snap to the section margin (16pt
            // gutter), which doubles as the design's resting inset.
            .scrollClipDisabled()
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 8, trailing: 0))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
        } header: {
            Text("Explore").textCase(.uppercase)
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
        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 0))
    }

    // MARK: - Active search (with query)

    @ViewBuilder
    private var activeSearchSections: some View {
        if store.isDebouncing && store.totalResultCount == 0 {
            // Skeleton rows shaped like SearchResultRow while the 200ms
            // debounce settles, so the loading state reads as results
            // arriving rather than a spinner. Suppressed once we have stale
            // results to render (the `== 0` guard above).
            Section(header: Text("Searching").textCase(.uppercase)) {
                ForEach(0..<5, id: \.self) { _ in
                    SearchResultRowSkeleton()
                }
            }
        }

        if store.totalResultCount == 0 && !store.isDebouncing {
            ContentUnavailableView.search(text: store.debouncedQuery)
                .listRowBackground(Color.clear)
        } else {
            if showsScope(.games) && !store.gameResults.isEmpty {
                Section(header: sectionHeader("Games", count: store.gameResults.count)) {
                    ForEach(store.gameResults) { result in
                        // MLB (in season) gets the rich matchup card with the
                        // insight-chip rail; other sports keep the plain row —
                        // zero regression while their chips are deferred.
                        if result.sport == .mlb, let gamePk = mlbGamePk(for: result) {
                            SearchMatchupCard(
                                result: result,
                                teasers: insightTeasers(for: result, gamePk: gamePk),
                                loadingKinds: insightLoadingKinds(gamePk: gamePk),
                                onOpenGame: { openGame(result) },
                                onOpenInsight: { kind in openInsight(kind, gamePk: gamePk) }
                            )
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                        } else {
                            SearchResultRow(
                                icon: "trophy.fill",
                                tint: Color.appPrimary,
                                primary: "\(result.awayTeam) @ \(result.homeTeam)",
                                secondary: gameSecondary(result),
                                onTap: { openGame(result) }
                            )
                        }
                    }
                }
            }
            if showsScope(.players) {
                let players = store.playerResults.compactMap { player in
                    propItem(for: player).map { (player: player, item: $0) }
                }
                if !players.isEmpty {
                    Section(header: sectionHeader("Players", count: players.count)) {
                        ForEach(players, id: \.player.id) { entry in
                            PropPlayerCard(item: entry.item, namespace: propNS) { selection in
                                store.commitCurrentQueryToRecents()
                                selectedProp = selection
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 4)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                        }
                    }
                }
            }
            if showsScope(.agents) && !store.agentResults.isEmpty {
                Section(header: sectionHeader("Agents", count: store.agentResults.count)) {
                    ForEach(store.agentResults) { result in
                        SearchResultRow(
                            icon: "brain.head.profile",
                            tint: Color.appAccentPurple,
                            primary: result.name,
                            secondary: agentSecondary(result),
                            trailingDetail: agentTrailing(result),
                            onTap: { openAgent(result) }
                        )
                    }
                }
            }
            if showsScope(.outliers) && !store.outlierResults.isEmpty {
                Section(header: sectionHeader("Alerts", count: store.outlierResults.count)) {
                    ForEach(store.outlierResults) { result in
                        SearchResultRow(
                            icon: "bell.badge.fill",
                            tint: Color.appAccentAmber,
                            primary: result.primaryLabel,
                            secondary: result.secondaryLabel,
                            onTap: { openOutlier(result) }
                        )
                    }
                }
            }
            if showsScope(.scores) && !store.scoreResults.isEmpty {
                Section(header: sectionHeader("Live", count: store.scoreResults.count)) {
                    ForEach(store.scoreResults) { result in
                        SearchResultRow(
                            icon: "sportscourt.fill",
                            tint: Color.appAccentBlue,
                            primary: scorePrimary(result),
                            secondary: scoreSecondary(result),
                            trailingDetail: result.isLive ? "LIVE" : nil,
                            onTap: { openScore(result) }
                        )
                    }
                }
            }
        }
    }

    private func showsScope(_ s: SearchStore.SearchScope) -> Bool {
        store.scope == .all || store.scope == s
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title)
                .textCase(.uppercase)
            Spacer()
            Text("\(count)")
                .foregroundStyle(Color.appTextMuted)
                .textCase(nil)
        }
    }

    // MARK: - Result row formatters

    private func gameSecondary(_ result: SearchStore.SearchResult.Game) -> String? {
        var parts: [String] = [result.sport.label]
        if let time = result.gameTime, !time.isEmpty {
            parts.append(prettyTime(time))
        }
        return parts.joined(separator: " \u{00B7} ")
    }

    private func agentSecondary(_ result: SearchStore.SearchResult.Agent) -> String? {
        var parts: [String] = []
        parts.append(result.isPublic ? "Public agent" : "Your agent")
        if let rate = result.winRate {
            // Win rate is stored as 0.0–1.0 in the leaderboard payload.
            parts.append("\(Int((rate * 100).rounded()))% W")
        }
        return parts.joined(separator: " \u{00B7} ")
    }

    private func agentTrailing(_ result: SearchStore.SearchResult.Agent) -> String? {
        guard let n = result.netUnits else { return nil }
        let sign = n >= 0 ? "+" : ""
        return String(format: "\(sign)%.1fu", n)
    }

    private func scorePrimary(_ result: SearchStore.SearchResult.Score) -> String {
        // "LAL 88 vs GSW 82" — fits in one line at body size; the result row
        // truncates if the abbreviations are unusually long.
        "\(result.awayAbbr) \(result.awayScore) vs \(result.homeAbbr) \(result.homeScore)"
    }

    private func scoreSecondary(_ result: SearchStore.SearchResult.Score) -> String {
        if result.timeRemaining.isEmpty {
            return result.league.uppercased()
        }
        return "\(result.league.uppercased()) \u{00B7} \(result.timeRemaining)"
    }

    /// Best-effort time formatter for game cards. The upstream `gameTime`
    /// fields are a mix of ISO 8601, "yyyy-MM-dd HH:mm:ss", and bare dates;
    /// we surface what we can parse, otherwise return the raw string.
    private func prettyTime(_ raw: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) {
            return Self.shortFormatter.string(from: d)
        }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) {
            return Self.shortFormatter.string(from: d)
        }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd HH:mm:ss"
        if let d = df.date(from: raw) {
            return Self.shortFormatter.string(from: d)
        }
        return raw
    }

    private static let shortFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale.current
        f.dateFormat = "EEE h:mm a"
        return f
    }()

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
        // Agents detail lives inside AgentsView's NavigationStack. We can't
        // push directly into another tab's stack, so the pragmatic handoff
        // is to switch to the Agents tab and rely on the user's next tap
        // landing them on their agent. A future enhancement: extend
        // MainTabStore with `pendingAgentRoute: AgentsRoute?` that
        // AgentsView observes and appends to its `navPath`.
        tabStore.select(.agents)
    }

    private func openOutlier(_ result: SearchStore.SearchResult.Outlier) {
        store.commitCurrentQueryToRecents()
        tabStore.select(.outliers)
        // Same caveat as agents — outlier detail push lives inside
        // OutliersView's stack. The user lands on the Outliers hub; a
        // future MainTabStore extension can carry the target category and
        // OutliersView can react.
    }

    private func openScore(_ result: SearchStore.SearchResult.Score) {
        store.commitCurrentQueryToRecents()
        tabStore.select(.scoreboard)
        // Live score detail modal opens from ScoreboardView's own sheet
        // store. Same handoff pattern — switch tab, user sees the live
        // game card and taps to drill in.
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

    /// Resolve a Player result's app-target feed item at render time (Kit
    /// only returns ids — `PlayerPropSelection` lives in the app target).
    private func propItem(for player: SearchStore.SearchResult.Player) -> PlayerPropFeedItem? {
        guard let matchup = propsEnv?.matchup(for: player.gamePk) else { return nil }
        return PlayerPropFeed.items(from: [matchup]).first { $0.selection.playerId == player.playerId }
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
        case .liveGames:
            tabStore.select(.scoreboard)
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
    case liveGames

    var icon: String {
        switch self {
        case .trendingAgents: return "brain.head.profile"
        case .topOutliers: return "bell.badge.fill"
        case .liveGames: return "sportscourt.fill"
        }
    }

    var tint: Color {
        switch self {
        case .trendingAgents: return Color.appAccentPurple
        case .topOutliers: return Color.appAccentAmber
        case .liveGames: return Color.appAccentBlue
        }
    }

    var title: String {
        switch self {
        case .trendingAgents: return "Trending agents"
        case .topOutliers: return "Top outliers"
        case .liveGames: return "Live games"
        }
    }

    var subtitle: String {
        switch self {
        case .trendingAgents: return "Browse the leaderboard"
        case .topOutliers: return "Value & fade alerts"
        case .liveGames: return "Current scoreboard"
        }
    }
}

// MARK: - Loading skeleton

/// Skeleton mirror of `SearchResultRow`: a 36pt leading icon square, a
/// two-line text stack (16pt primary / 13pt secondary), and a trailing
/// chevron placeholder. Shown while the debounce settles so the search list
/// reads as results arriving rather than a spinner. Only the inner
/// placeholder group shimmers (see GameCardShimmer for the shared pattern).
private struct SearchResultRowSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            // Matches SearchResultRow.iconBadge — 36pt rounded square.
            SkeletonBlock(width: 36, height: 36, cornerRadius: 8)
            VStack(alignment: .leading, spacing: 2) {
                SkeletonBlock(width: 170, height: 14)   // primary (16pt)
                SkeletonBlock(width: 110, height: 11)   // secondary (13pt)
            }
            Spacer(minLength: 8)
            SkeletonBlock(width: 10, height: 13, cornerRadius: 3) // chevron
        }
        .padding(.vertical, 8)
        .shimmering()
    }
}
