package com.wagerproof.app.features.gamewidgets

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.components.AgentAvatarChip
import com.wagerproof.app.features.agents.components.AgentAvatarStack
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.components.WidgetHeaderAccessory
import com.wagerproof.app.features.games.GameDateGrouping
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.ConsensusVerdict
import com.wagerproof.core.models.GameAgentConsensus
import com.wagerproof.core.stores.GamesStore

/** Avatars the RPC returns per game; the rest of the winning side becomes "+N". */
private const val MAX_VISIBLE = 4

/** Slate-500 when an agent has no `avatar_color` — matches the feed strip. */
private const val FALLBACK_AVATAR_COLOR = "#64748B"

/**
 * "What are the public AI agents betting on this game?" — the game-detail
 * widget. Port of iOS `GameWidgets/AgentConsensusSection.swift` and web's
 * `src/features/games/detail/sections/AgentConsensusSection.tsx`.
 * See .claude/docs/18_agent_consensus.md.
 *
 * The answer is the SIDE they agree on, not the raw count: agents bet nearly
 * every game on a slate, so a participation count says nothing on its own.
 *
 * The card states a VERDICT ([GameAgentConsensus.verdict]) and hides the
 * mechanism. It used to print "flag needs 13" — the agent-COUNT gate only —
 * while `flagged` also requires ≥55% agreement, so a card could show 18 ≥ 13
 * with its bar visibly past the tick and still not flag, contradicting itself.
 * Field size is not a bullish signal, it is the sample size that makes the
 * percentage trustworthy, so it lives in the bar legend instead.
 *
 * **The denominator is [GameAgentConsensus.marketAgents], never `agents`.**
 * `agents` pools every bet shape on the game, so a near-unanimous run line reads
 * as 29% disagreement once six other markets are counted.
 * [GameAgentConsensus.marketLabel] names the population so the card can say
 * WHICH bet they agreed on.
 *
 * Sport-agnostic on purpose: it goes FIRST in all five detail pages, above the
 * per-sport sections, exactly as web hosts it as the first child of the grid.
 */
@Composable
fun AgentConsensusSection(
    sport: GamesStore.Sport,
    gameId: String,
    gameDate: String,
    modifier: Modifier = Modifier,
) {
    val store = appGraph().agentConsensus

    // Widens the feed's existing slate coverage rather than replacing it; a
    // no-op when the games feed already loaded this date. Detail reached from
    // Search/Outliers has no feed behind it, so this is the only fetch those
    // surfaces ever make.
    LaunchedEffect(sport, gameId, gameDate) {
        if (gameId.isNotBlank() && gameDate.isNotBlank()) {
            store.ensureLoaded(sport, GameDateGrouping.dateKey(gameDate))
        }
    }

    // No agents on this game is a NORMAL state — picks land through the day, and
    // an empty card is worse than no card.
    val consensus = store.consensus(sport, gameId) ?: return
    if (consensus.agents <= 0) return

    ConsensusCard(consensus, modifier)
}

@Composable
private fun ConsensusCard(consensus: GameAgentConsensus, modifier: Modifier = Modifier) {
    WidgetCollapsingSection(
        title = "Agent Consensus",
        modifier = modifier,
        icon = AppIcon.PERSON_3_FILL,
        iconTint = AppColors.appConsensusEmerald,
        // Always present — its COLOUR is what makes a consensus game pop, not
        // its existence. "BET" is retired: it read as an instruction from the
        // app and collided with the model-signal badges the same card carries.
        accessory = WidgetHeaderAccessory.Verdict(
            verdictWord(consensus.verdict),
            verdictTint(consensus.verdict),
        ),
        headline = consensus.headline,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Web puts this in the WidgetCard shell's `subtitle` slot; the
            // collapsing shell has no such slot, so it rides under the headline.
            Text(
                "Independent picks from the public AI agents on this game.",
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                fontWeight = FontWeight.Medium,
            )

            SideRow(consensus)

            Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))

            AgreementBar(consensus)
        }
    }
}

/** Chip word. The sentences themselves live on [GameAgentConsensus]. */
internal fun verdictWord(v: ConsensusVerdict): String = when (v) {
    ConsensusVerdict.CONSENSUS -> "CONSENSUS"
    ConsensusVerdict.LEAN -> "LEAN"
    ConsensusVerdict.SPLIT -> "SPLIT"
    ConsensusVerdict.TOO_FEW -> "TOO FEW"
}

internal fun verdictTint(v: ConsensusVerdict): Color = when (v) {
    ConsensusVerdict.CONSENSUS -> AppColors.appConsensusEmerald
    ConsensusVerdict.LEAN -> AppColors.appConsensusAmber
    ConsensusVerdict.SPLIT, ConsensusVerdict.TOO_FEW -> AppColors.appTextMuted
}

// MARK: - The pick (largest thing in the card)

