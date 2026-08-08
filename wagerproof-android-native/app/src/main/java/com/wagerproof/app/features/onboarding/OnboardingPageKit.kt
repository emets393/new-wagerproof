package com.wagerproof.app.features.onboarding

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.snap
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.core.design.backgrounds.LocalGlyphRippleEmitter
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.delay

// Shared primitives for the onboarding carousel pages — port of iOS
// `Pages/OnboardingPageKit.swift`. Entrance choreography gated on page
// activation, plus the chip/card/feature-row building blocks every survey page
// composes. Pages own NO chrome — the carousel container's single shell
// provides progress/back/CTA.

// MARK: - Entrance choreography

/**
 * Staggered fade+lift that fires when the page becomes the ACTIVE carousel page.
 * With the button-driven pager that's mount time (the slide-in), but gating on
 * [LocalOnboardingPageIsActive] keeps this correct if a pre-mounting pager ever
 * returns. iOS `spring(response 0.45, damping 0.85)` delayed `min(index, 8) * 0.06`s.
 */
fun Modifier.pageEntrance(index: Int): Modifier = composed {
    val active = LocalOnboardingPageIsActive.current
    val reduceMotion = LocalOnboardingReduceMotion.current
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(active) {
        if (active && !shown) {
            if (!reduceMotion) delay(minOf(index, 8) * 60L)
            shown = true
        }
    }
    val progress by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        // response 0.45 → stiffness (2π/0.45)² ≈ 195; keep the iOS damping.
        animationSpec = if (reduceMotion) snap() else spring(dampingRatio = 0.85f, stiffness = 195f),
        label = "onboardingPageEntrance",
    )
    this
        .alpha(progress)
        .graphicsLayer { translationY = (1f - progress) * 14.dp.toPx() }
}

// MARK: - Stamp entrance

/**
 * Rubber-stamp entrance: the element slams in from a larger, transparent state
 * down to rest with a springy thud + haptic, staggered per index. Like
 * [pageEntrance] it fires when the page becomes ACTIVE. iOS additionally blurs
 * the incoming stamp — Compose's `blur` is API 31+ and stutters on mid-tier
 * hardware, so the scale + fade carry the effect (FIDELITY-WAIVER: stamp blur).
 */
fun Modifier.stampEntrance(index: Int): Modifier = composed {
    val active = LocalOnboardingPageIsActive.current
    val reduceMotion = LocalOnboardingReduceMotion.current
    val haptics = LocalHapticFeedback.current
    var stamped by remember { mutableStateOf(false) }
    LaunchedEffect(active) {
        if (active && !stamped) {
            if (!reduceMotion) delay(minOf(index, 8) * 120L)
            stamped = true
            // Each row thuds as it lands — staggered, so the stamps read as a
            // rhythmic cadence rather than one buzz.
            if (!reduceMotion) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        }
    }
    // response 0.34 → stiffness (2π/0.34)² ≈ 341; iOS damping 0.62 (under-damped
    // so the slight overshoot sells the "stamp pressing down" feel).
    val progress by animateFloatAsState(
        targetValue = if (stamped) 1f else 0f,
        animationSpec = if (reduceMotion) snap() else spring(dampingRatio = 0.62f, stiffness = 341f),
        label = "onboardingStampEntrance",
    )
    this
        .alpha(progress)
        .graphicsLayer {
            val s = 1.35f - 0.35f * progress
            scaleX = s
            scaleY = s
        }
}

// MARK: - Glyph ripple

/**
 * Ripple the shared pixel background at this element's center whenever [active]
 * FLIPS (select AND deselect — any tap should feel alive). Port of iOS
 * `.glyphRipple(on:)`. The onboarding pixelwave fills the window from (0,0), so
 * the element's window-space center maps 1:1 to the field's local coordinates.
 */
fun Modifier.glyphRipple(active: Boolean): Modifier = composed {
    val emitter = LocalGlyphRippleEmitter.current
    var center by remember { mutableStateOf(Offset.Zero) }
    var last by remember { mutableStateOf(active) }
    if (active != last) {
        last = active
        emitter?.emit(center)
    }
    onGloballyPositioned { center = it.boundsInWindow().center }
}

