package com.wagerproof.app.features.agents.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.animation.core.VisibilityThreshold
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.services.TriggerV3RunStatus
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.OffsetDateTime
import java.util.Locale
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.sin

/**
 * Linear polling-progress bar tinted with the agent accent — port of iOS
 * `GenerationLoadingBar.swift`. [fraction] is turn / maxTurns, clamped 0..1.
 */
@Composable
fun GenerationLoadingBar(
    fraction: Float,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val animated by animateFloatAsState(
        targetValue = fraction.coerceIn(0f, 1f),
        animationSpec = tween(durationMillis = 500),
        label = "generationProgress",
    )
    LinearProgressIndicator(
        progress = { animated },
        modifier = modifier.fillMaxWidth(),
        color = accent,
        trackColor = AppColors.appSurfaceMuted,
    )
}

/** Polling-state working orange (iOS `kGenerationOrange` family). */
private val GenerationOrange = Color(0xFFFF8A00)
private val SuccessGreen = Color(0xFF00E676)

/**
 * The Today's Picks generation card — port of iOS `AgentGenerationCard`
 * (AgentGenerationGlyphLoader.swift). One card that owns both states:
 *
 *   • **Research (idle):** the agent's pixel avatar + "Research in Progress"
 *     line, with a generate CTA (locked copy when [canGenerate] is false).
 *   • **Polling (running):** live action verbs from the Trigger.dev run
 *     metadata, a picks-found chip, a [ToolActivityStack] that deals one blank
 *     ticket per cumulative tool call, an elapsed-run timer, and a
 *     [GenerationLoadingBar] (turn/maxTurns).
 *
 * The tool stack + timer are progress information, not decoration: without them
 * a stalled ~2-minute run reads identically to a healthy one.
 *
 * Research state seats the agent at a laptop ([WorkingDeskAvatar]) over a
 * [GlyphMatrix3x3] + [ResearchShimmerText], with a [SwipeToGeneratePill] to
 * kick off a run; polling swaps in [ThinkingVerbs] + [PixelPulseWaves] behind
 * the [ToolActivityStack] deck — a spring morph animates the swap in place.
 */
