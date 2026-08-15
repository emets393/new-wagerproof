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
    /**
     * Agents-on-one-side needed to flag today; scales with slate volume.
     * Internal plumbing — never render it. It is only ONE of the two gates
     * behind [flagged], and printing it made the card claim the bar was cleared
     * when the agreement gate was what failed. See [verdict].
     */
    val threshold: Int,
    /** True when the side clears both the scaled count bar and the agreement bar. */
    val flagged: Boolean,
    /**
     * The SECOND-most-backed selection in the same market as [side], verbatim.
     * Null when the market was unanimous, or when the deployed RPC predates the
     * runner-up migration — hence the default, unlike the counting fields above:
     * a client shipped ahead of that migration must still render the card.
     * NOT "the other side": `pick_selection` is unnormalized, so one market can
     * hold more than two distinct strings.
     */
    @SerialName("runner_up_side") val runnerUpSide: String? = null,
    /** Distinct agents on [runnerUpSide]. */
    @SerialName("runner_up_agents") val runnerUpAgents: Int? = null,
    /**
     * Where this game ranks on its own date by agreement (1 = strongest),
     * flagged games first. Null on pre-migration rows.
     */
    @SerialName("slate_rank") val slateRank: Int? = null,
    /** Games on that date with at least one agent pick — the rank's denominator. */
    @SerialName("slate_games") val slateGames: Int? = null,
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

    /**
     * What the card actually claims. A percentage alone makes the reader do the
     * judging, and most of a slate is noise — see the calibration in
     * .claude/docs/18_agent_consensus.md.
     */
    val verdict: ConsensusVerdict
        get() = when {
            marketAgents < MIN_MEANINGFUL_MARKET -> ConsensusVerdict.TOO_FEW
            flagged -> ConsensusVerdict.CONSENSUS
            agreement >= LEAN_SHARE -> ConsensusVerdict.LEAN
            else -> ConsensusVerdict.SPLIT
        }

    private fun agentsWord(n: Int) = if (n == 1) "agent" else "agents"

    /**
     * One sentence, verdict first, answering "what do the agents think?".
     * Deliberately quotes no threshold: the user is told the conclusion, not the
     * rule that produced it.
     *
     * With no [marketLabel] every sentence drops its market clause rather than
     * falling back to the word "side", which would imply a two-way market that
     * may not exist (alt lines and odds-suffixed selections share one market).
     */
    val headline: String
        get() {
            val m = marketLabel
            return when (verdict) {
                ConsensusVerdict.CONSENSUS ->
                    if (m != null) "Agents are on $side — $sideAgents of the $marketAgents betting the $m."
                    else "Agents are on $side — $sideAgents of $marketAgents agents."
                ConsensusVerdict.LEAN ->
                    if (m != null) "Agents lean $side, but only $marketAgents bet the $m."
                    else "Agents lean $side, but only $marketAgents agents bet it."
                ConsensusVerdict.SPLIT ->
                    if (m != null) "Agents are split on the $m — $side leads with $sideAgents of $marketAgents."
                    else "Agents are split — $side leads with $sideAgents of $marketAgents agents."
                ConsensusVerdict.TOO_FEW -> {
                    val noun = agentsWord(marketAgents)
                    if (m != null) "Only $marketAgents $noun bet the $m on this game."
                    else "Only $marketAgents $noun bet this game."
                }
            }
        }

    /**
     * The label under the big percentage. Replaces a bare "agree", which never
     * said agree with WHOM or over which population — the denominator is the
     * agents who bet this market, not everyone who bet the game.
     */
    val sharePopulationLabel: String
        get() = marketLabel?.let { "of $it bets" } ?: "of agent bets"

    val mostBackedLabel: String
        get() = marketLabel?.let { "Most-backed $it" } ?: "Most backed"

    /**
     * Feed-strip line. Carries the denominator, which the old strip omitted
     * entirely ("39 agents on OVER 7.5" over an invisible base).
     */
    val leaderLine: String get() = "$sideAgents of $marketAgents on $side"

    /** Agents in this market on neither the leader nor the runner-up. */
    val otherAgents: Int
        get() = (marketAgents - sideAgents - (runnerUpAgents ?: 0)).coerceAtLeast(0)

    /** Legend beneath the divided bar, one entry per real group. */
    val barLegend: List<String>
        get() {
            if (marketAgents <= 0) return emptyList()
            if (sideAgents >= marketAgents) return listOf("$sideAgents $side", "unanimous")
            val parts = mutableListOf("$sideAgents $side")
            val runnerUp = runnerUpSide
            val runnerUpCount = runnerUpAgents ?: 0
            if (runnerUp != null && runnerUpCount > 0) parts.add("$runnerUpCount $runnerUp")
            if (otherAgents > 0) parts.add("$otherAgents other")
            return parts
        }

    /**
     * "#3 of 14 today" — turns an abstract 51% into a comparison against the
     * board the user is looking at. Absent on pre-migration rows.
     */
    val slateRankLabel: String?
        get() {
            val rank = slateRank ?: return null
            val games = slateGames ?: return null
            return if (games > 1) "#$rank of $games today" else null
        }

    private companion object {
        /**
         * Mirrors the RPC's `p_min_share` default. Duplicated here ONLY to tell
         * LEAN from SPLIT — [flagged] is always the server's call and is never
         * recomputed. If the SQL default moves, move this with it.
         */
        const val LEAN_SHARE = 0.55

        /** Below this a percentage is theatre: 1 of 2 is "50%" and means nothing. */
        const val MIN_MEANINGFUL_MARKET = 3
    }
}

/** @see GameAgentConsensus.verdict */
enum class ConsensusVerdict { CONSENSUS, LEAN, SPLIT, TOO_FEW }

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
