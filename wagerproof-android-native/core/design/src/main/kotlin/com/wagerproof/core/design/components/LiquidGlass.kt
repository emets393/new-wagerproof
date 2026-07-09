package com.wagerproof.core.design.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.tokens.AppColors
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.materials.HazeMaterials

/**
 * Liquid Glass — port of iOS `LiquidGlassBackground.swift` /
 * `LiquidGlassCapsule.swift`.
 *
 * iOS has two tiers: real `glassEffect` on iOS 26 and an `ultraThinMaterial`
 * fallback below. The Android target is the FALLBACK tier (doc §10.3) —
 * porting it faithfully guarantees parity, real backdrop blur is an
 * enhancement:
 *  - when a screen provides a [HazeState] via [LocalHazeState] (its
 *    background layers marked with `Modifier.hazeSource`), pills/cards get a
 *    true backdrop blur through Haze;
 *  - otherwise: translucent `appSurfaceElevated` @ 72%.
 * Both tiers add the optional `tint @ 0.18` wash and (for capsules) the
 * hairline `white @ 0.25, 0.5dp` stroke.
 *
 * iOS 26's `.interactive()` touch refraction and `GlassEffectContainer` disc
 * merging are deliberately skipped — iOS < 26 does without them too.
 */
val LocalHazeState = compositionLocalOf<HazeState?> { null }

/**
 * Mark a screen's background layers as the blur source for every glass
 * surface hosted under the same [LocalHazeState]. One source per screen —
 * never nest blurs.
 */
fun Modifier.liquidGlassSource(state: HazeState): Modifier = hazeSource(state)

/**
 * Creates one Haze capture state for a complete screen. [content] receives the
 * modifier that must be attached to the screen's full-bleed background/root
 * drawing layer. Glass descendants automatically resolve the same state.
 */
@Composable
fun LiquidGlassScene(content: @Composable (sourceModifier: Modifier) -> Unit) {
    val state = remember { HazeState() }
    CompositionLocalProvider(LocalHazeState provides state) {
        content(Modifier.liquidGlassSource(state))
    }
}

/**
 * Glass background clipped to [shape]. `tint` blends a stateful color into
 * the surface (active filter pills, accent CTAs) at the iOS fallback's 18%.
 */
fun Modifier.liquidGlassBackground(
    shape: Shape,
    tint: Color? = null,
    hairline: Boolean = false,
): Modifier = composed {
    val haze = LocalHazeState.current
    val surfaced = if (haze != null) {
        clip(shape).hazeEffect(
            state = haze,
            style = HazeMaterials.ultraThin(containerColor = AppColors.appSurfaceElevated),
        )
    } else {
        // No backdrop capture available — preserve enough transparency for
        // gradients/images beneath the chip to read, like ultraThinMaterial.
        // The prior 92% fill made every pill look like an opaque dark block.
        clip(shape).background(AppColors.appSurfaceElevated.copy(alpha = 0.72f))
    }
    val tinted = if (tint != null) surfaced.background(tint.copy(alpha = 0.18f)) else surfaced
    if (hairline) {
        tinted.border(0.5.dp, Color.White.copy(alpha = 0.25f), shape)
    } else {
        tinted
    }
}

/**
 * Capsule specialization used by dozens of pill sites (scope banners,
 * search/sort pills, info chips). All pills MUST share identical visuals —
 * matched seams — so always come through here rather than hand-rolling.
 */
fun Modifier.liquidGlassCapsule(tint: Color? = null): Modifier =
    liquidGlassBackground(shape = CircleShape, tint = tint, hairline = true)

/** Container form for call sites that read better as a wrapper than a modifier. */
@Composable
fun LiquidGlassCapsule(
    modifier: Modifier = Modifier,
    tint: Color? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(modifier = modifier.liquidGlassCapsule(tint), content = content)
}