@Composable
private fun SideRow(c: GameAgentConsensus) {
    val direction = sideDirection(c.side)
    val chips = c.avatars.take(MAX_VISIBLE).map { avatar ->
        AgentAvatarChip(
            id = avatar.avatarId,
            spriteIndex = avatar.resolvedSpriteIndex,
            color = avatar.color?.takeIf { it.isNotBlank() } ?: FALLBACK_AVATAR_COLOR,
        )
    }
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Overflow counts against the WINNING side, not the whole game — the
        // stack is claiming "these agents are on this side".
        AgentAvatarStack(
            chips = chips,
            overflow = c.sideAgents - chips.size,
            diameter = 32.dp,
            spacing = (-8).dp,
            ringColor = AppColors.appSurfaceElevated,
            ringWidth = 2.dp,
            overflowTextSize = 10.sp,
        )

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Eyebrow(c.mostBackedLabel)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                direction?.let { dir ->
                    val icon = if (dir == SideDirection.OVER) AppIcon.ARROW_UP else AppIcon.ARROW_DOWN
                    Icon(icon.imageVector, null, tint = sideTint(dir), modifier = Modifier.size(16.dp))
                }
                // Verbatim `pick_selection`, which can run long ("Kansas City
                // Royals +160"). Two lines then ellipsis — the full selection is
                // also spelled out in the headline above.
                Text(
                    c.side,
                    color = sideTint(direction),
                    fontSize = 20.sp,
                    lineHeight = 24.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Suppressed on TOO_FEW: "50%" off a 2-agent market is theatre, and the
        // headline already says how few bet it.
        if (c.verdict != ConsensusVerdict.TOO_FEW) {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "${c.agreementPercent}%",
                    color = AppColors.appTextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    softWrap = false,
                )
                // "agree" alone never said agree with WHOM, or over which
                // population — the denominator is the agents who bet this
                // market, not everyone who bet the game.
                Eyebrow(c.sharePopulationLabel)
            }
        }
    }
}

@Composable
private fun Eyebrow(text: String) {
    Text(
        text.uppercase(),
        color = AppColors.appTextSecondary,
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.5.sp,
        maxLines = 1,
    )
}

/**
 * O/U picks carry colour + direction on the word itself. Under reads blue, not
 * red — the legacy insight-badge convention shared with `InsightVerdictLine`.
 */
private enum class SideDirection { OVER, UNDER }

private fun sideDirection(side: String): SideDirection? {
    val s = side.trim().lowercase()
    return when {
        s.startsWith("over") -> SideDirection.OVER
        s.startsWith("under") -> SideDirection.UNDER
        else -> null
    }
}

private fun sideTint(direction: SideDirection?): Color = when (direction) {
    SideDirection.OVER -> AppColors.appConsensusEmerald
    SideDirection.UNDER -> Color(0xFF3B82F6)
    null -> AppColors.appTextPrimary
}

// MARK: - Agreement bar

/**
 * The market split as ONE divided bar: leader · runner-up · everyone else. The
 * old single fill drew the other 49% as an unlabelled grey remainder, which made
 * a coin flip read as a lean.
 *
 * Every segment is scaled over `marketAgents` — the same denominator the server
 * used for `agreement`, so the bar and the percentage can never disagree.
 */
@Composable
private fun AgreementBar(c: GameAgentConsensus) {
    val fractions = consensusBarFractions(c)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val trackColor = AppColors.appTextMuted.copy(alpha = 0.15f)
        val leaderColor =
            if (c.flagged) AppColors.appConsensusEmerald else AppColors.appTextPrimary.copy(alpha = 0.55f)
        val runnerUpColor = AppColors.appTextMuted.copy(alpha = 0.45f)
        val otherColor = AppColors.appTextMuted.copy(alpha = 0.20f)
        Canvas(Modifier.fillMaxWidth().height(10.dp)) {
            val radius = CornerRadius(size.height / 2f, size.height / 2f)
            drawRoundRect(color = trackColor, cornerRadius = radius)
            // A 1.5dp hairline between segments so two adjacent greys still read
            // as two groups rather than one long bar.
            val gap = 1.5.dp.toPx()
            var x = 0f
            listOf(
                fractions.side to leaderColor,
                fractions.runnerUp to runnerUpColor,
                fractions.other to otherColor,
            ).forEach { (fraction, color) ->
                val width = size.width * fraction
                if (width <= 0f) return@forEach
                drawRoundRect(
                    color = color,
                    topLeft = Offset(x, 0f),
                    size = Size((width - gap).coerceAtLeast(1f), size.height),
                    cornerRadius = radius,
                )
                x += width
            }
        }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            // The rank caption carries no weight, so it measures at its intrinsic
            // width first and the legend truncates into whatever is left — never
            // the other way round.
            Text(
                // Named counts, so the percentage has a visible numerator AND a
                // visible denominator instead of one bar and a bare number.
                c.barLegend.joinToString(" · "),
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            c.slateRankLabel?.let { rank ->
                Spacer(Modifier.width(8.dp))
                // Replaces "flag needs N". Reading 51% against today's board is
                // what makes it mean anything; the gate behind the verdict is
                // deliberately not shown.
                Text(
                    rank,
                    color = AppColors.appTextSecondary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    softWrap = false,
                )
            }
        }
    }
}

internal data class ConsensusBarFractions(val side: Float, val runnerUp: Float, val other: Float)

/**
 * Bar geometry, extracted so it can be unit-tested. Guards the zero denominator
 * a pre-migration row with no agents would produce, and clamps each segment to
 * what the earlier ones left so rounding can never overflow the track.
 */
internal fun consensusBarFractions(c: GameAgentConsensus): ConsensusBarFractions {
    val denominator = c.marketAgents
    if (denominator <= 0) return ConsensusBarFractions(0f, 0f, 0f)
    val side = (c.sideAgents.toFloat() / denominator).coerceIn(0f, 1f)
    val runnerUp = ((c.runnerUpAgents ?: 0).toFloat() / denominator).coerceIn(0f, 1f - side)
    val other = (c.otherAgents.toFloat() / denominator).coerceIn(0f, 1f - side - runnerUp)
    return ConsensusBarFractions(side, runnerUp, other)
}
