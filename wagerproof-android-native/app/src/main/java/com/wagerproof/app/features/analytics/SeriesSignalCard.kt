package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBSeriesSignal

/**
 * One series-position signal (G2/G3 carryover). ★ BACK for positive, ⚠ FADE
 * for negative — message sits in a tinted, accent-edged box. Port of iOS
 * `SeriesSignalCard`.
 */
@Composable
fun SeriesSignalCard(signal: MLBSeriesSignal, modifier: Modifier = Modifier) {
    val accent = if (signal.isPositive) Regression.winGreen else Regression.lossRed
    RegressionAccentRow(color = accent, modifier = modifier) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = signal.matchup,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.appTextPrimary,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
                RegressionPill(if (signal.isPositive) "★ BACK" else "⚠ FADE", accent)
            }
            Text(
                text = signal.message,
                fontSize = 13.sp,
                lineHeight = 16.sp,
                color = AppColors.appTextPrimary,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(accent.copy(alpha = 0.08f))
                    .border(1.dp, accent.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                    .padding(10.dp),
            )
        }
    }
}
