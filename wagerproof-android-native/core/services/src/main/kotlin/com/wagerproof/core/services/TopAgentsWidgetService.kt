package com.wagerproof.core.services

import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentPickForWidget
import com.wagerproof.core.models.TopAgentWidgetData
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.shared.WidgetPayloadStore
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

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

    /** Most graded results the small tile's form sparkline plots (iOS `formPointCap`). */
    internal const val FORM_POINT_CAP = 10

    // MARK: - Public entry points

    /**
     * Fetch top agents + their recent picks and write the resulting payload to
     * the shared prefs. Returns the bundle so the caller can [hash] it for
     * change detection (matches the RN `useTopAgentsWidgetSync` hashing path).
     */
    suspend fun sync(userId: String): List<TopAgentWidgetData> {
        val agents = fetchTopAgents(userId)
        // Other domains (editor picks, fade alerts, polymarket, top outliers)
        // refresh their own keys independently, so only topAgentPicks +
        // lastUpdated may be replaced — and the read-modify-write MUST go through
        // WidgetPayloadStore, whose mutex keeps a concurrent domain sync from
        // clobbering this slice (see its writeMutex KDoc).
        WidgetPayloadStore.updateSlice(
            key = "topAgentPicks",
            value = WagerproofJson.encodeToJsonElement(
                ListSerializer(TopAgentWidgetData.serializer()),
                agents,
            ),
        )
        return agents
    }

    /**
     * Remove account-scoped agent/pick data at every auth identity boundary.
     * A Glance RemoteViews tree can outlive the app process, so merely asking it
     * to re-render on sign-out would otherwise repaint account A's cached data.
     */
    suspend fun clearCached() {
        WidgetPayloadStore.updateSlice(
            key = "topAgentPicks",
            value = WagerproofJson.encodeToJsonElement(
                ListSerializer(TopAgentWidgetData.serializer()),
                emptyList(),
            ),
        )
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
            .select(Columns.raw("id, name, avatar_emoji, avatar_color, sprite_index, is_widget_favorite, is_active")) {
                filter {
                    eq("user_id", userId)
                    eq("is_active", true)
                }
            }
            .decodeList<WidgetAgentRow>()
        if (agentRows.isEmpty()) return emptyList()

        // 2) Performance cache for every agent. Failure is tolerated: we still
        //    surface agents with zeroed stats (matches RN).
        val perfByAgent: Map<String, AgentPerformance> = runCatchingCancellable {
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
        val picksByAgent: Map<String, List<AgentPick>> = runCatchingCancellable {
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

        // 5) Compact graded history for the small tile's form sparkline. This is
        //    a SECOND query on purpose: step 4 is date-windowed (3 days) and
        //    mostly pending, which would give a flat, useless line. Over-fetch 2x
        //    the cap so each agent still has ~10 points after the group-by.
        //    A failure here must not hide otherwise-valid agent data.
        val formPicksByAgent: Map<String, List<AgentPick>> = runCatchingCancellable {
            main.from("avatar_picks")
                .select {
                    filter {
                        isIn("avatar_id", selectedIds)
                        isIn("result", listOf("won", "lost", "push"))
                    }
                    order("created_at", Order.DESCENDING)
                    limit((MAX_WIDGET_AGENTS * FORM_POINT_CAP * 2).toLong())
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
                bestStreak = perf?.bestStreak ?: 0,
                record = formatRecord(perf),
                picks = selectPicks(picksByAgent[row.id].orEmpty()),
                spriteIndex = row.spriteIndex,
                form = formValues(formPicksByAgent[row.id].orEmpty()),
            )
        }
    }

    // MARK: - Payload IO
    //
    // Reads/writes live in WidgetPayloadStore (:core:shared) — one guarded owner
    // of the shared blob rather than a per-service copy of the merge.

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
     * Cumulative W/L form series for the widget sparkline (iOS `formValues`).
     *
     * Oldest → newest, capped at [FORM_POINT_CAP] results, seeded with a leading
     * 0 so a single graded pick still draws a segment. A win steps +1, a loss
     * −1, and a PUSH deliberately HOLDS the line rather than being dropped —
     * dropping it would make a push look like a missing bet instead of a
     * no-move. Returns empty (→ flat baseline) when nothing is graded; the chart
     * must never invent movement.
     */
    internal fun formValues(picks: List<AgentPick>): List<Double> {
        val recent = picks
            .filter { it.result != AgentPick.PickResultStatus.PENDING }
            // createdAt is ISO-8601 — lexicographic order is chronological order.
            .sortedBy { it.createdAt }
            .takeLast(FORM_POINT_CAP)
        if (recent.isEmpty()) return emptyList()

        var score = 0.0
        val points = mutableListOf(score)
        for (pick in recent) {
            when (pick.result) {
                AgentPick.PickResultStatus.WON -> score += 1.0
                AgentPick.PickResultStatus.LOST -> score -= 1.0
                AgentPick.PickResultStatus.PUSH,
                AgentPick.PickResultStatus.PENDING,
                -> Unit
            }
            points += score
        }
        return points
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

    /** Slim internal projection; re-emitted as [TopAgentWidgetData] for callers. */
    @Serializable
    private data class WidgetAgentRow(
        val id: String,
        val name: String,
        @SerialName("avatar_emoji") val avatarEmoji: String? = null,
        @SerialName("avatar_color") val avatarColor: String? = null,
        @SerialName("sprite_index") val spriteIndex: Int? = null,
        @SerialName("is_widget_favorite") val isWidgetFavorite: Boolean? = null,
        @SerialName("is_active") val isActive: Boolean? = null,
    )
}
