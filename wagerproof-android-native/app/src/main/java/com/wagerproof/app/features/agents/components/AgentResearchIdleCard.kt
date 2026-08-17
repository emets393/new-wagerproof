package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.pixeloffice.PixelAnim
import com.wagerproof.core.design.pixeloffice.PixelOfficeSpriteSheets
import android.content.Context
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.VibratorManager
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.material3.Text
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Port of iOS `AgentResearchIdleCard.swift`: the seated pixel-character-at-a-
// laptop avatar, the "Research in Progress" text shimmer, and the swipe-to-
// commit generation pill. Kept as standalone pieces (mirroring the iOS file
// split) so AgentGenerationCard (GenerationLoadingBar.kt) stays focused on
// the research <-> polling state machine.

// MARK: - Working desk avatar (character + laptop)

/**
 * The agent's pixel character seated + typing (`front_sit_work` frames) with an
 * open laptop composited in front of it, over a soft accent floor glow — port
 * of iOS `WorkingDeskAvatar`. Used by the research card and (via [SitWorkSprite]
 * + [LaptopSprite] directly) the hero disc during a live run.
 */
@Composable
fun WorkingDeskAvatar(
    spriteIndex: Int,
    accent: Color,
    modifier: Modifier = Modifier,
    charHeight: Dp = 120.dp,
) {
    val charWidth = charHeight * 48f / 64f
    val laptopHeight = charHeight * 0.60f
    val laptopWidth = laptopHeight * 32f / 64f

    // Center-aligned + explicit offsets, mirroring iOS's ZStack geometry exactly
    // (AgentResearchIdleCard.swift:36-53) instead of top/bottom-aligning pieces
    // independently — that previously left the laptop riding ~0.10*charHeight low
    // relative to the character.
    Box(
        modifier = modifier.size(charWidth * 2.3f, charHeight * 1.12f),
        contentAlignment = Alignment.Center,
    ) {
        // Accent floor glow grounds the character on the black tile.
        Canvas(
            Modifier
                .size(charWidth * 2.3f, charHeight * 0.42f)
                .offset(y = charHeight * 0.36f)
                .blur(28.dp),
        ) {
            drawOval(color = accent.copy(alpha = 0.30f))
        }
        SitWorkSprite(spriteIndex = spriteIndex, modifier = Modifier.size(charWidth, charHeight))
        Box(Modifier.size(laptopWidth, laptopHeight).offset(y = charHeight * 0.22f)) {
            LaptopSprite()
        }
    }
}

/**
 * The seated `front_sit_work` loop cropped from `avatar_{index}` — port of iOS
 * `SitWorkSprite`. Also used directly by [AgentGlassHero] for the laptop-working
 * hero disc while a run is in flight. Typing cadence a touch livelier than the
 * office's 6fps work loop so the hands read as busy in this close-up.
 */
@Composable
fun SitWorkSprite(spriteIndex: Int, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val sheet = remember(spriteIndex) { PixelOfficeSpriteSheets.avatarSheet(context, spriteIndex) }
        ?: return
    val frames = PixelAnim.FRONT_SIT_WORK.frameIndices

    // Process lifecycle gate — a produceState coroutine keeps running (and its delay
    // loop keeps waking, 2.5-5x/s) even while the app is backgrounded unless something
    // cancels it. Mirrors PixelOffice.kt's DisposableEffect/LifecycleEventObserver gate.
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

    // Keyed on lifecycleStarted too — ON_STOP cancels this producer outright
    // instead of just skipping updates, so the loop stops waking at all.
    val frameIdx by produceState(initialValue = 0, spriteIndex, lifecycleStarted) {
        if (!lifecycleStarted) return@produceState
        while (true) {
            val now = SystemClock.uptimeMillis()
            value = ((now / 1000.0 * SIT_WORK_FPS).toInt() + spriteIndex) % frames.size
            delay(SIT_WORK_FRAME_PERIOD_MS - now % SIT_WORK_FRAME_PERIOD_MS)
        }
    }
    Canvas(modifier = modifier) {
        val fw = PixelOfficeSpriteSheets.frameSrcSize.width.toFloat()
        val fh = PixelOfficeSpriteSheets.frameSrcSize.height.toFloat()
        val s = minOf(size.width / fw, size.height / fh)
        val dx = (size.width - fw * s) / 2f
        val dy = (size.height - fh * s) / 2f
        translate(dx, dy) {
            scale(s, s, pivot = Offset.Zero) {
                drawImage(
                    image = sheet,
                    srcOffset = PixelOfficeSpriteSheets.frameSrcOffset(frames[frameIdx % frames.size]),
                    srcSize = PixelOfficeSpriteSheets.frameSrcSize,
                    dstOffset = IntOffset.Zero,
                    dstSize = IntSize(fw.toInt(), fh.toInt()),
                    filterQuality = FilterQuality.None,
                )
            }
        }
    }
}

