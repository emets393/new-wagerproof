package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentWithPerformance
import java.util.Locale

/**
 * "YOUR AGENCY" roll-up card that hosts the HR CTA — port of iOS
 * `CompanyDashboardBanner.swift`. Header (agency + active count + HR button)
 * over a 3-cell stat strip (Net Units / Avg Win Rate / Agents).
 */
@Composable
fun CompanyDashboardBanner(
    agents: List<AgentWithPerformance>,
    onOpenHR: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val totalNetUnits = agents.sumOf { it.performance?.netUnits ?: 0.0 }
    val winRateAverage = avgWinRate(agents)
    val activeCount = agents.count { it.agent.isActive }
    val brandGreen = AppColors.brandGreenBright
    val shape = RoundedCornerShape(14.dp)

    Column(
        modifier
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "YOUR AGENCY",
                    color = AppColors.appTextSecondary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.5.sp,
                )
                Text(
                    "${agents.size} agents · $activeCount active",
                    color = AppColors.appTextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Row(
                Modifier
                    .clip(CircleShape)
                    .background(brandGreen.copy(alpha = 0.16f))
                    .clickable(onClick = onOpenHR)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    agentSymbol("person.2.badge.gearshape.fill"),
                    contentDescription = null,
                    tint = brandGreen,
                    modifier = Modifier.height(11.dp),
                )
                Text("HR", color = brandGreen, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp)
            }
        }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            StatCell(
                label = "Net Units",
                value = netUnitsLabel(totalNetUnits),
                tint = if (totalNetUnits >= 0) AppColors.appWin else AppColors.appLoss,
                modifier = Modifier.weight(1f),
            )
            VerticalDivider(Modifier.height(32.dp), color = AppColors.appBorder)
            StatCell(
                label = "Avg Win Rate",
                value = String.format(Locale.US, "%.1f%%", winRateAverage * 100),
                tint = AppColors.appTextPrimary,
                modifier = Modifier.weight(1f),
            )
            VerticalDivider(Modifier.height(32.dp), color = AppColors.appBorder)
            StatCell(
                label = "Agents",
                value = "${agents.size}",
                tint = AppColors.appTextPrimary,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun StatCell(label: String, value: String, tint: Color, modifier: Modifier = Modifier) {
    Column(
        modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            label,
            color = AppColors.appTextSecondary,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 0.8.sp,
        )
        Text(value, color = tint, fontSize = 14.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
    }
}

/** Mean of per-agent win% over agents with settled picks (mirrors iOS). */
internal fun avgWinRate(agents: List<AgentWithPerformance>): Double {
    val withPerf = agents.mapNotNull { it.performance }.filter { it.totalPicks > 0 }
    if (withPerf.isEmpty()) return 0.0
    var acc = 0.0
    var counted = 0
    for (perf in withPerf) {
        val settled = perf.wins + perf.losses
        if (settled <= 0) continue
        acc += perf.wins.toDouble() / settled
        counted += 1
    }
    // iOS divides by withPerf.count (all agents with picks), not just those with
    // settled results — preserve that so a pending-only agent dilutes the mean.
    return acc / withPerf.size
}

internal fun netUnitsLabel(units: Double): String {
    val sign = if (units >= 0) "+" else ""
    return String.format(Locale.US, "%s%.2fu", sign, units)
}