@Composable
fun AgentGenerationCard(
    spriteIndex: Int,
    accent: Color,
    state: TriggerV3RunStatus?,
    isGenerating: Boolean,
    canGenerate: Boolean,
    lockedLabel: String,
    conclusion: String? = null,
    onGenerate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = state?.metadata
    val polling = isGenerating
    // turn/maxTurns, capped below 1 until terminal; a sliver pre-first-turn so
    // the bar still reads as alive (mirrors the iOS fraction derivation).
    val fraction: Float = when {
        state?.isTerminal == true -> 1f
        (meta?.maxTurns ?: 0) > 0 -> minOf(0.96f, (meta?.turn ?: 0).toFloat() / (meta?.maxTurns ?: 1).toFloat())
        (meta?.turn ?: 0) > 0 -> 0.12f
        else -> 0.05f
    }
    val picksFound = meta?.picksAccepted ?: 0
    val toolCalls = meta?.toolCalls ?: 0
    val currentToolLabel: String? = meta?.currentTool?.takeIf { it.isNotEmpty() }?.let { tool ->
        meta.currentToolDetail?.takeIf { it.isNotEmpty() }?.let { "$tool · $it" } ?: tool
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(Color.Black)
            .border(1.dp, accent.copy(alpha = 0.16f), RoundedCornerShape(26.dp)),
    ) {
        if (polling) {
            PixelPulseWaves(accent = accent, modifier = Modifier.matchParentSize())
        }
        Column(
            modifier = Modifier
                .padding(16.dp)
                // iOS `.animation(.spring(response: 0.6, dampingFraction: 0.85),
                // value: isGenerating)`; response=0.6s -> stiffness = (2*pi/0.6)^2.
                .animateContentSize(animationSpec = spring(dampingRatio = 0.85f, stiffness = 110f, visibilityThreshold = IntSize.VisibilityThreshold)),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
        // The no-picks conclusion sits ABOVE the avatar (two green console lines).
        if (conclusion != null && !polling) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ConsoleLine("Analysis complete: no high-confidence picks found.", SuccessGreen)
                ConsoleLine(conclusion, SuccessGreen.copy(alpha = 0.72f))
            }
        }

        AnimatedVisibility(visible = !polling, enter = fadeIn(), exit = fadeOut()) {
            // Research state: the seated-at-laptop character, centered.
            Box(Modifier.fillMaxWidth().padding(top = 12.dp), contentAlignment = Alignment.Center) {
                WorkingDeskAvatar(spriteIndex = spriteIndex, accent = accent, charHeight = 120.dp)
            }
        }
        AnimatedVisibility(
            visible = polling && picksFound > 0,
            enter = scaleIn(initialScale = 0.7f) + fadeIn(),
            exit = fadeOut(),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Row(
                    Modifier
                        .background(accent.copy(alpha = 0.18f), CircleShape)
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(agentSymbol("checkmark.seal.fill"), contentDescription = null, tint = accent, modifier = Modifier.size(10.dp))
                    AnimatedContent(
                        targetState = picksFound,
                        transitionSpec = { (slideInVertically { it } + fadeIn()) togetherWith (slideOutVertically { -it } + fadeOut()) },
                        label = "picksFoundCount",
                    ) { count ->
                        Text("$count found", color = accent, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }

        // Tool tickets deal in ABOVE the status line so the verb row stays pinned
        // directly over the progress bar and never relocates (iOS ordering).
        AnimatedVisibility(visible = polling, enter = fadeIn(), exit = fadeOut()) {
            ToolActivityStack(count = toolCalls, accent = accent, modifier = Modifier.fillMaxWidth())
        }

        // Status line: the glyph + text stay in the SAME slot across the whole run
        // (iOS keeps one persistent glyph so its color/speed eases, not swaps).
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            GlyphMatrix3x3(accent = if (polling) GenerationOrange else accent)
            Box(Modifier.weight(1f)) {
                Crossfade(targetState = polling, label = "statusText") { isPolling ->
                    if (isPolling) {
                        ThinkingVerbs(accent = GenerationOrange, label = currentToolLabel)
                    } else {
                        ResearchShimmerText("Research in Progress", fontSize = 14.sp)
                    }
                }
            }
            AnimatedVisibility(visible = polling, enter = fadeIn(), exit = fadeOut()) {
                ElapsedTimerText(startedAt = state?.startedAt, color = GenerationOrange)
            }
        }

        // Bottom bar: loading bar while polling, swipe-to-generate pill while idle.
        Crossfade(targetState = polling, label = "bottomBar") { isPolling ->
            if (isPolling) {
                GenerationLoadingBar(
                    fraction = fraction,
                    accent = accent,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                )
            } else {
                SwipeToGeneratePill(
                    title = if (canGenerate) "Swipe to get picks" else lockedLabel,
                    accent = accent,
                    isEnabled = canGenerate,
                    onCommit = onGenerate,
                    modifier = Modifier.padding(horizontal = 14.dp).padding(bottom = 6.dp),
                )
            }
        }
        }
    }
}

@Composable
private fun ConsoleLine(text: String, tint: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("›", color = SuccessGreen, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
        Text(text, color = tint, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
    }
}

/**
 * Elapsed-run readout beside the action verbs (iOS `ElapsedTimerText`). Seeded
 * from the run's `startedAt` when the server supplies one, so the timer stays
 * truthful across a screen re-entry mid-run instead of restarting at 00.0s;
 * falls back to first-composition when the timestamp is missing/unparseable.
 */
@Composable
private fun ElapsedTimerText(startedAt: String?, color: Color) {
    // Keyed on startedAt so a NEW run re-seeds; a re-composition of the same run does not.
    val originMillis = remember(startedAt) {
        parseRunStartMillis(startedAt) ?: System.currentTimeMillis()
    }
    var elapsed by remember(startedAt) { mutableStateOf(elapsedSeconds(originMillis, System.currentTimeMillis())) }
    LaunchedEffect(originMillis) {
        // 0.2s cadence: smooth enough for a tenths readout, ~5 updates/sec.
        while (true) {
            elapsed = elapsedSeconds(originMillis, System.currentTimeMillis())
            delay(200)
        }
    }
    Text(
        formatElapsed(elapsed),
        color = color,
        fontSize = 13.sp,
        fontWeight = FontWeight.Black,
        fontFamily = FontFamily.Monospace,
        maxLines = 1,
    )
}

/**
 * Parse a Trigger.dev run `startedAt` (ISO-8601, with or without an offset) to
 * epoch millis. Returns null for null/blank/garbage so callers can fall back.
 */
internal fun parseRunStartMillis(raw: String?): Long? {
    val text = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return runCatching { Instant.parse(text).toEpochMilli() }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(text).toInstant().toEpochMilli() }.getOrNull()
}

