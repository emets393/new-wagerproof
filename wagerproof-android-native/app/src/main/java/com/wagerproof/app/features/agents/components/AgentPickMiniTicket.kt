package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.agents.iconVector
import com.wagerproof.app.features.agents.ticketColor
import com.wagerproof.app.features.agents.ticketLabel
import com.wagerproof.app.features.components.WidgetCard
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentParlay
import com.wagerproof.core.models.AgentPick

// =====================================================================
// AgentPickMiniTicket — the miniaturized boarding-pass ticket + Today's
// Picks rail + skeletons + locked rail. Port of iOS AgentPickMiniTicket.swift.
// Fixed 178x240 footprint (notch 116) so a day's picks ride in a rail.
// =====================================================================

private val MINI_WIDTH = 178.dp
private val MINI_HEIGHT = 240.dp
private val MINI_NOTCH_Y = 116.dp

@Composable
fun AgentPickMiniTicket(
    pick: AgentPick,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
) {
    Column(
        modifier = modifier
            .size(MINI_WIDTH, MINI_HEIGHT)
            .miniTicketCardstock(MINI_NOTCH_Y),
    ) {
        // Top — sport tag, status/confidence, route line.
        Box(Modifier.fillMaxWidth().height(MINI_NOTCH_Y)) {
            Column(
                Modifier.fillMaxSize().padding(horizontal = 14.dp).padding(top = 12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(pick.sport.iconVector(), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(9.dp))
                        Text(pick.sport.raw.uppercase(), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        PickTicketFormat.gameDate(pick.gameDate),
                        color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                    )
                    Spacer(Modifier.width(6.dp))
                    MiniStatusCorner(
                        isPending = pick.result == AgentPick.PickResultStatus.PENDING,
                        confidence = pick.confidence,
                        statusLabel = pick.result.ticketLabel,
                        statusColor = pick.result.ticketColor,
                        accent = accent,
                    )
                }
                Spacer(Modifier.weight(1f))
                PickRouteLineRow(pick = pick, codeSize = 18.dp, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.weight(1f))
            }
            DashLine(
                color = Color.White.copy(alpha = 0.16f),
                dash = floatArrayOf(4f, 4f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).height(1.dp).align(Alignment.BottomCenter),
            )
        }
        // Bottom — selection + stamps + reasoning snippet.
        Column(
            Modifier
                .fillMaxWidth().height(MINI_HEIGHT - MINI_NOTCH_Y)
                .padding(horizontal = 14.dp).padding(top = 11.dp, bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text(
                pick.pickSelection, color = AppColors.appTextPrimary,
                fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
                MiniPickStamp("Market", PickTicketFormat.market(pick), TextAlign.Start)
                Spacer(Modifier.weight(1f))
                MiniPickStamp("Odds", pick.odds?.takeIf { it.isNotEmpty() } ?: "—", TextAlign.Center)
                Spacer(Modifier.weight(1f))
                MiniPickStamp("Units", PickTicketFormat.units(pick.units), TextAlign.End, tint = accent)
            }
            val snippet = miniReasoningSnippet(pick.reasoningText, pick.keyFactors)
            if (snippet.isNotEmpty()) {
                Text(snippet, color = AppColors.appTextSecondary, fontSize = 10.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
internal fun MiniStatusCorner(
    isPending: Boolean,
    confidence: Int,
    statusLabel: String,
    statusColor: Color,
    accent: Color,
) {
    if (isPending) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Icon(agentSymbol("gauge.medium"), null, tint = accent, modifier = Modifier.size(9.dp))
            Text("$confidence/5", color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    } else {
        Text(
            statusLabel, color = statusColor, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.clip(CircleShape).background(statusColor.copy(alpha = 0.16f)).padding(horizontal = 7.dp, vertical = 3.dp),
        )
    }
}

internal fun miniReasoningSnippet(reasoning: String, keyFactors: List<String>?): String {
    val r = reasoning.trim()
    if (r.isNotEmpty()) return r
    return keyFactors?.firstOrNull()?.trim() ?: ""
}

/**
 * Translucent boarding-pass cardstock shared by the live + locked mini tickets:
 * a glass base under a semi-opaque dark gradient so the agent's pixelwave aura
 * bleeds through. Perforation notch via [pickTicketShape] (r18/notch7).
 */
fun Modifier.miniTicketCardstock(notchY: Dp): Modifier {
    val shape = pickTicketShape(notchY = notchY, corner = 18.dp, notchRadius = 7.dp)
    return this
        .liquidGlassBackground(shape)
        .background(
            Brush.verticalGradient(
                listOf(
                    AppColors.ticketCardstockTop.copy(alpha = 0.55f),
                    AppColors.ticketCardstockBottom.copy(alpha = 0.72f),
                ),
            ),
            shape,
        )
}

/** Compact label/value stamp — the small-type cousin of [PickTicketStamp]. */
@Composable
fun MiniPickStamp(
    label: String,
    value: String,
    alignment: TextAlign,
    tint: Color = AppColors.appTextPrimary,
) {
    val hAlign = when (alignment) {
        TextAlign.End -> Alignment.End
        TextAlign.Center -> Alignment.CenterHorizontally
        else -> Alignment.Start
    }
    Column(horizontalAlignment = hAlign, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Medium)
        Text(value, color = tint, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, maxLines = 1)
    }
}

// MARK: - Horizontal rail

/**
 * Today's picks as a horizontal rail. No scroll dots — the peeking trailing
 * ticket is the affordance. Tapping a ticket fires the matching callback.
 */
@Composable
fun AgentTodaysPicksRail(
    items: List<AgentBetItem>,
    accent: Color,
    modifier: Modifier = Modifier,
    onTapPick: (AgentPick) -> Unit = {},
    onTapParlay: (AgentParlay) -> Unit = {},
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(horizontal = WidgetCard.hInset, vertical = 4.dp),
    ) {
        itemsIndexed(items, key = { _, item -> item.id }) { index, item ->
            when (item) {
                is AgentBetItem.Pick -> AgentPickMiniTicket(
                    pick = item.pick,
                    accent = accent,
                    modifier = Modifier.staggeredAppear(index).clickable { onTapPick(item.pick) },
                )
                is AgentBetItem.Parlay -> AgentParlayMiniTicket(
                    parlay = item.parlay,
                    accent = accent,
                    modifier = Modifier.staggeredAppear(index).clickable { onTapParlay(item.parlay) },
                )
            }
        }
    }
}

// MARK: - Skeleton rail

@Composable
fun AgentTodaysPicksRailSkeleton(
    modifier: Modifier = Modifier,
    count: Int = 3,
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(horizontal = WidgetCard.hInset, vertical = 4.dp),
    ) {
        items(count) { AgentPickMiniTicketSkeleton() }
    }
}

/** Mini-ticket skeleton — same cardstock + notch geometry, inner content shimmering. */
@Composable
fun AgentPickMiniTicketSkeleton(modifier: Modifier = Modifier) {
    val shape = pickTicketShape(notchY = MINI_NOTCH_Y, corner = 18.dp, notchRadius = 7.dp)
    Box(
        modifier = modifier
            .size(MINI_WIDTH, MINI_HEIGHT)
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0xFF111521), shape),
    ) {
        Column(Modifier.fillMaxSize().shimmering()) {
            Column(
                Modifier.fillMaxWidth().height(MINI_NOTCH_Y).padding(horizontal = 14.dp).padding(top = 12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    SkeletonCapsule(height = 12.dp, width = 48.dp)
                    Spacer(Modifier.weight(1f))
                    SkeletonCapsule(height = 12.dp, width = 30.dp)
                    Spacer(Modifier.width(6.dp))
                    SkeletonCapsule(height = 12.dp, width = 34.dp)
                }
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    SkeletonCircle(22.dp)
                    SkeletonBlock(height = 18.dp, width = 28.dp)
                    Spacer(Modifier.weight(1f))
                    SkeletonBlock(height = 18.dp, width = 28.dp)
                    SkeletonCircle(22.dp)
                }
                Spacer(Modifier.weight(1f))
            }
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 14.dp).padding(top = 11.dp, bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                SkeletonBlock(height = 13.dp, width = 96.dp)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    SkeletonBlock(height = 18.dp, width = 40.dp)
                    Spacer(Modifier.weight(1f))
                    SkeletonBlock(height = 18.dp, width = 32.dp)
                    Spacer(Modifier.weight(1f))
                    SkeletonBlock(height = 18.dp, width = 30.dp)
                }
                SkeletonBlock(height = 10.dp, width = 140.dp)
                SkeletonBlock(height = 10.dp, width = 104.dp)
            }
        }
    }
}

// MARK: - Locked rail

@Composable
fun AgentLockedPicksRail(
    accent: Color,
    modifier: Modifier = Modifier,
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(horizontal = WidgetCard.hInset, vertical = 4.dp),
    ) {
        items(2) { AgentPickMiniTicketLocked(accent) }
    }
}

@Composable
private fun AgentPickMiniTicketLocked(accent: Color) {
    Column(
        modifier = Modifier
            .size(MINI_WIDTH, MINI_HEIGHT)
            .miniTicketCardstock(MINI_NOTCH_Y)
            .border(1.dp, accent.copy(alpha = 0.16f), RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(agentSymbol("lock.fill"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(8.dp))
        Text("Upgrade to Pro", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(8.dp))
        Text("to view this agent's picks", color = AppColors.appTextSecondary, fontSize = 10.sp, textAlign = TextAlign.Center)
    }
}
