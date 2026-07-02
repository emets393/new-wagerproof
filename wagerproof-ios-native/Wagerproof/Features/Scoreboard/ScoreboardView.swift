import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Scoreboard tab — live games grouped by league with tap-to-detail modal.
/// Ports `wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx`.
///
/// Layout strategy (matches spec §2):
/// - `ScrollView` + `LazyVStack(pinnedViews: [.sectionHeaders])` so each
///   league's title sticks to the top while scrolling its games.
/// - Compact mode: 2-column `LazyVGrid` of `LiveScoreCard`.
/// - Expanded mode: full-width `LazyVStack` of `LiveScorePredictionCard`.
/// - `.refreshable` drives `LiveScoresStore.refresh()` (mirrors RN's
///   `RefreshControl` + `onRefresh`).
/// - `.sheet(item:)` presents `LiveScoreDetailModal` keyed off the tapped
///   game (mirrors RN's transparent `Modal`, but native).
///
/// The store is owned by the view's `@State` here because B07 lands before
/// the tab-shell-level store wiring lands. Once `MainTabView` injects a
/// shared `LiveScoresStore` via `.environment(...)` (in batch B17 or earlier
/// when the wagerbot suggestion store wants the same data), this view can
/// switch to `@Environment(LiveScoresStore.self)`.
struct ScoreboardView: View {
    @Environment(MainTabStore.self) private var tabStore
    @State private var store: LiveScoresStore
    @State private var isExpanded: Bool = false
    @State private var selectedGame: LiveGame?

    /// View-local sport filter (pattern §5). Lives here — not on
    /// `LiveScoresStore` — because the store is shared with WagerBot
    /// suggestions, where filtering would corrupt the "any NBA games tonight?"
    /// lookups. `.all` is the default so a user opening the tab still sees
    /// every league at once.
    @State private var selectedSportFilter: SportFilter = .all

    /// Standard initializer — production callers get a freshly-created store
    /// that begins polling on `.task`.
    init() {
        _store = State(initialValue: LiveScoresStore())
    }

    /// DEBUG init for the screenshot harness — accepts a pre-seeded store so
    /// the view can render empty / loaded / error states deterministically.
    /// Polling is the caller's choice; the harness leaves it off.
    #if DEBUG
    init(store: LiveScoresStore) {
        _store = State(initialValue: store)
    }
    #endif

