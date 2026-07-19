import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Sort orders for the player-props feed, surfaced by the sort control embedded
/// in the picker bar (same spot the Games page keeps its sort menu). Date
/// sections always stay chronological — the mode only reorders players *within*
/// each date.
private enum PropSortMode: String, CaseIterable {
    case time, hitRate

    var label: String {
        switch self {
        case .time: return "Game Time"
        case .hitRate: return "L10 Hit Rate"
        }
    }

    var icon: String {
        switch self {
        case .time: return "clock"
        case .hitRate: return "flame"
        }
    }

    static func modes(for sport: PropsStore.Sport) -> [PropSortMode] {
        switch sport {
        case .mlb, .nfl: return allCases
        default: return [.time]
        }
    }
}

/// Props tab. Mirrors `GamesView`'s structure (large title, pinned sport
/// picker, date-grouped sections, pull-to-refresh, settings/WagerBot
/// toolbar) but the feed items are player-prop matchup cards.
///
/// Player props exist for MLB (game-log trends + line ladder) and NFL
/// (consensus close + season trends, per the dry-run data contract);
/// remaining sports show a "coming soon" state. Tapping an MLB card pushes
/// `PlayerPropDetailView` (trend chart + line slider); tapping an NFL card
/// pushes `NFLPropDetailView` (per-market trend board).
struct PropsView: View {
    @Environment(MainTabStore.self) private var tabStore
    // Shared at the tab shell so the MLB game-detail Player Props widget reads
    // the same slate (see MainTabView).
    @Environment(PropsStore.self) private var store
    // Re-injected explicitly into the Settings navigationDestination so iOS 18+
    // configurePreferredTransition can resolve them before the nav environment
    // chain is established. See MainTabToolbar.wagerProofSettingsDestination.
    // Perfect-streak parlay tickets — the "Props Cheats" rail reads the
    // props-only ticket set from the shell-hoisted store.
    @Environment(ParlayGodStore.self) private var parlayGodStore
    @Environment(AuthStore.self) private var auth
    @Environment(SettingsStore.self) private var settingsStore
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(AdminModeStore.self) private var adminMode
    @Environment(ProAccessStore.self) private var proAccess
    @State private var selectedProp: PlayerPropSelection?
    @State private var selectedNFLProp: NFLPlayerPropSelection?
    /// Player ordering within each date section (view-level presentation only —
    /// the shared store stays sort-agnostic so the MLB game-detail widget that
    /// reads the same slate is unaffected).
    @State private var sortMode: PropSortMode = .time
    /// MLB-only feed filters — reset when leaving the MLB segment.
    @State private var mlbFilters = MLBPropFeedFilters()
    @State private var showMLBMarketSheet = false
    @State private var showMLBMatchupSheet = false
    /// NFL-only feed filters — reset when leaving the NFL segment.
    @State private var nflFilters = NFLPropFeedFilters()
    @State private var showNFLMarketSheet = false
    @State private var showNFLMatchupSheet = false
    @State private var showBestPicks = false
    @State private var bestPicksStore = MLBPlayerPropPicksStore()
    /// Sport chooser sheet — replaces the native Menu so out-of-season sports
    /// can render dimmed (a Menu can't style its rows). Matches the Matchup /
    /// Market filter-sheet pattern.
    @State private var showSportSheet = false

