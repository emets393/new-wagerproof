package com.wagerproof.core.design.backgrounds

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * A library of programmed, time-driven brightness fields for
 * [PixelDotBackground] — port of iOS `PixelDotBackground.swift`
 * (`PixelDotAnimation`). Each case is a pure function of a normalized cell
 * coordinate `(u, v)` plus elapsed time; the engine maps that intensity onto
 * every dot's opacity, scale, and brand-color bloom.
 */
enum class PixelDotAnimation {
    /** Slow, large-scale plasma drift — the calm default for the auth gate. */
    Aurora,

    /** A bright diagonal ridge that travels across the grid on repeat. */
    Wave,

    /** Concentric rings expanding from the center, fading with distance. */
    Ripple,

    /** Per-column "data rain" — bright heads fall with a trailing comet tail. */
    Rain,

    /** Sparse per-dot shimmer — pixels flicker on their own random phase. */
    Twinkle,

    /** Layered-sine plasma — denser, faster interference than [Aurora]. */
    Flow,

    /** A single glowing horizontal bar that sweeps top to bottom. */
    Scan;

    /**
     * Intensity (0..1) for the cell at normalized `(u, v)` at time [t] (seconds,
     * already scaled by the engine's speed). [index] is the cell's flat grid
     * index — the stochastic animations (Rain/Twinkle) hash it into a stable
     * random phase.
     */
    fun intensity(u: Double, v: Double, index: Int, t: Double): Double = when (this) {
        Aurora -> {
            // Three low-frequency waves on different axes, averaged then
            // contrast-curved. Low frequencies = big soft blobs that drift.
            val n = (sin(u * 2.6 + t * 0.16) + cos(v * 2.1 - t * 0.12) + sin((u + v) * 1.7 + t * 0.20)) / 3.0
            PixelMath.smoothstep(0.05, 0.9, n * 0.5 + 0.5)
        }

        Wave -> {
            val phase = (u * 0.72 + v * 0.28) * 7.0 - t * 1.5
            PixelMath.smoothstep(0.45, 1.0, sin(phase))
        }

        Ripple -> {
            val d = hypot(u - 0.5, v - 0.5)
            val ring = sin(d * 26.0 - t * 2.4)
            // Fade rings out toward the corners so it reads as emanating.
            PixelMath.smoothstep(0.35, 1.0, ring) * (1.0 - PixelMath.smoothstep(0.0, 0.75, d))
        }

        Rain -> {
            // Each column gets a stable random fall speed + phase. The lit
            // segment is the head plus a tail above it (smaller v).
            // 64-bit wrap-multiply to match Swift's `index &* 2_654_435_761`.
            val col = ((index.toLong() * 2_654_435_761L) and 0xFFFFL).toInt()
            val seed = PixelMath.hash01(col)
            val head = PixelMath.fract(t * (0.10 + seed * 0.22) + seed)
            val tail = 0.26
            val behind = head - v // >0 when the dot is above the head
            if (behind >= -0.015 && behind <= tail) maxOf(0.0, 1.0 - behind / tail) else 0.0
        }

        Twinkle -> {
            val phase = PixelMath.hash01(index * 97 + 13) * 6.2831853
            val s = 0.5 + 0.5 * sin(t * 1.7 + phase)
            s * s * s // sharpen so most dots stay dim
        }

        Flow -> {
            val p = sin(u * 7.0 + t * 0.6) +
                sin(v * 6.0 - t * 0.5) +
                sin((u + v) * 5.0 + t * 0.45) +
                sin(hypot(u - 0.5, v - 0.5) * 12.0 - t * 0.8)
            PixelMath.smoothstep(0.15, 0.95, p / 4.0 * 0.5 + 0.5)
        }

        Scan -> {
            val pos = PixelMath.fract(t * 0.11)
            maxOf(0.0, 1.0 - abs(v - pos) * 8.0)
        }
    }
}

/**
 * A reusable, animated field of pixel-style dots driven by a programmable
 * brightness function — port of iOS `PixelDotBackground`.
 *
 * One Canvas redrawn per frame from a continuous time source (doc §10.4):
 * hundreds of dots render smoothly with every dot's brightness/scale/color
 * computed independently, which is what makes the programmed animations
 * possible.
 *
 * [reduceMotion] (or [isPaused]) freezes the field on a single static frame —
 * the pixel pattern stays visible, it just stops drifting.
 */
@Composable
fun PixelDotBackground(
    modifier: Modifier = Modifier,
    animation: PixelDotAnimation = PixelDotAnimation.Aurora,
    baseColor: Color = Color.White,
    /** Color the brightest dots bloom toward. `null` = monochrome field. */
    accentColor: Color? = AppColors.appPrimary,
    spacing: Float = 26f,
    dotSize: Float = 5.5f,
    baseOpacity: Double = 0.05,
    peakOpacity: Double = 0.5,
    speed: Double = 1.0,
    edgeFade: Boolean = true,
    isPaused: Boolean = false,
    reduceMotion: Boolean = false,
) {
    val time by rememberFrameSeconds(paused = isPaused || reduceMotion)

    Canvas(modifier = modifier) {
        if (size.width <= 0f || size.height <= 0f || spacing <= 0f) return@Canvas
        val t = time * speed

        // +1 so the grid covers the full bounds; centered so edge gutters match.
        val cols = maxOf(1, (size.width / spacing).toInt() + 1)
        val rows = maxOf(1, (size.height / spacing).toInt() + 1)
        val originX = (size.width - (cols - 1) * spacing) / 2f
        val originY = (size.height - (rows - 1) * spacing) / 2f

        val colsDenom = maxOf(1, cols - 1).toDouble()
        val rowsDenom = maxOf(1, rows - 1).toDouble()

        var index = 0
        for (r in 0 until rows) {
            val v = r / rowsDenom
            val y = originY + r * spacing
            for (c in 0 until cols) {
                val u = c / colsDenom
                val x = originX + c * spacing

                var intensity = animation.intensity(u, v, index, t)
                index++
                if (edgeFade) intensity *= edgeFalloff(u, v)

                val opacity = baseOpacity + (peakOpacity - baseOpacity) * intensity
                if (opacity < 0.012) continue // skip imperceptible dots

                // Brighter dots grow slightly — gives the field depth/pop.
                val s = dotSize * (0.82f + 0.34f * intensity.toFloat())
                // Only the hottest dots take on the brand accent (intensity²
                // keeps the field mostly neutral with green just at the peaks).
                val fill = if (accentColor != null) {
                    lerp(baseColor, accentColor, minOf(1.0, intensity * intensity * 1.3).toFloat())
                } else {
                    baseColor
                }
                drawRoundRect(
                    color = fill.copy(alpha = opacity.toFloat()),
                    topLeft = Offset(x - s / 2f, y - s / 2f),
                    size = Size(s, s),
                    cornerRadius = CornerRadius(s * 0.32f),
                )
            }
        }
    }
}

/**
 * Smooth four-edge vignette so the grid fades out at the bounds instead of
 * terminating on a hard rectangular cut.
 */
private fun edgeFalloff(u: Double, v: Double): Double {
    val fx = PixelMath.smoothstep(0.0, 0.12, u) * PixelMath.smoothstep(0.0, 0.12, 1 - u)
    val fy = PixelMath.smoothstep(0.0, 0.10, v) * PixelMath.smoothstep(0.0, 0.10, 1 - v)
    return fx * fy
}
