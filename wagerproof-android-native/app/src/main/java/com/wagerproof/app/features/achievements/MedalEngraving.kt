package com.wagerproof.app.features.achievements

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import com.google.android.filament.Texture
import io.github.sceneview.geometries.Geometry
import io.github.sceneview.geometries.UvCoordinate
import io.github.sceneview.loaders.MaterialLoader
import io.github.sceneview.math.Direction
import io.github.sceneview.math.Position
import io.github.sceneview.node.GeometryNode
import io.github.sceneview.node.ModelNode
import io.github.sceneview.texture.ImageTexture
import io.github.sceneview.texture.TextureSampler2D
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.sqrt

/** Transparent text ribbons tessellated onto the exact curved rear shell. */
internal class MedalEngraving(val nodes: List<GeometryNode>, val textures: List<Texture>)

internal fun engraveMedal(model: ModelNode, materials: MaterialLoader, recipient: String, caption: String, earnedAt: String?): MedalEngraving {
    val front = model.nodes.firstOrNull { it.name?.endsWith("_Front_Frame") == true }
        ?: return MedalEngraving(emptyList(), emptyList())
    val date = earnedAt?.let { runCatching {
        DateTimeFormatter.ofPattern("d MMM yyyy").format(Instant.parse(it).atZone(ZoneId.systemDefault())).uppercase()
    }.getOrDefault("") }.orEmpty()
    val lines = listOf(Triple("Name", recipient.trim().replace(Regex("\\s+"), " ").take(80), 1.12f to 0.115f),
        Triple("Caption", caption.uppercase(), 1.08f to 0.102f), Triple("Date", date, 0.86f to 0.09f))
    val nodes = mutableListOf<GeometryNode>(); val textures = mutableListOf<Texture>()
    for ((suffix, text, size) in lines) {
        if (text.isBlank()) continue
        val anchor = model.nodes.firstOrNull { it.name?.endsWith("_Back_$suffix") == true } ?: continue
        val center = front.getLocalPosition(anchor.worldPosition)
        val bitmap = Bitmap.createBitmap(1024, 128, Bitmap.Config.ARGB_8888)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.rgb(30,30,30); textSize = 90f; typeface = Typeface.create("sans-serif", Typeface.BOLD); textAlign = Paint.Align.CENTER }
        paint.textSize *= minOf(1f, 1000f / paint.measureText(text))
        Canvas(bitmap).drawText(text, 512f, 64f - (paint.ascent() + paint.descent()) / 2, paint)
        val texture = ImageTexture.Builder().bitmap(bitmap).build(materials.engine)
        textures += texture
        val vertices = mutableListOf<Geometry.Vertex>(); val indices = mutableListOf<Int>()
        val columns = 48; val rows = 4
        for (row in 0..rows) for (column in 0..columns) {
            val u = column.toFloat() / columns; val v = row.toFloat() / rows
            val x = center.x + size.first * (0.5f - u)
            // Blender USD import retains mesh-local X/right, Y/depth, -Z/up.
            val y = -center.z + size.second * (v - 0.5f)
            val z = 0.135f + sqrt((5.6f * 5.6f - 3.8f * x * x - y * y).coerceAtLeast(0f)) - 5.6f - 0.095f - 0.0012f
            vertices += Geometry.Vertex(Position(x,z,-y), Direction(0f,-1f,0f), UvCoordinate(u, v))
        }
        for (row in 0 until rows) for (column in 0 until columns) {
            val a = row * (columns+1) + column; val b = a+1; val c = b+columns+1; val d = a+columns+1
            indices += listOf(a,b,c,a,c,d)
        }
        val geometry = Geometry.Builder().vertices(vertices).indices(indices).build(materials.engine)
        nodes += GeometryNode(materials.engine, geometry, materials.createImageInstance(texture, TextureSampler2D())).apply { parent = front }
    }
    return MedalEngraving(nodes, textures)
}
