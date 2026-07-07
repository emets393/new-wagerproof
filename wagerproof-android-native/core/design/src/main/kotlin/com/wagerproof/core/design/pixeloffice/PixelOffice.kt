package com.wagerproof.core.design.pixeloffice

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.LiquidGlassCapsule
import com.wagerproof.core.design.tokens.AppColors
import java.util.Calendar
import kotlin.math.min

/**
 * The pixel-art "Agent HQ" office — Compose Canvas port of the iOS SpriteKit
 * scene (`PixelOffice.swift` + `PixelOfficeScene.swift`), itself a port of RN
 * `PixelOffice.tsx`. One `withFrameNanos` game loop steps
 * [PixelOfficeSimulation]; one Canvas redraws the 864×800 logical map
 * aspect-fit to the container.
 *
 * Draw order (iOS z-order): floor → laptops → agents sorted by mapY →
 * particles → office_fg overlay → name tags/bubbles (never occluded by
 * plants/chairs).
 *
 * Floor style ("standard"/"future") and time mode ("auto"/"day"/"night")
 * persist under the same keys RN/iOS use (`pixel-office-floor-style`,
 * `pixel-office-time-mode`); night = hour ≥ 19 || < 6 in auto.
 *
 * [isActive] pauses the loop (tab off-screen) — the host also passes false
 * when the app is backgrounded, mirroring iOS's scenePhase gating.
 */
@Composable
fun PixelOffice(
    /** Up to 8 rendered (one per desk). Null/empty → 4-agent fallback roster. */
    agents: List<PixelOfficeAgentSpec>?,
    modifier: Modifier = Modifier,
    isActive: Boolean = true,
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
    var floorStyle by remember {
        mutableStateOf(prefs.getString(KEY_FLOOR_STYLE, "future") ?: "future")
    }
    var timeMode by remember {
        mutableStateOf(prefs.getString(KEY_TIME_MODE, "auto") ?: "auto")
    }

    val isNight = when (timeMode) {
        "day" -> false
        "night" -> true
        else -> Calendar.getInstance().get(Calendar.HOUR_OF_DAY).let { it >= 19 || it < 6 }
    }
    val floorKey = "${floorStyle}_${if (isNight) "night" else "day"}"

    val sim = remember { PixelOfficeSimulation() }
    val specs = if (!agents.isNullOrEmpty()) agents.take(8) else FALLBACK_SPECS
    LaunchedEffect(specs) { sim.setAgents(specs) }

    // Game loop. dt clamped to 0.1 s so a pause/resume gap doesn't teleport
    // agents; tick invalidates the canvas draw each frame.
    val nightState = rememberUpdatedState(isNight)
    var tick by remember { mutableLongStateOf(0L) }
    LaunchedEffect(isActive) {
        if (!isActive) return@LaunchedEffect
        var last = 0L
        while (true) {
            withFrameNanos { now ->
                if (last == 0L) last = now
                val dt = min(((now - last) / 1e9).toFloat(), 0.1f)
                last = now
                sim.isNight = nightState.value
                if (dt > 0f) sim.update(dt)
                tick = now
            }
        }
    }

    val textMeasurer = rememberTextMeasurer()
    // Tag text re-measures only on new strings (state flips), not per frame.
    val textCache = remember { mutableMapOf<String, TextLayoutResult>() }

    Box(
        modifier = modifier
            .aspectRatio(PixelOfficeGeo.MAP_WIDTH / PixelOfficeGeo.MAP_HEIGHT)
            .clip(RoundedCornerShape(20.dp))
            .background(AppColors.officeSceneBackdrop),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            tick // frame-loop invalidation
            val mapScale = size.width / PixelOfficeGeo.MAP_WIDTH
            scale(mapScale, mapScale, pivot = Offset.Zero) {
                drawOffice(context, sim, floorKey, textMeasurer, textCache)
            }
        }

        // Floor/time control chips (bottom-right), order matching RN/iOS.
        Row(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            ControlChip(
                emoji = if (isNight) "🌙" else "☀️",
                label = when (timeMode) {
                    "day" -> "Day"
                    "night" -> "Night"
                    else -> "Auto"
                },
                onClick = {
                    // RN cycle order: auto → day → night → auto.
                    timeMode = when (timeMode) {
                        "auto" -> "day"
                        "day" -> "night"
                        else -> "auto"
                    }
                    prefs.edit().putString(KEY_TIME_MODE, timeMode).apply()
                },
            )
            ControlChip(
                emoji = if (floorStyle == "standard") "🏢" else "🚀",
                label = if (floorStyle == "standard") "Standard" else "Future",
                onClick = {
                    floorStyle = if (floorStyle == "standard") "future" else "standard"
                    prefs.edit().putString(KEY_FLOOR_STYLE, floorStyle).apply()
                },
            )
        }
    }
}

