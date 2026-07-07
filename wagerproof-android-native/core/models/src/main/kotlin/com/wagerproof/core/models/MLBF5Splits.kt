package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import com.wagerproof.core.models.serialization.FlexibleStringSerializer
import com.wagerproof.core.models.serialization.PercentFlexibleDoubleSerializer
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import java.util.Locale
import kotlin.math.ceil
import kotlin.math.floor

/**
 * MLB First-Five (F5) Splits models + helpers. Port of iOS `MLBF5Splits.swift`
 * (itself a 1:1 port of RN `types/mlbF5Splits.ts` + `utils/mlbF5Splits.ts`).
 *
 * The away team is judged by its AWAY games versus tonight's opposing starter
 * hand; the home team by its HOME games versus tonight's opposing starter hand.
 * Splits come from the `mv_mlb_f5_team_splits` materialized view, keyed
 * `teamAbbr|home|away|R|L`.
 */

enum class MLBF5PitchHand(val raw: String) {
    RIGHT("R"),
    LEFT("L");

    companion object {
        fun fromRaw(raw: String): MLBF5PitchHand? = entries.firstOrNull { it.raw == raw }
    }
}

// Non-null flexible strings with Swift's per-field defaults ("" vs "-"). The
// shared FlexibleStringSerializer is nullable, so wrap rather than duplicate.
private open class F5StringWithDefaultSerializer(private val default: String) : KSerializer<String> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("F5FlexString", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String =
        FlexibleStringSerializer.deserialize(decoder) ?: default

    override fun serialize(encoder: Encoder, value: String) = encoder.encodeString(value)
}

private object F5StringOrEmptySerializer : F5StringWithDefaultSerializer("")
private object F5StringOrDashSerializer : F5StringWithDefaultSerializer("-")

/**
 * One row from `mv_mlb_f5_team_splits`. Every field flexible-decoded —
 * PostgREST may hand back numbers or strings for NUMERIC columns.
 */
@Serializable
data class MLBF5SplitRow(
    @SerialName("team_abbr")
    @Serializable(with = F5StringOrEmptySerializer::class)
    val teamAbbr: String = "",
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val season: Int = 0,
    /** "home" | "away" */
    @SerialName("home_away")
    @Serializable(with = F5StringOrEmptySerializer::class)
    val homeAway: String = "",
    /** "R" | "L" */
    @SerialName("opp_sp_hand")
    @Serializable(with = F5StringOrEmptySerializer::class)
    val oppSpHand: String = "",
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val games: Int = 0,
    @SerialName("f5_wins")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val f5Wins: Int = 0,
    @SerialName("f5_losses")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val f5Losses: Int = 0,
    @SerialName("f5_ties")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val f5Ties: Int = 0,
    @SerialName("f5_record")
    @Serializable(with = F5StringOrDashSerializer::class)
    val f5Record: String = "-",
    @SerialName("f5_win_pct")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val f5WinPct: Double? = null,
    @SerialName("f5_overs")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val f5Overs: Int = 0,
    @SerialName("f5_unders")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val f5Unders: Int = 0,
    @SerialName("f5_pushes")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val f5Pushes: Int = 0,
    @SerialName("f5_ou_record")
    @Serializable(with = F5StringOrDashSerializer::class)
    val f5OuRecord: String = "-",
    @SerialName("f5_over_pct")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val f5OverPct: Double? = null,
    @SerialName("avg_f5_rs")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val avgF5Rs: Double? = null,
    @SerialName("avg_f5_total")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val avgF5Total: Double? = null,
    @SerialName("avg_f5_line")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val avgF5Line: Double? = null,
    @SerialName("f5_line_edge")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val f5LineEdge: Double? = null,
    @SerialName("avg_f5_ra_when_own_rhp")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val avgF5RaWhenOwnRhp: Double? = null,
    @SerialName("games_with_own_rhp")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val gamesWithOwnRhp: Int = 0,
    @SerialName("avg_f5_ra_when_own_lhp")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val avgF5RaWhenOwnLhp: Double? = null,
    @SerialName("games_with_own_lhp")
    @Serializable(with = FlexibleIntOrZeroSerializer::class)
    val gamesWithOwnLhp: Int = 0,
    @SerialName("season_avg_f5_rs")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val seasonAvgF5Rs: Double? = null,
    @SerialName("season_avg_f5_ra")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val seasonAvgF5Ra: Double? = null,
    @SerialName("season_avg_f5_total")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val seasonAvgF5Total: Double? = null,
    @SerialName("rs_diff_vs_season")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val rsDiffVsSeason: Double? = null,
    @SerialName("total_diff_vs_season")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val totalDiffVsSeason: Double? = null,
    @SerialName("ra_diff_vs_season_when_own_rhp")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val raDiffVsSeasonWhenOwnRhp: Double? = null,
    @SerialName("ra_diff_vs_season_when_own_lhp")
    @Serializable(with = PercentFlexibleDoubleSerializer::class)
    val raDiffVsSeasonWhenOwnLhp: Double? = null,
    @SerialName("last_refreshed_at")
    @Serializable(with = FlexibleStringSerializer::class)
    val lastRefreshedAt: String? = null,
)

