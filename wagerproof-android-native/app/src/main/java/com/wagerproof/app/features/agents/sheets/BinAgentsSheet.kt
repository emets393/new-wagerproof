package com.wagerproof.app.features.agents.sheets

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.components.AgentTodaysPicksRail
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.BinAgent
import com.wagerproof.core.models.StatMetric
import com.wagerproof.core.services.PlatformStatsService
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Native port of iOS `BinAgentsSheet.swift`.
 *
 * Drill-down presented when a histogram bar is tapped: the top public agents
 * whose metric falls in that bin (ranked by net units), each expandable to
 * show their currently-open (pending) picks. Only public agents appear — the
 * `get_distribution_bin_agents` RPC enforces that server-side. Rows expand in
 * place rather than pushing a detail page (this sheet is presented from the
 * Secret Settings modal, which has no Agents navigation stack).
 */

private sealed interface BinLoadState {
    data object Loading : BinLoadState
    data object Loaded : BinLoadState
    data class Failed(val message: String) : BinLoadState
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BinAgentsSheet(
    title: String,
    metric: StatMetric,
    sport: AgentSport?,
    lower: Double,
    upper: Double,
    minDecided: Int,
    onDismiss: () -> Unit,
    /** DEBUG/harness override — when set, skips the network fetch. */
    preloaded: List<BinAgent>? = null,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var loadState by remember { mutableStateOf<BinLoadState>(BinLoadState.Loading) }
    var agents by remember { mutableStateOf<List<BinAgent>>(emptyList()) }
    var expanded by remember { mutableStateOf<Set<String>>(emptySet()) }
    var reloadKey by remember { mutableStateOf(0) }

    // Lazy load on appear (or on Retry). Preloaded harness data short-circuits.
    LaunchedEffect(reloadKey) {
        if (preloaded != null) {
            agents = preloaded
            loadState = BinLoadState.Loaded
            return@LaunchedEffect
        }
        loadState = BinLoadState.Loading
        try {
            agents = PlatformStatsService.fetchBinAgents(
                metric = metric, sport = sport, lower = lower, upper = upper,
                minDecided = minDecided, limit = 20,
            )
            loadState = BinLoadState.Loaded
        } catch (e: Exception) {
            loadState = BinLoadState.Failed(e.message ?: "Something went wrong.")
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onDismiss) {
                Text("Done", color = AppColors.appPrimary, fontWeight = FontWeight.SemiBold)
            }
        }

        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
        ) {
            when (val state = loadState) {
                is BinLoadState.Loading -> {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        repeat(4) { BinRowSkeleton() }
                    }
                }
                is BinLoadState.Failed -> {
                    ContentUnavailable(
                        title = "Couldn't load agents",
                        message = state.message,
                        retry = { reloadKey++ },
                    )
                }
                is BinLoadState.Loaded -> {
                    if (agents.isEmpty()) {
                        ContentUnavailable(
                            title = "No public agents here",
                            message = "No public agents fall in this range with open picks.",
                            retry = null,
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                "Top public agents · ranked by net units",
                                color = AppColors.appTextSecondary,
                                fontSize = 12.sp,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            agents.forEach { agent ->
                                AgentCard(
                                    agent = agent,
                                    isExpanded = expanded.contains(agent.id),
                                    onToggle = {
                                        expanded = if (expanded.contains(agent.id)) {
                                            expanded - agent.id
                                        } else {
                                            expanded + agent.id
                                        }
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AgentCard(agent: BinAgent, isExpanded: Boolean, onToggle: () -> Unit) {
    val accent = AgentColorPalette.primary(agent.avatarColor)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Avatar(agent)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(agent.name, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black, maxLines = 1)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(agent.recordLabel, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    agent.winRate?.let { wr ->
                        Text(
                            "${(wr * 100).roundToInt()}%",
                            color = AppColors.appAccentBlue,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                val sign = if (agent.netUnits >= 0) "+" else ""
                Text(
                    "$sign${String.format(Locale.US, "%.2fu", agent.netUnits)}",
                    color = if (agent.netUnits >= 0) AppColors.appWin else AppColors.appLoss,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                )
                Text(pickCountLabel(agent), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
            }
            Icon(
                if (isExpanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                contentDescription = null,
                tint = AppColors.appTextMuted,
                modifier = Modifier.size(18.dp),
            )
        }

        AnimatedVisibility(visible = isExpanded) {
            if (agent.pendingPicks.isEmpty()) {
                Text(
                    "No open picks right now",
                    color = AppColors.appTextSecondary,
                    fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
                // Reuse the agent-detail today's-picks rail — same mini boarding-pass
                // tickets, horizontally scrolled. The rail carries its own edge
                // insets, so it reads as a full-bleed strip inside the card.
                AgentTodaysPicksRail(
                    items = agent.pendingPicks.map { AgentBetItem.Pick(it) },
                    accent = accent,
                )
            }
        }
    }
}

@Composable
private fun Avatar(agent: BinAgent) {
    Box(
        modifier = Modifier
            .size(42.dp)
            .background(
                Brush.linearGradient(AgentColorPalette.avatarGradient(agent.avatarColor)),
                CircleShape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(agent.avatarEmoji, fontSize = 20.sp)
    }
}

private fun pickCountLabel(agent: BinAgent): String {
    val n = agent.pendingPicks.size
    return when (n) {
        0 -> "No open picks"
        1 -> "1 open pick"
        else -> "$n open picks"
    }
}

@Composable
private fun BinRowSkeleton() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .shimmering()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonCircle(42.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SkeletonBlock(height = 14.dp, width = 120.dp)
            SkeletonBlock(height = 11.dp, width = 80.dp)
        }
        SkeletonBlock(height = 16.dp, width = 54.dp)
    }
}

@Composable
private fun ContentUnavailable(title: String, message: String, retry: (() -> Unit)?) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text(
            message,
            color = AppColors.appTextSecondary,
            fontSize = 13.sp,
            modifier = Modifier.fillMaxWidth(),
        )
        if (retry != null) {
            Button(
                onClick = retry,
                colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary),
            ) {
                Text("Retry", color = Color.White, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