private const val SIT_WORK_FPS = 5.0
private const val SIT_WORK_FRAME_PERIOD_MS = 200L

/** The open front-facing laptop sprite — port of iOS `LaptopSprite`. */
@Composable
fun LaptopSprite(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val bmp = remember { PixelOfficeSpriteSheets.image(context, "office_laptop_front_open") }
        ?: return
    Canvas(modifier = modifier) {
        val s = minOf(size.width / bmp.width, size.height / bmp.height)
        val dx = (size.width - bmp.width * s) / 2f
        val dy = (size.height - bmp.height * s) / 2f
        translate(dx, dy) {
            scale(s, s, pivot = Offset.Zero) {
                drawImage(
                    image = bmp,
                    srcOffset = IntOffset.Zero,
                    srcSize = IntSize(bmp.width, bmp.height),
                    dstOffset = IntOffset.Zero,
                    dstSize = IntSize(bmp.width, bmp.height),
                    filterQuality = FilterQuality.None,
                )
            }
        }
    }
}

// MARK: - Research shimmer text

/**
 * A left-to-right glint sweeping across dim-white text — port of iOS
 * `ResearchShimmerText`. iOS masks a bright band to the glyph shapes with
 * `.plusLighter`; here a bright copy is layered over the dim base and masked
 * to the SAME travelling band via the shared [shimmering] alpha-mask modifier
 * (core/design's one shimmer vocabulary), which reads near-identically since
 * both layers share the same white hue.
 */
@Composable
fun ResearchShimmerText(text: String, modifier: Modifier = Modifier, fontSize: TextUnit = 15.sp) {
    Box(modifier = modifier.wrapContentSize(Alignment.CenterStart)) {
        Text(
            text = text,
            color = Color.White.copy(alpha = 0.34f),
            fontSize = fontSize,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = text,
            color = Color.White,
            fontSize = fontSize,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.shimmering(durationMillis = 1900),
        )
    }
}

// MARK: - Swipe to generate pill

/**
 * Building per-notch haptics ramping 0.35->1.0 (iOS `UIImpactFeedbackGenerator
 * .soft`), plus a heavier commit rumble. Uses raw `VibrationEffect` amplitude
 * control (minSdk 31 guarantees `VibratorManager`) since Compose's semantic
 * `HapticFeedbackType` has no intensity dial.
 */
private class SwipePillHaptics(context: Context) {
    private val vibrator = (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)
        ?.defaultVibrator

    fun notch(intensity: Float) {
        val amp = (intensity.coerceIn(0f, 1f) * 255).toInt().coerceIn(1, 255)
        vibrator?.vibrate(VibrationEffect.createOneShot(12, amp))
    }

