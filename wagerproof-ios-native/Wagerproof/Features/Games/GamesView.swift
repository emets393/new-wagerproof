import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Home Games tab. Ports `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx`.
///
/// Layout (per spec §8):
///   - Sport pills under the navigation header
///   - 2-column `LazyVGrid` of per-sport game cards
///   - Pull-to-refresh
///   - Searchable + sortable per sport
///   - Sheet presentations for per-sport game detail (NFL/CFB/NBA/NCAAB/MLB)
struct GamesView: View {
    @Environment(MainTabStore.self) private var tabStore
    // All stores hoisted to MainTabView so cross-tab surfaces (Outliers
    // matchups, SearchView results) drive game detail pushes via the same
    // shared instances.
    @Environment(GamesStore.self) private var store
    // Re-injected explicitly into the Settings navigationDestination so iOS 18+
    // configurePreferredTransition can resolve them before the nav environment
    // chain is established. See MainTabToolbar.wagerProofSettingsDestination.
    @Environment(AuthStore.self) private var auth
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(NFLGameSheetStore.self) private var nflSheetStore
    @Environment(CFBGameSheetStore.self) private var cfbSheetStore
    @Environment(NBAGameSheetStore.self) private var nbaSheetStore
    @Environment(NCAABGameSheetStore.self) private var ncaabSheetStore
    @Environment(MLBGameSheetStore.self) private var mlbSheetStore
    // Shell-hoisted MLB insight slates — handed to the MLB carousel so every
    // detail page (and SearchView) shares one trends/F5 fetch. Optional so
    // preview/harness mounts without the shell still render (the carousel
    // falls back to its own local stores).
    @Environment(MLBBettingTrendsStore.self) private var mlbTrendsStore: MLBBettingTrendsStore?
    @Environment(MLBF5SplitsStore.self) private var mlbF5Store: MLBF5SplitsStore?
    @State private var sortMenuVisible: Bool = false
    /// Drives the push to a per-sport analytics tool page (banner tap). New
    /// payload type, so it doesn't collide with the game-detail `item:`
    /// destinations on this stack.
    @State private var selectedTool: SportTool?
    /// Current page of the swipeable tool-banner carousel (reset when the
    /// selected sport changes so we never land on an out-of-range index).
    @State private var toolPage: Int = 0
    // Model-accuracy reports back the NBA/NCAAB tool banners. Owned locally
    // (not hoisted — the detail views own their own) purely so the banner can
    // hide when the report has zero rows (offseason / no slate). Loaded lazily
    // and only while their sport is selected. See `visibleTools`.
    @State private var nbaAccuracy = NBAModelAccuracyStore()
    @State private var ncaabAccuracy = NCAABModelAccuracyStore()

    // Shared namespace for the card→detail zoom transition. The source card
    // (`matchedTransitionSource`) and the pushed detail view
    // (`navigationTransition(.zoom)`) must reference the SAME namespace +
    // sourceID for the expand/collapse morph to fire; otherwise SwiftUI
    // falls back to a plain push. Source IDs are sport-prefixed so IDs can't
    // collide across leagues. iOS 18+ (deployment target is 18.0).
    @Namespace private var cardTransition

    init() {}

