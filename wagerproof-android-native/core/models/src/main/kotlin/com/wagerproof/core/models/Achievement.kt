package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant

data class AchievementDefinition(val id: String, val title: String, val group: String, val target: Double, val requirement: String)
object AchievementCatalog {
    val groupTitles = linkedMapOf("gettingStarted" to "Getting Started", "experience" to "Experience", "streaks" to "Win Streaks", "performance" to "Performance", "leaderboard" to "Leaderboard", "exploration" to "Exploration")
    val definitions = listOf(
        AchievementDefinition("first-agent", "First Agent", "gettingStarted", 1.0, "Create your first agent."),
        AchievementDefinition("first-follow", "First Follow", "gettingStarted", 1.0, "Follow a public agent."),
        AchievementDefinition("first-picks", "First Picks", "gettingStarted", 1.0, "Generate picks with your own agent."),
        AchievementDefinition("agent-squad", "Agent Squad", "gettingStarted", 3.0, "Create 3 agents."),
        AchievementDefinition("full-lineup", "Full Lineup", "gettingStarted", 5.0, "Create 5 agents."),
        AchievementDefinition("experience-10", "10 Graded Picks", "experience", 10.0, "Have one of your agents reach 10 graded picks."),
        AchievementDefinition("experience-50", "50 Graded Picks", "experience", 50.0, "Have one of your agents reach 50 graded picks."),
        AchievementDefinition("experience-100", "100 Graded Picks", "experience", 100.0, "Have one of your agents reach 100 graded picks."),
        AchievementDefinition("experience-500", "500 Graded Picks", "experience", 500.0, "Have one of your agents reach 500 graded picks."),
        AchievementDefinition("experience-1000", "1,000 Graded Picks", "experience", 1000.0, "Have one of your agents reach 1,000 graded picks."),
        AchievementDefinition("experience-2500", "2,500 Graded Picks", "experience", 2500.0, "Have one of your agents reach 2,500 graded picks."),
        AchievementDefinition("experience-5000", "5,000 Graded Picks", "experience", 5000.0, "Have one of your agents reach 5,000 graded picks."),
        AchievementDefinition("streak-3", "3 Win Streak", "streaks", 3.0, "Have one agent win 3 consecutive straight picks."),
        AchievementDefinition("streak-5", "5 Win Streak", "streaks", 5.0, "Have one agent win 5 consecutive straight picks."),
        AchievementDefinition("streak-10", "10 Win Streak", "streaks", 10.0, "Have one agent win 10 consecutive straight picks."),
        AchievementDefinition("streak-15", "15 Win Streak", "streaks", 15.0, "Have one agent win 15 consecutive straight picks."),
        AchievementDefinition("streak-20", "20 Win Streak", "streaks", 20.0, "Have one agent win 20 consecutive straight picks."),
        AchievementDefinition("streak-25", "25 Win Streak", "streaks", 25.0, "Have one agent win 25 consecutive straight picks."),
        AchievementDefinition("first-win", "First Win", "performance", 1.0, "Have an agent record its first winning pick."),
        AchievementDefinition("plus-10-units", "+10 Units", "performance", 10.0, "Have one agent reach +10 net units."),
        AchievementDefinition("plus-25-units", "+25 Units", "performance", 25.0, "Have one agent reach +25 net units."),
        AchievementDefinition("plus-50-units", "+50 Units", "performance", 50.0, "Have one agent reach +50 net units."),
        AchievementDefinition("plus-100-units", "+100 Units", "performance", 100.0, "Have one agent reach +100 net units."),
        AchievementDefinition("consistent", "Consistent", "performance", 55.0, "Reach a 55% win rate with at least 100 decided picks on one agent."),
        AchievementDefinition("consistent-250", "Proven Consistency 250", "performance", 55.0, "Reach a 55% win rate with at least 250 decided picks on one agent."),
        AchievementDefinition("consistent-500", "Proven Consistency 500", "performance", 55.0, "Reach a 55% win rate with at least 500 decided picks on one agent."),
        AchievementDefinition("top-100", "Top 100", "leaderboard", 100.0, "Place a public agent in the all-time top 100 with at least 10 graded picks."),
        AchievementDefinition("top-10", "Top 10", "leaderboard", 10.0, "Place a public agent in the all-time top 10 with at least 10 graded picks."),
        AchievementDefinition("number-one", "Number One", "leaderboard", 1.0, "Reach first place on the all-time public agent leaderboard with at least 10 graded picks."),
        AchievementDefinition("game-analyst", "Game Analyst", "exploration", 1.0, "Explore the analysis for a game."),
        AchievementDefinition("props-scout", "Props Scout", "exploration", 1.0, "Explore a player prop."),
        AchievementDefinition("trend-explorer", "Trend Explorer", "exploration", 1.0, "Explore historical betting analysis."),
        AchievementDefinition("system-builder", "System Builder", "exploration", 1.0, "Save a betting system with its analysis."),
        AchievementDefinition("wagerbot-partner", "WagerBot Partner", "exploration", 1.0, "Complete a conversation turn with WagerBot."),
        AchievementDefinition("connected-researcher", "Connected Researcher", "exploration", 1.0, "Complete a research tool request through your connected WagerProof account."),
    )
}
@Serializable
data class AchievementStatus(
    val id: String,
    val progress: Double = 0.0,
    @SerialName("current_value") val currentValue: Double = 0.0,
    @SerialName("target_value") val targetValue: Double = 1.0,
    @SerialName("earned_at") val earnedAt: String? = null,
    @SerialName("is_backfilled") val isBackfilled: Boolean = false,
    @SerialName("credited_agent_id") val creditedAgentId: String? = null,
)
@Serializable
data class AchievementSnapshot(
    @SerialName("catalog_version") val catalogVersion: Int = 1,
    @SerialName("initialized_at") val initializedAt: String,
    @SerialName("generated_at") val generatedAt: String,
    val achievements: List<AchievementStatus>,
    @SerialName("newly_unlocked_ids") val newlyUnlockedIds: List<String> = emptyList(),
)
data class Achievement(val definition: AchievementDefinition, val status: AchievementStatus = AchievementStatus(definition.id)) {
    val id get() = definition.id
    val earned get() = status.earnedAt != null
    val fraction get() = if (earned) 1f else (if (status.progress.isFinite()) status.progress else 0.0).coerceIn(0.0, 1.0).toFloat()
}
/** Server unlocks are permanent. Progress and missing rows cannot revoke them. */
fun mergeAchievementStatuses(previous: List<Achievement>, incoming: List<AchievementStatus>): List<Achievement> {
    val old = previous.associateBy { it.id }
    val fresh = incoming.associateBy { it.id }
    return AchievementCatalog.definitions.map { definition ->
        var status = fresh[definition.id] ?: AchievementStatus(definition.id, targetValue = definition.target)
        val prior = old[definition.id]?.status
        if (prior?.earnedAt != null && (status.earnedAt == null || Instant.parse(prior.earnedAt) < Instant.parse(status.earnedAt))) {
            status = status.copy(earnedAt = prior.earnedAt, isBackfilled = prior.isBackfilled, creditedAgentId = prior.creditedAgentId)
        }
        Achievement(definition, status)
    }
}
