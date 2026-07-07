package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Per-game assembly for the player-props matchups feed. Port of iOS
 * `MLBPropMatchup.swift` (mirrors the RN `PitcherMatchupSummary`, trimmed to
 * what the props surface renders): game header + both batting orders + both
 * starters' archetypes + the posted prop ladder for everyone in the game.
 *
 * Hydrated by the player-props service from a 5-way fetch:
 *   - `mlb_games_today`          schedule + starting pitchers
 *   - `mlb_game_lineups`         confirmed/projected batting orders
 *   - `v_mlb_pitcher_archetypes` season archetype per starter
 *   - `mlb_team_mapping`         abbreviation + logo
 *   - `get_mlb_player_props_l10(p_game_pk)` RPC — prop ladder + game log
 */

/** One batting-order slot — `mlb_game_lineups` row. Mirrors RN `LineupRow`. */
@Serializable
data class MLBLineupRow(
    @SerialName("game_pk") val gamePk: Int,
    @SerialName("team_id") val teamId: Int,
    @SerialName("player_id") val playerId: Int,
    @SerialName("player_name") val playerName: String,
    @SerialName("batting_order") val battingOrder: Int? = null,
    val position: String? = null,
    @SerialName("bat_side") val batSide: String? = null,
    @SerialName("is_confirmed") val isConfirmed: Boolean? = null,
) {
    val id: Int get() = playerId
}

/**
 * Season archetype profile for a starting pitcher — `v_mlb_pitcher_archetypes`
 * row. Mirrors RN `PitcherArchetypeProfile`.
 */
@Serializable
data class MLBPitcherArchetypeProfile(
    @SerialName("pitcher_id") val pitcherId: Int,
    val archetype: String,
    @SerialName("k_pct") val kPct: Double? = null,
    @SerialName("gb_pct") val gbPct: Double? = null,
    @SerialName("fb_pct") val fbPct: Double? = null,
    @SerialName("bb_pct") val bbPct: Double? = null,
    @SerialName("max_fb_velo") val maxFbVelo: Double? = null,
)

/** A starting pitcher as seen on the matchup card (resolved, display-ready). */
data class MLBPropStarter(
    val pitcherId: Int,
    val name: String,
    val teamLabel: String,
    /** "R" / "L" */
    val hand: String,
    val archetype: MLBPitcherArchetypeProfile?,
)

/** Fully-assembled props matchup for one game. Client-built, not decoded. */
data class MLBPropMatchup(
    val gamePk: Int,
    val officialDate: String,
    val gameTimeEt: String?,

    val awayTeamName: String,
    val homeTeamName: String,
    val awayAbbr: String,
    val homeAbbr: String,
    val awayLogoUrl: String?,
    val homeLogoUrl: String?,

    val awayStarter: MLBPropStarter,
    val homeStarter: MLBPropStarter,

    val awayLineup: List<MLBLineupRow>,
    val homeLineup: List<MLBLineupRow>,

    val props: List<MLBPlayerPropRow>,
) {
    val id: Int get() = gamePk

    /**
     * Day/night taken from any posted prop row (they all share the game),
     * falling back to night. Mirrors RN `playerProps[0]?.game_is_day`.
     */
    val gameIsDay: Boolean get() = props.firstOrNull()?.gameIsDay ?: false

    /** True when at least one prop is posted for this game. */
    val hasProps: Boolean get() = props.isNotEmpty()

    /**
     * Batter props for players who aren't in either posted lineup
     * (pinch hitters, bench). Mirrors RN `extraBatterGroups`.
     */
    val extraBatterGroups: List<MLBPlayerPropGroup>
        get() {
            val lineupIds = (awayLineup.map { it.playerId } + homeLineup.map { it.playerId }).toSet()
            return MLBPlayerProps.groupPropsByPlayer(props, isPitcher = false)
                .filter { it.playerId !in lineupIds }
        }

    /** Props for one batter (non-pitcher rows for that player id). */
    fun batterProps(playerId: Int): List<MLBPlayerPropRow> =
        props.filter { it.playerId == playerId && !it.isPitcher }

    /** Props for one pitcher (pitcher rows for that player id). */
    fun pitcherProps(playerId: Int): List<MLBPlayerPropRow> =
        props.filter { it.playerId == playerId && it.isPitcher }
}
