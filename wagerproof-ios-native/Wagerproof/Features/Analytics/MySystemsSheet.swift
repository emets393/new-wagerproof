import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Lists the user's saved systems for the current sport.
struct MySystemsSheet: View {
    @Bindable var store: HistoricalAnalysisStore
    let userId: UUID
    var onApply: (HistoricalAnalysisSavedFilter) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var editingId: UUID?
    @State private var editName = ""
    @State private var pendingDelete: HistoricalAnalysisSavedFilter?

    var body: some View {
        NavigationStack {
            Group {
                if store.savedFilters.isEmpty {
                    ContentUnavailableView(
                        store.savedFiltersError != nil ? "Couldn't load systems" : "No systems yet",
                        systemImage: store.savedFiltersError != nil ? "exclamationmark.triangle" : "bookmark",
                        description: Text(
                            store.savedFiltersError
                                ?? "Build a filter, then tap Save System (bookmark button or ⋯ menu)."
                        )
                    )
                } else {
                    List {
                        ForEach(store.savedFilters) { row in
                            systemRow(row)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .background(Color.appSurface)
            .navigationTitle("My Systems (\(store.savedFilters.count))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .refreshable {
                await store.refreshSaved(userId: userId)
            }
            .task {
                await store.refreshSaved(userId: userId)
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
                    if let row = pendingDelete {
                        Task {
                            await store.deleteSavedFilter(id: row.id, userId: userId)
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        }
                    }
                    pendingDelete = nil
                }
                Button("Cancel", role: .cancel) { pendingDelete = nil }
            } message: {
                if let row = pendingDelete {
                    Text("Delete \"\(row.name)\"? This can't be undone.")
                }
            }
        }
    }

    @ViewBuilder
    private func systemRow(_ row: HistoricalAnalysisSavedFilter) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onApply(row)
                dismiss()
            } label: {
                VStack(alignment: .leading, spacing: 3) {
                    if editingId == row.id {
                        TextField("Name", text: $editName, onCommit: { commitRename(row.id) })
                            .font(.system(size: 15, weight: .bold))
                            .textFieldStyle(.plain)
                            .onSubmit { commitRename(row.id) }
                    } else {
                        Text(row.name)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                    }
                    Text("\(AnalysisSystemCopy.verdictLabel(row.verdict))\(row.verdict != nil ? " · " : "")\(row.betType.uppercased())")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    Text(AnalysisSystemCopy.sinceSavedLabel(row.sinceSaved))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .disabled(editingId == row.id)

            VStack(spacing: 2) {
                Toggle("", isOn: Binding(
                    get: { row.isPublic },
                    set: { v in
                        Task { await store.setSystemPublic(id: row.id, isPublic: v, userId: userId) }
                    }
                ))
                .labelsHidden()
                .tint(Color.appPrimary)
                Text("Share")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }

            Button {
                editingId = row.id
                editName = row.name
            } label: {
                Image(systemName: "pencil")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(6)
            }
            .buttonStyle(.plain)

            Button {
                pendingDelete = row
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.red)
                    .padding(6)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
        .listRowBackground(Color.appSurfaceElevated)
    }

    private func commitRename(_ id: UUID) {
        let trimmed = editName.trimmingCharacters(in: .whitespacesAndNewlines)
        editingId = nil
        guard !trimmed.isEmpty else { return }
        Task { await store.renameSystem(id: id, name: trimmed, userId: userId) }
    }
}
