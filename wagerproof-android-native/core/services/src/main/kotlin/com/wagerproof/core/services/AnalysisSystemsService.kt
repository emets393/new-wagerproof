package com.wagerproof.core.services

import com.wagerproof.core.models.AnalysisSystemVerdict
import com.wagerproof.core.models.AnalysisSystemsLeaderboardRow
import com.wagerproof.core.models.HistoricalAnalysisSavedFilter
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUISnapshot
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.models.serialization.decodeLossyList
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Per-user saved analysis systems on the MAIN (auth) Supabase project, plus the
 * public Systems Leaderboard. Port of iOS
 * `WagerproofServices/HistoricalAnalysisSavedFiltersService.swift`.
 *
 * A saved system = UI filter snapshot + an explicit bet-side (`verdict`) + the
 * EXACT warehouse payload (`rpc_bet_type` / `rpc_filters`) so the nightly
 * `grade-analysis-systems` job reproduces the page's numbers. **A row missing
 * those columns can never be graded** — see
 * `.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md`.
 *
 * Filters are immutable post-save (the table only grants UPDATE on `name` and
 * `is_public`): editing = new save, which resets since-saved by construction.
 */
object HistoricalAnalysisSavedFiltersService {
    const val MAX_PER_USER = 25

    /** Explicit column list so a schema addition can't silently change the decode. */
    internal const val SELECT_COLS =
        "id, user_id, name, bet_type, filters, verdict, rpc_bet_type, rpc_filters, " +
            "is_public, since_saved, created_at"

    /**
     * The caller's systems, newest first. Decoded per row — a single legacy or
     * web-shaped snapshot must not blank the whole My Systems list.
     */
    suspend fun fetch(
        sport: HistoricalAnalysisSport,
        userId: String,
    ): List<HistoricalAnalysisSavedFilter> {
        val response = SupabaseClients.main.from(sport.savedFiltersTable)
            .select(Columns.raw(SELECT_COLS)) {
                filter { eq("user_id", userId) }
                order("created_at", Order.DESCENDING)
            }
        return HistoricalAnalysisSavedFilter.decodeLossyList(sport, response.data)
    }

    /**
     * Insert a tracked system and return the new row id.
     *
     * [rpcFilters] MUST be the same object the page just sent to `{sport}_analysis`
     * as `p_filters` — the grader replays it verbatim, so re-deriving it from a
     * different snapshot silently grades a different rule than the one on screen.
     */
    suspend fun saveSystem(
        sport: HistoricalAnalysisSport,
        userId: String,
        name: String,
        betType: String,
        snapshot: HistoricalAnalysisUISnapshot,
        verdict: AnalysisSystemVerdict,
        rpcBetType: String,
        rpcFilters: JsonObject,
        isPublic: Boolean,
    ): String {
        val inserted = SupabaseClients.main.from(sport.savedFiltersTable)
            .insert(
                SystemInsert(
                    userId = userId,
                    name = name.trim(),
                    betType = betType,
                    filters = snapshot,
                    verdict = verdict.raw,
                    rpcBetType = rpcBetType,
                    rpcFilters = rpcFilters,
                    isPublic = isPublic,
                ),
            ) { select(Columns.raw("id")) }
            .decodeList<InsertedRow>()
            .firstOrNull()
            ?: throw IllegalStateException("Save returned no row")
        return inserted.id
    }

    // There is deliberately NO plain-bookmark save here. A row without
    // verdict/rpc_* is invisible to the grader forever, and the old Android save
    // wrote exactly that — every "system" it produced was permanently 0-0.

    suspend fun rename(sport: HistoricalAnalysisSport, id: String, name: String) {
        SupabaseClients.main.from(sport.savedFiltersTable)
            .update({ set("name", name.trim()) }) { filter { eq("id", id) } }
    }

    suspend fun setPublic(sport: HistoricalAnalysisSport, id: String, isPublic: Boolean) {
        SupabaseClients.main.from(sport.savedFiltersTable)
            .update({ set("is_public", isPublic) }) { filter { eq("id", id) } }
    }

    suspend fun delete(sport: HistoricalAnalysisSport, id: String) {
        SupabaseClients.main.from(sport.savedFiltersTable).delete { filter { eq("id", id) } }
    }

    /**
     * Public Systems Leaderboard — MAIN client, anon-callable, min 10 graded games.
     * Numbers are grader-computed; never recompute them client-side.
     */
    suspend fun fetchLeaderboard(
        sport: HistoricalAnalysisSport,
        limit: Int = 50,
    ): List<AnalysisSystemsLeaderboardRow> {
        val response = SupabaseClients.main.postgrest.rpc(
            "analysis_systems_leaderboard",
            buildJsonObject {
                put("p_sport", sport.raw)
                put("p_limit", limit)
            },
        )
        return WagerproofJson.decodeLossyList(
            AnalysisSystemsLeaderboardRow.serializer(),
            response.data,
        )
    }

    /**
     * Fire-and-forget: score the caller's own systems now so a freshly shared
     * system doesn't wait for the 09:20 UTC cron before the leaderboard can see
     * it (the RPC filters on `filters_hash` + `all_time`, both grader-written).
     *
     * The edge function runs with `verify_jwt` off and authorises on the bearer
     * token, so a signed-out caller has nothing to grade — skip the round trip.
     */
    suspend fun requestGrade() {
        val token = EdgeFunctions.accessTokenOrNull() ?: return
        runCatchingCancellable { EdgeFunctions.post("grade-analysis-systems", "{}", token) }
    }

    /**
     * The insert payload. Column names here ARE the grader contract — an insert
     * missing `verdict` / `rpc_bet_type` / `rpc_filters` writes a row
     * `grade-analysis-systems` will skip forever. Covered by
     * `AnalysisSystemsPayloadTest`.
     */
    @Serializable
    internal data class SystemInsert(
        @SerialName("user_id") val userId: String,
        val name: String,
        @SerialName("bet_type") val betType: String,
        val filters: HistoricalAnalysisUISnapshot,
        val verdict: String,
        @SerialName("rpc_bet_type") val rpcBetType: String,
        @SerialName("rpc_filters") val rpcFilters: JsonObject,
        @SerialName("is_public") val isPublic: Boolean,
    )

    @Serializable
    private data class InsertedRow(val id: String)
}
