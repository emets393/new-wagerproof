package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.AgentAvatarChip
import com.wagerproof.app.features.agents.components.AgentAvatarStack
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.GameAgentConsensus

/** Avatars the RPC returns per game; the rest of the side becomes "+N". */
private const val MAX_VISIBLE = 4

/** Slate-500 when an agent has no `avatar_color` — matches the web strip. */
private const val FALLBACK_AVATAR_COLOR = "#64748B"

/**
 * Agent-consensus row on a game card. Three tiers, all decided server-side
 * (see .claude/docs/18_agent_consensus.md):
 *
 *   flagged → emerald strip: avatar stack · "39 agents on OVER 7.5" · "100% agree" · BET
 *   agents  → muted inline stack + bare count, no colour and no claim
 *   none    → renders nothing
 *
 * The agent count alone is deliberately NOT enough to earn the flag: agents bet
 * nearly every game, so participation would flag ~96% of a slate. Only
 * agreement turns the strip green.
 *
 * This is its own row, never merged into the slate-pick pills: those are *model*
 * signals and BET is a *crowd* signal, so one wrap group would imply the model
 * and the agents agree. Flattening that bottom row is also what previously blew
 * cards up to ~300dp tall.
 */
@Composable
fun AgentConsensusStrip(consensus: GameAgentConsensus, modifier: Modifier = Modifier) {
    if (consensus.agents <= 0) return

    val visible = consensus.avatars.take(MAX_VISIBLE)
    val chips = visible.map { avatar ->
        AgentAvatarChip(
            id = avatar.avatarId,
            // Agents are pixel people everywhere; `color` is only the halo tint.
            spriteIndex = avatar.resolvedSpriteIndex,
            color = avatar.color?.takeIf { it.isNotBlank() } ?: FALLBACK_AVATAR_COLOR,
        )
    }

    if (!consensus.flagged) {
        UnflaggedRow(consensus, chips, visible.size, modifier)
    } else {
        FlaggedStrip(consensus, chips, visible.size, modifier)
    }
}

/** Tier 1: participation only. Count is stated, no side is claimed. */
@Composable
private fun UnflaggedRow(
    consensus: GameAgentConsensus,
    chips: List<AgentAvatarChip>,
    visibleCount: Int,
    modifier: Modifier = Modifier,
) {
    val label = if (consensus.agents == 1) "1 agent" else "${consensus.agents} agents"
    Row(
        modifier
            .fillMaxWidth()
            .padding(top = 6.dp)
            .semantics { contentDescription = "$label with a pick on this game" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        AgentAvatarStack(
            chips = chips,
            overflow = consensus.agents - visibleCount,
            diameter = 18.dp,
            spacing = (-6).dp,
            // Ring in the card surface so the discs read as cut into the card.
            ringColor = AppColors.appSurfaceElevated,
            ringWidth = 1.5.dp,
            overflowTextSize = 7.sp,
        )
        Text(
            label,
            color = AppColors.appTextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** Tier 2: the rare strong-agreement game — the only tier that gets colour. */
@Composable
private fun FlaggedStrip(
    consensus: GameAgentConsensus,
    chips: List<AgentAvatarChip>,
    visibleCount: Int,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    val agentsWord = if (consensus.sideAgents == 1) "agent" else "agents"
    val side = consensus.side.uppercase()

    val claim = buildAnnotatedString {
        append("${consensus.sideAgents} $agentsWord on ")
        withStyle(SpanStyle(fontWeight = FontWeight.Black)) { append(side) }
    }

    Row(
        modifier
            .fillMaxWidth()
            .padding(top = 6.dp)
            .clip(shape)
            .background(AppColors.appConsensusEmerald.copy(alpha = 0.10f))
            .border(1.dp, AppColors.appConsensusEmerald.copy(alpha = 0.30f), shape)
            .padding(horizontal = 8.dp, vertical = 6.dp)
            .semantics {
                contentDescription =
                    "${consensus.sideAgents} $agentsWord on $side, ${consensus.agreementPercent} percent agree. Bet flag"
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        AgentAvatarStack(
            chips = chips,
            // Overflow counts the WINNING side only, so the faces and the number
            // both describe the same claim.
            overflow = consensus.sideAgents - visibleCount,
            diameter = 18.dp,
            spacing = (-6).dp,
            ringColor = AppColors.appConsensusEmeraldDeep,
            ringWidth = 1.5.dp,
            overflowTextSize = 7.sp,
        )
        // Two Texts, not one AnnotatedString: the side is a verbatim
        // `pick_selection` and can run long ("PITTSBURGH PIRATES F5 -0.5"), and
        // in a single line-limited string the ellipsis eats the agreement
        // percentage — the one number the green strip exists to justify. The
        // percentage carries no weight so the Row measures it at its intrinsic
        // width first; the claim then truncates into whatever is left.
        Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(
                claim,
                color = AppColors.appConsensusEmeraldText,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            Text(
                "${consensus.agreementPercent}% agree",
                color = AppColors.appConsensusEmeraldText.copy(alpha = 0.7f),
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                softWrap = false,
            )
        }
        BetBadge()
    }
}

@Composable
private fun BetBadge() {
    Row(
        Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(AppColors.appConsensusEmerald)
            .padding(horizontal = 6.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.size(5.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.9f)))
        Text(
            "BET",
            color = Color.White,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.6.sp,
            maxLines = 1,
            softWrap = false,
        )
    }
}
