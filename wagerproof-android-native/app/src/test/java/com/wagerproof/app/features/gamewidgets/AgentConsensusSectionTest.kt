package com.wagerproof.app.features.gamewidgets

import com.wagerproof.core.models.GameAgentConsensus
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * The detail widget's contract: everything it says and draws is scoped to
 * `market_agents`, the denominator the RPC computed `agreement` over.
 * Dividing by `agents` (which pools every bet shape on the game) makes a
 * near-unanimous market read as disagreement, and the bar then disagrees with
 * the percentage printed beside it — the bug iOS's widget still has.
 * See .claude/docs/18_agent_consensus.md.
 */
class AgentConsensusSectionTest {

    @Test
    fun `flagged headline states the market-scoped fraction and names the market`() {
        assertEquals(
            "12 of 14 agents betting the F5 run line are on Pittsburgh Pirates F5 -0.5 — 86% agreement.",
            consensusHeadline(
                consensus(
                    agents = 39, marketAgentsRaw = 14, marketLabelRaw = "F5 run line",
                    side = "Pittsburgh Pirates F5 -0.5", sideAgents = 12, agreement = 0.857, flagged = true,
                ),
            ),
        )
    }

    @Test
    fun `unflagged headline leads with the most-backed side`() {
        assertEquals(
            "The most-backed side is Cincinnati Reds ML: 14 of 31 agents betting the moneyline, 45% agreement.",
            consensusHeadline(
                consensus(
                    agents = 45, marketAgentsRaw = 31, marketLabelRaw = "moneyline",
                    side = "Cincinnati Reds ML", sideAgents = 14, agreement = 0.452, flagged = false,
                ),
            ),
        )
    }

    @Test
    fun `headline omits the market clause on a pre-migration row`() {
        assertEquals(
            "8 of 17 agents are on Over 7.5 — 47% agreement.",
            consensusHeadline(
                consensus(
                    agents = 17, marketAgentsRaw = null, marketLabelRaw = null,
                    side = "Over 7.5", sideAgents = 8, agreement = 0.47, flagged = true,
                ),
            ),
        )
    }

    @Test
    fun `bar divides by marketAgents, not the whole-game count`() {
        val c = consensus(
            agents = 39, marketAgentsRaw = 14, marketLabelRaw = "F5 run line",
            side = "PIT F5 -0.5", sideAgents = 12, agreement = 0.857, threshold = 8, flagged = true,
        )
        val fractions = consensusBarFractions(c)
        // 12/14, NOT 12/39 (0.31) — the fill has to match the 86% beside it.
        assertEquals(12f / 14f, fractions.side, 0.0001f)
        assertEquals(8f / 14f, fractions.threshold, 0.0001f)
    }

    @Test
    fun `bar falls back to the whole-game count when market_agents is absent`() {
        val c = consensus(
            agents = 20, marketAgentsRaw = null, marketLabelRaw = null,
            side = "Over 7.5", sideAgents = 5, agreement = 0.25, threshold = 8, flagged = false,
        )
        val fractions = consensusBarFractions(c)
        assertEquals(0.25f, fractions.side, 0.0001f)
        assertEquals(0.4f, fractions.threshold, 0.0001f)
    }

    @Test
    fun `bar clamps rather than dividing by zero`() {
        val c = consensus(
            agents = 0, marketAgentsRaw = 0, marketLabelRaw = null,
            side = "Over 7.5", sideAgents = 0, agreement = 0.0, threshold = 8, flagged = false,
        )
        val fractions = consensusBarFractions(c)
        assertEquals(0f, fractions.side, 0.0001f)
        assertEquals(0f, fractions.threshold, 0.0001f)
    }

    @Test
    fun `threshold tick never runs off the end of the track`() {
        // A quiet market can need more agents than bet it — the tick pins at 1.0
        // instead of drawing outside the bar.
        val c = consensus(
            agents = 12, marketAgentsRaw = 4, marketLabelRaw = "total",
            side = "Under 8.5", sideAgents = 3, agreement = 0.75, threshold = 8, flagged = false,
        )
        assertEquals(1f, consensusBarFractions(c).threshold, 0.0001f)
    }

    private fun consensus(
        agents: Int,
        marketAgentsRaw: Int?,
        marketLabelRaw: String?,
        side: String,
        sideAgents: Int,
        agreement: Double,
        threshold: Int = 8,
        flagged: Boolean = false,
    ) = GameAgentConsensus(
        gameId = "g1",
        gameDate = "2026-07-26",
        agents = agents,
        side = side,
        sideAgents = sideAgents,
        marketAgentsRaw = marketAgentsRaw,
        marketLabelRaw = marketLabelRaw,
        agreement = agreement,
        threshold = threshold,
        flagged = flagged,
    )
}
