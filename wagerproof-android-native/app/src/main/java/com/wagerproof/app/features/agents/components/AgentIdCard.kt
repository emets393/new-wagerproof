package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentWithPerformance
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// ---------------------------------------------------------------------------
// AgentIdCard — the 2-up grid card on the My Agents inner tab. Port of iOS
// AgentIdCard.swift (itself a native port of components/agents/AgentIdCard.tsx).
// Top gradient border, primary→secondary wash, identity row, performance panel
// with sparkline, autopilot bottom row. Tap → onTap; long-press → onLongPress.
// ---------------------------------------------------------------------------

private val AUTOPILOT_GREEN = Color(0xFF10B981)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AgentIdCard(
    agent: AgentWithPerformance,
    modifier: Modifier = Modifier,
    onTap: () -> Unit,
    onLongPress: () -> Unit = {},
) {
    val primary = AgentColorPalette.primary(agent.agent.avatarColor)
    val secondary = AgentColorPalette.secondary(agent.agent.avatarColor)
    val perf = agent.performance
    val netUnitsLabel = perf?.netUnitsLabel ?: "+0.00u"
    val isPositive = (perf?.netUnits ?: 0.0) >= 0
    val shape = RoundedCornerShape(20.dp)
    val interaction = remember { MutableInteractionSource() }

    Column(
        modifier = modifier
            .height(195.dp)
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .combinedClickable(
                interactionSource = interaction,
                indication = null,
                onClick = onTap,
                onLongClick = onLongPress,
            ),
    ) {
        // Top gradient border (3dp strip).
        Box(
            Modifier
                .fillMaxWidth()
                .height(3.dp)
                .background(Brush.horizontalGradient(listOf(primary, secondary))),
        )

        Box(modifier = Modifier.fillMaxSize()) {
            // Background wash primary → secondary → clear.
            Box(
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                primary.copy(alpha = 0.08f),
                                secondary.copy(alpha = 0.05f),
                                Color.Transparent,
                            ),
                        ),
                    ),
            )
            Column(
                modifier = Modifier.fillMaxSize().padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                IdentityRow(agent)
                PerformancePanel(agent, isPositive, netUnitsLabel)
                Spacer(Modifier.weight(1f))
                BottomRow(agent)
            }
        }
    }
}

// MARK: - Identity

@Composable
private fun IdentityRow(agent: AgentWithPerformance) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    Brush.linearGradient(
                        colors = AgentColorPalette.avatarGradient(agent.agent.avatarColor),
                        start = Offset.Zero,
                        end = Offset.Infinite,
                    ),
                ),
            contentAlignment = Alignment.Center,
        ) {
            PixelSpriteAvatar(
                spriteIndex = agent.agent.spriteIndex,
                modifier = Modifier.size(40.dp).padding(2.dp),
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = agent.agent.name,
                color = AppColors.appTextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                agent.agent.preferredSports.take(4).forEach { sport ->
                    Box(
                        modifier = Modifier
                            .size(18.dp)
                            .clip(RoundedCornerShape(5.dp))
                            .background(AppColors.appBorder.copy(alpha = 0.5f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = agentSymbol(sport.sfSymbol),
                            contentDescription = null,
                            tint = AppColors.appTextSecondary,
                            modifier = Modifier.size(8.dp),
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Performance panel

@Composable
private fun PerformancePanel(agent: AgentWithPerformance, isPositive: Boolean, netUnitsLabel: String) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appBorder.copy(alpha = 0.25f))
            .padding(vertical = 4.dp, horizontal = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(
                imageVector = agentSymbol("chart.line.uptrend.xyaxis"),
                contentDescription = null,
                tint = AppColors.appTextSecondary,
                modifier = Modifier.size(9.dp),
            )
            Text(
                text = "PERFORMANCE",
                color = AppColors.appTextSecondary,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = netUnitsLabel,
                color = if (isPositive) AppColors.appWin else AppColors.appLoss,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
            )
        }

        AgentSparkline(agent.performance, modifier = Modifier.fillMaxWidth().height(32.dp))

        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = agent.performance?.recordLabel ?: "0-0",
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.weight(1f))
            StreakChip(agent.performance)
        }
    }
}

@Composable
private fun StreakChip(performance: AgentPerformance?) {
    val cs = performance?.currentStreak ?: 0
    val color = when {
        cs > 0 -> AppColors.appWin
        cs < 0 -> AppColors.appLoss
        else -> AppColors.appTextSecondary
    }
    val icon = when {
        cs > 0 -> "flame.fill"
        cs < 0 -> "snowflake"
        else -> "minus"
    }
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 5.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = agentSymbol(icon),
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(9.dp),
        )
        Text(
            text = performance?.currentStreakLabel ?: "-",
            color = color,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

// MARK: - Autopilot row

@Composable
private fun BottomRow(agent: AgentWithPerformance) {
    if (agent.agent.isActive) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(AUTOPILOT_GREEN.copy(alpha = 0.10f))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(6.dp).clip(RoundedCornerShape(3.dp)).background(AUTOPILOT_GREEN))
                Text(
                    text = "AUTOPILOT ON",
                    color = AUTOPILOT_GREEN,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.3.sp,
                )
            }
            if (agent.agent.autoGenerateTime.isNotEmpty()) {
                Text(
                    text = formatNextRun(agent.agent.autoGenerateTime, agent.agent.autoGenerateTimezone),
                    color = AUTOPILOT_GREEN,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.3.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(AUTOPILOT_GREEN.copy(alpha = 0.10f))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
        }
    } else {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(AppColors.appLoss.copy(alpha = 0.10f))
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = agentSymbol("pause.circle"),
                contentDescription = null,
                tint = AppColors.appLoss,
                modifier = Modifier.size(12.dp),
            )
            Text(
                text = "AUTOPILOT OFF",
                color = AppColors.appLoss,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.3.sp,
            )
        }
    }
}

