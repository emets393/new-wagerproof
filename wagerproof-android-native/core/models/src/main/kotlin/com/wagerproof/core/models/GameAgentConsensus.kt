package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FlexibleDoubleOrZeroSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

/**
 * Public-agent betting consensus for one game on the /games feed — the
 * "N agents on <side>" row and the rare green BET flag.
 * See .claude/docs/18_agent_consensus.md.
 *
 * Rows come from the `get_game_agent_consensus` RPC on the MAIN project;
 * `avatar_picks` is RLS-gated so there is no table-select path (see
 * `AgentConsensusService`).
 */
@Serializable
data class GameAgentConsensus(
    @SerialName("game_id") val gameId: String = "",
    @SerialName("game_date") val gameDate: String = "",
    /** Distinct public+active agents with a pick on this game. */
    val agents: Int = 0,
    /** The single most-backed selection, verbatim (e.g. "Over 7.5"). */
    val side: String = "",
    /** Distinct agents on that side. */
    @SerialName("side_agents") val sideAgents: Int = 0,
    /** sideAgents / agents, 0–1. Postgres NUMERIC drifts number↔string on the wire. */
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val agreement: Double = 0.0,
    /** Agents-on-one-side needed to flag today; scales with slate volume. */
    val threshold: Int = 0,
    /** True when the side clears both the scaled count bar and the agreement bar. */
    val flagged: Boolean = false,
    /** Up to 4 agents drawn from the WINNING side, for the overlap stack. */
    val avatars: List<ConsensusAvatar> = emptyList(),
) {
    val agreementPercent: Int get() = (agreement * 100).roundToInt()
}

/**
 * One agent in the consensus overlap stack. `color` is either a hex string
 * ("#6366f1") or a gradient pair ("gradient:#aaa,#bbb") — the same shape as
 * `avatar_profiles.avatar_color` everywhere else in the app. It tints the halo
 * behind the pixel character; agents are never drawn as an emoji.
 *
 * Keys are camelCase because the RPC builds this blob with `jsonb_build_object`,
 * not from column names.
 */
@Serializable
data class ConsensusAvatar(
    val avatarId: String = "",
    val name: String = "Agent",
    /** Raw `avatar_profiles.sprite_index` — NULL for ~96% of agents, never 0-coalesced. */
    val spriteIndex: Int? = null,
    val color: String? = null,
) {
    /**
     * The pixel-office character to draw. Owner override wins; otherwise the
     * FNV-1a hash of the id, identical to [Agent.spriteIndex]. Coalescing a null
     * override to 0 would paint nearly every stack as four clones of avatar_0
     * AND disagree with the same agent's face elsewhere in the app.
     */
    val resolvedSpriteIndex: Int
        get() = spriteIndex?.takeIf { it in 0..7 } ?: AgentSpriteIndex.forSeed(avatarId)
}
