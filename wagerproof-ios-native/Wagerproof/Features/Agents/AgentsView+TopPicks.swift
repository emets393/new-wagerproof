import SwiftUI
import WagerproofModels
import WagerproofStores

/// Integration surface for the new Top Agent Picks feed (B16). Lives in a
/// separate file because `AgentsView.swift` is being co-edited by B14
/// (creation wizard) and B15 (detail/settings) in parallel and we don't want
/// to fight over the same file diff.
///
/// AgentsView wiring (apply during the post-B14/B15 integration pass):
///
/// 1. Add a `@State` for the feed store, and instantiate a
///    `FavoriteAgentsStore` on the parent — see this file for the canonical
///    holder.
/// 2. Replace the body of `private var topPicksBranch: some View { … }`
///    inside `AgentsView` with:
///
///        TopAgentPicksFeed(
///            store: topPicksFeedStore,
///            onAgentTap: { id in
///                navPath.append(AgentsRoute.publicAgentDetail(agentId: id))
///            },
///            onPickTap: { row in
///                // Open the matching game sheet — defer to the existing
///                // pick-detail sheet store once B14 wires it.
///                navPath.append(AgentsRoute.publicAgentDetail(agentId: row.avatarId))
///            }
///        )
///        .environment(favoritesStore)
///
/// 3. Resolve FIDELITY-WAIVER #070 (Top Picks filter UI is single-mode).
///
/// 4. In `AgentsView.task { … }`, bind the feed store to the active user id
///    via `topPicksFeedStore.bind(viewerUserId: currentUserId)` and call
///    `await topPicksFeedStore.refresh()` when the tab becomes active.
///
/// Until step 1-4 ship, `AgentsView` still routes through the inline
/// `TopPickRow` list it had after B13. That list calls into
/// `AgentsStore.refreshTopPicks` which uses the same underlying RPC.
///
/// This file deliberately doesn't extend `AgentsView` to inject the feed
/// itself — adding stored properties via an extension isn't legal Swift, so
/// the integration must happen inline. We capture the wiring as
/// documentation + a reusable container view (`TopAgentPicksFeedContainer`)
/// that callers can drop into any future surface (drawer screen, deep link,
/// etc.) without re-doing the binding plumbing.
///
/// Integration ticket: `docs/wagerproof-migration/tickets/081-agents-top-picks-feed-wiring.md`
struct TopAgentPicksFeedContainer: View {
    @State private var store: TopAgentPicksFeedStore
    @State private var favorites: FavoriteAgentsStore
    let viewerUserId: String?
    let onAgentTap: (String) -> Void
    let onPickTap: (TopAgentPickFeedRow) -> Void

    @MainActor
    init(
        viewerUserId: String?,
        onAgentTap: @escaping (String) -> Void,
        onPickTap: @escaping (TopAgentPickFeedRow) -> Void
    ) {
        _store = State(initialValue: TopAgentPicksFeedStore())
        _favorites = State(initialValue: FavoriteAgentsStore())
        self.viewerUserId = viewerUserId
        self.onAgentTap = onAgentTap
        self.onPickTap = onPickTap
    }

    #if DEBUG
    @MainActor
    init(
        store: TopAgentPicksFeedStore,
        favorites: FavoriteAgentsStore? = nil,
        viewerUserId: String? = nil,
        onAgentTap: @escaping (String) -> Void = { _ in },
        onPickTap: @escaping (TopAgentPickFeedRow) -> Void = { _ in }
    ) {
        _store = State(initialValue: store)
        _favorites = State(initialValue: favorites ?? FavoriteAgentsStore())
        self.viewerUserId = viewerUserId
        self.onAgentTap = onAgentTap
        self.onPickTap = onPickTap
    }
    #endif

    var body: some View {
        TopAgentPicksFeed(
            store: store,
            onAgentTap: onAgentTap,
            onPickTap: onPickTap
        )
        .environment(favorites)
        .task {
            store.bind(viewerUserId: viewerUserId)
            if case .idle = store.loadState {
                await store.refresh()
            }
        }
        .onChange(of: viewerUserId) { _, newId in
            store.bind(viewerUserId: newId)
            Task { await store.refresh() }
        }
    }
}
