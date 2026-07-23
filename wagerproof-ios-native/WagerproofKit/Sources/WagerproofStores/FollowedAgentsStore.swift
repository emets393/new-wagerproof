import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// `FollowedAgentsStore` ports `wagerproof-mobile/hooks/useFollowedAgents.ts`.
/// Tracks the public agents the current user follows by reading the
/// `user_avatar_follows` join table on the main Supabase project.
///
/// Follow/unfollow mutations themselves land in B16 with the Public Agent
/// Detail screen — this store only exposes the read path so the Top Picks
/// inner tab can filter to "Following" later. For B13 we expose the list.
@Observable
@MainActor
public final class FollowedAgentsStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// One row of follow data. Mirrors the RN `FollowedAgent` interface.
    public struct FollowedAgent: Identifiable, Sendable, Hashable {
        public let avatarId: String
        public let name: String
        public let avatarEmoji: String
        public let avatarColor: String
        public let isFavorite: Bool
        public let lastGeneratedAt: String?
        public let userId: String
        public let preferredSports: [AgentSport]
        public let performance: AgentPerformance?

        public var id: String { avatarId }

        public init(
            avatarId: String,
            name: String,
            avatarEmoji: String,
            avatarColor: String,
            isFavorite: Bool,
            lastGeneratedAt: String? = nil,
            userId: String = "",
            preferredSports: [AgentSport] = [],
            performance: AgentPerformance? = nil
        ) {
            self.avatarId = avatarId
            self.name = name
            self.avatarEmoji = avatarEmoji
            self.avatarColor = avatarColor
            self.isFavorite = isFavorite
            self.lastGeneratedAt = lastGeneratedAt
            self.userId = userId
            self.preferredSports = preferredSports
            self.performance = performance
        }

        public var agentWithPerformance: AgentWithPerformance {
            AgentWithPerformance(
                agent: Agent(
                    id: avatarId,
                    userId: userId,
                    name: name,
                    avatarEmoji: avatarEmoji,
                    avatarColor: avatarColor,
                    preferredSports: preferredSports,
                    archetype: nil,
                    isPublic: true,
                    createdAt: "",
                    updatedAt: "",
                    lastGeneratedAt: lastGeneratedAt
                ),
                performance: performance
            )
        }
    }

    public private(set) var follows: [FollowedAgent] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var userId: String?

    public init() {}

    public func bind(userId: String?) {
        if userId == self.userId { return }
        self.userId = userId
        self.follows = []
        self.loadState = .idle
    }

    /// Fetch the follow set. Joins `user_avatar_follows` against
    /// `avatar_profiles(name, avatar_emoji, avatar_color)` — matches the RN
    /// `useFollowedAgents` query in `useFollowedAgents.ts:28-46`.
    public func refresh() async {
        guard let userId else { return }
        loadState = .loading
        do {
            let main = await MainSupabase.shared.client
            let rows: [FollowRow] = try await main
                .from("user_avatar_follows")
                .select("avatar_id, is_favorite, avatar_profiles(user_id, name, avatar_emoji, avatar_color, preferred_sports, last_generated_at)")
                .eq("user_id", value: userId)
                .execute()
                .value
            let ids = rows.map(\.avatarId)
            let performances: [AgentPerformance]
            if ids.isEmpty {
                performances = []
            } else {
                performances = try await main
                    .from("avatar_performance_cache")
                    .select()
                    .in("avatar_id", values: ids)
                    .execute()
                    .value
            }
            let performanceById = Dictionary(
                uniqueKeysWithValues: performances.map { ($0.avatarId, $0) }
            )
            self.follows = rows.map { row in
                FollowedAgent(
                    avatarId: row.avatarId,
                    name: row.avatarProfiles?.name ?? "Unknown",
                    avatarEmoji: row.avatarProfiles?.avatarEmoji ?? "\u{1F916}",
                    avatarColor: row.avatarProfiles?.avatarColor ?? "#6366f1",
                    isFavorite: row.isFavorite ?? false,
                    lastGeneratedAt: row.avatarProfiles?.lastGeneratedAt,
                    userId: row.avatarProfiles?.userId ?? "",
                    preferredSports: row.avatarProfiles?.preferredSports ?? [],
                    performance: performanceById[row.avatarId]
                )
            }
            self.loadState = .loaded
        } catch {
            self.loadState = .failed((error as NSError).localizedDescription)
        }
    }

    /// Internal join-row Codable.
    private struct FollowRow: Decodable {
        let avatarId: String
        let isFavorite: Bool?
        let avatarProfiles: NestedProfile?

        enum CodingKeys: String, CodingKey {
            case avatarId = "avatar_id"
            case isFavorite = "is_favorite"
            case avatarProfiles = "avatar_profiles"
        }

        struct NestedProfile: Decodable {
            let name: String?
            let userId: String?
            let avatarEmoji: String?
            let avatarColor: String?
            let preferredSports: [AgentSport]?
            let lastGeneratedAt: String?
            enum CodingKeys: String, CodingKey {
                case name
                case userId = "user_id"
                case avatarEmoji = "avatar_emoji"
                case avatarColor = "avatar_color"
                case preferredSports = "preferred_sports"
                case lastGeneratedAt = "last_generated_at"
            }
        }
    }
}
