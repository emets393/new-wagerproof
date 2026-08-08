package com.wagerproof.core.services

import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.TopAgentWidgetData
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The Agent Monitor widget's small tile plots `form` as real recent results, so
 * the series has to be exactly right — a wrong sign or a dropped push reads as a
 * losing agent. Covers `TopAgentsWidgetService.formValues` plus the payload
 * fields the widget added (sprite_index / best_streak / form).
 */
class TopAgentsWidgetFormTest {

    private var seq = 0

    private fun pick(result: AgentPick.PickResultStatus, createdAt: String) = AgentPick(
        id = "p${seq++}",
        avatarId = "a1",
        gameId = "g1",
        result = result,
        createdAt = createdAt,
    )

    @Test
    fun emptyHistoryDrawsNoLineRatherThanAFakeOne() {
        assertEquals(emptyList<Double>(), TopAgentsWidgetService.formValues(emptyList()))
    }

    @Test
    fun pendingPicksAreExcludedEntirely() {
        val picks = listOf(
            pick(AgentPick.PickResultStatus.PENDING, "2026-07-01T00:00:00Z"),
            pick(AgentPick.PickResultStatus.PENDING, "2026-07-02T00:00:00Z"),
        )
        assertEquals(emptyList<Double>(), TopAgentsWidgetService.formValues(picks))
    }

    @Test
    fun seriesStartsAtZeroAndStepsOnePerGradedResult() {
        val picks = listOf(
            pick(AgentPick.PickResultStatus.WON, "2026-07-01T00:00:00Z"),
            pick(AgentPick.PickResultStatus.WON, "2026-07-02T00:00:00Z"),
            pick(AgentPick.PickResultStatus.LOST, "2026-07-03T00:00:00Z"),
        )
        // Leading 0 anchors the line so a single result still draws a segment.
        assertEquals(listOf(0.0, 1.0, 2.0, 1.0), TopAgentsWidgetService.formValues(picks))
    }

    @Test
    fun pushHoldsTheLineInsteadOfVanishing() {
        val picks = listOf(
            pick(AgentPick.PickResultStatus.WON, "2026-07-01T00:00:00Z"),
            pick(AgentPick.PickResultStatus.PUSH, "2026-07-02T00:00:00Z"),
            pick(AgentPick.PickResultStatus.LOST, "2026-07-03T00:00:00Z"),
        )
        // A push must add a FLAT point — dropping it would make the push look
        // like a bet that never happened.
        assertEquals(listOf(0.0, 1.0, 1.0, 0.0), TopAgentsWidgetService.formValues(picks))
    }

    @Test
    fun seriesIsChronologicalEvenWhenTheQueryReturnsNewestFirst() {
        // The Supabase query orders created_at DESC; the chart must read L→R in time.
        val newestFirst = listOf(
            pick(AgentPick.PickResultStatus.LOST, "2026-07-03T00:00:00Z"),
            pick(AgentPick.PickResultStatus.WON, "2026-07-02T00:00:00Z"),
            pick(AgentPick.PickResultStatus.WON, "2026-07-01T00:00:00Z"),
        )
        assertEquals(listOf(0.0, 1.0, 2.0, 1.0), TopAgentsWidgetService.formValues(newestFirst))
    }

    @Test
    fun onlyTheMostRecentResultsAreKeptWhenOverTheCap() {
        // 15 graded picks: alternating W/L then a run of wins at the end.
        val picks = (1..15).map { i ->
            val day = "%02d".format(i)
            pick(
                if (i > 10) AgentPick.PickResultStatus.WON else AgentPick.PickResultStatus.LOST,
                "2026-07-${day}T00:00:00Z",
            )
        }
        val values = TopAgentsWidgetService.formValues(picks)
        // cap + 1 for the leading anchor point.
        assertEquals(TopAgentsWidgetService.FORM_POINT_CAP + 1, values.size)
        // Window is picks 6..15 → 5 losses then 5 wins, ending back at 0.
        assertEquals(listOf(0.0, -1.0, -2.0, -3.0, -4.0, -5.0, -4.0, -3.0, -2.0, -1.0, 0.0), values)
    }

    // --- Payload contract ---------------------------------------------------

    @Test
    fun legacyPayloadWithoutTheNewFieldsStillDecodes() {
        // Widgets already on home screens hold pre-AND-036 JSON; a required
        // field here would leave those users with a permanently empty tile.
        val decoded = WagerproofJson.decodeFromString(
            TopAgentWidgetData.serializer(),
            """
            {"agentId":"a1","agentName":"Sharp Sam","agentEmoji":"🤖","agentColor":"#22C55E",
             "isFavorite":false,"netUnits":3.5,"currentStreak":2,"record":"5-2","picks":[]}
            """.trimIndent(),
        )
        assertEquals(0, decoded.bestStreak)
        assertTrue(decoded.form.isEmpty())
        // No stored sprite → the stable hash of the id, same rule as Agent.spriteIndex.
        assertEquals(com.wagerproof.core.models.AgentSpriteIndex.forSeed("a1"), decoded.resolvedSpriteIndex)
    }

    @Test
    fun storedSpriteWinsAndOutOfRangeValuesFallBackToTheHash() {
        val base = TopAgentWidgetData(
            agentId = "a1",
            agentName = "Sharp Sam",
            agentEmoji = "🤖",
            agentColor = "#22C55E",
            isFavorite = false,
            netUnits = 0.0,
            currentStreak = 0,
            record = "0-0",
        )
        assertEquals(5, base.copy(spriteIndex = 5).resolvedSpriteIndex)
        val hashed = com.wagerproof.core.models.AgentSpriteIndex.forSeed("a1")
        assertEquals(hashed, base.copy(spriteIndex = 99).resolvedSpriteIndex)
        assertEquals(hashed, base.copy(spriteIndex = -1).resolvedSpriteIndex)
    }
}
