package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentSectionHeader
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentGenerationRunSummary
import com.wagerproof.core.models.AgentParlay
import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentPick
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// =====================================================================
// AgentTimeline — "Recent Activity" vertical timeline synthesized from
// snapshot data (today's run + last generation + performance recalc).
// Self-hides when empty. Port of iOS AgentTimeline.swift.
// =====================================================================

private data class TimelineEvent(
    val id: String,
    val timestamp: String,
    val title: String,
    val detail: String,
    val iconName: String,
    val tint: Color,
)

@Composable
fun AgentTimeline(
    agent: Agent,
    performance: AgentPerformance?,
    todaysPicks: List<AgentPick>,
    todaysParlays: List<AgentParlay> = emptyList(),
    todaysRun: AgentGenerationRunSummary?,
    modifier: Modifier = Modifier,
) {
    val events = buildEvents(agent, performance, todaysParlays, todaysRun)
    if (events.isEmpty()) return

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AgentSectionHeader(title = "Recent Activity", systemImage = "clock")
        Column(Modifier.fillMaxWidth()) {
            events.forEachIndexed { idx, event ->
                TimelineRow(event = event, isFirst = idx == 0, isLast = idx == events.lastIndex)
            }
        }
    }
}

private fun buildEvents(
    agent: Agent,
    performance: AgentPerformance?,
    todaysParlays: List<AgentParlay>,
    todaysRun: AgentGenerationRunSummary?,
): List<TimelineEvent> {
    val out = mutableListOf<TimelineEvent>()

    todaysRun?.let { run ->
        val title: String
        val detail: String
        val icon: String
        val parlayCount = todaysParlays.size
        if (run.picksGenerated > 0 || parlayCount > 0) {
            val parts = mutableListOf<String>()
            if (run.picksGenerated > 0) parts += "${run.picksGenerated} pick${if (run.picksGenerated == 1) "" else "s"}"
            if (parlayCount > 0) parts += "$parlayCount parlay${if (parlayCount == 1) "" else "s"}"
            title = "Generated ${parts.joinToString(" + ")}"
            detail = "Today's run completed successfully."
            icon = "sparkles"
        } else if (run.noGames) {
            title = "No games available"
            detail = "Agent skipped today — no games on its preferred slate."
            icon = "calendar.badge.exclamationmark"
        } else if (run.weakSlate) {
            title = "Skipped weak slate"
            detail = "Agent ran but the slate didn't meet its quality threshold."
            icon = "hand.raised"
        } else {
            title = "Analysis complete"
            detail = run.slateNote ?: "Agent finished its run and passed on the slate."
            icon = "checkmark.seal"
        }
        out += TimelineEvent(
            id = "run-${run.id}",
            timestamp = run.completedAt ?: run.createdAt ?: "",
            title = title,
            detail = detail,
            iconName = icon,
            tint = if (run.picksGenerated > 0 || todaysParlays.isNotEmpty()) AppColors.brandGreenBright else AppColors.appTextSecondary,
        )
    }

    agent.lastGeneratedAt?.let { lastGen ->
        out += TimelineEvent(
            id = "last-gen",
            timestamp = lastGen,
            title = "Last generation",
            detail = "Manual or automatic pick generation.",
            iconName = "wand.and.stars",
            tint = AppColors.appAccentBlue,
        )
    }

    performance?.let { perf ->
        perf.lastCalculatedAt?.let { lastCalc ->
            out += TimelineEvent(
                id = "perf-$lastCalc",
                timestamp = lastCalc,
                title = "Performance updated",
                detail = "Record: ${perf.recordLabel} · ${perf.netUnitsLabel}",
                iconName = "chart.line.uptrend.xyaxis",
                tint = if (perf.netUnits >= 0) AppColors.appWin else AppColors.appLoss,
            )
        }
    }

    return out
}

@Composable
private fun TimelineRow(event: TimelineEvent, isFirst: Boolean, isLast: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Spine: top segment · icon disc · bottom segment.
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(24.dp)) {
            Box(
                Modifier.width(1.dp).height(10.dp)
                    .background(if (isFirst) Color.Transparent else AppColors.appBorder.copy(alpha = 0.6f)),
            )
            Box(
                Modifier.size(24.dp).clip(CircleShape).background(event.tint.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(agentSymbol(event.iconName), null, tint = event.tint, modifier = Modifier.size(11.dp))
            }
            Box(
                Modifier.width(1.dp).weight(1f)
                    .background(if (isLast) Color.Transparent else AppColors.appBorder.copy(alpha = 0.6f)),
            )
        }

        Column(
            Modifier.weight(1f).padding(vertical = 4.dp).padding(bottom = if (isLast) 0.dp else 12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text(event.title, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Text(formatTimestamp(event.timestamp), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
            }
            Text(event.detail, color = AppColors.appTextSecondary, fontSize = 13.sp)
        }
    }
}

private fun formatTimestamp(raw: String): String {
    if (raw.isEmpty()) return ""
    val instant = try {
        Instant.parse(raw)
    } catch (_: Throwable) {
        try {
            OffsetDateTime.parse(raw).toInstant()
        } catch (_: Throwable) {
            return ""
        }
    }
    val secs = Duration.between(instant, Instant.now()).seconds
    return when {
        secs < 60 -> "just now"
        secs < 3600 -> "${secs / 60}m ago"
        secs < 86_400 -> "${secs / 3600}h ago"
        else -> DateTimeFormatter.ofPattern("MMM d", Locale.US)
            .withZone(ZoneId.systemDefault()).format(instant)
    }
}
