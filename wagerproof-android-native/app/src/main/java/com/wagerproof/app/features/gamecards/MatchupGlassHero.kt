package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.max

/** One side of a [MatchupGlassHero]. */
data class MatchupHeroSide(
    val logoURL: String?,
    val abbr: String,
    val colors: TeamColorPair,
    val moneyline: Int?,
)

/** A single label/value stat, matching iOS `MatchupGlassHero.Stat`. */
data class HeroStat(val label: String, val value: String)

/**
 * Scroll-morphing matchup centerpiece, geometry-matched to iOS.
 *
 * Expanded: two 80dp glass discs overlap and fuse in the center, with the full
 * market summary beneath them. Collapsed: the discs continuously travel to
 * opposite edges at 40dp while compact stats occupy the opened center gap and
 * each moneyline lands beneath its team. There is no midpoint layout swap.
 */
@Composable
fun MatchupGlassHero(
    away: MatchupHeroSide,
    home: MatchupHeroSide,
    progress: Float,
    expandedStats: List<HeroStat>,
    collapsedStats: List<HeroStat>,
    fusedTitle: String,
    modifier: Modifier = Modifier,
) {
    val p = progress.coerceIn(0f, 1f)
    val split = ((p - 0.18f) / 0.60f).coerceIn(0f, 1f)
    val size = lerpDp(80.dp, 40.dp, p)
    val detail = (1f - p * 1.9f).coerceIn(0f, 1f)

    Column(
        modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        DiscRow(
            away = away,
            home = home,
            size = size,
            progress = p,
            split = split,
            collapsedStats = collapsedStats,
            fusedTitle = fusedTitle,
        )
        if (detail > 0.02f) {
            StatRow(
                stats = expandedStats,
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(detail),
                evenlySpaced = true,
            )
        }
    }
}

@Composable
private fun DiscRow(
    away: MatchupHeroSide,
    home: MatchupHeroSide,
    size: Dp,
    progress: Float,
    split: Float,
    collapsedStats: List<HeroStat>,
    fusedTitle: String,
) {
    val labelHeight = 30.dp
    BoxWithConstraints(Modifier.fillMaxWidth().height(size + 2.dp + labelHeight)) {
        val edgeMargin = 8.dp
        val fusedGap = size * -0.16f
        val splitGap = max(fusedGap.value, (maxWidth - size * 2f - edgeMargin * 2f).value).dp
        val gap = lerpDp(fusedGap, splitGap, progress)
        val awayCenter = maxWidth / 2f - (size + gap) / 2f
        val homeCenter = maxWidth / 2f + (size + gap) / 2f

        // The bridge is a real draw layer. It contracts with the discs and
        // fades as their glass surfaces unmerge, preserving the iOS metaball
        // read without relying on a discontinuous Compose arrangement swap.
        MetaballBridge(
            awayCenter = awayCenter,
            homeCenter = homeCenter,
            diameter = size,
            away = away.colors,
            home = home.colors,
            alpha = (1f - split).coerceIn(0f, 1f),
            modifier = Modifier.fillMaxWidth().height(size),
        )

        StatRow(
            stats = collapsedStats,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = (size - 32.dp) / 2f)
                .alpha(split),
            evenlySpaced = false,
        )

        HeroDisc(
            side = away,
            size = size,
            modifier = Modifier.offset(x = awayCenter - size / 2f),
        )
        HeroDisc(
            side = home,
            size = size,
            modifier = Modifier.offset(x = homeCenter - size / 2f),
        )

        TeamLabel(
            away,
            Modifier
                .offset(x = awayCenter - 32.dp, y = size + 2.dp)
                .size(width = 64.dp, height = labelHeight)
                .alpha(split),
        )
        TeamLabel(
            home,
            Modifier
                .offset(x = homeCenter - 32.dp, y = size + 2.dp)
                .size(width = 64.dp, height = labelHeight)
                .alpha(split),
        )

        Text(
            fusedTitle,
            color = AppColors.appTextPrimary,
            fontSize = 17.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            maxLines = 1,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = size + 2.dp)
                .height(labelHeight)
                .alpha(1f - split),
        )
    }
}

