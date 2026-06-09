import Foundation

/// Codable mirror of the `feature_requests` row in Main Supabase. Field names
/// match the RN type in `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx`
/// byte-for-byte so the same JSON payload decodes cleanly here.
///
/// Status semantics (from RN + RLS policies):
/// - `pending` — submitted but not yet approved by an editor (hidden from
///   regular users; admins-only view).
/// - `approved` — visible in the "Community Voting" section, users can vote.
/// - `roadmap` — promoted from community to the developer roadmap. Voting UI
///   is hidden; only a "N votes" badge is shown. Substate carried by
///   `roadmap_status`.
public struct FeatureRequest: Codable, Identifiable, Sendable, Hashable {
    public enum Status: String, Codable, Sendable, Hashable {
        case pending
        case approved
        case roadmap
    }

    /// Roadmap substate. Only populated when `status == .roadmap`.
    public enum RoadmapStatus: String, Codable, Sendable, Hashable {
        case planned
        case inProgress = "in_progress"
        case completed
    }

    public let id: String
    public let title: String
    public let description: String
    public let submittedBy: String
    public let submitterDisplayName: String
    public let status: Status
    public let roadmapStatus: RoadmapStatus?
    public let upvotes: Int
    public let downvotes: Int
    public let createdAt: String
    public let updatedAt: String

    /// Net votes = upvotes - downvotes. Used everywhere the RN screen shows
    /// the green/red signed badge.
    public var netVotes: Int { upvotes - downvotes }

    public init(
        id: String,
        title: String,
        description: String,
        submittedBy: String,
        submitterDisplayName: String,
        status: Status,
        roadmapStatus: RoadmapStatus? = nil,
        upvotes: Int,
        downvotes: Int,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.submittedBy = submittedBy
        self.submitterDisplayName = submitterDisplayName
        self.status = status
        self.roadmapStatus = roadmapStatus
        self.upvotes = upvotes
        self.downvotes = downvotes
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case submittedBy = "submitted_by"
        case submitterDisplayName = "submitter_display_name"
        case status
        case roadmapStatus = "roadmap_status"
        case upvotes
        case downvotes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Per-user vote record. Mirrors the `feature_request_votes` table.
/// One row per (user, feature_request) pair — re-voting the same type
/// deletes the row, switching type updates it. See `FeatureRequestsStore.vote`
/// for the toggle/switch semantics that match RN.
public struct FeatureRequestVote: Codable, Sendable, Hashable {
    public enum VoteType: String, Codable, Sendable, Hashable {
        case upvote
        case downvote
    }

    public let featureRequestId: String
    public let voteType: VoteType

    public init(featureRequestId: String, voteType: VoteType) {
        self.featureRequestId = featureRequestId
        self.voteType = voteType
    }

    enum CodingKeys: String, CodingKey {
        case featureRequestId = "feature_request_id"
        case voteType = "vote_type"
    }
}
