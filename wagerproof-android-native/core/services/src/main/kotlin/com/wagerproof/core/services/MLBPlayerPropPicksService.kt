package com.wagerproof.core.services

import com.wagerproof.core.models.MLBPlayerPropBestPick
import com.wagerproof.core.models.MLBPlayerPropGrade
import com.wagerproof.core.models.MLBPlayerPropGradeSummary
import com.wagerproof.core.models.MLBPlayerPropPickKind
import com.wagerproof.core.models.MLBPlayerPropPickResult
import com.wagerproof.core.models.MLBPlayerPropPickTier
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull

/**
 * Reads the MLB Best Picks Report tables from the CFB Supabase project —
 * mirrors web `usePlayerPropPerformance.ts` + `useSnapshotPlayerPropPicks`.
 */
class MLBPlayerPropPicksService {

    suspend fun fetchTodaysPicks(reportDate: String): List<MLBPlayerPropBestPick> {
        // Pick rows decode fully leniently (per-field, Swift `try?` style) —
        // the report writer has shipped numeric strings and nulls before.
        val rows = SupabaseClients.cfb
            .from("mlb_player_prop_picks")
            .select {
                filter { eq("report_date", reportDate) }
                order("score", Order.DESCENDING)
            }
            .decodeList<JsonObject>()
        return rows.map { pickFromRow(it, reportDate) }
    }

    suspend fun fetchGradeSummary(): List<MLBPlayerPropGradeSummary> {
        val rows = SupabaseClients.cfb
            .from("v_mlb_player_prop_grade_summary")
            .select()
            .decodeList<SummaryRow>()
        // Unknown tier/kind rows are dropped (Swift compactMap).
        return rows.mapNotNull { it.model }
    }

