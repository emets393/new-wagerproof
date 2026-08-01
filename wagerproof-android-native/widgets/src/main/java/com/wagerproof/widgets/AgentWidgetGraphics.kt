package com.wagerproof.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb

/**
 * Bitmap production for the Agent Monitor widget.
 *
 * Glance renders through RemoteViews: there is no Canvas composable and no
 * gradient brush, so anything drawn has to be a pre-rendered Bitmap handed to
 * `androidx.glance.Image`. Both helpers here are called from `provideGlance`
 * (before composition), never from a @Composable — Glance re-composes freely
 * and per-pass Canvas work would be wasted every time.
 */
internal object AgentWidgetGraphics {

    // Pixel-office sheet geometry — mirrors core/design PixelOfficeGeo. The
    // sheets live in :core:design's assets, but library assets are merged into
    // the APK, so the widget can read them by path without depending on the
    // module (which would drag all of Compose UI into :widgets).
    private const val ASSET_PATH = "pixeloffice"
    private const val FRAME_WIDTH = 48
    private const val FRAME_HEIGHT = 64
    private const val SHEET_COLS = 8

    /** Frame 0 of FRONT_IDLE — widgets are static, so there is no loop to play. */
    private const val FRONT_IDLE_FIRST_FRAME = 0

    private val spriteCache = HashMap<Int, Bitmap?>()
    private val cacheLock = Any()

    /**
     * The agent's pixel character as a standalone bitmap, upscaled [scale]× with
     * nearest-neighbor filtering so the art stays crisp instead of smeared.
     * Returns null when the asset is missing — callers fall back to the emoji.
     */
    fun sprite(context: Context, spriteIndex: Int, scale: Int = 3): Bitmap? {
        val index = spriteIndex.coerceIn(0, 7)
        val key = index * 100 + scale
        synchronized(cacheLock) {
            if (spriteCache.containsKey(key)) return spriteCache[key]
        }
        val bitmap = runCatching {
            context.assets.open("$ASSET_PATH/avatar_$index.png").use { stream ->
                // inScaled off: these are logical-pixel sheets, not density assets —
                // scaling on decode would break the 48×64 frame math.
                val opts = BitmapFactory.Options().apply { inScaled = false }
                val sheet = BitmapFactory.decodeStream(stream, null, opts) ?: return@use null
                val col = FRONT_IDLE_FIRST_FRAME % SHEET_COLS
                val row = FRONT_IDLE_FIRST_FRAME / SHEET_COLS
                val frame = Bitmap.createBitmap(
                    sheet,
                    col * FRAME_WIDTH,
                    row * FRAME_HEIGHT,
                    FRAME_WIDTH,
                    FRAME_HEIGHT,
                )
                Bitmap.createScaledBitmap(
                    frame,
                    FRAME_WIDTH * scale,
                    FRAME_HEIGHT * scale,
                    /* filter = */ false, // nearest-neighbor
                )
            }
        }.getOrNull()
        synchronized(cacheLock) { spriteCache[key] = bitmap }
        return bitmap
    }

    /**
     * The small tile's form sparkline: cumulative graded results as a filled
     * line over two dashed guide rules (iOS `AgentFormGraph`).
     *
     * Fewer than two points draws the guides and a flat baseline — an agent with
     * no graded history must read as "no data", never as invented movement.
     */
    fun formSparkline(
        values: List<Double>,
        color: Color,
        widthPx: Int = SPARK_WIDTH_PX,
        heightPx: Int = SPARK_HEIGHT_PX,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val argb = color.toArgb()

        // Dashed guides at 1/3 and 2/3 height.
        val guide = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 1f
            this.color = WidgetTheme.textMuted.copy(alpha = 0.10f).toArgb()
            pathEffect = android.graphics.DashPathEffect(floatArrayOf(4f, 8f), 0f)
        }
        for (fraction in listOf(0.34f, 0.67f)) {
            val y = heightPx * fraction
            canvas.drawLine(0f, y, widthPx.toFloat(), y, guide)
        }

        val points = sparklinePoints(values, widthPx.toFloat(), heightPx.toFloat())
        if (points.size < 2) return bitmap

        // Area fill under the line, fading to transparent.
        val area = Path().apply {
            moveTo(points.first().x, heightPx.toFloat())
            points.forEach { lineTo(it.x, it.y) }
            lineTo(points.last().x, heightPx.toFloat())
            close()
        }
        canvas.drawPath(
            area,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.FILL
                shader = android.graphics.LinearGradient(
                    0f, 0f, 0f, heightPx.toFloat(),
                    color.copy(alpha = 0.18f).toArgb(),
                    color.copy(alpha = 0f).toArgb(),
                    Shader.TileMode.CLAMP,
                )
            },
        )

        // The line itself.
        val line = Path().apply {
            moveTo(points.first().x, points.first().y)
            points.drop(1).forEach { lineTo(it.x, it.y) }
        }
        canvas.drawPath(
            line,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = 3f
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
                this.color = color.copy(alpha = 0.72f).toArgb()
            },
        )

        // Head dot on the most recent result.
        canvas.drawCircle(
            points.last().x,
            points.last().y,
            5f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.FILL
                this.color = argb
            },
        )
        return bitmap
    }

    /** Render size of the sparkline; Glance scales it to the tile. */
    internal const val SPARK_WIDTH_PX = 360
    internal const val SPARK_HEIGHT_PX = 150

    internal data class SparkPoint(val x: Float, val y: Float)

    /**
     * Map a cumulative form series onto canvas coordinates (iOS
     * `AgentFormGraph.coordinates`). The value span is floored at 1 so a
     * perfectly flat series renders as a flat line instead of dividing by zero,
     * and insets keep the head dot and the fill off the canvas edges.
     */
    internal fun sparklinePoints(
        values: List<Double>,
        width: Float,
        height: Float,
        topInset: Float = 12f,
        bottomInset: Float = 18f,
    ): List<SparkPoint> {
        if (values.size < 2) return emptyList()
        val minimum = values.min()
        val maximum = values.max()
        val span = maxOf(1.0, maximum - minimum)
        val available = maxOf(1f, height - topInset - bottomInset)
        return values.mapIndexed { index, value ->
            val x = width * index / (values.size - 1)
            val normalized = ((value - minimum) / span).toFloat()
            SparkPoint(x = x, y = height - bottomInset - normalized * available)
        }
    }
}