// MARK: - Press feedback

/**
 * Shared pressed-state for every tappable onboarding element: a quick
 * scale-down + slight dim with a springy release, plus semantic click handling.
 * Using [Modifier.clickable] rather than a raw pointer detector is intentional:
 * it keeps the same visual choreography while making every shared onboarding
 * control discoverable and operable through TalkBack, Switch Access, keyboard,
 * and D-pad input. Replaces iOS's `Button` + `OnboardingPressStyle` pairing.
 */
fun Modifier.onboardingPressable(
    enabled: Boolean = true,
    role: Role? = Role.Button,
    onClickLabel: String? = null,
    onClick: () -> Unit,
): Modifier = composed {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed && enabled) 0.965f else 1f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 500f),
        label = "onboardingPressScale",
    )
    val dim by animateFloatAsState(
        targetValue = if (pressed && enabled) 0.85f else 1f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 500f),
        label = "onboardingPressDim",
    )
    this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
            this.alpha = dim
        }
        .clickable(
            interactionSource = interactionSource,
            indication = null,
            enabled = enabled,
            role = role,
            onClickLabel = onClickLabel,
            onClick = onClick,
        )
}

// MARK: - Page scaffold

/**
 * Standard page body: headline + optional subtitle above scrollable content.
 * Keeps typography identical across all survey pages. iOS
 * `OnboardingPageScaffold`.
 */
@Composable
fun OnboardingPageScaffold(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = title,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            textAlign = TextAlign.Center,
            lineHeight = 34.sp,
            modifier = Modifier
                .padding(top = 16.dp)
                .padding(horizontal = 24.dp)
                .pageEntrance(index = 0),
        )
        if (subtitle != null) {
            Text(
                text = subtitle,
                fontSize = 16.sp,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
                modifier = Modifier
                    .padding(horizontal = 28.dp)
                    .pageEntrance(index = 1),
            )
        }
        content()
    }
}

// MARK: - Selectable chip (icon + label pill)

@Composable
fun OnboardingChip(
    label: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    icon: String? = null,
    accent: Color = AppColors.appPrimary,
    onClick: () -> Unit,
) {
    Row(
        modifier = modifier
            .glyphRipple(isSelected)
            .heightIn(min = 48.dp)
            .liquidGlassBackground(
                shape = CircleShape,
                tint = if (isSelected) accent.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.06f),
            )
            .then(if (isSelected) Modifier.border(1.5.dp, accent, CircleShape) else Modifier)
            .padding(horizontal = 16.dp)
            .onboardingPressable(onClickLabel = label, onClick = onClick),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(
                imageVector = onboardingIcon(icon),
                contentDescription = null,
                tint = if (isSelected) accent else Color.White.copy(alpha = 0.8f),
                modifier = Modifier.size(18.dp),
            )
        }
        Text(
            text = label,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// MARK: - Selectable option card (title + detail)

@Composable
fun OnboardingOptionCard(
    title: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    detail: String? = null,
    icon: String? = null,
    accent: Color = AppColors.appPrimary,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .glyphRipple(isSelected)
            .liquidGlassBackground(
                shape = shape,
                tint = if (isSelected) accent.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.05f),
            )
            .then(if (isSelected) Modifier.border(1.5.dp, accent, shape) else Modifier)
            .padding(vertical = 16.dp, horizontal = 16.dp)
            .onboardingPressable(onClickLabel = title, onClick = onClick),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(
                imageVector = onboardingIcon(icon),
                contentDescription = null,
                tint = if (isSelected) accent else Color.White.copy(alpha = 0.85f),
                modifier = Modifier.size(24.dp),
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
            )
            if (detail != null) {
                Text(
                    text = detail,
                    fontSize = 14.sp,
                    color = Color.White.copy(alpha = 0.6f),
                )
            }
        }
    }
}

// MARK: - Inline markdown emphasis

