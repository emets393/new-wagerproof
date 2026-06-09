import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// `FeatureRequestsStore` mirrors the React state owned inside
/// `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx`.
///
/// The RN screen kept everything in `useState` hooks inside the component;
/// porting it as an `@Observable` store keeps the view declarative and
/// matches the rest of the iOS shell (LiveScoresStore, AuthStore, …).
///
/// Backend contract — byte-identical to the RN file:
/// - Read: `feature_requests` filtered by `status IN ('approved','roadmap')`
///   ordered `created_at DESC` (regular users never see pending rows).
/// - Read: `feature_request_votes` filtered by the current `user_id`.
/// - Insert: `feature_requests` with `status='pending'` so the editor must
///   approve before it appears (matches RN line 144).
/// - Vote toggle/switch semantics on `feature_request_votes`:
///     - re-tap same type → DELETE the row
///     - tap different type → UPDATE `vote_type`
///     - first vote → INSERT
@Observable
@MainActor
public final class FeatureRequestsStore {
    public enum LoadState: Equatable, Sendable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    public private(set) var requests: [FeatureRequest] = []
    public private(set) var userVotes: [FeatureRequestVote] = []
    public private(set) var loadState: LoadState = .idle
    public private(set) var lastError: String?

    /// Bumped on successful submit so the view can drive
    /// `.sensoryFeedback(.success, trigger: store.justSubmittedAt)`.
    public private(set) var justSubmittedAt: Date?

    /// `true` while a submit network call is in-flight. Used by the sheet
    /// to disable the submit button and show a spinner.
    public private(set) var isSubmitting: Bool = false

    public var isLoading: Bool {
        if case .loading = loadState { return true }
        return false
    }

    public var hasRequests: Bool { !requests.isEmpty }

    /// Approved (community voting) requests only.
    public var approvedRequests: [FeatureRequest] {
        requests.filter { $0.status == .approved }
    }

    /// Roadmap-status partitioned subsets. Computed lazily by the view.
    public var plannedRoadmapItems: [FeatureRequest] {
        requests.filter { $0.status == .roadmap && $0.roadmapStatus == .planned }
    }

    public var inProgressRoadmapItems: [FeatureRequest] {
        requests.filter { $0.status == .roadmap && $0.roadmapStatus == .inProgress }
    }

    public var completedRoadmapItems: [FeatureRequest] {
        requests.filter { $0.status == .roadmap && $0.roadmapStatus == .completed }
    }

    public init() {}

    /// Refresh both the request list and the current user's votes.
    /// Wired to `.task` on view appear and `.refreshable` on pull-down.
    /// `userId` is `nil` when there is no signed-in session — RN guards
    /// the votes fetch the same way.
    public func refresh(userId: UUID?) async {
        loadState = .loading
        do {
            let client = await MainSupabase.shared.client

            // Read: feature_requests where status in (approved, roadmap)
            // ordered by created_at DESC. Identical to RN lines 82–86.
            let fetched: [FeatureRequest] = try await client
                .from("feature_requests")
                .select()
                .in("status", values: [
                    FeatureRequest.Status.approved.rawValue,
                    FeatureRequest.Status.roadmap.rawValue
                ])
                .order("created_at", ascending: false)
                .execute()
                .value
            requests = fetched

            // Read: feature_request_votes for the active user. Failure here
            // is non-fatal — RN ignores the error and proceeds with an
            // empty votes array (line 101).
            if let userId {
                do {
                    let votes: [FeatureRequestVote] = try await client
                        .from("feature_request_votes")
                        .select("feature_request_id, vote_type")
                        .eq("user_id", value: userId)
                        .execute()
                        .value
                    userVotes = votes
                } catch {
                    userVotes = []
                }
            } else {
                userVotes = []
            }

            loadState = .loaded
            lastError = nil
        } catch {
            loadState = .failed(error.localizedDescription)
            lastError = error.localizedDescription
        }
    }

