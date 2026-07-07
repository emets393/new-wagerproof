package com.wagerproof.core.design.backgrounds

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.exp
import kotlin.math.roundToInt
import kotlinx.coroutines.delay

/**
 * Command channel for spawning tap-style ripples in a [PixelGlyphField] from
 * OUTSIDE the field — port of iOS `GlyphRippleEmitter` (GlyphRippleOnChange.swift).
 * E.g. tapping the agent avatar ripples the background pixels behind it.
 *
 * [Pulse.point] is in the field's OWN coordinate space. A screen-anchored field
 * (`PixelWaveBackground(screenAnchored = true)`) draws at window (0,0) sized to
 * the full screen, so a WINDOW-space point maps 1:1 — pass the tapped view's
 * window-space center (`onGloballyPositioned` → `boundsInWindow().center`).
 */
class GlyphRippleEmitter {
    data class Pulse(
        val point: Offset,
        /**
         * Monotonic id so two ripples at the same point still read as distinct
         * events (a plain point wouldn't restart an effect on a repeat tap).
         */
        val token: Int,
    )

    var pulse: Pulse by mutableStateOf(Pulse(Offset.Zero, 0))
        private set

    /** Spawn a ripple centered on [at] (field-local / screen-anchored-window). */
    fun emit(at: Offset) {
        pulse = Pulse(at, pulse.token + 1)
    }
}

/**
 * Compose analog of iOS's `\.glyphRippleEmitter` environment entry: a container
 * hosting a pixelwave background injects its emitter so descendants can ripple
 * it without coupling to the background composable.
 */
val LocalGlyphRippleEmitter = staticCompositionLocalOf<GlyphRippleEmitter?> { null }

/**
 * A stepped, organic field of small pixel "glyphs" that bloom and dissipate
 * like bacteria colonies — port of iOS `PixelGlyphField.swift`.
 *
 * Unlike [PixelDotBackground] (a stateless pure-function-of-time field), a
 * spreading/decaying colony needs state that evolves in discrete steps: a
 * small reaction-diffusion cellular automaton runs over the dot grid. Designed
 * seed glyphs are periodically stamped on; the automaton grows them a little,
 * hollows saturated cores, and erodes them with ambient decay — each glyph
 * stays small and focused, then poofs away.
 *
 * The display eases previous→current across the full gap to the next step, so
 * motion is continuous — no hold between refreshes. Only lit cells are drawn.
 */