    var body: some View {
        NavigationStack {
            // Outer ScrollView + `LazyVStack(pinnedViews: [.sectionHeaders])`
            // replaces the prior `safeAreaInset(.top)` approach. iOS 26 was
            // collapsing the `.large` title to zero rendered height when
            // `safeAreaInset` + `.searchable(.always)` competed for chrome
            // space. Section-header pinning leaves the title slot intact so
            // the big title text renders AND transitions to inline on
            // scroll, while the sport-filter picker still pins to the top
            // of the viewport with `.ultraThinMaterial` blur so league
            // sections scroll under it.
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                    Section {
                        content
                    } header: {
                        // Tightly hug the segmented picker in a Liquid Glass
                        // capsule (iOS 26 `.glassEffect`, iOS 17/18 fallback
                        // to ultraThinMaterial). Matches the Games tab.
                        sportPicker
                            .padding(.horizontal, 4)
                            .padding(.vertical, 4)
                            .modifier(LiquidGlassCapsule())
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                    }
                }
            }
            .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Live Scoreboard")
                .navigationBarTitleDisplayMode(.large)
                // Per-tab `.searchable()` removed — search lives in the
                // dedicated `Tab(role: .search)` slot now.
                .toolbar { mainToolbar }
                // Pattern §7 — single `await`, no nested Task. The store's
                // `refresh()` is the canonical manual entry point; live
                // scores have no cache TTL so there's no `force:` to pass.
                .refreshable {
                    await store.refresh()
                }
                .sheet(item: $selectedGame) { game in
                    LiveScoreDetailModal(game: game) {
                        // "View Full Scoreboard" from the modal flips us to
                        // expanded mode and dismisses (handled inside the modal).
                        isExpanded = true
                    }
                    .sensoryFeedback(.impact(weight: .medium), trigger: game.id)
                }
                .task {
                    // FIDELITY-WAIVER #009: WagerBotSuggestionStore.onPageChange(.scoreboard)
                    // will fire here once B17 (Chat) ports the suggestion store.
                    // FIDELITY-WAIVER #010: LiveScoresStore.games will sync to
                    // WagerBotSuggestionStore.setScoreboardData(_:) after B17 lands.
                    // Kick off background polling on first appear, but only
                    // if the store hasn't already been pre-loaded (e.g. by the
                    // screenshot harness). The store's start() is idempotent
                    // so re-mounts don't spawn extra timers.
                    if case .idle = store.loadState {
                        store.start()
                    }
                }
                .sensoryFeedback(.selection, trigger: isExpanded)
                .sensoryFeedback(.selection, trigger: selectedSportFilter)
        }
    }

    // MARK: - Toolbar

    /// Native large-title toolbar. Leading slot flips
    /// `tabStore.isSettingsPresented` to open the Settings sheet centrally
    /// mounted on `MainTabView`. Trailing group has the expand/compact
    /// toggle. WagerBot launcher hidden app-wide — see MainTabToolbar.swift's
    /// WagerBotToolbarButton.
    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                tabStore.isSettingsPresented = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 17, weight: .semibold))
            }
            .tint(Color.appTextPrimary)
            .accessibilityLabel("Settings")
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            // Existing expand/compact toggle — preserved verbatim, just
            // relocated from a standalone toolbar into the trailing group
            // so it sits beside the new WagerBot launcher per the recipe.
            Button {
                isExpanded.toggle()
            } label: {
                Image(systemName: isExpanded
                    ? "arrow.down.right.and.arrow.up.left"
                    : "arrow.up.left.and.arrow.down.right"
                )
                .font(.system(size: 17, weight: .semibold))
            }
            .tint(Color.appTextPrimary)
            .symbolEffect(.bounce, value: isExpanded)
            .accessibilityLabel(isExpanded ? "Switch to compact layout" : "Switch to expanded layout")
        }
    }

    // MARK: - Sport filter

    /// Native segmented sport filter (pattern §5). Pinned via
    /// `safeAreaInset(.top)` so the row stays under the nav bar while the
    /// league sections scroll. `.all` is first so the default tab open
    /// shows every league grouped vertically.
    @ViewBuilder
    private var sportPicker: some View {
        Picker("Sport", selection: $selectedSportFilter) {
            ForEach(SportFilter.allCases) { filter in
                Text(filter.shortLabel).tag(filter)
            }
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private var content: some View {
        // Inner ScrollView removed — the outer `body` ScrollView now owns
        // scrolling so the pinned section-header pattern can attach to it.
        VStack(spacing: 0) {
            pageSubtitle

            if let errorMessage = store.lastError, !store.hasLiveGames {
                errorBanner(message: errorMessage)
            } else if store.isLoading && !store.hasLiveGames {
                loadingGrid
            } else if !store.hasLiveGames {
                emptyState
            } else if filteredGroups.isEmpty {
                filteredEmptyState
            } else {
                leagueSections
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.bottom, Spacing.xxl)
        .animation(.appStandard, value: isExpanded)
        .animation(.appStandard, value: store.games)
        .animation(.appQuick, value: selectedSportFilter)
    }

    @ViewBuilder
    private var pageSubtitle: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Real-time scores & predictions")
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Spacing.sm)
        .padding(.bottom, Spacing.lg)
    }

    @ViewBuilder
    private var loadingGrid: some View {
        // Mirror the loaded layout: a couple of league sections, each a
        // shimmering header (icon + title + game-count badge) over a 2-col
        // grid of compact-tile skeletons.
        VStack(alignment: .leading, spacing: Spacing.xl) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: Spacing.md) {
                    HStack {
                        HStack(spacing: Spacing.sm) {
                            SkeletonCircle(20)
                            SkeletonBlock(width: 130, height: 18)
                        }
                        Spacer()
                        SkeletonCapsule(width: 56, height: 22)
                    }
                    .padding(.horizontal, Spacing.xs)
                    .shimmering()

                    LazyVGrid(
                        columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                        spacing: 8
                    ) {
                        ForEach(0..<4, id: \.self) { _ in
                            LiveScoreCardShimmer()
                        }
                    }
                }
            }
        }
        .padding(.vertical, Spacing.md)
        .transition(.opacity)
    }

    @ViewBuilder
    private var emptyState: some View {
        // FIDELITY-WAIVER #007: RN renders a custom `NoGamesTerminal` ASCII-
        // terminal placeholder. The terminal view ports in B18 (DevTools).
        // Until then we use the iOS-native ContentUnavailableView, which
        // ships with built-in dark-mode + dynamic-type support and is the
        // HIG-blessed empty state.
        ContentUnavailableView {
            Label("No live games right now", systemImage: "sportscourt.fill")
        } description: {
            Text("Check back during gameday for live scores, predictions, and hitting badges.")
        }
        .padding(.vertical, Spacing.xxxl)
    }

    /// Empty state shown when the sport filter hides every live game. Search
    /// moved to the global SearchView tab, so this branch only reflects the
    /// sport-filter choice.
    @ViewBuilder
    private var filteredEmptyState: some View {
        ContentUnavailableView {
            Label("No live \(selectedSportFilter.shortLabel) games", systemImage: selectedSportFilter.sfSymbol)
        } description: {
            Text("Try a different sport, or clear the filter to see every live league.")
        }
        .padding(.vertical, Spacing.xxxl)
    }

    // MARK: - Filtering

    /// League groups filtered by the active sport filter.
    private var filteredGroups: [(league: String, games: [LiveGame])] {
        store.groupedByLeague()
            .filter { selectedSportFilter.matches($0.league) }
    }

    @ViewBuilder
    private func errorBanner(message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.appAccentAmber)
            Text("Couldn't load live games")
                .font(AppFont.headline)
                .foregroundStyle(Color.appTextPrimary)
            Text(message)
                .font(AppFont.caption)
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await store.refresh() }
            } label: {
                Label("Retry", systemImage: "arrow.clockwise")
                    .font(AppFont.bodyEmphasized)
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.lg)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.appPrimary)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.sm)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.xl)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.appAccentAmber.opacity(0.4), lineWidth: 1)
        )
        .padding(.vertical, Spacing.lg)
    }

    @ViewBuilder
    private var leagueSections: some View {
        LazyVStack(spacing: Spacing.xl, pinnedViews: [.sectionHeaders]) {
            ForEach(filteredGroups, id: \.league) { entry in
                Section {
                    if isExpanded {
                        LazyVStack(spacing: Spacing.md) {
                            ForEach(Array(entry.games.enumerated()), id: \.element.id) { index, game in
                                LiveScorePredictionCard(game: game)
                                    .staggeredAppear(index: index)
                            }
                        }
                    } else {
                        LazyVGrid(
                            columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                            spacing: 8
                        ) {
                            ForEach(Array(entry.games.enumerated()), id: \.element.id) { index, game in
                                LiveScoreCard(game: game) {
                                    selectedGame = game
                                }
                                .sensoryFeedback(.impact(weight: .light), trigger: selectedGame?.id == game.id)
                                .staggeredAppear(index: index)
                            }
                        }
                    }
                } header: {
                    leagueHeader(league: entry.league, games: entry.games)
                }
            }
        }
    }

    @ViewBuilder
    private func leagueHeader(league: String, games: [LiveGame]) -> some View {
        let displayName = Self.leagueDisplayName(league)
        let icon = Self.leagueSFSymbol(league)
        let hittingCount = games.filter { $0.predictions?.hasAnyHitting == true }.count

        HStack {
            HStack(spacing: Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                Text(displayName)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Spacer()
            HStack(spacing: Spacing.sm) {
                badge(
                    text: "\(games.count) \(games.count == 1 ? "Game" : "Games")",
                    color: Color.appTextPrimary,
                    background: Color.appSurfaceMuted
                )
                if hittingCount > 0 {
                    badge(
                        text: "\(hittingCount) Hitting",
                        color: Color(hex: 0x22D35F),
                        background: Color(hex: 0x22D35F, opacity: 0.1)
                    )
                }
            }
        }
        .padding(.vertical, Spacing.sm)
        .padding(.horizontal, Spacing.xs)
        .background(Color.appSurface.opacity(0.95))
        // Sticky header gets a subtle bottom divider — same as RN.
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.appBorder.opacity(0.4)).frame(height: 1)
        }
    }

    @ViewBuilder
    private func badge(text: String, color: Color, background: Color) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 4)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    // MARK: - League metadata

    /// Display name per RN `LEAGUE_CONFIG`. Mirrors the literal strings.
    private static func leagueDisplayName(_ league: String) -> String {
        switch league.uppercased() {
        case "NFL": return "NFL Games"
        case "NCAAF", "CFB": return "College Football"
        case "NBA": return "NBA Games"
        case "NCAAB": return "College Basketball"
        case "NHL": return "NHL Games"
        case "MLB": return "MLB Games"
        case "MLS": return "MLS Games"
        case "EPL": return "EPL Games"
        default: return "\(league) Games"
        }
    }

    /// SF Symbol per spec §2's icon table. RN's MaterialCommunityIcons names
    /// don't map 1:1 to SF; the spec picks the closest native equivalent.
    private static func leagueSFSymbol(_ league: String) -> String {
        switch league.uppercased() {
        case "NFL": return "shield.lefthalf.filled"
        case "NCAAF", "CFB": return "trophy.fill"
        case "NBA", "NCAAB": return "basketball.fill"
        case "NHL": return "hockey.puck.fill"
        case "MLB": return "baseball.fill"
        case "MLS", "EPL": return "soccerball"
        default: return "sportscourt.fill"
        }
    }
}