    /// Cast / toggle / switch a vote. Three branches matching RN exactly:
    ///
    /// 1. No existing vote → INSERT (`{feature_request_id, user_id, vote_type}`).
    /// 2. Existing vote with same `voteType` → DELETE (un-vote).
    /// 3. Existing vote with different type → UPDATE `vote_type`.
    ///
    /// After any branch we re-fetch to pick up the upvote/downvote counters
    /// — RN does the same (`fetchRequests()` after vote, line 202). Doing it
    /// server-side keeps the counters trustworthy because the DB has a
    /// trigger that recalculates `upvotes` / `downvotes` on vote changes.
    public func vote(
        requestId: String,
        userId: UUID,
        voteType: FeatureRequestVote.VoteType
    ) async {
        do {
            let client = await MainSupabase.shared.client
            let existing = userVotes.first(where: { $0.featureRequestId == requestId })

            if let existing {
                if existing.voteType == voteType {
                    // Re-tap same type → remove vote.
                    try await client
                        .from("feature_request_votes")
                        .delete()
                        .eq("feature_request_id", value: requestId)
                        .eq("user_id", value: userId)
                        .execute()
                } else {
                    // Tap different type → switch.
                    try await client
                        .from("feature_request_votes")
                        .update(["vote_type": voteType.rawValue])
                        .eq("feature_request_id", value: requestId)
                        .eq("user_id", value: userId)
                        .execute()
                }
            } else {
                // First-time vote → insert.
                let payload = VoteInsert(
                    feature_request_id: requestId,
                    user_id: userId,
                    vote_type: voteType.rawValue
                )
                try await client
                    .from("feature_request_votes")
                    .insert(payload)
                    .execute()
            }

            await refresh(userId: userId)
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Submit a brand-new feature request. Mirrors RN `handleSubmit` (lines
    /// 125–160) — inserts with `status: 'pending'` so it's invisible until
    /// an editor flips the status.
    ///
    /// Validation matches RN: both fields are required (`!title.trim() || !description.trim()`).
    /// Returns `true` on success so the view can dismiss its sheet + reset
    /// fields.
    @discardableResult
    public func submit(
        title: String,
        description: String,
        userId: UUID,
        displayName: String?
    ) async -> Bool {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDesc = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty, !trimmedDesc.isEmpty else {
            lastError = "Please fill in all fields"
            return false
        }

        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let client = await MainSupabase.shared.client
            let payload = RequestInsert(
                title: trimmedTitle,
                description: trimmedDesc,
                submitted_by: userId,
                // Display-name fallback "Anonymous" mirrors RN line 143.
                submitter_display_name: (displayName?.isEmpty == false ? displayName! : "Anonymous"),
                status: FeatureRequest.Status.pending.rawValue
            )
            try await client
                .from("feature_requests")
                .insert(payload)
                .execute()

            justSubmittedAt = Date()
            lastError = nil
            // Refresh so any approved-on-insert (admin shortcut) shows up.
            await refresh(userId: userId)
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    public func clearError() {
        lastError = nil
    }

    // MARK: - Insert payloads
    //
    // Supabase-swift's `.insert(...)` wants an Encodable. We use snake_case
    // property names directly here (rather than CodingKeys-rewriting) so the
    // JSON wire format matches RN exactly with zero ambiguity.

    private struct VoteInsert: Encodable {
        let feature_request_id: String
        let user_id: UUID
        let vote_type: String
    }

    private struct RequestInsert: Encodable {
        let title: String
        let description: String
        let submitted_by: UUID
        let submitter_display_name: String
        let status: String
    }

    // MARK: - Debug previews
    //
    // Used by `ScreenshotHarness` to drive empty / loaded / error states
    // without a live Supabase connection. Production callers should never
    // touch this path.

    #if DEBUG
    public func debugSet(
        requests: [FeatureRequest],
        userVotes: [FeatureRequestVote] = [],
        state: LoadState
    ) {
        self.requests = requests
        self.userVotes = userVotes
        self.loadState = state
        switch state {
        case .failed(let message):
            self.lastError = message
        default:
            self.lastError = nil
        }
    }
    #endif
}
