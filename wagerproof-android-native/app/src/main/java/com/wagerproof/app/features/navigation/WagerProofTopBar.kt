package com.wagerproof.app.features.navigation

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.StartOffsetType
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppLayout
import com.wagerproof.core.stores.MainTabStore

/**
 * Shared per-tab toolbar chrome — port of iOS `Features/Navigation/MainTabToolbar`
 * (doc 08 §3.2). Three reusable pieces plus a convenient combined [WagerProofTopBar]:
 *  - [WagerProofWordmark]: passive two-tone brand mark with a looping shimmer sweep
 *    over "Proof".
 *  - [SettingsToolbarButton]: flips `MainTabStore.isSettingsPresented` — the single
 *    entry point into Settings.
 *
 * iOS pushes Settings/Chat onto the active tab's own NavigationStack, gated on
 * `selected == tab`; on Android the shell ([com.wagerproof.app.nav.MainScaffold])
 * observes those same flags and mounts one overlay, so the per-tab guard is
 * unnecessary here (doc 08 §3.2 closing note).
 */

/**
 * Two-tone "Wager**Proof**" wordmark. "Wager" in primary text at 55%, "Proof" in
 * brand green (#00E676) at 55% with a bright highlight that sweeps the glyphs on
 * a 1.6s loop. A passive brand mark, not a button.
 */
@Composable
fun WagerProofWordmark(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .offset(x = (-8).dp)
            .padding(end = 12.dp)
            .semantics { contentDescription = "WagerProof" },
    ) {
        Text(
            text = "Wager",
            color = AppColors.appTextPrimary.copy(alpha = 0.55f),
            fontSize = 15.sp,
            lineHeight = 18.sp,
            letterSpacing = (-0.15).sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Text(
            text = "Proof",
            // Translucent base with the shimmer riding on top at full strength —
            // dimming the whole glyph would wash the shine out, so the alpha lives
            // on the base color only (matches iOS TextShimmer).
            color = Color(0xFF00E676).copy(alpha = 0.55f),
            fontSize = 15.sp,
            lineHeight = 18.sp,
            letterSpacing = (-0.15).sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.textShimmerSweep(),
        )
    }
}

/**
 * Sweeps a bright highlight across the modified glyphs on a loop — the classic
 * iOS "shine". A white stripe travels left→right, masked to the glyph coverage
 * via [BlendMode.SrcAtop] so only the letters light up. Offscreen compositing so
 * the blend is against the whole text group, not per-draw-call.
 */
@Composable
private fun Modifier.textShimmerSweep(): Modifier {
    val transition = rememberInfiniteTransition(label = "wordmarkShimmer")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
            initialStartOffset = StartOffset(300, StartOffsetType.Delay),
        ),
        label = "wordmarkShimmerPhase",
    )
    return this
        .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
        .drawWithContent {
        drawContent()
        // A narrow white band centered on `phase`, travelling across the width.
        val bandStart = (phase * 2f - 0.5f) * size.width
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(Color.Transparent, Color.White.copy(alpha = 0.9f), Color.Transparent),
                start = Offset(bandStart, 0f),
                end = Offset(bandStart + size.width * 0.5f, size.height),
            ),
            blendMode = BlendMode.SrcAtop,
        )
    }
}

/** WagerBot launcher — flips the shell-level chat overlay flag. */
@Composable
fun WagerBotToolbarButton(tabStore: MainTabStore, modifier: Modifier = Modifier) {
    IconButton(
        onClick = { tabStore.isChatPresented = true },
        modifier = modifier.size(AppLayout.topBarContentHeight),
    ) {
        // iOS uses the bespoke WagerBotIcon glyph; no Android equivalent yet — the
        // chat-bubble SF-symbol map is the closest stand-in.
        Icon(
            imageVector = AppIcon.BUBBLE_LEFT_AND_TEXT_BUBBLE_RIGHT_FILL.imageVector,
            contentDescription = "WagerBot",
            tint = AppColors.appTextPrimary,
        )
    }
}

/** Settings launcher — the single entry point into Settings (flips the flag). */
@Composable
fun SettingsToolbarButton(tabStore: MainTabStore, modifier: Modifier = Modifier) {
    IconButton(
        onClick = { tabStore.isSettingsPresented = true },
        modifier = modifier.size(AppLayout.topBarContentHeight),
    ) {
        Icon(
            imageVector = AppIcon.GEARSHAPE.imageVector,
            contentDescription = "Settings",
            tint = AppColors.appTextPrimary,
        )
    }
}

/**
 * Combined root top bar: leading wordmark, page-specific [actions], and the
 * Settings gear pinned rightmost. WagerBot is intentionally hidden from main
 * tab chrome in the current iOS contract; [showWagerBot] remains available for
 * isolated previews and future experiments.
 */
@Composable
fun WagerProofTopBar(
    tabStore: MainTabStore,
    modifier: Modifier = Modifier,
    showWagerBot: Boolean = false,
    actions: @Composable () -> Unit = {},
) {
    Row(
        modifier = modifier
            .heightIn(min = AppLayout.topBarContentHeight)
            .padding(horizontal = AppLayout.screenHorizontalPadding),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        WagerProofWordmark(modifier = Modifier.weight(1f))
        actions()
        if (showWagerBot) WagerBotToolbarButton(tabStore)
        SettingsToolbarButton(tabStore)
    }
}
