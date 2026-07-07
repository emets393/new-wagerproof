package com.wagerproof.app.features.gamecards

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/** One public-splits row: bets bar + handle bar. */
data class SplitRow(
    val title: String,
    val splitsLabel: String?,
    val leftBetsPct: Double?,
    val leftHandlePct: Double?,
    val rightBetsPct: Double?,
    val rightHandlePct: Double?,
)

/**
 * Legacy stacked public-splits bars — port of iOS `BettingSplitsCard.swift`.
 * Rows hidden when all four values are null. Percent parse: "0.61"→0.61,
 * >1 → /100, clamp 0…1.
 */
@Composable
fun BettingSplitsCard(rows: List<SplitRow>, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(AppIcon.PERSON_3_FILL.imageVector, null, tint = AppColors.appAccentPurple, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Public Betting", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
        rows.filter { listOfNotNull(it.leftBetsPct, it.leftHandlePct, it.rightBetsPct, it.rightHandlePct).isNotEmpty() }
            .forEach { SplitRowView(it) }
    }
}

@Composable
private fun SplitRowView(row: SplitRow) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(row.title, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            row.splitsLabel?.let {
                Spacer(Modifier.width(8.dp))
                Box(Modifier.clip(CircleShape).background(AppColors.appAccentAmber.copy(alpha = 0.15f)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                    Text(it, color = AppColors.appAccentAmber, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        SplitBar("Bets", clamp(row.leftBetsPct), clamp(row.rightBetsPct), 1f)
        SplitBar("Money", clamp(row.leftHandlePct), clamp(row.rightHandlePct), 0.6f)
    }
}

@Composable
private fun SplitBar(label: String, left: Float?, right: Float?, alpha: Float) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = AppColors.appTextMuted, fontSize = 9.sp, modifier = Modifier.width(40.dp))
        left?.let { Text("${(it * 100).toInt()}%", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
        Spacer(Modifier.width(6.dp))
        Row(Modifier.weight(1f).height(10.dp).clip(CircleShape)) {
            val l = left ?: 0.5f
            Box(Modifier.weight(l.coerceIn(0.01f, 0.99f)).fillMaxWidth().height(10.dp).background(AppColors.appAccentBlue.copy(alpha = alpha)))
            Box(Modifier.weight((1f - l).coerceIn(0.01f, 0.99f)).fillMaxWidth().height(10.dp).background(AppColors.appPrimary.copy(alpha = alpha)))
        }
        Spacer(Modifier.width(6.dp))
        right?.let { Text("${(it * 100).toInt()}%", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
    }
}

private fun clamp(v: Double?): Float? {
    if (v == null) return null
    val normalized = if (v > 1.0) v / 100.0 else v
    return normalized.coerceIn(0.0, 1.0).toFloat()
}
