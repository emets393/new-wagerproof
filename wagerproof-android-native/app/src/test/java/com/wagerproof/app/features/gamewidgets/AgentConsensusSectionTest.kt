package com.wagerproof.app.features.gamewidgets

import com.wagerproof.core.models.ConsensusVerdict
import com.wagerproof.core.models.GameAgentConsensus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

/**
 * The detail widget's contract.
 *
 * Everything it says and draws is scoped to `market_agents`, the denominator the
 * RPC computed `agreement` over. Dividing by `agents` (which pools every bet
 * shape on the game) makes a near-unanimous market read as disagreement, and the
 * bar then disagrees with the percentage printed beside it.
 *
 * The copy tests guard the other half: a card that recites a statistic instead
 * of reaching a conclusion, or that leaks the flag threshold and implies a gate
 * was cleared when the other gate is what failed.
 * See .claude/docs/18_agent_consensus.md.
 */
class AgentConsensusSectionTest {

    @Test
    fun `verdict names each state`() {
        assertEquals(
            ConsensusVerdict.CONSENSUS,
            consensus(agents = 40, marketAgentsRaw = 35, side = "TCU -6.5", sideAgents = 31, agreement = 0.886, flagged = true).verdict,
        )
        // 51% and unflagged — the case that used to read as a lean.
        assertEquals(
            ConsensusVerdict.SPLIT,
            consensus(agents = 40, marketAgentsRaw = 35, side = "TCU -6.5", sideAgents = 18, agreement = 0.514).verdict,
        )
        // Lopsided but too thin to clear the count gate.
        assertEquals(
            ConsensusVerdict.LEAN,
            consensus(agents = 17, marketAgentsRaw = 6, side = "PIT F5 -0.5", sideAgents = 5, agreement = 0.833).verdict,
        )
        assertEquals(
            ConsensusVerdict.TOO_FEW,
            consensus(agents = 4, marketAgentsRaw = 2, side = "Over 7.5", sideAgents = 1, agreement = 0.5).verdict,
        )
    }

    /** `flagged` is the server's decision; the local share constant never overrides it. */
    @Test
    fun `server flag wins over the local share constant`() {
        assertEquals(
            ConsensusVerdict.CONSENSUS,
            consensus(agents = 25, marketAgentsRaw = 20, side = "TCU -6.5", sideAgents = 9, agreement = 0.45, flagged = true).verdict,
        )
    }

    @Test
    fun `headline states a verdict first and names the market`() {
        assertEquals(
            "Agents are on Pittsburgh Pirates F5 -0.5 — 12 of the 14 betting the F5 run line.",
            consensus(
                agents = 39, marketAgentsRaw = 14, marketLabelRaw = "F5 run line",
                side = "Pittsburgh Pirates F5 -0.5", sideAgents = 12, agreement = 0.857, flagged = true,
            ).headline,
        )
        assertEquals(
            "Agents are split on the moneyline — Cincinnati Reds ML leads with 14 of 31.",
            consensus(
                agents = 45, marketAgentsRaw = 31, marketLabelRaw = "moneyline",
                side = "Cincinnati Reds ML", sideAgents = 14, agreement = 0.452,
            ).headline,
        )
        assertEquals(
            "Agents lean Pirates F5 -0.5, but only 6 bet the F5 run line.",
            consensus(
                agents = 17, marketAgentsRaw = 6, marketLabelRaw = "F5 run line",
                side = "Pirates F5 -0.5", sideAgents = 5, agreement = 0.833,
            ).headline,
        )
        assertEquals(
            "Only 1 agent bet the total on this game.",
            consensus(
                agents = 1, marketAgentsRaw = 1, marketLabelRaw = "total",
                side = "Over 7.5", sideAgents = 1, agreement = 1.0,
            ).headline,
        )
    }

    @Test
    fun `headline never leaks the flag threshold`() {
        val text = consensus(
            agents = 40, marketAgentsRaw = 35, marketLabelRaw = "spread",
            side = "TCU -6.5", sideAgents = 18, agreement = 0.514, threshold = 13,
        ).headline
        assertFalse(text.contains("13"))
        assertFalse(text.lowercase().contains("flag"))
        assertFalse(text.contains("55"))
    }

    /**
     * A pre-migration row has no market label, and the copy must not fall back to
     * "side" — a market holding alt lines or odds-suffixed selections is not
     * necessarily two-way.
     */
    @Test
    fun `copy drops the market clause on a pre-migration row`() {
        val c = consensus(
            agents = 17, marketAgentsRaw = null, marketLabelRaw = null,
            side = "Over 7.5", sideAgents = 8, agreement = 0.47,
        )
        assertEquals("Agents are split — Over 7.5 leads with 8 of 17 agents.", c.headline)
        assertFalse(c.headline.contains("side"))
        assertEquals("Most backed", c.mostBackedLabel)
        assertEquals("of agent bets", c.sharePopulationLabel)
    }

