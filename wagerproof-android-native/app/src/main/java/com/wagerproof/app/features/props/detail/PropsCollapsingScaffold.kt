package com.wagerproof.app.features.props.detail

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * Local collapsing-hero scaffold for the Props detail pages. The shared kit's
 * `CollapsingWidgetScroll` / `TeamAuraBackground` / `WidgetCollapsingSection`
 * aren't ported yet, so this reproduces the pattern in-feature:
 *
 * A [NestedScrollConnection] drives a `progress` 0→1 (expanded→collapsed) by
 * shrinking the top hero as the [LazyColumn] content scrolls under it, then
 * re-expanding it when the content scrolls back to the top. The hero is handed
 * the live progress so it can lerp its own metrics.
 * // FIDELITY-WAIVER #242: hero collapse is nested-scroll driven (no shared
 * // CollapsingWidgetScroll); visual behaviour matches, internals differ.
 */
@Composable
fun PropsCollapsingScaffold(
    heroMax: Dp,
    heroMin: Dp,
    listState: LazyListState = rememberLazyListState(),
    aura: @Composable (progress: Float) -> Unit,
    hero: @Composable (progress: Float) -> Unit,
    modifier: Modifier = Modifier,
    content: LazyListScope.() -> Unit,
) {
    val density = LocalDensity.current
    val maxPx = with(density) { heroMax.toPx() }
    val minPx = with(density) { heroMin.toPx() }
    var heroPx by remember { mutableFloatStateOf(maxPx) }

    val connection = remember(maxPx, minPx) {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                val dy = available.y
                if (dy < 0f && heroPx > minPx) {
                    val newHero = (heroPx + dy).coerceIn(minPx, maxPx)
                    val consumed = newHero - heroPx
                    heroPx = newHero
                    return Offset(0f, consumed)
                }
                return Offset.Zero
            }

            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                val dy = available.y
                if (dy > 0f && heroPx < maxPx) {
                    val newHero = (heroPx + dy).coerceIn(minPx, maxPx)
                    val used = newHero - heroPx
                    heroPx = newHero
                    return Offset(0f, used)
                }
                return Offset.Zero
            }
        }
    }

    val progress = if (maxPx > minPx) ((maxPx - heroPx) / (maxPx - minPx)).coerceIn(0f, 1f) else 0f
    val heroDp = with(density) { heroPx.toDp() }

    Box(modifier.fillMaxSize()) {
        aura(progress)
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth().height(heroDp)) {
                hero(progress)
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxWidth().weight(1f).nestedScroll(connection),
                content = content,
            )
        }
    }
}

/**
 * Two-team radial color glow behind the hero — Android stand-in for iOS
 * `TeamAuraBackground`. Fades as the hero collapses.
 */
@Composable
fun TeamAuraBackground(awayColor: Color, homeColor: Color, progress: Float) {
    // Diagonal two-team wash (away top-left → home bottom-right) that fades as
    // the hero collapses. A linear gradient renders reliably without knowing the
    // box size (unlike a fixed-radius radial). Approximates the iOS glow.
    val alpha = (1f - progress) * 0.28f + 0.06f
    Box(
        Modifier.fillMaxSize().background(AppColors.appSurface).background(
            Brush.linearGradient(
                colors = listOf(
                    awayColor.copy(alpha = alpha),
                    Color.Transparent,
                    homeColor.copy(alpha = alpha),
                ),
                start = Offset(0f, 0f),
                end = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
            ),
        ),
    )
}

/**
 * A titled collapsible widget card — icon + title header over an expandable
 * body. Android stand-in for iOS `WidgetCollapsingSection`; defaults expanded.
 */
@Composable
fun WidgetCollapsingSection(
    title: String,
    systemImage: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var expanded by remember { mutableStateOf(true) }
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.6f), shape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .heightIn(min = 0.dp),
    ) {
        Row(
            Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                AppIcon.fromSystemName(systemImage)?.imageVector ?: AppIcon.CHART_BAR_FILL.imageVector,
                null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(title, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Icon(
                if (expanded) AppIcon.CHEVRON_DOWN.imageVector else AppIcon.CHEVRON_RIGHT.imageVector,
                null, tint = AppColors.appTextMuted, modifier = Modifier.size(12.dp),
            )
        }
        AnimatedVisibility(visible = expanded) {
            Box(Modifier.padding(start = 14.dp, end = 14.dp, bottom = 14.dp)) {
                content()
            }
        }
    }
}

/** Linear interpolation clamped to [0,1]. */
internal fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t.coerceIn(0f, 1f)
