package com.wagerproof.core.services

import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.shared.AppGroupKey
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/** Mirrors `AgentPickForWidget` in the RN bridge — camelCase wire names. */
@Serializable
data class AgentPickForWidget(
    val id: String,
    val sport: String,
    val matchup: String,
    val pickSelection: String,
    val odds: String? = null,
    val result: String? = null,
    val gameDate: String? = null,
)

/**
 * Mirrors `TopAgentWidgetData` in the RN bridge. Combines an agent's
 * identity + cached performance summary + up to N representative picks.
 */
@Serializable
data class TopAgentWidgetData(
    val agentId: String,
    val agentName: String,
    val agentEmoji: String,
    val agentColor: String,
    val isFavorite: Boolean,
    val netUnits: Double,
    val winRate: Double? = null,
    val currentStreak: Int,
    val record: String,
    val picks: List<AgentPickForWidget>,
)

/**
 * Port of iOS `TopAgentsWidgetService.swift` (itself a port of RN
 * `topAgentsWidgetService.ts` + the widget-data-bridge JS). Fetches the user's
 * top agents (favorites first, then sorted by net units / win rate / streak)
 * plus a small slate of recent picks per agent, then writes the result to the
 * shared prefs file the home-screen widget reads.
 *
 * Wire format mirrors the RN bridge's `WidgetDataPayload` under the legacy
 * `widgetPayload` key — changing key or field names would break widgets
 * already on user home screens.
 */
object TopAgentsWidgetService {

    // Keep in sync with RN topAgentsWidgetService.ts:5-6.
    private const val MAX_WIDGET_AGENTS = 3
    private const val PICKS_PER_AGENT = 2

    // MARK: - Public entry points

    /**
     * Fetch top agents + their recent picks and write the resulting payload to
     * the shared prefs. Returns the bundle so the caller can [hash] it for
     * change detection (matches the RN `useTopAgentsWidgetSync` hashing path).
     */
    suspend fun sync(userId: String): List<TopAgentWidgetData> {
        val agents = fetchTopAgents(userId)
        // Read-modify-write: other domains (editor picks, fade alerts,
        // polymarket, top outliers) refresh their own keys independently, so
        // only topAgentPicks + lastUpdated may be replaced here.
        val existing = readPayload() ?: JsonObject(emptyMap())
        val updated = buildJsonObject {
            existing.forEach { (key, value) -> put(key, value) }
            put(
                "topAgentPicks",
                WagerproofJson.encodeToJsonElement(
                    ListSerializer(TopAgentWidgetData.serializer()),
                    agents,
                ),
            )
            put("lastUpdated", nowISO())
        }
        writePayload(updated)
        return agents
    }

    /**
     * Read-only fetch of top agents. Mirrors `fetchTopAgentsForWidget` in
     * `services/topAgentsWidgetService.ts`.
     */
    suspend fun fetchTopAgents(userId: String): List<TopAgentWidgetData> {
        if (userId.isEmpty()) return emptyList()
        val main = SupabaseClients.main

        // 1) Slim agent rows — we only need the widget projection.
        val agentRows = main.from("avatar_profiles")
            .select(Columns.raw("id, name, avatar_emoji, avatar_color, is_widget_favorite, is_active")) {
                filter {
                    eq("user_id", userId)
                    eq("is_active", true)
                }
            }
            .decodeList<WidgetAgentRow>()
        if (agentRows.isEmpty()) return emptyList()

        // 2) Performance cache for every agent. Failure is tolerated: we still
        //    surface agents with zeroed stats (matches RN).
        val perfByAgent: Map<String, AgentPerformance> = runCatching {
            main.from("avatar_performance_cache")
                .select(Columns.raw("avatar_id, wins, losses, pushes, total_picks, win_rate, net_units, current_streak, best_streak")) {
                    filter { isIn("avatar_id", agentRows.map { it.id }) }
                }
                .decodeList<AgentPerformance>()
                .associateBy { it.avatarId }
        }.getOrDefault(emptyMap())

        // 3) Favorites first, each cohort sorted by perf.
        val byPerformanceDesc =
            compareByDescending<Pair<WidgetAgentRow, AgentPerformance?>> { it.second?.netUnits ?: 0.0 }
                .thenByDescending { it.second?.winRate ?: 0.0 }
                .thenByDescending { it.second?.currentStreak ?: 0 }
        val withPerf = agentRows.map { it to perfByAgent[it.id] }
        val favorites = withPerf.filter { it.first.isWidgetFavorite == true }.sortedWith(byPerformanceDesc)
        val nonFavorites = withPerf.filter { it.first.isWidgetFavorite != true }.sortedWith(byPerformanceDesc)
        val selected = (favorites + nonFavorites).take(MAX_WIDGET_AGENTS)
        if (selected.isEmpty()) return emptyList()

        // 4) Up to 3 days of recent picks. Device-LOCAL dates on purpose —
        //    agents use local yyyy-MM-dd, not ET (parity gotcha #5). Over-fetch
        //    5x so the per-agent selector can dedupe and prefer today's picks.
        val selectedIds = selected.map { it.first.id }
        val lookbackStr = ServiceDates.localDate(-3)
        // Pick-fetch failure doesn't blank the widget; we still emit agent
        // shells with empty pick lists (matches RN).
        val picksByAgent: Map<String, List<AgentPick>> = runCatching {
            main.from("avatar_picks")
                .select {
                    filter {
                        isIn("avatar_id", selectedIds)
                        gte("game_date", lookbackStr)
                    }
                    order("created_at", Order.DESCENDING)
                    limit((MAX_WIDGET_AGENTS * PICKS_PER_AGENT * 5).toLong())
                }
                .decodeList<AgentPick>()
                .groupBy { it.avatarId }
        }.getOrDefault(emptyMap())

        return selected.map { (row, perf) ->
            TopAgentWidgetData(
                agentId = row.id,
                agentName = row.name,
                agentEmoji = row.avatarEmoji ?: "🤖",
                agentColor = row.avatarColor ?: "#6366f1",
                isFavorite = row.isWidgetFavorite ?: false,
                netUnits = perf?.netUnits ?: 0.0,
                winRate = perf?.winRate,
                currentStreak = perf?.currentStreak ?: 0,
                record = formatRecord(perf),
                picks = selectPicks(picksByAgent[row.id].orEmpty()),
            )
        }
    }