    // Shared namespace for the card→detail zoom transition (same pattern as
    // GamesView). The source card and the pushed detail reference the same
    // sourceID (`PlayerPropSelection.transitionID`).
    @Namespace private var cardTransition

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                    Section {
                        LazyVStack(spacing: 8) {
                            // Best Picks card rides with the feed (scrolls away);
                            // only the pill row stays pinned as the section header.
                            if store.selectedSport == .mlb {
                                mlbBestPicksBanner
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                                propsCheatsRail
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                            }
                            bodyContent
                        }
                        .animation(.appQuick, value: store.selectedSport)
                    } header: {
                        propsHeader
                    }
                }
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Props")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                async let feed: () = store.refresh(force: true)
                async let parlays: () = parlayGodStore.refreshIfNeeded(force: true)
                _ = await (feed, parlays)
            }
            .task(id: store.selectedSport) {
                if store.selectedSport != .mlb {
                    mlbFilters = MLBPropFeedFilters()
                }
                if store.selectedSport != .nfl {
                    nflFilters = NFLPropFeedFilters()
                }
                if !PropSortMode.modes(for: store.selectedSport).contains(sortMode) {
                    sortMode = .time
                }
                await store.refresh()
                if store.selectedSport == .mlb {
                    await bestPicksStore.refreshSummaryOnly()
                    await parlayGodStore.refreshIfNeeded()
                }
            }
            .onChange(of: mlbFilters.market) { _, market in
                if market == "batter_home_runs" {
                    mlbFilters.market = nil
                    return
                }
                if market != nil, store.selectedSport == .mlb {
                    sortMode = .hitRate
                }
            }
            .onChange(of: nflFilters.market) { _, market in
                if market != nil {
                    nflFilters.signalsOnly = false
                }
                if market != nil, store.selectedSport == .nfl {
                    sortMode = .hitRate
                }
            }
            .onChange(of: nflFilters.signalsOnly) { _, signalsOnly in
                guard store.selectedSport == .nfl else { return }
                if signalsOnly {
                    sortMode = .hitRate
                    if let gameId = nflFilters.gameId,
                       !NFLPropFeedFilters.hasFlaggedPlayers(in: store.nflPlayers, gameId: gameId) {
                        nflFilters.gameId = nil
                    }
                }
            }
            .onChange(of: store.nflPlayers) { _, players in
                guard let market = nflFilters.market else { return }
                if !NFLPropFeedFilters.sheetMarkets(from: players).allKeys.contains(market) {
                    nflFilters.market = nil
                }
            }
            .sheet(isPresented: $showMLBMarketSheet) {
                MLBPropMarketFilterSheet(selectedMarket: $mlbFilters.market)
            }
            .sheet(isPresented: $showNFLMarketSheet) {
                NFLPropMarketFilterSheet(
                    filters: $nflFilters,
                    players: store.nflPlayers,
                    sheetMarkets: NFLPropFeedFilters.sheetMarkets(from: store.nflPlayers)
                )
            }
            .sheet(isPresented: $showMLBMatchupSheet) {
                MLBPropMatchupPickerSheet(options: mlbGameFilterOptions, selection: $mlbFilters.gamePk)
            }
            .sheet(isPresented: $showNFLMatchupSheet) {
                NFLPropMatchupPickerSheet(options: nflGameFilterOptions, selection: $nflFilters.gameId)
            }
            .sheet(isPresented: $showSportSheet) {
                PropSportPickerSheet(selection: bindableSelectedSport)
            }
            .toolbar { mainToolbar }
            .navigationDestination(item: $selectedProp) { selection in
                PlayerPropDetailView(selection: selection)
                    .navigationTransition(.zoom(sourceID: selection.transitionID, in: cardTransition))
            }
            .navigationDestination(item: $selectedNFLProp) { selection in
                NFLPropDetailView(selection: selection)
                    .navigationTransition(.zoom(sourceID: selection.transitionID, in: cardTransition))
            }
            .navigationDestination(isPresented: $showBestPicks) {
                MLBBestPicksView(store: bestPicksStore)
            }
            // Settings pushes onto this stack (tapping the trailing gear) instead
            // of covering the screen as a modal — see MainTabToolbar.swift.
            .wagerProofSettingsDestination(tabStore: tabStore, tab: .props, auth: auth, settingsStore: settingsStore, revenueCat: revenueCat, adminMode: adminMode, proAccess: proAccess)
            .wagerProofChatDestination(tabStore: tabStore, tab: .props)
            .animation(.appQuick, value: store.selectedSport)
        }
    }

    // MARK: - Toolbar (matches GamesView)

    // WagerBot launcher hidden app-wide — see MainTabToolbar.swift's
    // WagerBotToolbarButton.
    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        WagerProofLeadingToolbarItem()
        ToolbarItemGroup(placement: .topBarTrailing) {
            SettingsToolbarButton(tabStore: tabStore)
        }
    }

    // MARK: - Filter pills
    //
    // One sticky pill row replaces the old per-sport stacked filter bars, so the
    // Props tab reads the same as the Outliers Trends tab. Unlike Outliers,
    // market stays a *filter* pill here — the Props feed is date-grouped, not
    // market-grouped — so the axes are Sport / Matchup / Market / Sort.

    // Only the pill row is pinned; the MLB Best Picks card lives in the scrolling
    // feed (see body) so it scrolls away under the sticky pills.
    private var propsHeader: some View {
        filterPills
    }

    private var mlbGameFilterOptions: [MLBPropGameFilterOption] {
        MLBPropGameFilterOptions.build(matchups: store.sortedMatchups())
    }

    private var nflGameFilterOptions: [NFLPropGameFilterOption] {
        NFLPropGameFilterOptions.build(
            players: store.nflPlayers,
            signalsOnly: nflFilters.signalsOnly
        )
    }

    /// Sticky filter row — one floating Liquid Glass pill per axis. No opaque
    /// backing, so the feed cards refract through the pills as they scroll
    /// underneath (the iOS 26 floating-controls look used on Outliers Trends).
    private var filterPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                sportPill
                if store.selectedSport.hasProps {
                    matchupPill
                    marketPill
                    // Only sports with more than one sort mode (MLB/NFL) earn the pill.
                    if PropSortMode.modes(for: store.selectedSport).count > 1 {
                        sortPill
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, 2)
        }
        .padding(.top, Spacing.md)
        .padding(.bottom, 10)
    }

    // Sport + Sort are small fixed sets → native Menu pickers. Matchup + Market
    // open sheets: game lists run the full slate and the market sheet groups
    // markets (plus the NFL "Prop Signals" row) — neither renders in a Menu.
    @ViewBuilder
    private var sportPill: some View {
        Button { showSportSheet = true } label: {
            // Dim the pill when you're viewing an off-season sport — the same
            // cue the chooser rows use, so the state reads even while closed.
            pillLabel(
                icon: sportIcon(store.selectedSport),
                text: store.selectedSport.label,
                dimmed: sportIsOffSeason(store.selectedSport)
            )
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: store.selectedSport)
        .accessibilityLabel("Sport filter")
    }

    @ViewBuilder
    private var matchupPill: some View {
        switch store.selectedSport {
        case .mlb:
            Button { showMLBMatchupSheet = true } label: { mlbMatchupPillLabel }
                .buttonStyle(.plain)
                .accessibilityLabel("Matchup filter")
        case .nfl:
            Button { showNFLMatchupSheet = true } label: { nflMatchupPillLabel }
                .buttonStyle(.plain)
                .accessibilityLabel("Matchup filter")
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var mlbMatchupPillLabel: some View {
        if let pk = mlbFilters.gamePk,
           let opt = mlbGameFilterOptions.first(where: { $0.gamePk == pk }) {
            pillContainer {
                HStack(spacing: 3) {
                    MLBTeamLogo(logoUrl: opt.awayLogoUrl, abbrev: opt.awayAbbr, name: opt.awayName, size: 18)
                    MLBTeamLogo(logoUrl: opt.homeLogoUrl, abbrev: opt.homeAbbr, name: opt.homeName, size: 18)
                }
                Text("\(opt.awayAbbr) @ \(opt.homeAbbr)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                pillChevron
            }
        } else {
            pillLabel(icon: "square.grid.2x2.fill", text: "All games")
        }
    }

    @ViewBuilder
    private var nflMatchupPillLabel: some View {
        if let gameId = nflFilters.gameId,
           let opt = nflGameFilterOptions.first(where: { $0.gameId == gameId }) {
            pillContainer {
                HStack(spacing: 3) {
                    GameCardTeamAvatar(teamName: opt.awayAbbr, sport: "nfl", size: 18, colors: NFLTeamColors.colorPair(for: opt.awayTeam))
                    GameCardTeamAvatar(teamName: opt.homeAbbr, sport: "nfl", size: 18, colors: NFLTeamColors.colorPair(for: opt.homeTeam))
                }
                Text("\(opt.awayAbbr) @ \(opt.homeAbbr)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                pillChevron
            }
        } else {
            pillLabel(icon: "square.grid.2x2.fill", text: "All games")
        }
    }

    @ViewBuilder
    private var marketPill: some View {
        switch store.selectedSport {
        case .mlb:
            Button { showMLBMarketSheet = true } label: {
                pillLabel(icon: "slider.horizontal.3", text: MLBPropFeedFilters.marketLabel(mlbFilters.market))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Prop market filter")
        case .nfl:
            Button { showNFLMarketSheet = true } label: {
                // NFL signals-only folds into the market sheet, so the pill shows
                // a bolt + "Prop Signals" when that mode is active.
                pillLabel(
                    icon: nflFilters.signalsOnly ? "bolt.fill" : "slider.horizontal.3",
                    text: NFLPropFeedFilters.filterLabel(nflFilters)
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Prop market filter")
        default:
            EmptyView()
        }
    }

    private var sortPill: some View {
        Menu {
            Picker("Sort by", selection: $sortMode) {
                ForEach(PropSortMode.modes(for: store.selectedSport), id: \.self) { mode in
                    Label(mode.label, systemImage: mode.icon).tag(mode)
                }
            }
        } label: {
            pillLabel(icon: sortMode.icon, text: sortMode.label)
        }
        .sensoryFeedback(.selection, trigger: sortMode)
        .accessibilityLabel("Sort props")
    }

    // MARK: - Pill chrome (shared visual treatment with Outliers Trends)

    private func pillLabel(icon: String, text: String, dimmed: Bool = false) -> some View {
        pillContainer {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
            Text(text)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            pillChevron
        }
        // Fade the whole pill when its sport is out of season — muted but still
        // tappable, matching the dimmed rows in the chooser sheet.
        .opacity(dimmed ? 0.5 : 1)
    }

    /// Floating Liquid Glass capsule chrome shared by every filter pill (iOS 26
    /// glass, `.ultraThinMaterial` fallback pre-26 via `liquidGlassBackground`).
    private func pillContainer<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: 6) { content() }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .liquidGlassBackground(in: Capsule(), interactive: true)
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.35), lineWidth: 1))
    }

    private var pillChevron: some View {
        Image(systemName: "chevron.down")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(Color.appTextMuted)
    }

    private func sportIcon(_ sport: PropsStore.Sport) -> String {
        switch sport {
        case .mlb: return "figure.baseball"
        case .nfl, .cfb: return "football.fill"
        case .nba, .ncaab: return "basketball.fill"
        }
    }

    /// Manual binding to the shared store's sport so the chooser sheet can drive
    /// it without restructuring `body` around an `@Bindable`.
    private var bindableSelectedSport: Binding<PropsStore.Sport> {
        Binding(get: { store.selectedSport }, set: { store.selectedSport = $0 })
    }

    /// Bridge Props' sport enum to the shared `GamesStore.Sport` the season
    /// helper is keyed on — identical raw values, so this never fails.
    private func gamesSport(_ sport: PropsStore.Sport) -> GamesStore.Sport {
        GamesStore.Sport(rawValue: sport.rawValue) ?? .mlb
    }

    /// Out-of-season sports read dimmed in the picker (parity with the Games tab).
    private func sportIsOffSeason(_ sport: PropsStore.Sport) -> Bool {
        !SportSeason.isInSeason(gamesSport(sport))
    }

    // MARK: - Content

    @ViewBuilder
    private var bodyContent: some View {
        if !store.selectedSport.hasProps {
            comingSoonState
        } else if store.isLoading && !store.hasCachedMatchups {
            loadingSkeleton
        } else if let msg = store.errorMessage, !store.hasCachedMatchups {
            errorState(msg)
        } else if store.selectedSport == .nfl {
            nflSections
        } else {
            matchupSections
        }
    }

    @ViewBuilder
    private var mlbBestPicksBanner: some View {
        MLBBestPicksBanner(store: bestPicksStore) {
            showBestPicks = true
        }
        // Match the Games-page tool banners' 12pt inset (and the prop cards below).
        .padding(.horizontal, 12)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    /// "Props Cheats" — Parlay God restricted to player-prop legs, riding the
    /// feed above the date sections (same slot behavior as the Best Picks card).
    @ViewBuilder
    private var propsCheatsRail: some View {
        ParlayGodRail(
            title: "Props Cheats",
            icon: "scope",
            tickets: parlayGodStore.propsTickets,
            isLoading: parlayGodStore.isLoading,
            bleedInset: 12,
            emptyNote: "No perfect-streak props on the board right now — cheats reload when the day's props post each morning."
        )
        .padding(.horizontal, 12)
        .padding(.bottom, 4)
    }

    // MARK: - NFL sections

    @ViewBuilder
    private var nflSections: some View {
        // Same shape as the MLB feed: one card per player, date-grouped with
        // sticky headers; the sort mode reorders players within a date.
        let items = sortedNFLItems(NFLPropFeed.items(from: store.nflPlayers, filters: nflFilters))
        if items.isEmpty {
            if store.nflPlayers.isEmpty {
                // Whole slate empty → season-aware copy (off-season vs. mid-refresh).
                seasonEmptyTile(for: .nfl, systemImage: "football")
            } else {
                // Board has props, but the active filters exclude them all.
                emptyTile(label: nflFilteredEmptyLabel, systemImage: "football")
            }
        } else {
            let sections = GameDateGrouping.group(
                items,
                key: { GameDateGrouping.dateKey(from: $0.sortDate) },
                label: { MLBFormatting.dateLabel($0.player.gameDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                        NFLPropPlayerCard(
                            item: item,
                            namespace: cardTransition,
                            onSelect: { selectedNFLProp = $0 }
                        )
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    private func sortedNFLItems(_ items: [NFLPropFeedItem]) -> [NFLPropFeedItem] {
        let mode: PropSortMode = nflFilters.signalsOnly ? .hitRate : sortMode
        switch mode {
        case .hitRate:
            return items.sorted { a, b in
                if a.hitRate != b.hitRate { return a.hitRate > b.hitRate }
                return a.sortTime < b.sortTime
            }
        case .time:
            return items.sorted { a, b in
                if a.sortTime != b.sortTime { return a.sortTime < b.sortTime }
                return a.player.playerName < b.player.playerName
            }
        }
    }

    @ViewBuilder
    private var matchupSections: some View {
        let items = sortedFeedItems(PlayerPropFeed.items(from: store.sortedMatchups(), filters: mlbFilters))
        if items.isEmpty {
            if store.sortedMatchups().isEmpty {
                // Whole slate empty → season-aware copy (off-season vs. mid-refresh).
                seasonEmptyTile(for: .mlb, systemImage: "baseball")
            } else {
                // Board has props, but the active filters exclude them all.
                emptyTile(label: mlbFilteredEmptyLabel, systemImage: "baseball")
            }
        } else {
            let sections = GameDateGrouping.group(
                items,
                key: { GameDateGrouping.dateKey(from: $0.sortDate) },
                label: { MLBFormatting.dateLabel($0.selection.officialDate) }
            )
            ForEach(sections, id: \.key) { section in
                Section {
                    // Enumerate so each card gets a staggered fade-in index as
                    // the loaded feed replaces the shimmer skeleton.
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                        PropPlayerCard(
                            item: item,
                            namespace: cardTransition,
                            onSelect: { selectedProp = $0 }
                        )
                        .padding(.horizontal, 12)
                        .staggeredAppear(index: index)
                    }
                } header: {
                    sectionHeader(section.label)
                }
            }
        }
    }

    private var nflFilteredEmptyLabel: String {
        if store.nflPlayers.isEmpty {
            return "No NFL player props posted today"
        }
        let marketLabel = nflFilters.market.map { NFLPlayerProps.marketLabel($0) }
        if nflFilters.signalsOnly {
            if let gameId = nflFilters.gameId,
               let option = nflGameFilterOptions.first(where: { $0.gameId == gameId }) {
                let matchup = "\(option.awayAbbr) @ \(option.homeAbbr)"
                if let marketLabel {
                    return "No \(marketLabel) prop signals for \(matchup)"
                }
                return "No prop signals for \(matchup)"
            }
            if let marketLabel {
                return "No \(marketLabel) prop signals posted today"
            }
            return "No prop signals posted today"
        }
        if let gameId = nflFilters.gameId,
           let option = nflGameFilterOptions.first(where: { $0.gameId == gameId }) {
            let matchup = "\(option.awayAbbr) @ \(option.homeAbbr)"
            if let marketLabel {
                return "No \(marketLabel) props for \(matchup)"
            }
            return "No props posted for \(matchup)"
        }
        if let marketLabel {
            return "No \(marketLabel) props posted today"
        }
        return "No NFL player props match these filters"
    }

    private var mlbFilteredEmptyLabel: String {
        if store.sortedMatchups().isEmpty {
            return "No MLB player props posted today"
        }
        let marketLabel = mlbFilters.market.map { MLBPlayerProps.marketLabel($0) }
        if let pk = mlbFilters.gamePk,
           let game = store.sortedMatchups().first(where: { $0.gamePk == pk }) {
            let matchup = "\(game.awayAbbr) @ \(game.homeAbbr)"
            if let marketLabel {
                return "No \(marketLabel) props for \(matchup)"
            }
            return "No props posted for \(matchup)"
        }
        if let marketLabel {
            return "No \(marketLabel) props posted today"
        }
        return "No MLB player props match these filters"
    }

    /// Order the flat feed by the active `sortMode`. Each mode falls back to
    /// game time as a stable tiebreak; `GameDateGrouping` re-buckets the result
    /// into chronological date sections, so this only sets within-date order.
    private func sortedFeedItems(_ items: [PlayerPropFeedItem]) -> [PlayerPropFeedItem] {
        switch sortMode {
        case .time:
            return items.sorted { a, b in
                if a.sortTime != b.sortTime { return a.sortTime < b.sortTime }
                return a.hitRate > b.hitRate
            }
        case .hitRate:
            return items.sorted { a, b in
                if a.hitRate != b.hitRate { return a.hitRate > b.hitRate }
                return a.sortTime < b.sortTime
            }
        }
    }

    // MARK: - States

    @ViewBuilder
    private var loadingSkeleton: some View {
        // Mirror PropPlayerCard's chrome + internal layout so the crossfade to
        // loaded cards never shifts the feed. Same 12pt horizontal inset the
        // real cards use; .transition(.opacity) fades to the loaded list.
        VStack(spacing: 8) {
            ForEach(0..<3, id: \.self) { _ in
                PropCardShimmer()
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .transition(.opacity)
    }

    @ViewBuilder
    private func errorState(_ message: String) -> some View {
        VStack {
            Spacer().frame(height: 40)
            ContentUnavailableView {
                Label("Failed to load props", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button {
                    Task { await store.refresh(force: true) }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private var comingSoonState: some View {
        VStack(spacing: 14) {
            Spacer().frame(height: 40)
            Image(systemName: "hourglass")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(Color.appPrimary)
            Text("\(store.selectedSport.label) player props coming soon")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
            Text("MLB and NFL props are live — model-driven prop trends across more sports are on the way.")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 320)
    }

    private func sectionHeader(_ label: String) -> some View {
        HStack {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Color.appTextSecondary)
                // Align the date label's leading edge with the card content (card
                // sits 12 from the screen + content inset) rather than floating
                // to its left — matches the Games list date headers.
                .padding(.leading, 20)
                .padding(.trailing, 16)
                .padding(.vertical, 6)
            Spacer(minLength: 0)
        }
    }

    private func emptyTile(label: String, systemImage: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.appTextMuted)
            Text(label)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 200)
    }

    /// Season-aware empty tile — shown when a prop sport's whole slate is empty
    /// (vs. `emptyTile`, used when filters exclude an otherwise-full board).
    /// Off-season points at the season start; in-season reads as mid-refresh.
    /// Copy/layout mirror the Games tab's season empty tile.
    private func seasonEmptyTile(for sport: PropsStore.Sport, systemImage: String) -> some View {
        let copy = SportSeason.emptyCopy(for: gamesSport(sport), itemsNoun: "player props", dataNoun: "prop data")
        return VStack(spacing: 12) {
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

// MARK: - Sport picker

/// Sport chooser behind the Props sport pill. A sheet (not a native Menu) so
/// each row carries its own styling: out-of-season sports render dimmed with an
/// "Out of season" caption, mirroring the Games tab's dimmed segments.
private struct PropSportPickerSheet: View {
    @Binding var selection: PropsStore.Sport
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(PropsStore.Sport.allCases) { sport in
                    Button {
                        selection = sport
                        dismiss()
                    } label: {
                        row(for: sport)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Select sport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func row(for sport: PropsStore.Sport) -> some View {
        let offSeason = !SportSeason.isInSeason(GamesStore.Sport(rawValue: sport.rawValue) ?? .mlb)
        HStack(spacing: 12) {
            Image(systemName: icon(for: sport))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(offSeason ? Color.appTextMuted : Color.appPrimary)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 1) {
                Text(sport.label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                if offSeason {
                    Text("Out of season")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            Spacer(minLength: 0)
            if selection == sport {
                Image(systemName: "checkmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
            }
        }
        // Dim off-season rows, but never the current selection (stays legible).
        .opacity(offSeason && selection != sport ? 0.55 : 1)
        .contentShape(Rectangle())
    }

    private func icon(for sport: PropsStore.Sport) -> String {
        switch sport {
        case .mlb: return "figure.baseball"
        case .nfl, .cfb: return "football.fill"
        case .nba, .ncaab: return "basketball.fill"
        }
    }
}

// MARK: - MLB matchup picker

/// Searchable matchup picker behind the MLB matchup filter pill. List rows show
/// the team logos a native `Menu` can't render, so the pill routes here instead
/// of a Menu (the Outliers Trends precedent — every matchup filter is sheet-backed).
private struct MLBPropMatchupPickerSheet: View {
    let options: [MLBPropGameFilterOption]
    @Binding var selection: Int?
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""

    // `options[0]` is the all-games sentinel; the list renders it as its own row.
    private var games: [MLBPropGameFilterOption] { options.filter { !$0.isAllGames } }

    private var filtered: [MLBPropGameFilterOption] {
        let t = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return games }
        return games.filter {
            [$0.awayAbbr, $0.homeAbbr, $0.awayName, $0.homeName]
                .contains { $0.localizedCaseInsensitiveContains(t) }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button { selection = nil; dismiss() } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "square.grid.2x2.fill")
                                .foregroundStyle(Color.appPrimary)
                            Text("All games").foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            if selection == nil {
                                Image(systemName: "checkmark").foregroundStyle(Color.appPrimary)
                            }
                        }
                    }
                }
                Section("Games") {
                    ForEach(filtered) { opt in
                        Button { selection = opt.gamePk; dismiss() } label: {
                            HStack(spacing: 12) {
                                MLBTeamLogo(logoUrl: opt.awayLogoUrl, abbrev: opt.awayAbbr, name: opt.awayName, size: 30)
                                MLBTeamLogo(logoUrl: opt.homeLogoUrl, abbrev: opt.homeAbbr, name: opt.homeName, size: 30)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(opt.awayName)
                                        .font(.system(size: 13, weight: .semibold))
                                        .lineLimit(1).minimumScaleFactor(0.85)
                                    Text("@ \(opt.homeName)")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(Color.appTextSecondary)
                                        .lineLimit(1).minimumScaleFactor(0.85)
                                }
                                Spacer(minLength: 0)
                                if selection == opt.gamePk {
                                    Image(systemName: "checkmark").foregroundStyle(Color.appPrimary)
                                }
                            }
                            .foregroundStyle(Color.appTextPrimary)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, prompt: "Search teams")
            .navigationTitle("Select matchup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
    }
}

// MARK: - MLB market filter

private struct MLBPropMarketFilterSheet: View {
    @Binding var selectedMarket: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    marketRow(nil, label: "All Markets")
                }
                Section("Pitching") {
                    ForEach(MLBPropFeedFilters.sheetPitcherMarkets, id: \.self) { key in
                        marketRow(key, label: MLBPlayerProps.marketLabel(key))
                    }
                }
                Section("Hitting") {
                    ForEach(MLBPropFeedFilters.sheetBatterMarkets, id: \.self) { key in
                        marketRow(key, label: MLBPlayerProps.marketLabel(key))
                    }
                }
            }
            .navigationTitle("Prop Market")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func marketRow(_ key: String?, label: String) -> some View {
        Button {
            selectedMarket = key
            dismiss()
        } label: {
            HStack {
                Text(label)
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                if selectedMarket == key {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                }
            }
        }
    }
}

// MARK: - NFL matchup picker

/// Searchable matchup picker behind the NFL matchup filter pill. The `options`
/// list is already scoped by the active signals-only mode (built with
/// `signalsOnly:`), so every row listed is a valid selection — no per-row guard.
private struct NFLPropMatchupPickerSheet: View {
    let options: [NFLPropGameFilterOption]
    @Binding var selection: String?
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""

    private var games: [NFLPropGameFilterOption] { options.filter { !$0.isAllGames } }

    private var filtered: [NFLPropGameFilterOption] {
        let t = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return games }
        return games.filter {
            [$0.awayAbbr, $0.homeAbbr, $0.awayTeam, $0.homeTeam]
                .contains { $0.localizedCaseInsensitiveContains(t) }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button { selection = nil; dismiss() } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "square.grid.2x2.fill")
                                .foregroundStyle(Color.appPrimary)
                            Text("All games").foregroundStyle(Color.appTextPrimary)
                            Spacer()
                            if selection == nil {
                                Image(systemName: "checkmark").foregroundStyle(Color.appPrimary)
                            }
                        }
                    }
                }
                Section("Games") {
                    ForEach(filtered) { opt in
                        Button { selection = opt.gameId; dismiss() } label: {
                            HStack(spacing: 12) {
                                GameCardTeamAvatar(teamName: opt.awayAbbr, sport: "nfl", size: 30, colors: NFLTeamColors.colorPair(for: opt.awayTeam))
                                GameCardTeamAvatar(teamName: opt.homeAbbr, sport: "nfl", size: 30, colors: NFLTeamColors.colorPair(for: opt.homeTeam))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(opt.awayTeam)
                                        .font(.system(size: 13, weight: .semibold))
                                        .lineLimit(1).minimumScaleFactor(0.85)
                                    Text("@ \(opt.homeTeam)")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(Color.appTextSecondary)
                                        .lineLimit(1).minimumScaleFactor(0.85)
                                }
                                Spacer(minLength: 0)
                                if selection == opt.gameId {
                                    Image(systemName: "checkmark").foregroundStyle(Color.appPrimary)
                                }
                            }
                            .foregroundStyle(Color.appTextPrimary)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, prompt: "Search teams")
            .navigationTitle("Select matchup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
    }
}

// MARK: - NFL market filter

private struct NFLPropMarketFilterSheet: View {
    @Binding var filters: NFLPropFeedFilters
    let players: [NFLPropPlayer]
    let sheetMarkets: NFLPropFeedFilters.SheetMarkets
    @Environment(\.dismiss) private var dismiss

    private var signalCount: Int {
        NFLPropFeedFilters.flaggedPlayerCount(from: players, gameId: filters.gameId)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    filterRow(allMarkets: true)
                    signalsRow
                }
                if !sheetMarkets.passing.isEmpty {
                    Section("Passing") {
                        ForEach(sheetMarkets.passing, id: \.self) { key in
                            filterRow(market: key, label: NFLPlayerProps.marketLabel(key))
                        }
                    }
                }
                if !sheetMarkets.rushing.isEmpty {
                    Section("Rushing") {
                        ForEach(sheetMarkets.rushing, id: \.self) { key in
                            filterRow(market: key, label: NFLPlayerProps.marketLabel(key))
                        }
                    }
                }
                if !sheetMarkets.receiving.isEmpty {
                    Section("Receiving") {
                        ForEach(sheetMarkets.receiving, id: \.self) { key in
                            filterRow(market: key, label: NFLPlayerProps.marketLabel(key))
                        }
                    }
                }
                if !sheetMarkets.other.isEmpty {
                    Section("Other") {
                        ForEach(sheetMarkets.other, id: \.self) { key in
                            filterRow(market: key, label: NFLPlayerProps.marketLabel(key))
                        }
                    }
                }
            }
            .navigationTitle("Prop Market")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var signalsRow: some View {
        Button {
            filters.market = nil
            filters.signalsOnly = true
            dismiss()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(Color(hex: 0xF97316))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Prop Signals")
                        .foregroundStyle(Color.appTextPrimary)
                    if signalCount > 0 {
                        Text("\(signalCount) player\(signalCount == 1 ? "" : "s") with a signal")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
                Spacer()
                if filters.signalsOnly {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                }
            }
        }
    }

    @ViewBuilder
    private func filterRow(allMarkets: Bool = false, market: String? = nil, label: String = "All Markets") -> some View {
        let isSelected = allMarkets
            ? (!filters.signalsOnly && filters.market == nil)
            : (!filters.signalsOnly && filters.market == market)
        Button {
            filters.signalsOnly = false
            filters.market = market
            dismiss()
        } label: {
            HStack {
                Text(label)
                    .foregroundStyle(Color.appTextPrimary)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                }
            }
        }
    }
}
