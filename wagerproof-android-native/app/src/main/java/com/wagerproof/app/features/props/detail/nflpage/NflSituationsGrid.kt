package com.wagerproof.app.features.props.detail.nflpage

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPropSituationRecord
import com.wagerproof.core.models.NFLPropTrendsDetail
import kotlin.math.roundToInt

private val Amber = Color(0xFFF59E0B)

/**
 * Situations widget body — the native `SituationsDrawer`: the market's recent
 * record by game setting (home/away/division/primetime…), one preferred window
 * per bucket ("5" ?? "7" ?? "3"), heat-tinted. Mirrors iOS
 * `NFLSituationsGrid.swift`.
 */
@Composable
fun NflSituationsGrid(
    /** bucket → window → record, from `trends.splits[marketKey]`. */
    buckets: Map<String, Map<String, NFLPropSituationRecord>>,
    marketKey: String,
) {
    val bucketOrder = listOf("overall", "home", "away", "division", "non_division", "primetime", "regular")
    val bucketLabels = mapOf(
        "overall" to "overall", "home" to "home", "away" to "away",
        "division" to "division", "non_division" to "non-division",
        "primetime" to "primetime", "regular" to "regular",
    )
    val bucketIcons = mapOf(
        "overall" to "chart.line.uptrend.xyaxis", "home" to "house.fill", "away" to "airplane",
        "division" to "person.2.fill", "non_division" to "globe",
        "primetime" to "moon.stars.fill", "regular" to "circle",
    )

    val rows = bucketOrder.mapNotNull { bucket ->
        val windows = buckets[bucket] ?: return@mapNotNull null
        val record = NFLPropTrendsDetail.preferredWindow(windows) ?: return@mapNotNull null
        Triple(bucket, bucketLabels[bucket] ?: bucket, record)
    }

    if (rows.isEmpty()) {
        Text(
            "No situational records yet",
            color = AppColors.appTextMuted,
            fontSize = 13.sp,
            fontStyle = FontStyle.Italic,
            modifier = Modifier.fillMaxWidth(),
        )
        return
    }

    val action = if (marketKey == "player_anytime_td") "Scored" else "Cleared the line"
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.chunked(2).forEach { rowPair ->
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
                rowPair.forEach { (bucket, label, record) ->
                    SituationCell(
                        icon = bucketIcons[bucket] ?: "circle",
                        text = "$action in ${record.h} of ${record.n} $label ${if (record.n == 1) "game" else "games"}",
                        pct = record.pct,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (rowPair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SituationCell(icon: String, text: String, pct: Double, modifier: Modifier) {
    // Web heat scale: > 0.75 emerald, ≥ 0.6 amber, else muted.
    val heat = when {
        pct > 0.75 -> AppColors.appWin
        pct >= 0.6 -> Amber
        else -> null
    }
    Row(modifier, verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(
            AppIcon.fromSystemName(icon)?.imageVector ?: AppIcon.CHART_BAR_FILL.imageVector,
            null,
            tint = heat ?: AppColors.appTextMuted,
            modifier = Modifier.size(14.dp),
        )
        Text(
            text,
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            lineHeight = 14.sp,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(2.dp))
        Text(
            "${(pct * 100).roundToInt()}%",
            color = heat ?: AppColors.appTextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
        )
    }
}
