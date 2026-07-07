package com.wagerproof.app.features.analytics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBBucketAccuracy
import com.wagerproof.core.models.MLBBucketBucket
import com.wagerproof.core.models.MLBBucketTally
import java.util.Locale

/**
 * Model Accuracy: 2x2 overall-tally grid per bet type, then a segmented
 * bet-type selector driving the bucket drill-down table (>= 3 graded games,
 * ranked by win%). Port of iOS `RegressionAccuracySection` / RN `AccuracyBody`.
 */
@Composable
fun RegressionAccuracySection(
    accuracy: MLBBucketAccuracy?,
    loading: Boolean,
    modifier: Modifier = Modifier,
) {
    var tab by remember { mutableStateOf("full_ml") }

    Column(modifier.fillMaxWidth()) {
        when {
            loading && accuracy == null -> Skeleton()
            accuracy != null -> {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    // 2x2 tile grid.
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Regression.betTypes.chunked(2).forEach { rowPair ->
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                rowPair.forEach { (key, label) ->
                                    Tile(
                                        label = label,
                                        tally = accuracy.betType(key).overall,
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                            }
                        }
                    }

                    RegressionSegmentedTabs(Regression.betTypes, tab, { tab = it })

                    val buckets = accuracy.betType(tab).byBucket
                        .filter { it.games >= 3 }
                        .sortedByDescending { it.winPct }

                    if (buckets.isEmpty()) {
                        Text(
                            text = "No buckets with 3+ graded games yet.",
                            fontSize = 12.sp,
                            fontStyle = FontStyle.Italic,
                            color = AppColors.appTextSecondary,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    } else {
                        BucketTable(buckets)
                    }
                }
            }
            else -> Text(
                text = "Model accuracy data unavailable right now. Pull to refresh.",
                fontSize = 12.sp,
                fontStyle = FontStyle.Italic,
                color = AppColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun Tile(label: String, tally: MLBBucketTally, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
            .padding(12.dp),
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            color = AppColors.appTextSecondary,
        )
        Text(
            text = String.format(Locale.US, "%.1f%%", tally.winPct),
            fontSize = 26.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = (-0.5).sp,
            color = Regression.winPctColor(tally.winPct),
        )
        Text(
            text = "${tally.wins}-${tally.games - tally.wins}",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
        )
        Text(
            text = String.format(Locale.US, "%+.1f%% · %+.2fu", tally.roiPct, tally.unitsWon),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Regression.roiColor(tally.unitsWon),
        )
    }
}

@Composable
private fun BucketTable(buckets: List<MLBBucketBucket>) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        // Header row.
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 0.dp),
        ) {
            HeaderCell("BUCKET", Modifier.weight(1f), TextAlign.Start)
            HeaderCell("RECORD", Modifier.width(62.dp), TextAlign.End)
            HeaderCell("W%", Modifier.width(48.dp), TextAlign.End)
            HeaderCell("ROI", Modifier.width(56.dp), TextAlign.End)
        }

        buckets.forEach { b ->
            val label = listOfNotNull(b.bucket, b.side, b.favDog, b.direction)
                .filter { it.isNotEmpty() }
                .joinToString(" / ")
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(AppColors.appSurfaceMuted.copy(alpha = 0.3f))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            ) {
                Text(
                    text = label,
                    fontSize = 12.sp,
                    color = AppColors.appTextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Cell("${b.wins}-${b.games - b.wins}", Modifier.width(62.dp), AppColors.appTextSecondary)
                Text(
                    text = Regression.trimmed(b.winPct) + "%",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    textAlign = TextAlign.End,
                    color = Regression.winPctColor(b.winPct),
                    modifier = Modifier.width(48.dp),
                )
                Text(
                    text = String.format(Locale.US, "%+.1f%%", b.roiPct),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                    textAlign = TextAlign.End,
                    color = Regression.roiColor(b.roiPct),
                    modifier = Modifier.width(56.dp),
                )
            }
        }
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
private fun Cell(text: String, modifier: Modifier, color: androidx.compose.ui.graphics.Color) {
    Text(
        text = text,
        fontSize = 12.sp,
        fontFamily = FontFamily.Monospace,
        textAlign = TextAlign.End,
        color = color,
        modifier = modifier,
    )
}

@Composable
private fun Skeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            repeat(2) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    repeat(2) {
                        Column(
                            Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
                                .padding(12.dp)
                                .shimmering(),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            SkeletonBlock(width = 60.dp, height = 9.dp)
                            SkeletonBlock(width = 80.dp, height = 24.dp)
                            SkeletonBlock(width = 50.dp, height = 11.dp)
                            SkeletonBlock(width = 100.dp, height = 10.dp)
                        }
                    }
                }
            }
        }
        SkeletonBlock(height = 34.dp, cornerRadius = 10.dp, modifier = Modifier.shimmering())
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(4) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(AppColors.appSurfaceMuted.copy(alpha = 0.3f))
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                        .shimmering(),
                ) {
                    SkeletonBlock(width = 120.dp, height = 12.dp, modifier = Modifier.weight(1f))
                    SkeletonBlock(width = 44.dp, height = 12.dp)
                }
            }
        }
    }
}
