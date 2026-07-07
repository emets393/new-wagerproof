package com.wagerproof.core.services

import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentArchetype
import com.wagerproof.core.models.AgentArchetypeSerializer
import com.wagerproof.core.models.AgentCustomInsights
import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.models.serialization.WagerproofJson
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.jsonObject

/**
 * CRUD on `avatar_profiles` (Main project). Port of iOS `AgentService.swift` /
 * RN `agentService.ts`. RLS constrains owner reads to `user_id = auth.uid()`
 * plus anonymous reads when `is_public = true`.
 */
object AgentService {

    // List projection excludes personality_params + custom_insights JSONB so
    // the grid query stays small. Byte-for-byte with RN AGENT_LIST_COLUMNS.
    private const val LIST_COLUMNS =
        "id, user_id, name, avatar_emoji, avatar_color, preferred_sports, archetype, " +
            "is_public, is_active, created_at, updated_at, auto_generate, auto_generate_time, " +
            "auto_generate_timezone, is_widget_favorite, last_generated_at, last_auto_generated_at, " +
            "owner_last_active_at, daily_generation_count, last_generation_date"

    private const val PERFORMANCE_COLUMNS =
        "avatar_id, wins, losses, pushes, total_picks, win_rate, net_units, " +
            "current_streak, best_streak, worst_streak, last_calculated_at"

    /** A user's agents joined with their cached performance rows. */
    suspend fun fetchUserAgents(userId: String): List<AgentWithPerformance> {
        val agents = SupabaseClients.main.from("avatar_profiles")
            .select(columns = Columns.raw(LIST_COLUMNS)) {
                filter { eq("user_id", userId) }
                order("created_at", Order.DESCENDING)
            }
            .decodeList<Agent>()
        if (agents.isEmpty()) return emptyList()

        // Perf-cache failure never blanks the list — agents render with
        // performance = null (matches the RN/iOS defensive try/catch).
        val perfMap = runCatching {
            SupabaseClients.main.from("avatar_performance_cache")
                .select(columns = Columns.raw(PERFORMANCE_COLUMNS)) {
                    filter { isIn("avatar_id", agents.map { it.id }) }
                }
                .decodeList<AgentPerformance>()
        }.getOrDefault(emptyList()).associateBy { it.avatarId }

        return agents.map { AgentWithPerformance(agent = it, performance = perfMap[it.id]) }
    }

    /** Single agent with all JSONB fields plus its performance row (null on perf error). */
    suspend fun fetchAgent(id: String): AgentWithPerformance? {
        val agent = SupabaseClients.main.from("avatar_profiles")
            .select {
                filter { eq("id", id) }
                limit(1)
            }
            .decodeList<Agent>()
            .firstOrNull() ?: return null

        val perf = runCatching {
            SupabaseClients.main.from("avatar_performance_cache")
                .select(columns = Columns.raw(PERFORMANCE_COLUMNS)) {
                    filter { eq("avatar_id", id) }
                    limit(1)
                }
                .decodeList<AgentPerformance>()
                .firstOrNull()
        }.getOrNull()

        return AgentWithPerformance(agent = agent, performance = perf)
    }

    /** Delete an agent; FK ON DELETE CASCADE removes picks + performance rows. */
    suspend fun delete(agentId: String) {
        SupabaseClients.main.from("avatar_profiles").delete {
            filter { eq("id", agentId) }
        }
    }

    /** Toggle `is_active` (pause autopilot without deleting). */
    suspend fun setActive(agentId: String, isActive: Boolean) =
        patchFlag(agentId, "is_active", isActive)

    /** Toggle `is_public`. */
    suspend fun setPublic(agentId: String, isPublic: Boolean) =
        patchFlag(agentId, "is_public", isPublic)

    /** Toggle `auto_generate` (autopilot on/off). */
    suspend fun setAutoGenerate(agentId: String, autoGenerate: Boolean) =
        patchFlag(agentId, "auto_generate", autoGenerate)

    private suspend fun patchFlag(agentId: String, column: String, value: Boolean) {
        SupabaseClients.main.from("avatar_profiles").update({
            set(column, value)
            set("updated_at", nowISO())
        }) {
            filter { eq("id", agentId) }
        }
    }

    /**
     * Create a new agent via the `create_agent` edge action. The edge function
     * performs RevenueCat gating + Zod validation server-side; a rejection
     * surfaces as [AgentAuthorizedActionsService.ActionException.Server].
     */
    suspend fun create(input: CreateAgentInput): Agent {
        val data = WagerproofJson
            .encodeToJsonElement(CreateAgentInput.serializer(), input)
            .jsonObject
        return AgentAuthorizedActionsService.createAgent(data)
    }

    // Swift ISO8601DateFormatter(.withInternetDateTime, .withFractionalSeconds):
    // always UTC with fractional seconds, even when millis are zero.
    private val isoFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).withZone(ZoneOffset.UTC)

    private fun nowISO(): String = isoFormatter.format(Instant.now())
}

/**
 * Input payload for `create_agent`. Field-for-field match with the Zod schema
 * mirrored at `wagerproof-mobile/types/agent.ts::CreateAgentSchema` (snake_case
 * keys) so all clients post the same JSON shape. Not in core/models because
 * only the create flow uses it (mirrors its Swift home in AgentService.swift).
 */
@Serializable
data class CreateAgentInput(
    val name: String,
    @SerialName("avatar_emoji") val avatarEmoji: String,
    @SerialName("avatar_color") val avatarColor: String,
    @SerialName("preferred_sports") val preferredSports: List<AgentSport>,
    @Serializable(with = AgentArchetypeSerializer::class)
    val archetype: AgentArchetype? = null,
    @SerialName("personality_params") val personalityParams: AgentPersonalityParams,
    @SerialName("custom_insights") val customInsights: AgentCustomInsights,
    @SerialName("auto_generate") val autoGenerate: Boolean,
    @SerialName("auto_generate_time") val autoGenerateTime: String,
    @SerialName("auto_generate_timezone") val autoGenerateTimezone: String,
)
