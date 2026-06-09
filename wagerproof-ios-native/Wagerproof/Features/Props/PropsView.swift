import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Sort orders for the player-props feed, surfaced by the sort control embedded
/// in the picker bar (same spot the Games page keeps its sort menu). Date
/// sections always stay chronological — the mode only reorders players *within*
/// each date.
private enum PropSortMode: String, CaseIterable {
    case time, hitRate, name

    var label: String {
        switch self {
        case .time: return "Game Time"
        case .hitRate: return "L10 Hit Rate"
        case .name: return "Player Name"
        }
    }

    var icon: String {
        switch self {
        case .time: return "clock"
        case .hitRate: return "flame"
        case .name: return "textformat"
        }
    }
}

/// Props tab. Mirrors `GamesView`'s structure (large title, pinned sport
/// picker, date-grouped sections, pull-to-refresh, settings/WagerBot
/// toolbar) but the feed items are player-prop matchup cards.
///
/// Player props exist for MLB today; the sport picker is kept for parity and
/// future sports — non-MLB sports show a "coming soon" state. Tapping a
/// player's list-item card pushes `PlayerPropDetailView`, where the trend
/// chart + line slider adapt in real time.
struct PropsView: View {
    @Environment(MainTabStore.self) private var tabStore
    // Shared at the tab shell so the MLB game-detail Player Props widget reads
    // the same slate (see MainTabView).
    @Environment(PropsStore.self) private var store
    @State private var selectedProp: PlayerPropSelection?
    /// Player ordering within each date section (view-level presentation only —
    /// the shared store stays sort-agnostic so the MLB game-detail widget that
    /// reads the same slate is unaffected).
    @State private var sortMode: PropSortMode = .time
    /// Drives the push to the Player Prop Matchups tool when its banner is tapped
    /// (same `SportTool`/`ToolRouter` plumbing the Games page uses).
    @State private var selectedTool: SportTool?

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
                            toolBanner
                            bodyContent
                        }
                    } header: {
                        pickerBar
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
                await store.refresh()
            }
            .toolbar { mainToolbar }
            .navigationDestination(item: $selectedProp) { selection in
                PlayerPropDetailView(selection: selection)
                    .navigationTransition(.zoom(sourceID: selection.transitionID, in: cardTransition))
            }
            // Player Prop Matchups tool pushes onto this stack (banner tap) — the
            // shared ToolRouter resolves the same leaf the Games page / Outliers
            // hub open, so every entry point stays in sync.
            .navigationDestination(item: $selectedTool) { tool in
                ToolRouter.leafView(for: tool.category)
            }
            // Settings pushes onto this stack (tapping the trailing gear) instead
            // of covering the screen as a modal — see MainTabToolbar.swift.
            .wagerProofSettingsDestination(tabStore: tabStore, tab: .props)
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
                ForEach(PropSortMode.allCases, id: \.self) { mode in
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

    // MARK: - Tool banner

    /// "Player Prop Matchups" analytics tool shown above the list — the same
    /// HoneydewOptionCard banner the MLB Games page surfaces. Player props are
    /// MLB-only today, so the banner appears only when the selected sport has
    /// props; tapping it pushes the shared `MLBPitcherMatchupsView` leaf.
    @ViewBuilder
    private var toolBanner: some View {
        if store.selectedSport.hasProps,
           let tool = SportTool.tools(for: .mlb).first(where: { $0.category == .mlbPitcherMatchups }) {
            ToolBannerCard(tool: tool) { selectedTool = tool }
                .padding(.horizontal, 12)
                .padding(.top, 4)
                .padding(.bottom, 6)
        }
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
        } else {
            matchupSections
        }
    }

    @ViewBuilder
    private var matchupSections: some View {
        // Flatten the slate into one card per player, then group by date
        // (sticky headers like the Games feed). Within a date, the player order
        // follows the selected sort mode.
        let items = sortedFeedItems(PlayerPropFeed.items(from: store.sortedMatchups()))
        if items.isEmpty {
            emptyTile(label: "No MLB player props posted today", systemImage: "baseball")
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
        case .name:
            return items.sorted { a, b in
                let cmp = a.selection.playerName.localizedCaseInsensitiveCompare(b.selection.playerName)
                if cmp != .orderedSame { return cmp == .orderedAscending }
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
            Text("We're starting with MLB — model-driven prop trends across more sports are on the way.")
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
