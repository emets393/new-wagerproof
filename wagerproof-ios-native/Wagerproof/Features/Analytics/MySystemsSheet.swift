import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

private enum SystemsHubRoute: Hashable {
    case saveCurrent
    case saved(UUID)
    case leaderboard(String)
    case copyLeaderboard(String)
}

/// One home for owned and public systems. Toolbar entry points choose the
/// initial tab, but users can move between both collections without stacking
/// independent sheets.
struct SystemsHubSheet: View {
    @Bindable var store: HistoricalAnalysisStore
    let userId: UUID
    var onApplySaved: (HistoricalAnalysisSavedFilter) -> Void
    var onApplyLeaderboard: (AnalysisSystemsLeaderboardRow) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab: SystemsHubTab
    @State private var path: [SystemsHubRoute] = []

    init(
        store: HistoricalAnalysisStore,
        userId: UUID,
        initialTab: SystemsHubTab,
        onApplySaved: @escaping (HistoricalAnalysisSavedFilter) -> Void,
        onApplyLeaderboard: @escaping (AnalysisSystemsLeaderboardRow) -> Void
    ) {
        self.store = store
        self.userId = userId
        self.onApplySaved = onApplySaved
        self.onApplyLeaderboard = onApplyLeaderboard
        _selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                hubPicker

                switch selectedTab {
                case .mySystems:
                    MySystemsContent(
                        store: store,
                        userId: userId,
                        onSaveCurrent: { path.append(.saveCurrent) },
                        onOpen: { path.append(.saved($0.id)) },
                        onApply: applySaved
                    )
                case .leaderboard:
                    SystemsLeaderboardContent(store: store) { row in
                        path.append(.leaderboard(row.id))
                    }
                }
            }
            .background(Color.appSurface)
            .navigationTitle(selectedTab.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .navigationDestination(for: SystemsHubRoute.self) { route in
                destination(for: route)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.appSurface)
    }

