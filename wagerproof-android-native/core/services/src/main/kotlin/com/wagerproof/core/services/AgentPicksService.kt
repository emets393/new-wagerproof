package com.wagerproof.core.services

import com.wagerproof.core.models.AgentDetailSnapshot
import com.wagerproof.core.models.AgentParlay
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentPicksPage
import com.wagerproof.core.models.GenerationRequestResult
import com.wagerproof.core.models.TopAgentPickFeedRow
import com.wagerproof.core.models.serialization.WagerproofJson
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Reads on `avatar_picks` / `avatar_parlays` (Main project, RLS) plus the V3
 * generation kickoff. Port of iOS `AgentPicksService.swift`.
 *
 * Date filters use **device-local** yyyy-MM-dd (parity gotcha #5 — agents are
 * local-day scoped, unlike the ET-keyed outliers/MLB services).
 */
object AgentPicksService {

    /** Recent picks, newest first. Lossy decode — a corrupt row never blanks history. */
    suspend fun fetchPicks(agentId: String, limit: Int? = null): List<AgentPick> {
        val response = SupabaseClients.main.from("avatar_picks").select {
            filter { eq("avatar_id", agentId) }
            order("game_date", Order.DESCENDING)
            order("created_at", Order.DESCENDING)
            if (limit != null) limit(limit.toLong())
        }
        return AgentPick.decodeLossyArray(raw = response.data)
    }

    /** Graded picks from prior game dates (excludes today's slate + pending rows). */
    suspend fun fetchGradedPickHistory(agentId: String, limit: Int): List<AgentPick> {
        val response = SupabaseClients.main.from("avatar_picks").select {
            filter {
                eq("avatar_id", agentId)
                lt("game_date", ServiceDates.todayLocal())
                isIn("result", listOf("won", "lost", "push"))
            }
            order("game_date", Order.DESCENDING)
            order("created_at", Order.DESCENDING)
            limit(limit.toLong())
        }
        return AgentPick.decodeLossyArray(raw = response.data)
    }

    /** Today's picks for an agent (strict decode, matching Swift's `.value` path). */
    suspend fun fetchTodaysPicks(agentId: String): List<AgentPick> =
        SupabaseClients.main.from("avatar_picks").select {
            filter {
                eq("avatar_id", agentId)
                eq("game_date", ServiceDates.todayLocal())
            }
            order("created_at", Order.DESCENDING)
            limit(25)
        }.decodeList()

    /** Flat feed of upcoming picks (today + next 3 days) from a set of agents. */
    suspend fun fetchUpcomingFeed(agentIds: List<String>, limit: Int = 50): List<AgentPick> {
        if (agentIds.isEmpty()) return emptyList()
        return SupabaseClients.main.from("avatar_picks").select {
            filter {
                isIn("avatar_id", agentIds)
                gte("game_date", ServiceDates.todayLocal())
                lte("game_date", ServiceDates.localDate(3))
            }
            order("created_at", Order.DESCENDING)
            limit(limit.toLong())
        }.decodeList()
    }

    // MARK: parlays (direct RLS reads — siblings of the pick methods above)

    // Embed alias keeps the JSON key `legs`, matching AgentParlay's field name
    // and the shape the v3 read RPCs emit.
    private val parlaySelect = Columns.raw("*, legs:avatar_parlay_legs(*)")

    /** Recent parlay tickets, newest first. */
    suspend fun fetchParlays(agentId: String, limit: Int? = null): List<AgentParlay> {
        val response = SupabaseClients.main.from("avatar_parlays").select(columns = parlaySelect) {
            filter { eq("avatar_id", agentId) }
            order("target_date", Order.DESCENDING)
            order("created_at", Order.DESCENDING)
            if (limit != null) limit(limit.toLong())
        }
        return AgentParlay.decodeLossyArray(response.data)
    }

    /** Graded parlays from prior target dates. */
    suspend fun fetchGradedParlayHistory(agentId: String, limit: Int): List<AgentParlay> {
        val response = SupabaseClients.main.from("avatar_parlays").select(columns = parlaySelect) {
            filter {
                eq("avatar_id", agentId)
                lt("target_date", ServiceDates.todayLocal())
                isIn("result", listOf("won", "lost", "push"))
            }
            order("target_date", Order.DESCENDING)
            order("created_at", Order.DESCENDING)
            limit(limit.toLong())
        }
        return AgentParlay.decodeLossyArray(response.data)
    }

