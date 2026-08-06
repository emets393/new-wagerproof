package com.wagerproof.app.features.agents.components

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.IntentSender
import android.graphics.Bitmap
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.backgrounds.PixelWaveBackground
import com.wagerproof.core.design.backgrounds.PixelWaveIntensity
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.services.runCatchingCancellable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// =====================================================================
// AgentPickFocusView — tap-to-focus + "print-then-swipe" presentation of
// expanded tickets over a darkened backdrop, with a "Play n/N" header + dots.
// Port of iOS AgentPickFocusView.swift.
//
// Share renders the CURRENT ticket alone — no backdrop — to a transparent PNG
// and hands it to the system chooser, matching iOS's ImageRenderer export.
//
// FIDELITY-WAIVER #203: iOS CoreMotion (device attitude) → Android
// SensorManager TYPE_ACCELEROMETER for the ticket parallax lean.
// FIDELITY-WAIVER #215: iOS layers `.ultraThinMaterial` under the 74% black
// scrim on the plain (non-print) backdrop. A real backdrop blur needs the
// content BEHIND the overlay to publish a Haze source (LocalHazeState), which
// the agent detail screens don't — adding one is outside this view's ownership,
// so the flat scrim stands.
// =====================================================================

private const val CARD_MAX_TILT_DEG = 8f
private const val MAX_DOTS = 8

/** Rest inset of the ticket's top edge — shared by the feed and the pager so the
 *  hand-off between them lands the card in exactly the same place. */
private val TICKET_TOP_INSET = 6.dp

/** iOS renders the share card at 340 pt. */
private val SHARE_CARD_WIDTH = 340.dp

/** Frames to wait for the off-screen capture host to draw before giving up. */
private const val CAPTURE_FRAME_BUDGET = 8

private const val SHARE_RESULT_ACTION = "com.wagerproof.app.action.PLAY_SHARE_RESULT"

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
    if (items.isEmpty()) {
        // The host's focusStartIndex stays set unless we call onClose — without this the
        // BackHandler here is gone, finishFocusPresentation() never runs, and the audit
        // store stays armed (e.g. every ticket was deleted while this overlay was open).
        LaunchedEffect(Unit) { onClose() }
        return
    }
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val reviewPrompts = appGraph().reviewPrompts
    val reduceMotion = remember { isReduceMotion(context) }

    val pagerState = rememberPagerState(
        initialPage = startIndex.coerceIn(0, items.lastIndex),
        pageCount = { items.size },
    )
    val index = pagerState.currentPage
    val current = items.getOrNull(index)

    var appeared by remember { mutableStateOf(false) }
    var printed by remember { mutableStateOf(!printIntro) }
    var printProgress by remember { mutableFloatStateOf(if (printIntro) 0f else 1f) }
    var waveOpacity by remember { mutableFloatStateOf(0f) }
    var live by remember { mutableStateOf(false) }
    var shareRequest by remember { mutableStateOf<ShareRequest?>(null) }
    var shareToken by remember { mutableIntStateOf(0) }

    // Accelerometer lean (roll = x, pitch = y), normalized [-1,1], smoothed.
    val motion = remember { PickTicketMotionState() }

    // Process lifecycle gate — without this the accelerometer stays registered (and
    // draining battery) while the app is backgrounded. Mirrors PixelOffice.kt's
    // DisposableEffect/LifecycleEventObserver gate.
    val lifecycleOwner = LocalLifecycleOwner.current
    var lifecycleStarted by remember(lifecycleOwner) {
        mutableStateOf(lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED))
    }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> lifecycleStarted = true
                Lifecycle.Event.ON_STOP -> lifecycleStarted = false
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (live && !reduceMotion && lifecycleStarted) {
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

    val appearedAlpha by animateFloatAsState(if (appeared) 1f else 0f, tween(250, easing = EaseOut), label = "focusAppeared")
    // Tap-to-focus expands the card in from 0.9 while the rest fades; the print
    // intro opens on the wave + feed instead, so it starts at full size.
    val focusScale by animateFloatAsState(
        targetValue = if (printIntro || appeared) 1f else 0.9f,
        animationSpec = tween(250, easing = EaseOut),
        label = "focusScale",
    )

    // Only signal that sharing happened once the chooser reports a target was
    // actually picked — see rememberShareResultSender.
    val shareResultSender = rememberShareResultSender { reviewPrompts.recordContentShared() }

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
        // Off-screen ticket render for the share export. First child so it can
        // never win hit-testing against the real UI stacked above it.
        shareRequest?.let { request ->
            key(request.token) {
                TicketCaptureHost(request, accent) { bitmap ->
                    shareRequest = null
                    scope.launch {
                        val uri = bitmap?.let {
                            withContext(Dispatchers.IO) {
                                runCatchingCancellable { writeShareablePng(context, it) }.getOrNull()
                            }
                        }
                        sharePlay(context, request.item, uri, shareResultSender())
                    }
                }
            }
        }

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
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = focusScale
                    scaleY = focusScale
                }
                .padding(horizontal = 10.dp),
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

        // Top bar (back + share + delete) — top-most.
        Row(
            Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.statusBars)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            GlassCircleButton("chevron.left", contentDescription = "Close") { close() }
            Spacer(Modifier.weight(1f))
            if (current != null) {
                Box(Modifier.graphicsLayer { alpha = if (printed) 1f else 0f }) {
                    GlassCircleButton("square.and.arrow.up", contentDescription = "Share this play") {
                        shareRequest = ShareRequest(current, shareToken++)
                    }
                }
                // The list can shrink under the pager (a delete elsewhere), so the
                // owner-only button is gated on the index still resolving.
                if (onDelete != null) {
                    Spacer(Modifier.width(8.dp))
                    Box(Modifier.graphicsLayer { alpha = if (printed) 1f else 0f }) {
                        GlassCircleButton(
                            icon = "trash",
                            contentDescription = "Delete this play",
                            tint = AppColors.appLoss,
                        ) { onDelete(current) }
                    }
                }
            }
        }
    }
}

