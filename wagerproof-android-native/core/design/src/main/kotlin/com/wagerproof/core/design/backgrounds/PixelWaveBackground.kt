package com.wagerproof.core.design.backgrounds

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import com.wagerproof.core.design.tokens.AppAnimations
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.roundToInt

/**
 * Energy level of the pixelwave field. [Ambient] is the everyday hero/auth
 * backdrop; [High] is the loud, fast, bright pulse used as the agent
 * generation-complete transition.
 */
enum class PixelWaveIntensity { Ambient, High }

/**
 * Shared "pixelwave" backdrop — port of iOS `PixelWaveBackground.swift` (with
 * `AnimatedAccentPixelWave` folded in: the accent tween is just
 * `animateColorAsState`, which Compose interpolates natively).
 *
 * A near-black gradient under three breathing wavy shadow sheets
 * ([WaveBackground]) with the animated [PixelGlyphField] on top, tinted by
 * [accentColor].
 *
 * [progress] (0 = expanded … 1 = collapsed) calms the wave + glyph layer to
 * 50% opacity as a collapsing hero shrinks; the opaque gradient base never
 * fades, so this can double as the hero's masking background. High intensity
 * never calms — it stays loud on purpose.
 *
 * [screenAnchored] pins the wave + glyph field to WINDOW coordinates sized to
 * the full window, so multiple instances (page background + hero mask in a
 * collapsing scroll) paint IDENTICAL pixels and line up at the hero's bottom
 * seam. Anchored fields are also masked by a top-weighted fade (solid through
 * the hero, dissolved by ~58% of screen height) and made inert to touch (the
 * glyph tap-ripple gesture would otherwise swallow scroll drags).
 */
@Composable
fun PixelWaveBackground(
    modifier: Modifier = Modifier,
    accentColor: Color = AppColors.appPrimary,
    progress: Float = 0f,
    screenAnchored: Boolean = false,
    intensity: PixelWaveIntensity = PixelWaveIntensity.Ambient,
    rippleEmitter: GlyphRippleEmitter? = null,
    reduceMotion: Boolean = false,
) {
    // iOS needed an Animatable wrapper because Canvas fills can't be framework-
    // interpolated; animateColorAsState does the same tween (incl. mid-flight
    // retargeting) natively.
    val accent by animateColorAsState(
        targetValue = accentColor,
        animationSpec = AppAnimations.appStandard(),
        label = "pixelWaveAccent",
    )
    val high = intensity == PixelWaveIntensity.High
    // Field opacity eases 1.0 → 0.5 as the hero collapses, so the animation
    // calms into a compact bar instead of churning behind the small stats.
    val calm = if (high) 1f else 1f - 0.5f * progress.coerceIn(0f, 1f)

    Box(modifier = modifier) {
        // Opaque near-black base — doubles as the collapsing hero's mask.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to AppColors.pixelWaveBase,
                        0.5f to AppColors.pixelWaveBase,
                        1f to AppColors.pixelWaveTail,
                    ),
                ),
        )
        // Subtle top/bottom sheen.
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0f to Color.White.copy(alpha = 0.035f),
                        0.5f to Color.White.copy(alpha = 0f),
                        1f to Color.White.copy(alpha = 0.025f),
                    ),
                ),
        )

        if (screenAnchored) {
            AnchoredField(
                accent = accent,
                calm = calm,
                high = high,
                rippleEmitter = rippleEmitter,
                reduceMotion = reduceMotion,
            )
        } else {
            FieldLayers(
                modifier = Modifier
                    .fillMaxSize()
                    .alpha(calm),
                accent = accent,
                high = high,
                rippleEmitter = rippleEmitter,
                tapRipples = true,
                reduceMotion = reduceMotion,
            )
        }
    }
}

/**
 * Full-window field pinned to window (0,0) regardless of this instance's own
 * (possibly hero-clipped) frame, masked by the top-weighted hero fade. The
 * offset is render-only — no layout impact.
 */
@Composable
private fun AnchoredField(
    accent: Color,
    calm: Float,
    high: Boolean,
    rippleEmitter: GlyphRippleEmitter?,
    reduceMotion: Boolean,
) {
    val windowSize: IntSize = LocalWindowInfo.current.containerSize
    val density = LocalDensity.current
    var originInWindow by remember { mutableStateOf(Offset.Zero) }

    val widthDp = with(density) { maxOf(1, windowSize.width).toDp() }
    val heightDp = with(density) { maxOf(1, windowSize.height).toDp() }

    Box(
        Modifier
            .fillMaxSize()
            .onGloballyPositioned { originInWindow = it.positionInWindow() },
        contentAlignment = Alignment.TopStart,
    ) {
        FieldLayers(
            modifier = Modifier
                .requiredSize(widthDp, heightDp)
                .offset { IntOffset(-originInWindow.x.roundToInt(), -originInWindow.y.roundToInt()) }
                .alpha(calm)
                // Concentrate the field in the hero zone: full strength behind
                // the hero, dissolving to a clean dark surface below so widget
                // cards scroll over a cohesive base. The mask lives in the
                // (window-sized) local space and rides the same offset, so
                // every anchored instance fades identically.
                .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
                .drawWithContent {
                    drawContent()
                    drawRect(
                        brush = Brush.verticalGradient(
                            0f to Color.White,
                            0.26f to Color.White,
                            0.58f to Color.Transparent,
                        ),
                        blendMode = BlendMode.DstIn,
                    )
                },
            accent = accent,
            high = high,
            rippleEmitter = rippleEmitter,
            // Anchored fields must be inert — the tap gesture would swallow
            // the widget scroller's drags. External emitter ripples still work.
            tapRipples = false,
            reduceMotion = reduceMotion,
        )
    }
}

/** The wave sheets + glyph field, dialed up when [high]. */
@Composable
private fun FieldLayers(
    modifier: Modifier,
    accent: Color,
    high: Boolean,
    rippleEmitter: GlyphRippleEmitter?,
    tapRipples: Boolean,
    reduceMotion: Boolean,
) {
    Box(modifier) {
        WaveBackground(
            modifier = Modifier.fillMaxSize(),
            sheetColor = AppColors.pixelWaveBase,
            shadowStrength = if (high) 0.5 else 0.28,
            shadowRadius = if (high) 22f else 18f,
            shadowOffset = if (high) 10f else 8f,
            reduceMotion = reduceMotion,
        )
        PixelGlyphField(
            modifier = Modifier.fillMaxSize(),
            intervals = if (high) listOf(0.12) else listOf(0.3),
            accentColor = accent,
            spacing = if (high) 22f else 26f,
            dotSize = if (high) 6.5f else 5.5f,
            peakOpacity = if (high) 0.9 else 0.45,
            rippleEmitter = rippleEmitter,
            tapRipples = tapRipples,
            reduceMotion = reduceMotion,
        )
    }
}
