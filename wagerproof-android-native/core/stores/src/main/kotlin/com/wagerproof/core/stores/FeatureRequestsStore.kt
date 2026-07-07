package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.FeatureRequest
import com.wagerproof.core.models.FeatureRequestVote
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Port of iOS `FeatureRequestsStore.swift`. Feature-request list + voting on the
 * MAIN Supabase project. Backend contract is byte-identical to the RN screen:
 *
 * - Read `feature_requests` where `status IN ('approved','roadmap')`, ordered
 *   `created_at DESC` (regular users never see pending rows).
 * - Read `feature_request_votes` for the active user (non-fatal on failure).
 * - Vote toggle: re-tap same type → DELETE, tap different → UPDATE, first → INSERT.
 * - Submit inserts with `status='pending'` (editor must approve).
 *
 * NOTE: iOS keys votes by a `UUID` userId; the Android services layer keys on
 * `String` everywhere (AuthStore.Phase), so this store follows suit.
 */
@Stable
class FeatureRequestsStore {

    var requests by mutableStateOf<List<FeatureRequest>>(emptyList()); private set
    var userVotes by mutableStateOf<List<FeatureRequestVote>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var lastError by mutableStateOf<String?>(null); private set

    /** Bumped on successful submit so the view can drive a success haptic. */
    var justSubmittedAt by mutableStateOf<Long?>(null); private set

    /** true while a submit network call is in-flight (disables the submit button). */
    var isSubmitting by mutableStateOf(false); private set

    val isLoading: Boolean get() = loadState.isLoading

    val hasRequests: Boolean get() = requests.isNotEmpty()

    /** Approved (community voting) requests only. */
    val approvedRequests: List<FeatureRequest>
        get() = requests.filter { it.status == FeatureRequest.Status.APPROVED }

    val plannedRoadmapItems: List<FeatureRequest>
        get() = requests.filter {
            it.status == FeatureRequest.Status.ROADMAP &&
                it.roadmapStatus == FeatureRequest.RoadmapStatus.PLANNED
        }

    val inProgressRoadmapItems: List<FeatureRequest>
        get() = requests.filter {
            it.status == FeatureRequest.Status.ROADMAP &&
                it.roadmapStatus == FeatureRequest.RoadmapStatus.IN_PROGRESS
        }

    val completedRoadmapItems: List<FeatureRequest>
        get() = requests.filter {
            it.status == FeatureRequest.Status.ROADMAP &&
                it.roadmapStatus == FeatureRequest.RoadmapStatus.COMPLETED
        }

    /** Refresh both the request list and the current user's votes. `userId` null when signed out. */
    suspend fun refresh(userId: String?) {
        loadState = LoadState.Loading
        try {
            val fetched = SupabaseClients.main
                .from("feature_requests")
                .select {
                    filter {
                        isIn(
                            "status",
                            listOf(
                                FeatureRequest.Status.APPROVED.raw,
                                FeatureRequest.Status.ROADMAP.raw,
                            ),
                        )
                    }
                    order("created_at", Order.DESCENDING)
                }
                .decodeList<FeatureRequest>()
            requests = fetched

            // Votes fetch failure is non-fatal — RN proceeds with empty votes.
            userVotes = if (userId != null) {
                runCatching {
                    SupabaseClients.main
                        .from("feature_request_votes")
                        .select(columns = Columns.raw("feature_request_id, vote_type")) {
                            filter { eq("user_id", userId) }
                        }
                        .decodeList<FeatureRequestVote>()
                }.getOrDefault(emptyList())
            } else {
                emptyList()
            }

            loadState = LoadState.Loaded
            lastError = null
        } catch (e: Throwable) {
            val message = e.message ?: "Failed to load feature requests"
            loadState = LoadState.Failed(message)
            lastError = message
        }
    }

    /**
     * Cast / toggle / switch a vote, then re-fetch (the DB trigger recalculates
     * the upvote/downvote counters, so server-side refresh keeps them trustworthy).
     */
    suspend fun vote(
        requestId: String,
        userId: String,
        voteType: FeatureRequestVote.VoteType,
    ) {
        try {
            val existing = userVotes.firstOrNull { it.featureRequestId == requestId }
            when {
                existing == null -> {
                    // First-time vote → insert.
                    SupabaseClients.main.from("feature_request_votes").insert(
                        VoteInsert(
                            featureRequestId = requestId,
                            userId = userId,
                            voteType = voteType.raw,
                        ),
                    )
                }
                existing.voteType == voteType -> {
                    // Re-tap same type → remove vote.
                    SupabaseClients.main.from("feature_request_votes").delete {
                        filter {
                            eq("feature_request_id", requestId)
                            eq("user_id", userId)
                        }
                    }
                }
                else -> {
                    // Tap different type → switch.
                    SupabaseClients.main.from("feature_request_votes").update({
                        set("vote_type", voteType.raw)
                    }) {
                        filter {
                            eq("feature_request_id", requestId)
                            eq("user_id", userId)
                        }
                    }
                }
            }

            refresh(userId)
        } catch (e: Throwable) {
            lastError = e.message
        }
    }

    /**
     * Submit a brand-new feature request (inserts with `status='pending'`).
     * Both fields required. Returns true on success so the view can dismiss.
     */
    suspend fun submit(
        title: String,
        description: String,
        userId: String,
        displayName: String?,
    ): Boolean {
        val trimmedTitle = title.trim()
        val trimmedDesc = description.trim()
        if (trimmedTitle.isEmpty() || trimmedDesc.isEmpty()) {
            lastError = "Please fill in all fields"
            return false
        }

        isSubmitting = true
        try {
            SupabaseClients.main.from("feature_requests").insert(
                RequestInsert(
                    title = trimmedTitle,
                    description = trimmedDesc,
                    submittedBy = userId,
                    // Display-name fallback "Anonymous" mirrors RN.
                    submitterDisplayName = if (!displayName.isNullOrEmpty()) displayName else "Anonymous",
                    status = FeatureRequest.Status.PENDING.raw,
                ),
            )

            justSubmittedAt = System.currentTimeMillis()
            lastError = null
            // Refresh so any approved-on-insert (admin shortcut) shows up.
            refresh(userId)
            return true
        } catch (e: Throwable) {
            lastError = e.message
            return false
        } finally {
            isSubmitting = false
        }
    }

    fun clearError() {
        lastError = null
    }

    // MARK: - Insert payloads (snake_case wire names match RN exactly)

    @Serializable
    private data class VoteInsert(
        @SerialName("feature_request_id") val featureRequestId: String,
        @SerialName("user_id") val userId: String,
        @SerialName("vote_type") val voteType: String,
    )

    @Serializable
    private data class RequestInsert(
        val title: String,
        val description: String,
        @SerialName("submitted_by") val submittedBy: String,
        @SerialName("submitter_display_name") val submitterDisplayName: String,
        val status: String,
    )

    // MARK: - DEBUG previews (ScreenshotHarness parity)

    fun debugSet(
        requests: List<FeatureRequest>,
        userVotes: List<FeatureRequestVote> = emptyList(),
        state: LoadState,
    ) {
        if (!BuildFlags.isDebugBuild) return
        this.requests = requests
        this.userVotes = userVotes
        this.loadState = state
        this.lastError = (state as? LoadState.Failed)?.message
    }
}
