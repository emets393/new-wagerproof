package com.wagerproof.app.features.agents.components

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.backgrounds.PixelWaveBackground
import com.wagerproof.core.design.backgrounds.PixelWaveIntensity
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentPick
import kotlinx.coroutines.delay

// =====================================================================
// AgentPickFocusView — tap-to-focus + "print-then-swipe" presentation of
// expanded tickets over a darkened backdrop, with a "Play n/N" header + dots.
// Port of iOS AgentPickFocusView.swift.
//
// FIDELITY-WAIVER #203: iOS CoreMotion (device attitude) → Android
// SensorManager TYPE_ACCELEROMETER for the ticket parallax lean.
// iOS shares a rendered ticket image; Android exposes the equivalent native
// share sheet with a complete text rendering of the currently visible ticket.
// FIDELITY-WAIVER #214: the receipt-printer feed's exact per-card measurement +
// slot masking is approximated with a fractional translate of the first card.
// =====================================================================

private const val CARD_MAX_TILT_DEG = 8f
private const val MAX_DOTS = 8

@Composable
fun AgentPickFocusView(
    items: List<AgentBetItem>,
    accent: Color,
    startIndex: Int = 0,
    printIntro: Boolean = false,
    onAudit: (AgentPick) -> Unit,
    onDelete: ((AgentBetItem) -> Unit)? = null,
    onClose: () -> Unit,
) {
    if (items.isEmpty()) return
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    val reduceMotion = remember { isReduceMotion(context) }

    val pagerState = rememberPagerState(
        initialPage = startIndex.coerceIn(0, items.lastIndex),
        pageCount = { items.size },
    )
    val index = pagerState.currentPage

    var appeared by remember { mutableStateOf(false) }
    var printed by remember { mutableStateOf(!printIntro) }
    var printProgress by remember { mutableFloatStateOf(if (printIntro) 0f else 1f) }
    var waveOpacity by remember { mutableFloatStateOf(0f) }
    var live by remember { mutableStateOf(false) }

    // Accelerometer lean (roll = x, pitch = y), normalized [-1,1], smoothed.
    val motion = remember { PickTicketMotionState() }
    if (live && !reduceMotion) {
        DisposableEffect(Unit) {
            val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            val sensor = sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            val listener = object : SensorEventListener {
                override fun onSensorChanged(event: SensorEvent) {
                    motion.apply(event.values[0], event.values[1])
                }
                override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
            }
            if (sensor != null) sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
            onDispose { sm?.unregisterListener(listener) }
        }
    }

    val appearedAlpha by animateFloatAsState(if (appeared) 1f else 0f, label = "focusAppeared")

    LaunchedEffect(Unit) {
        appeared = true
        if (!printIntro) {
            if (!reduceMotion) live = true
            return@LaunchedEffect
        }
        if (reduceMotion) {
            printProgress = 1f
            printed = true
            return@LaunchedEffect
        }
        // Generation complete: high-intensity wave washes in, holds, recedes.
        waveOpacity = 1f
        delay(850)
        waveOpacity = 0f
        // Receipt-printer feed: 12 chunks, one per 140ms.
        val chunks = 12
        for (i in 1..chunks) {
            delay(140)
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            printProgress = i.toFloat() / chunks
        }
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        printed = true
        live = true
    }

    fun close() {
        live = false
        appeared = false
        onClose()
    }

    BackHandler(onBack = ::close)

    Box(Modifier.fillMaxSize().graphicsLayer { alpha = appearedAlpha }) {
        // Backdrop.
        if (printIntro) {
            Box(Modifier.fillMaxSize().background(Color.Black).clickable { close() }) {
                // Inert ambient field (visual only — no ripple gesture).
                PixelWaveBackground(modifier = Modifier.fillMaxSize(), accentColor = accent, reduceMotion = reduceMotion)
            }
        } else {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.74f)).clickable { close() })
        }

        // Header + printer region.
        Column(
            Modifier.fillMaxSize().padding(horizontal = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Header(index, items.size, accent, Modifier.padding(top = 8.dp).graphicsLayer { alpha = if (printed) 1f else 0f })
            PrinterRegion(
                items = items,
                accent = accent,
                pagerState = pagerState,
                printIntro = printIntro,
                printed = printed,
                printProgress = printProgress,
                motion = motion,
                currentPage = index,
                onAudit = onAudit,
                modifier = Modifier.fillMaxWidth().weight(1f),
            )
        }

        // High-intensity wave cover (transition into the print UI).
        if (printIntro) {
            val waveAlpha by animateFloatAsState(waveOpacity, label = "waveCover")
            Box(Modifier.fillMaxSize().graphicsLayer { alpha = waveAlpha }) {
                PixelWaveBackground(modifier = Modifier.fillMaxSize(), accentColor = accent, intensity = PixelWaveIntensity.High, reduceMotion = reduceMotion)
            }
        }

        // Top bar (back + share) — top-most.
        Row(
            Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.statusBars)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            GlassCircleButton("chevron.left", contentDescription = "Close") { close() }
            Spacer(Modifier.weight(1f))
            Box(Modifier.graphicsLayer { alpha = if (printed) 1f else 0f }) {
                GlassCircleButton("square.and.arrow.up", contentDescription = "Share this play") {
                    shareTicket(context, items[index])
                }
            }
            if (onDelete != null) {
                Spacer(Modifier.width(8.dp))
                Box(Modifier.graphicsLayer { alpha = if (printed) 1f else 0f }) {
                    GlassCircleButton(
                        icon = "trash",
                        contentDescription = "Delete this play",
                        tint = AppColors.appLoss,
                    ) { onDelete(items[index]) }
                }
            }
        }
    }
}

