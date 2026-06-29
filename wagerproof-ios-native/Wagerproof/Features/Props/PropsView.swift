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
    /// NFL-only feed filters — reset when leaving the NFL segment.
    @State private var nflFilters = NFLPropFeedFilters()
    @State private var showNFLMarketSheet = false
    @State private var showBestPicks = false
    @State private var bestPicksStore = MLBPlayerPropPicksStore()

    // Shared namespace for the card→detail zoom transition (same pattern as
    // GamesView). The source card and the pushed detail reference the same
    // sourceID (`PlayerPropSelection.transitionID`).
    @Namespace private var cardTransition

    var body: some View {
        @Bindable var binding = store
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 8, pinnedViews: [.sectionHeaders]) {
                    Section {
                        LazyVStack(spacing: 8) {
                            bodyContent
                        }
                    } header: {
                        propsHeader
                    }
                }
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("Props")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                await store.refresh(force: true)
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

    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        WagerProofLeadingToolbarItem()
        ToolbarItemGroup(placement: .topBarTrailing) {
            WagerBotToolbarButton(tabStore: tabStore)
            SettingsToolbarButton(tabStore: tabStore)
        }
    }

    // MARK: - Sport picker

    @ViewBuilder
    private var propsHeader: some View {
        VStack(spacing: 0) {
            pickerBar
            if store.selectedSport == .mlb {
                mlbBestPicksBanner
                    .transition(.opacity.combined(with: .move(edge: .top)))
                MLBPropFilterBar(
                    filters: $mlbFilters,
                    gameOptions: mlbGameFilterOptions,
                    showMarketSheet: $showMLBMarketSheet
                )
                .transition(.opacity.combined(with: .move(edge: .top)))
            } else if store.selectedSport == .nfl {
                NFLPropFilterBar(
                    filters: $nflFilters,
                    players: store.nflPlayers,
                    gameOptions: nflGameFilterOptions,
                    showMarketSheet: $showNFLMarketSheet
                )
                .id("nfl-prop-filter-bar")
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.appQuick, value: store.selectedSport)
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

    /// Sort control embedded in the picker bar next to the sport segments —
    /// same placement and icon-only glass treatment as `GamesView.sortMenu`.
    @ViewBuilder
    private var sortMenu: some View {
        Menu {
            Picker("Sort by", selection: $sortMode) {
                ForEach(PropSortMode.modes(for: store.selectedSport), id: \.self) { mode in
                    Label(mode.label, systemImage: mode.icon).tag(mode)
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 32, height: 32)
        }
        .tint(Color.appTextPrimary)
        .sensoryFeedback(.selection, trigger: sortMode)
        .accessibilityLabel("Sort props")
    }

    @ViewBuilder
    private var sportPicker: some View {
        @Bindable var binding = store
        Picker("Sport", selection: $binding.selectedSport) {
            ForEach(PropsStore.Sport.allCases) { sport in
                Text(sport.label).tag(sport)
            }
        }
        .pickerStyle(.segmented)
        .clipShape(.capsule)
        .sensoryFeedback(.selection, trigger: store.selectedSport)
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
        .padding(.horizontal, 14)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    // MARK: - NFL sections

    @ViewBuilder
    private var nflSections: some View {
        // Same shape as the MLB feed: one card per player, date-grouped with
        // sticky headers; the sort mode reorders players within a date.
        let items = sortedNFLItems(NFLPropFeed.items(from: store.nflPlayers, filters: nflFilters))
        if items.isEmpty {
            emptyTile(label: nflFilteredEmptyLabel, systemImage: "football")
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
            emptyTile(label: mlbFilteredEmptyLabel, systemImage: "baseball")
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
}

// MARK: - MLB filter chrome

/// MLB Props tab filter bar: logo matchup tiles + centered market picker pill.
private struct MLBPropFilterBar: View {
    @Binding var filters: MLBPropFeedFilters
    let gameOptions: [MLBPropGameFilterOption]
    @Binding var showMarketSheet: Bool

    private let logoSize: CGFloat = 34
    private let cardShape = RoundedRectangle(cornerRadius: 14, style: .continuous)

    var body: some View {
        VStack(spacing: 10) {
            gameRow
            marketPickerPill
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
    }

    private var gameRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(gameOptions) { option in
                    gameTile(option)
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
        }
    }

    private func gameTile(_ option: MLBPropGameFilterOption) -> some View {
        let isActive = filters.gamePk == option.gamePk
        return Button {
            filters.gamePk = option.gamePk
        } label: {
            Group {
                if option.isAllGames {
                    VStack(spacing: 4) {
                        Image(systemName: "baseball.fill")
                            .font(.system(size: 20, weight: .semibold))
                        Text("All")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .frame(width: 72, height: 56)
                } else {
                    HStack(spacing: 6) {
                        MLBTeamLogo(
                            logoUrl: option.awayLogoUrl,
                            abbrev: option.awayAbbr,
                            name: option.awayName,
                            size: logoSize
                        )
                        Text("@")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                        MLBTeamLogo(
                            logoUrl: option.homeLogoUrl,
                            abbrev: option.homeAbbr,
                            name: option.homeName,
                            size: logoSize
                        )
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 56)
                }
            }
            .foregroundStyle(isActive ? Color(hex: 0x00E676) : Color.appTextSecondary)
            .background(
                cardShape.fill(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.12)
                        : Color.appSurfaceMuted.opacity(0.55)
                )
            )
            .overlay(
                cardShape.stroke(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.5)
                        : Color.appBorder.opacity(0.45),
                    lineWidth: isActive ? 1.5 : 1
                )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.accessibilityLabel)
    }

    private var marketPickerPill: some View {
        Button { showMarketSheet = true } label: {
            HStack(spacing: 6) {
                Text(MLBPropFeedFilters.marketLabel(filters.market))
                    .font(.system(size: 13, weight: .semibold))
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(Color.appTextPrimary)
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .liquidGlassBackground(in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.55), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityLabel("Prop market filter")
        .accessibilityValue(MLBPropFeedFilters.marketLabel(filters.market))
    }
}

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

// MARK: - NFL filter chrome

private struct NFLPropFilterBar: View {
    @Binding var filters: NFLPropFeedFilters
    let players: [NFLPropPlayer]
    let gameOptions: [NFLPropGameFilterOption]
    @Binding var showMarketSheet: Bool

    private let logoSize: CGFloat = 34
    private let cardShape = RoundedRectangle(cornerRadius: 14, style: .continuous)

    var body: some View {
        VStack(spacing: 10) {
            gameRow
            marketPickerPill
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
    }

    private var gameRow: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(gameOptions) { option in
                        gameTile(option)
                            .id(option.id)
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 2)
            }
            .onAppear { scrollToSelectedGame(proxy) }
            .onChange(of: filters.gameId) { _, _ in scrollToSelectedGame(proxy) }
            .onChange(of: filters.signalsOnly) { _, _ in scrollToSelectedGame(proxy) }
            .onChange(of: gameOptions.map(\.id)) { _, _ in scrollToSelectedGame(proxy) }
        }
    }

    private func scrollToSelectedGame(_ proxy: ScrollViewProxy) {
        let target = filters.gameId ?? "all"
        DispatchQueue.main.async {
            withAnimation(.easeInOut(duration: 0.2)) {
                proxy.scrollTo(target, anchor: .center)
            }
        }
    }

    private func selectGame(_ option: NFLPropGameFilterOption) {
        if let gameId = option.gameId, filters.signalsOnly,
           !NFLPropFeedFilters.hasFlaggedPlayers(in: players, gameId: gameId) {
            return
        }
        filters.gameId = option.gameId
    }

    private func gameTile(_ option: NFLPropGameFilterOption) -> some View {
        let isActive = filters.gameId == option.gameId
        return Button {
            selectGame(option)
        } label: {
            Group {
                if option.isAllGames {
                    VStack(spacing: 4) {
                        Image(systemName: "football.fill")
                            .font(.system(size: 20, weight: .semibold))
                        Text("All")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .frame(width: 72, height: 56)
                } else {
                    HStack(spacing: 6) {
                        GameCardTeamAvatar(
                            teamName: option.awayAbbr,
                            sport: "nfl",
                            size: logoSize,
                            colors: NFLTeamColors.colorPair(for: option.awayTeam)
                        )
                        Text("@")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.appTextMuted)
                        GameCardTeamAvatar(
                            teamName: option.homeAbbr,
                            sport: "nfl",
                            size: logoSize,
                            colors: NFLTeamColors.colorPair(for: option.homeTeam)
                        )
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 56)
                }
            }
            .foregroundStyle(isActive ? Color(hex: 0x00E676) : Color.appTextSecondary)
            .background(
                cardShape.fill(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.12)
                        : Color.appSurfaceMuted.opacity(0.55)
                )
            )
            .overlay(
                cardShape.stroke(
                    isActive
                        ? Color(hex: 0x00E676).opacity(0.5)
                        : Color.appBorder.opacity(0.45),
                    lineWidth: isActive ? 1.5 : 1
                )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.accessibilityLabel)
    }

    private var marketPickerPill: some View {
        Button { showMarketSheet = true } label: {
            HStack(spacing: 6) {
                Text(NFLPropFeedFilters.filterLabel(filters))
                    .font(.system(size: 13, weight: .semibold))
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(Color.appTextPrimary)
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .liquidGlassBackground(in: Capsule())
            .overlay(Capsule().stroke(Color.appBorder.opacity(0.55), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityLabel("Prop market filter")
        .accessibilityValue(NFLPropFeedFilters.filterLabel(filters))
    }
}

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
