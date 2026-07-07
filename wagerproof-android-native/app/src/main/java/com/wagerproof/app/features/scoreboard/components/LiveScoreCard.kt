package com.wagerproof.app.features.scoreboard.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.LiveGame
import com.wagerproof.core.models.PredictionStatus

/**
 * Compact live-score tile in the scoreboard's 2-column grid. iOS
 * `Scoreboard/Components/LiveScoreCard`.
 *
 * Visual rules: green pulsing glow + green border when a prediction is hitting;
 * red-tinted border when predictions exist but none hit; default border
 * otherwise. Scores roll on poll updates.
 */
@Composable
fun LiveScoreCard(game: LiveGame, onPress: () -> Unit, modifier: Modifier = Modifier) {
    val haptics = LocalHapticFeedback.current
    val predictions = game.predictions
    val hasPredictions = predictions != null &&
        (predictions.moneyline != null || predictions.spread != null || predictions.overUnder != null)
    val hasHitting = predictions?.hasAnyHitting == true

    val borderColor = when {
        hasPredictions && hasHitting -> HittingGreen
        hasPredictions -> MissRed.copy(alpha = 0.5f)
        else -> AppColors.appBorder
    }
    val borderWidth = if (hasPredictions && hasHitting) 1.5.dp else 1.dp

    // Repeating pulse for hitting cards (green glow, 1.5s autoreverse).
    val pulse by animateFloatAsState(
        targetValue = if (hasPredictions && hasHitting) 1f else 0f,
        animationSpec = infiniteRepeatable(tween(1500), RepeatMode.Reverse),
        label = "live-pulse",
    )
    val glowColor = if (hasPredictions && hasHitting) HittingGreen.copy(alpha = 0.4f + 0.5f * pulse) else Color.Transparent
    val glowRadius = (6f + 8f * pulse).dp

    val shape = RoundedCornerShape(8.dp)
    Column(
        modifier
            .shadow(glowRadius, shape, ambientColor = glowColor, spotColor = glowColor)
            .clip(shape)
            .background(AppColors.appSurface)
            .border(borderWidth, borderColor, shape)
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                onPress()
            }
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        MainRow(game, hasPredictions, hasHitting)
        if (hasPredictions) PredictionsLine(game)
    }
}

@Composable
private fun MainRow(game: LiveGame, hasPredictions: Boolean, hasHitting: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (hasPredictions) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(if (hasHitting) HittingGreen else MissRed))
        }
        Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(game.awayAbbr, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            RollingScore(game.awayScore, 14.sp)
            Text("-", color = AppColors.appTextSecondary, fontSize = 10.sp)
            RollingScore(game.homeScore, 14.sp)
            Text(game.homeAbbr, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        if (!hasPredictions && game.isLive && !(game.period ?: "").isNullOrEmpty()) {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(game.period ?: game.quarter, color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
                if (game.timeRemaining.isNotEmpty()) {
                    Text(game.timeRemaining, color = AppColors.appTextSecondary, fontSize = 8.sp)
                }
            }
        }
    }
}

@Composable
private fun PredictionsLine(game: LiveGame) {
    val spread = spreadDisplay(game)
    val ou = ouDisplay(game)
    if (spread == null && ou == null) return
    Row(
        Modifier.padding(top = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Box(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            spread?.let { Text(it.first, color = it.second, fontSize = 10.sp, fontWeight = FontWeight.SemiBold) }
            if (spread != null && ou != null) {
                Text("•", color = AppColors.appTextSecondary, fontSize = 8.sp)
            }
            ou?.let { Text(it.first, color = it.second, fontSize = 10.sp, fontWeight = FontWeight.SemiBold) }
        }
        Box(Modifier.weight(1f))
    }
}

/** "BOS -9.5" style; line sign flips when the model picks Away. */
private fun spreadDisplay(game: LiveGame): Pair<String, Color>? {
    val spread = game.predictions?.spread ?: return null
    val pickedTeam = if (spread.predicted == PredictionStatus.Pick.HOME) game.homeAbbr else game.awayAbbr
    var line = spread.line ?: 0.0
    if (spread.predicted == PredictionStatus.Pick.AWAY && spread.line != null) line = -(spread.line ?: 0.0)
    val lineStr = if (spread.line == null) "" else if (line > 0) "+${formatLinePlain(line)}" else formatLinePlain(line)
    val text = "$pickedTeam $lineStr".trim()
    return text to if (spread.isHitting) HittingGreen else MissRed
}

/** "O 230.5" / "U 230.5". */
private fun ouDisplay(game: LiveGame): Pair<String, Color>? {
    val ou = game.predictions?.overUnder ?: return null
    val prefix = if (ou.predicted == PredictionStatus.Pick.OVER) "O" else "U"
    val text = "$prefix ${formatLinePlain(ou.line ?: 0.0)}"
    return text to if (ou.isHitting) HittingGreen else MissRed
}

private fun formatLinePlain(value: Double): String =
    if (value == value.toLong().toDouble()) "${value.toLong()}" else "$value"