@Composable
fun PixelGlyphField(
    modifier: Modifier = Modifier,
    /** Step cadence, cycled in order. One value = steady beat. */
    intervals: List<Double> = listOf(0.15),
    baseColor: Color = Color.White,
    accentColor: Color? = AppColors.appPrimary,
    spacing: Float = 26f,
    dotSize: Float = 5.5f,
    peakOpacity: Double = 0.45,
    /**
     * Seeds the automaton's PRNG — per-card seeds keep multiple fields out of
     * lockstep. Default matches the shared iOS hero constant.
     */
    seed: Long = 0x5EED_1234L,
    /** External ripple trigger; null = ripples only on direct taps. */
    rippleEmitter: GlyphRippleEmitter? = null,
    /** Disable the field's own tap-ripple gesture (screen-anchored use). */
    tapRipples: Boolean = true,
    reduceMotion: Boolean = false,
) {
    val cadence = remember(intervals) { if (intervals.isEmpty()) listOf(0.3) else intervals }
    val sim = remember { GlyphAutomaton() }
    var fieldSize by remember { mutableStateOf(Size.Zero) }
    // Bumped every automaton step so the (otherwise time-only) canvas redraw
    // picks up the new grid.
    var stepTick by remember { mutableIntStateOf(0) }
    var lastStep by remember { mutableStateOf(DesignClock.nowSeconds()) }
    // Crossfade window = time until the NEXT step, so the ease fills the whole
    // gap and the field never sits still.
    var stepGap by remember { mutableStateOf(cadence.first()) }
    val ripples = remember { mutableStateOf(listOf<GlyphRipple>()) }

    val time by rememberFrameSeconds(paused = reduceMotion)

    fun addRipple(at: Offset) {
        if (reduceMotion) return
        val now = DesignClock.nowSeconds()
        var active = ripples.value.filter { now - it.start <= RIPPLE_DURATION }
        active = active + GlyphRipple(at, now)
        if (active.size > 8) active = active.takeLast(8)
        ripples.value = active
    }

    // Stepping loop; restarts if reduce-motion toggles. Frozen → the field
    // holds its last state (still drawn — just static).
    LaunchedEffect(reduceMotion, cadence) {
        if (reduceMotion) return@LaunchedEffect
        var idx = 0
        while (true) {
            delay((cadence[idx] * 1000).toLong())
            sim.step()
            lastStep = DesignClock.nowSeconds()
            stepTick++
            idx = (idx + 1) % cadence.size
            stepGap = cadence[idx]
        }
    }

    // External ripples bypass hit testing, so they fire even when the field is
    // inert behind a scroll. token 0 = the initial no-op pulse.
    val pulse = rippleEmitter?.pulse
    LaunchedEffect(pulse) {
        if (pulse != null && pulse.token > 0) addRipple(pulse.point)
    }

    val tapModifier = if (tapRipples) {
        Modifier.pointerInput(reduceMotion) {
            // The field sits behind foreground content, so buttons still get
            // their taps first; only taps that fall through ripple.
            detectTapGestures { addRipple(it) }
        }
    } else {
        Modifier
    }

    Canvas(
        modifier = modifier
            .onSizeChanged { newSize ->
                val cols = maxOf(2, (newSize.width / spacing).roundToInt())
                val rows = maxOf(2, (newSize.height / spacing).roundToInt())
                sim.configure(cols, rows, seed)
                lastStep = DesignClock.nowSeconds()
                stepTick++
                fieldSize = Size(newSize.width.toFloat(), newSize.height.toFloat())
            }
            .then(tapModifier),
    ) {
        stepTick // read so step invalidates the draw even between frame ticks
        val now = time
        if (size.width <= 0f || size.height <= 0f || sim.cols <= 0 || sim.rows <= 0) return@Canvas

        val cols = sim.cols
        val rows = sim.rows
        // Edge-to-edge: tile the full bounds and center each dot in its cell.
        val cellW = size.width / cols
        val cellH = size.height / rows

        // smoothstep ease across the full inter-step gap — zero velocity at
        // both ends, so consecutive steps meet seamlessly with no snap.
        val window = maxOf(0.0001, stepGap)
        val raw = ((now - lastStep) / window).coerceIn(0.0, 1.0)
        val fraction = raw * raw * (3 - 2 * raw)

        val activeRipples = ripples.value.filter { now - it.start in 0.0..RIPPLE_DURATION }

        for (y in 0 until rows) {
            val py = (y + 0.5f) * cellH
            for (x in 0 until cols) {
                val i = y * cols + x
                val px = (x + 0.5f) * cellW
                val auto = sim.value(i, fraction)
                val rip = rippleLevel(activeRipples, px, py, now)
                val intensity = maxOf(auto, rip)
                // Ripple cells out-shine the ambient field so a tap reads clearly.
                val opacity = maxOf(peakOpacity * auto, RIPPLE_PEAK_OPACITY * rip)
                if (opacity < 0.012) continue

                val s = dotSize * (0.82f + 0.4f * intensity.toFloat())
                val fill = if (accentColor != null) {
                    lerp(baseColor, accentColor, minOf(1.0, intensity * intensity * 1.2).toFloat())
                } else {
                    baseColor
                }
                drawRoundRect(
                    color = fill.copy(alpha = opacity.toFloat()),
                    topLeft = Offset(px - s / 2f, py - s / 2f),
                    size = Size(s, s),
                    cornerRadius = CornerRadius(s * 0.32f),
                )
            }
        }
    }
}

// Tap-ripple tuning (iOS constants).
private const val RIPPLE_DURATION = 1.5 // seconds
private const val RIPPLE_SPEED = 430.0 // ring expansion, px/s
private const val RIPPLE_RING_WIDTH = 26.0 // ring softness, px
private const val RIPPLE_PEAK_OPACITY = 0.72

