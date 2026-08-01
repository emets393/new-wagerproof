package com.wagerproof.app.features.analytics.historical

import com.wagerproof.core.models.AnalysisSystemVerdict
import com.wagerproof.core.models.AnalysisSystemsLeaderboardRow
import com.wagerproof.core.models.HistoricalAnalysisSavedFilter
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.models.serialization.decodeLossyList
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Read side of the saved-systems contract: rows written by iOS and web must
 * decode here with their tracking intact, legacy bookmark rows must still list,
 * and one bad row must never blank the whole My Systems list.
 */
class AnalysisSystemsDecodeTest {

    private val trackedRow = """
        {
          "id": "9f1e1c62-3d0c-4a2a-8c1a-000000000001",
          "user_id": "11111111-2222-3333-4444-555555555555",
          "name": "Road dogs after a blowout",
          "bet_type": "rl",
          "filters": {"betType": "rl", "side": "away", "favDog": "underdog", "seasonMin": 2024},
          "verdict": "fade",
          "rpc_bet_type": "rl",
          "rpc_filters": {"season_min": 2024, "side": "away", "fav_dog": "underdog"},
          "is_public": true,
          "since_saved": {"n": 3, "wins": 2, "losses": 1, "pushes": 0, "hit_pct": 66.7, "roi": 12.5, "units": 0.9},
          "created_at": "2026-07-25T12:00:00Z"
        }
    """.trimIndent()

    /** Pre-systems Android/Expo save: no verdict, no rpc payload, no is_public. */
    private val bookmarkRow = """
        {
          "id": "9f1e1c62-3d0c-4a2a-8c1a-000000000002",
          "user_id": "11111111-2222-3333-4444-555555555555",
          "name": "Just my filters",
          "bet_type": "ml",
          "filters": {"betType": "ml", "seasonMin": 2025},
          "created_at": "2026-07-20T12:00:00Z"
        }
    """.trimIndent()

    @Test
    fun trackedSystemKeepsVerdictAndGraderPayload() {
        val rows = HistoricalAnalysisSavedFilter.decodeLossyList(
            HistoricalAnalysisSport.MLB,
            "[$trackedRow]",
        )
        val row = rows.single()
        assertEquals(AnalysisSystemVerdict.FADE, row.verdict)
        assertTrue(row.isTrackedSystem)
        assertTrue(row.isPublic)
        assertEquals("rl", row.rpcBetType)
        assertEquals("2024", row.rpcFilters?.get("season_min")?.jsonPrimitive?.content)
        assertEquals("away", row.rpcFilters?.get("side")?.jsonPrimitive?.content)
        assertEquals(2, row.sinceSaved?.wins)
        assertEquals(1, row.sinceSaved?.losses)
        assertEquals(12.5, row.sinceSaved?.roi)
        // Snapshot restores verbatim.
        assertEquals("away", row.filters.side)
        assertEquals(2024, row.filters.seasonMin)
    }

    @Test
    fun legacyBookmarkStillListsButIsNotTracked() {
        val row = HistoricalAnalysisSavedFilter
            .decodeLossyList(HistoricalAnalysisSport.MLB, "[$bookmarkRow]")
            .single()
        assertNull(row.verdict)
        assertFalse(row.isTrackedSystem)
        assertFalse(row.isPublic)
        assertNull(row.rpcFilters)
        assertNull(row.sinceSaved)
    }

    @Test
    fun oneUndecodableRowDoesNotBlankTheList() {
        // Missing `id` — required, so this row alone must be dropped.
        val broken = """{"user_id": "u", "name": "Broken", "bet_type": "ml", "filters": {}}"""
        val rows = HistoricalAnalysisSavedFilter.decodeLossyList(
            HistoricalAnalysisSport.MLB,
            "[$broken, $trackedRow, $bookmarkRow]",
        )
        assertEquals(2, rows.size)
        assertEquals(listOf("Road dogs after a blowout", "Just my filters"), rows.map { it.name })
    }

    @Test
    fun missingSnapshotFallsBackToThisSportsDefaultsNotNfls() {
        val nullFilters = """
            {
              "id": "9f1e1c62-3d0c-4a2a-8c1a-000000000003",
              "user_id": "u",
              "name": "No snapshot",
              "bet_type": "rl",
              "filters": null
            }
        """.trimIndent()
        val row = HistoricalAnalysisSavedFilter
            .decodeLossyList(HistoricalAnalysisSport.MLB, "[$nullFilters]")
            .single()
        // NFL's [0,16] streak ceiling would be a silent always-on filter on MLB.
        assertEquals(listOf(0, 25), row.filters.winStreak)
        assertEquals("rl", row.filters.betType)
    }

