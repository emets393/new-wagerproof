package com.wagerproof.app.features.achievements

import android.animation.ValueAnimator
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import coil3.compose.AsyncImage
import io.github.sceneview.*
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import io.github.sceneview.node.ModelNode
import kotlinx.coroutines.CancellationException
import kotlin.math.sin

@Composable
fun AchievementThumbnail(id: String, earned: Boolean = true, modifier: Modifier = Modifier) {
    AsyncImage(model = "file:///android_asset/achievements/$id${if (earned) "" else "_locked"}.png",
        contentDescription = null, modifier = modifier)
}

/** One lifecycle-owned Filament surface, using the approved curved runtime geometry. */
@Composable
fun AchievementMedal(id: String, earned: Boolean = true, interactive: Boolean = true,
                     active: Boolean = true, overlaySurface: Boolean = false, modifier: Modifier = Modifier, recipient: String = "Your name", earnedAt: String? = null, onInteraction: () -> Unit = {}) {
    if (!active) { AchievementThumbnail(id, earned, modifier); return }
    key(id, earned) {
        val engine = rememberEngine()
        val loader = rememberModelLoader(engine)
        val environmentLoader = rememberEnvironmentLoader(engine)
        val materials = rememberMaterialLoader(engine)
        var engraving by remember { mutableStateOf<MedalEngraving?>(null) }
        val environment = rememberEnvironment(environmentLoader, isOpaque = false) {
            environmentLoader.createHDREnvironment("achievements/studio.hdr", createSkybox = false)
                ?: SceneView.createEnvironment(environmentLoader, false)
        }
        val camera = rememberCameraNode(engine) { position = Position(0f, 0f, 3.1f) }
        var model by remember { mutableStateOf<ModelNode?>(null) }
        var failed by remember { mutableStateOf(false) }
        var userRotated by remember { mutableStateOf(false) }
        var yaw by remember { mutableFloatStateOf(0f) }
        var pitch by remember { mutableFloatStateOf(0f) }
        val reduceMotion = !ValueAnimator.areAnimatorsEnabled()
        DisposableEffect(Unit) {
            onDispose {
                engraving?.nodes?.forEach { it.destroy() }
                engraving?.textures?.forEach { engine.destroyTexture(it) }
            }
        }
        LaunchedEffect(id, earned, recipient, earnedAt) {
            try {
                val instance = loader.loadModelInstance("achievements/$id.glb")
                if (instance == null) { failed = true; return@LaunchedEffect }
                model = ModelNode(instance, autoAnimate = false, scaleToUnits = 2f, centerOrigin = Position(0f))
                if (earned) {
                    engraving?.nodes?.forEach { it.destroy() }
                    engraving?.textures?.forEach { engine.destroyTexture(it) }
                    engraving = engraveMedal(model!!, materials, recipient,
                        com.wagerproof.core.models.AchievementCatalog.definitions.first { it.id == id }.title, earnedAt)
                }
                if (!earned) instance.materialInstances.forEach {
                    val metal = it.name.contains("gold", true) || it.name.contains("silver", true) || it.name.contains("bronze", true)
                    val hex = it.name.substringAfterLast("_").take(6).toLongOrNull(16) ?: 0L
                    val lightAccent = (((hex shr 16) and 255) + ((hex shr 8) and 255) + (hex and 255)) > 450
                    val gray = if (metal) 0.45f else if (lightAccent) 0.6f else 0.2f
                    it.setParameter("baseColorFactor", gray, gray + 0.01f, gray + 0.02f, 1f)
                    it.setParameter("metallicFactor", if (metal) 1f else 0f)
                    it.setParameter("roughnessFactor", 0.72f)
                }
            } catch (cancelled: CancellationException) { throw cancelled
            } catch (_: Exception) { failed = true }
        }
        Box(modifier) {
            if (model == null || failed) AchievementThumbnail(id, earned, Modifier.fillMaxSize())
            if (!failed) Scene(
                modifier = Modifier.fillMaxSize().then(if (interactive) Modifier.pointerInput(id) {
                    detectDragGestures(onDragStart = { userRotated = true; onInteraction() }) { change, drag ->
                        change.consume(); yaw += drag.x * 0.5f; pitch = (pitch + drag.y * 0.3f).coerceIn(-45f, 45f)
                    }
                } else Modifier),
                engine = engine, modelLoader = loader, materialLoader = materials, environmentLoader = environmentLoader,
                environment = environment, cameraNode = camera, isOpaque = false,
                onViewCreated = {
                    if (overlaySurface) setZOrderOnTop(true)
                    holder.setFormat(android.graphics.PixelFormat.TRANSLUCENT)
                    renderer.clearOptions = renderer.clearOptions.apply { clear = true; clearColor = floatArrayOf(0f, 0f, 0f, 0f) }
                },
                cameraManipulator = null, childNodes = listOfNotNull(model),
                onGestureListener = rememberOnGestureListener(onDoubleTap = { _, _ ->
                    if (interactive) { userRotated = true; onInteraction(); yaw += 180f; pitch = 0f }
                }),
                onFrame = { time ->
                    model?.rotation = Rotation(pitch, if (userRotated || reduceMotion) yaw else sin(time / 1e9 * 1.5).toFloat() * 20f, 0f)
                },
            )
        }
    }
}
