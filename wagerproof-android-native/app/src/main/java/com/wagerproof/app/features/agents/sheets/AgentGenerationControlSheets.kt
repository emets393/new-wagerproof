package com.wagerproof.app.features.agents.sheets

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.agents.creation.inputs.AgentTimezoneOption
import com.wagerproof.app.features.agents.creation.inputs.TimePickerModal
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentGenerationRunSummary
import com.wagerproof.core.models.AgentPick
import kotlinx.coroutines.launch
import java.time.LocalDate
import kotlin.math.roundToInt

// =====================================================================
// Native port of iOS `AgentGenerationControlSheets.swift`.
//
// Generation control surfaces for the agent detail page's picks footer:
//   • RegenerateControlButton → RegenerateBottomSheet — daily quota + the
//     swipe-to-request-picks slider.
//   • AutoPilotControlButton  → AutoPilotBottomSheet  — the autopilot on/off
//     toggle + preferred-time setting + recent-runs list.
//
// The buttons are dumb (state + tap-out); the host owns store calls + presents
// the sheets.
// =====================================================================

private val AGENT_ON_GREEN = Color(0xFF00E676)

// MARK: - Footer control buttons

/** Footer chip that opens the regenerate sheet. Shows runs left today at a glance. */
@Composable
fun RegenerateControlButton(
    remaining: Int,
    accent: Color,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .clickable(enabled = true, onClick = onClick)
            .background(accent.copy(alpha = if (enabled) 0.35f else 0.15f), CircleShape)
            .border(1.dp, accent.copy(alpha = if (enabled) 0.55f else 0.25f), CircleShape)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            agentSymbol(if (enabled) "arrow.clockwise" else "lock.fill"),
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(12.dp),
        )
        Text("Regenerate", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
        Text(
            "$remaining left",
            color = if (remaining > 0) AppColors.appTextPrimary else AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier
                .background(accent.copy(alpha = if (remaining > 0) 0.28f else 0.14f), CircleShape)
                .padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

/** Footer chip that opens the autopilot sheet. A status dot signals on/off. */
@Composable
fun AutoPilotControlButton(
    isOn: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    val statusColor = if (isOn) AGENT_ON_GREEN else AppColors.appTextSecondary
    Row(
        modifier = Modifier
            .clickable(onClick = onClick)
            .background(accent.copy(alpha = if (isOn) 0.4f else 0.22f), CircleShape)
            .border(1.dp, accent.copy(alpha = if (isOn) 0.6f else 0.25f), CircleShape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        val fg = if (isOn) AppColors.appTextPrimary else AppColors.appTextSecondary
        Icon(
            agentSymbol("bolt.badge.automatic"),
            contentDescription = null,
            tint = fg,
            modifier = Modifier.size(11.dp),
        )
        Text("AutoPilot", color = fg, fontSize = 11.sp, fontWeight = FontWeight.Black)
        Box(modifier = Modifier.size(6.dp).background(statusColor, CircleShape))
    }
}

// MARK: - Regenerate sheet

/**
 * Explains the daily regeneration quota + logic, then hosts the swipe pill that
 * actually requests a fresh run.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegenerateBottomSheet(
    remaining: Int,
    maxDaily: Int,
    accent: Color,
    canRegenerate: Boolean,
    onRequest: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF0B1011),
    ) {
        SheetTitleBar(title = "Regenerate", onDismiss = onDismiss)

        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            RegenHeader(accent)
            QuotaCard(remaining = remaining, maxDaily = maxDaily, accent = accent)
            LogicCard(maxDaily = maxDaily, accent = accent)
        }

        // Swipe-to-request pill pinned at the bottom of the sheet.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF0B1011))
                .padding(horizontal = 20.dp)
                .padding(top = 8.dp, bottom = 20.dp),
        ) {
            SwipeToGeneratePill(
                title = if (canRegenerate) "Swipe to request picks" else "Daily limit reached",
                accent = accent,
                isEnabled = canRegenerate,
                onCommit = {
                    onRequest()
                    onDismiss()
                },
            )
        }
    }
}

@Composable
private fun RegenHeader(accent: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(44.dp).background(accent.copy(alpha = 0.18f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(agentSymbol("arrow.clockwise"), contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.weight(1f)) {
            Text("Regenerate today's picks", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
            Text("Re-run the agent against the current slate.", color = AppColors.appTextSecondary, fontSize = 12.sp)
        }
    }
}

/** Runs-left pip row — one filled pip per remaining run, hollow for spent. */
@Composable
private fun QuotaCard(remaining: Int, maxDaily: Int, accent: Color) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(accent.copy(alpha = 0.07f), RoundedCornerShape(16.dp))
            .border(1.dp, accent.copy(alpha = 0.18f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("RUNS LEFT TODAY", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Spacer(Modifier.weight(1f))
            Text(
                "$remaining/$maxDaily",
                color = if (remaining > 0) accent else AppColors.appLoss,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            for (i in 0 until maxDaily) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(8.dp)
                        .background(if (i < remaining) accent else Color.White.copy(alpha = 0.10f), CircleShape),
                )
            }
        }
    }
}

@Composable
private fun LogicCard(maxDaily: Int, accent: Color) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(16.dp))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("HOW IT WORKS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
        LogicBullet("gauge.with.dots.needle.67percent", "Each agent gets $maxDaily generations per day.", accent)
        LogicBullet("sparkles", "A run re-analyzes today's games from scratch and reprints the ticket rail.", accent)
        LogicBullet("bolt.badge.automatic", "Autopilot runs count toward the same $maxDaily-per-day limit.", accent)
        LogicBullet("clock.arrow.circlepath", "The quota resets at midnight in your local time.", accent)
    }
}