@Composable
private fun MetaballBridge(
    awayCenter: Dp,
    homeCenter: Dp,
    diameter: Dp,
    away: TeamColorPair,
    home: TeamColorPair,
    alpha: Float,
    modifier: Modifier = Modifier,
) {
    if (alpha <= 0.01f) return
    Canvas(modifier.alpha(alpha)) {
        val left = awayCenter.toPx()
        val right = homeCenter.toPx()
        val d = diameter.toPx()
        val r = d / 2f
        val bridgeLeft = left
        val bridgeRight = right
        val bridgeHeight = d * 0.72f
        val top = r - bridgeHeight / 2f
        val gradient = Brush.horizontalGradient(
            colors = listOf(
                away.primary.teamVisible(0.5f).copy(alpha = 0.44f),
                away.secondary.copy(alpha = 0.32f),
                home.secondary.copy(alpha = 0.32f),
                home.primary.teamVisible(0.5f).copy(alpha = 0.44f),
            ),
            startX = left - r,
            endX = right + r,
        )
        drawRoundRect(
            brush = gradient,
            topLeft = Offset(bridgeLeft, top),
            size = Size((bridgeRight - bridgeLeft).coerceAtLeast(0f), bridgeHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(bridgeHeight / 2f),
        )
        drawOval(
            brush = gradient,
            topLeft = Offset(left - r, 0f),
            size = Size(d, d),
        )
        drawOval(
            brush = gradient,
            topLeft = Offset(right - r, 0f),
            size = Size(d, d),
        )
        drawOval(
            color = Color.White.copy(alpha = 0.18f),
            topLeft = Offset(left - r, 0f),
            size = Size(d, d),
            style = Stroke(width = 1.dp.toPx()),
        )
        drawOval(
            color = Color.White.copy(alpha = 0.18f),
            topLeft = Offset(right - r, 0f),
            size = Size(d, d),
            style = Stroke(width = 1.dp.toPx()),
        )
    }
}

@Composable
private fun HeroDisc(side: MatchupHeroSide, size: Dp, modifier: Modifier = Modifier) {
    val dark = isSystemInDarkTheme()
    val primary = side.colors.primary.teamVisible(0.5f)
    val secondary = side.colors.secondary.teamVisible(0.5f)
    val plate = logoPlate(primary, dark)
    Box(
        modifier
            .size(size)
            .shadow(6.dp, CircleShape, ambientColor = primary.copy(alpha = 0.28f), spotColor = primary.copy(alpha = 0.28f))
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(primary.copy(alpha = 0.55f), secondary.copy(alpha = 0.35f))))
            .border(1.dp, Color.White.copy(alpha = 0.18f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(size * 0.82f)
                .clip(CircleShape)
                .then(if (plate != null) Modifier.background(plate) else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            RemoteImage(
                side.logoURL,
                side.abbr,
                Modifier
                    .size(if (plate != null) size * 0.72f else size * 0.82f)
                    .clip(CircleShape),
                error = {
                    Text(
                        TeamInitials.from(side.abbr),
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = (size.value * 0.32f).sp,
                    )
                },
            )
        }
    }
}

@Composable
private fun TeamLabel(side: MatchupHeroSide, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(side.abbr, color = AppColors.appTextPrimary, fontSize = 13.sp, lineHeight = 14.sp, fontWeight = FontWeight.Black, maxLines = 1)
        Text(
            GameCardFormatting.formatMoneyline(side.moneyline),
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            lineHeight = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            maxLines = 1,
        )
    }
}

@Composable
private fun StatRow(
    stats: List<HeroStat>,
    modifier: Modifier = Modifier,
    evenlySpaced: Boolean,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        stats.forEach { stat ->
            StatColumn(stat, if (evenlySpaced) Modifier.weight(1f) else Modifier)
            if (!evenlySpaced && stat !== stats.last()) Box(Modifier.size(width = 12.dp, height = 1.dp))
        }
    }
}

@Composable
private fun StatColumn(stat: HeroStat, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            stat.label.uppercase(),
            color = AppColors.appTextSecondary,
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp,
            maxLines = 1,
        )
        Text(
            stat.value,
            color = AppColors.appTextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

private fun logoPlate(primary: Color, dark: Boolean): Color? {
    val luminance = primary.luminance()
    return when {
        dark && luminance < 0.45f -> Color(0xFFC7C7C7).copy(alpha = 0.15f)
        !dark && luminance > 0.60f -> Color.Black.copy(alpha = 0.55f)
        else -> null
    }
}

private fun lerpDp(a: Dp, b: Dp, t: Float): Dp = a + (b - a) * t.coerceIn(0f, 1f)
