package com.wagerproof.core.services

import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentBetItem
import io.github.jan.supabase.postgrest.from
import kotlinx.serialization.Serializable

class AgentPickFeedbackNotSignedIn : Exception("Sign in to send feedback")

/**
 * Writes agent-detail "How did we do?" reports to `agent_pick_feedback`
 * so we can review pick quality periodically. Mirrors iOS
 * `AgentPickFeedbackService`.
 */
object AgentPickFeedbackService {
    suspend fun submit(
        userId: String,
        agent: Agent,
        items: List<AgentBetItem>,
        userDescription: String,
    ) {
        SupabaseClients.main.from("agent_pick_feedback").insert(
            AgentPickFeedbackInsert(
                user_id = userId,
                agent_id = agent.id,
                agent_name = agent.name,
                user_description = userDescription,
                picks_snapshot = items.take(25).map(::PickSnapshot),
                agent_snapshot = AgentSnapshot(
                    name = agent.name,
                    avatar_emoji = agent.avatarEmoji,
                    preferred_sports = agent.preferredSports.map { it.raw },
                    archetype = agent.archetype?.raw,
                ),
                platform = "android",
            ),
        )
    }
}

@Serializable
private data class AgentPickFeedbackInsert(
    val user_id: String,
    val agent_id: String,
    val agent_name: String,
    val user_description: String,
    val picks_snapshot: List<PickSnapshot>,
    val agent_snapshot: AgentSnapshot,
    val platform: String,
)

@Serializable
private data class AgentSnapshot(
    val name: String,
    val avatar_emoji: String,
    val preferred_sports: List<String>,
    val archetype: String?,
)

@Serializable
private data class PickSnapshot(
    val id: String,
    val kind: String,
    val matchup: String?,
    val selection: String?,
    val bet_type: String?,
    val odds: String?,
    val units: Double,
    val sport: String?,
    val game_date: String,
    val result: String,
) {
    constructor(item: AgentBetItem) : this(
        id = when (item) {
            is AgentBetItem.Pick -> item.pick.id
            is AgentBetItem.Parlay -> item.parlay.id
        },
        kind = when (item) {
            is AgentBetItem.Pick -> "pick"
            is AgentBetItem.Parlay -> "parlay"
        },
        matchup = when (item) {
            is AgentBetItem.Pick -> item.pick.matchup
            is AgentBetItem.Parlay -> item.parlay.legs.joinToString(" + ") { it.matchup }
        },
        selection = when (item) {
            is AgentBetItem.Pick -> item.pick.pickSelection
            is AgentBetItem.Parlay -> "${item.parlay.displayLegsCount}-leg parlay"
        },
        bet_type = when (item) {
            is AgentBetItem.Pick -> item.pick.betType
            is AgentBetItem.Parlay -> "parlay"
        },
        odds = when (item) {
            is AgentBetItem.Pick -> item.pick.odds
            is AgentBetItem.Parlay -> item.parlay.combinedOdds
        },
        units = item.units,
        sport = when (item) {
            is AgentBetItem.Pick -> item.pick.sport.raw
            is AgentBetItem.Parlay -> item.parlay.sport.raw
        },
        game_date = item.gameDate,
        result = item.result.raw,
    )
}
