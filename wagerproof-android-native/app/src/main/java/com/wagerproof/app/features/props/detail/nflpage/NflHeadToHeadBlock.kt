package com.wagerproof.app.features.props.detail.nflpage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPropHitRate
import com.wagerproof.core.models.NFLPropTrendMatchup
import com.wagerproof.core.models.NFLPropVerdicts
import kotlin.math.roundToInt

/**
 * Head-to-Head widget body — the native `VsTeamCluster`: career record for
 * this market against this week's opponent. Gated exactly like the web
 * (2+ meetings, 2+ graded lines) with matching empty-state copy.
 * Mirrors iOS `NFLHeadToHeadBlock.swift`.
 */
@Composable
fun NflHeadToHeadBlock(
    matchup: NFLPropTrendMatchup?,
    marketKey: String,
    marketLabel: String,
    opponent: String,
) {
    if (matchup == null || matchup.meetings < 2) {
        EmptyState(
            title = "No H2H sample yet",
            body = "Needs 2+ career meetings vs $opponent.",
        )
        return
    }
    val record = matchup.byMarket[marketKey]
    if (record == null || record.n < 2) {
        EmptyState(
            title = "No ${marketLabel.lowercase()} sample",
            body = "Not enough graded lines vs $opponent.",
        )
        return
    }
    RecordView(record, matchup.meetings, marketKey, opponent)
}

@Composable
private fun RecordView(record: NFLPropHitRate, meetings: Int, marketKey: String, opponent: String) {
    val verb = if (NFLPropVerdicts.isTdVerbMarket(marketKey)) "scored" else "over"
    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                "${record.h}",
                color = AppColors.appTextPrimary, fontSize = 30.sp,
                fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
            )
            Text(
                "/${record.n}",
                color = AppColors.appTextMuted, fontSize = 30.sp,
                fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
            )
        }
        Text(
            "$verb vs $opponent${record.pct?.let { " · ${(it * 100).roundToInt()}%" } ?: ""}",
            color = AppColors.appTextSecondary, fontSize = 13.sp,
        )
        Spacer(Modifier.height(4.dp))
        Text("$meetings career meetings", color = AppColors.appTextMuted, fontSize = 11.sp)
    }
}

@Composable
private fun EmptyState(title: String, body: String) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.3f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Text(body, color = AppColors.appTextSecondary, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}
