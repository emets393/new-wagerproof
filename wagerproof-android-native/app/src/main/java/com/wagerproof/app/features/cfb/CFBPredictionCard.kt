package com.wagerproof.app.features.cfb

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBPrediction
import java.util.Locale
import kotlin.math.abs

/**
 * Legacy "Model Projection" summary card (doc §4.2) — predicted scores plus
 * spread/total edge rows. Standalone; renders against any [CFBPrediction].
 */
@Composable
fun CFBPredictionCard(
    game: CFBPrediction,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppIcon.fromSystemName("brain.head.profile")?.let {
                Icon(it.imageVector, contentDescription = null, tint = AppColors.appPrimary)
            }
            Text(
                "Model Projection",
                color = AppColors.appTextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }

        val away = game.predAwayScore
        val home = game.predHomeScore
        if (away != null && home != null) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(AppColors.appSurfaceMuted, RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ScoreColumn(game.awayTeam, away, Modifier.weight(1f))
                Text("-", color = AppColors.appTextMuted, fontSize = 24.sp, fontWeight = FontWeight.Light)
                ScoreColumn(game.homeTeam, home, Modifier.weight(1f))
            }
        }

        game.homeSpreadDiff?.let { EdgeRow("Spread Edge", it) }
        game.overLineDiff?.let { EdgeRow("Total Edge", it) }
    }
}

@Composable
private fun ScoreColumn(label: String, value: Double, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            label,
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )
        Text(
            String.format(Locale.US, "%.1f", value),
            color = AppColors.appTextPrimary,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun EdgeRow(label: String, value: Double) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Text(
            if (value >= 0) "+${String.format(Locale.US, "%.1f", value)}" else String.format(Locale.US, "%.1f", value),
            modifier = Modifier.weight(1f),
            color = edgeColor(abs(value)),
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.End,
        )
    }
}

/** 4-tier edge palette — matches iOS `CFBPredictionCard.edgeColor`. */
private fun edgeColor(edge: Double): Color = when {
    edge >= 5 -> Color(0.13f, 0.77f, 0.37f)
    edge >= 3 -> Color(0.52f, 0.80f, 0.09f)
    edge >= 2 -> Color(0.92f, 0.70f, 0.03f)
    else -> Color(0.98f, 0.45f, 0.09f)
}