// MARK: - Share as ticket image

private data class ShareRequest(val item: AgentBetItem, val token: Int)

/**
 * Renders the ticket off-screen at [SHARE_CARD_WIDTH] and hands back a bitmap
 * with everything outside the cardstock transparent (iOS: `renderer.isOpaque =
 * false`).
 *
 * The on-screen ticket can't be captured directly the way the trends share sheet
 * does it: here it lives inside a vertical scroller and carries the accelerometer
 * tilt, so a live capture would be clipped to the viewport and skewed. Rendering
 * a second copy is what keeps the export the WHOLE card, flat and unclipped.
 *
 * Rendered at the DEVICE's density, not a forced 3x like iOS's ImageRenderer:
 * the team logo is a Coil AsyncImage sized in dp, so a different density asks
 * Coil for a different pixel size, misses the memory cache the on-screen ticket
 * just warmed, and exports a card with an empty logo disc. Correct content beats
 * the extra pixels — 340 dp at 2.75x is ~935 px, close to iOS's 1020.
 */
@Composable
private fun TicketCaptureHost(
    request: ShareRequest,
    accent: Color,
    onCaptured: (Bitmap?) -> Unit,
) {
    val layer = rememberGraphicsLayer()
    val captured by rememberUpdatedState(onCaptured)

    // Reports a zero-size layout so the copy never disturbs the focus layout, and
    // draws ONLY into the graphics layer (no drawLayer call) so nothing reaches
    // the screen. Measured unbounded: the export is the ticket's natural height.
    Layout(
        content = {
            Box(
                Modifier
                    .width(SHARE_CARD_WIDTH)
                    .drawWithContent { layer.record { this@drawWithContent.drawContent() } },
            ) {
                // No audit affordance — iOS shares the card without it.
                TicketView(request.item, accent, withAudit = false, onAudit = {})
            }
        }
    ) { measurables, _ ->
        val placeable = measurables.firstOrNull()?.measure(Constraints())
        layout(0, 0) { placeable?.place(0, 0) }
    }

    LaunchedEffect(request.token) {
        // withFrameNanos resumes at the START of a frame, so the first resume can
        // still precede this composition's draw pass — poll until the layer has
        // actually recorded something rather than guessing a delay.
        var frames = 0
        while (layer.size.width == 0 && frames < CAPTURE_FRAME_BUDGET) {
            withFrameNanos { }
            frames++
        }
        captured(runCatchingCancellable { layer.toImageBitmap().asAndroidBitmap() }.getOrNull())
    }
}

