package com.wagerproof.core.design.pixeloffice

import android.os.SystemClock
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.delay

/**
 * Renders an agent's pixel-office character as an avatar — the 4-frame
 * front-idle animation cropped live from its `avatar_N` sheet — port of iOS
 * `PixelSpriteAvatar.swift`. Nearest-neighbor scaling keeps the pixel art
 * crisp; the frame aspect-fits the composable's bounds.
 *
 * [spriteIndex] is the agent's STABLE character index (0..7), so this is the
 * same character that walks the office. It also phase-offsets the loop so a
 * row of cards bobs out of sync rather than as a synchronized chorus line.
 */
@Composable
fun PixelSpriteAvatar(
    spriteIndex: Int,
    modifier: Modifier = Modifier,
    /** Play the front-idle loop. Off → frozen on frame 0. */
    animated: Boolean = true,
) {
    val context = LocalContext.current
    val sheet = remember(spriteIndex) {
        PixelOfficeSpriteSheets.avatarSheet(context, spriteIndex)
    } ?: return // asset missing — caller's colored tile still shows

    val frames = PixelAnim.FRONT_IDLE.frameIndices

    // Process lifecycle gate — a produceState coroutine keeps running (and its delay
    // loop keeps waking) even while the app is backgrounded unless something cancels
    // it. Mirrors PixelOffice.kt's DisposableEffect/LifecycleEventObserver gate.
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

    // Advance one frame per 1/fps; the office's slow idle (2 fps) nudged a
    // touch livelier for a standalone avatar. Absolute wall-clock ticks (not
    // an accumulator) so every avatar shares one metronome, offset by phase.
    //
    // Sleeps to the next tick BOUNDARY rather than waking on every display
    // frame: a withFrameNanos loop ran at 120 Hz to drive a 2.5 fps sprite, so
    // a screen of avatar tiles paid ~48x the wake-ups it needed. iOS's
    // TimelineView(.periodic) wakes 2.5x/s (PixelSpriteAvatar.swift:34-43).
    // Keyed on lifecycleStarted too — ON_STOP cancels this producer outright
    // instead of just skipping updates, so the loop stops waking at all.
    val frameIdx by produceState(initialValue = 0, animated, spriteIndex, lifecycleStarted) {
        if (!animated || !lifecycleStarted) {
            if (!animated) value = 0
            return@produceState
        }
        while (true) {
            val now = SystemClock.uptimeMillis()
            value = ((now / 1000.0 * FPS).toInt() + spriteIndex) % frames.size
            delay(FRAME_PERIOD_MS - now % FRAME_PERIOD_MS)
        }
    }

    Canvas(modifier = modifier) {
        val fw = PixelOfficeSpriteSheets.frameSrcSize.width.toFloat()
        val fh = PixelOfficeSpriteSheets.frameSrcSize.height.toFloat()
        // Aspect-fit the 48×64 frame inside the available bounds.
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
                    filterQuality = FilterQuality.None, // nearest-neighbor — crisp pixels
                )
            }
        }
    }
}

private const val FPS = 2.5

/** 1000 / [FPS] — inlined because `const val` can't hold a computed conversion. */
private const val FRAME_PERIOD_MS = 400L