private fun shareTicket(context: Context, item: AgentBetItem) {
    val body = when (item) {
        is AgentBetItem.Pick -> buildString {
            val pick = item.pick
            appendLine("WagerProof Pick")
            appendLine("${pick.sport.raw.uppercase()} · ${pick.matchup}")
            append(pick.pickSelection)
            pick.odds?.takeIf { it.isNotBlank() }?.let { append("  $it") }
            appendLine()
            appendLine("${pick.units}u · Confidence ${pick.confidence}/5")
            if (pick.reasoningText.isNotBlank()) append(pick.reasoningText)
        }
        is AgentBetItem.Parlay -> buildString {
            val parlay = item.parlay
            appendLine("WagerProof ${parlay.displayLegsCount}-Leg Parlay")
            parlay.legs.forEachIndexed { legIndex, leg ->
                append("${legIndex + 1}. ${leg.pickSelection}")
                leg.odds?.takeIf { it.isNotBlank() }?.let { append("  $it") }
                if (leg.matchup.isNotBlank()) append(" · ${leg.matchup}")
                appendLine()
            }
            parlay.combinedOdds?.takeIf { it.isNotBlank() }?.let { appendLine("Combined odds: $it") }
            appendLine("${parlay.units}u · Confidence ${parlay.confidence}/5")
            if (parlay.reasoningText.isNotBlank()) append(parlay.reasoningText)
        }
    }.trim()

    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, "WagerProof play")
        putExtra(Intent.EXTRA_TEXT, body)
    }
    runCatching {
        context.startActivity(Intent.createChooser(sendIntent, "Share play"))
    }
}

@Composable
private fun Header(index: Int, count: Int, accent: Color, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Play ${index + 1}/$count", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
        if (count in 2..MAX_DOTS) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(count) { i ->
                    Box(Modifier.size(6.dp).clip(CircleShape).background(if (i == index) accent else Color.White.copy(alpha = 0.25f)))
                }
            }
        }
    }
}

