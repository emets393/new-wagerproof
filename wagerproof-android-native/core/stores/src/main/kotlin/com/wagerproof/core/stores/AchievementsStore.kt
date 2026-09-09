package com.wagerproof.core.stores

import android.content.Context
import androidx.compose.runtime.*
import com.wagerproof.core.models.*
import com.wagerproof.core.services.AchievementService
import com.wagerproof.core.services.AchievementServing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import java.time.Instant

/** Account-isolated server-owned awards, durable offline activities and FIFO celebrations. */
@Stable
class AchievementsStore(context: Context, private val service: AchievementServing = AchievementService) {
    private val prefs = context.getSharedPreferences("achievements", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    private val mutex = Mutex()
    private var generation = 0
    private var userId: String? = null
    private var generatedAt: String? = null
    private var seen = setOf<String>()
    private var activities = setOf<String>()
    var achievements by mutableStateOf(AchievementCatalog.definitions.map { Achievement(it) }); private set
    var pending by mutableStateOf(emptyList<String>()); private set
    var error by mutableStateOf<String?>(null); private set
    var isLoading by mutableStateOf(false); private set
    val unlockedCount get() = achievements.count { it.earned }

    fun bind(id: String?) {
        val uid = id?.lowercase()
        if (uid == userId) return
        generation++; userId = uid; generatedAt = null; pending = emptyList(); error = null; isLoading = false
        achievements = AchievementCatalog.definitions.map { Achievement(it) }
        seen = emptySet(); activities = emptySet()
        if (uid == null) return
        seen = prefs.getStringSet("seen.$uid", emptySet())!!.toSet()
        activities = prefs.getStringSet("activities.$uid", emptySet())!!.toSet()
        prefs.getString("snapshot.$uid", null)?.let { cached ->
            runCatching { json.decodeFromString<AchievementSnapshot>(cached) }.getOrNull()?.let { apply(it, false) }
        }
    }
    suspend fun record(activity: String) {
        require(activity in setOf("game_analysis", "props", "historical_analysis"))
        val uid = userId ?: return
        activities = activities + activity
        prefs.edit().putStringSet("activities.$uid", activities).apply()
        refresh()
    }
    suspend fun refresh() {
        val token = generation
        val uid = userId ?: return
        mutex.withLock {
            if (token != generation) return
            isLoading = true
            try {
                do {
                    val activity = activities.firstOrNull()
                    val snapshot = if (activity == null) service.fetch() else service.record(activity)
                    if (token != generation) return
                    if (activity != null) {
                        activities = activities - activity
                        prefs.edit().putStringSet("activities.$uid", activities).apply()
                    }
                    apply(snapshot, true)
                } while (activities.isNotEmpty())
                if (seen.isNotEmpty()) service.acknowledge(seen.toList())
                if (token == generation) error = null
            } catch (cancelled: CancellationException) { throw cancelled
            } catch (_: Exception) {
                if (token == generation) error = "Your collection couldn’t sync. Tap Retry to try again."
            } finally { if (token == generation) isLoading = false }
        }
    }
    suspend fun acknowledge(id: String) {
        val uid = userId ?: return
        if (achievements.none { it.id == id && it.earned }) return
        pending = pending - id; seen = seen + id
        prefs.edit().putStringSet("seen.$uid", seen).apply()
        refresh()
    }
    private fun apply(snapshot: AchievementSnapshot, celebrate: Boolean) {
        if (generatedAt != null && Instant.parse(snapshot.generatedAt) < Instant.parse(generatedAt)) return
        val previous = achievements.associateBy { it.id }
        val hadSnapshot = generatedAt != null
        achievements = mergeAchievementStatuses(achievements, snapshot.achievements)
        if (celebrate) {
            val fresh = achievements.filter { it.earned && !it.status.isBackfilled && it.id !in seen &&
                (it.id in snapshot.newlyUnlockedIds || (hadSnapshot && previous[it.id]?.earned == false)) }.map { it.id }
            pending = (pending + fresh).distinct()
        }
        generatedAt = snapshot.generatedAt
        prefs.edit().putString("snapshot.$userId", json.encodeToString(snapshot.copy(achievements = achievements.map { it.status }, newlyUnlockedIds = emptyList()))).apply()
    }
}
