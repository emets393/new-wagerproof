package com.wagerproof.core.design.pixeloffice

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize

/**
 * Loader + in-memory cache for the pixel-office PNGs shipped in this module's
 * `assets/pixeloffice/` — port of iOS `PixelOfficeTextureCache`. All assets
 * draw with `FilterQuality.None` at the call site (the Compose analog of
 * SpriteKit's `.nearest` filtering); decoding disables density scaling so the
 * sheets keep their raw pixel dimensions and the 48×64 frame math holds.
 */
object PixelOfficeSpriteSheets {
    private const val ASSET_DIR = "pixeloffice"

    private val cache = HashMap<String, ImageBitmap?>()
    private val lock = Any()

    /** Avatar sprite sheet `avatar_0 … avatar_7` (384×576 = 8×9 grid of 48×64). */
    fun avatarSheet(context: Context, index: Int): ImageBitmap? =
        image(context, "avatar_${index.coerceIn(0, 7)}")

    /** Generic asset lookup (floors, foreground, laptops) by base name. */
    fun image(context: Context, name: String): ImageBitmap? {
        synchronized(lock) {
            cache[name]?.let { return it }
            if (cache.containsKey(name)) return null // known-missing — don't retry IO
        }
        val decoded = runCatching {
            context.assets.open("$ASSET_DIR/$name.png").use { stream ->
                // inScaled off: assets are logical-pixel art, never density assets.
                val opts = BitmapFactory.Options().apply { inScaled = false }
                BitmapFactory.decodeStream(stream, null, opts)?.asImageBitmap()
            }
        }.getOrNull()
        synchronized(lock) { cache[name] = decoded }
        return decoded
    }

    // MARK: - Frame-crop helpers (48×64 frames, 8 cols × 9 rows)

    /** Source top-left of [frameIndex] within a sheet, in sheet pixels. */
    fun frameSrcOffset(frameIndex: Int): IntOffset {
        val col = frameIndex % PixelOfficeGeo.SHEET_COLS
        val row = frameIndex / PixelOfficeGeo.SHEET_COLS
        return IntOffset(
            col * PixelOfficeGeo.FRAME_WIDTH.toInt(),
            row * PixelOfficeGeo.FRAME_HEIGHT.toInt(),
        )
    }

    /** Source size of every frame (48×64). */
    val frameSrcSize = IntSize(PixelOfficeGeo.FRAME_WIDTH.toInt(), PixelOfficeGeo.FRAME_HEIGHT.toInt())
}
