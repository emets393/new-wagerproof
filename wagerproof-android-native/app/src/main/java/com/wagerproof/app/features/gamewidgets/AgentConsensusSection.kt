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
 * That's why the card leads with agreement and ticks the flag threshold on its
 * bar — "how close was this to a BET flag" is the actual question.
 *
 * **The denominator is [GameAgentConsensus.marketAgents], never `agents`.**
 * `agents` pools every bet shape on the game, so a near-unanimous run line reads
 * as 29% disagreement once six other markets are counted. iOS's own widget still
 * divides by `agents` and disagrees with the percentage the server sent; do not
 * copy that. [GameAgentConsensus.marketLabel] names the population so the card
 * can say WHICH bet they agreed on.
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
        // The shared verdict capsule stands in for web's solid emerald "Bet"
        // pill — same slot, same word, in this app's accessory language so it
        // can't drift from every other widget's badge.
        accessory = if (consensus.flagged) {
            WidgetHeaderAccessory.Verdict("BET", AppColors.appConsensusEmerald)
        } else {
            WidgetHeaderAccessory.None
        },
        headline = consensusHeadline(consensus),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Web puts this in the WidgetCard shell's `subtitle` slot; the
            // collapsing shell has no such slot, so it rides under the headline.
            Text(
                "What the public AI agents bet on this game, and how much they agree.",
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

/**
 * Headline sentence. Both branches state the market-scoped fraction so the
 * percentage next to it is always reproducible from the words.
 */
internal fun consensusHeadline(c: GameAgentConsensus): String {
    val inMarket = c.marketLabel?.let { " betting the $it" } ?: ""
    val pct = c.agreementPercent
    return if (c.flagged) {
        "${c.sideAgents} of ${c.marketAgents} agents$inMarket are on ${c.side} — $pct% agreement."
    } else {
        "The most-backed side is ${c.side}: ${c.sideAgents} of ${c.marketAgents} agents$inMarket, $pct% agreement."
    }
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
            Eyebrow(c.marketLabel?.let { "Most-backed $it" } ?: "Most-backed side")
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

        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "${c.agreementPercent}%",
                color = AppColors.appTextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                softWrap = false,
            )
            Eyebrow("agree")
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
 * One divided bar with the flag threshold ticked, so "how close was this to
 * earning a BET flag" is readable without a second sentence. Both the fill and
 * the tick are scaled over `marketAgents` — the same denominator the server used
 * for `agreement`, so the bar and the percentage can never disagree.
 */
@Composable
private fun AgreementBar(c: GameAgentConsensus) {
    val fractions = consensusBarFractions(c)
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val trackColor = AppColors.appTextMuted.copy(alpha = 0.18f)
        val fillColor = if (c.flagged) AppColors.appConsensusEmerald else AppColors.appTextMuted.copy(alpha = 0.5f)
        val tickColor = AppColors.appTextPrimary.copy(alpha = 0.45f)
        Canvas(Modifier.fillMaxWidth().height(10.dp)) {
            val radius = CornerRadius(size.height / 2f, size.height / 2f)
            drawRoundRect(color = trackColor, cornerRadius = radius)
            val fillWidth = size.width * fractions.side
            if (fillWidth > 0f) {
                drawRoundRect(
                    color = fillColor,
                    size = Size(fillWidth.coerceAtLeast(size.height), size.height),
                    cornerRadius = radius,
                )
            }
            if (fractions.threshold > 0f && fractions.threshold < 1f) {
                val tickWidth = 2.dp.toPx()
                drawRect(
                    color = tickColor,
                    topLeft = Offset((size.width * fractions.threshold).coerceAtMost(size.width - tickWidth), 0f),
                    size = Size(tickWidth, size.height),
                )
            }
        }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            // The flag caption carries no weight, so it measures at its
            // intrinsic width first and the denominator caption truncates into
            // whatever is left — never the other way round.
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${c.sideAgents}",
                    color = AppColors.appTextPrimary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "of ${c.marketAgents} agents" + (c.marketLabel?.let { " betting the $it" } ?: ""),
                    color = AppColors.appTextSecondary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                if (c.flagged) "flag needs ${c.threshold} · cleared" else "flag needs ${c.threshold}",
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                softWrap = false,
            )
        }
    }
}

internal data class ConsensusBarFractions(val side: Float, val threshold: Float)

/**
 * Bar geometry, extracted so it can be unit-tested. Guards the zero
 * denominator that a pre-migration row with no agents would produce.
 */
internal fun consensusBarFractions(c: GameAgentConsensus): ConsensusBarFractions {
    val denominator = c.marketAgents
    if (denominator <= 0) return ConsensusBarFractions(0f, 0f)
    return ConsensusBarFractions(
        side = (c.sideAgents.toFloat() / denominator).coerceIn(0f, 1f),
        threshold = (c.threshold.toFloat() / denominator).coerceIn(0f, 1f),
    )
}