private class GlyphRipple(val origin: Offset, val start: Double)

/**
 * Combined brightness (0..1) from all active ripples for a cell at (px, py):
 * each ripple is a soft expanding gaussian ring that fades with age.
 */
private fun rippleLevel(ripples: List<GlyphRipple>, px: Float, py: Float, now: Double): Double {
    if (ripples.isEmpty()) return 0.0
    var level = 0.0
    for (ripple in ripples) {
        val age = now - ripple.start
        if (age < 0 || age > RIPPLE_DURATION) continue
        val radius = age * RIPPLE_SPEED
        val dx = (px - ripple.origin.x).toDouble()
        val dy = (py - ripple.origin.y).toDouble()
        val delta = Math.sqrt(dx * dx + dy * dy) - radius
        val ring = exp(-(delta * delta) / (2 * RIPPLE_RING_WIDTH * RIPPLE_RING_WIDTH))
        val fade = 1 - age / RIPPLE_DURATION
        level = maxOf(level, ring * fade)
    }
    return level
}

// MARK: - Automaton

/**
 * The stateful reaction-diffusion grid behind [PixelGlyphField]. `step()`
 * recomputes the whole grid every tick — trivial at ~700 cells × 8 neighbors
 * at ≤4 Hz. Tuning keeps glyphs SMALL and FOCUSED: low spread + high ambient
 * decay means a stamped glyph bleeds out a cell or two before poofing away.
 */
internal class GlyphAutomaton {
    var cols = 0
        private set
    var rows = 0
        private set

    private var current = DoubleArray(0)
    private var previous = DoubleArray(0)
    private var rng = SeededRandom(0x5EED_1234L)

    // survival — cell's own carry; spread — gain per lit neighbor;
    // crowd/coreDecay — saturation hollowing; ambient — flat erosion.
    private val survival = 0.5
    private val spread = 0.1
    private val crowd = 2.2
    private val coreDecay = 0.32
    private val ambient = 0.05
    private val stampsPerStep = 1
    private val secondStampChance = 0.4

    /** If total energy drops below this, force-seed so it never goes dark. */
    private val lowEnergy = 2.5

    fun configure(cols: Int, rows: Int, seed: Long = 0x5EED_1234L) {
        this.cols = maxOf(1, cols)
        this.rows = maxOf(1, rows)
        // Re-seed before stamping so pre-warmed colonies (and every step after)
        // differ per field — distinct cards never bloom in lockstep.
        rng = SeededRandom(seed)
        current = DoubleArray(this.cols * this.rows)
        previous = current.copyOf()
        // Seed a few colonies and pre-warm so the field opens mid-bloom.
        repeat(4) { stampRandomGlyph() }
        repeat(3) { step(allowStamp = false) }
    }

    /** Eased value for cell [i], interpolating previous→current by [fraction]. */
    fun value(i: Int, fraction: Double): Double {
        if (i < 0 || i >= current.size) return 0.0
        val p = if (i < previous.size) previous[i] else 0.0
        return p + (current[i] - p) * fraction
    }

    fun step(allowStamp: Boolean = true) {
        if (cols <= 0 || rows <= 0) return
        previous = current
        val next = DoubleArray(current.size)

        for (y in 0 until rows) {
            for (x in 0 until cols) {
                val i = y * cols + x
                val v = current[i]

                // 8-neighbor (Moore) sum → rounder colonies than 4-neighbor.
                var n = 0.0
                for (dy in -1..1) {
                    val ny = y + dy
                    if (ny < 0 || ny >= rows) continue
                    for (dx in -1..1) {
                        if (dx == 0 && dy == 0) continue
                        val nx = x + dx
                        if (nx < 0 || nx >= cols) continue
                        n += current[ny * cols + nx]
                    }
                }

                var nv = v * survival + n * spread
                if (n > crowd) nv *= coreDecay // saturated core → hollow out
                nv -= ambient
                next[i] = nv.coerceIn(0.0, 1.0)
            }
        }
        current = next

        if (!allowStamp) return
        repeat(stampsPerStep) { stampRandomGlyph() }
        if (rng.nextDouble() < secondStampChance) stampRandomGlyph()
        if (current.sum() < lowEnergy) {
            stampRandomGlyph()
            stampRandomGlyph()
        }
    }

