package com.wagerproof.core.services

import com.wagerproof.core.models.AchievementSnapshot
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.*

interface AchievementServing {
    suspend fun fetch(): AchievementSnapshot
    suspend fun record(activity: String): AchievementSnapshot
    suspend fun acknowledge(ids: List<String>)
}
object AchievementService : AchievementServing {
    override suspend fun fetch(): AchievementSnapshot = SupabaseClients.main.postgrest.rpc("get_user_achievements").decodeAs()
    override suspend fun record(activity: String): AchievementSnapshot = SupabaseClients.main.postgrest.rpc(
        "record_achievement_activity", buildJsonObject { put("activity", activity) }).decodeAs()
    override suspend fun acknowledge(ids: List<String>) {
        SupabaseClients.main.postgrest.rpc("acknowledge_achievement_celebrations", buildJsonObject {
            put("achievement_ids", JsonArray(ids.map(::JsonPrimitive)))
        })
    }
}
