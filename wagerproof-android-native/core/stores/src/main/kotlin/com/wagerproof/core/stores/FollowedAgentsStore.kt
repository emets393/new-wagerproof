package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.services.SupabaseClients
import com.wagerproof.core.services.runCatchingCancellable
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Port of iOS `FollowedAgentsStore.swift` (doc §8.10). Read-path for the public
 * agents the user follows (`user_avatar_follows` join on the MAIN Supabase
 * project). Mutations live elsewhere (AgentChatService.setFollow).
 *
 * Backs the Following rail + See All sheet at the top of My Agents, so the
 * projection has to carry everything those surfaces render: the profile columns
 * for the tile, `last_generated_at` for the unread dot, and a second batched
 * `avatar_performance_cache` read for the ±5 streak badge and the sheet's
 * record/units row. A narrower select is what left the rail unbuildable before.
 */
@Stable
class FollowedAgentsStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Coalesces concurrent refreshes (rail appear + follow toggle firing together). */
    private val inFlight = InFlightTaskRegistry<RefreshKey>(scope)

    /** Distinguishes sign-out/re-auth even when the same user id returns. */
    private var bindingGeneration = 0L

    private data class RefreshKey(val userId: String, val bindingGeneration: Long)

    /** One row of follow data. Mirrors the RN `FollowedAgent` interface. */
    data class FollowedAgent(
        val avatarId: String,
        val name: String,
        val avatarEmoji: String,
        val avatarColor: String,
        val isFavorite: Boolean,
        val lastGeneratedAt: String? = null,
        val userId: String = "",
        val preferredSports: List<AgentSport> = emptyList(),
        val performance: AgentPerformance? = null,
    ) {
        /**
         * Adapter so the See All sheet can reuse `AgentRowCard` unchanged. The
         * synthesized Agent is a display shell: only the fields the row renders
         * are real, and `isPublic` is true because you can only follow a public
         * agent.
         */
        val agentWithPerformance: AgentWithPerformance
            get() = AgentWithPerformance(
                agent = Agent(
                    id = avatarId,
                    userId = userId,
                    name = name,
                    avatarEmoji = avatarEmoji,
                    avatarColor = avatarColor,
                    preferredSports = preferredSports,
                    isPublic = true,
                    createdAt = "",
                    lastGeneratedAt = lastGeneratedAt,
                ),
                performance = performance,
            )
    }

    var follows by mutableStateOf<List<FollowedAgent>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var userId by mutableStateOf<String?>(null); private set

    fun bind(userId: String?) {
        if (userId == this.userId) return
        bindingGeneration += 1
        this.userId = userId
        // Requests run on the store scope and deliberately outlive their screen
        // caller. Once identity changes that behavior is no longer safe: cancel
        // the old work, then reject any non-cooperative completion via the key
        // checks in [load].
        inFlight.cancelAll()
        follows = emptyList()
        loadState = LoadState.Idle
    }

    /**
     * Fetch the follow set: `user_avatar_follows` joined to `avatar_profiles`,
     * then one batched `avatar_performance_cache` read for the same ids.
     *
     * Two queries, not a three-table join: `avatar_performance_cache` is a
     * separate cache table with no FK PostgREST can traverse from the join row.
     */
    suspend fun refresh() {
        val uid = userId ?: return
        val key = RefreshKey(uid, bindingGeneration)
        inFlight.run(key) { load(key) }
    }

    private suspend fun load(key: RefreshKey) {
        if (!isCurrent(key)) return
        loadState = LoadState.Loading
        runCatchingCancellable {
            val rows = SupabaseClients.main.from("user_avatar_follows")
                .select(
                    columns = Columns.raw(
                        "avatar_id, is_favorite, avatar_profiles(user_id, name, avatar_emoji, " +
                            "avatar_color, preferred_sports, last_generated_at)",
                    ),
                ) {
                    filter { eq("user_id", key.userId) }
                }
                .decodeList<FollowRow>()
            val ids = rows.map { it.avatarId }
            // Skip the second round-trip entirely when nothing is followed —
            // an `in` filter on an empty list is a wasted request. A perf-cache
            // failure never blanks the rail: rows just render performance-less
            // (same defensive shape as AgentService.fetchUserAgents).
            val performances = if (ids.isEmpty()) {
                emptyList()
            } else {
                runCatchingCancellable {
                    SupabaseClients.main.from("avatar_performance_cache")
                        .select(columns = Columns.raw(PERFORMANCE_COLUMNS)) {
                            filter { isIn("avatar_id", ids) }
                        }
                        .decodeList<AgentPerformance>()
                }.getOrDefault(emptyList())
            }
            rows to performances.associateBy { it.avatarId }
        }.onSuccess { (rows, performanceById) ->
            if (!isCurrent(key)) return@onSuccess
            follows = rows.map { row ->
                FollowedAgent(
                    avatarId = row.avatarId,
                    name = row.avatarProfiles?.name ?: "Unknown",
                    avatarEmoji = row.avatarProfiles?.avatarEmoji ?: "🤖",
                    avatarColor = row.avatarProfiles?.avatarColor ?: "#6366f1",
                    isFavorite = row.isFavorite ?: false,
                    lastGeneratedAt = row.avatarProfiles?.lastGeneratedAt,
                    userId = row.avatarProfiles?.userId ?: "",
                    preferredSports = row.avatarProfiles?.preferredSports ?: emptyList(),
                    performance = performanceById[row.avatarId],
                )
            }
            loadState = LoadState.Loaded
        }.onFailure {
            if (!isCurrent(key)) return@onFailure
            loadState = LoadState.Failed(it.message.orEmpty().ifEmpty { "Unknown error" })
        }
    }

    private fun isCurrent(key: RefreshKey): Boolean =
        userId == key.userId && bindingGeneration == key.bindingGeneration

    /**
     * Drop a row locally so an unfollow feels instant. The authoritative list
     * still comes from the next [refresh]; this only avoids a visible lag
     * between the swipe and the round-trip.
     */
    fun removeLocally(agentId: String) {
        follows = follows.filterNot { it.avatarId == agentId }
    }

    fun close() = scope.cancel()

    private companion object {
        /**
         * Explicit projection, mirroring AgentService: the JSONB `stats_by_*`
         * columns arrive as SQL NULL for agents with no graded picks, and a null
         * for a non-nullable Map field is a decode failure (a defaulted field
         * only covers an ABSENT key, not a present null).
         */
        const val PERFORMANCE_COLUMNS =
            "avatar_id, wins, losses, pushes, total_picks, win_rate, net_units, " +
                "current_streak, best_streak, worst_streak, last_calculated_at"
    }

    /** Internal join-row DTO. */
    @Serializable
    private data class FollowRow(
        @SerialName("avatar_id") val avatarId: String,
        @SerialName("is_favorite") val isFavorite: Boolean? = null,
        @SerialName("avatar_profiles") val avatarProfiles: NestedProfile? = null,
    ) {
        @Serializable
        data class NestedProfile(
            val name: String? = null,
            @SerialName("user_id") val userId: String? = null,
            @SerialName("avatar_emoji") val avatarEmoji: String? = null,
            @SerialName("avatar_color") val avatarColor: String? = null,
            @SerialName("preferred_sports") val preferredSports: List<AgentSport>? = null,
            @SerialName("last_generated_at") val lastGeneratedAt: String? = null,
        )
    }
}
