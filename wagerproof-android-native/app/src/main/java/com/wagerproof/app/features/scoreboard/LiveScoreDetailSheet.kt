package com.wagerproof.app.features.scoreboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.scoreboard.components.PredictionRow
import com.wagerproof.app.features.scoreboard.components.RollingScore
import com.wagerproof.app.features.scoreboard.components.TeamCircleView
import com.wagerproof.app.features.scoreboard.components.formatLineSigned
import com.wagerproof.app.features.scoreboard.components.formatLineUnsigned
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.LiveGame

/**
 * Tap-to-detail sheet from the compact scoreboard grid. iOS
 * `Scoreboard/Sheets/LiveScoreDetailModal`. Score header + predictions + a
 * "View Full Scoreboard" footer that flips the parent to expanded mode.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveScoreDetailSheet(
    game: LiveGame,
    onViewFullScoreboard: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    val p = game.predictions
    val hasPredictions = p != null && (p.moneyline != null || p.spread != null || p.overUnder != null)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
    ) {
        Column(Modifier.fillMaxWidth()) {
            // Top bar: league badge + close.
            Row(
                Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    game.league,
                    color = AppColors.appPrimary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(AppColors.appPrimarySubtle.copy(alpha = 0.3f))
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                )
                Box(Modifier.weight(1f))
                Text("Live Game", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                Box(Modifier.weight(1f))
                Icon(
                    AppIcon.XMARK.imageVector,
                    contentDescription = "Close",
                    tint = AppColors.appTextPrimary,
                    modifier = Modifier.size(20.dp).clickable { onDismiss() },
                )
            }

            Column(Modifier.verticalScroll(rememberScrollState())) {
                ScoreHeader(game)
                if (hasPredictions) {
                    Column(
                        Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.lg),
                        verticalArrangement = Arrangement.spacedBy(Spacing.md),
                    ) {
                        Text(
                            "AI MODEL PREDICTIONS",
                            color = AppColors.appTextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp,
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            p?.moneyline?.let { PredictionRow("Moneyline", it, "${it.predicted.raw} to win") }
                            p?.spread?.let { PredictionRow("Spread", it, "${it.predicted.raw} ${formatLineSigned(it.line)}") }
                            p?.overUnder?.let { PredictionRow("Over/Under", it, "${it.predicted.raw} ${formatLineUnsigned(it.line)}") }
                        }
                    }
                } else {
                    Column(
                        Modifier.fillMaxWidth().padding(Spacing.xxl),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(Spacing.md),
                    ) {
                        Icon(
                            (AppIcon.fromSystemName("chart.line.uptrend.xyaxis") ?: AppIcon.SPORTSCOURT_FILL).imageVector,
                            contentDescription = null,
                            tint = AppColors.appTextSecondary,
                            modifier = Modifier.size(40.dp),
                        )
                        Text(
                            "No predictions available for this game",
                            color = AppColors.appTextSecondary,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }

            // Footer CTA.
            Box(Modifier.fillMaxWidth().size(1.dp).background(AppColors.appBorder))
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.lg, vertical = Spacing.md),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(AppColors.appPrimary)
                        .clickable {
                            onViewFullScoreboard()
                            onDismiss()
                        }
                        .padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(AppIcon.SPORTSCOURT_FILL.imageVector, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(Spacing.sm))
                    Text("View Full Scoreboard", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun ScoreHeader(game: LiveGame) {
    Row(
        Modifier.fillMaxWidth().background(AppColors.appSurfaceElevated).padding(Spacing.xl),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TeamCircleView(game.awayTeam, game.awayAbbr, game.league, size = 56.dp, fontSize = 20.sp)
        Box(Modifier.weight(1f))
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RollingScore(game.awayScore, 36.sp)
                Text("-", color = AppColors.appTextSecondary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                RollingScore(game.homeScore, 36.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    game.quarter.ifEmpty { game.period ?: "" },
                    color = AppColors.appTextSecondary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                if (game.timeRemaining.isNotEmpty()) {
                    Text(game.timeRemaining, color = AppColors.appTextSecondary, fontSize = 14.sp)
                }
            }
        }
        Box(Modifier.weight(1f))
        TeamCircleView(game.homeTeam, game.homeAbbr, game.league, size = 56.dp, fontSize = 20.sp)
    }
}