    fun commit() {
        vibrator?.vibrate(VibrationEffect.createOneShot(45, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    fun reject() {
        vibrator?.vibrate(VibrationEffect.createOneShot(18, 110))
    }
}

/**
 * Centered label whose SAME glyphs render white ahead of the fill and black
 * under it — port of iOS's `.mask(alignment: .leading) { Rectangle(width:
 * fillWidth) }`. The black copy is draw-time clipped to `fillWidthPx` (no
 * layout cost) so it appears to recolor as the swipe crosses it; a shimmering
 * white pass rides on top for the "glint" iOS layers over both.
 */
@Composable
private fun SwipeLabel(title: String, fillWidthPx: Float, confirmed: Boolean, modifier: Modifier = Modifier) {
    if (confirmed) return
    Box(modifier, contentAlignment = Alignment.Center) {
        Text(title, color = Color.White.copy(alpha = 0.82f), fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Text(
            title,
            color = Color.Black,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            modifier = Modifier.drawWithContent {
                clipRect(left = 0f, top = 0f, right = fillWidthPx, bottom = size.height) { this@drawWithContent.drawContent() }
            },
        )
        // fillMaxWidth BEFORE shimmering, so the sweep is measured against the
        // whole pill rather than the glyph box. Applied to the bare Text it only
        // spanned the ~half-width the label occupies, so the glint started and
        // died inside the word instead of crossing the control (iOS sizes its
        // shimmerSweep off the full-width ZStack).
        Text(
            title,
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().shimmering(durationMillis = 1700),
        )
    }
}

/** Static locked capsule, no gesture — port of iOS `SwipeToGeneratePill.lockedLabel`. */
@Composable
private fun LockedPill(title: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            // TalkBack still needs to hear WHY the button can't be activated, not just
            // silence — matches iOS's disabled accessibility trait on the locked pill.
            .semantics {
                role = Role.Button
                contentDescription = title
                disabled()
            }
            .background(Color.White.copy(alpha = 0.08f), CircleShape)
            .border(1.dp, Color.White.copy(alpha = 0.10f), CircleShape),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(agentSymbol("lock.fill"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(13.dp))
        Spacer(Modifier.width(7.dp))
        Text(title, color = AppColors.appTextSecondary, fontSize = 14.sp, fontWeight = FontWeight.Black, maxLines = 1)
    }
}

/**
 * Swipe-to-commit generation trigger — port of iOS `SwipeToGeneratePill`. Three
 * escalating feedback layers as the thumb travels: a shimmering recoloring
 * label, a heat-up ignition fill (accent -> gold), and building haptics capped
 * by a commit rumble past 90% travel. `isEnabled = false` renders [LockedPill].
 */
@Composable
fun SwipeToGeneratePill(
    title: String,
    accent: Color,
    onCommit: () -> Unit,
    modifier: Modifier = Modifier,
    isEnabled: Boolean = true,
) {
    if (!isEnabled) {
        LockedPill(title = title, modifier = modifier)
        return
    }
    val density = LocalDensity.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val haptics = remember(context) { SwipePillHaptics(context) }

    val height = 56.dp
    val thumbInset = 4.dp
    val thumbSize = height - thumbInset * 2

    var trackWidthPx by remember { mutableStateOf(0f) }
    val dragProgress = remember { Animatable(0f) }
    var confirmed by remember { mutableStateOf(false) }
    var lastNotch by remember { mutableStateOf(0) }

    // Mirrors iOS's `.onChange(of: title) { reset() }` — a locked->unlocked
    // copy swap (e.g. quota resetting) shouldn't leave a stale drag position.
    LaunchedEffect(title) {
        confirmed = false
        lastNotch = 0
        dragProgress.snapTo(0f)
    }

    // Shared by the drag gesture's success path and the accessibility action below —
    // TalkBack users can't perform the swipe gesture, so onClick must do the same thing.
    fun commit() {
        scope.launch {
            confirmed = true
            dragProgress.animateTo(1f, tween(180))
            haptics.commit()
            onCommit()
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .onSizeChanged { trackWidthPx = it.width.toFloat() }
            // iOS adds .isButton + accessibilityAction { onCommit() } here (AgentResearchIdleCard.swift:295-299) —
            // without it, TalkBack users have no way to generate picks.
            .semantics {
                role = Role.Button
                contentDescription = title
                onClick(title) {
                    if (!confirmed) commit()
                    true
                }
            }
            // Track base is neutral white, not accent-tinted — the accent lives in the
            // fill only (iOS AgentResearchIdleCard.swift:253-255).
            .background(Color.White.copy(alpha = 0.08f), CircleShape)
            .border(1.dp, Color.White.copy(alpha = 0.12f), CircleShape)
            .clip(CircleShape),
    ) {
        val thumbPx = with(density) { thumbSize.toPx() }
        val insetPx = with(density) { thumbInset.toPx() }
        val maxDragPx = (trackWidthPx - thumbPx - insetPx * 2).coerceAtLeast(1f)
        val p = dragProgress.value
        val fillWidthPx = p * maxDragPx + thumbPx + insetPx * 2

        // 2. Heat-up ignition fill — grows + warms toward gold with travel, plus a
        // brightness ramp and a glow halo that build toward commit (iOS
        // AgentResearchIdleCard.swift:265-268). Compose has no `.brightness()` /
        // `.shadow(color:radius:)` filter, so these are approximated with a
        // translucent white overlay and a blurred color copy behind the fill.
        // Every layer is CircleShape-clipped so the fill is a capsule whose
        // leading cap nests concentrically around the thumb. Without a shape the
        // gradient drew as a hard-edged rectangle, and its square right edge read
        // as the track colour "poking out" from under the circle.
        //
        // Alpha starts at ZERO and fades in over the first 10% of travel. iOS
        // keeps a flat 0.4 floor (AgentResearchIdleCard.swift:308), but that
        // relies on its capsule hugging the thumb exactly; here the owner wants
        // the colour to arrive WITH the slide rather than sit there at rest.
        val fillAlpha = (0.4f + p * 0.6f) * (p / 0.10f).coerceIn(0f, 1f)
        Box(Modifier.width(with(density) { fillWidthPx.toDp() }).fillMaxHeight()) {
            Box(
                Modifier
                    .matchParentSize()
                    .background(accent.copy(alpha = 0.8f * p), CircleShape)
                    .blur((16.dp * p).coerceAtLeast(0.1.dp)),
            )
            Box(
                Modifier
                    .matchParentSize()
                    .clip(CircleShape)
                    .background(Brush.horizontalGradient(listOf(accent, accent, Color(0xFFFFE7A6))))
                    .alpha(fillAlpha),
            )
            Box(
                Modifier
                    .matchParentSize()
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = p * 0.12f)),
            )
        }

        // 3. Centered recoloring label.
        SwipeLabel(title = title, fillWidthPx = fillWidthPx, confirmed = confirmed, modifier = Modifier.matchParentSize())

        // 4. Draggable thumb.
        val thumbOffset = with(density) { (p * maxDragPx).toDp() } + thumbInset
        Box(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .offset(x = thumbOffset)
                .size(thumbSize)
                .background(Color.White, CircleShape)
                .pointerInput(trackWidthPx) {
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            if (dragProgress.value > 0.9f) {
                                commit()
                            } else {
                                scope.launch {
                                    lastNotch = 0
                                    dragProgress.animateTo(0f, spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessMedium))
                                    haptics.reject()
                                }
                            }
                        },
                        onHorizontalDrag = { change, amount ->
                            if (confirmed) return@detectHorizontalDragGestures
                            change.consume()
                            // Read + coerce inside the launch — two pointer events can fire
                            // before the first coroutine dispatches, and reading .value out
                            // here would let the second overwrite the first's delta.
                            scope.launch {
                                val next = (dragProgress.value + amount / maxDragPx).coerceIn(0f, 1f)
                                dragProgress.snapTo(next)
                                val notch = (next * 14).toInt()
                                if (notch != lastNotch) {
                                    lastNotch = notch
                                    haptics.notch(0.35f + next * 0.65f)
                                }
                            }
                        },
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                agentSymbol(if (confirmed) "sparkles" else "chevron.right"),
                contentDescription = null,
                tint = if (confirmed) accent else Color(0xFF0B0E0D),
                modifier = Modifier.size(17.dp),
            )
        }
    }
}
