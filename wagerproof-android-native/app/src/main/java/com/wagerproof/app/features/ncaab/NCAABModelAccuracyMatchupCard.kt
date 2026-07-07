package com.wagerproof.app.features.ncaab

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NCAABAccuracyBucket
import com.wagerproof.core.models.NCAABModelAccuracyGame
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Data-rich accuracy card for the NCAAB Model Accuracy list screen — port of
 * iOS `NCAABModelAccuracyMatchupCardView`. Same Spread / ML / O-U layout and
 * accuracy thresholds as the NBA variant, typed for the NCAAB payload.
 *
 * FIDELITY-WAIVER #008: neutral maroon/gold stripe colors are hardcoded (no
 * per-team NCAAB brand table exists on Android).
 */
private val NeutralMaroon = hexColor(0x8B1A1A)
private val NeutralGold = hexColor(0xEAB308)

@Composable
fun NCAABModelAccuracyMatchupCardView(
    game: NCAABModelAccuracyGame,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            NeutralMaroon,
                            NeutralGold,
                            NeutralMaroon.copy(alpha = 0.85f),
                            NeutralGold.copy(alpha = 0.85f),
                        ),
                    ),
                ),
        )
        Column(
            Modifier.padding(horizontal = 12.dp).padding(top = 12.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Header(game)
            PickBlock("Spread", spreadPickText(game), spreadEdgeText(game), game.spreadAccuracy)
            PickBlock("ML Win Prob", mlPickText(game), null, game.mlAccuracy)
            PickBlock("Over/Under", ouPickText(game), ouEdgeText(game), game.ouAccuracy)
        }
    }
}

@Composable
private fun Header(game: NCAABModelAccuracyGame) {
    Row(
        Modifier.fillMaxWidth().padding(bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            GameCardTeamAvatar(sport = "ncaab", team = game.awayTeam, diameter = 32.dp)
            Text(game.awayAbbr, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text("@", color = AppColors.appTextSecondary.copy(alpha = 0.6f), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 4.dp))
            GameCardTeamAvatar(sport = "ncaab", team = game.homeTeam, diameter = 32.dp)
            Text(game.homeAbbr, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.weight(1f))
        Text(formatTipoff(game.tipoffTime, game.gameDate), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun PickBlock(label: String, pickValue: String, edgeValue: String?, accuracy: NCAABAccuracyBucket?) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.5f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.weight(1f))
            Text(pickValue, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            if (edgeValue != null) {
                Text(" (edge $edgeValue)", color = AppColors.appTextSecondary, fontSize = 11.sp)
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Accuracy", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.weight(1f))
            if (accuracy != null) {
                Text(
                    String.format("%.1f%%", accuracy.accuracyPct),
                    color = accuracyColor(accuracy.accuracyPct),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(" (n=${accuracy.games})", color = AppColors.appTextSecondary, fontSize = 11.sp)
            } else {
                Text("—", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

private fun spreadPickText(game: NCAABModelAccuracyGame): String {
    val homeSpread = game.homeSpread ?: return "—"
    val homePredictedToCover = (game.homeSpreadDiff ?: 0.0) > 0
    val abbr = if (homePredictedToCover) game.homeAbbr else game.awayAbbr
    val line = if (homePredictedToCover) homeSpread else -homeSpread
    return "$abbr ${GameCardFormatting.formatSpread(line)}"
}

private fun spreadEdgeText(game: NCAABModelAccuracyGame): String? {
    val diff = game.homeSpreadDiff ?: return null
    return "+${half(abs(diff))}"
}

private fun mlPickText(game: NCAABModelAccuracyGame): String {
    val prob = game.mlPickProbRounded ?: return "—"
    val abbr = if (game.mlPickIsHome == true) game.homeAbbr else game.awayAbbr
    return "$abbr ${(prob * 100).roundToInt()}%"
}

private fun ouPickText(game: NCAABModelAccuracyGame): String {
    val diff = game.overLineDiff ?: return "—"
    val line = game.overLine ?: return "—"
    val direction = if (diff > 0) "Over" else "Under"
    return "$direction ${GameCardFormatting.formatSpread(line).removePrefix("+")}"
}

private fun ouEdgeText(game: NCAABModelAccuracyGame): String? {
    val diff = game.overLineDiff ?: return null
    return "+${half(abs(diff))}"
}

private fun accuracyColor(pct: Double): Color = when {
    pct >= 60 -> hexColor(0x00C853)
    pct >= 50 -> hexColor(0xFFD600)
    else -> hexColor(0xFF5252)
}

private fun formatTipoff(time: String?, date: String): String =
    if (!time.isNullOrEmpty()) GameCardFormatting.convertTimeToEST(time)
    else GameCardFormatting.formatCompactDate(date)

private fun half(d: Double): String {
    val r = GameCardFormatting.roundToNearestHalf(d) ?: d
    return if (r % 1.0 == 0.0) r.toInt().toString() else r.toString()
}
