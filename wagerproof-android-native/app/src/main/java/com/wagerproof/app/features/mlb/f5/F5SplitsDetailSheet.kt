package com.wagerproof.app.features.mlb.f5

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.mlb.MLBFormatting
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBF5Matchup

/**
 * Full First-5 breakdown — port of iOS `F5SplitsDetailSheet`. The expand target
 * of [F5SplitsInsightWidget]: matchup header → 11-row [F5GameCard] → glossary →
 * how-to-use card. Rendered as a full screen (sheet detents are vestigial).
 */
@Composable
fun F5SplitsDetailSheet(
    matchup: MLBF5Matchup,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "${matchup.game.awayAbbr} @ ${matchup.game.homeAbbr} · First-5 Splits",
                fontSize = 18.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary,
            )
            Text(
                "${MLBFormatting.dateLabel(matchup.game.officialDate)} · ${MLBFormatting.gameTime(matchup.game.gameTimeEt)}",
                fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = AppColors.appTextSecondary,
            )
        }
        F5GameCard(game = matchup.game, awaySplit = matchup.awaySplit, homeSplit = matchup.homeSplit)
        Glossary()
        HowToUse()
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Glossary() {
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.92f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(AppIcon.fromSystemName("text.book.closed")?.imageVector ?: AppIcon.CHART_BAR_FILL.imageVector, null, tint = hexColor(0x0EA5E9L), modifier = Modifier.size(16.dp))
            Text("What these mean", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
        }
        F5MetricHelp.glossaryOrder.forEach { key ->
            F5MetricHelp.all[key]?.let { help ->
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(help.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = AppColors.appTextPrimary)
                    Text(help.body, fontSize = 12.sp, color = AppColors.appTextSecondary, lineHeight = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun HowToUse() {
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appAccentBlue.copy(alpha = 0.10f))
            .border(1.dp, AppColors.appAccentBlue.copy(alpha = 0.4f), shape)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(AppIcon.fromSystemName("info.circle.fill")?.imageVector ?: AppIcon.INFO_CIRCLE.imageVector, null, tint = AppColors.appAccentBlue, modifier = Modifier.size(16.dp))
        Text(
            "The away team is judged by its away games vs tonight's opposing starter hand, and the home team by its home games vs tonight's opposing starter hand. Small samples show real data with caution — LHP splits can be thin early in the season.",
            fontSize = 12.sp, fontWeight = FontWeight.Medium, color = AppColors.appTextPrimary,
        )
    }
}
