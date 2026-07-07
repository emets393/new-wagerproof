package com.wagerproof.app.features.agents.sheets

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentWithPerformance
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Native port of iOS `AgentHRBottomSheet.swift` (itself a port of the web
 * `AgentHRBottomSheet.tsx`).
 *
 * "HR DEPARTMENT" comparison sheet: ranks every agent that has settled picks
 * by net units, grades them, and surfaces a recommendation. Includes a
 * "fire to save $$$" panel for losers. Pure visualization — no mutations.
 */

private const val UNIT_SIZE: Double = 100.0

private enum class HRGrade(val label: String, val color: Color) {
    S("S", Color(0xFFFFD700)),
    A("A", Color(0xFF00E676)),
    B("B", Color(0xFF69F0AE)),
    C("C", Color(0xFFFFC107)),
    D("D", Color(0xFFFF9800)),
    F("F", Color(0xFFFF5252)),
}

/** Report-card row derived per agent — mirrors the swift private struct. */
private data class HRReportCard(
    val agent: AgentWithPerformance,
    val grade: HRGrade,
    val netUnits: Double,
    val dollarImpact: Double,
    val winRate: Double?,
    val record: String,
    val companyWithout: Double,
    val recommendation: String,
    val isCostingMoney: Boolean,
) {
    val id: String get() = agent.id
}

private fun gradeForNetUnits(n: Double): HRGrade = when {
    n >= 10 -> HRGrade.S
    n >= 5 -> HRGrade.A
    n >= 1 -> HRGrade.B
    n >= 0 -> HRGrade.C
    n >= -3 -> HRGrade.D
    else -> HRGrade.F
}

private fun recommendation(grade: HRGrade, name: String, netUnits: Double, winRate: Double?): String =
    when (grade) {
        HRGrade.S -> "$name is your MVP. Protect at all costs."
        HRGrade.A -> "$name is a top performer. Keep them running."
        HRGrade.B -> "$name is solid. Pulling their weight."
        HRGrade.C ->
            if (winRate != null && winRate >= 50) "$name is break-even. Could tweak personality params."
            else "$name is on thin ice. Review their strategy."
        HRGrade.D -> "$name is underperforming. Consider adjusting or replacing."
        HRGrade.F -> {
            val dollars = abs(netUnits * UNIT_SIZE).roundToInt()
            "$name is costing you money. Fire to save \$$dollars."
        }
    }

