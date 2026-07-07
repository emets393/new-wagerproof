package com.wagerproof.core.design.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer

/**
 * Skeleton shimmer — port of iOS `Modifiers/Shimmer.swift`.
 *
 * A soft diagonal highlight band sweeps across the MASKED ALPHA of the
 * content, so only the placeholder silhouettes glint — never the gaps between
 * them. Apply to the inner placeholder group of a skeleton card (not its
 * solid chrome). This is the single shimmer vocabulary for every list
 * skeleton, so loading states feel consistent everywhere.
 *
 * Same masked-alpha trick as iOS: render offscreen, then multiply alpha with
 * a travelling 3-stop gradient (edges at 35% so the band reads as a glint).
 * iOS animates `phase` 0→0.8 over 1.4 s with the mask scaled 3×; here the
 * gradient spans 3× the content diagonal for the identical clear-through.
 *
 * Pass `active = false` to freeze (reduce-motion users get the static
 * silhouette — the caller decides, matching the backgrounds' contract).
 */
fun Modifier.shimmering(
    active: Boolean = true,
    durationMillis: Int = 1400,
): Modifier = composed {
    if (!active) return@composed Modifier

    val transition = rememberInfiniteTransition(label = "shimmer")
    val phase = transition.animateFloat(
        initialValue = 0f,
        targetValue = 0.8f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "shimmerPhase",
    )

    Modifier
        // Offscreen so DstIn masks the whole group's alpha, not per-draw-call.
        .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
        .drawWithContent {
            drawContent()
            val p = phase.value
            // 3× diagonal span mirrors iOS's `scaleEffect(3)` on the mask —
            // guarantees the band fully clears the content at both sweep ends.
            val start = Offset(-size.width, -size.height)
            val end = Offset(size.width * 2f, size.height * 2f)
            drawRect(
                brush = Brush.linearGradient(
                    colorStops = arrayOf(
                        p to Color.Black.copy(alpha = 0.35f),
                        (p + 0.1f) to Color.Black,
                        (p + 0.2f) to Color.Black.copy(alpha = 0.35f),
                    ),
                    start = start,
                    end = end,
                ),
                blendMode = BlendMode.DstIn,
            )
        }
}