/**
 * Writes the rendered card to a PNG in the app's cache and hands back a
 * FileProvider uri. Filename is unique per export: a share target that defers
 * reading the file (e.g. a drafted email) can outlive the next share overwriting
 * a fixed name, so old exports are pruned here instead of reusing one file.
 */
private fun writeShareablePng(context: Context, bitmap: Bitmap): Uri {
    val dir = File(context.cacheDir, "shared-plays").apply { mkdirs() }
    dir.listFiles()?.forEach { it.delete() }
    val file = File(dir, "wagerproof-play-${System.currentTimeMillis()}.png")
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    // The authority is derived from applicationId so the .debug build doesn't
    // collide with the Play build — never hardcode it.
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

private fun sharePlay(context: Context, item: AgentBetItem, imageUri: Uri?, resultSender: IntentSender?) {
    val send = Intent(Intent.ACTION_SEND).apply {
        putExtra(Intent.EXTRA_SUBJECT, "WagerProof play")
        if (imageUri != null) {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, imageUri)
            // Some targets read the clip rather than the extra; without the
            // ClipData they hit a SecurityException on the cached file.
            clipData = ClipData.newRawUri("WagerProof play", imageUri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } else {
            // Render failed — still get the play out rather than making the
            // button silently do nothing.
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareFallbackText(item))
        }
    }
    runCatching { context.startActivity(Intent.createChooser(send, "Share play", resultSender)) }
}

/**
 * Registers the chooser's completion callback and returns a factory for the
 * [IntentSender] to hand to [Intent.createChooser].
 *
 * ACTION_SEND alone only proves the chooser OPENED. The chooser's IntentSender is
 * the single signal Android gives that the user committed to a share target,
 * which is the bar `ReviewPromptCoordinator.recordContentShared()` sets.
 */
@Composable
private fun rememberShareResultSender(onShared: () -> Unit): () -> IntentSender? {
    val context = LocalContext.current
    val callback by rememberUpdatedState(onShared)
    DisposableEffect(context) {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                if (intent?.action == SHARE_RESULT_ACTION) callback()
            }
        }
        // NOT_EXPORTED is safe: the chooser fires our own PendingIntent, so the
        // broadcast arrives with this app's identity.
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(SHARE_RESULT_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        onDispose { runCatching { context.unregisterReceiver(receiver) } }
    }
    return {
        runCatching {
            PendingIntent.getBroadcast(
                context,
                0,
                Intent(SHARE_RESULT_ACTION).setPackage(context.packageName),
                // MUTABLE so the chooser can fill in EXTRA_CHOSEN_COMPONENT —
                // an immutable sender is rejected outright.
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
            ).intentSender
        }.getOrNull()
    }
}

