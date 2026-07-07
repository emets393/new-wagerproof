package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.services.SupabaseClients
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
 */
@Stable
class FollowedAgentsStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** One row of follow data. Mirrors the RN `FollowedAgent` interface. */
    data class FollowedAgent(
        val avatarId: String,
        val name: String,
        val avatarEmoji: String,
        val avatarColor: String,
        val isFavorite: Boolean,
    )

    var follows by mutableStateOf<List<FollowedAgent>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var userId by mutableStateOf<String?>(null); private set

    fun bind(userId: String?) {
        if (userId == this.userId) return
        this.userId = userId
        follows = emptyList()
        loadState = LoadState.Idle
    }

    /**
     * Fetch the follow set. Joins `user_avatar_follows` against
     * `avatar_profiles(name, avatar_emoji, avatar_color)` — matches the RN
     * `useFollowedAgents` query.
     */
    suspend fun refresh() {
        val uid = userId ?: return
        loadState = LoadState.Loading
        runCatching {
            SupabaseClients.main.from("user_avatar_follows")
                .select(
                    columns = Columns.raw(
                        "avatar_id, is_favorite, avatar_profiles(name, avatar_emoji, avatar_color)",
                    ),
                ) {
                    filter { eq("user_id", uid) }
                }
                .decodeList<FollowRow>()
        }.onSuccess { rows ->
            follows = rows.map { row ->
                FollowedAgent(
                    avatarId = row.avatarId,
                    name = row.avatarProfiles?.name ?: "Unknown",
                    avatarEmoji = row.avatarProfiles?.avatarEmoji ?: "🤖",
                    avatarColor = row.avatarProfiles?.avatarColor ?: "#6366f1",
                    isFavorite = row.isFavorite ?: false,
                )
            }
            loadState = LoadState.Loaded
        }.onFailure { loadState = LoadState.Failed(it.message.orEmpty().ifEmpty { "Unknown error" }) }
    }

    fun close() = scope.cancel()

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
            @SerialName("avatar_emoji") val avatarEmoji: String? = null,
            @SerialName("avatar_color") val avatarColor: String? = null,
        )
    }
}
