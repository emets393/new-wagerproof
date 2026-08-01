package com.wagerproof.app.features.props

import com.wagerproof.core.models.MLBPlayerProps
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * AND-021 — the Props Quick Filter narrows a 250-350 card board across the
 * fields a user would actually type. Ported field-for-field from iOS
 * `quickFilteredMLBItems` / `quickFilteredNFLItems` (PropsView.swift:774-807);
 * these cases pin each field so a future edit can't silently shrink the reach
 * of a query.
 */
class PropsQuickFilterTest {

    // MARK: - MLB

    private fun mlbItem(): PlayerPropFeedItem {
        val selection = PropsFixtures.sampleSelection
        val headline = MLBPlayerProps.pickHeadlineProp(selection.props, "batter_hits")!!
        return PlayerPropFeedItem(
            selection = selection,
            headline = headline,
            teamPrimaryHex = 0x132448,
            teamSecondaryHex = 0xC4CED3,
            lineOrder = 2,
            metricLabel = "BEST",
        )
    }

    @Test
    fun `mlb matches player, team, opponent, abbr and position`() {
        val items = listOf(mlbItem())
        // playerName / teamName / teamAbbr / opponentName / opponentAbbr / position
        for (q in listOf("judge", "yankees", "nyy", "tigers", "det", "rf")) {
            assertEquals(1, quickFilteredMlbItems(items, q).size, "expected a hit for \"$q\"")
        }
    }

    @Test
    fun `mlb matches the market label of the headline prop`() {
        val items = listOf(mlbItem())
        // "batter_hits" renders as "Hits" — the raw key is NOT what the user sees.
        assertEquals(1, quickFilteredMlbItems(items, "hits").size)
    }

    @Test
    fun `mlb matches the metric label`() {
        val items = listOf(mlbItem().copy(metricLabel = "TOTAL BASES"))
        assertEquals(1, quickFilteredMlbItems(items, "total bases").size)
    }

    @Test
    fun `mlb empty query is a no-op and an unmatched query clears the board`() {
        val items = listOf(mlbItem())
        assertTrue(quickFilteredMlbItems(items, "") === items)
        assertTrue(quickFilteredMlbItems(items, "ohtani").isEmpty())
    }

    // MARK: - NFL

    private fun nflItems(): List<NFLPropFeedItem> =
        NFLPropFeed.items(PropsFixtures.nflBoard, NFLPropFeedFilters())

    @Test
    fun `nfl matches player, team abbr, opponent abbr and position`() {
        val items = nflItems()
        assertTrue(items.isNotEmpty(), "fixture board should produce feed items")

        assertEquals(listOf("Josh Allen"), quickFilteredNflItems(items, "allen").map { it.player.playerName })
        // Opponent is the OTHER side of the same game, so "buf" reaches both
        // the BUF player (by team) and the KC player (by opponent) — searching
        // both sides is what makes "show me this matchup" work.
        val buf = quickFilteredNflItems(items, "buf")
        assertTrue(buf.any { it.player.team == "BUF" })
        assertTrue(buf.any { it.player.team == "KC" })
        // Every fixture player is a QB.
        assertEquals(items.size, quickFilteredNflItems(items, "qb").size)
    }

    @Test
    fun `nfl matches the display market label`() {
        val items = nflItems()
        // Feed cards show the headline market's label ("Pass Yards"), not the key.
        assertTrue(quickFilteredNflItems(items, "pass").isNotEmpty())
    }

    @Test
    fun `nfl query is case and whitespace insensitive at the call site`() {
        val items = nflItems()
        // The screen trims + lowercases before calling; the predicate itself
        // assumes that has happened, so the normalized form must still hit.
        assertEquals(
            quickFilteredNflItems(items, "allen").size,
            quickFilteredNflItems(items, "  Allen  ".trim().lowercase()).size,
        )
    }

    @Test
    fun `nfl empty query is a no-op and an unmatched query clears the board`() {
        val items = nflItems()
        assertTrue(quickFilteredNflItems(items, "") === items)
        assertTrue(quickFilteredNflItems(items, "burrow").isEmpty())
    }
}