    private var hubPicker: some View {
        Picker("Systems section", selection: $selectedTab) {
            ForEach(SystemsHubTab.allCases) { tab in
                Text(tab.title).tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .clipShape(.capsule)
        .padding(4)
        .modifier(LiquidGlassCapsule())
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .onChange(of: selectedTab) { _, _ in
            UISelectionFeedbackGenerator().selectionChanged()
        }
    }

    @ViewBuilder
    private func destination(for route: SystemsHubRoute) -> some View {
        switch route {
        case .saveCurrent:
            SaveSystemSheet(
                store: store,
                userId: userId,
                embedded: true
            ) { _ in
                selectedTab = .mySystems
            }

        case .saved(let id):
            if let row = store.savedFilters.first(where: { $0.id == id }) {
                SavedSystemDetailView(
                    row: row,
                    sport: store.sport,
                    onApply: { applySaved(row) }
                )
            } else {
                ContentUnavailableView("System unavailable", systemImage: "bookmark.slash")
            }

        case .leaderboard(let id):
            if let row = store.leaderboard.first(where: { $0.id == id }) {
                LeaderboardSystemDetailView(
                    row: row,
                    sport: store.sport,
                    onUse: { applyLeaderboard(row) },
                    onSaveCopy: { path.append(.copyLeaderboard(row.id)) }
                )
            } else {
                ContentUnavailableView("System unavailable", systemImage: "trophy")
            }

        case .copyLeaderboard(let id):
            if let row = store.leaderboard.first(where: { $0.id == id }),
               let snapshot = row.filters {
                SaveSystemSheet(
                    store: store,
                    userId: userId,
                    initialSnapshot: snapshot,
                    initialVerdict: row.verdict,
                    initialName: "Copy of \(row.name)",
                    embedded: true
                ) { _ in
                    selectedTab = .mySystems
                    path.removeAll()
                }
            } else {
                ContentUnavailableView(
                    "This system can't be copied",
                    systemImage: "doc.badge.ellipsis",
                    description: Text("Its filter rules are unavailable.")
                )
            }
        }
    }

    private func applySaved(_ row: HistoricalAnalysisSavedFilter) {
        onApplySaved(row)
        dismiss()
    }

    private func applyLeaderboard(_ row: AnalysisSystemsLeaderboardRow) {
        onApplyLeaderboard(row)
        dismiss()
    }
}

// MARK: - My Systems

private struct MySystemsContent: View {
    @Bindable var store: HistoricalAnalysisStore
    let userId: UUID
    var onSaveCurrent: () -> Void
    var onOpen: (HistoricalAnalysisSavedFilter) -> Void
    var onApply: (HistoricalAnalysisSavedFilter) -> Void

    @State private var pendingDelete: HistoricalAnalysisSavedFilter?
    @State private var pendingRename: HistoricalAnalysisSavedFilter?
    @State private var renameText = ""

    private var atLimit: Bool {
        store.savedFilters.count >= HistoricalAnalysisSavedFiltersService.maxPerUser
    }

    var body: some View {
        List {
            systemsHeader
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 4, trailing: 16))
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

            if let error = store.savedFiltersError {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appLoss)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            if store.savedFilters.isEmpty {
                emptyState
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            } else {
                ForEach(store.savedFilters) { row in
                    SavedSystemCard(
                        row: row,
                        sport: store.sport,
                        onOpen: { onOpen(row) },
                        onApply: { onApply(row) }
                    )
                    .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        Button {
                            Task {
                                await store.setSystemPublic(
                                    id: row.id,
                                    isPublic: !row.isPublic,
                                    userId: userId
                                )
                            }
                        } label: {
                            Label(
                                row.isPublic ? "Make Private" : "Share",
                                systemImage: row.isPublic ? "lock.fill" : "person.2.fill"
                            )
                        }
                        .tint(row.isPublic ? Color.appTextSecondary : Color.appPrimary)

                        Button {
                            pendingRename = row
                            renameText = row.name
                        } label: {
                            Label("Rename", systemImage: "pencil")
                        }
                        .tint(Color(hex: 0x0EA5E9))
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            pendingDelete = row
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.appSurface)
        .refreshable { await store.refreshSaved(userId: userId) }
        .task { await store.refreshSaved(userId: userId) }
        .alert(
            "Rename System",
            isPresented: Binding(
                get: { pendingRename != nil },
                set: { if !$0 { pendingRename = nil } }
            )
        ) {
            TextField("System name", text: $renameText)
            Button("Cancel", role: .cancel) { pendingRename = nil }
            Button("Save") {
                guard let row = pendingRename else { return }
                let trimmed = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
                pendingRename = nil
                guard !trimmed.isEmpty else { return }
                Task {
                    await store.renameSystem(id: row.id, name: trimmed, userId: userId)
                }
            }
        }
        .confirmationDialog(
            "Delete System",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let row = pendingDelete else { return }
                pendingDelete = nil
                Task {
                    await store.deleteSavedFilter(id: row.id, userId: userId)
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                }
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            if let row = pendingDelete {
                Text("Delete “\(row.name)”? This can't be undone.")
            }
        }
    }

    private var systemsHeader: some View {
        HStack(spacing: 8) {
            Image(systemName: "square.stack.3d.up.fill")
                .font(.system(size: 11, weight: .bold))
            Text("MY SYSTEMS")
                .font(.footnote.weight(.semibold))
            Text("\(store.savedFilters.count)/\(HistoricalAnalysisSavedFiltersService.maxPerUser)")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Spacer(minLength: 0)
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onSaveCurrent()
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: atLimit ? "lock.fill" : "plus")
                    Text(atLimit ? "Limit reached" : "Save current")
                }
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(atLimit ? Color.appTextMuted : Color.appPrimary)
            }
            .buttonStyle(.plain)
            .disabled(atLimit)
        }
        .foregroundStyle(Color.appTextSecondary)
    }

    private var emptyState: some View {
        VStack(spacing: 9) {
            Image(systemName: "square.stack.3d.up")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
            Text("No saved systems yet")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text("Save the setup you're viewing to use it again.")
                .font(.system(size: 11))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
        .padding(.vertical, 30)
    }
}

