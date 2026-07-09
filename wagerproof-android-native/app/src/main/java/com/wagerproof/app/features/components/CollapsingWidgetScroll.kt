package com.wagerproof.app.features.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * Detail-page scroll engine — port of iOS `Components/CollapsingWidgetScroll.swift`.
 *
 * A [LazyColumn] whose content is offset below a collapsing hero overlay. Scroll
 * progress (0 = expanded … 1 = collapsed) drives the hero height between
 * [heroMaxHeight] and [heroMinHeight]; the [background] builder bleeds behind
 * everything so content masks cleanly as it scrolls under the hero.
 *
 * FIDELITY-WAIVER #201: the per-widget iOS-Weather "pin under header → fade in
 * place" handoff is approximated — the hero collapse is faithful, but individual
 * [WidgetCollapsingSection] cards scroll as normal cards rather than pinning.
 * The visible structure, header accessories, and interactions match.
 */
@Composable
fun CollapsingWidgetScroll(
    heroMaxHeight: Dp,
    heroMinHeight: Dp,
    modifier: Modifier = Modifier,
    heroTopInset: Dp = 12.dp,
    bottomInset: Dp = 24.dp,
    transparentPage: Boolean = false,
    background: @Composable (progress: Float) -> Unit,
    hero: @Composable (progress: Float) -> Unit,
    content: LazyListScope.() -> Unit,
) {
    val listState = rememberLazyListState()
    val collapseRangePx = with(androidx.compose.ui.platform.LocalDensity.current) {
        (heroMaxHeight - heroMinHeight).toPx()
    }
    val progress by remember {
        derivedStateOf {
            if (listState.firstVisibleItemIndex > 0) 1f
            else (listState.firstVisibleItemScrollOffset / collapseRangePx.coerceAtLeast(1f)).coerceIn(0f, 1f)
        }
    }
    val heroHeight = heroMaxHeight - (heroMaxHeight - heroMinHeight) * progress

    Box(modifier.fillMaxSize()) {
        if (!transparentPage) {
            Box(Modifier.fillMaxSize()) { background(progress) }
        }
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = heroMaxHeight + heroTopInset + 12.dp,
                bottom = bottomInset,
            ),
        ) {
            content()
        }
        // Hero overlay (masks content scrolling underneath).
        Box(
            Modifier
                .fillMaxWidth()
                .height(heroHeight + heroTopInset)
                .clip(RoundedCornerShape(bottomStart = 0.dp, bottomEnd = 0.dp)),
        ) {
            // Carousel pages must not paint their own team aura here: this
            // overlay translates with HorizontalPager and made the background
            // color visibly swipe with the matchup. Use a neutral opaque mask
            // to hide scrolled widgets; GameDetailCarousel draws the one fixed
            // additive aura above every page, matching iOS.
            if (transparentPage) {
                Box(Modifier.fillMaxSize().background(AppColors.appSurface))
            } else {
                background(progress)
            }
            Box(Modifier.padding(top = heroTopInset)) { hero(progress) }
        }
    }
}

/**
 * Team-color aura backdrop — port of iOS `TeamAuraBackground`. Opaque surface
 * base + two blurred radial glows hugging the left (away) / right (home) edges,
 * dimming + shrinking as progress→1. Colors cross-fade when the tint changes.
 */
@Composable
fun TeamAuraBackground(
    awayPrimary: Color,
    homePrimary: Color,
    progress: Float = 0f,
    showBase: Boolean = true,
    modifier: Modifier = Modifier,
) {
    val away by animateColorAsState(awayPrimary, label = "aura-away")
    val home by animateColorAsState(homePrimary, label = "aura-home")
    val alpha = 0.85f - 0.30f * progress
    Box(modifier.fillMaxSize()) {
        if (showBase) Box(Modifier.fillMaxSize().background(AppColors.appSurface))
        Box(
            Modifier
                .fillMaxSize()
                .blur(48.dp)
                .background(
                    Brush.horizontalGradient(
                        0f to away.copy(alpha = alpha),
                        0.35f to Color.Transparent,
                        0.65f to Color.Transparent,
                        1f to home.copy(alpha = alpha),
                    ),
                ),
        )
    }
}

/**
 * The iOS-Weather widget card — port of `WidgetCollapsingSection`. A 48pt glass
 * header band (uppercase title + icon + accessory) over a padded body inside a
 * rounded-16 glass card. `showsHeader = false` renders a bare body (NFL/CFB
 * pick cards).
 */
@Composable
fun WidgetCollapsingSection(
    title: String,
    modifier: Modifier = Modifier,
    icon: AppIcon? = null,
    iconTint: Color = AppColors.appTextSecondary,
    accessory: WidgetHeaderAccessory = WidgetHeaderAccessory.None,
    showsHeader: Boolean = true,
    onHeaderTap: (() -> Unit)? = null,
    bodyPadding: Dp = 16.dp,
    content: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(WidgetCard.corner)
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = WidgetCard.hInset, vertical = WidgetCard.gap / 2)
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .border(0.5.dp, Color.White.copy(alpha = 0.08f), shape),
    ) {
        if (showsHeader) {
            val headerMod = if (onHeaderTap != null) {
                Modifier.fillMaxWidth().height(48.dp)
                    .clickable(onClick = onHeaderTap)
            } else {
                Modifier.fillMaxWidth().height(48.dp)
            }
            Row(
                headerMod.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                icon?.let {
                    Icon(it.imageVector, contentDescription = null, tint = iconTint, modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(8.dp))
                }
                Text(
                    title.uppercase(),
                    color = AppColors.appTextSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.weight(1f))
                AccessoryView(accessory)
            }
        }
        Box(Modifier.padding(bodyPadding)) { content() }
    }
}

@Composable
private fun AccessoryView(accessory: WidgetHeaderAccessory) {
    when (accessory) {
        WidgetHeaderAccessory.None -> {}
        is WidgetHeaderAccessory.TapHint -> Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (accessory.expanded) "Less" else "Tap",
                color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.width(4.dp))
            Icon(AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(13.dp))
        }
        is WidgetHeaderAccessory.Chevron -> Icon(
            AppIcon.CHEVRON_DOWN.imageVector, null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.size(16.dp).rotate(if (accessory.expanded) 180f else 0f),
        )
        is WidgetHeaderAccessory.Verdict -> Box(
            Modifier.clip(CircleShape).background(accessory.tint.copy(alpha = 0.15f)).padding(horizontal = 8.dp, vertical = 3.dp),
        ) {
            Text(accessory.text, color = accessory.tint, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}