    /** Today's parlay tickets for an agent. */
    suspend fun fetchTodaysParlays(agentId: String): List<AgentParlay> {
        val response = SupabaseClients.main.from("avatar_parlays").select(columns = parlaySelect) {
            filter {
                eq("avatar_id", agentId)
                eq("target_date", ServiceDates.todayLocal())
            }
            order("created_at", Order.DESCENDING)
            limit(25)
        }
        return AgentParlay.decodeLossyArray(response.data)
    }

    /** Upcoming parlays (today + next 3 days) from a set of agents. */
    suspend fun fetchUpcomingParlaysFeed(agentIds: List<String>, limit: Int = 50): List<AgentParlay> {
        if (agentIds.isEmpty()) return emptyList()
        val response = SupabaseClients.main.from("avatar_parlays").select(columns = parlaySelect) {
            filter {
                isIn("avatar_id", agentIds)
                gte("target_date", ServiceDates.todayLocal())
                lte("target_date", ServiceDates.localDate(3))
            }
            order("created_at", Order.DESCENDING)
            limit(limit.toLong())
        }
        return AgentParlay.decodeLossyArray(response.data)
    }

    /**
     * Top picks feed across all public agents (RPC `get_top_agent_picks_feed_v2`).
     * Null search/cursor/viewer params are omitted so the SQL defaults apply.
     */
    suspend fun fetchTopAgentPicksFeed(
        filterMode: String = "top10",
        viewerUserId: String? = null,
        searchText: String? = null,
        limit: Int = 50,
        cursor: String? = null,
    ): List<TopAgentPickFeedRow> {
        val params = buildJsonObject {
            put("p_filter_mode", filterMode)
            viewerUserId?.let { put("p_viewer_user_id", it) }
            searchText?.let { put("p_search_text", it) }
            put("p_limit", limit)
            cursor?.let { put("p_cursor", it) }
        }
        return SupabaseClients.main.postgrest
            .rpc("get_top_agent_picks_feed_v2", params)
            .decodeList()
    }

    /** Authenticated snapshot for the agent detail screen. */
    suspend fun fetchDetailSnapshot(agentId: String): AgentDetailSnapshot =
        AgentAuthorizedActionsService.detailSnapshot(agentId)

    /** Authenticated paginated pick history (infinite scroll). */
    suspend fun fetchPicksPage(
        agentId: String,
        filter: String = "all",
        pageSize: Int = 20,
        cursor: String? = null,
        includeOverlap: Boolean = false,
        gameDate: String? = null,
    ): AgentPicksPage = AgentAuthorizedActionsService.picksPage(
        agentId = agentId,
        filter = filter,
        pageSize = pageSize,
        cursor = cursor,
        includeOverlap = includeOverlap,
        gameDate = gameDate,
    )

    /**
     * Start the Trigger.dev-backed V3 generation run (this client is V3-only).
     * The caller polls [TriggerRunStatusService] and refreshes the snapshot.
     */
    suspend fun requestTriggerV3Generation(
        agentId: String,
        idempotencyKey: String? = null,
        dryRun: Boolean? = null,
        modelName: String? = null,
        window: String? = null,
    ): GenerationRequestResult {
        val token = EdgeFunctions.accessTokenOrNull()
            ?: throw AgentAuthorizedActionsService.ActionException.NoSession()
        val body = buildJsonObject {
            put("avatar_id", agentId)
            idempotencyKey?.let { put("idempotency_key", it) }
            dryRun?.let { put("dry_run", it) }
            modelName?.let { put("model_name", it) }
            window?.let { put("window", it) }
        }
        val response = EdgeFunctions.post("trigger-v3-run", body.toString(), token)
        if (!response.isSuccess) {
            // Surface the server's error message verbatim when present (e.g.
            // daily-cap rejections) — Swift threw the SDK's httpError here.
            val message = runCatching {
                ((WagerproofJson.parseToJsonElement(response.body) as? JsonObject)
                    ?.get("error") as? JsonPrimitive)?.takeIf { it.isString }?.content
            }.getOrNull()
            throw AgentAuthorizedActionsService.ActionException.Server(
                message ?: "Generation request failed (${response.status})",
            )
        }
        return WagerproofJson.decodeFromString(GenerationRequestResult.serializer(), response.body)
    }
}
