import Foundation
import Observation

/// Local-only favorites set, persisted to `UserDefaults`. Mirrors the RN
/// `useFavoriteAgentIds` hook in spirit, but the RN hook also queries
/// server-side flags (`avatar_profiles.is_widget_favorite` + the per-follow
/// `is_favorite` column). The Swift store keeps the device-local "favorited
/// for the Top Picks Favorites filter" preference; the server-side widget
/// favorite + per-follow favorite are handled separately by
/// `TopAgentsWidgetService` and `FollowedAgentsStore`.
///
/// Storage:
///   - Backed by `UserDefaults.standard` under `topPicksFavoriteAgentIds`.
///   - Set serialized as `[String]` of avatar UUIDs (lowercased).
///   - Cheap enough to call `toggle` on hot paths — write is synchronous and
///     UserDefaults batches itself.
///
/// The RN hook treats favorites as union(own widget favorites,
/// followed-with-is_favorite=true). On iOS we additionally OR in this local
/// set so power users can curate the Favorites filter without flipping any
/// server flags. The view collapses all three sources into a single
/// `favoriteAgentIds` set when building the filter query.
@Observable
@MainActor
public final class FavoriteAgentsStore {
    /// UserDefaults key used to persist the favorite set. Keep the spelling
    /// stable — changing it would silently wipe users' favorites on upgrade.
    private static let storageKey = "topPicksFavoriteAgentIds"

    public private(set) var favoriteIds: Set<String> = []

    private let defaults: UserDefaults

    /// Default constructor uses `.standard`. Tests inject a scratch UserDefaults
    /// via the suiteName-based init below to avoid clobbering real data.
    public init() {
        self.defaults = .standard
        self.favoriteIds = Self.load(from: defaults)
    }

    #if DEBUG
    /// Test-only init that targets a private UserDefaults suite so unit tests
    /// don't pollute the standard defaults.
    public init(suiteName: String) {
        let suite = UserDefaults(suiteName: suiteName) ?? .standard
        self.defaults = suite
        self.favoriteIds = Self.load(from: suite)
    }
    #endif

    public func isFavorite(_ agentId: String) -> Bool {
        favoriteIds.contains(normalize(agentId))
    }

    /// Toggle a favorite. Returns the new state for callers that want to drive
    /// haptics / icon swaps off the result.
    @discardableResult
    public func toggle(_ agentId: String) -> Bool {
        let key = normalize(agentId)
        if favoriteIds.contains(key) {
            favoriteIds.remove(key)
        } else {
            favoriteIds.insert(key)
        }
        persist()
        return favoriteIds.contains(key)
    }

    public func setFavorite(_ agentId: String, isFavorite: Bool) {
        let key = normalize(agentId)
        let was = favoriteIds.contains(key)
        if isFavorite, !was {
            favoriteIds.insert(key)
            persist()
        } else if !isFavorite, was {
            favoriteIds.remove(key)
            persist()
        }
    }

    public func clear() {
        favoriteIds = []
        persist()
    }

    // MARK: - Internal

    private func normalize(_ agentId: String) -> String {
        agentId.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func persist() {
        // Sorted for deterministic diffs in case anyone inspects defaults.
        let arr = favoriteIds.sorted()
        defaults.set(arr, forKey: Self.storageKey)
    }

    private static func load(from defaults: UserDefaults) -> Set<String> {
        guard let arr = defaults.array(forKey: storageKey) as? [String] else {
            return []
        }
        return Set(arr.map { $0.lowercased() })
    }
}