private struct SavedSystemCard: View {
    let row: HistoricalAnalysisSavedFilter
    let sport: HistoricalAnalysisSport
    var onOpen: () -> Void
    var onApply: () -> Void

    private var marketLabel: String {
        HistoricalAnalysisBetType(rawValue: row.betType)?.label ?? row.betType.uppercased()
    }
    private var filterLabels: [String] {
        HistoricalAnalysisCopy.filterChipLabels(sport: sport, snapshot: row.filters)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button(action: onOpen) {
                    HStack(spacing: 12) {
                        SystemGlyph(sport: sport, betType: row.betType, size: 44)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(row.name)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                                .lineLimit(1)
                            Text("\(marketLabel) · \(AnalysisSystemCopy.verdictLabel(row.verdict))")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                HStack(spacing: 5) {
                    Circle()
                        .fill(row.isPublic ? Color.appPrimary : Color.appTextMuted)
                        .frame(width: 6, height: 6)
                    Text(row.isPublic ? "Shared" : "Private")
                }
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(row.isPublic ? Color.appPrimary : Color.appTextSecondary)
            }

            Divider().background(Color.appBorder.opacity(0.5))

            HStack(spacing: 8) {
                SystemFilterSummary(labels: filterLabels)
                Spacer(minLength: 0)
                Text(AnalysisSystemCopy.sinceSavedLabel(row.sinceSaved))
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.appTextSecondary)
                Button(action: onApply) {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                        .frame(width: 28, height: 28)
                        .liquidGlassBackground(in: Circle(), tint: Color.appPrimary.opacity(0.14))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Apply \(row.name)")
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 9)
        .systemCardSurface()
    }
}

// MARK: - Saved detail

private struct SavedSystemDetailView: View {
    let row: HistoricalAnalysisSavedFilter
    let sport: HistoricalAnalysisSport
    var onApply: () -> Void

    private var marketLabel: String {
        HistoricalAnalysisBetType(rawValue: row.betType)?.label ?? row.betType.uppercased()
    }
    private var filterLabels: [String] {
        HistoricalAnalysisCopy.filterChipLabels(sport: sport, snapshot: row.filters)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 13) {
                    SystemGlyph(sport: sport, betType: row.betType, size: 48)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.name)
                            .font(.system(size: 19, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Label(
                            row.isPublic ? "Shared on leaderboard" : "Private system",
                            systemImage: row.isPublic ? "person.2.fill" : "lock.fill"
                        )
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(row.isPublic ? Color.appPrimary : Color.appTextSecondary)
                    }
                }

                detailsCard
            }
            .padding(20)
            .padding(.bottom, 96)
        }
        .background(Color.appSurface)
        .navigationTitle("System Details")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button("Apply This System", action: onApply)
                .font(.system(size: 15, weight: .bold))
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(Color.appPrimary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .foregroundStyle(.white)
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial)
        }
    }

    private var detailsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            detailRow("Rule") {
                Text("\(AnalysisSystemCopy.verdictLabel(row.verdict)) · \(marketLabel)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Divider().background(Color.appBorder.opacity(0.5))
            detailRow("Filters") {
                ScrollView(.horizontal, showsIndicators: false) {
                    SystemFilterSummary(labels: filterLabels, limit: filterLabels.count)
                }
            }
            Divider().background(Color.appBorder.opacity(0.5))
            HStack(spacing: 18) {
                compactMetric("RECORD", AnalysisSystemCopy.recordText(row.sinceSaved))
                compactMetric("ROI", row.sinceSaved?.roi.map { "\(signed($0))%" } ?? "—")
                compactMetric("UNITS", row.sinceSaved?.units.map { "\(signed($0))u" } ?? "—")
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .systemCardSurface()
    }

    private func detailRow<Content: View>(
        _ label: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
                .frame(width: 48, alignment: .leading)
            content()
            Spacer(minLength: 0)
        }
    }

    private func compactMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.system(size: 8, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    private func signed(_ value: Double) -> String {
        let body = value.rounded() == value
            ? String(format: "%.0f", abs(value))
            : String(format: "%.1f", abs(value))
        return "\(value >= 0 ? "+" : "−")\(body)"
    }
}