/** Seconds between two epoch-millis stamps, floored at 0 (clock skew is not negative time). */
internal fun elapsedSeconds(originMillis: Long, nowMillis: Long): Double =
    ((nowMillis - originMillis).coerceAtLeast(0L)) / 1000.0

/** `%04.1fs` — zero-padded to a stable width so the row never reflows (iOS format). */
internal fun formatElapsed(seconds: Double): String =
    String.format(Locale.US, "%04.1fs", seconds)

// MARK: - Continuous frame clock

/** Redraw rate for the idle glyph matrix — no need to repaint faster than this. */
private const val ELAPSED_QUANTUM_HZ = 24f

/** Wall-clock seconds since first composition — port of iOS `TimelineView(.animation)`'s `t`. */
@Composable
private fun rememberElapsedSeconds(): State<Float> = produceState(initialValue = 0f) {
    val start = withFrameNanos { it }
    while (true) {
        withFrameNanos { now ->
            // Still wakes at display rate (withFrameNanos pauses with the frame clock when
            // idle), but only WRITES state when the quantized bucket changes — otherwise this
            // repainted the Canvas at up to 120Hz for a matrix that only needs 24.
            val elapsed = (now - start) / 1_000_000_000f
            val quantized = floor(elapsed * ELAPSED_QUANTUM_HZ) / ELAPSED_QUANTUM_HZ
            if (quantized != value) value = quantized
        }
    }
}

// MARK: - 3x3 glyph matrix

/**
 * A tiny 3x3 dot matrix cycling three "glyphing" animations — a diagonal
 * sweep, a horizontal sweep, and a ring spin — 4 full sweeps per form before
 * the next takes over. Port of iOS `GlyphMatrix3x3`.
 */
@Composable
fun GlyphMatrix3x3(
    accent: Color,
    modifier: Modifier = Modifier,
    cycleSeconds: Float = 1.0f,
    dot: Dp = 4.5.dp,
    gap: Dp = 5.dp,
) {
    val cyclesPerForm = 4
    val t by rememberElapsedSeconds()
    val side = dot * 3 + gap * 2
    Canvas(modifier = modifier.size(side)) {
        val formDuration = cycleSeconds * cyclesPerForm
        val mode = ((t / formDuration).toInt()) % 3
        val local = (t % cycleSeconds) / cycleSeconds
        val cell = size.width / 3
        val dotPx = dot.toPx()
        for (r in 0 until 3) {
            for (c in 0 until 3) {
                val b = glyphBrightness(mode, r, c, local)
                val cx = (c + 0.5f) * cell
                val cy = (r + 0.5f) * cell
                val s = dotPx * (0.7f + 0.7f * b)
                drawRoundRect(
                    color = accent.copy(alpha = (0.16f + 0.84f * b).coerceIn(0f, 1f)),
                    topLeft = Offset(cx - s / 2f, cy - s / 2f),
                    size = Size(s, s),
                    cornerRadius = CornerRadius(s * 0.3f),
                )
            }
        }
    }
}

/** Per-dot brightness (0..1) for the current animation mode — port of the iOS `switch`. */
private fun glyphBrightness(mode: Int, r: Int, c: Int, local: Float): Float = when (mode) {
    0 -> {
        // Diagonal band travelling top-left -> bottom-right (5 diagonals).
        val phase = (r + c) / 4f
        gauss(phase - local, 0.18f)
    }
    1 -> {
        // Vertical band travelling left -> right across the columns.
        val phase = c / 2f
        gauss(phase - local, 0.16f)
    }
    else -> {
        // Spin: a pointer rotates around the 8 outer dots; center pulses.
        if (r == 1 && c == 1) {
            0.35f + 0.35f * sin(local * 2 * Math.PI.toFloat())
        } else {
            val angle = atan2((r - 1).toFloat(), (c - 1).toFloat()) // -pi..pi
            val pointer = local * 2 * Math.PI.toFloat() - Math.PI.toFloat() // -pi..pi
            var d = abs(angle - pointer)
            if (d > Math.PI.toFloat()) d = 2 * Math.PI.toFloat() - d // wrap
            gauss(d / Math.PI.toFloat(), 0.16f)
        }
    }
}