/**
 * One game on the F5 slate, built in the store from `mlb_games_today` rows —
 * not decoded from JSON.
 */
data class MLBF5Game(
    val gamePk: Int,
    val officialDate: String,
    val gameTimeEt: String?,
    val awayTeamName: String,
    val homeTeamName: String,
    val venueName: String?,
    val awayAbbr: String,
    val homeAbbr: String,
    val awaySpName: String?,
    val homeSpName: String?,
    val awaySpHand: MLBF5PitchHand?,
    val homeSpHand: MLBF5PitchHand?,
    val totalLine: Double?,
    val f5AwayMl: Double?,
    val f5HomeMl: Double?,
    val f5TotalLine: Double?,
) {
    val id: Int get() = gamePk
}

/** Pure helpers — port of `utils/mlbF5Splits.ts`. */
object MLBF5 {
    object Sample {
        const val HIDE = 2
        const val SMALL = 10
        const val ADEQUATE = 20
    }

    /** The MV is keyed by the relocated abbreviations (`AZ`, `ATH`). */
    fun toSplitTeamAbbr(abbr: String?): String {
        val a = (abbr ?: "").trim().uppercase()
        if (a == "ARI") return "AZ"
        if (a == "OAK" || a == "LVA") return "ATH"
        return a
    }

    fun normalizePitchHand(raw: String?): MLBF5PitchHand? {
        if (raw.isNullOrEmpty()) return null
        val h = raw.trim().uppercase()
        if (h.startsWith("R")) return MLBF5PitchHand.RIGHT
        if (h.startsWith("L")) return MLBF5PitchHand.LEFT
        return null
    }

    fun splitLookupKey(teamAbbr: String, homeAway: String, oppSpHand: MLBF5PitchHand?): String? {
        if (oppSpHand == null) return null
        return "${toSplitTeamAbbr(teamAbbr)}|$homeAway|${oppSpHand.raw}"
    }

    fun buildSplitLookup(rows: List<MLBF5SplitRow>): Map<String, MLBF5SplitRow> {
        val map = mutableMapOf<String, MLBF5SplitRow>()
        for (row in rows) {
            val hand = MLBF5PitchHand.fromRaw(row.oppSpHand.uppercase())
            splitLookupKey(row.teamAbbr, row.homeAway, hand)?.let { map[it] = row }
        }
        return map
    }

    fun findSplitRow(
        lookup: Map<String, MLBF5SplitRow>,
        teamAbbr: String,
        homeAway: String,
        oppSpHand: MLBF5PitchHand?,
    ): MLBF5SplitRow? {
        val key = splitLookupKey(teamAbbr, homeAway, oppSpHand) ?: return null
        return lookup[key]
    }

    fun isShowable(games: Int?): Boolean = (games ?: 0) >= Sample.HIDE

    fun pitchHandLabel(hand: MLBF5PitchHand?): String = when (hand) {
        MLBF5PitchHand.RIGHT -> "RHP"
        MLBF5PitchHand.LEFT -> "LHP"
        null -> "unknown hand"
    }

    fun formatMoneyline(ml: Double?): String {
        if (ml == null || !ml.isFinite()) return "-"
        val i = roundAwayFromZero(ml).toInt()
        return if (i > 0) "+$i" else "$i"
    }

    fun formatPct(value: Double?): String {
        if (value == null || !value.isFinite()) return "-"
        var s = String.format(Locale.US, "%.1f", value)
        if (s.endsWith(".0")) s = s.dropLast(2)
        return "$s%"
    }

    fun formatNumber(value: Double?, digits: Int = 2): String {
        if (value == null || !value.isFinite()) return "-"
        return String.format(Locale.US, "%.${digits}f", value)
    }

    fun formatDiff(value: Double?, digits: Int = 2): String {
        if (value == null || !value.isFinite()) return "-"
        val body = String.format(Locale.US, "%.${digits}f", value)
        return if (value > 0) "+$body" else body
    }

    fun recordWithPct(row: MLBF5SplitRow?): String {
        if (row == null) return "-"
        return "${row.f5Record} (${formatPct(row.f5WinPct)})"
    }

    // Swift Double.rounded() is ties-away-from-zero; kotlin.math.round is ties-to-even.
    private fun roundAwayFromZero(v: Double): Double =
        if (v >= 0) floor(v + 0.5) else ceil(v - 0.5)
}
