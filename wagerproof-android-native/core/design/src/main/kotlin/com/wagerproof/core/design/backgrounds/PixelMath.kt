package com.wagerproof.core.design.backgrounds

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.compose.runtime.withFrameNanos
import kotlin.math.floor
import kotlin.math.sin

/**
 * Math helpers shared by the procedural backgrounds — port of the private
 * `PixelMath` enum in iOS `PixelDotBackground.swift`. Kept stateless so the
 * animation functions stay pure and testable.
 */
internal object PixelMath {
    /** Hermite smoothstep — eases `x` from 0 to 1 across `[a, b]`. */
    fun smoothstep(a: Double, b: Double, x: Double): Double {
        if (b == a) return if (x < a) 0.0 else 1.0
        val t = ((x - a) / (b - a)).coerceIn(0.0, 1.0)
        return t * t * (3 - 2 * t)
    }

    /** Fractional part, always in `0..<1` (handles negatives). */
    fun fract(x: Double): Double = x - floor(x)

    /** Deterministic pseudo-random hash in `0..<1` from an integer seed. */
    fun hash01(n: Int): Double {
        val x = sin(n.toDouble() * 12.9898) * 43_758.5453
        return x - floor(x)
    }
}

/**
 * Shared absolute time base for every procedural field. iOS drives all
 * fields from `timeIntervalSinceReferenceDate`, so two instances of the same
 * background (page + screen-anchored hero mask) paint IDENTICAL pixels.
 * Anchoring every field to one process-wide base reproduces that alignment.
 */
internal object DesignClock {
    val baseNanos: Long = System.nanoTime()

    fun nowSeconds(): Double = (System.nanoTime() - baseNanos) / 1_000_000_000.0
}

/**
 * Continuous frame-time source in seconds off [DesignClock]. When `paused`
 * (explicit pause or reduce-motion), holds a single static value so the field
 * stays visible — it just stops drifting, matching iOS's paused TimelineView.
 */
@Composable
internal fun rememberFrameSeconds(paused: Boolean): State<Double> =
    produceState(initialValue = DesignClock.nowSeconds(), paused) {
        if (paused) {
            value = DesignClock.nowSeconds()
            return@produceState
        }
        while (true) {
            withFrameNanos { frameNanos ->
                // Choreographer frame time shares System.nanoTime's timebase.
                value = (frameNanos - DesignClock.baseNanos) / 1_000_000_000.0
            }
        }
    }
