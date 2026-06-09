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
