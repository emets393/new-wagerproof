package com.wagerproof.app.features.mlb

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBGame
import com.wagerproof.core.models.MLBSuggestedPick
import java.util.Locale

/**
 * Regression-report pick cards inside the MLB detail sheet — port of iOS
 * `MLBRegressionPicksSection`. The host `WidgetCollapsingSection` supplies the
 * title/chrome; this renders the pre-filtered per-game picks.
 *
 * Each suggestion is compared with the same full-game/F5 model state used by
 * the surrounding detail page, matching the RN alignment contract.
 */
@Composable
fun MLBRegressionPicksSection(
    game: MLBGame,
    picks: List<MLBSuggestedPick>,
    modifier: Modifier = Modifier,
) {
    if (picks.isEmpty()) return
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        picks.forEach { pickCard(game, it) }
    }
}

@Composable
private fun pickCard(game: MLBGame, pick: MLBSuggestedPick) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
            .border(1.dp, AppColors.appBorder, shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            betTypeLabel(pick.betType).uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = AppColors.appTextSecondary,
        )
        Text(pick.pick, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary, maxLines = 2)
        AlignmentPill(computeAlignment(game, pick))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            statCell("Edge", edgeText(pick), Modifier.weight(1f))
            statCell("Bucket", bucketText(pick.edgeBucket), Modifier.weight(1f))
            statCell("Bucket W%", String.format(Locale.US, "%.0f%%", pick.bucketWinPct), Modifier.weight(1f), winPctColor(pick.bucketWinPct))
        }
        pick.reasoning?.takeIf { it.isNotEmpty() }?.let {
            Text(it, fontSize = 12.sp, fontStyle = FontStyle.Italic, color = AppColors.appTextSecondary, lineHeight = 17.sp)
        }
    }
}

private enum class ModelAlignment { ALIGNS, CONTRADICTS, UNKNOWN }
private enum class ModelSide { HOME, AWAY }

@Composable
private fun AlignmentPill(alignment: ModelAlignment) {
    val tint = when (alignment) {
        ModelAlignment.ALIGNS -> hexColor(0x22C55EL)
        ModelAlignment.CONTRADICTS -> AppColors.appAccentRed
        ModelAlignment.UNKNOWN -> AppColors.appTextSecondary
    }
    val icon = when (alignment) {
        ModelAlignment.ALIGNS -> AppIcon.CHECKMARK_CIRCLE_FILL
        ModelAlignment.CONTRADICTS -> AppIcon.XMARK_CIRCLE_FILL
        ModelAlignment.UNKNOWN -> AppIcon.INFO_CIRCLE
    }
    val label = when (alignment) {
        ModelAlignment.ALIGNS -> "Aligns with model"
        ModelAlignment.CONTRADICTS -> "Contradicts model"
        ModelAlignment.UNKNOWN -> "Comparison unavailable"
    }
    Row(
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(tint.copy(alpha = 0.12f))
            .border(1.dp, tint.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon.imageVector, null, tint = tint, modifier = Modifier.padding(1.dp))
        Text(label, color = tint, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.2.sp)
    }
}

private fun computeAlignment(game: MLBGame, pick: MLBSuggestedPick): ModelAlignment = when (pick.betType) {
    "full_ml", "f5_ml" -> {
        val pickedSide = findPickedSide(game, pick.pick)
        val modelSide = modelMlSide(game, f5 = pick.betType == "f5_ml")
        when {
            pickedSide == null || modelSide == null -> ModelAlignment.UNKNOWN
            pickedSide == modelSide -> ModelAlignment.ALIGNS
            else -> ModelAlignment.CONTRADICTS
        }
    }
    "full_ou", "f5_ou" -> {
        val text = pick.pick.lowercase(Locale.US)
        val pickedDirection = when {
            text.contains("over") -> "OVER"
            text.contains("under") -> "UNDER"
            else -> null
        }
        val modelDirection = if (pick.betType == "full_ou") {
            game.ouDirection?.uppercase(Locale.US)
        } else {
            game.f5OuEdge?.let { if (it >= 0) "OVER" else "UNDER" }
        }
        when {
            pickedDirection == null || modelDirection == null -> ModelAlignment.UNKNOWN
            pickedDirection == modelDirection -> ModelAlignment.ALIGNS
            else -> ModelAlignment.CONTRADICTS
        }
    }
    else -> ModelAlignment.UNKNOWN
}

private fun modelMlSide(game: MLBGame, f5: Boolean): ModelSide? {
    val homeEdge = if (f5) game.f5HomeMlEdgePct else game.homeMlEdgePct
    val awayEdge = if (f5) game.f5AwayMlEdgePct else game.awayMlEdgePct
    if (homeEdge != null && awayEdge != null) return if (homeEdge >= awayEdge) ModelSide.HOME else ModelSide.AWAY
    val homeProb = if (f5) game.f5HomeWinProb else game.mlHomeWinProb
    val awayProb = if (f5) game.f5AwayWinProb else game.mlAwayWinProb
    if (homeProb != null && awayProb != null) return if (homeProb >= awayProb) ModelSide.HOME else ModelSide.AWAY
    return null
}

private fun findPickedSide(game: MLBGame, pickText: String): ModelSide? {
    val haystack = pickText.lowercase(Locale.US)
    val candidates = buildList {
        listOf(game.homeTeamName, game.homeTeam, game.homeTeamFullName, game.homeAbbr).forEach { needle ->
            needle?.trim()?.takeIf { it.isNotEmpty() }?.let { add(ModelSide.HOME to it.lowercase(Locale.US)) }
        }
        listOf(game.awayTeamName, game.awayTeam, game.awayTeamFullName, game.awayAbbr).forEach { needle ->
            needle?.trim()?.takeIf { it.isNotEmpty() }?.let { add(ModelSide.AWAY to it.lowercase(Locale.US)) }
        }
    }.sortedByDescending { it.second.length }
    return candidates.firstOrNull { (_, needle) -> haystack.contains(needle) }?.first
}

@Composable
private fun statCell(label: String, value: String, modifier: Modifier = Modifier, color: Color = AppColors.appTextPrimary) {
    Column(modifier.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextSecondary)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color, textAlign = TextAlign.Center)
    }
}

private fun betTypeLabel(bt: String): String = when (bt) {
    "full_ml" -> "Full Game · Moneyline"
    "full_ou" -> "Full Game · Total"
    "f5_ml" -> "1st 5 · Moneyline"
    "f5_ou" -> "1st 5 · Total"
    else -> bt
}

private fun edgeText(pick: MLBSuggestedPick): String {
    val sign = if (pick.edgeAtSuggestion > 0) "+" else ""
    val suffix = if (pick.betType.contains("ml")) "%" else ""
    return "$sign${String.format(Locale.US, "%g", pick.edgeAtSuggestion)}$suffix"
}

private fun bucketText(bucket: String): String = if (bucket == "perfect_storm") "Perfect\nStorm" else bucket

/** Mirrors RN `winColor(pct)`. */
private fun winPctColor(pct: Double): Color = when {
    pct >= 65 -> AppColors.appPrimary
    pct >= 55 -> hexColor(0xEAB308L)
    pct >= 50 -> hexColor(0xF97316L)
    else -> AppColors.appAccentRed
}
