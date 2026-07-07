package com.wagerproof.core.design.backgrounds

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.PI
import kotlin.math.sin

/**
 * Three overlapping "sheets" the same color as the background, stacked at
 * different heights — port of iOS `WaveBackground.swift`. Each sheet fills
 * from the TOP of the view down to a wavy bottom edge whose soft DROP SHADOW
 * is the only visible part, so the background reads as three gentle wavy
 * shadow contours. Amplitude and wavelength each breathe on slow sines.
 *
 * Meant to sit behind a foreground layer (e.g. [PixelGlyphField]). Pure
 * decoration — freezes under [reduceMotion].
 */
@Composable
fun WaveBackground(
    modifier: Modifier = Modifier,
    /** Sheet fill — should match the background so only the shadows read. */
    sheetColor: Color = AppColors.pixelWaveBase,
    shadowColor: Color = Color.Black,
    /** Drop-shadow opacity. The whole effect lives here — keep it gentle. */
    shadowStrength: Double = 0.4,
    shadowRadius: Float = 16f,
    shadowOffset: Float = 9f,
    reduceMotion: Boolean = false,
) {
    val time by rememberFrameSeconds(paused = reduceMotion)

    // Framework Paint so setShadowLayer paints the iOS GraphicsContext shadow
    // filter (blur + y-offset) in one pass; supported on hardware canvases
    // for paths since API 28 (minSdk 31).
    val paint = remember(sheetColor, shadowColor, shadowStrength, shadowRadius, shadowOffset) {
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = sheetColor.toArgb()
            style = Paint.Style.FILL
            setShadowLayer(
                shadowRadius,
                0f,
                shadowOffset,
                shadowColor.copy(alpha = shadowStrength.toFloat()).toArgb(),
            )
        }
    }
    val path = remember { Path() }

    Canvas(modifier = modifier) {
        if (size.width <= 1f || size.height <= 0f) return@Canvas
        val t = time
        drawIntoCanvas { canvas ->
            // Drawn back-to-front (lowest edge first) so a higher sheet never
            // paints over a lower one's shadow.
            for (sheet in SHEETS) {
                // Amplitude and wavelength each breathe on their own slow sine.
                val amp = sheet.ampBase + AMP_VARY * sin(t * AMP_SPEED + sheet.phase).toFloat()
                val waves = WAVE_BASE + WAVE_VARY * sin(t * WAVE_SPEED + sheet.phase * 1.3).toFloat()
                val k = waves * 2.0 * PI / size.width
                val scroll = t * SCROLL_SPEED * 2.0 * PI
                val baseY = size.height * sheet.baseline

                fun edgeY(x: Float): Float =
                    baseY + amp * sin(x * k + scroll + sheet.phase).toFloat()

                // Sheet fills from the top down to its wavy bottom edge; the
                // top/side edges sit at the bounds so only the wavy contour's
                // shadow shows.
                path.reset()
                path.moveTo(0f, 0f)
                path.lineTo(size.width, 0f)
                path.lineTo(size.width, edgeY(size.width))
                var x = size.width
                while (x >= 0f) {
                    path.lineTo(x, edgeY(x))
                    x -= 6f
                }
                path.lineTo(0f, 0f)
                path.close()

                canvas.nativeCanvas.drawPath(path.asAndroidPath(), paint)
            }
        }
    }
}

/**
 * One sheet's character. All three share speeds/frequency/breathing/drift so
 * they move in UNISON; only baseline, amplitude, and a small phase offset
 * differ — nested waves that are related but not identical.
 */
private class WaveSheet(val baseline: Float, val ampBase: Float, val phase: Double)

private val SHEETS = listOf(
    WaveSheet(baseline = 0.72f, ampBase = 17f, phase = 0.8),
    WaveSheet(baseline = 0.52f, ampBase = 13f, phase = 0.4),
    WaveSheet(baseline = 0.32f, ampBase = 9f, phase = 0.0),
)

private const val AMP_VARY = 4f
private const val AMP_SPEED = 0.11
private const val WAVE_BASE = 1.4f
private const val WAVE_VARY = 0.30f
private const val WAVE_SPEED = 0.05
private const val SCROLL_SPEED = 0.08
