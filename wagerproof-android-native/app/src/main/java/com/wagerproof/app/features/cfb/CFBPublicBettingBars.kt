package com.wagerproof.app.features.cfb

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBPrediction
import java.util.Locale

/**
 * CFB public-betting widget (doc §4.4). CFB stores splits as `*_splits_label`
 * strings (no raw percentages), so this renders labels-only pill badges.
 * Chromeless — the host section supplies the "Public Betting" header.
 */
@Composable
fun CFBPublicBettingBars(
    game: CFBPrediction,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        game.mlSplitsLabel?.let { LabelRow("Moneyline", it) }
        game.spreadSplitsLabel?.let { LabelRow("Spread", it) }
        game.totalSplitsLabel?.let { LabelRow("Total", it) }
    }
}

@Composable
private fun LabelRow(title: String, label: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.weight(1f))
        Text(
            label.uppercase(Locale.US),
            modifier = Modifier
                .background(AppColors.appAccentAmber.copy(alpha = 0.15f), CircleShape)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            color = AppColors.appAccentAmber,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}
