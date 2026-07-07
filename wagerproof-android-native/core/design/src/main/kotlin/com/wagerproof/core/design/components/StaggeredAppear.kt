package com.wagerproof.core.design.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.tokens.AppAnimations
import kotlinx.coroutines.delay
import kotlin.math.min

/**
 * Cascade-in entrance for freshly-loaded list rows / cards — port of iOS
 * `Modifiers/StaggeredAppear.swift`.
 *
 * Each row fades and lifts into place (opacity 0→1, y-offset 12→0,
 * spring(0.42, 0.82)) with a per-index delay of 40 ms, capped at index 6 so
 * rows deep in a lazy list don't wait noticeably as they scroll into view —
 * only the first screenful visibly cascades.
 *
 * `reduceMotion = true` shows the row instantly (parity with iOS's
 * Reduce Motion check; the app resolves the setting and passes it down).
 */
fun Modifier.staggeredAppear(
    index: Int,
    delayPerItemMillis: Int = 40,
    maxStaggered: Int = 6,
    yOffset: Dp = 12.dp,
    reduceMotion: Boolean = false,
): Modifier = composed {
    // Saveable so a row that already played doesn't replay after config
    // change / coming back from the back stack — same as iOS's one-shot
    // `@State shown` surviving the view identity.
    var shown by rememberSaveable(index) { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (shown) return@LaunchedEffect
        if (!reduceMotion) {
            delay(min(index, maxStaggered) * delayPerItemMillis.toLong())
        }
        shown = true
    }

    val progress by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = if (reduceMotion) {
            androidx.compose.animation.core.snap()
        } else {
            AppAnimations.appStagger()
        },
        label = "staggeredAppear",
    )

    Modifier.graphicsLayer {
        alpha = progress
        translationY = (1f - progress) * yOffset.toPx()
    }
}