private fun gauss(x: Float, sigma: Float): Float = exp(-(x * x) / (2 * sigma * sigma))

// MARK: - Thinking verbs

private val ThinkingVerbsList = listOf(
    "Reading the slate",
    "Scanning the lines",
    "Crunching the model",
    "Weighing the edges",
    "Checking the public",
    "Pricing the value",
    "Cross-referencing odds",
    "Stress-testing picks",
    "Reasoning it through",
    "Locking it in",
)

/** ~2 shimmer cycles — matches iOS's `dwellSeconds`. */
private const val THINKING_VERB_DWELL_MS = 2800L

/**
 * Polling status text — cycles curated verbs on a dwell, port of iOS
 * `ThinkingVerbs`. When [label] (the live humanized tool from run metadata)
 * is non-null it's shown instead, throttled to the SAME dwell so rapid tool
 * changes don't flicker.
 */
@Composable
fun ThinkingVerbs(accent: Color, label: String?, modifier: Modifier = Modifier) {
    var displayed by remember { mutableStateOf(label ?: ThinkingVerbsList[0]) }
    var index by remember { mutableStateOf(0) }
    // Always reads the LATEST label inside the long-running dwell loop below —
    // a plain captured val would be stale across recompositions.
    val liveLabel = rememberUpdatedState(label)

    LaunchedEffect(Unit) {
        while (true) {
            delay(THINKING_VERB_DWELL_MS)
            if (liveLabel.value == null) index++
            displayed = liveLabel.value ?: ThinkingVerbsList[index % ThinkingVerbsList.size]
        }
    }
    AnimatedContent(
        targetState = displayed,
        transitionSpec = {
            (slideInVertically { it / 3 } + fadeIn(tween(420))) togetherWith
                (slideOutVertically { -it / 3 } + fadeOut(tween(420)))
        },
        label = "thinkingVerb",
        modifier = modifier,
    ) { word ->
        Box {
            Text(word, color = accent, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                word,
                color = Color.White.copy(alpha = 0.55f),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.shimmering(),
            )
        }
    }
}

// MARK: - Pixel pulse waves (polling background)

/**
 * Polling-state background: a dense pixel field whose brightness pulses in
 * vertical bands travelling RIGHT -> LEFT, reading as an energetic field of
 * "signal" washing across behind the card content. Port of iOS
 * `PixelPulseWaves` (pure ambiance — progress is shown by the loading bar).
 */
@Composable
fun PixelPulseWaves(accent: Color, modifier: Modifier = Modifier) {
    val t by rememberElapsedSeconds()
    val spacing = 9.dp
    val dot = 4.dp
    Canvas(modifier = modifier.background(Color(0xFF070A0A).copy(alpha = 0.65f))) {
        if (size.width <= 0f || size.height <= 0f) return@Canvas
        val spacingPx = spacing.toPx()
        val dotPx = dot.toPx()
        val cols = maxOf(1, (size.width / spacingPx).toInt())
        val rows = maxOf(1, (size.height / spacingPx).toInt())
        val cellW = size.width / cols
        val cellH = size.height / rows
        for (y in 0 until rows) {
            val py = (y + 0.5f) * cellH
            for (x in 0 until cols) {
                val px = (x + 0.5f) * cellW
                val op = pulseWaveOpacity(x, y, t)
                if (op < 0.012f) continue
                drawRoundRect(
                    color = accent.copy(alpha = op),
                    topLeft = Offset(px - dotPx / 2f, py - dotPx / 2f),
                    size = Size(dotPx, dotPx),
                    cornerRadius = CornerRadius(dotPx * 0.3f),
                )
            }
        }
    }
}

/** A wide band across the columns; `+ t` slides the crest right -> left, plus a per-cell twinkle. */
private fun pulseWaveOpacity(x: Int, y: Int, t: Float): Float {
    val band = 0.5f + 0.5f * sin(x * 0.5f + y * 0.12f + t * 1.7f)
    val twinkle = 0.5f + 0.5f * sin(t * 2.4f + x * 0.3f + y * 0.8f)
    val op = 0.06f + 0.34f * (band * band) + 0.05f * twinkle
    return minOf(0.7f, op)
}