@Composable
private fun PrinterRegion(
    items: List<AgentBetItem>,
    accent: Color,
    pagerState: androidx.compose.foundation.pager.PagerState,
    printIntro: Boolean,
    printed: Boolean,
    printProgress: Float,
    motion: PickTicketMotionState,
    currentPage: Int,
    onAudit: (AgentPick) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier) {
        if (printIntro && !printed) {
            // First ticket feeding up out of the slot — approximated as a
            // fractional translate from below (FIDELITY-WAIVER #214).
            val first = items.first()
            val progress by animateFloatAsState(printProgress, label = "printFeed")
            Box(
                Modifier
                    .fillMaxWidth()
                    .graphicsLayer { translationY = (1f - progress) * size.height },
            ) {
                TicketView(first, accent, withAudit = false, onAudit = onAudit)
            }
            // Slot bar pinned to the bottom.
            Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 4.dp)) {
                SlotBar()
            }
        } else {
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                val leaning = page == currentPage
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .graphicsLayer {
                            if (leaning) {
                                rotationX = motion.pitch * CARD_MAX_TILT_DEG
                                rotationY = -motion.roll * CARD_MAX_TILT_DEG
                            }
                        }
                        .padding(top = 6.dp, bottom = 48.dp),
                ) {
                    TicketView(items[page], accent, withAudit = true, onAudit = onAudit)
                }
            }
        }
    }
}

@Composable
private fun TicketView(
    item: AgentBetItem,
    accent: Color,
    withAudit: Boolean,
    onAudit: (AgentPick) -> Unit,
) {
    when (item) {
        is AgentBetItem.Pick -> ExpandedAgentPickTicket(
            pick = item.pick,
            accent = accent,
            showsBranding = true,
            onAudit = if (withAudit) ({ onAudit(item.pick) }) else null,
        )
        is AgentBetItem.Parlay -> ExpandedAgentParlayTicket(parlay = item.parlay, accent = accent, showsBranding = true)
    }
}

@Composable
private fun SlotBar() {
    Box(
        Modifier
            .fillMaxWidth()
            .height(7.dp)
            .clip(CircleShape)
            .background(Brush.verticalGradient(listOf(AppColors.printerSlotTop, AppColors.printerSlotBottom)))
            .border(1.dp, Color.White.copy(alpha = 0.14f), CircleShape),
    )
}

@Composable
private fun GlassCircleButton(
    icon: String,
    contentDescription: String,
    tint: Color = Color.White,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(42.dp)
            .liquidGlassBackground(CircleShape)
            .border(1.dp, Color.White.copy(alpha = 0.16f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(agentSymbol(icon), contentDescription, tint = tint, modifier = Modifier.size(16.dp))
    }
}

/**
 * Accelerometer lean state — SensorManager port of iOS PickTicketMotion. Emits a
 * normalized, smoothed, self-centering lean in [-1, 1]. FIDELITY-WAIVER #203.
 */
private class PickTicketMotionState {
    var roll by mutableFloatStateOf(0f)
    var pitch by mutableFloatStateOf(0f)

    private var baselineRoll: Float? = null
    private var baselinePitch: Float? = null
    private val maxUnits = 4.5f       // accel units mapping to full ±1 lean
    private val smoothing = 0.09f
    private val baselineDrift = 0.04f

    fun apply(x: Float, y: Float) {
        val bRoll = baselineRoll
        val bPitch = baselinePitch
        if (bRoll == null || bPitch == null) {
            baselineRoll = x
            baselinePitch = y
            roll = 0f
            pitch = 0f
            return
        }
        val targetRoll = clamp(x - bRoll) / maxUnits
        val targetPitch = clamp(y - bPitch) / maxUnits
        baselineRoll = bRoll + (x - bRoll) * baselineDrift
        baselinePitch = bPitch + (y - bPitch) * baselineDrift
        roll += (targetRoll - roll) * smoothing
        pitch += (targetPitch - pitch) * smoothing
    }

    private fun clamp(v: Float): Float = v.coerceIn(-maxUnits, maxUnits)
}

private fun isReduceMotion(context: Context): Boolean =
    try {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    } catch (_: Throwable) {
        false
    }
