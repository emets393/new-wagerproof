package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBAbbrLogo
import com.wagerproof.core.models.MLBModelBreakdownRow
import com.wagerproof.core.stores.MLBModelBreakdownStore

/**
 * Day-of-Week & Team Breakdown: segmented bet-type tabs over two ranked tables
 * — by day (Mon..Sun) and by team (sorted by ROI, with logos). Port of iOS
 * `RegressionModelBreakdownSection` reading `mlb_model_breakdown_accuracy`.
 */
@Composable
fun RegressionModelBreakdownSection(
    store: MLBModelBreakdownStore,
    modifier: Modifier = Modifier,
) {
    var tab by remember { mutableStateOf("full_ml") }

    Column(modifier.fillMaxWidth()) {
        when {
            store.loading && store.rows.isEmpty() -> Skeleton()
            store.rows.isNotEmpty() -> {
                val dowRows = store.dowRows(tab)
                val teamRows = store.teamRows(tab)
                Column(Modifier.fillMaxWidth()) {
                    RegressionSegmentedTabs(Regression.betTypes, tab, { tab = it })
                    if (dowRows.isNotEmpty()) {
                        Table("BY DAY OF WEEK", "DAY", dowRows, showLogo = false)
                    }
                    if (teamRows.isNotEmpty()) {
                        Table("BY TEAM (SORTED BY ROI)", "TEAM", teamRows, showLogo = true)
                    }
                    if (dowRows.isEmpty() && teamRows.isEmpty()) {
                        Text(
                            text = "No graded picks yet for this bet type.",
                            fontSize = 12.sp,
                            fontStyle = FontStyle.Italic,
                            color = AppColors.appTextSecondary,
                            modifier = Modifier.padding(top = 12.dp),
                        )
                    }
                }
            }
            // RN returns nothing when the table has no rows at all.
        }
    }
}

@Composable
private fun Table(
    title: String,
    valueLabel: String,
    rows: List<MLBModelBreakdownRow>,
    showLogo: Boolean,
) {
    Column(Modifier.fillMaxWidth().padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = title,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            color = AppColors.appTextSecondary,
            modifier = Modifier.padding(bottom = 2.dp),
        )
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp)) {
            HeaderCell(valueLabel, Modifier.weight(1f), TextAlign.Start)
            HeaderCell("RECORD", Modifier.width(66.dp), TextAlign.End)
            HeaderCell("W%", Modifier.width(58.dp), TextAlign.End)
            HeaderCell("ROI", Modifier.width(68.dp), TextAlign.End)
        }
        rows.forEach { r -> BreakdownRow(r, showLogo) }
    }
}

@Composable
private fun BreakdownRow(r: MLBModelBreakdownRow, showLogo: Boolean) {
    val record = "${r.wins}-${r.losses}" + if (r.pushes > 0) "-${r.pushes}" else ""
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.3f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (showLogo) {
                val url = MLBAbbrLogo.url(r.breakdownValue)
                if (url != null) {
                    RemoteImage(
                        url = url,
                        contentDescription = r.breakdownValue,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
            Text(
                text = r.breakdownValue,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.appTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = record,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.End,
            color = AppColors.appTextSecondary,
            modifier = Modifier.width(66.dp),
        )
        Text(
            text = Regression.trimmed(r.winPct) + "%",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.End,
            color = Regression.winPctColor(r.winPct),
            modifier = Modifier.width(58.dp),
        )
        Text(
            text = Regression.signedTrimmedPct(r.roiPct),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.End,
            color = Regression.roiColor(r.roiPct),
            modifier = Modifier.width(68.dp),
        )
    }
}

@Composable
private fun HeaderCell(text: String, modifier: Modifier, align: TextAlign) {
    Text(
        text = text,
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.5.sp,
        color = AppColors.appTextSecondary,
        textAlign = align,
        modifier = modifier,
    )
}

@Composable
private fun Skeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SkeletonBlock(height = 34.dp, cornerRadius = 10.dp, modifier = Modifier.shimmering())
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(5) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(AppColors.appSurfaceMuted.copy(alpha = 0.3f))
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                        .shimmering(),
                ) {
                    SkeletonBlock(width = 90.dp, height = 12.dp, modifier = Modifier.weight(1f))
                    Box(Modifier.width(6.dp))
                    SkeletonBlock(width = 44.dp, height = 12.dp)
                }
            }
        }
    }
}