/** Signed dollar formatter — "+\$1.2k" / "-\$450" mirroring the swift helper. */
private fun formatDollars(amount: Double): String {
    val a = abs(amount)
    val sign = if (amount >= 0) "+" else "-"
    if (a >= 1000) {
        val k = a / 1000.0
        return if (k % 1.0 == 0.0) "$sign\$${k.toInt()}k"
        else String.format(Locale.US, "%s\$%.1fk", sign, k)
    }
    return String.format(Locale.US, "%s\$%.0f", sign, a)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgentHRBottomSheet(
    agents: List<AgentWithPerformance>,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Derive all report cards + section totals once per roster snapshot. This
    // is pure math over the cached performance rows — no fetching.
    val cards = remember(agents) {
        val totalNetUnits = agents.sumOf { it.performance?.netUnits ?: 0.0 }
        val totalBankroll = 1000 + totalNetUnits * UNIT_SIZE
        agents
            .filter { (it.performance?.totalPicks ?: 0) > 0 }
            .map { agent ->
                val perf = agent.performance!!
                val settled = perf.wins + perf.losses
                val winRate = if (settled > 0) perf.wins.toDouble() / settled * 100 else null
                val grade = gradeForNetUnits(perf.netUnits)
                HRReportCard(
                    agent = agent,
                    grade = grade,
                    netUnits = perf.netUnits,
                    dollarImpact = perf.netUnits * UNIT_SIZE,
                    winRate = winRate,
                    record = perf.recordLabel,
                    companyWithout = totalBankroll - perf.netUnits * UNIT_SIZE,
                    recommendation = recommendation(grade, agent.agent.name, perf.netUnits, winRate),
                    isCostingMoney = perf.netUnits < 0,
                )
            }
            .sortedBy { it.netUnits }
    }

    val winners = remember(cards) { cards.filter { !it.isCostingMoney }.sortedByDescending { it.netUnits } }
    val losers = remember(cards) { cards.filter { it.isCostingMoney } }
    val winnersTotal = remember(winners) { winners.sumOf { it.dollarImpact } }
    val losersTotal = remember(losers) { losers.sumOf { it.dollarImpact } }
    val totalBankroll = remember(agents) {
        1000 + agents.sumOf { it.performance?.netUnits ?: 0.0 } * UNIT_SIZE
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
    ) {
        // Title bar mirroring the swift NavigationStack inline title + Done.
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "HR Department",
                color = AppColors.appTextPrimary,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onDismiss) {
                Text("Done", color = AppColors.appPrimary, fontWeight = FontWeight.SemiBold)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HeaderBlock()

            if (winners.isEmpty() && losers.isEmpty()) {
                EmptyState()
            }

            if (winners.isNotEmpty()) {
                SummaryCard(
                    title = "WINNERS",
                    tint = Color(0xFF00E676),
                    total = winnersTotal,
                    body = "${winners.size} agent${if (winners.size == 1) "" else "s"} earning money for the company.",
                )
                winners.forEach { ReportRow(it) }
            }

            if (losers.isNotEmpty()) {
                val saved = abs(losersTotal).roundToInt()
                val after = (totalBankroll - losersTotal).roundToInt()
                val body = "${losers.size} agent${if (losers.size == 1) " is" else "s are"} costing money. " +
                    "Firing ${if (losers.size == 1) "them" else "all"} saves \$$saved and brings bankroll to \$$after."
                SummaryCard(title = "LOSERS", tint = Color(0xFFFF5252), total = losersTotal, body = body)
                losers.forEach { ReportRow(it) }
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun HeaderBlock() {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                ">_",
                color = Color(0xFF00E676),
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
            Text(
                "HR DEPARTMENT",
                color = AppColors.appTextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 2.sp,
            )
        }
        Text(
            "AGENT PERFORMANCE REVIEW",
            color = AppColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.5.sp,
            modifier = Modifier.padding(start = 22.dp),
        )
    }
}

@Composable
private fun EmptyState() {
    Text(
        "No agents with settled picks yet. Check back after picks are graded.",
        color = AppColors.appTextSecondary,
        fontSize = 13.sp,
        fontFamily = FontFamily.Monospace,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
    )
}

@Composable
private fun SummaryCard(title: String, tint: Color, total: Double, body: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(tint.copy(alpha = 0.07f), RoundedCornerShape(12.dp))
            .border(1.dp, tint.copy(alpha = 0.18f), RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                title,
                color = tint,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.5.sp,
            )
            Spacer(Modifier.weight(1f))
            Text(
                formatDollars(total),
                color = tint,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
        }
        Text(body, color = AppColors.appTextSecondary, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun ReportRow(card: HRReportCard) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(12.dp))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Grade chip
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .background(card.grade.color.copy(alpha = 0.18f), RoundedCornerShape(8.dp))
                    .border(1.dp, card.grade.color.copy(alpha = 0.4f), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    card.grade.label,
                    color = card.grade.color,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                )
            }

            Text(card.agent.agent.avatarEmoji, fontSize = 20.sp)

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    card.agent.agent.name,
                    color = AppColors.appTextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                val wrLabel = card.winRate?.let { String.format(Locale.US, "%.1f%%", it) } ?: "--"
                Text(
                    "${card.record} | $wrLabel",
                    color = AppColors.appTextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                )
            }

            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    formatDollars(card.dollarImpact),
                    color = if (card.netUnits >= 0) Color(0xFF00E676) else Color(0xFFFF5252),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                )
                Text(
                    "IMPACT",
                    color = AppColors.appTextSecondary,
                    fontSize = 7.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp,
                )
            }
        }

        Text(
            card.recommendation,
            color = AppColors.appTextSecondary,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
        )

        if (card.isCostingMoney) {
            val companyWithoutFmt = card.companyWithout.roundToInt()
            val savingsFmt = abs(card.dollarImpact).roundToInt()
            val red = Color(0xFFFF5252)
            val green = Color(0xFF00E676)
            // Multi-color inline sentence — "without X, bankroll would be $Y (+$Z saved)".
            val text = buildAnnotatedString {
                withStyle(SpanStyle(color = red, fontWeight = FontWeight.Black)) { append(">_ ") }
                withStyle(SpanStyle(color = red)) { append("Without ${card.agent.agent.name}, bankroll would be ") }
                withStyle(SpanStyle(color = green, fontWeight = FontWeight.Black)) { append("\$$companyWithoutFmt") }
                withStyle(SpanStyle(color = red)) { append(" (+\$$savingsFmt saved)") }
            }
            Text(
                text,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(red.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                    .border(1.dp, red.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                    .padding(10.dp),
            )
        }
    }
}
