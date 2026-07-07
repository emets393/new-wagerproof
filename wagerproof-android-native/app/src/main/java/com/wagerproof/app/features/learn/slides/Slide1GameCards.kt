package com.wagerproof.app.features.learn.slides

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
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
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing

/**
 * Port of iOS `Slide1_GameCards.swift`. Two hardcoded mini game cards
 * (LAL@BOS NBA + KC@BUF NFL) with model-pick pills, confidence badges, legend.
 */
@Composable
fun Slide1GameCards(modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.lg)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
            games.forEach { miniCard(it, Modifier.weight(1f)) }
        }
        calloutsCard()
    }
}

private enum class SpreadPick { AWAY, HOME }
private enum class OUPick { OVER, UNDER }

private data class MockGame(
    val sport: String,
    val awayAbbr: String,
    val homeAbbr: String,
    val awaySpread: Double,
    val homeSpread: Double,
    val overLine: Double,
    val spreadConfidence: Int,
    val ouConfidence: Int,
    val spreadPick: SpreadPick,
    val ouPick: OUPick,
    val isFadeAlert: Boolean,
)

private val games = listOf(
    MockGame("NBA", "LAL", "BOS", 4.5, -4.5, 218.5, 72, 65, SpreadPick.HOME, OUPick.OVER, false),
    MockGame("NFL", "KC", "BUF", -3.5, 3.5, 51.5, 82, 58, SpreadPick.AWAY, OUPick.UNDER, true),
)

private fun confidenceColor(value: Int): Color = when {
    value >= 80 -> Color(0xFF22C55E)
    value >= 70 -> Color(0xFF84CC16)
    value >= 60 -> Color(0xFFEAB308)
    else -> Color(0xFFF97316)
}

@Composable
private fun miniCard(game: MockGame, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appSurfaceElevated),
    ) {
        // 3pt brand-green top accent bar.
        Box(
            Modifier
                .fillMaxWidth()
                .height(3.dp)
                .background(
                    Brush.horizontalGradient(
                        listOf(AppColors.appPrimary, AppColors.appPrimaryStrong, AppColors.appPrimary),
                    ),
                ),
        )
        Column(
            Modifier.padding(10.dp).padding(top = 4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            teamRow(game)
            ouLinePill(game.overLine)
            pickHeader()
            spreadPill(game)
            ouPill(game)
        }
        // Sport badge, top-right.
        Box(Modifier.align(Alignment.TopEnd).padding(8.dp)) {
            Text(
                game.sport,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextSecondary,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(AppColors.appSurfaceMuted)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
    }
}

@Composable
private fun teamRow(game: MockGame) {
    Row(
        Modifier.padding(top = 4.dp, bottom = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        teamCol(game.awayAbbr)
        Text("@", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextMuted)
        teamCol(game.homeAbbr)
    }
}

@Composable
private fun teamCol(abbr: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Box(
            Modifier.size(28.dp).clip(CircleShape).background(AppColors.appSurfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            Text(abbr.take(1), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        }
        Text(abbr, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextPrimary)
    }
}

@Composable
private fun ouLinePill(line: Double) {
    Text(
        "O/U: ${"%.1f".format(line)}",
        fontSize = 9.sp,
        fontWeight = FontWeight.SemiBold,
        color = AppColors.appTextSecondary,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(AppColors.appTextMuted.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@Composable
private fun pickHeader() {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
            contentDescription = null,
            tint = AppColors.appWin,
            modifier = Modifier.size(9.dp),
        )
        Text("MODEL PICKS", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextSecondary)
    }
}

@Composable
private fun spreadPill(game: MockGame) {
    val abbr = if (game.spreadPick == SpreadPick.HOME) game.homeAbbr else game.awayAbbr
    val value = if (game.spreadPick == SpreadPick.HOME) game.homeSpread else game.awaySpread
    val color = confidenceColor(game.spreadConfidence)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.appSurfaceMuted)
            .padding(horizontal = 6.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(14.dp).clip(CircleShape).background(AppColors.appSurfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            Text(abbr.take(1), fontSize = 8.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        }
        Text(
            if (value > 0) "+${"%.1f".format(value)}" else "%.1f".format(value),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
            modifier = Modifier.weight(1f),
        )
        confidenceBadge(game.spreadConfidence, color)
        if (game.isFadeAlert) {
            Icon(
                imageVector = AppIcon.fromSystemName("bolt.fill")!!.imageVector,
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(9.dp),
            )
        }
    }
}

@Composable
private fun ouPill(game: MockGame) {
    val color = confidenceColor(game.ouConfidence)
    val isOver = game.ouPick == OUPick.OVER
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.appSurfaceMuted)
            .padding(horizontal = 6.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(14.dp).clip(CircleShape).background(if (isOver) AppColors.appWin else AppColors.appLoss),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName(if (isOver) "arrow.up" else "arrow.down")!!.imageVector,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(7.dp),
            )
        }
        Text(
            if (isOver) "Over" else "Under",
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
            modifier = Modifier.weight(1f),
        )
        confidenceBadge(game.ouConfidence, color)
    }
}

@Composable
private fun confidenceBadge(value: Int, color: Color) {
    Text(
        "$value%",
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.2f))
            .padding(horizontal = 4.dp, vertical = 1.dp),
    )
}

@Composable
private fun calloutsCard() {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceElevated)
            .padding(Spacing.md),
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        calloutRow(Color(0xFF22C55E), "Green = Strong pick (70%+)")
        calloutRow(Color(0xFFEAB308), "Yellow = Moderate confidence")
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName("bolt.fill")!!.imageVector,
                contentDescription = null,
                tint = AppColors.appAccentAmber,
                modifier = Modifier.size(11.dp),
            )
            Text("Fade Alert (82%+ confidence)", fontSize = 11.sp, color = AppColors.appTextSecondary)
            Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun calloutRow(color: Color, text: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Text(text, fontSize = 11.sp, color = AppColors.appTextSecondary)
        Spacer(Modifier.weight(1f))
    }
}