@Composable
private fun LogicBullet(icon: String, text: String, accent: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
        Icon(agentSymbol(icon), contentDescription = null, tint = accent, modifier = Modifier.size(20.dp).padding(top = 1.dp))
        Text(text, color = AppColors.appTextPrimary, fontSize = 13.sp, modifier = Modifier.weight(1f))
    }
}

/**
 * FIDELITY-WAIVER #305: iOS `SwipeToGeneratePill` has no shared-lib equivalent
 * on Android, so it's hand-rolled here: a draggable thumb that fires [onCommit]
 * once dragged ~70% of the track, then springs back.
 */
@Composable
private fun SwipeToGeneratePill(
    title: String,
    accent: Color,
    isEnabled: Boolean,
    onCommit: () -> Unit,
) {
    val density = LocalDensity.current
    val trackHeight = 56.dp
    val thumb = 48.dp
    var trackWidthPx by remember { mutableStateOf(0f) }
    val thumbPx = with(density) { thumb.toPx() }
    val offsetX = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(trackHeight)
            .background(
                if (isEnabled) accent.copy(alpha = 0.18f) else Color.White.copy(alpha = 0.06f),
                CircleShape,
            )
            .border(1.dp, if (isEnabled) accent.copy(alpha = 0.45f) else Color.White.copy(alpha = 0.10f), CircleShape)
            .onSizeChanged { trackWidthPx = it.width.toFloat() },
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            title,
            color = if (isEnabled) AppColors.appTextPrimary else AppColors.appTextSecondary,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth().padding(start = thumb + 8.dp, end = 16.dp),
        )
        // Draggable thumb — only interactive when enabled.
        Box(
            modifier = Modifier
                .offset { IntOffset(offsetX.value.roundToInt() + with(density) { 4.dp.roundToPx() }, 0) }
                .size(thumb)
                .padding(2.dp)
                .background(if (isEnabled) accent else Color.White.copy(alpha = 0.15f), CircleShape)
                .then(
                    if (isEnabled) Modifier.pointerInput(trackWidthPx) {
                        detectHorizontalDragGestures(
                            onDragEnd = {
                                val max = (trackWidthPx - thumbPx - with(density) { 8.dp.toPx() }).coerceAtLeast(1f)
                                if (offsetX.value >= max * 0.7f) {
                                    onCommit()
                                }
                                scope.launch { offsetX.animateTo(0f) }
                            },
                            onHorizontalDrag = { _, dragAmount ->
                                val max = (trackWidthPx - thumbPx - with(density) { 8.dp.toPx() }).coerceAtLeast(1f)
                                scope.launch { offsetX.snapTo((offsetX.value + dragAmount).coerceIn(0f, max)) }
                            },
                        )
                    } else Modifier,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                agentSymbol(if (isEnabled) "arrow.clockwise" else "lock.fill"),
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

// MARK: - AutoPilot sheet

/**
 * Autopilot control surface: toggle daily auto-generation, set its preferred
 * time, and review recent runs. Persists via the two async closures the host
 * wires to `AgentDetailStore`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AutoPilotBottomSheet(
    agentName: String,
    accent: Color,
    canUseAutopilot: Boolean,
    remaining: Int,
    maxDaily: Int,
    initialAutoOn: Boolean,
    initialTime: String,
    initialTimezone: String,
    recentRuns: List<AgentRunSummaryRow>,
    onSetAuto: suspend (Boolean) -> Boolean,
    onSaveTime: suspend (String, String) -> Boolean,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    var autoOn by remember { mutableStateOf(initialAutoOn) }
    var time by remember { mutableStateOf(initialTime) }
    var timezone by remember { mutableStateOf(initialTimezone) }
    var showTimePicker by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }

    fun setAuto(value: Boolean) {
        if (value && !canUseAutopilot) {
            errorText = "Upgrade to Pro to enable autopilot."
            return
        }
        autoOn = value // optimistic
        busy = true
        scope.launch {
            val ok = onSetAuto(value)
            busy = false
            if (!ok) {
                autoOn = !value // revert
                errorText = "Failed to update autopilot. Try again."
            }
        }
    }

    fun persistTime(newTime: String, newZone: String) {
        scope.launch {
            val ok = onSaveTime(newTime, newZone)
            if (!ok) errorText = "Failed to save the autopilot time."
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF0B1011),
    ) {
        SheetTitleBar(title = "AutoPilot", onDismiss = onDismiss)

        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            AutoHeader(agentName = agentName, accent = accent)

            ToggleCard(
                autoOn = autoOn,
                accent = accent,
                enabled = !busy && canUseAutopilot,
                canUseAutopilot = canUseAutopilot,
                onToggle = { setAuto(it) },
            )

            AnimatedVisibility(visible = autoOn) {
                ScheduleCard(
                    displayTime = displayTime(time),
                    zoneAbbr = AgentTimezoneOption.abbr(timezone),
                    accent = accent,
                    onClick = { showTimePicker = true },
                )
            }

            RunsSection(recentRuns = recentRuns, remaining = remaining, maxDaily = maxDaily, accent = accent)

            errorText?.let {
                Text(it, color = AppColors.appLoss, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(Modifier.height(8.dp))
        }
    }

    if (showTimePicker) {
        TimePickerModal(
            time = time,
            timezone = timezone,
            onConfirm = { newTime, newZone ->
                time = newTime
                timezone = newZone
                showTimePicker = false
                persistTime(newTime, newZone)
            },
            onDismiss = { showTimePicker = false },
        )
    }
}

@Composable
private fun AutoHeader(agentName: String, accent: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(44.dp).background(accent.copy(alpha = 0.18f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(agentSymbol("bolt.badge.automatic"), contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.weight(1f)) {
            Text("AutoPilot", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
            Text("Let $agentName generate picks for you daily.", color = AppColors.appTextSecondary, fontSize = 12.sp)
        }
    }
}

@Composable
private fun ToggleCard(
    autoOn: Boolean,
    accent: Color,
    enabled: Boolean,
    canUseAutopilot: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(16.dp))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Auto-generate picks", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text(
                    if (autoOn) "On — runs automatically each day" else "Off — you generate manually",
                    color = AppColors.appTextSecondary,
                    fontSize = 12.sp,
                )
            }
            Switch(
                checked = autoOn,
                onCheckedChange = { if (enabled) onToggle(it) },
                enabled = enabled,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = accent,
                ),
            )
        }
        if (!canUseAutopilot) {
            Text(
                "Upgrade to Pro to enable autopilot.",
                color = Color(0xFFF59E0B),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun ScheduleCard(displayTime: String, zoneAbbr: String, accent: Color, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(16.dp))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(agentSymbol("clock"), contentDescription = null, tint = accent, modifier = Modifier.size(20.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Preferred time", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text("Runs shortly after this each day.", color = AppColors.appTextSecondary, fontSize = 12.sp)
        }
        Text(
            "$displayTime $zoneAbbr",
            color = accent,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
        )
        Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun RunsSection(recentRuns: List<AgentRunSummaryRow>, remaining: Int, maxDaily: Int, accent: Color) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("RECENT RUNS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Spacer(Modifier.weight(1f))
            Text(
                "$remaining/$maxDaily left today",
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
            )
        }
        if (recentRuns.isEmpty()) {
            Text(
                "No runs yet. Generate picks or turn on autopilot to see the agent's run history here.",
                color = AppColors.appTextSecondary,
                fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            )
        } else {
            recentRuns.forEach { RunRow(it, accent) }
        }
    }
}

@Composable
private fun RunRow(run: AgentRunSummaryRow, accent: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.035f), RoundedCornerShape(14.dp))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(14.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier.size(38.dp).background(accent.copy(alpha = 0.14f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                agentSymbol(if (run.pickCount > 0) "doc.text.image" else "moon.zzz"),
                contentDescription = null,
                tint = if (run.pickCount > 0) accent else AppColors.appTextSecondary,
                modifier = Modifier.size(15.dp),
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                run.displayDate + (if (run.isToday) " · Today" else ""),
                color = AppColors.appTextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                run.subtitle,
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
                maxLines = 1,
            )
        }
        if (run.pickCount > 0) {
            Text(
                "${run.pickCount} pick${if (run.pickCount == 1) "" else "s"}",
                color = AppColors.appTextPrimary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.background(accent.copy(alpha = 0.2f), CircleShape).padding(horizontal = 8.dp, vertical = 4.dp),
            )
        } else {
            Text(
                "Passed",
                color = AppColors.appTextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.background(Color.White.copy(alpha = 0.08f), CircleShape).padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }
    }
}

// MARK: - Shared sheet bits

/** Inline title bar with a trailing Done — mirrors the swift NavigationStack. */
@Composable
private fun SheetTitleBar(title: String, onDismiss: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.weight(1f))
        TextButton(onClick = onDismiss) {
            Text("Done", color = AppColors.appTextPrimary, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** "HH:mm" 24h → "h:mm a" for display. */
private fun displayTime(time: String): String {
    val parts = time.split(":")
    val h = parts.getOrNull(0)?.toIntOrNull()
    val m = parts.getOrNull(1)?.toIntOrNull()
    if (parts.size != 2 || h == null || m == null) return time
    val ampm = if (h >= 12) "PM" else "AM"
    val h12 = if (h % 12 == 0) 12 else h % 12
    return String.format("%d:%02d %s", h12, m, ampm)
}

// MARK: - Recent run row model

/**
 * One row in the AutoPilot sheet's "Recent runs" list. Derived client-side from
 * the agent's picks (grouped by game date) + today's run summary — there's no
 * dedicated runs endpoint, so a date that produced picks == a run, and a 0-pick
 * today's-run summary surfaces as a "Passed" row.
 */
data class AgentRunSummaryRow(
    val id: String,
    /** "yyyy-MM-dd" game/slate date. */
    val date: String,
    val pickCount: Int,
    val wins: Int,
    val losses: Int,
    val pushes: Int,
    val pending: Int,
    /** Slate note for a run that produced no picks (else null). */
    val note: String?,
    val isToday: Boolean,
) {
    /** "Jul 1" style date label. */
    val displayDate: String
        get() {
            val parts = date.split("-")
            val m = parts.getOrNull(1)?.toIntOrNull()
            val d = parts.getOrNull(2)?.toIntOrNull()
            if (parts.size != 3 || m == null || d == null || m !in 1..12) return date
            val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
            return "${months[m - 1]} $d"
        }

    /** Record / status subtitle under the date. */
    val subtitle: String
        get() {
            if (pickCount == 0) return note ?: "No picks"
            if (pending == pickCount) return "Awaiting results"
            val parts = mutableListOf<String>()
            if (wins + losses + pushes > 0) {
                parts.add("$wins-$losses${if (pushes > 0) "-$pushes" else ""}")
            }
            if (pending > 0) parts.add("$pending pending")
            return if (parts.isEmpty()) "Awaiting results" else parts.joinToString(" · ")
        }

    companion object {
        /**
         * Group picks by slate date into run rows (newest first), appending
         * today's "passed" run when it produced nothing.
         */
        fun derive(
            picks: List<AgentPick>,
            todaysRun: AgentGenerationRunSummary?,
            todayStr: String,
            limit: Int = 14,
        ): List<AgentRunSummaryRow> {
            val byDate = HashMap<String, MutableList<AgentPick>>()
            for (p in picks) {
                if (p.gameDate.isEmpty()) continue
                byDate.getOrPut(p.gameDate) { mutableListOf() }.add(p)
            }
            val rows = byDate.map { (date, ps) ->
                AgentRunSummaryRow(
                    id = date,
                    date = date,
                    pickCount = ps.size,
                    wins = ps.count { it.result == AgentPick.PickResultStatus.WON },
                    losses = ps.count { it.result == AgentPick.PickResultStatus.LOST },
                    pushes = ps.count { it.result == AgentPick.PickResultStatus.PUSH },
                    pending = ps.count { it.result == AgentPick.PickResultStatus.PENDING },
                    note = null,
                    isToday = date == todayStr,
                )
            }.toMutableList()

            // Surface a no-pick today's run (agent ran and passed) so autopilot
            // "nothing today" outcomes are visible, not silently missing.
            if (todaysRun != null && todaysRun.picksGenerated == 0 && rows.none { it.date == todayStr }) {
                val note = when {
                    todaysRun.noGames -> "No games in preferred sports"
                    todaysRun.weakSlate -> "Slate too weak — passed"
                    else -> todaysRun.slateNote ?: "Passed on the slate"
                }
                rows.add(
                    AgentRunSummaryRow(
                        id = todayStr, date = todayStr, pickCount = 0,
                        wins = 0, losses = 0, pushes = 0, pending = 0,
                        note = note, isToday = true,
                    ),
                )
            }
            return rows.sortedByDescending { it.date }.take(limit)
        }

        /** Local "yyyy-MM-dd" for today — matches `AgentDetailStore`'s date keying. */
        fun todayString(): String = LocalDate.now().toString()
    }
}
