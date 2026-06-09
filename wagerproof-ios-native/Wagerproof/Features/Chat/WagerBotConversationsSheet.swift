import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// History drawer for the WagerBot chat. Direct port of Honeydew's
/// `ChatV3ConversationsSheet`:
///
///   • Pull from `chat_threads` on appear, ordered by `updated_at`.
///   • Leading swipe → pin (hoists into a "Pinned" section).
///   • Trailing swipe → delete (calls the server). We DO have a real
///     DELETE here (RN's `chatThreadService.deleteThread`), so the swipe
///     is server-backed rather than local-only like Honeydew's hide.
///   • Toolbar "Clear All" wipes every conversation on the server.
///
/// Pinned IDs persist in `UserDefaults` per Supabase user-id so each
/// account on the device has its own state. We deliberately don't sync
/// the pin state to Supabase: the server is the source of truth for
/// the conversation list itself, but pin order is presentation only.
struct WagerBotConversationsSheet: View {
    let activeThreadId: String?
    let userId: String?
    let onSelect: (WagerBotThreadSummary) -> Void

    @Environment(WagerBotChatStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    @State private var pinnedIds: Set<String> = []
    @State private var showClearAllConfirm: Bool = false

    var body: some View {
        let ui = WagerBotUiTokens.resolve(colorScheme)
        NavigationStack {
            content(ui: ui)
                .navigationTitle("History")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Clear All", role: .destructive) {
                            showClearAllConfirm = true
                        }
                        .disabled(store.threads.isEmpty)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { dismiss() }
                    }
                }
                .background(ui.pageBackground.ignoresSafeArea())
                .confirmationDialog(
                    "Clear all conversations?",
                    isPresented: $showClearAllConfirm,
                    titleVisibility: .visible
                ) {
                    Button("Clear All", role: .destructive) {
                        Task { await store.deleteAllThreads() }
                    }
                    Button("Cancel", role: .cancel) { }
                } message: {
                    Text("This permanently deletes every conversation in your history.")
                }
        }
        .task {
            loadLocalPins()
            if let userId, store.threads.isEmpty {
                await store.refreshHistory(userId: userId)
            }
        }
    }

    @ViewBuilder
    private func content(ui: WagerBotUiTokens) -> some View {
        switch store.historyLoadState {
        case .idle, .loading:
            loadingSkeleton
        case .failed(let msg):
            errorState(message: msg, ui: ui)
        case .loaded:
            if store.threads.isEmpty {
                emptyState(ui: ui)
            } else {
                list(ui: ui)
            }
        }
    }

    private func list(ui: WagerBotUiTokens) -> some View {
        List {
            if !pinned.isEmpty {
                Section("Pinned") {
                    ForEach(pinned, id: \.id) { thread in
                        row(for: thread, isPinned: true)
                    }
                }
            }
            Section(pinned.isEmpty ? "" : "History") {
                ForEach(unpinned, id: \.id) { thread in
                    row(for: thread, isPinned: false)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            if let userId { await store.refreshHistory(userId: userId) }
        }
    }

    /// Skeleton placeholder shown while the first `chat_threads` fetch is in
    /// flight. Renders ~6 conversation-shaped rows inside the same
    /// `List(.insetGrouped)` as the loaded state so the crossfade to real
    /// content doesn't shift the layout (vs. a bare centered spinner).
    private var loadingSkeleton: some View {
        List {
            Section("History") {
                ForEach(0..<6, id: \.self) { _ in
                    ConversationRowSkeleton()
                }
            }
        }
        .listStyle(.insetGrouped)
        // Skeletons aren't tappable; disabling avoids a flash of touch
        // feedback before real rows arrive.
        .disabled(true)
    }

    private func row(for thread: WagerBotThreadSummary, isPinned: Bool) -> some View {
        HStack(spacing: 12) {
            if isPinned {
                Image(systemName: "pin.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.orange)
                    .accessibilityLabel("Pinned")
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(thread.title?.isEmpty == false ? thread.title! : "New chat")
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                if let updated = thread.updatedAt {
                    Text(relativeFormatter.string(forDate: updated))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            if activeThreadId == thread.id {
                Image(systemName: "checkmark")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.appPrimary)
            } else {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            UISelectionFeedbackGenerator().selectionChanged()
            onSelect(thread)
        }
        // Leading swipe → toggle pin.
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button {
                togglePin(thread)
            } label: {
                Label(isPinned ? "Unpin" : "Pin",
                      systemImage: isPinned ? "pin.slash.fill" : "pin.fill")
            }
            .tint(.orange)
        }
        // Trailing swipe → server-backed delete (RN parity).
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Task { await store.deleteThread(thread.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .tint(Color.appLoss)
        }
    }

    private func emptyState(ui: WagerBotUiTokens) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.exclamationmark.bubble.right")
                .font(.system(size: 36, weight: .regular))
                .foregroundStyle(ui.mutedText)
            Text("No conversations yet")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(ui.primaryText)
            Text("Ask WagerBot anything about today's games and your conversations will show up here.")
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(ui.mutedText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 36)
        }
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(message: String, ui: WagerBotUiTokens) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32, weight: .regular))
                .foregroundStyle(.orange)
            Text("Couldn't load history")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(ui.primaryText)
            Text(message)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(ui.mutedText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 36)
            Button("Retry") {
                if let userId {
                    Task { await store.refreshHistory(userId: userId) }
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.appPrimary)
        }
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Pin state persistence

    private var pinned: [WagerBotThreadSummary] {
        store.threads.filter { pinnedIds.contains($0.id) }
    }

    private var unpinned: [WagerBotThreadSummary] {
        store.threads.filter { !pinnedIds.contains($0.id) }
    }

    private func togglePin(_ thread: WagerBotThreadSummary) {
        UISelectionFeedbackGenerator().selectionChanged()
        if pinnedIds.contains(thread.id) {
            pinnedIds.remove(thread.id)
        } else {
            pinnedIds.insert(thread.id)
        }
        persistPinned()
    }

    private func loadLocalPins() {
        guard let userId, !userId.isEmpty else { return }
        if let arr = UserDefaults.standard.array(forKey: pinnedKey(userId)) as? [String] {
            pinnedIds = Set(arr)
        }
    }

    private func persistPinned() {
        guard let userId, !userId.isEmpty else { return }
        UserDefaults.standard.set(Array(pinnedIds), forKey: pinnedKey(userId))
    }

    private func pinnedKey(_ uid: String) -> String { "wagerbot.pinnedThreads.\(uid)" }

    private let relativeFormatter = RelativeISOFormatter()
}

/// Skeleton mirror of `WagerBotConversationsSheet.row(for:isPinned:)`: a
/// title block over a shorter relative-timestamp block, with a trailing
/// chevron placeholder. Only the inner placeholder group shimmers — the List
/// cell chrome stays solid (see GameCardShimmer for the shared pattern).
private struct ConversationRowSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                SkeletonBlock(width: 200, height: 14)   // title (.body)
                SkeletonBlock(width: 90, height: 11)    // relative timestamp (.subheadline)
            }
            Spacer(minLength: 8)
            // Trailing chevron / checkmark accessory placeholder.
            SkeletonBlock(width: 10, height: 14, cornerRadius: 3)
        }
        .padding(.vertical, 2)
        .shimmering()
    }
}

/// Parses Supabase timestamp strings and formats them relative to now.
/// Honeydew uses Foundation's `RelativeDateTimeFormatter` directly on
/// `Date`; the equivalent here wraps it so the call site reads cleanly
/// from a JSON string field.
private struct RelativeISOFormatter {
    private let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private let fallback: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
    private let relative: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f
    }()

    func string(forDate dateString: String) -> String {
        let date = iso.date(from: dateString) ?? fallback.date(from: dateString)
        guard let date else { return "" }
        return relative.localizedString(for: date, relativeTo: Date())
    }
}