private fun shareFallbackText(item: AgentBetItem): String = when (item) {
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

// MARK: - Chrome

@Composable
private fun Header(index: Int, count: Int, accent: Color, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Tabular figures (iOS `.monospacedDigit()`) keep the label from shifting
        // width mid-transition as the count rolls.
        val numerals = LocalTextStyle.current.copy(fontFeatureSettings = "tnum")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Play",
                color = AppColors.appTextSecondary, fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold, letterSpacing = 0.5.sp,
            )
            Spacer(Modifier.width(4.dp))
            // iOS uses .contentTransition(.numericText()); a directional roll on
            // the changed number is the closest Compose equivalent.
            AnimatedContent(
                targetState = index + 1,
                transitionSpec = {
                    val forward = targetState > initialState
                    val enter = slideInVertically { h -> if (forward) h else -h } + fadeIn(tween(160))
                    val exit = slideOutVertically { h -> if (forward) -h else h } + fadeOut(tween(160))
                    (enter togetherWith exit).using(SizeTransform(clip = false))
                },
                label = "playCount",
            ) { number ->
                Text(
                    "$number",
                    color = AppColors.appTextSecondary, fontSize = 13.sp,
                    fontWeight = FontWeight.ExtraBold, letterSpacing = 0.5.sp, style = numerals,
                )
            }
            Text(
                "/$count",
                color = AppColors.appTextSecondary, fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold, letterSpacing = 0.5.sp, style = numerals,
            )
        }
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
    val density = LocalDensity.current
    // Measured slot geometry: the feeding card's TOP travels from the slot (the
    // region's bottom edge) to exactly the pager's rest inset, so the hand-off to
    // the pager — same width, same top anchor — has no visible jump. Clipping the
    // region is what lets the tall card keep feeding "into" the slot off-screen.
    var regionHeightPx by remember { mutableIntStateOf(0) }

    Box(modifier.onSizeChanged { regionHeightPx = it.height }.clipToBounds()) {
        if (printIntro && !printed) {
            val progress by animateFloatAsState(printProgress, tween(130, easing = EaseOut), label = "printFeed")
            val topInsetPx = with(density) { TICKET_TOP_INSET.toPx() }
            val travel = (regionHeightPx - topInsetPx).coerceAtLeast(0f)
            Box(
                Modifier
                    .align(Alignment.TopStart)
                    .fillMaxWidth()
                    // Natural (unbounded) height — the card must not be squeezed
                    // to the region, it overflows and gets clipped.
                    .wrapContentHeight(Alignment.Top, unbounded = true)
                    .graphicsLayer { translationY = topInsetPx + travel * (1f - progress) },
            ) {
                TicketView(items.first(), accent, withAudit = false, onAudit = onAudit)
            }
            // Slot bar pinned to the bottom.
            Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(horizontal = 4.dp)) {
                SlotBar()
            }
        } else {
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                val scrollState = rememberScrollState()
                val leaning = page == currentPage
                val scrolling = scrollState.isScrollInProgress
                // Flatten the lean while the ticket scrolls: rotating the scroll
                // container at sensor rate while its offset moves reads as
                // vertical jitter even though each system is smooth on its own.
                LaunchedEffect(leaning, scrolling) {
                    if (leaning) motion.setInteractionPaused(scrolling)
                }
                val tiltFactor by animateFloatAsState(
                    targetValue = if (leaning && !scrolling) 1f else 0f,
                    animationSpec = tween(120, easing = EaseOut),
                    label = "ticketTilt",
                )
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .graphicsLayer {
                            rotationX = motion.pitch * CARD_MAX_TILT_DEG * tiltFactor
                            rotationY = -motion.roll * CARD_MAX_TILT_DEG * tiltFactor
                        }
                        .padding(top = TICKET_TOP_INSET, bottom = 48.dp),
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
    private var interactionPaused = false
    private val maxUnits = 4.5f       // accel units mapping to full ±1 lean
    private val smoothing = 0.09f
    private val baselineDrift = 0.04f

    /**
     * Freeze the lean while the ticket's own scroller is moving. On release the
     * neutral attitude is re-primed so whatever pose the phone ended the drag in
     * becomes "flat" — otherwise the card snaps to the tilt the scroll gesture
     * put the device into.
     */
    fun setInteractionPaused(paused: Boolean) {
        if (interactionPaused == paused) return
        interactionPaused = paused
        // Drop the accumulated lean either way — the view owns the visible 0.12s
        // flatten, and a frozen value must never reappear when the tilt fades
        // back in before the next sensor sample lands.
        roll = 0f
        pitch = 0f
        if (!paused) {
            baselineRoll = null
            baselinePitch = null
        }
    }

    fun apply(x: Float, y: Float) {
        if (interactionPaused) return
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