    suspend fun fetchGradeHistory(limit: Int = 200): List<MLBPlayerPropGrade> {
        val rows = SupabaseClients.cfb
            .from("mlb_player_prop_grades")
            .select(
                columns = Columns.raw(
                    "report_date, game_pk, player_id, player_name, team_name, market, market_label, " +
                        "kind, tier, score, line, side, over_odds, under_odds, l10_pct, actual_value, " +
                        "result, units_staked, units_won",
                ),
            ) {
                order("report_date", Order.DESCENDING)
                order("score", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList<GradeRow>()
        return rows.map { it.model }
    }

    // MARK: - Lenient pick decode

    private fun pickFromRow(obj: JsonObject, reportDate: String): MLBPlayerPropBestPick {
        val market = string(obj, "market") ?: ""
        return MLBPlayerPropBestPick(
            reportDate = reportDate,
            gamePk = flexInt(obj, "game_pk") ?: 0,
            playerId = flexInt(obj, "player_id") ?: 0,
            market = market,
            side = string(obj, "side") ?: "over",
            playerName = string(obj, "player_name") ?: "Player",
            teamName = string(obj, "team_name"),
            gameLabel = string(obj, "game_label") ?: "",
            isDay = bool(obj, "is_day") ?: false,
            marketLabel = string(obj, "market_label") ?: market,
            kind = MLBPlayerPropPickKind.fromRaw(string(obj, "kind") ?: "batter")
                ?: MLBPlayerPropPickKind.BATTER,
            tier = MLBPlayerPropPickTier.fromRaw(string(obj, "tier") ?: "lean")
                ?: MLBPlayerPropPickTier.LEAN,
            score = flexInt(obj, "score") ?: 0,
            line = flexDouble(obj, "line") ?: 0.0,
            overOdds = flexInt(obj, "over_odds"),
            underOdds = flexInt(obj, "under_odds"),
            l10Over = flexInt(obj, "l10_over"),
            l10Games = flexInt(obj, "l10_games"),
            l10Pct = flexInt(obj, "l10_pct"),
            rationale = rationaleLines(obj["rationale"]),
            locked = bool(obj, "locked") ?: false,
        )
    }

    // MARK: - Row decoders (strict-typed views, WagerproofJson lenience underneath)

    @Serializable
    private data class SummaryRow(
        val tier: String,
        val market: String,
        @SerialName("market_label") val marketLabel: String,
        val kind: String,
        @SerialName("picks_total") val picksTotal: Int,
        @SerialName("picks_won") val picksWon: Int,
        @SerialName("picks_lost") val picksLost: Int,
        @SerialName("picks_push") val picksPush: Int,
        @SerialName("picks_pending") val picksPending: Int,
        @SerialName("win_pct") val winPct: Double? = null,
        @SerialName("units_staked") val unitsStaked: Double? = null,
        @SerialName("units_won") val unitsWon: Double? = null,
        @SerialName("roi_pct") val roiPct: Double? = null,
    ) {
        val model: MLBPlayerPropGradeSummary?
            get() {
                val tier = MLBPlayerPropPickTier.fromRaw(tier) ?: return null
                val kind = MLBPlayerPropPickKind.fromRaw(kind) ?: return null
                return MLBPlayerPropGradeSummary(
                    tier = tier,
                    market = market,
                    marketLabel = marketLabel,
                    kind = kind,
                    picksTotal = picksTotal,
                    picksWon = picksWon,
                    picksLost = picksLost,
                    picksPush = picksPush,
                    picksPending = picksPending,
                    winPct = winPct,
                    unitsStaked = unitsStaked,
                    unitsWon = unitsWon,
                    roiPct = roiPct,
                )
            }
    }

    @Serializable
    private data class GradeRow(
        @SerialName("report_date") val reportDate: String,
        @SerialName("game_pk") val gamePk: Int,
        @SerialName("player_id") val playerId: Int,
        @SerialName("player_name") val playerName: String? = null,
        @SerialName("team_name") val teamName: String? = null,
        val market: String,
        @SerialName("market_label") val marketLabel: String? = null,
        val kind: String? = null,
        val tier: String? = null,
        val score: Int? = null,
        val line: Double? = null,
        val side: String,
        @SerialName("over_odds") val overOdds: Int? = null,
        @SerialName("under_odds") val underOdds: Int? = null,
        @SerialName("l10_pct") val l10Pct: Int? = null,
        @SerialName("actual_value") val actualValue: Double? = null,
        val result: String? = null,
        @SerialName("units_staked") val unitsStaked: Double? = null,
        @SerialName("units_won") val unitsWon: Double? = null,
    ) {
        val model: MLBPlayerPropGrade
            get() = MLBPlayerPropGrade(
                reportDate = reportDate,
                gamePk = gamePk,
                playerId = playerId,
                market = market,
                side = side,
                playerName = playerName,
                teamName = teamName,
                marketLabel = marketLabel,
                kind = kind?.let { MLBPlayerPropPickKind.fromRaw(it) },
                tier = tier?.let { MLBPlayerPropPickTier.fromRaw(it) },
                score = score,
                line = line,
                overOdds = overOdds,
                underOdds = underOdds,
                l10Pct = l10Pct,
                actualValue = actualValue,
                result = result?.let { MLBPlayerPropPickResult.fromRaw(it) },
                unitsStaked = unitsStaked,
                unitsWon = unitsWon,
            )
    }

    companion object {
        val shared = MLBPlayerPropPicksService()

        /** Today in America/New_York as yyyy-MM-dd — matches the report date key. */
        fun todayET(): String = ServiceDates.todayET()

        // Flexible coercions matching Swift's per-field `try?` decode order:
        // native type first, then string parse, then double truncation.

        private fun prim(obj: JsonObject, key: String): JsonPrimitive? {
            val el = obj[key] ?: return null
            if (el is JsonNull) return null
            return el as? JsonPrimitive
        }

        private fun string(obj: JsonObject, key: String): String? =
            prim(obj, key)?.takeIf { it.isString }?.content

        private fun bool(obj: JsonObject, key: String): Boolean? =
            prim(obj, key)?.takeUnless { it.isString }?.booleanOrNull

        private fun flexInt(obj: JsonObject, key: String): Int? {
            val p = prim(obj, key) ?: return null
            if (p.isString) return p.content.toIntOrNull()
            p.intOrNull?.let { return it }
            return p.doubleOrNull?.toInt()
        }

        private fun flexDouble(obj: JsonObject, key: String): Double? {
            val p = prim(obj, key) ?: return null
            if (p.isString) return p.content.toDoubleOrNull()
            return p.doubleOrNull
        }

        /** `[String]` or empty — any non-string element voids the whole payload (Swift semantics). */
        private fun rationaleLines(el: kotlinx.serialization.json.JsonElement?): List<String> {
            val arr = el as? JsonArray ?: return emptyList()
            val lines = ArrayList<String>(arr.size)
            for (item in arr) {
                val p = item as? JsonPrimitive ?: return emptyList()
                if (!p.isString) return emptyList()
                lines.add(p.content)
            }
            return lines
        }
    }
}