    @Test
    fun `bar legend names every segment`() {
        val c = consensus(
            agents = 40, marketAgentsRaw = 35, marketLabelRaw = "spread",
            side = "TCU -6.5", sideAgents = 18, agreement = 0.514,
            runnerUpSide = "Baylor +6.5", runnerUpAgents = 15,
        )
        assertEquals(listOf("18 TCU -6.5", "15 Baylor +6.5", "2 other"), c.barLegend)
    }

    @Test
    fun `bar legend says unanimous rather than drawing an empty remainder`() {
        val c = consensus(
            agents = 12, marketAgentsRaw = 12, marketLabelRaw = "total",
            side = "Under 8.5", sideAgents = 12, agreement = 1.0, flagged = true,
        )
        assertEquals(listOf("12 Under 8.5", "unanimous"), c.barLegend)
    }

    @Test
    fun `slate rank compares the game against its own board`() {
        assertEquals(
            "#3 of 14 today",
            consensus(
                agents = 40, marketAgentsRaw = 35, side = "TCU -6.5", sideAgents = 18,
                agreement = 0.514, slateRank = 3, slateGames = 14,
            ).slateRankLabel,
        )
        // Absent on pre-migration rows, and on a one-game slate where it says nothing.
        assertNull(consensus(agents = 17, marketAgentsRaw = 6, side = "x", sideAgents = 5, agreement = 0.8).slateRankLabel)
        assertNull(
            consensus(
                agents = 17, marketAgentsRaw = 6, side = "x", sideAgents = 5, agreement = 0.8,
                slateRank = 1, slateGames = 1,
            ).slateRankLabel,
        )
    }

    @Test
    fun `strip line carries the denominator`() {
        assertEquals(
            "18 of 35 on TCU -6.5",
            consensus(agents = 40, marketAgentsRaw = 35, side = "TCU -6.5", sideAgents = 18, agreement = 0.514).leaderLine,
        )
    }

    @Test
    fun `bar divides by marketAgents, not the whole-game count`() {
        val c = consensus(
            agents = 39, marketAgentsRaw = 14, marketLabelRaw = "F5 run line",
            side = "PIT F5 -0.5", sideAgents = 12, agreement = 0.857, threshold = 8, flagged = true,
            runnerUpSide = "MIL F5 +0.5", runnerUpAgents = 2,
        )
        val fractions = consensusBarFractions(c)
        // 12/14, NOT 12/39 (0.31) — the fill has to match the 86% beside it.
        assertEquals(12f / 14f, fractions.side, 0.0001f)
        assertEquals(2f / 14f, fractions.runnerUp, 0.0001f)
        assertEquals(0f, fractions.other, 0.0001f)
    }

    @Test
    fun `bar falls back to the whole-game count when market_agents is absent`() {
        val c = consensus(
            agents = 20, marketAgentsRaw = null, marketLabelRaw = null,
            side = "Over 7.5", sideAgents = 5, agreement = 0.25, threshold = 8,
        )
        val fractions = consensusBarFractions(c)
        assertEquals(0.25f, fractions.side, 0.0001f)
        // No runner-up on a pre-migration row: the rest is simply "other".
        assertEquals(0f, fractions.runnerUp, 0.0001f)
        assertEquals(0.75f, fractions.other, 0.0001f)
    }

    @Test
    fun `bar clamps rather than dividing by zero`() {
        val c = consensus(
            agents = 0, marketAgentsRaw = 0, marketLabelRaw = null,
            side = "Over 7.5", sideAgents = 0, agreement = 0.0, threshold = 8,
        )
        val fractions = consensusBarFractions(c)
        assertEquals(0f, fractions.side, 0.0001f)
        assertEquals(0f, fractions.runnerUp, 0.0001f)
        assertEquals(0f, fractions.other, 0.0001f)
    }

    /** Segments can never sum past the track, whatever the server sent. */
    @Test
    fun `bar segments never overflow the track`() {
        val c = consensus(
            agents = 10, marketAgentsRaw = 10, marketLabelRaw = "total",
            side = "Under 8.5", sideAgents = 9, agreement = 0.9,
            runnerUpSide = "Over 8.5", runnerUpAgents = 8,
        )
        val f = consensusBarFractions(c)
        assertEquals(1f, f.side + f.runnerUp + f.other, 0.0001f)
    }

    private fun consensus(
        agents: Int,
        marketAgentsRaw: Int?,
        marketLabelRaw: String? = null,
        side: String,
        sideAgents: Int,
        agreement: Double,
        threshold: Int = 8,
        flagged: Boolean = false,
        runnerUpSide: String? = null,
        runnerUpAgents: Int? = null,
        slateRank: Int? = null,
        slateGames: Int? = null,
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
        runnerUpSide = runnerUpSide,
        runnerUpAgents = runnerUpAgents,
        slateRank = slateRank,
        slateGames = slateGames,
    )
}