    // MARK: - Payload IO

    /** Current payload as a raw JsonObject, or null when absent/corrupt. */
    fun readPayload(): JsonObject? {
        val raw = AppGroup.prefs.getString(AppGroupKey.WIDGET_PAYLOAD_LEGACY, null) ?: return null
        return runCatching { WagerproofJson.parseToJsonElement(raw) as? JsonObject }.getOrNull()
    }

    fun writePayload(payload: JsonObject) {
        // Stored as a JSON *string*, matching the RN bridge / iOS UserDefaults shape.
        AppGroup.prefs.edit()
            .putString(AppGroupKey.WIDGET_PAYLOAD_LEGACY, payload.toString())
            .apply()
    }

    /**
     * Hash that mirrors RN's `lastHashRef`: deterministic sorted-keys JSON of
     * `{agentId, isFavorite, picks: [ids]}`. Consumers use it to skip no-op syncs.
     */
    fun hash(agents: List<TopAgentWidgetData>): String {
        val summary = buildJsonArray {
            agents.forEach { agent ->
                // Keys inserted in sorted order to mirror JSONSerialization .sortedKeys.
                add(
                    buildJsonObject {
                        put("agentId", agent.agentId)
                        put("isFavorite", agent.isFavorite)
                        putJsonArray("picks") { agent.picks.forEach { add(it.id) } }
                    },
                )
            }
        }
        return summary.toString()
    }

    // MARK: - Internals

    private fun formatRecord(perf: AgentPerformance?): String {
        val wins = perf?.wins ?: 0
        val losses = perf?.losses ?: 0
        val pushes = perf?.pushes ?: 0
        return if (pushes > 0) "$wins-$losses-$pushes" else "$wins-$losses"
    }

    /**
     * Pick selection: prefer today's picks, fall back to historical. Mirrors
     * `selectPicksForAgent` in the RN service.
     */
    private fun selectPicks(allPicks: List<AgentPick>): List<AgentPickForWidget> {
        val todayStr = ServiceDates.todayLocal()
        // createdAt compares lexicographically — ISO timestamps sort correctly.
        val todays = allPicks.filter { it.gameDate == todayStr }.sortedByDescending { it.createdAt }
        val historical = allPicks.filter { it.gameDate != todayStr }.sortedByDescending { it.createdAt }
        val selected = mutableListOf<AgentPick>()
        val seen = mutableSetOf<String>()
        for (p in todays) {
            if (selected.size >= PICKS_PER_AGENT) break
            selected += p
            seen += p.id
        }
        for (p in historical) {
            if (selected.size >= PICKS_PER_AGENT) break
            if (p.id in seen) continue
            selected += p
            seen += p.id
        }
        return selected.map { toWidget(it) }
    }

    private fun toWidget(pick: AgentPick): AgentPickForWidget = AgentPickForWidget(
        id = pick.id,
        sport = pick.sport.raw,
        matchup = pick.matchup,
        pickSelection = pick.pickSelection,
        odds = pick.odds,
        result = pick.result.takeUnless { it == AgentPick.PickResultStatus.PENDING }?.raw,
        gameDate = pick.gameDate.ifEmpty { null },
    )

    private val isoFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX").withZone(ZoneOffset.UTC)

    private fun nowISO(): String = isoFormatter.format(Instant.now())

    /** Slim internal projection; re-emitted as [TopAgentWidgetData] for callers. */
    @Serializable
    private data class WidgetAgentRow(
        val id: String,
        val name: String,
        @SerialName("avatar_emoji") val avatarEmoji: String? = null,
        @SerialName("avatar_color") val avatarColor: String? = null,
        @SerialName("is_widget_favorite") val isWidgetFavorite: Boolean? = null,
        @SerialName("is_active") val isActive: Boolean? = null,
    )
}
