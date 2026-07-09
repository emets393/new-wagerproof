package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.CompareArrows
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.ArrowCircleDown
import androidx.compose.material.icons.rounded.Bedtime
import androidx.compose.material.icons.rounded.Circle
import androidx.compose.material.icons.rounded.DirectionsRun
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Flag
import androidx.compose.material.icons.rounded.Flight
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Looks3
import androidx.compose.material.icons.rounded.Looks4
import androidx.compose.material.icons.rounded.LooksOne
import androidx.compose.material.icons.rounded.LooksTwo
import androidx.compose.material.icons.rounded.PanTool
import androidx.compose.material.icons.rounded.Percent
import androidx.compose.material.icons.rounded.Pets
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Sensors
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.SportsBaseball
import androidx.compose.material.icons.rounded.SportsBasketball
import androidx.compose.material.icons.rounded.ThumbDown
import androidx.compose.material.icons.rounded.ThumbUp
import androidx.compose.material.icons.rounded.WbSunny
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * Shared helpers for the Outliers feature port.
 *
 * `OutliersShared` centralizes two things the ported Outliers views need but the
 * foundation doesn't cover 1:1:
 *  - [outlierSymbol]: SF-symbol → Material icon resolution beyond [AppIcon]'s
 *    core map (the trend-row / market / subject symbols the doc enumerates).
 *  - [OutlierGlassTeamAvatar] / [OutlierDiagonalMatchupLogos]: self-contained
 *    team discs. iOS uses `teamGlassDisc` + `LiquidGlassMergeContainer`, which
 *    aren't ported yet — this reproduces the treatment with the available glass
 *    primitives. // FIDELITY-WAIVER #230: no true glass-disc merge (pre-26 look).
 */

/**
 * Resolve an SF Symbol name to a Material [ImageVector], trying [AppIcon]'s
 * central map first, then this feature's extension map (trend-dimension +
 * market + subject symbols), then [fallback].
 */
fun outlierSymbol(
    name: String,
    fallback: ImageVector = AppIcon.CHART_LINE_UPTREND.imageVector,
): ImageVector {
    AppIcon.fromSystemName(name)?.let { return it.imageVector }
    return extraSymbols[name] ?: fallback
}

// Symbols used by the Outliers trend rows / market headers that aren't in the
// central AppIcon inventory. Mapped to the closest Material rounded glyph.
private val extraSymbols: Map<String, ImageVector> = mapOf(
    "airplane" to Icons.Rounded.Flight,
    "house.fill" to Icons.Rounded.Home,
    "pawprint.fill" to Icons.Rounded.Pets,
    "moon.stars.fill" to Icons.Rounded.Bedtime,
    "sun.max.fill" to Icons.Rounded.WbSunny,
    "globe.americas.fill" to Icons.Rounded.Public,
    "person.line.dotted.person.fill" to Icons.AutoMirrored.Rounded.CompareArrows,
    "figure.run" to Icons.Rounded.DirectionsRun,
    "figure.run.circle.fill" to Icons.Rounded.DirectionsRun,
    "hand.raised.fill" to Icons.Rounded.PanTool,
    "hand.thumbsup.fill" to Icons.Rounded.ThumbUp,
    "hand.thumbsdown.fill" to Icons.Rounded.ThumbDown,
    "paperplane.fill" to Icons.AutoMirrored.Rounded.Send,
    "arrow.down.right.circle.fill" to Icons.Rounded.ArrowCircleDown,
    "arrow.left.and.right" to AppIcon.ARROW_LEFT_ARROW_RIGHT.imageVector,
    "flag.fill" to Icons.Rounded.Flag,
    "shield.lefthalf.filled" to AppIcon.SHIELD_FILL.imageVector,
    "circle.fill" to Icons.Rounded.Circle,
    "1.circle.fill" to Icons.Rounded.LooksOne,
    "2.circle.fill" to Icons.Rounded.LooksTwo,
    "3.circle.fill" to Icons.Rounded.Looks3,
    "4.circle.fill" to Icons.Rounded.Looks4,
    // Outlier alert-card / explainer / learn-more symbols not in AppIcon.
    "percent" to Icons.Rounded.Percent,
    "basketball.fill" to Icons.Rounded.SportsBasketball,
    "baseball.fill" to Icons.Rounded.SportsBaseball,
    "dot.radiowaves.left.and.right" to Icons.Rounded.Sensors,
    "exclamationmark.circle.fill" to Icons.Rounded.ErrorOutline,
    "gauge.high" to Icons.Rounded.Speed,
)

/**
 * A single team disc: remote logo (inset), initials fallback, tinted with the
 * team's brand color the way iOS's `teamGlassDisc` does. Self-contained so it
 * doesn't wait on the shared `GameCardTeamAvatar` / `teamGlassDisc` port.
 */
@Composable
fun OutlierGlassTeamAvatar(
    logoUrl: String?,
    initials: String,
    primary: Color,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .size(size)
            .shadow(4.dp, CircleShape, clip = false)
            .clip(CircleShape)
            .border(1.dp, Color.White.copy(alpha = 0.16f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        // Team-tinted glass base (primary @ ~0.5 over the elevated surface).
        Box(
            Modifier
                .fillMaxSize()
                .clip(CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(primary.copy(alpha = 0.5f)),
            )
            RemoteImage(
                url = logoUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize().padding(size * 0.09f),
                contentScale = ContentScale.Fit,
                error = {
                    Text(
                        text = initials,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = (size.value * 0.34f).sp,
                    )
                },
            )
        }
    }
}