/// Scoreboard's sport filter (pattern §5). Lives in the view file because
/// `LiveScoresStore` is shared with the WagerBot suggestion pipeline and
/// must remain unfiltered. `.all` is the default — it preserves the original
/// "every league grouped vertically" rendering and avoids forcing users to
/// re-tap whenever they switch leagues mid-gameday.
///
/// The case order matches RN's `LEAGUE_CONFIG.order` so the segmented
/// picker reads in the same sequence as the existing league section
/// stacking (NFL → CFB → NBA → NCAAB → MLB).
enum SportFilter: String, CaseIterable, Identifiable, Hashable {
    case all
    case nfl
    case cfb
    case nba
    case ncaab
    case mlb

    var id: String { rawValue }

    /// Segmented-control label. Native `Picker(.segmented)` truncates with
    /// ellipsis past ~3 characters per cell at iPhone widths, so we keep
    /// labels short (NFL, CFB, etc.) and use "All" for the default.
    var shortLabel: String {
        switch self {
        case .all: return "All"
        case .nfl: return "NFL"
        case .cfb: return "CFB"
        case .nba: return "NBA"
        case .ncaab: return "NCAAB"
        case .mlb: return "MLB"
        }
    }

    /// SF Symbol used in the filtered-empty-state `ContentUnavailableView`
    /// when the user has narrowed to a single league. Mirrors the symbols
    /// `leagueSFSymbol(_:)` uses in `leagueHeader` so the empty state
    /// visually pairs with the section it replaced.
    var sfSymbol: String {
        switch self {
        case .all: return "sportscourt.fill"
        case .nfl: return "shield.lefthalf.filled"
        case .cfb: return "trophy.fill"
        case .nba, .ncaab: return "basketball.fill"
        case .mlb: return "baseball.fill"
        }
    }

    /// Whether the given raw league string from `LiveGame.league` should
    /// pass this filter. RN feeds both `"NCAAF"` and `"CFB"` as the
    /// college-football league key depending on the upstream provider, so
    /// `.cfb` accepts both. `.all` is the wildcard.
    func matches(_ league: String) -> Bool {
        let upper = league.uppercased()
        switch self {
        case .all: return true
        case .nfl: return upper == "NFL"
        case .cfb: return upper == "CFB" || upper == "NCAAF"
        case .nba: return upper == "NBA"
        case .ncaab: return upper == "NCAAB"
        case .mlb: return upper == "MLB"
        }
    }
}

#Preview("Loaded state") {
    ScoreboardView()
}
