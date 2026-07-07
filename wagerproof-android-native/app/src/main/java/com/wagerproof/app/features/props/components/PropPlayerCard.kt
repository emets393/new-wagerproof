package com.wagerproof.app.features.props.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.props.PlayerPropFeedItem
import com.wagerproof.app.features.props.PropsFormatting
import com.wagerproof.app.features.props.teamGlassDisc
import com.wagerproof.app.features.gamecards.teamVisible
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerProps

/** A last-10 bar: cleared the line (green) or missed (red @0.7), height ∝ value. */
data class FormBar(val cleared: Boolean, val value: Double)

/**
 * MLB player-prop feed card — port of iOS `PropPlayerCard.swift`. Rounded lifted
 * surface, avatar-with-team-glow + team-logo chip, centered O/U pills, labeled
 * L10 trend strip, and a bottom BEST · L10 · HIT info row with a glass time pill.
 */
@Composable
fun PropPlayerCard(
    item: PlayerPropFeedItem,
    onSelect: (PlayerPropSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val sel = item.selection
    val computed = item.headline.computed
    val row = item.headline.row
    val primary = hexColor(item.teamPrimaryHex).teamVisible()
    val secondary = hexColor(item.teamSecondaryHex).teamVisible()
    val shape = RoundedCornerShape(26.dp)

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onSelect(sel)
            }
            .padding(start = 12.dp, end = 14.dp, top = 9.dp, bottom = 9.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Main row
        Row(verticalAlignment = Alignment.CenterVertically) {
            PropTeamAvatar(playerId = sel.playerId, teamLogoUrl = sel.teamLogoUrl, primary = primary, secondary = secondary)
            Spacer(Modifier.width(10.dp))
            Column {
                Text(
                    sel.playerName,
                    color = AppColors.appTextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                if (sel.opponentAbbr.isNotEmpty()) {
                    Text(
                        "vs ${sel.opponentAbbr}",
                        color = AppColors.appTextSecondary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                    )
                }
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                OuPill("O", MLBPlayerProps.formatLine(computed.line), MLBPlayerProps.formatOdds(computed.overOdds), AppColors.appPrimary)
                OuPill("U", MLBPlayerProps.formatLine(computed.line), MLBPlayerProps.formatOdds(computed.underOdds), AppColors.appTextSecondary)
            }
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text("L10 TREND", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(3.dp))
                RecentFormStrip(
                    strip = computed.miniStrip.map { FormBar(it.cleared, it.value) },
                    line = computed.line,
                    modifier = Modifier.size(74.dp, 46.dp),
                )
            }
        }

        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.5f)))

        // Bottom info row
        Row(verticalAlignment = Alignment.CenterVertically) {
            InfoItem(item.metricLabel, MLBPlayerProps.marketLabel(row.market), AppColors.appPrimary)
            Spacer(Modifier.width(16.dp))
            InfoItem("L10", "${computed.l10.fractionLabel} Over", AppColors.appTextPrimary)
            Spacer(Modifier.width(16.dp))
            InfoItem("HIT", computed.l10.pctLabel, hitColor(computed.l10.pct))
            Spacer(Modifier.weight(1f))
            TimePill(PropsFormatting.gameTime(sel.gameTimeEt))
        }
    }
}

private fun hitColor(pct: Int?): Color {
    if (pct == null) return AppColors.appTextMuted
    return when {
        pct >= 70 -> AppColors.appPrimary
        pct >= 55 -> Color(0xFFEAB308)
        else -> AppColors.appTextSecondary
    }
}

/** Player headshot disc with a team-color glass ring + a small team-logo chip. */
@Composable
internal fun PropTeamAvatar(
    playerId: Int,
    teamLogoUrl: String?,
    primary: Color,
    secondary: Color,
) {
    Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(44.dp).teamGlassDisc(primary, secondary), contentAlignment = Alignment.Center) {
            PlayerHeadshot(playerId = playerId, size = 40.dp)
        }
        teamLogoUrl?.let { logo ->
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(AppColors.appSurfaceElevated)
                    .padding(2.dp),
            ) {
                RemoteImage(logo, null, Modifier.size(16.dp), contentScale = ContentScale.Fit)
            }
        }
    }
}

@Composable
internal fun PropTeamAvatarNFL(
    content: @Composable () -> Unit,
    teamLogoUrl: String?,
    primary: Color,
    secondary: Color,
) {
    Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.size(44.dp).teamGlassDisc(primary, secondary), contentAlignment = Alignment.Center) {
            content()
        }
        teamLogoUrl?.let { logo ->
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(AppColors.appSurfaceElevated)
                    .padding(2.dp),
            ) {
                RemoteImage(logo, null, Modifier.size(16.dp), contentScale = ContentScale.Fit)
            }
        }
    }
}

@Composable
internal fun OuPill(prefix: String, line: String, odds: String, tint: Color) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.6f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text("$prefix $line", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Text(odds, color = tint, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

@Composable
internal fun InfoItem(label: String, value: String, valueColor: Color) {
    Column {
        Text(label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        Text(value, color = valueColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
internal fun TimePill(text: String) {
    Box(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.6f), CircleShape)
            .padding(horizontal = 7.dp, vertical = 3.dp),
    ) {
        Text(text, color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

/**
 * Compact last-10 over/under bar strip — the prop analog of the game card's
 * Polymarket sparkline. Green = cleared, red = missed, bar height ∝ actual
 * value. Hand-drawn with Compose Canvas (no external chart lib).
 */
@Composable
fun RecentFormStrip(
    strip: List<FormBar>,
    line: Double,
    modifier: Modifier = Modifier,
) {
    val maxVal = maxOf(line * 1.5, strip.maxOfOrNull { it.value } ?: 1.0, 1.0)
    Canvas(modifier) {
        val n = maxOf(strip.size, 1)
        val gap = 2.dp.toPx()
        val barW = maxOf(2f, (size.width - gap * (n - 1)) / n)
        strip.forEachIndexed { i, bar ->
            val h = maxOf(3f, (bar.value / maxVal).toFloat() * size.height)
            val x = i * (barW + gap)
            drawRoundRect(
                color = if (bar.cleared) AppColors.appPrimary else AppColors.appLoss.copy(alpha = 0.7f),
                topLeft = Offset(x, size.height - h),
                size = Size(barW, h),
                cornerRadius = CornerRadius(1.5.dp.toPx()),
            )
        }
    }
}