    var body: some View {
        @Bindable var binding = store
        @Bindable var nflSheet = nflSheetStore
        @Bindable var cfbSheet = cfbSheetStore
        @Bindable var nbaSheet = nbaSheetStore
        @Bindable var ncaabSheet = ncaabSheetStore
        @Bindable var mlbSheet = mlbSheetStore
        NavigationStack {
            // ScrollView at the root so the system can attach large-title
            // scroll-shrink. The sport picker is the FIRST row of scroll
            // content (it scrolls away with the content, mirroring Honeydew
            // MainMealPlanView where category controls scroll naturally
            // rather than being pinned). The user gets the iconic large-title
            // transition (big title at top → shrinks inline as you scroll)
            // and a native `.searchable` drawer that pins inside the nav bar.
            ScrollView {
                // The sport picker is the pinned header of an outer Section
                // (stays fixed under the nav bar). The inner LazyVStack does
                // NOT pin, so per-date headers scroll away inline with the
                // cards. Keeping the picker as scroll content (rather than a
                // safe-area inset) preserves the system's scroll-under glass
                // behavior for the large title and bars.
                LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                    Section {
                        LazyVStack(spacing: 8) {
                            toolBanners
                            bodyContent
                        }
                    } header: {
                        pickerBar
                    }
                }
            }
            .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Games")
                .navigationBarTitleDisplayMode(.large)
                // Per-tab `.searchable()` was dropped — search now lives in
                // the dedicated `Tab(role: .search)` slot (SearchView) which
                // queries across games/agents/outliers/scores.
                // Pattern §7 — single `await`, no nested Task. The store's
                // `refresh(sport:force:)` is the canonical refresh entry point;
                // we pass `force: true` here so pull-to-refresh always bypasses
                // the 5-minute cache TTL.
                .refreshable {
                    await store.refresh(sport: store.selectedSport, force: true)
                }
                .task {
                    await store.refreshAll()
                }
                // Load the model-accuracy report for whichever of NBA/NCAAB is
                // showing so `visibleTools` can drop the banner when it's empty.
                // Only the two accuracy sports fetch; guarded to load once.
                .task(id: store.selectedSport) {
                    switch store.selectedSport {
                    case .nba:
                        if case .idle = nbaAccuracy.loadState { await nbaAccuracy.refresh() }
                    case .ncaab:
                        if case .idle = ncaabAccuracy.loadState { await ncaabAccuracy.refresh() }
                    default:
                        break
                    }
                }
                .toolbar { mainToolbar }
            // Game details are full-page pushes now (was bottom sheets).
            // `navigationDestination(item:)` watches the store's
            // `selectedGame` binding — flipping it non-nil pushes the
            // detail view; the system clears it on back-nav. Same store is
            // shared via env so OutliersView / SearchView can drive the
            // push from other tabs.
            .navigationDestination(item: $nflSheet.selectedGame) { game in
                NFLGameCarousel(games: store.sortedNFL(), initialGame: game) {
                    nflSheetStore.closeGameSheet()
                }
                .navigationTransition(.zoom(sourceID: "nfl-\(game.id)", in: cardTransition))
            }
            .navigationDestination(item: $cfbSheet.selectedGame) { game in
                CFBGameCarousel(games: store.sortedCFB(), initialGame: game) {
                    cfbSheetStore.closeGameSheet()
                }
                .navigationTransition(.zoom(sourceID: "cfb-\(game.id)", in: cardTransition))
            }
            .navigationDestination(item: $nbaSheet.selectedGame) { game in
                NBAGameCarousel(games: store.sortedNBA(), initialGame: game) {
                    nbaSheetStore.closeGameSheet()
                }
                .navigationTransition(.zoom(sourceID: "nba-\(game.id)", in: cardTransition))
            }
            .navigationDestination(item: $ncaabSheet.selectedGame) { game in
                NCAABGameCarousel(games: store.sortedNCAAB(), initialGame: game) {
                    ncaabSheetStore.closeGameSheet()
                }
                .navigationTransition(.zoom(sourceID: "ncaab-\(game.id)", in: cardTransition))
            }
            .navigationDestination(item: $mlbSheet.selectedGame) { game in
                // MLB detail is a swipeable carousel of the sport's sorted slate,
                // starting at the tapped game.
                MLBGameCarousel(
                    games: store.sortedMLB(),
                    initialGame: game,
                    trendsStore: mlbTrendsStore,
                    f5Store: mlbF5Store
                ) {
                    mlbSheetStore.closeGameSheet()
                }
                .navigationTransition(.zoom(sourceID: "mlb-\(game.id)", in: cardTransition))
            }
            // Settings pushes onto this stack (tapping the trailing gear) instead
            // of covering the screen as a modal — see MainTabToolbar.swift.
            .wagerProofSettingsDestination(tabStore: tabStore, tab: .games, auth: auth, settingsStore: settingsStore, revenueCat: revenueCat, adminMode: adminMode, proAccess: proAccess)
            // WagerBot chat pushes onto this stack (sparkles toolbar icon) as a
            // real page instead of a bottom sheet — see MainTabToolbar.swift.
            .wagerProofChatDestination(tabStore: tabStore, tab: .games)
            // Per-sport analytics tools push onto this stack (banner tap). The
            // shared ToolRouter resolves the same leaf views the Outliers hub
            // opens, so both entry points stay in sync.
            .navigationDestination(item: $selectedTool) { tool in
                ToolRouter.leafView(for: tool.category)
            }
            .animation(.appQuick, value: store.selectedSport)
            // Reset the tool carousel to the first page when the sport changes
            // so a stale page index can't carry into a sport with fewer tools.
            .onChange(of: store.selectedSport) { _, _ in toolPage = 0 }
        }
    }

    // MARK: - Tool banners

    /// Per-sport analytics tool banners (HoneydewOptionCard promo cards) shown
    /// above the game list for the selected sport — a swipeable paged carousel
    /// (one banner per page) with dot indicators, instead of a tall stack.
    /// NFL/CFB have none so this renders nothing for them.
    @ViewBuilder
    private var toolBanners: some View {
        let tools = visibleTools
        if !tools.isEmpty {
            VStack(spacing: 8) {
                // Paged TabView for native horizontal swipe. Fixed height —
                // `.page` TabViews don't size to content — set to the
                // HoneydewOptionCard's own 64pt min height so this matches
                // the Props page's "Best MLB Props" banner exactly.
                TabView(selection: $toolPage) {
                    ForEach(Array(tools.enumerated()), id: \.element.id) { index, tool in
                        ToolBannerCard(tool: tool) { selectedTool = tool }
                            .padding(.horizontal, 12)
                            .tag(index)
                    }
                }
                .frame(height: 64)
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.appQuick, value: toolPage)

                if tools.count > 1 {
                    HStack(spacing: 6) {
                        ForEach(tools.indices, id: \.self) { i in
                            Circle()
                                .fill(i == toolPage ? Color.appPrimary : Color.appBorder)
                                .frame(width: 6, height: 6)
                        }
                    }
                    .animation(.appQuick, value: toolPage)
                }
            }
            .padding(.top, 4)
            .padding(.bottom, 6)
        }
    }

    /// Tool banners for the selected sport, minus any NBA/NCAAB model-accuracy
    /// tool whose report currently has no rows. We key off "report has rows"
    /// (rather than a loaded-empty flag) so the banner simply appears once the
    /// slate populates and never flashes in during the offseason fetch.
    private var visibleTools: [SportTool] {
        SportTool.tools(for: store.selectedSport).filter { tool in
            switch tool.category {
            case .nbaAccuracy:   return !nbaAccuracy.games.isEmpty
            case .ncaabAccuracy: return !ncaabAccuracy.games.isEmpty
            default:             return true
            }
        }
    }

    // MARK: - Toolbar

    /// Native large-title toolbar. Top-leading is the WagerProof wordmark
    /// (tap to open Settings); the trailing group hosts the Settings gear. The
    /// per-sport sort menu lives in the pinned section header, not the toolbar.
    /// WagerBot launcher hidden app-wide — see MainTabToolbar.swift's
    /// WagerBotToolbarButton.
    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        WagerProofLeadingToolbarItem()
        ToolbarItemGroup(placement: .topBarTrailing) {
            SettingsToolbarButton(tabStore: tabStore)
        }
    }

    /// Per-sport sort menu — sits next to the sport picker in the pinned
    /// section header so the user can change ordering without reaching to
    /// the toolbar. Picker change adjusts which sport's sort mode the menu
    /// targets (each sport has its own remembered sort).
    @ViewBuilder
    private var sortMenu: some View {
        Menu {
            Button {
                store.sortModes[store.selectedSport] = .time
            } label: {
                Label("Sort by Time", systemImage: "clock")
            }
            Button {
                store.sortModes[store.selectedSport] = .spread
            } label: {
                Label("Sort by Spread Value", systemImage: "chart.line.uptrend.xyaxis")
            }
            Button {
                store.sortModes[store.selectedSport] = .ou
            } label: {
                Label("Sort by O/U Value", systemImage: "number")
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 32, height: 32)
        }
        .tint(Color.appTextPrimary)
        .sensoryFeedback(.selection, trigger: store.sortModes[store.selectedSport])
        .accessibilityLabel("Sort games")
    }

    // MARK: - Sport switcher

    /// The picker + sort bar, rendered as the pinned header of the outer
    /// scroll Section. Left as a floating glass capsule (no full-width
    /// opaque fill) so content scrolls under the nav bar / large title with
    /// the system's translucent treatment intact.
    @ViewBuilder
    private var pickerBar: some View {
        HStack(spacing: 8) {
            sportPicker
            sortMenu
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 4)
        .modifier(LiquidGlassCapsule())
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    /// Custom segmented sport switcher. Replaces the native `.segmented` Picker
    /// (which can't style individual segments) so out-of-season sports render
    /// dimmed — a signal that there's no live slate to expect. Lives inside
    /// `pickerBar`, the pinned header, so it stays beneath the nav bar while
    /// cards scroll under it.
    @ViewBuilder
    private var sportPicker: some View {
        HStack(spacing: 2) {
            ForEach(GamesStore.Sport.displayOrder()) { sport in
                sportSegment(sport)
            }
        }
        .animation(.appQuick, value: store.selectedSport)
        .sensoryFeedback(.selection, trigger: store.selectedSport)
    }

    @ViewBuilder
    private func sportSegment(_ sport: GamesStore.Sport) -> some View {
        let selected = store.selectedSport == sport
        // Only unselected off-season sports dim — the current selection always
        // stays legible so you can tell what you're viewing.
        let dim = !selected && !SportSeason.isInSeason(sport)
        Button {
            store.selectedSport = sport
        } label: {
            Text(sport.label)
                .font(.system(size: 12.5, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .foregroundStyle(selected ? Color.white : Color.appTextPrimary)
                .opacity(dim ? 0.45 : 1)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background {
                    if selected {
                        Capsule().fill(Color.appPrimary)
                    }
                }
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Content

    /// Body content rendered as direct children of the top-level
    /// LazyVStack so that per-date Section headers can pin alongside
    /// the sport-picker header.
    @ViewBuilder
    private var bodyContent: some View {
        if store.isLoading(sport: store.selectedSport) && noCachedGames {
            loadingSkeleton
        } else if let msg = store.errorMessage(sport: store.selectedSport), noCachedGames {
            errorState(msg)
        } else {
            sportDateSections
        }
    }

    private var noCachedGames: Bool {
        switch store.selectedSport {
        case .nfl: return store.games.nfl.isEmpty
        case .cfb: return store.games.cfb.isEmpty
        case .nba: return store.games.nba.isEmpty
        case .ncaab: return store.games.ncaab.isEmpty
        case .mlb: return store.games.mlb.isEmpty
        }
    }

    @ViewBuilder
    private var loadingSkeleton: some View {
        VStack(spacing: 8) {
            // No forced height — the skeleton sizes to GameRowCard's natural
            // footprint so the crossfade to loaded cards doesn't shift layout.
            ForEach(0..<5, id: \.self) { _ in
                GameCardShimmer()
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 16)
        .transition(.opacity)
    }

    @ViewBuilder
    private func errorState(_ message: String) -> some View {
        VStack {
            Spacer().frame(height: 40)
            ContentUnavailableView {
                Label("Failed to load games", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button {
                    Task { await store.refresh(sport: store.selectedSport, force: true) }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
            }
            Spacer()
        }
    }

    // MARK: - Per-sport date Sections

    @ViewBuilder
    private var sportDateSections: some View {
        switch store.selectedSport {
        case .nfl: nflDateSections
        case .cfb: cfbDateSections
        case .ncaab: ncaabDateSections
        case .mlb: mlbDateSections
        case .nba: nbaDateSections
        }
    }

    @ViewBuilder
    private var nflDateSections: some View {
        let games = store.sortedNFL()
        if games.isEmpty {
            emptyTile(for: .nfl, systemImage: "football")
        } else {
            let sections = GameDateGrouping.group(
                games,
                key: { GameDateGrouping.dateKey(from: $0.gameDate) },
                label: { GameCardFormatting.formatCompactDate($0.gameDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, game in
                        NFLGameCard(game: game) {
                            nflSheetStore.openGameSheet(game)
                        }
                        .matchedTransitionSource(id: "nfl-\(game.id)", in: cardTransition)
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    @ViewBuilder
    private var cfbDateSections: some View {
        let games = store.sortedCFB()
        if games.isEmpty {
            emptyTile(for: .cfb, systemImage: "graduationcap")
        } else {
            let sections = GameDateGrouping.group(
                games,
                key: { GameDateGrouping.dateKey(from: $0.gameDate) },
                label: { GameCardFormatting.formatCompactDate($0.gameDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, game in
                        CFBGameCard(game: game) {
                            cfbSheetStore.openGameSheet(game)
                        }
                        .matchedTransitionSource(id: "cfb-\(game.id)", in: cardTransition)
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    @ViewBuilder
    private var ncaabDateSections: some View {
        let games = store.sortedNCAAB()
        if games.isEmpty {
            emptyTile(for: .ncaab, systemImage: "basketball")
        } else {
            let sections = GameDateGrouping.group(
                games,
                key: { GameDateGrouping.dateKey(from: $0.gameDate) },
                label: { GameCardFormatting.formatCompactDate($0.gameDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, game in
                        NCAABGameCard(game: game) {
                            ncaabSheetStore.openGameSheet(game)
                        }
                        .matchedTransitionSource(id: "ncaab-\(game.id)", in: cardTransition)
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    @ViewBuilder
    private var mlbDateSections: some View {
        let games = store.sortedMLB()
        if games.isEmpty {
            emptyTile(for: .mlb, systemImage: "baseball")
        } else {
            let sections = GameDateGrouping.group(
                games,
                key: { GameDateGrouping.dateKey(from: $0.officialDate) },
                label: { MLBFormatting.dateLabel($0.officialDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, game in
                        MLBGameCard(game: game) {
                            mlbSheetStore.openGameSheet(game)
                        }
                        .matchedTransitionSource(id: "mlb-\(game.id)", in: cardTransition)
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    @ViewBuilder
    private var nbaDateSections: some View {
        let games = store.sortedNBA()
        if games.isEmpty {
            emptyTile(for: .nba, systemImage: "basketball")
        } else {
            let sections = GameDateGrouping.group(
                games,
                key: { GameDateGrouping.dateKey(from: $0.gameDate) },
                label: { GameCardFormatting.formatCompactDate($0.gameDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, game in
                        NBAGameCard(game: game) {
                            nbaSheetStore.openGameSheet(game)
                        }
                        .matchedTransitionSource(id: "nba-\(game.id)", in: cardTransition)
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    /// Section header rendered above each per-date group of cards. Scrolls
    /// inline with the content (not pinned).
    @ViewBuilder
    private func sectionHeader(_ label: String) -> some View {
        HStack {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Color.appTextSecondary)
                // Align the date label's leading edge with the card content
                // (card sits 12 from the screen + ~7 content inset) so the date
                // lines up with the matchup rather than floating to its left.
                .padding(.leading, 20)
                .padding(.trailing, 16)
                .padding(.vertical, 6)
            Spacer(minLength: 0)
        }
    }

    /// Empty state for a sport with no games on the board. Copy is season-aware
    /// (see `SportSeason`): out of season we point the user at the season start
    /// date; in season an empty board means the slate is mid-refresh.
    @ViewBuilder
    private func emptyTile(for sport: GamesStore.Sport, systemImage: String) -> some View {
        let copy = SportSeason.emptyCopy(for: sport)
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.appTextMuted)
            VStack(spacing: 6) {
                Text(copy.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(copy.message)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 220)
        .padding(.horizontal, 32)
        .padding(.vertical, 24)
    }
}

#Preview {
    GamesView()
}