    /** Stamp one random seed glyph at a random location, max-merged in. */
    private fun stampRandomGlyph() {
        if (cols <= 1 || rows <= 1) return
        val glyph = GLYPHS[rng.nextInt(GLYPHS.size)]
        val cx = rng.nextInt(cols)
        val cy = rng.nextInt(rows)
        for ((dx, dy) in glyph) {
            val x = cx + dx
            val y = cy + dy
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue
            val i = y * cols + x
            current[i] = maxOf(current[i], 1.0)
        }
    }

    companion object {
        /**
         * The 20 designed seed glyphs — small (≤3×3) (dx, dy) offset sets so
         * colonies stay focused. Copied verbatim from iOS.
         */
        private val GLYPHS: List<List<Pair<Int, Int>>> = listOf(
            // single spore
            listOf(0 to 0),
            // plus
            listOf(0 to 0, 1 to 0, -1 to 0, 0 to 1, 0 to -1),
            // hollow ring (3×3 minus center)
            listOf(-1 to -1, 0 to -1, 1 to -1, -1 to 0, 1 to 0, -1 to 1, 0 to 1, 1 to 1),
            // diagonal slash
            listOf(-1 to -1, 0 to 0, 1 to 1),
            // X
            listOf(-1 to -1, 1 to -1, 0 to 0, -1 to 1, 1 to 1),
            // T
            listOf(-1 to -1, 0 to -1, 1 to -1, 0 to 0, 0 to 1),
            // 2×2 blob
            listOf(0 to 0, 1 to 0, 0 to 1, 1 to 1),
            // little pair
            listOf(0 to 0, 1 to 0),
            // L corner
            listOf(0 to -1, 0 to 0, 1 to 0),
            // diamond
            listOf(0 to -1, -1 to 0, 1 to 0, 0 to 1),
            // chevron up
            listOf(-1 to 0, 0 to -1, 1 to 0),
            // chevron down
            listOf(-1 to 0, 0 to 1, 1 to 0),
            // vertical bar
            listOf(0 to -1, 0 to 0, 0 to 1),
            // horizontal bar
            listOf(-1 to 0, 0 to 0, 1 to 0),
            // triangle
            listOf(0 to -1, -1 to 1, 1 to 1),
            // twin verticals (gap)
            listOf(-1 to -1, -1 to 0, -1 to 1, 1 to -1, 1 to 0, 1 to 1),
            // staircase
            listOf(-1 to 1, 0 to 0, 1 to -1, 0 to 1),
            // spaced trio
            listOf(-2 to 0, 0 to 0, 2 to 0),
            // arrowhead
            listOf(0 to -1, -1 to 0, 1 to 0, 0 to 0, 0 to 1),
            // scattered cluster
            listOf(-1 to -1, 1 to 0, 0 to 1, 2 to 1),
        )
    }
}

/**
 * Deterministic xorshift64* PRNG — same algorithm/seed handling as the iOS
 * `SeededGenerator` so per-seed glyph patterns stay reproducible.
 */
internal class SeededRandom(seed: Long) {
    private var state: Long = if (seed != 0L) seed else 0x9E37_79B9_7F4A_7C15UL.toLong()

    private fun next(): Long {
        state = state xor (state ushr 12)
        state = state xor (state shl 25)
        state = state xor (state ushr 27)
        return state * 0x2545_F491_4F6C_DD1DUL.toLong()
    }

    /** Uniform in `0 until bound`. */
    fun nextInt(bound: Int): Int {
        require(bound > 0)
        val r = next().toULong()
        return (r % bound.toULong()).toInt()
    }

    /** Uniform in `0.0 until 1.0` (top 53 bits, standard construction). */
    fun nextDouble(): Double = (next().toULong() shr 11).toDouble() / (1L shl 53).toDouble()
}