// MARK: - Drawing (all in 864×800 map coordinates under the aspect-fit scale)

private fun DrawScope.drawOffice(
    context: Context,
    sim: PixelOfficeSimulation,
    floorKey: String,
    textMeasurer: TextMeasurer,
    textCache: MutableMap<String, TextLayoutResult>,
) {
    val mapSize = IntSize(PixelOfficeGeo.MAP_WIDTH.toInt(), PixelOfficeGeo.MAP_HEIGHT.toInt())

    // ── Floor ── the ONLY background layer: the full office (desks, walls,
    // lighting) is baked into the floor texture; office_bg is a fallback only.
    val floor = PixelOfficeSpriteSheets.image(context, "floor_$floorKey")
        ?: PixelOfficeSpriteSheets.image(context, "office_bg")
    if (floor != null) {
        drawImage(
            image = floor,
            srcOffset = IntOffset.Zero,
            srcSize = IntSize(floor.width, floor.height),
            dstOffset = IntOffset.Zero,
            dstSize = mapSize,
            filterQuality = FilterQuality.None,
        )
    }

    // ── Laptops ── open when the mapped desk seat is occupied by a
    // working/thinking/error agent; conference seats (8-15) never open.
    val occupied = sim.occupiedSeats()
    PixelOfficeLaptops.spots.forEachIndexed { idx, spot ->
        val seat = PixelOfficeLaptops.idToSeat[idx] ?: idx
        val open = seat in occupied
        val image = PixelOfficeSpriteSheets.image(context, PixelOfficeLaptops.imageName(spot.dir, open))
            ?: return@forEachIndexed
        translate(spot.x, spot.y) {
            drawImage(
                image = image,
                srcOffset = IntOffset.Zero,
                srcSize = IntSize(image.width, image.height),
                dstOffset = IntOffset.Zero,
                dstSize = IntSize(32, 64),
                filterQuality = FilterQuality.None,
            )
        }
    }

    // ── Agents ── depth-sorted by mapY so lower-on-screen draws in front.
    val sorted = sim.agents.sortedBy { it.mapY }
    for (a in sorted) {
        val sheet = PixelOfficeSpriteSheets.avatarSheet(context, a.avatarIdx) ?: continue
        val anim = PixelAnim.fromKey(a.animKey) ?: PixelAnim.FRONT_IDLE
        val frame = anim.frameIndices[a.frameIdx % anim.frameIndices.size]
        // Foot anchor: sprite center = (mapX, mapY − 24) → top-left (x−24, y−56).
        translate(a.mapX - PixelOfficeGeo.FRAME_WIDTH / 2, a.mapY - 24f - PixelOfficeGeo.FRAME_HEIGHT / 2) {
            drawImage(
                image = sheet,
                srcOffset = PixelOfficeSpriteSheets.frameSrcOffset(frame),
                srcSize = PixelOfficeSpriteSheets.frameSrcSize,
                dstOffset = IntOffset.Zero,
                dstSize = IntSize(PixelOfficeGeo.FRAME_WIDTH.toInt(), PixelOfficeGeo.FRAME_HEIGHT.toInt()),
                filterQuality = FilterQuality.None,
            )
        }
    }

    // ── Particles ── above agents, below the foreground overlay.
    for (p in sim.particles) {
        drawCircle(
            color = p.color,
            radius = p.radius,
            center = Offset(p.x, p.y),
            alpha = p.opacity.coerceIn(0f, 1f),
        )
    }

    // ── Foreground overlay ── chairs/plants drawn over the characters.
    val fg = PixelOfficeSpriteSheets.image(context, "office_fg")
    if (fg != null) {
        drawImage(
            image = fg,
            srcOffset = IntOffset.Zero,
            srcSize = IntSize(fg.width, fg.height),
            dstOffset = IntOffset.Zero,
            dstSize = mapSize,
            filterQuality = FilterQuality.None,
        )
    }

    // ── Name tags + bubbles ── above everything so a walking agent's label is
    // never occluded.
    fun measure(text: String, sizePx: Float, weight: FontWeight): TextLayoutResult {
        val key = "$text|$sizePx|${weight.weight}"
        return textCache.getOrPut(key) {
            textMeasurer.measure(
                AnnotatedString(text),
                TextStyle(fontSize = sizePx.toSp(), fontWeight = weight),
            )
        }
    }

    fun drawCentered(layout: TextLayoutResult, center: Offset, color: Color) {
        drawText(
            textLayoutResult = layout,
            color = color,
            topLeft = Offset(center.x - layout.size.width / 2f, center.y - layout.size.height / 2f),
        )
    }

    for (a in sim.agents) {
        val centerX = a.mapX + a.nameTagOffset.x
        val spriteCenterY = a.mapY - 24f + a.nameTagOffset.y

        // State pill 84×21 r5 at 82 above the sprite center.
        val pillCenter = Offset(centerX, spriteCenterY - 82f)
        drawRoundRect(
            color = PixelOfficeStateColor.forState(a.state),
            topLeft = Offset(pillCenter.x - 42f, pillCenter.y - 10.5f),
            size = androidx.compose.ui.geometry.Size(84f, 21f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(5f),
        )
        // AvenirNext-Heavy substitute: heaviest platform sans weight.
        drawCentered(measure(a.stateLabel, 13f, FontWeight.Black), pillCenter, Color.White)

        // Name box 116×22 r4 at 56 above, accent-stroked.
        val nameCenter = Offset(centerX, spriteCenterY - 56f)
        drawRoundRect(
            color = Color(0xFF0A0C12).copy(alpha = 0.85f),
            topLeft = Offset(nameCenter.x - 58f, nameCenter.y - 11f),
            size = androidx.compose.ui.geometry.Size(116f, 22f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f),
        )
        drawRoundRect(
            color = a.accentColor,
            topLeft = Offset(nameCenter.x - 58f, nameCenter.y - 11f),
            size = androidx.compose.ui.geometry.Size(116f, 22f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f),
            style = Stroke(width = 1.5f),
        )
        drawCentered(measure(a.tagText, 15f, FontWeight.Bold), nameCenter, Color(0xFFE0E4EC))

        // Speech bubble (dormant unless a named activity assigns an emoji).
        if (a.arrived && a.bubbleEmoji.isNotEmpty()) {
            val bubbleCenter = Offset(a.mapX, a.mapY - 24f - 108f)
            drawCircle(Color.White.copy(alpha = 0.92f), radius = 15f, center = bubbleCenter)
            drawCircle(
                Color.Black.copy(alpha = 0.15f),
                radius = 15f,
                center = bubbleCenter,
                style = Stroke(width = 1f),
            )
            drawCentered(measure(a.bubbleEmoji, 17f, FontWeight.Normal), bubbleCenter, Color.Unspecified)
        }
    }
}

// MARK: - Control chips

@Composable
private fun ControlChip(emoji: String, label: String, onClick: () -> Unit) {
    LiquidGlassCapsule(modifier = Modifier.clickable(onClick = onClick)) {
        Row(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(emoji, fontSize = 14.sp)
            Text(
                label,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.3.sp,
                // White to match the corner HQ/stats glass pills.
                color = Color.White,
            )
        }
    }
}

// MARK: - Constants

private const val PREFS_NAME = "pixel_office"
private const val KEY_FLOOR_STYLE = "pixel-office-floor-style"
private const val KEY_TIME_MODE = "pixel-office-time-mode"

/**
 * Logged-out / preview fallback so an empty office still reads as populated —
 * mirrors iOS's 4-agent seed with varied states.
 */
private val FALLBACK_SPECS: List<PixelOfficeAgentSpec> = run {
    val names = listOf("Line Hawk", "Spread Eagle", "Model Maven", "Value Hunter")
    val states = listOf("working", "thinking", "working", "idle")
    names.mapIndexed { idx, name ->
        val st = states[idx % states.size]
        PixelOfficeAgentSpec(
            displayName = name,
            emoji = "",
            accentColorHex = null,
            spriteIndex = idx % 8,
            state = st,
            stateLabel = PixelOfficeStateColor.label(st),
            isActive = true,
        )
    }
}
