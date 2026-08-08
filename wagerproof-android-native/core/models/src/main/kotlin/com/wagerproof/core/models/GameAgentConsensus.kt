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
    // No defaults on the counting fields, on purpose (mirrors the strict decode
    // in iOS `GameAgentConsensus.init(from:)`). Defaulting them made a renamed
    // RPC column indistinguishable from "no agents bet this game": every row
    // would decode as agents=0 / flagged=false and the whole feature would
    // vanish app-wide with nothing logged. Throwing instead fails the fetch,
    // which AgentConsensusStore logs and does NOT cache, so breakage is visible
    // and self-retrying.
    @SerialName("game_id") val gameId: String,
    @SerialName("game_date") val gameDate: String,
    /** Distinct public+active agents with a pick on this game, across every market. */
    val agents: Int,
    /** The single most-backed selection, verbatim (e.g. "Over 7.5"). */
    val side: String,
    /** Distinct agents on that side. */
    @SerialName("side_agents") val sideAgents: Int,
    /**
     * Raw `market_agents`: distinct agents who bet the SAME market as [side]
     * (bet_type × period). NULL only on pre-migration rows — read [marketAgents].
     */
    @SerialName("market_agents") val marketAgentsRaw: Int? = null,
    /** Raw `market_label` (e.g. "F5 run line"); read [marketLabel]. */
    @SerialName("market_label") val marketLabelRaw: String? = null,
    /**
     * `sideAgents / marketAgents`, 0–1 — NOT over [agents], which pools every
     * market on the game and so makes a plurality read as disagreement (5 of 17
     * = 29% when the run line itself was unanimous).
     * Postgres NUMERIC drifts number↔string on the wire.
     */
    @Serializable(with = FlexibleDoubleOrZeroSerializer::class)
    val agreement: Double,
    /** Agents-on-one-side needed to flag today; scales with slate volume. */
    val threshold: Int,
    /** True when the side clears both the scaled count bar and the agreement bar. */
    val flagged: Boolean,
    /** Up to 4 agents drawn from the WINNING side, for the overlap stack. */
    val avatars: List<ConsensusAvatar> = emptyList(),
) {
    val agreementPercent: Int get() = (agreement * 100).roundToInt()

    /**
     * Denominator behind [agreement] and the detail widget's bar. Falling back
     * to the whole-game count on pre-migration rows reproduces the old
     * (over-pooled) denominator rather than dividing by zero and drawing an
     * empty bar — same fallback as web's `market_agents ?? agents`.
     */
    val marketAgents: Int get() = marketAgentsRaw ?: agents

    /** Market the side belongs to, for attribution ("… betting the F5 run line"). */
    val marketLabel: String? get() = marketLabelRaw?.takeIf { it.isNotBlank() }
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
