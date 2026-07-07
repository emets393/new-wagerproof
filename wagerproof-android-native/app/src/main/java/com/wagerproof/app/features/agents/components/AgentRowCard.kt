package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.layout
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.agents.color
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.AgentStrategyTag
import com.wagerproof.core.models.AgentWithPerformance
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Full-width agent row for the My Agents list — port of iOS `AgentRowCard.swift`.
 * Adopts the MLB `GameRowCard` glass language: translucent surface, ~26dp
 * continuous corners, hairline border, soft shadow, animated glyph texture.
 * Tap → [onTap]; 0.4s long-press → [onLongPress].
 */
@Composable
fun AgentRowCard(
    agent: AgentWithPerformance,
    modifier: Modifier = Modifier,
    hasUnreadPicks: Boolean = false,
    onTap: () -> Unit,
    onLongPress: () -> Unit = {},
) {
    val shape = RoundedCornerShape(26.dp)
    val primary = AgentColorPalette.primary(agent.agent.avatarColor)

    Box(
        modifier
            .clip(shape)
            .combinedClickable(onClick = onTap, onLongClick = onLongPress)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.4f), shape),
    ) {
        // Glass base: thinned surface so the page shows through, then the
        // brand-hue glyph sneak-peek, then the card content.
        Box(Modifier.matchParentSize().background(AppColors.appSurfaceElevated.copy(alpha = 0.55f)))
        AgentCardGlyphTexture(
            avatarColor = agent.agent.avatarColor,
            seedString = agent.id,
            modifier = Modifier.matchParentSize(),
            cornerRadius = 26.dp,
        )

        Column(
            Modifier.padding(horizontal = 14.dp).padding(top = 12.dp, bottom = 9.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(agent, primary, hasUnreadPicks)
                Spacer(Modifier.width(12.dp))
                IdentityBlock(agent, Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                AgentFormChart(agent, Modifier.size(width = 96.dp, height = 50.dp))
            }
            HorizontalDivider(color = AppColors.appBorder.copy(alpha = 0.5f))
            InfoRow(agent)
        }
    }
}

@Composable
private fun Avatar(agent: AgentWithPerformance, primary: Color, hasUnreadPicks: Boolean) {
    val shape = RoundedCornerShape(14.dp)
    Box(Modifier.size(52.dp)) {
        Box(
            Modifier
                .matchParentSize()
                .shadow(10.dp, shape, spotColor = primary, ambientColor = primary)
                .clip(shape)
                .background(AppColors.appSurfaceElevated)
                .background(
                    Brush.linearGradient(
                        AgentColorPalette.avatarGradient(agent.agent.avatarColor),
                        start = Offset.Zero,
                        end = Offset.Infinite,
                    ),
                    alpha = 0.85f,
                )
                .border(1.5.dp, AppColors.appSurfaceElevated, shape),
            contentAlignment = Alignment.Center,
        ) {
            PixelSpriteAvatar(agent.agent.spriteIndex, Modifier.fillMaxSize().padding(3.dp))
        }
        if (hasUnreadPicks) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(4, -4)
                    .size(11.dp)
                    .clip(CircleShape)
                    .background(AppColors.brandGreenBright)
                    .border(1.5.dp, AppColors.appSurfaceElevated, CircleShape),
            )
        }
    }
}

/** Small render-only offset in dp integers (avoids importing offset extension conflicts). */
private fun Modifier.offset(x: Int, y: Int): Modifier = this.layout { measurable, constraints ->
    val placeable = measurable.measure(constraints)
    layout(placeable.width, placeable.height) {
        placeable.place((x * density).roundToInt(), (y * density).roundToInt())
    }
}

@Composable
private fun IdentityBlock(agent: AgentWithPerformance, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                agent.agent.name,
                color = AppColors.appTextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            if (agent.agent.isActive) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(Color(0xFF10B981)))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            agent.agent.strategyTags.take(2).forEach { tag -> Chip(tag) }
        }
    }
}