/**
 * Splits a one-line markdown string into `(text, isBold)` runs on `**…**`.
 * Deliberately tiny — the onboarding copy only ever uses strong emphasis, and a
 * full markdown parser would be dead weight. An unterminated `**` is treated as
 * literal text so half-typed copy renders instead of vanishing.
 */
fun parseEmphasisRuns(markdown: String): List<Pair<String, Boolean>> {
    val runs = mutableListOf<Pair<String, Boolean>>()
    var index = 0
    val plain = StringBuilder()
    fun flushPlain() {
        if (plain.isNotEmpty()) {
            runs += plain.toString() to false
            plain.clear()
        }
    }
    while (index < markdown.length) {
        if (markdown.startsWith("**", index)) {
            val close = markdown.indexOf("**", index + 2)
            if (close > index + 1) {
                flushPlain()
                val bold = markdown.substring(index + 2, close)
                if (bold.isNotEmpty()) runs += bold to true
                index = close + 2
                continue
            }
        }
        plain.append(markdown[index])
        index += 1
    }
    flushPlain()
    return runs
}

// MARK: - Marker row (icon + per-line highlighter blobs)

/**
 * A benefit styled like a highlighter swipe: colored copy sitting on dark,
 * soft-edged "marker" blobs that hug each line individually, with a matching
 * colored icon tile that alternates sides row-to-row for a zig-zag. Bold runs
 * render at full color and extra-heavy weight (the stat is the loudest thing on
 * the line) while base copy sits a shade dimmer. Port of iOS `OnboardingMarkerRow`.
 *
 * [lines] is one markdown string per rendered line (`**bold**` for emphasis) —
 * authored explicitly so each line gets its own hugging blob; keep them short so
 * they stay single-line on small screens.
 */
@Composable
fun OnboardingMarkerRow(
    icon: String,
    lines: List<String>,
    color: Color,
    modifier: Modifier = Modifier,
    /** Flip the icon + text to the trailing edge — alternate per row. */
    iconTrailing: Boolean = false,
) {
    // Charcoal a touch lighter than the backdrop so it reads as a marker swipe;
    // the slight transparency lets the pixelwave shimmer through.
    val blobFill = Color(0xFF212121).copy(alpha = 0.9f)

    val iconTile: @Composable () -> Unit = {
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(blobFill, RoundedCornerShape(18.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = onboardingIcon(icon),
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(30.dp),
            )
        }
    }

    val markerText: @Composable () -> Unit = {
        // spacing 0 so the per-line blobs touch and read as one unified marker;
        // each line steps in from the aligned edge for the reference's stagger.
        Column(
            horizontalAlignment = if (iconTrailing) Alignment.End else Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            lines.forEachIndexed { index, line ->
                Text(
                    text = buildAnnotatedString {
                        parseEmphasisRuns(line).forEach { (text, bold) ->
                            withStyle(
                                SpanStyle(
                                    color = if (bold) color else color.copy(alpha = 0.72f),
                                    fontWeight = if (bold) FontWeight.Black else FontWeight.SemiBold,
                                ),
                            ) { append(text) }
                        }
                    },
                    fontSize = 19.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .offset(x = (index * if (iconTrailing) -24 else 24).dp)
                        .background(blobFill, RoundedCornerShape(11.dp))
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                )
            }
        }
    }

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (iconTrailing) {
            Spacer(Modifier.weight(1f))
            markerText()
            iconTile()
        } else {
            iconTile()
            markerText()
            Spacer(Modifier.weight(1f))
        }
    }
}

// MARK: - Feature row (icon + title + copy)

@Composable
fun OnboardingFeatureRow(
    icon: String,
    title: String,
    text: String,
    modifier: Modifier = Modifier,
    accent: Color = AppColors.appPrimary,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .liquidGlassBackground(
                shape = RoundedCornerShape(16.dp),
                tint = Color.White.copy(alpha = 0.06f),
            )
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .liquidGlassBackground(
                    shape = RoundedCornerShape(12.dp),
                    tint = accent.copy(alpha = 0.18f),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = onboardingIcon(icon),
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(20.dp),
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            Text(
                text = text,
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.7f),
                lineHeight = 20.sp,
            )
        }
    }
}
