#if DEBUG
import Foundation
import WagerproofModels

/// Deterministic sample data for the Feature Requests parity screenshots.
/// Not used in production — gated behind `#if DEBUG`.
///
/// Covers: two approved community items (one with the current user's
/// upvote, one neutral), and three roadmap items spanning planned /
/// in-progress / completed states.
enum FeatureRequestsFixtures {
    /// Stable UUID for the sample user — referenced by `sampleUserVotes`
    /// so the row renders in its upvoted state in the screenshot.
    static let sampleUserId = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!

    static let sampleRequests: [FeatureRequest] = [
        approvedTopVoted,
        approvedNeutral,
        roadmapPlanned,
        roadmapInProgress,
        roadmapCompleted
    ]

    static let sampleUserVotes: [FeatureRequestVote] = [
        FeatureRequestVote(featureRequestId: "fr-approved-1", voteType: .upvote)
    ]

    private static var approvedTopVoted: FeatureRequest {
        FeatureRequest(
            id: "fr-approved-1",
            title: "Late-night NBA prop feed",
            description: "Overnight prop feed for West Coast tip-offs and overseas markets so we can react before the line moves.",
            submittedBy: UUID().uuidString,
            submitterDisplayName: "Sam M.",
            status: .approved,
            roadmapStatus: nil,
            upvotes: 28,
            downvotes: 2,
            createdAt: "2026-05-12T14:23:00Z",
            updatedAt: "2026-05-12T14:23:00Z"
        )
    }

    private static var approvedNeutral: FeatureRequest {
        FeatureRequest(
            id: "fr-approved-2",
            title: "Push notification when bets are graded",
            description: "Optional notification with the daily P/L summary once results post — currently we have to refresh manually.",
            submittedBy: UUID().uuidString,
            submitterDisplayName: "Jenna",
            status: .approved,
            roadmapStatus: nil,
            upvotes: 11,
            downvotes: 1,
            createdAt: "2026-05-04T09:11:00Z",
            updatedAt: "2026-05-04T09:11:00Z"
        )
    }

    private static var roadmapPlanned: FeatureRequest {
        FeatureRequest(
            id: "fr-roadmap-1",
            title: "MLB park-factor calibration",
            description: "Re-train the regression model to weight the post-humidor 2026 park-factor data more heavily.",
            submittedBy: UUID().uuidString,
            submitterDisplayName: "Editor",
            status: .roadmap,
            roadmapStatus: .planned,
            upvotes: 42,
            downvotes: 0,
            createdAt: "2026-04-12T18:00:00Z",
            updatedAt: "2026-04-12T18:00:00Z"
        )
    }

    private static var roadmapInProgress: FeatureRequest {
        FeatureRequest(
            id: "fr-roadmap-2",
            title: "Bet slip grader for parlays",
            description: "Extend the bet slip grader to support multi-leg parlays with correlated legs flagged inline.",
            submittedBy: UUID().uuidString,
            submitterDisplayName: "WagerProof",
            status: .roadmap,
            roadmapStatus: .inProgress,
            upvotes: 65,
            downvotes: 0,
            createdAt: "2026-03-22T18:00:00Z",
            updatedAt: "2026-05-10T18:00:00Z"
        )
    }

    private static var roadmapCompleted: FeatureRequest {
        FeatureRequest(
            id: "fr-roadmap-3",
            title: "Dark mode improvements",
            description: "Tighten contrast on the scoreboard cards and the WagerBot transcript.",
            submittedBy: UUID().uuidString,
            submitterDisplayName: "Editor",
            status: .roadmap,
            roadmapStatus: .completed,
            upvotes: 38,
            downvotes: 2,
            createdAt: "2026-02-01T18:00:00Z",
            updatedAt: "2026-04-30T18:00:00Z"
        )
    }
}
#endif
