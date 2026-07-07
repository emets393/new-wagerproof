package com.wagerproof.app.features.cfb

import com.wagerproof.core.models.serialization.FlexibleDoubleSerializer
import com.wagerproof.core.models.serialization.FlexibleIntOrZeroSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `cfb_team_trends` aggregate row (season 2025 hardcoded). Mirrors the Swift
 * `CFBTeamTrendRow`. Numerics go through flexible serializers to tolerate the
 * table's mixed Int|String|Double column types.
 */
@Serializable
data class CFBTeamTrendRow(
    @SerialName("team_name") val teamName: String,
    val season: Int? = null,
    @SerialName("through_week") val throughWeek: Int? = null,
    @Serializable(with = FlexibleIntOrZeroSerializer::class) val games: Int = 0,
    @SerialName("su_w") @Serializable(with = FlexibleIntOrZeroSerializer::class) val suW: Int = 0,
    @SerialName("su_l") @Serializable(with = FlexibleIntOrZeroSerializer::class) val suL: Int = 0,
    @SerialName("su_record") val suRecord: String = "",
    @SerialName("ats_w") @Serializable(with = FlexibleIntOrZeroSerializer::class) val atsW: Int = 0,
    @SerialName("ats_l") @Serializable(with = FlexibleIntOrZeroSerializer::class) val atsL: Int = 0,
    @SerialName("ats_p") @Serializable(with = FlexibleIntOrZeroSerializer::class) val atsP: Int = 0,
    @SerialName("ats_pct") @Serializable(with = FlexibleDoubleSerializer::class) val atsPct: Double? = null,
    @SerialName("ou_o") @Serializable(with = FlexibleIntOrZeroSerializer::class) val ouO: Int = 0,
    @SerialName("ou_u") @Serializable(with = FlexibleIntOrZeroSerializer::class) val ouU: Int = 0,
    @SerialName("ou_p") @Serializable(with = FlexibleIntOrZeroSerializer::class) val ouP: Int = 0,
    @SerialName("over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val overPct: Double? = null,
    @SerialName("tt_o") @Serializable(with = FlexibleIntOrZeroSerializer::class) val ttO: Int = 0,
    @SerialName("tt_u") @Serializable(with = FlexibleIntOrZeroSerializer::class) val ttU: Int = 0,
    @SerialName("tt_games") @Serializable(with = FlexibleIntOrZeroSerializer::class) val ttGames: Int = 0,
    @SerialName("tt_over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val ttOverPct: Double? = null,
    @SerialName("h1_ats_w") @Serializable(with = FlexibleIntOrZeroSerializer::class) val h1AtsW: Int = 0,
    @SerialName("h1_ats_l") @Serializable(with = FlexibleIntOrZeroSerializer::class) val h1AtsL: Int = 0,
    @SerialName("h1_ats_p") @Serializable(with = FlexibleIntOrZeroSerializer::class) val h1AtsP: Int = 0,
    @SerialName("h1_ats_pct") @Serializable(with = FlexibleDoubleSerializer::class) val h1AtsPct: Double? = null,
    @SerialName("h1_ou_o") @Serializable(with = FlexibleIntOrZeroSerializer::class) val h1OuO: Int = 0,
    @SerialName("h1_ou_u") @Serializable(with = FlexibleIntOrZeroSerializer::class) val h1OuU: Int = 0,
    @SerialName("h1_over_pct") @Serializable(with = FlexibleDoubleSerializer::class) val h1OverPct: Double? = null,
    @SerialName("last5_su") val last5Su: List<String> = emptyList(),
    @SerialName("last5_ats") val last5Ats: List<String> = emptyList(),
    @SerialName("last5_ou") val last5Ou: List<String> = emptyList(),
    @SerialName("game_log") val gameLog: List<CFBTeamTrendGameLog> = emptyList(),
) {
    val last5Logs: List<CFBTeamTrendGameLog> get() = gameLog.take(5)

    val sampleLabel: String
        get() = if (throughWeek != null) "$games games · thru W$throughWeek" else "$games games"
}

/** One row of a team's `game_log` jsonb — all fields optional per market kind. */
@Serializable
data class CFBTeamTrendGameLog(
    val week: Int? = null,
    val date: String? = null,
    val opp: String? = null,
    @SerialName("is_home") val isHome: Boolean? = null,
    @SerialName("neutral_site") val neutralSite: Boolean? = null,
    @SerialName("pts_for") val ptsFor: Int? = null,
    @SerialName("pts_against") val ptsAgainst: Int? = null,
    val su: String? = null,
    val spread: Double? = null,
    val ats: String? = null,
    @SerialName("cover_margin") val coverMargin: Double? = null,
    val total: Double? = null,
    val ou: String? = null,
    @SerialName("total_points") val totalPoints: Int? = null,
    @SerialName("ou_margin") val ouMargin: Double? = null,
    @SerialName("tt_line") val ttLine: Double? = null,
    val tt: String? = null,
    @SerialName("team_pts") val teamPts: Int? = null,
    @SerialName("tt_margin") val ttMargin: Double? = null,
    @SerialName("h1_spread") val h1Spread: Double? = null,
    @SerialName("h1_ats") val h1Ats: String? = null,
    @SerialName("h1_cover_margin") val h1CoverMargin: Double? = null,
    @SerialName("h1_total") val h1Total: Double? = null,
    @SerialName("h1_ou") val h1Ou: String? = null,
    @SerialName("h1_ou_margin") val h1OuMargin: Double? = null,
)
