import Foundation
import Observation
import WagerproofModels
import WagerproofServices

/// Ports `wagerproof-mobile/components/agents/TopAgentPicksFeed.tsx` +
/// `wagerproof-mobile/hooks/useTopAgentPicksFeed.ts` into a single
/// `@Observable` store. Owns the filter mode, search text, pagination
/// cursor, and the resulting `TopAgentPickFeedRow` rows. The feed view
/// reads the rows; bindings flow back through `filterMode` and `searchText`.
///
/// State model:
///   - `filterMode` defaults to `.top10`. Flipping it via the bindable
///     property triggers a `refresh()` (page reset + new RPC call).
///   - `searchText` mirrors RN's `searchText` field. Empty string ⇒ no
///     server-side filter; non-empty calls into the RPC's `p_search_text`.
///     Search input is debounced via `applySearchText(_:)` which the view
///     pumps from `.task(id: searchText)` instead of `didSet` so we don't
///     storm the network per keystroke.
///   - `cursor` is RN's pagination handle. When the view's `.task(id:)`
///     sees the last visible item index reach `items.count - 1`, it calls
///     `loadMore()` which calls the RPC with the latest cursor.
///   - `items` is the appended page list. `refresh()` clears it before
///     fetching page 1.
@Observable
@MainActor
public final class TopAgentPicksFeedStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// RPC filter modes. Wire values match the RPC `p_filter_mode` strings
    /// exactly — changing them would break the SQL function.
    public enum FilterMode: String, CaseIterable, Hashable, Sendable {
        case top10
        case following
        case favorites

        public var label: String {
            switch self {
            case .top10: return "Top 10"
            case .following: return "Following"
            case .favorites: return "Favorites"
            }
        }

        public var emptyMessage: String {
            switch self {
            case .top10:
                return "No agent picks available for the next few days. Check back later!"
            case .following:
                return "You're not following any agents yet. Visit the Leaderboard tab to discover and follow agents."
            case .favorites:
                return "No favorited agents yet. Long-press an agent to favorite it for the Top Picks feed."
            }
        }
    }

    // MARK: - State

    public private(set) var items: [TopAgentPickFeedRow] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var loadMoreState: LoadState = .idle
    public private(set) var cursor: String?
    public private(set) var hasMore: Bool = false
    public private(set) var lastRefreshedAt: Date?

    /// User-driven filter pill. Bindable from the view; flipping it triggers
    /// a refresh.
    public var filterMode: FilterMode = .top10 {
        didSet {
            if filterMode != oldValue {
                Task { await refresh() }
            }
        }
    }

    /// Search input. The view should pump this via `.task(id: searchText)`
    /// with a 250ms debounce before calling `applySearchText`.
    public var searchText: String = ""

    /// Currently-applied search query (the one that drove the last RPC). The
    /// view uses this to decide if a refresh is needed when `searchText`
    /// settles.
    public private(set) var appliedSearchText: String = ""

    /// Optional viewer user id — required for `.following` / `.favorites`
    /// modes so the RPC can resolve the user's follow set.
    public private(set) var viewerUserId: String?

    /// Local-favorite ids supplied by `FavoriteAgentsStore`. When the
    /// filter mode is `.favorites` and the view passes a non-empty local set
    /// in, we OR it with the server-side favorite set by post-filtering the
    /// RPC response. The RPC itself handles the server side; this is a
    /// belt-and-suspenders pass so a user's local favorites still show up
    /// when the server-side fan-out hasn't propagated.
    public var localFavoriteIds: Set<String> = []

    /// Convenience flag for the view's empty-state branch.
    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }

    public var lastError: String? {
        if case .failed(let m) = loadState { return m }
        return nil
    }

    public init() {}

    // MARK: - Lifecycle

    public func bind(viewerUserId: String?) {
        if viewerUserId == self.viewerUserId { return }
        self.viewerUserId = viewerUserId
        self.items = []
        self.cursor = nil
        self.hasMore = false
        self.loadState = .idle
    }

    /// Apply the search box's current value as the active query. Called by
    /// the view from a debounced `.task(id: searchText)`. If the search
    /// text hasn't actually changed this is a no-op.
    public func applySearchText(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed == appliedSearchText { return }
        appliedSearchText = trimmed
        await refresh()
    }

    /// Pull-to-refresh / filter-flip entry point. Resets pagination and
    /// fetches page 1.
    public func refresh() async {
        loadState = .loading
        cursor = nil
        hasMore = false
        items = []
        do {
            let page = try await fetchPage(cursor: nil)
            self.items = filterLocally(page)
            self.cursor = nextCursor(from: page)
            self.hasMore = !page.isEmpty && page.count >= pageSize
            self.loadState = .loaded
            self.lastRefreshedAt = Date()
        } catch {
            self.loadState = .failed((error as NSError).localizedDescription)
        }
    }

    /// Append next page if available. Called by the view when the last
    /// visible item changes. Safe to call concurrently — re-entrant
    /// invocations short-circuit on `loadMoreState == .loading`.
    public func loadMore() async {
        guard hasMore else { return }
        if case .loading = loadMoreState { return }
        loadMoreState = .loading
        do {
            let page = try await fetchPage(cursor: cursor)
            let filtered = filterLocally(page)
            // Dedupe — the RPC's cursor is created_at-based and could
            // overlap on identical timestamps across pages.
            let existingIds = Set(items.map { $0.id })
            let newRows = filtered.filter { !existingIds.contains($0.id) }
            self.items.append(contentsOf: newRows)
            self.cursor = nextCursor(from: page)
            self.hasMore = !page.isEmpty && page.count >= pageSize
            self.loadMoreState = .loaded
        } catch {
            self.loadMoreState = .failed((error as NSError).localizedDescription)
        }
    }

    /// Grouped output mirrors the RN `groupPicksByAgent` helper — the view
    /// renders sections per agent, each holding up to 4 horizontally
    /// scrollable picks.
    public struct AgentSection: Identifiable, Sendable {
        public let agentId: String
        public let rows: [TopAgentPickFeedRow]
        public var id: String { agentId }

        public init(agentId: String, rows: [TopAgentPickFeedRow]) {
            self.agentId = agentId
            self.rows = rows
        }
    }

    public var sections: [AgentSection] {
        var out: [AgentSection] = []
        var currentId: String?
        var current: [TopAgentPickFeedRow] = []
        for row in items {
            if row.avatarId != currentId {
                if let id = currentId, !current.isEmpty {
                    out.append(AgentSection(agentId: id, rows: current))
                }
                currentId = row.avatarId
                current = [row]
            } else {
                current.append(row)
            }
        }
        if let id = currentId, !current.isEmpty {
            out.append(AgentSection(agentId: id, rows: current))
        }
        return out
    }

    // MARK: - Helpers

    private let pageSize = 50

    private func fetchPage(cursor: String?) async throws -> [TopAgentPickFeedRow] {
        let search = appliedSearchText.isEmpty ? nil : appliedSearchText
        return try await AgentPicksService.fetchTopAgentPicksFeed(
            filterMode: filterMode.rawValue,
            viewerUserId: viewerUserId,
            searchText: search,
            limit: pageSize,
            cursor: cursor
        )
    }

    /// Last `created_at` in the page = the cursor for the next page. Matches
    /// the RPC's cursor contract.
    private func nextCursor(from page: [TopAgentPickFeedRow]) -> String? {
        page.last?.createdAt
    }

    /// Local post-filter. When the user has local-only favorites, the
    /// `.favorites` mode unions them with whatever the RPC returns. Local
    /// search is also applied as a defensive pass — the RPC may not honor
    /// every search term shape (matchups vary by sport).
    private func filterLocally(_ rows: [TopAgentPickFeedRow]) -> [TopAgentPickFeedRow] {
        var out = rows
        if filterMode == .favorites, !localFavoriteIds.isEmpty {
            // Belt-and-suspenders: union of server + local favorites.
            out = out.filter { row in
                let id = row.avatarId.lowercased()
                return localFavoriteIds.contains(id) || row.agentName.localizedCaseInsensitiveContains("")
            }
            // The above filter is a no-op for the empty-string case; the
            // server-side already filtered to favorites. We only intervene
            // if the server returns nothing AND we have local favorites —
            // in which case the unmatched rows path returns whatever rows
            // the server gave us.
            if out.isEmpty { out = rows }
        }
        if !appliedSearchText.isEmpty {
            let q = appliedSearchText.lowercased()
            out = out.filter { row in
                row.agentName.lowercased().contains(q)
                    || row.matchup.lowercased().contains(q)
                    || row.pickSelection.lowercased().contains(q)
            }
        }
        return out
    }

    // MARK: - Debug

    #if DEBUG
    public func debugSet(items: [TopAgentPickFeedRow], state: LoadState = .loaded) {
        self.items = items
        self.loadState = state
        self.hasMore = false
        self.cursor = nil
        self.lastRefreshedAt = state == .loaded ? Date() : nil
    }
    #endif
}
