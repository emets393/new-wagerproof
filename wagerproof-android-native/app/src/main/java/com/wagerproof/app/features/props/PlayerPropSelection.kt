package com.wagerproof.app.features.props

import com.wagerproof.core.models.MLBPlayerPropRow

/**
 * Navigation payload for the MLB player-prop detail. Carries everything
 * `PlayerPropDetailScreen` needs so the detail page is self-contained (no
 * re-fetch): the player's full prop ladder set, the matchup context (opposing
 * starter + archetype) the splits annotate, plus the team/opponent identity the
 * hero renders. Port of iOS `PlayerPropSelection.swift`.
 */
data class PlayerPropSelection(
    val playerId: Int,
    val playerName: String,
    val isPitcher: Boolean,
    val position: String?,
    val batSide: String?,

    // Team identity (hero aura + headshot glow + "vs OPP").
    val teamName: String,
    val teamAbbr: String,
    val teamLogoUrl: String?,
    val opponentName: String,
    val opponentAbbr: String,

    // Matchup context.
    val opposingStarterName: String,
    val opposingStarterHand: String,
    val opposingArchetypeName: String?,
    val gameTimeEt: String?,
    val officialDate: String,
    val gamePk: Int,
    /** When set, the detail page opens on this market (feed market filter). */
    val preferredMarket: String?,

    /** The player's prop rows (one per market), already filtered to this player + role. */
    val props: List<MLBPlayerPropRow>,
    /** Source id for the card→detail transition. */
    val transitionID: String,
) {
    val id: String get() = transitionID

    /** Day/night for today's game (all the player's rows share it). */
    val gameIsDay: Boolean get() = props.firstOrNull()?.gameIsDay ?: false
}