    @Test
    fun sparseNflSnapshotUsesFootballDefaultsInsteadOfMlbTotals() {
        val sparse = """
            {
              "id": "9f1e1c62-3d0c-4a2a-8c1a-000000000004",
              "user_id": "u",
              "name": "Sparse NFL",
              "bet_type": "fg_spread",
              "filters": {"side": "away", "seasonMin": 2024}
            }
        """.trimIndent()
        val row = HistoricalAnalysisSavedFilter
            .decodeLossyList(HistoricalAnalysisSport.NFL, "[$sparse]")
            .single()

        assertEquals(30.0, row.filters.lineMin)
        assertEquals(60.0, row.filters.lineMax)
        val rpc = HistoricalAnalysisFilterBuilder.buildRPCFilters(HistoricalAnalysisSport.NFL, row.filters)
        assertFalse("total_min" in rpc)
        assertFalse("total_max" in rpc)
    }

    @Test
    fun sparseMlbSnapshotUsesCurrentMlbSeasonAndWideRecordDefaults() {
        val sparse = """
            {
              "id": "9f1e1c62-3d0c-4a2a-8c1a-000000000005",
              "user_id": "u",
              "name": "Sparse MLB",
              "bet_type": "ml",
              "filters": {"betType": "ml", "side": "home"}
            }
        """.trimIndent()
        val row = HistoricalAnalysisSavedFilter
            .decodeLossyList(HistoricalAnalysisSport.MLB, "[$sparse]")
            .single()

        assertEquals(2026, row.filters.seasonMax)
        assertEquals(5.0, row.filters.lineMin)
        assertEquals(14.0, row.filters.lineMax)
        assertEquals(listOf(0, 25), row.filters.winStreak)
        assertEquals(listOf(0, 120), row.filters.prevWins)
    }

    @Test
    fun explicitCfbValuesThatMatchNflDefaultsArePreserved() {
        val explicit = """
            {
              "id": "9f1e1c62-3d0c-4a2a-8c1a-000000000006",
              "user_id": "u",
              "name": "Explicit CFB ranges",
              "bet_type": "fg_spread",
              "filters": {"ppg": [0, 40], "lastMargin": [-60, 60]}
            }
        """.trimIndent()
        val row = HistoricalAnalysisSavedFilter
            .decodeLossyList(HistoricalAnalysisSport.CFB, "[$explicit]")
            .single()

        assertEquals(listOf(0.0, 40.0), row.filters.ppg)
        assertEquals(listOf(-60, 60), row.filters.lastMargin)
    }

    @Test
    fun leaderboardRowDecodesGraderNumbersAndSnapshot() {
        val json = """
            [{
              "sport": "mlb",
              "system_id": "aaaa-bbbb",
              "name": "Fade road favorites",
              "verdict": "fade",
              "bet_type": "rl",
              "rpc_bet_type": "rl",
              "filters": {"betType": "rl", "side": "away"},
              "username": "sharpsam",
              "created_at": "2026-07-01T00:00:00Z",
              "since_saved": {"n": 4, "wins": 3, "losses": 1, "pushes": 0},
              "all_time": {"n": 698, "wins": 378, "losses": 320, "pushes": 0, "hit_pct": 54.2, "roi": 3.4, "units": 21.5},
              "current_season": {"n": 90, "wins": 50, "losses": 40, "pushes": 0},
              "season_label": 2026,
              "last10": {"n": 10, "wins": 8, "results": [1,1,0,1,1,1,0,1,1,1]},
              "streak": {"kind": "win", "len": 3},
              "graded_at": "2026-07-30T09:20:00Z"
            }]
        """.trimIndent()
        val row = WagerproofJson
            .decodeLossyList(AnalysisSystemsLeaderboardRow.serializer(), json)
            .single()
        assertEquals("aaaa-bbbb", row.id)
        assertEquals(AnalysisSystemVerdict.FADE, row.verdict)
        assertEquals(698, row.allTime?.n)
        assertEquals(3.4, row.allTime?.roi)
        assertEquals(21.5, row.allTime?.units)
        assertEquals(8, row.last10?.wins)
        assertEquals("win", row.streak?.kind)
        assertEquals(2026, row.seasonLabel)
        assertNotNull(row.filters)
        assertEquals("away", row.filters?.side)
        assertEquals(2026, row.filters?.seasonMax)
        assertEquals(listOf(0, 25), row.filters?.winStreak)
    }

    @Test
    fun leaderboardRowWithUnusableSnapshotExposesNullFilters() {
        val json = """
            [{
              "sport": "nfl",
              "system_id": "cccc",
              "name": "Broken snapshot",
              "verdict": "team",
              "bet_type": "fg_spread",
              "filters": null,
              "username": "someone"
            }]
        """.trimIndent()
        val row = WagerproofJson
            .decodeLossyList(AnalysisSystemsLeaderboardRow.serializer(), json)
            .single()
        // "Use This System" disables on null rather than applying an all-defaults search.
        assertNull(row.filters)
        assertNull(row.allTime)
    }

    @Test
    fun unknownVerdictDegradesToNullButStillRenders() {
        val json = """
            [{"sport": "mlb", "system_id": "dddd", "name": "Weird", "verdict": "sideways", "bet_type": "ml", "username": "u"}]
        """.trimIndent()
        val row = WagerproofJson
            .decodeLossyList(AnalysisSystemsLeaderboardRow.serializer(), json)
            .single()
        assertNull(row.verdict)
        assertEquals(AnalysisSystemVerdict.TEAM, row.effectiveVerdict)
    }
}
