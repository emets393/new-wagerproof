import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Editor's Picks tab. Ports `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx`.
///
/// Layout (mirrors the spec §9):
///   - NavigationStack root
///   - Sport-pill row pinned under the nav bar
///   - List with grouped Sections by date (oldest at bottom)
///   - Pull-to-refresh
///   - View-mode toggle (compact / large) in toolbar
///   - Admin-only FAB → opens `EditorPickCreatorBottomSheet`
///   - Tap card → opens `PickDetailBottomSheet` via `.sheet(item:)`
///   - Long-press (admin) → opens edit sheet
///   - Swipe-to-delete (admin) on rows
///
/// State is owned by an injected `EditorPicksStore` so the screenshot harness
/// can pre-seed deterministic states (empty / loaded / error).
struct PicksView: View {
    @State private var store: EditorPicksStore
    @State private var detailStore = PickDetailSheetStore()
    @State private var creatorStore = EditorPickSheetStore()
    /// Drives the push to the Editor's Picks Stats dashboard (banner tap).
    @State private var showStats = false

    /// FIDELITY-WAIVER #015: admin / pro flags ship as plain @State seeded
    /// from `AuthStore`/`ProAccessStore` when those stores wire up in B08.
    /// For now they're flipped via the dev settings sheet (B14).
    @State private var adminModeEnabled: Bool = false
    @State private var isPro: Bool = false

    init() {
        _store = State(initialValue: EditorPicksStore())
    }

    #if DEBUG
    init(store: EditorPicksStore, adminModeEnabled: Bool = false, isPro: Bool = false) {
        _store = State(initialValue: store)
        _adminModeEnabled = State(initialValue: adminModeEnabled)
        _isPro = State(initialValue: isPro)
    }
    #endif

