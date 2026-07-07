package com.wagerproof.app.features.chat

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.shimmering
import kotlinx.coroutines.delay

/**
 * Port of iOS `WagerBotThinkingIndicator.swift`.
 *
 * Three pulsing accent dots (staggered 0 / 0.15 / 0.3s) + a cycling italic
 * betting verb (rotates every 3s with a shimmer sweep over the glyphs).
 */
@Composable
fun WagerBotThinkingIndicator(ui: WagerBotUiTokens, modifier: Modifier = Modifier) {
    val verbs = remember {
        listOf(
            "crunching the numbers",
            "running the models",
            "checking the lines",
            "comparing odds",
            "weighing the matchup",
            "scanning Polymarket",
            "reading the splits",
            "looking up trends",
            "pulling predictions",
            "spotting the edge",
            "tracking the steam",
            "syncing live data",
        )
    }

    // Random initial index (mirrors iOS's ms-based seed).
    var verbIndex by remember { mutableIntStateOf((System.currentTimeMillis() % verbs.size).toInt()) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(3000)
            verbIndex = (verbIndex + 1) % verbs.size
        }
    }

    Row(
        modifier = modifier.padding(top = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ThinkingDots(color = ui.accent)
        AnimatedContent(
            targetState = verbIndex,
            transitionSpec = {
                (fadeIn(tween(400)) + slideInVerticallySmall()) togetherWith fadeOut(tween(400))
            },
            label = "verb",
        ) { idx ->
            ShimmerVerb(text = verbs[idx], color = ui.accent)
        }
    }
}

private fun slideInVerticallySmall() =
    androidx.compose.animation.slideInVertically(tween(400)) { it / 6 }

@Composable
private fun ThinkingDots(color: Color) {
    val transition = rememberInfiniteTransition(label = "dots")
    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
        // Staggered opacity pulse — 0.9s each, delayed 0 / 150 / 300ms.
        listOf(0, 150, 300).forEach { delayMs ->
            val a by transition.animateFloat(
                initialValue = 0.3f,
                targetValue = 1.0f,
                animationSpec = infiniteRepeatable(
                    tween(900, delayMillis = delayMs, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                    RepeatMode.Reverse,
                ),
                label = "dot$delayMs",
            )
            Box(
                Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .alpha(a)
                    .background(color),
            )
        }
    }
}

/**
 * Verb text with a dim base + a bright shimmering copy overlaid, masked to
 * the glyphs (the shared `.shimmering()` sweep).
 */
@Composable
private fun ShimmerVerb(text: String, color: Color) {
    Box {
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            fontStyle = FontStyle.Italic,
            color = color.copy(alpha = 0.45f),
        )
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            fontStyle = FontStyle.Italic,
            color = color,
            modifier = Modifier.graphicsLayer { }.shimmering(),
        )
    }
}
