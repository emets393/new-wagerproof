package com.wagerproof.app.features.search

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.delay
import androidx.compose.runtime.LaunchedEffect
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

// MARK: - Card chrome

/**
 * Explore-grid card for the Search tab's empty state — an edge-to-edge graphic
 * area on top then a bold title block. When the card's category is the active
 * browse scope the border switches to the accent color. Port of iOS
 * `Features/Search/Components/SearchToolCards.swift` (`SearchToolCard`).
 */
@Composable
fun SearchToolCard(
    title: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    isSelected: Boolean = false,
    graphic: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(20.dp)
    val borderColor by animateFloatAsState(if (isSelected) 1f else 0f, label = "sel")
    Column(
        modifier
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(
                if (isSelected) 2.dp else 1.dp,
                lerpColor(AppColors.appBorder, AppColors.appPrimary, borderColor),
                shape,
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onTap,
            ),
    ) {
        // Graphic bleeds to the card edges; clipToBounds crops it.
        Box(Modifier.fillMaxWidth().height(104.dp).clipToBounds()) { graphic() }
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp).padding(top = 8.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            if (subtitle != null) {
                Text(
                    subtitle,
                    color = AppColors.appTextSecondary,
                    fontSize = 12.sp,
                    minLines = 2,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

private fun lerpColor(a: Color, b: Color, t: Float): Color = Color(
    red = a.red + (b.red - a.red) * t,
    green = a.green + (b.green - a.green) * t,
    blue = a.blue + (b.blue - a.blue) * t,
    alpha = a.alpha + (b.alpha - a.alpha) * t,
)

@Composable
private fun graphicIcon(systemName: String, tint: Color, size: androidx.compose.ui.unit.Dp) {
    val icon = AppIcon.fromSystemName(systemName) ?: AppIcon.CHART_BAR_FILL
    Icon(icon.imageVector, contentDescription = null, tint = tint, modifier = Modifier.size(size))
}

// MARK: - Angled stat sheet graphic

/**
 * An oversized rounded "sheet" of stat rows, tilted a few degrees and zoomed in
 * so it bleeds past the card edges. A highlight walks down the 3 visible rows;
 * each row it leaves erases and typewriter-types the stat 3 positions ahead in
 * the pool, with the icon morphing mid-rewrite.
 */
@Composable
fun AngledStatSheetGraphic(
    rows: List<Pair<String, String>>,
    modifier: Modifier = Modifier,
    startDelay: Long = 0,
) {
    val visibleSlots = 3
    val seed = rows.take(visibleSlots)
    val slotStat = remember { mutableStateListOf<Int>().apply { addAll(seed.indices) } }
    val slotIcon = remember { mutableStateListOf<String>().apply { addAll(seed.map { it.first }) } }
    val slotText = remember { mutableStateListOf<String>().apply { addAll(seed.map { it.second }) } }
    var activeSlot by remember { mutableIntStateOf(0) }

    LaunchedEffect(rows) {
        if (slotText.isEmpty()) return@LaunchedEffect
        if (startDelay > 0) delay(startDelay)
        while (true) {
            delay(1600)
            val prev = activeSlot
            activeSlot = (prev + 1) % slotText.size
            // Rewrite the row the highlight just left with the stat 3 ahead.
            val next = (slotStat[prev] + visibleSlots) % rows.size
            slotStat[prev] = next
            // Backspace, swap icon, retype — ~1s total, inside the 1.6s tick.
            while (slotText[prev].isNotEmpty()) {
                slotText[prev] = slotText[prev].dropLast(1)
                delay(14)
            }
            slotIcon[prev] = rows[next].first
            for (ch in rows[next].second) {
                slotText[prev] = slotText[prev] + ch
                delay(32)
            }
        }
    }

    Box(modifier.fillMaxSize()) {
        Column(
            Modifier
                .align(Alignment.TopStart)
                .graphicsLayer {
                    rotationZ = -8f
                    transformOrigin = TransformOrigin(0f, 1f) // bottomLeading anchor
                    translationX = 12.dp.toPx()
                    translationY = (-22).dp.toPx()
                }
                .width(280.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(AppColors.appSurfaceMuted)
                .border(1.dp, AppColors.appBorderStrong.copy(alpha = 0.6f), RoundedCornerShape(18.dp))
                .padding(horizontal = 18.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            slotText.indices.forEach { i ->
                StatRow(slotIcon[i], slotText[i], active = activeSlot == i)
            }
        }
        // Soft top fade so clipped rows dissolve into the card surface.
        Box(
            Modifier.fillMaxWidth().height(30.dp).align(Alignment.TopCenter).background(
                Brush.verticalGradient(
                    listOf(AppColors.appSurfaceElevated.copy(alpha = 0.9f), AppColors.appSurfaceElevated.copy(alpha = 0f)),
                ),
            ),
        )
    }
}

@Composable
private fun StatRow(icon: String, text: String, active: Boolean) {
    val tint = if (active) AppColors.appTextPrimary else AppColors.appTextMuted.copy(alpha = 0.65f)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        Box(Modifier.width(18.dp)) { graphicIcon(icon, tint, 13.dp) }
        Text(
            text.ifEmpty { " " },
            color = tint,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            softWrap = false,
        )
    }
}

// MARK: - Stacked stat cards graphic

/**
 * A fanned stack of mini stat cards that loops by sending the front card to the
 * back while the next springs forward. Pass 4 items — 3 render as the visible
 * fan, the 4th slot is the hidden hand-off position.
 */
@Composable
fun StackedStatCardsGraphic(
    items: List<Pair<String, String>>,
    modifier: Modifier = Modifier,
    startDelay: Long = 0,
) {
    var step by remember { mutableIntStateOf(0) }
    LaunchedEffect(items) {
        if (startDelay > 0) delay(startDelay)
        while (true) {
            delay(2000)
            step += 1
        }
    }

    Box(modifier.fillMaxSize()) {
        Box(Modifier.align(Alignment.Center).graphicsLayer { translationX = (-6).dp.toPx(); translationY = 2.dp.toPx() }) {
            items.indices.forEach { i ->
                val slot = ((i - step) % items.size + items.size) % items.size
                val x by animateFloatAsState(slot * 10f, spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessLow), label = "x$i")
                val y by animateFloatAsState(slot * -8f, spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessLow), label = "y$i")
                Box(
                    Modifier
                        .graphicsLayer {
                            translationX = x.dp.toPx()
                            translationY = y.dp.toPx()
                            alpha = if (slot >= 3) 0f else 1f
                        },
                ) {
                    MiniCard(items[i])
                }
            }
        }
        // Left edge melts into the card background.
        Box(
            Modifier.fillMaxSize().background(
                Brush.horizontalGradient(
                    0f to AppColors.appSurfaceElevated,
                    0.35f to AppColors.appSurfaceElevated.copy(alpha = 0f),
                ),
            ),
        )
    }
}

@Composable
private fun MiniCard(item: Pair<String, String>) {
    Column(
        Modifier
            .size(124.dp, 78.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(AppColors.appSurfaceMuted)
            .border(1.dp, AppColors.appBorderStrong.copy(alpha = 0.6f), RoundedCornerShape(18.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(item.first, color = AppColors.appTextPrimary, fontSize = 21.sp, fontWeight = FontWeight.Black, fontStyle = FontStyle.Italic, maxLines = 1)
        Text(item.second, color = AppColors.appTextMuted, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, fontStyle = FontStyle.Italic, maxLines = 1)
    }
}

// MARK: - Radar sweep graphic

/**
 * A radar scanning for betting outliers: a beam sweeps a ring grid on a loop;
 * each blip flashes with a glow (plus an optional "+EV"/"FADE" tag) as the beam
 * passes its bearing, then decays until the next pass.
 */
@Composable
fun RadarSweepGraphic(
    modifier: Modifier = Modifier,
    period: Int = 4000,
) {
    val diameter = 150.dp
    val blips = listOf(
        Triple(300.0, 0.62f, AppColors.appPrimary) to "+EV",
        Triple(170.0, 0.68f, AppColors.appAccentRed) to "FADE",
        Triple(80.0, 0.45f, AppColors.appPrimary) to null,
    )
    val transition = rememberInfiniteTransition(label = "radar")
    val beamAngle by transition.animateFloat(
        0f, 360f,
        infiniteRepeatable(tween(period, easing = LinearEasing), RepeatMode.Restart),
        label = "beam",
    )

    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Box(Modifier.size(diameter), contentAlignment = Alignment.Center) {
            RingGrid(diameter)
            // Sweep wedge: bright edge leads at bearing 0, trailing off over a
            // quarter turn, spun counterclockwise so the trail lags.
            Box(
                Modifier.size(diameter).clip(CircleShape).graphicsLayer { rotationZ = -beamAngle }.background(
                    Brush.sweepGradient(
                        0f to AppColors.appPrimary.copy(alpha = 0.25f),
                        0.3f to AppColors.appPrimary.copy(alpha = 0f),
                        1f to AppColors.appPrimary.copy(alpha = 0f),
                    ),
                ),
            )
            blips.forEach { (contact, tag) ->
                val (angle, radius, color) = contact
                RadarBlip(
                    color = color,
                    tag = tag,
                    delayMs = ((360 - angle) / 360 * period).toLong(),
                    period = period,
                    offset = blipOffset(angle, radius, diameter),
                )
            }
        }
        Box(
            Modifier.fillMaxWidth().height(26.dp).align(Alignment.TopCenter).background(
                Brush.verticalGradient(
                    listOf(AppColors.appSurfaceElevated.copy(alpha = 0.85f), AppColors.appSurfaceElevated.copy(alpha = 0f)),
                ),
            ),
        )
    }
}

@Composable
private fun RingGrid(diameter: androidx.compose.ui.unit.Dp) {
    Box(Modifier.size(diameter), contentAlignment = Alignment.Center) {
        listOf(diameter, 104.dp, 60.dp).forEach { d ->
            Box(Modifier.size(d).clip(CircleShape).border(1.dp, AppColors.appBorderStrong.copy(alpha = 0.4f), CircleShape))
        }
        Box(Modifier.size(diameter, 1.dp).background(AppColors.appBorderStrong.copy(alpha = 0.25f)))
        Box(Modifier.size(1.dp, diameter).background(AppColors.appBorderStrong.copy(alpha = 0.25f)))
        Box(Modifier.size(4.dp).clip(CircleShape).background(AppColors.appTextMuted))
    }
}

private fun blipOffset(angle: Double, radiusFraction: Float, diameter: androidx.compose.ui.unit.Dp): IntOffset {
    val r = diameter.value / 2f * radiusFraction
    val rad = angle * Math.PI / 180.0
    return IntOffset((r * cos(rad)).roundToInt(), (r * sin(rad)).roundToInt())
}

/** One radar contact: flashes to full glow when the beam passes, then eases
 * back down to a faint resting state. */
@Composable
private fun RadarBlip(color: Color, tag: String?, delayMs: Long, period: Int, offset: IntOffset) {
    var energy by remember { androidx.compose.runtime.mutableFloatStateOf(0f) }
    val animEnergy by animateFloatAsState(
        energy,
        tween(if (energy == 0f) (period * 0.75).toInt() else 0),
        label = "energy",
    )
    LaunchedEffect(Unit) {
        delay(delayMs)
        while (true) {
            energy = 1f // instant flash as the beam crosses
            delay(16)
            energy = 0f
            delay(period.toLong())
        }
    }
    Row(
        Modifier
            .offset { offset }
            .graphicsLayer {
                alpha = 0.3f + animEnergy * 0.7f
                val s = 0.85f + animEnergy * 0.25f
                scaleX = s
                scaleY = s
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
        if (tag != null) {
            Text(
                tag,
                color = color,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.18f))
                    .padding(horizontal = 4.dp, vertical = 2.dp),
            )
        }
    }
}