    var body: some View {
        @Bindable var binding = store
        NavigationStack {
            content
                .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Editor's Picks")
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            store.viewMode = store.viewMode == .compact ? .large : .compact
                        } label: {
                            Image(systemName: store.viewMode == .compact ? "square.stack.fill" : "list.bullet")
                                .font(.system(size: 17, weight: .semibold))
                        }
                        .tint(Color.appTextPrimary)
                        .sensoryFeedback(.selection, trigger: store.viewMode)
                        .accessibilityLabel(store.viewMode == .compact ? "Switch to large cards" : "Switch to compact cards")
                    }
                    if adminModeEnabled {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button {
                                store.showDrafts.toggle()
                            } label: {
                                Image(systemName: store.showDrafts ? "eye" : "eye.slash")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(store.showDrafts ? Color.appPrimary : Color.appTextSecondary)
                            }
                            .sensoryFeedback(.selection, trigger: store.showDrafts)
                            .accessibilityLabel(store.showDrafts ? "Hide drafts" : "Show drafts")
                        }
                    }
                }
                .refreshable {
                    await store.refresh(adminMode: adminModeEnabled)
                }
                .task {
                    if case .idle = store.loadState {
                        await store.refresh(adminMode: adminModeEnabled)
                    }
                }
                .onChange(of: store.showDrafts) { _, _ in
                    Task { await store.refresh(adminMode: adminModeEnabled) }
                }
                .overlay(alignment: .bottomTrailing) {
                    if adminModeEnabled {
                        adminFAB
                    }
                }
                .sheet(item: $detailStore.selection) { selection in
                    PickDetailBottomSheet(
                        pick: selection.pick,
                        gameData: selection.gameData,
                        onDismiss: { detailStore.dismiss() }
                    )
                }
                .sheet(isPresented: Binding(
                    get: { creatorStore.isPresented },
                    set: { if !$0 { creatorStore.dismiss() } }
                )) {
                    EditorPickCreatorBottomSheet(
                        editingPick: creatorStore.editingPick,
                        onSaved: {
                            await store.refresh(adminMode: adminModeEnabled)
                        },
                        onClose: { creatorStore.dismiss() }
                    )
                }
                // Picks tab listens for "user saved a pick" so it can re-fetch.
                // Mirrors RN's `setOnPickSaved(() => fetchPicks)` pub-sub bridge.
                .onAppear {
                    creatorStore.onPickSaved = { [store] in
                        await store.refresh(adminMode: adminModeEnabled)
                    }
                }
                .onDisappear {
                    creatorStore.onPickSaved = nil
                }
                // Editor's Picks Stats dashboard — pushed from the banner tap.
                .navigationDestination(isPresented: $showStats) {
                    EditorPicksStatsView()
                }
        }
    }

    // MARK: - Content branches

    @ViewBuilder
    private var content: some View {
        VStack(spacing: 0) {
            sportPills
            if store.selectedSport == .cfb {
                CFBDryRunPicksView()
            } else
            // Loading and idle states render the skeleton when picks
            // haven't arrived yet. Once we have picks, we always render the
            // list and let `.refreshable` handle subsequent loads.
            if store.picks.isEmpty {
                switch store.loadState {
                case .idle, .loading:
                    loadingSkeleton
                case .failed(let msg):
                    errorState(msg)
                case .loaded:
                    emptyState
                }
            } else if filteredPicks.isEmpty {
                emptyState
            } else {
                pickList
            }
        }
        .animation(.appQuick, value: store.selectedSport)
        .animation(.appQuick, value: store.viewMode)
    }

    @ViewBuilder
    private var sportPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 24) {
                ForEach(EditorPicksStore.SportFilter.allCases, id: \.self) { sport in
                    Button {
                        store.selectedSport = sport
                    } label: {
                        VStack(spacing: 4) {
                            Text(sport.label)
                                .font(.system(size: 16, weight: store.selectedSport == sport ? .bold : .medium))
                                .foregroundStyle(store.selectedSport == sport ? Color.appTextPrimary : Color.appTextSecondary)
                            Rectangle()
                                .fill(store.selectedSport == sport ? Color.appPrimary : .clear)
                                .frame(height: 3)
                                .cornerRadius(2)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Filter to \(sport.label)")
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
        .frame(height: 48)
        .background(Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.appBorder.opacity(0.3)).frame(height: 1)
        }
        .sensoryFeedback(.selection, trigger: store.selectedSport)
    }

    @ViewBuilder
    private var pickList: some View {
        List {
            // Stats banner — first row in the list (matches RN's ListHeaderComponent).
            Section {
                EditorPicksStatsBanner(onEditorPicksTap: { showStats = true })
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            ForEach(store.groupedByDate(filteredPicks)) { section in
                Section {
                    ForEach(section.picks) { pick in
                        pickRow(pick)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                } header: {
                    dateSectionHeader(section.title)
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.appSurface)
    }

    @ViewBuilder
    private func pickRow(_ pick: EditorPick) -> some View {
        let gameData = store.gamesData[pick.gameId] ?? EditorPickGameData(awayTeam: "Away", homeTeam: "Home")
        let showLocked = !isPro && !(pick.isFreePick ?? false)

        Group {
            if showLocked {
                LockedPickCard(sport: pick.gameType.displayLabel, minHeight: store.viewMode == .compact ? 80 : 180)
            } else {
                PickCardErrorBoundary(pickId: pick.id, pick: pick, gameData: gameData) {
                    if store.viewMode == .compact {
                        CompactPickCard(pick: pick, gameData: gameData) {
                            detailStore.present(pick: pick, gameData: gameData)
                        }
                    } else {
                        Button {
                            detailStore.present(pick: pick, gameData: gameData)
                        } label: {
                            EditorPickCard(
                                pick: pick,
                                gameData: gameData,
                                adminModeEnabled: adminModeEnabled,
                                onEdit: { creatorStore.openEdit(pick) },
                                onResultUpdated: {
                                    Task { await store.refresh(adminMode: adminModeEnabled) }
                                },
                                updateResult: { result in
                                    await store.updateResult(pickId: pick.id, to: result)
                                }
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .contextMenu {
            if adminModeEnabled {
                Button {
                    creatorStore.openEdit(pick)
                } label: {
                    Label("Edit", systemImage: "pencil")
                }
                Button(role: .destructive) {
                    Task {
                        if await store.delete(pickId: pick.id) {
                            await store.refresh(adminMode: adminModeEnabled)
                        }
                    }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if adminModeEnabled {
                Button(role: .destructive) {
                    Task {
                        if await store.delete(pickId: pick.id) {
                            await store.refresh(adminMode: adminModeEnabled)
                        }
                    }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: detailStore.selection?.id == pick.id)
    }

    @ViewBuilder
    private func dateSectionHeader(_ title: String) -> some View {
        HStack(spacing: 12) {
            Rectangle().fill(Color.appBorder.opacity(0.5)).frame(height: 1)
            Text(title.uppercased())
                .font(.system(size: 12, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)
            Rectangle().fill(Color.appBorder.opacity(0.5)).frame(height: 1)
        }
        .padding(.vertical, 8)
        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
        .listRowBackground(Color.clear)
        .textCase(nil)
    }

    @ViewBuilder
    private var loadingSkeleton: some View {
        ScrollView {
            VStack(spacing: 8) {
                // Keep the real stats banner — it loads independently of picks
                // and gives the screen a stable header during the fetch.
                EditorPicksStatsBanner(onEditorPicksTap: { showStats = true })
                // Compact is the default view mode, so the skeleton mirrors
                // CompactPickCard's footprint regardless of `store.viewMode`.
                ForEach(0..<5, id: \.self) { _ in
                    CompactPickCardShimmer()
                        .padding(.horizontal, 16)
                        .padding(.vertical, 4)
                }
            }
            .padding(.vertical, Spacing.md)
        }
        // Crossfade into the loaded List once picks arrive.
        .transition(.opacity)
    }

    @ViewBuilder
    private var emptyState: some View {
        ScrollView {
            VStack {
                EditorPicksStatsBanner(onEditorPicksTap: { showStats = true })
                ContentUnavailableView {
                    Label("No Current Picks", systemImage: "clipboard.fill")
                } description: {
                    Text(store.selectedSport == .all
                         ? "Check back soon for new picks"
                         : "No \(store.selectedSport.label) picks right now")
                }
                .padding(.top, Spacing.xxl)
            }
        }
    }

    @ViewBuilder
    private func errorState(_ message: String) -> some View {
        VStack {
            EditorPicksStatsBanner(onEditorPicksTap: { showStats = true })
            ContentUnavailableView {
                Label("Couldn't load picks", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button {
                    Task { await store.refresh(adminMode: adminModeEnabled) }
                } label: {
                    Label("Retry", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
            }
            .padding(.top, Spacing.xxl)
            Spacer()
        }
    }

    @ViewBuilder
    private var adminFAB: some View {
        Button {
            creatorStore.openCreate()
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(Color.appPrimary, in: Circle())
                .shadow(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .padding(.trailing, 20)
        .padding(.bottom, 24)
        .sensoryFeedback(.impact(weight: .medium), trigger: creatorStore.mode)
        .accessibilityLabel("Create new pick")
    }

    // MARK: - Selectors

    private var filteredPicks: [EditorPick] {
        store.filtered(by: store.selectedSport)
    }
}

/// Skeleton placeholder for `CompactPickCard`, shown while the initial picks
/// fetch is in flight. Reproduces the real card's chrome exactly (16pt elevated
/// surface, hairline border, 4pt left accent bar, 12pt content padding, trailing
/// chevron) and lays skeleton primitives where the logos / abbreviations / time
/// pill / pick value / units / result badge land, so the crossfade to loaded
/// content never shifts the layout.
///
/// The inner placeholder group carries the unified `.shimmering()` sweep; the
/// card chrome stays solid (applied via `.background`/`.overlay` *after* the
/// shimmer). Mirrors the golden `GameCardShimmer` pattern.
private struct CompactPickCardShimmer: View {
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 16)
        HStack(spacing: 0) {
            // Left accent bar (4pt wide) — neutral skeleton tint, not result-tinted.
            Rectangle()
                .fill(Color.appSkeleton)
                .frame(width: 4)

            content
                .shimmering()
                .padding(.vertical, 12)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Chevron stays solid chrome (matches the real card's static glyph).
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextMuted.opacity(0.4))
                .padding(.trailing, 12)
        }
        .background(shape.fill(Color.appSurfaceElevated))
        .overlay(shape.stroke(Color.appBorder, lineWidth: 1))
        .clipShape(shape)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header row: away logo + abbr, "@", home logo + abbr, time pill.
            HStack(spacing: 6) {
                SkeletonCircle(28)
                SkeletonBlock(width: 32, height: 13)
                SkeletonCircle(28)
                SkeletonBlock(width: 32, height: 13)
                Spacer(minLength: 4)
                SkeletonCapsule(width: 52, height: 18)
            }

            // Pick row: pick-type icon + pick value + units, result badge trailing.
            HStack(spacing: 6) {
                SkeletonCircle(14)
                SkeletonBlock(width: 110, height: 14)
                SkeletonBlock(width: 30, height: 12)
                Spacer(minLength: 4)
                SkeletonCapsule(width: 60, height: 20)
            }
        }
    }
}

#Preview("Empty state") {
    PicksView()
}

/// CFB dry-run picks feed: active flags grouped by conviction, tracking flags
/// split into their own watch section, and mammoth games highlighted up top.
private struct CFBDryRunPicksView: View {
    @State private var store = CFBDryRunPicksStore()

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                header
                mammothBanner
                activeSections
                trackingSection
            }
            .padding(16)
        }
        .background(Color.appSurface)
        .refreshable { await store.refresh() }
        .task {
            if case .idle = store.loadState {
                await store.refresh()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("CFB Week 7 Dry Run")
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(Color.appTextPrimary)
            Text("Active picks are separated from tracking/watch signals. Full-game moneyline remains display-only.")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var mammothBanner: some View {
        if let game = store.mammothGames.first {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label("MAMMOTH", systemImage: "diamond.fill")
                        .font(.system(size: 12, weight: .black))
                        .foregroundStyle(Color(hex: 0xFDBA74))
                    Spacer()
                    Text("\(unitsText(game.stakeUnits ?? 5))u")
                        .font(.system(size: 12, weight: .black))
                        .foregroundStyle(Color(hex: 0xFDBA74))
                }
                Text("\(CFBTeamAssets.abbr(for: game.awayTeam)) @ \(CFBTeamAssets.abbr(for: game.homeTeam))")
                    .font(.system(size: 20, weight: .black))
                    .foregroundStyle(Color.appTextPrimary)
                Text(game.headlinePick ?? "Top model play")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                if let score = game.predictedScore {
                    Text("Model score: \(CFBTeamAssets.abbr(for: game.awayTeam)) \(scoreText(score.away)) · \(CFBTeamAssets.abbr(for: game.homeTeam)) \(scoreText(score.home))")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            .padding(14)
            .background(
                LinearGradient(
                    colors: [Color(hex: 0xF97316).opacity(0.22), Color.appSurfaceElevated],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Color(hex: 0xF97316).opacity(0.35), lineWidth: 1))
        }
    }

    private var activeSections: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(activeGroups, id: \.tier) { group in
                pickSection(title: group.tier.label, subtitle: "\(group.picks.count) picks", groups: group.picks)
            }
        }
    }

    @ViewBuilder
    private var trackingSection: some View {
        if !store.trackingFlags.isEmpty {
            signalSection(title: "Tracking / Watch", subtitle: "\(store.trackingFlags.count) paper-trade", flags: store.trackingFlags, muted: true)
        }
    }

    private var activeGroups: [(tier: CFBFlagConviction, picks: [FeedPickGroup])] {
        CFBFlagConviction.allCases
            .filter { $0 != .track }
            .compactMap { tier in
                let flags = store.activeFlags.filter { $0.convictionTier == tier }
                let groups = groupedPicks(from: flags)
                return groups.isEmpty ? nil : (tier, groups)
            }
    }

    private func pickSection(title: String, subtitle: String, groups: [FeedPickGroup]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(Color.appTextPrimary)
                Text(subtitle)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
            }
            ForEach(groups) { group in
                pickGroupCard(group)
            }
        }
    }

    private func signalSection(title: String, subtitle: String, flags: [CFBDryRunFlag], muted: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(Color.appTextPrimary)
                Text(subtitle)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
            }
            ForEach(flags) { flag in
                signalCard(flag, muted: muted)
            }
        }
    }

    private func pickGroupCard(_ group: FeedPickGroup) -> some View {
        let game = store.game(for: group.gameId)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(game.map { "\(CFBTeamAssets.abbr(for: $0.awayTeam)) @ \(CFBTeamAssets.abbr(for: $0.homeTeam))" } ?? group.gameLabel)
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                Spacer()
                if let units = group.units {
                    Text("\(unitsText(units))u")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(Color.appPrimary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.appPrimary.opacity(0.12), in: Capsule())
                }
            }
            Text(group.title)
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(Color.appTextPrimary)
            HStack(spacing: 8) {
                chip("\(group.flags.count) signals", tint: Color.appPrimary)
                if let edge = group.edge { chip("edge \(signed(edge))", tint: Color.appPrimary) }
                chip(group.bookLabel, tint: Color.appAccentBlue)
            }
            VStack(alignment: .leading, spacing: 5) {
                ForEach(group.flags.prefix(3)) { flag in
                    Text("• \(flag.signalDefinition?.displayName ?? marketTitle(flag.market))")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                if group.flags.count > 3 {
                    Text("+\(group.flags.count - 3) more supporting signals")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
        }
        .padding(12)
        .background(Color.appSurfaceElevated.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.appBorder.opacity(0.35), lineWidth: 0.6))
    }

    private func signalCard(_ flag: CFBDryRunFlag, muted: Bool) -> some View {
        let game = store.game(for: flag.gameId)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(game?.awayTeam ?? flag.game ?? "CFB")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                if let game {
                    Text("@ \(game.homeTeam)")
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                }
                Spacer()
                Text("\(unitsText(flag.stakeUnits ?? 0))u")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(muted ? Color.appTextSecondary : Color.appPrimary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background((muted ? Color.appTextSecondary : Color.appPrimary).opacity(0.12), in: Capsule())
            }
            Text(flag.signalDefinition?.displayName ?? marketTitle(flag.market))
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
            HStack(spacing: 8) {
                chip(flag.market.replacingOccurrences(of: "_", with: " ").uppercased(), tint: muted ? Color.appTextSecondary : Color.appPrimary)
                chip("\(flag.side) \(lineText(flag.line))", tint: Color.appTextPrimary)
                chip(flag.gradeLine ?? "line", tint: Color.appAccentBlue)
                if let edge = flag.edge {
                    chip("edge \(signed(edge))", tint: Color.appPrimary)
                }
            }
        }
        .padding(12)
        .background(Color.appSurfaceElevated.opacity(muted ? 0.55 : 0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.appBorder.opacity(0.35), lineWidth: 0.6))
    }

    private struct FeedPickGroup: Identifiable {
        let id: String
        let gameId: String
        let gameLabel: String
        let market: String
        let side: String
        let flags: [CFBDryRunFlag]

        var title: String {
            let line = flags.compactMap(\.line).first
            return "\(marketTitleStatic(market)) \(side.uppercased()) \(line.map { String(format: "%.1f", $0) } ?? "")"
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }

        var units: Double? { flags.compactMap(\.stakeUnits).max() }
        var edge: Double? { flags.compactMap(\.edge).max(by: { abs($0) < abs($1) }) }
        var bookLabel: String { flags.compactMap(\.gradeLine).first ?? "line" }
    }

    private func groupedPicks(from flags: [CFBDryRunFlag]) -> [FeedPickGroup] {
        Dictionary(grouping: flags) { flag in
            "\(flag.gameId)|\(marketTitle(flag.market))|\(flag.side.uppercased())"
        }
        .map { key, flags in
            let first = flags[0]
            return FeedPickGroup(
                id: key,
                gameId: first.gameId,
                gameLabel: first.game ?? "CFB",
                market: first.market,
                side: first.side,
                flags: flags.sorted { a, b in
                    if a.convictionTier.sortRank != b.convictionTier.sortRank {
                        return a.convictionTier.sortRank < b.convictionTier.sortRank
                    }
                    return (a.stakeUnits ?? 0) > (b.stakeUnits ?? 0)
                }
            )
        }
        .sorted {
            ($0.units ?? 0) == ($1.units ?? 0)
                ? $0.title < $1.title
                : ($0.units ?? 0) > ($1.units ?? 0)
        }
    }

    private func chip(_ text: String, tint: Color) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .black))
            .foregroundStyle(tint)
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .background(tint.opacity(0.10), in: Capsule())
    }

    private func lineText(_ value: Double?) -> String {
        guard let value else { return "" }
        return String(format: "%.1f", value)
    }

    private func scoreText(_ value: Double) -> String {
        String(format: "%.1f", value)
    }

    private func signed(_ value: Double) -> String {
        value >= 0 ? "+\(lineText(value))" : lineText(value)
    }

    private func unitsText(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }

    private func marketTitle(_ raw: String) -> String {
        Self.marketTitleStatic(raw)
    }

    private static func marketTitleStatic(_ raw: String) -> String {
        switch raw.lowercased() {
        case "spread": return "Spread"
        case "total": return "Total"
        case "team_total": return "Team Total"
        case "h1_spread": return "1H Spread"
        case "h1_total": return "1H Total"
        case "h1_ml": return "1H ML"
        default: return raw.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}