@Composable
private fun Chip(tag: AgentStrategyTag) {
    Text(
        tag.text,
        color = tag.color,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@Composable
private fun InfoRow(agent: AgentWithPerformance) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        SportsCluster(agent.agent.preferredSports)
        Spacer(Modifier.weight(1f).widthIn(min = 8.dp))
        val perf = agent.performance
        if (perf != null && perf.totalPicks > 0) {
            val overall = overallWinPct(perf)
            val l7d = recentWinPct(perf)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(perf.recordLabel, color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                Text("$overall%", color = if (overall >= 50) AppColors.appWin else AppColors.appLoss, fontSize = 11.sp, fontWeight = FontWeight.Black)
                Text("7D $l7d%", color = if (l7d >= 50) AppColors.appWin else AppColors.appLoss, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun SportsCluster(sports: List<AgentSport>) {
    if (sports.size > 3) {
        Row(horizontalArrangement = Arrangement.spacedBy((-7).dp)) {
            sports.forEachIndexed { idx, sport ->
                Box(
                    Modifier
                        .zIndex((sports.size - idx).toFloat())
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(AppColors.appSurfaceMuted)
                        .border(1.dp, AppColors.appBorder.copy(alpha = 0.6f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(agentSymbol(sport.sfSymbol), null, tint = AppColors.appTextPrimary, modifier = Modifier.size(9.dp))
                }
            }
        }
    } else {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            sports.forEach { SportPill(it) }
        }
    }
}

@Composable
private fun SportPill(sport: AgentSport) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), CircleShape)
            .padding(horizontal = 6.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(agentSymbol(sport.sfSymbol), null, tint = AppColors.appTextPrimary, modifier = Modifier.size(8.dp))
        Text(sport.label, color = AppColors.appTextPrimary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}

private fun overallWinPct(p: AgentPerformance): Int {
    val settled = p.wins + p.losses
    if (settled <= 0) return 0
    return (p.wins.toDouble() / settled * 100).roundToInt()
}

/** Synthetic last-7-days win% — real overall nudged ±5pts/streak game, clamped 2..98. */
private fun recentWinPct(p: AgentPerformance): Int =
    min(98, max(2, overallWinPct(p) + p.currentStreak * 5))

// ---------------------------------------------------------------------------
// Form chart — streak badge + synthetic stacked W/L bars.
// ---------------------------------------------------------------------------

/**
 * Right-side performance mini-viz for [AgentRowCard] — port of iOS
 * `AgentFormChart`. A real current-streak badge over a compact stacked bar
 * chart of recent daily wins (green, rooted at baseline) vs losses (red, on
 * top). Daily buckets are a deterministic synthetic split of the REAL W/L
 * totals, FNV-1a/LCG-seeded off the avatar id.
 */
@Composable
fun AgentFormChart(agent: AgentWithPerformance, modifier: Modifier = Modifier) {
    val perf = agent.performance
    val streak = perf?.currentStreak ?: 0
    val streakColor = when {
        streak > 0 -> AppColors.appWin
        streak < 0 -> AppColors.appLoss
        else -> AppColors.appTextMuted
    }
    val chartHeight = 28.dp

    Column(
        modifier,
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        // Streak badge (real current_streak).
        Row(
            Modifier
                .clip(CircleShape)
                .background(streakColor.copy(alpha = if (streak == 0) 0.08f else 0.14f))
                .padding(horizontal = 6.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (streak != 0) {
                Icon(
                    agentSymbol(if (streak > 0) "flame.fill" else "snowflake"),
                    null,
                    tint = streakColor,
                    modifier = Modifier.size(8.dp),
                )
            }
            Text("Streak", color = streakColor.copy(alpha = 0.85f), fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
            Text(
                when {
                    streak == 0 -> "—"
                    streak > 0 -> "W$streak"
                    else -> "L${abs(streak)}"
                },
                color = streakColor,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
            )
        }

        val buckets = if (perf != null) formBuckets(perf) else emptyList()
        if (buckets.isEmpty()) {
            DottedBaseline(Modifier.fillMaxSize().height(chartHeight))
        } else {
            val maxTotal = max(1, buckets.maxOf { it.first + it.second })
            Row(
                Modifier.height(chartHeight),
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                buckets.forEach { (wins, losses) -> FormBar(wins, losses, maxTotal, chartHeight) }
            }
        }
    }
}

@Composable
private fun FormBar(wins: Int, losses: Int, maxTotal: Int, chartHeight: androidx.compose.ui.unit.Dp) {
    val total = wins + losses
    val barH = chartHeight * total / maxTotal
    val winH = if (total > 0) barH * wins / total else 0.dp
    val lossH = barH - winH
    Column(
        Modifier.width(8.dp),
        verticalArrangement = Arrangement.spacedBy(1.dp),
    ) {
        if (losses > 0) {
            Box(Modifier.width(8.dp).height(maxOf(2.dp, lossH)).clip(RoundedCornerShape(2.dp)).background(AppColors.appLoss))
        }
        if (wins > 0) {
            Box(Modifier.width(8.dp).height(maxOf(2.dp, winH)).clip(RoundedCornerShape(2.dp)).background(AppColors.appWin))
        }
    }
}

/** Dashed baseline at vertical center — the "no form data yet" placeholder. */
@Composable
private fun DottedBaseline(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        drawLine(
            color = AppColors.appTextMuted.copy(alpha = 0.5f),
            start = Offset(0f, size.height / 2f),
            end = Offset(size.width, size.height / 2f),
            strokeWidth = 2f,
            cap = StrokeCap.Round,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(0.5f, 5f)),
        )
    }
}

/**
 * Synthetic per-day W/L buckets from the real totals. Fisher–Yates shuffle of a
 * wins/losses bool sequence, PRNG = FNV-1a(avatarId) seed → MMIX LCG, split into
 * min(7, max(3, total/4)) contiguous buckets. Same agent → same bars.
 */
private fun formBuckets(perf: AgentPerformance): List<Pair<Int, Int>> {
    val wins = perf.wins
    val losses = perf.losses
    val total = wins + losses
    if (total <= 0) return emptyList()

    var state = run {
        var h = 0xcbf29ce484222325uL
        for (b in perf.avatarId.encodeToByteArray()) {
            h = (h xor b.toUByte().toULong()) * 0x100000001b3uL
        }
        h or 1uL
    }
    fun next(): ULong {
        state = state * 6364136223846793005uL + 1442695040888963407uL
        return state
    }

    val seq = ArrayList<Boolean>(total)
    repeat(wins) { seq.add(true) }
    repeat(losses) { seq.add(false) }
    if (seq.size > 1) {
        for (i in seq.size - 1 downTo 1) {
            val j = (next() % (i + 1).toULong()).toInt()
            val tmp = seq[i]; seq[i] = seq[j]; seq[j] = tmp
        }
    }

    val bucketCount = min(7, max(3, total / 4))
    val buckets = Array(bucketCount) { intArrayOf(0, 0) } // [wins, losses]
    seq.forEachIndexed { idx, win ->
        val b = idx * bucketCount / seq.size
        if (win) buckets[b][0]++ else buckets[b][1]++
    }
    return buckets.map { it[0] to it[1] }
}
