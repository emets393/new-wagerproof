package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.MLBSeriesSignal
import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * MLB series-position signals (G2/G3 carryover) from `mlb_game_signals`. Port
 * of iOS `MLBSeriesSignalsStore.swift` (mirrors RN `hooks/useMLBSeriesSignals.ts`):
 * each `home_signals` / `away_signals` entry is a JSON-encoded string; only
 * entries whose parsed `category == "series"` (with a message) survive.
 * 5-minute stale window.
 *
 * No coroutine scope — `refresh()` is a suspend fn called from the view.
 */
@Stable
class MLBSeriesSignalsStore {
    var signals by mutableStateOf<List<MLBSeriesSignal>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var errorMessage by mutableStateOf<String?>(null); private set
    var lastFetched by mutableStateOf<Long?>(null); private set

    /** 5-minute stale window — matches RN `staleTime: 5 * 60 * 1000`. */
    private val staleWindowMs: Long = 5 * 60 * 1000

    @Serializable
    private data class GameSignalsRow(
        @Serializable(with = FlexibleIntOrZeroSerializer::class)
        @SerialName("game_pk") val gamePk: Int = 0,
        @SerialName("home_team_name") val homeTeamName: String = "",
        @SerialName("away_team_name") val awayTeamName: String = "",
        @SerialName("home_signals") val homeSignals: List<String>? = null,
        @SerialName("away_signals") val awaySignals: List<String>? = null,
    )

    suspend fun refreshIfStale(force: Boolean = false) {
        val last = lastFetched
        if (!force && last != null && System.currentTimeMillis() - last < staleWindowMs) return
        refresh()
    }

    suspend fun refresh() {
        loading = true
        errorMessage = null
        try {
            val cfb = SupabaseClients.cfb
            val rows: List<GameSignalsRow> = cfb
                .from("mlb_game_signals")
                .select(
                    columns = Columns.raw(
                        "game_pk, home_team_name, away_team_name, home_signals, away_signals",
                    ),
                )
                .decodeList()
            signals = parse(rows)
            lastFetched = System.currentTimeMillis()
        } catch (e: Exception) {
            errorMessage = "Failed to load series signals."
        }
        loading = false
    }

    fun debugSet(signals: List<MLBSeriesSignal>) {
        if (!BuildFlags.isDebugBuild) return
        this.signals = signals
        this.lastFetched = System.currentTimeMillis()
    }

    private companion object {
        private val json = Json { ignoreUnknownKeys = true; isLenient = true }

        fun parse(rows: List<GameSignalsRow>): List<MLBSeriesSignal> {
            val out = mutableListOf<MLBSeriesSignal>()
            for (row in rows) {
                val matchup = "${row.awayTeamName} @ ${row.homeTeamName}"

                fun collect(raws: List<String>?, side: String, team: String) {
                    for (raw in raws ?: emptyList()) {
                        // Skip malformed entries silently (RN parity).
                        val obj = runCatching { json.parseToJsonElement(raw).jsonObject }.getOrNull() ?: continue
                        val category = obj["category"]?.jsonPrimitive?.contentOrNull
                        if (category != "series") continue
                        val message = obj["message"]?.jsonPrimitive?.contentOrNull
                        if (message.isNullOrEmpty()) continue
                        val severity =
                            if (obj["severity"]?.jsonPrimitive?.contentOrNull == "positive") "positive" else "negative"
                        out.add(
                            MLBSeriesSignal(
                                gamePk = row.gamePk,
                                matchup = matchup,
                                teamName = team,
                                teamSide = side,
                                severity = severity,
                                message = message,
                            ),
                        )
                    }
                }

                collect(row.homeSignals, side = "home", team = row.homeTeamName)
                collect(row.awaySignals, side = "away", team = row.awayTeamName)
            }
            return out
        }
    }
}
