package com.wagerproof.core.services

import com.wagerproof.core.models.AnalysisSystemVerdict
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Wire contract for a saved system row. The nightly `grade-analysis-systems` job
 * replays `rpc_bet_type` + `rpc_filters` against the warehouse and keys its cache
 * on (sport, verdict, canonical rpc_filters) — so a row missing any of those
 * columns is silently ungradeable, which is exactly the bug this port fixes.
 * See .claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md.
 */
class AnalysisSystemsPayloadTest {

    private fun payload(
        sport: HistoricalAnalysisSport = HistoricalAnalysisSport.MLB,
        snapshot: HistoricalAnalysisUISnapshot = HistoricalAnalysisUISnapshot.defaults(sport),
        verdict: AnalysisSystemVerdict = AnalysisSystemVerdict.FADE,
        isPublic: Boolean = true,
    ): JsonObject {
        val rpcFilters = HistoricalAnalysisFilterBuilder.buildRPCFilters(sport, snapshot)
        val insert = HistoricalAnalysisSavedFiltersService.SystemInsert(
            userId = "11111111-2222-3333-4444-555555555555",
            name = "  Road dogs after a blowout  ".trim(),
            betType = snapshot.betType,
            filters = snapshot,
            verdict = verdict.raw,
            rpcBetType = snapshot.betType,
            rpcFilters = rpcFilters,
            isPublic = isPublic,
        )
        return WagerproofJson.parseToJsonElement(WagerproofJson.encodeToString(insert)).jsonObject
    }

    @Test
    fun insertCarriesEveryColumnTheGraderNeeds() {
        val row = payload()
        // Exact snake_case column names — PostgREST maps these 1:1 onto the table.
        listOf("user_id", "name", "bet_type", "filters", "verdict", "rpc_bet_type", "rpc_filters", "is_public")
            .forEach { column -> assertTrue(row.containsKey(column), "missing column $column") }
    }

    @Test
    fun verdictIsWrittenAsTheRawEnumValue() {
        assertEquals("fade", payload(verdict = AnalysisSystemVerdict.FADE)["verdict"]?.jsonPrimitive?.content)
        assertEquals("under", payload(verdict = AnalysisSystemVerdict.UNDER)["verdict"]?.jsonPrimitive?.content)
    }

    @Test
    fun rpcFiltersMatchTheExactPayloadThePageQueriedWith() {
        val sport = HistoricalAnalysisSport.MLB
        val snapshot = HistoricalAnalysisUISnapshot.defaults(sport).also {
            it.betType = "total"
            it.side = "home"
            it.seasonMin = 2024
        }
        val expected = HistoricalAnalysisFilterBuilder.buildRPCFilters(sport, snapshot)
        val row = payload(sport = sport, snapshot = snapshot)
        assertEquals(expected, row["rpc_filters"]?.jsonObject)
        // rpc_bet_type tracks the SAVED market, not whatever the page moved on to.
        assertEquals("total", row["rpc_bet_type"]?.jsonPrimitive?.content)
        assertEquals("total", row["bet_type"]?.jsonPrimitive?.content)
    }

    @Test
    fun filtersColumnHoldsTheRestorableUISnapshot() {
        val snapshot = HistoricalAnalysisUISnapshot.defaults(HistoricalAnalysisSport.NFL).also {
            it.betType = "fg_spread"
            it.spreadSide = "underdog"
        }
        val filters = payload(sport = HistoricalAnalysisSport.NFL, snapshot = snapshot)["filters"]?.jsonObject
        // UI-shaped camelCase keys (not the RPC's snake_case) — restore reads these back.
        assertEquals("fg_spread", filters?.get("betType")?.jsonPrimitive?.content)
        assertEquals("underdog", filters?.get("spreadSide")?.jsonPrimitive?.content)
    }

    @Test
    fun selectListRequestsEveryTrackingColumn() {
        val columns = HistoricalAnalysisSavedFiltersService.SELECT_COLS.split(",").map { it.trim() }
        listOf("verdict", "rpc_bet_type", "rpc_filters", "is_public", "since_saved")
            .forEach { column -> assertTrue(column in columns, "select list is missing $column") }
    }
}
