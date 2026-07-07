package com.wagerproof.app.features.scoreboard.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.LiveGame
import com.wagerproof.core.models.PredictionStatus
import kotlin.math.roundToInt

/** Hitting-green / miss-red constants shared across the scoreboard surfaces. */
internal val HittingGreen = Color(0xFF22D35F)
internal val MissRed = Color(0xFFEF4444)

private fun hasPredictions(game: LiveGame): Boolean {
    val p = game.predictions ?: return false
    return p.moneyline != null || p.spread != null || p.overUnder != null
}

/**
 * Expanded full-width live-score card. iOS `Scoreboard/Components/LiveScorePredictionCard`.
 * Score header + "AI MODEL PREDICTIONS" rows (moneyline / spread / over-under) with
 * hitting badges and confidence pills.
 */
@Composable
fun LiveScorePredictionCard(game: LiveGame, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurface)
            .border(1.dp, AppColors.appBorder, shape),
    ) {
        PredictionHeader(game)
        if (hasPredictions(game)) {
            PredictionsSection(game)
        } else {
            Text(
                "No predictions available for this game",
                color = AppColors.appTextSecondary,
                fontSize = 15.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(Spacing.lg),
            )
        }
    }
}

@Composable
private fun PredictionHeader(game: LiveGame) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated)
            .padding(Spacing.lg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TeamCircleView(game.awayTeam, game.awayAbbr, game.league, size = 48.dp, fontSize = 18.sp)
        Spacer(Modifier.width(1.dp).weight(1f))
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RollingScore(game.awayScore, 28.sp)
                Text("-", color = AppColors.appTextSecondary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                RollingScore(game.homeScore, 28.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(game.quarter, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                if (game.timeRemaining.isNotEmpty()) {
                    Text(game.timeRemaining, color = AppColors.appTextSecondary, fontSize = 12.sp)
                }
            }
        }
        Spacer(Modifier.width(1.dp).weight(1f))
        TeamCircleView(game.homeTeam, game.homeAbbr, game.league, size = 48.dp, fontSize = 18.sp)
    }
    Box(Modifier.fillMaxWidth().size(1.dp).background(AppColors.appBorder))
}

@Composable
private fun PredictionsSection(game: LiveGame) {
    Column(Modifier.padding(Spacing.lg), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Text(
            "AI MODEL PREDICTIONS",
            color = AppColors.appTextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            game.predictions?.moneyline?.let {
                PredictionRow("Moneyline", it, "${it.predicted.raw} to win")
            }
            game.predictions?.spread?.let {
                PredictionRow("Spread", it, "${it.predicted.raw} ${formatLineSigned(it.line)}")
            }
            game.predictions?.overUnder?.let {
                PredictionRow("Over/Under", it, "${it.predicted.raw} ${formatLineUnsigned(it.line)}")
            }
        }
    }
}

@Composable
internal fun PredictionRow(label: String, prediction: PredictionStatus, detail: String) {
    val hit = prediction.isHitting
    val statusColor = if (hit) HittingGreen else MissRed
    val bg = statusColor.copy(alpha = 0.1f)
    val borderColor = statusColor.copy(alpha = 0.3f)
    val shape = RoundedCornerShape(8.dp)

    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(bg)
            .border(1.dp, borderColor, shape)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Icon(
            (if (hit) AppIcon.CHECKMARK_CIRCLE_FILL else AppIcon.XMARK_CIRCLE_FILL).imageVector,
            contentDescription = null,
            tint = statusColor,
            modifier = Modifier.size(16.dp),
        )
        Column(Modifier.weight(1f)) {
            Text(label, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(detail, color = AppColors.appTextSecondary, fontSize = 11.sp)
        }
        Column(horizontalAlignment = Alignment.End) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(
                    (if (hit) AppIcon.ARROW_UP_RIGHT else (AppIcon.fromSystemName("arrow.down.right") ?: AppIcon.CHEVRON_RIGHT)).imageVector,
                    contentDescription = null,
                    tint = statusColor,
                    modifier = Modifier.size(12.dp),
                )
                Text(if (hit) "Hitting" else "Not Hitting", color = statusColor, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Text("${(prediction.probability * 100).roundToInt()}% Conf.", color = AppColors.appTextSecondary, fontSize = 10.sp)
        }
    }
}

/**
 * Gradient circle showing a team's initials. Shared by the expanded prediction
 * card and the detail sheet.
 *
 * FIDELITY-WAIVER #008: real per-league team colors aren't wired here — the
 * fallback gradient uses brand-green; initials match iOS exactly.
 */
@Composable
fun TeamCircleView(
    teamName: String,
    abbr: String?,
    league: String,
    size: Dp = 56.dp,
    fontSize: androidx.compose.ui.unit.TextUnit = 20.sp,
) {
    val initials = when {
        !abbr.isNullOrEmpty() -> abbr
        else -> {
            val words = teamName.split(" ").filter { it.isNotEmpty() }
            if (words.size >= 2) words.take(2).map { it.first() }.joinToString("")
            else teamName.take(3).uppercase()
        }
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(
            Modifier
                .size(size)
                .clip(CircleShape)
                .background(
                    Brush.linearGradient(listOf(AppColors.appPrimary, AppColors.appPrimaryStrong)),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(initials, color = Color.White, fontSize = fontSize, fontWeight = FontWeight.Bold)
        }
        Text(
            teamName,
            color = AppColors.appTextSecondary,
            fontSize = if (size > 50.dp) 12.sp else 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.widthIn(max = size * 1.5f),
        )
    }
}

/** Score with a vertical numeric roll on change — Compose stand-in for `.numericText()`. */
@Composable
internal fun RollingScore(value: Int, fontSize: androidx.compose.ui.unit.TextUnit) {
    AnimatedContent(
        targetState = value,
        transitionSpec = {
            (slideInVertically(tween(260)) { it } + fadeIn(tween(260))) togetherWith
                (slideOutVertically(tween(260)) { -it } + fadeOut(tween(260)))
        },
        label = "score-roll",
    ) { v ->
        Text("$v", color = AppColors.appTextPrimary, fontSize = fontSize, fontWeight = FontWeight.Bold)
    }
}

/** "+3"/"-3"/"+3.5" signed. */
internal fun formatLineSigned(value: Double?): String {
    val v = value ?: return ""
    return if (v == v.toLong().toDouble()) {
        val i = v.toLong()
        if (i > 0) "+$i" else "$i"
    } else {
        if (v > 0) "+$v" else "$v"
    }
}

/** "230"/"230.5" unsigned. */
internal fun formatLineUnsigned(value: Double?): String {
    val v = value ?: return ""
    return if (v == v.toLong().toDouble()) "${v.toLong()}" else "$v"
}
