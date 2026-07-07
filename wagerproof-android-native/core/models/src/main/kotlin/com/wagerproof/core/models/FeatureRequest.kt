package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `feature_requests` row in main Supabase.
 *
 * Status semantics (from RN + RLS policies):
 * - `pending` — submitted but not yet approved (admins-only view).
 * - `approved` — visible in "Community Voting", users can vote.
 * - `roadmap` — promoted to the developer roadmap; voting UI hidden,
 *   substate carried by `roadmap_status`.
 */
@Serializable
data class FeatureRequest(
    val id: String,
    val title: String,
    val description: String,
    @SerialName("submitted_by") val submittedBy: String,
    @SerialName("submitter_display_name") val submitterDisplayName: String,
    val status: Status,
    @SerialName("roadmap_status") val roadmapStatus: RoadmapStatus? = null,
    val upvotes: Int,
    val downvotes: Int,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
) {
    /** Net votes = upvotes - downvotes (the signed green/red badge). */
    val netVotes: Int get() = upvotes - downvotes

    @Serializable
    enum class Status(val raw: String) {
        @SerialName("pending") PENDING("pending"),
        @SerialName("approved") APPROVED("approved"),
        @SerialName("roadmap") ROADMAP("roadmap"),
    }

    /** Roadmap substate. Only populated when `status == ROADMAP`. */
    @Serializable
    enum class RoadmapStatus(val raw: String) {
        @SerialName("planned") PLANNED("planned"),
        @SerialName("in_progress") IN_PROGRESS("in_progress"),
        @SerialName("completed") COMPLETED("completed"),
    }
}

/**
 * Per-user vote record (`feature_request_votes` table). One row per
 * (user, feature_request) pair — re-voting the same type deletes the row,
 * switching type updates it (service-layer semantics).
 */
@Serializable
data class FeatureRequestVote(
    @SerialName("feature_request_id") val featureRequestId: String,
    @SerialName("vote_type") val voteType: VoteType,
) {
    @Serializable
    enum class VoteType(val raw: String) {
        @SerialName("upvote") UPVOTE("upvote"),
        @SerialName("downvote") DOWNVOTE("downvote"),
    }
}
