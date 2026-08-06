package com.wagerproof.app.features.agents.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.wagerproof.app.features.agents.AgentTicketGeometry

/**
 * Fanned deck of blank pick-ticket scaffolds shown while a generation run polls —
 * port of iOS `ToolActivityStack.swift`. Every cumulative tool call the agent
 * makes deals one more [AgentPickMiniTicketSkeleton] into the fan, so a stalled
 * run visibly stops dealing while a healthy one keeps growing.
 *
 * Layout contract (matches iOS):
 *   - Left-aligned; the first (oldest) ticket sits at the leading edge and is
 *     FRONTMOST, newer ones fan out behind it to the right.
 *   - Grows at [TOOL_STACK_IDEAL_PEEK] until the fan reaches the trailing edge, then tightens
 *     the overlap to exactly fill the width, never below [TOOL_STACK_MIN_PEEK].
 *   - Even coloring: depth reads from stacking order alone, no dimming/scaling.
 */
@Composable
fun ToolActivityStack(
    count: Int,
    /** Kept for call-site compatibility (iOS `ToolActivityStack.accent`) — the skeleton cardstock is neutral. */
    accent: Color = Color.Unspecified,
    modifier: Modifier = Modifier,
) {
    val cardW = AgentTicketGeometry.MINI_WIDTH
    val cardH = AgentTicketGeometry.MINI_HEIGHT
    val targetIndices = toolActivityVisibleIndices(count)
    // Tickets currently mounted, including ones fading OUT after falling off
    // the 7-card window — a plain list-diff would pop them instantly (iOS fades).
    val mounted = remember { mutableStateListOf<Int>() }
    for (idx in targetIndices) if (idx !in mounted) mounted.add(idx)

    // Reserve a stable footprint even at count == 0 so the status line below
    // never jumps as the first ticket deals in.
    BoxWithConstraints(
        modifier = modifier.height(cardH + 10.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (mounted.isEmpty()) return@BoxWithConstraints
        val peek = toolActivityPeek(
            visibleCount = targetIndices.size,
            containerWidth = maxWidth,
            cardWidth = cardW,
        )
        val first = targetIndices.firstOrNull() ?: mounted.min()
        mounted.sorted().forEach { idx ->
            // Absolute tool-call identity matters once the seven-card window
            // starts sliding. Positional nodes made calls 8+ look completely
            // static because every slot retained the same offset state.
            key(idx) {
                // A ticket still finishing its fade-out after falling off the front of the
                // sliding window has idx < first, i.e. a negative pos — clamped to 0 so it
                // settles at the leading edge instead of flying left over the deck with an
                // out-of-range zIndex above every visible card.
                val pos = (idx - first).coerceAtLeast(0) // 0 = leading / frontmost
                // Animate the x-offset so retained tickets visibly make room
                // for the newly dealt trailing card.
                val x by animateDpAsState(
                    targetValue = peek * pos,
                    animationSpec = spring(dampingRatio = 0.82f, stiffness = Spring.StiffnessMediumLow),
                    label = "toolTicketOffset-$idx",
                )
                // Deal-in from the trailing edge + fade; fade-out on removal —
                // port of iOS's `.transition(.asymmetric(insertion: .move(edge:
                // .trailing).combined(with: .opacity), removal: .opacity))`.
                val visibleState = remember { MutableTransitionState(false) }
                visibleState.targetState = idx in targetIndices
                if (!visibleState.currentState && !visibleState.targetState) {
                    mounted.remove(idx)
                }
                AnimatedVisibility(
                    visibleState = visibleState,
                    enter = fadeIn(tween(220)) + slideInHorizontally(tween(220)) { it / 3 },
                    exit = fadeOut(tween(180)),
                    modifier = Modifier.zIndex((TOOL_STACK_MAX_VISIBLE - pos).toFloat()).offset(x = x),
                ) {
                    AgentPickMiniTicketSkeleton(
                        modifier = Modifier.shadow(
                            elevation = 9.dp,
                            shape = RoundedCornerShape(AgentTicketGeometry.MINI_CORNER),
                            ambientColor = Color.Black.copy(alpha = 0.55f),
                            spotColor = Color.Black.copy(alpha = 0.55f),
                        ),
                    )
                }
            }
        }
    }
}

/** How many scaffolds render at once before the oldest fall off the front. */
internal const val TOOL_STACK_MAX_VISIBLE = 7

/** Comfortable peek while the deck is still growing. */
internal val TOOL_STACK_IDEAL_PEEK = 96.dp

/** Never overlap tighter than this, so every ticket keeps a readable sliver. */
internal val TOOL_STACK_MIN_PEEK = 28.dp

/**
 * The window of ticket indices currently on screen: the newest [TOOL_STACK_MAX_VISIBLE]
 * of [count]. Empty when nothing has been dealt yet.
 */
internal fun toolActivityVisibleIndices(count: Int, maxVisible: Int = TOOL_STACK_MAX_VISIBLE): List<Int> {
    if (count <= 0) return emptyList()
    val lower = maxOf(0, count - maxVisible)
    return (lower until count).toList()
}

/**
 * Horizontal step between fanned tickets. Grows at [TOOL_STACK_IDEAL_PEEK] until the last
 * ticket's trailing edge would leave the container, then clamps to exactly fill
 * the available travel, with [TOOL_STACK_MIN_PEEK] as the floor.
 */
internal fun toolActivityPeek(
    visibleCount: Int,
    containerWidth: Dp,
    cardWidth: Dp,
    idealPeek: Dp = TOOL_STACK_IDEAL_PEEK,
    minPeek: Dp = TOOL_STACK_MIN_PEEK,
): Dp {
    if (visibleCount <= 1) return 0.dp
    val travel = (containerWidth - cardWidth).coerceAtLeast(0.dp)
    val fillPeek = travel / (visibleCount - 1)
    return maxOf(minPeek, minOf(idealPeek, fillPeek))
}