// MARK: - Helpers

/** Mirrors RN `formatNextRun`. "9:00am ET" style. */
private fun formatNextRun(time: String, tz: String): String {
    val parts = time.split(":").mapNotNull { it.toIntOrNull() }
    val hour = parts.firstOrNull() ?: 9
    val minute = if (parts.size >= 2) parts[1] else 0
    val hr12 = if (hour % 12 == 0) 12 else hour % 12
    val ampm = if (hour < 12) "a" else "p"
    val tzAbbr = when {
        tz.contains("New_York") -> "ET"
        tz.contains("Chicago") -> "CT"
        tz.contains("Denver") -> "MT"
        tz.contains("Los_Angeles") -> "PT"
        else -> tz.split("/").lastOrNull()?.replace("_", " ") ?: ""
    }
    return String.format(Locale.US, "%d:%02d%s %s", hr12, minute, ampm, tzAbbr)
}

// MARK: - Sparkline

/**
 * Tiny static line chart for the PERFORMANCE panel. Generates 5–12 synthetic
 * equity-curve points scaled so the last point lands at net_units. Mirrors RN
 * `generateSparkPoints` + the static segment renderer. Hand-drawn Canvas
 * (waiver #205 — no chart libs).
 */
@Composable
private fun AgentSparkline(performance: AgentPerformance?, modifier: Modifier = Modifier) {
    val hasData = (performance?.totalPicks ?: 0) > 0
    val lineColor = if ((performance?.netUnits ?: 0.0) >= 0) Color(0xFF22C55E) else Color(0xFFEF4444)
    val emptyColor = AppColors.appTextMuted.copy(alpha = 0.6f)

    Canvas(modifier = modifier) {
        val padding = 2f
        if (hasData) {
            val pts = generateSparkPoints(performance)
            if (pts.size >= 2) {
                val minY = pts.min()
                val maxY = pts.max()
                val range = max(maxY - minY, 0.0001)
                val w = size.width - padding * 2
                val h = size.height - padding * 2
                val path = Path()
                pts.forEachIndexed { i, v ->
                    val x = padding + (i.toFloat() / (pts.size - 1)) * w
                    val y = padding + ((maxY - v) / range).toFloat() * h
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }
                drawPath(
                    path = path,
                    color = lineColor,
                    style = Stroke(width = 2f, cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
            }
        } else {
            // No graded picks yet: a dotted baseline stands in for the missing
            // equity curve rather than a flat solid line that reads as real data.
            val y = size.height / 2
            drawLine(
                color = emptyColor,
                start = Offset(padding, y),
                end = Offset(size.width - padding, y),
                strokeWidth = 2f,
                cap = StrokeCap.Round,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(0.5f, 5f)),
            )
        }
    }
}

/**
 * Loose port of RN `generateSparkPoints` — 6–13 synthetic points ending at
 * net_units. Returns `[0,0,0,0,0]` for empty performance.
 */
private fun generateSparkPoints(performance: AgentPerformance?): List<Double> {
    val perf = performance ?: return listOf(0.0, 0.0, 0.0, 0.0, 0.0)
    if (perf.totalPicks <= 0) return listOf(0.0, 0.0, 0.0, 0.0, 0.0)
    val total = perf.wins + perf.losses + perf.pushes
    if (total == 0) return listOf(0.0, 0.0, 0.0, 0.0, 0.0)

    val points = mutableListOf(0.0)
    var cumulative = 0.0
    val steps = min(max(total, 5), 12)
    val avgPerStep = perf.netUnits / steps
    for (i in 0 until steps) {
        val swing = when {
            i < max(perf.bestStreak, 1) -> abs(avgPerStep) + 0.3
            i > steps - max(abs(perf.worstStreak), 1) -> -abs(avgPerStep) - 0.2
            else -> avgPerStep + sin(i * 2.1) * 0.5
        }
        cumulative += swing
        points.add(cumulative)
    }
    // Rescale so the final point lands at net_units.
    val last = points.last()
    if (last != 0.0) {
        val scale = perf.netUnits / last
        for (i in 1 until points.size) {
            points[i] *= scale
        }
    }
    return points
}
