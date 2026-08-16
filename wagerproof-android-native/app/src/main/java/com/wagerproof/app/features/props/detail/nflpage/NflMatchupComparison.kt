package com.wagerproof.app.features.props.detail.nflpage

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLCompareLookRow
import com.wagerproof.core.models.NFLPropFormat
import com.wagerproof.core.models.NFLPropGameSplitResolved
import com.wagerproof.core.models.NFLPropLookHitEntry
import com.wagerproof.core.models.NFLPropDefenseTile
import com.wagerproof.core.models.NFLPropPlayerPage
import com.wagerproof.core.models.NFLPropSchemeCompare
import com.wagerproof.core.models.NFLSchemeCompareMode
import com.wagerproof.core.models.NFLSchemeCompareResolved
import kotlin.math.abs
import kotlin.math.roundToInt

private val Amber = Color(0xFFF59E0B)

/**
 * Matchup widget body — the native `ComparisonBlock`: the player's career
 * production vs his production against the look this opponent plays, then
 * per-game splits vs similar defenses, look hit-rates, and the opponent's
 * defense-usage tiles. Resolution logic lives in `NFLPropSchemeCompare`.
 * Mirrors iOS `NFLMatchupComparison.swift`.
 */
@Composable
fun NflMatchupComparison(page: NFLPropPlayerPage, marketKey: String) {
    val opponent = page.scheme?.opponent ?: page.opponent ?: ""
    val compare = NFLPropSchemeCompare.resolve(page, marketKey)

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        val overall = compare?.overallValue
        if (compare != null && compare.hasCompare && overall != null) {
            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                compare.lookRows.forEach { row ->
                    LookRowView(row, compare, overall, opponent)
                }
            }
        } else {
            EmptyCompareBox(
                reason = compare?.emptyReason ?: NFLSchemeCompareResolved.EmptyReason.MISSING,
                playerName = page.playerName,
                opponent = opponent,
            )
        }

        NFLPropSchemeCompare.gameSplit(page, marketKey)?.let { split ->
            GameSplitsBlock(split, opponent)
        }

        val hitEntries = NFLPropSchemeCompare.lookHitEntries(page, marketKey)
        if (hitEntries.isNotEmpty()) {
            LookHitRatesBlock(hitEntries, opponent)
        }

        val tiles = NFLPropSchemeCompare.defenseTiles(page, compare?.mode)
        if (tiles.isNotEmpty()) {
            DefenseTilesBlock(tiles, opponent)
        }
    }
}

@Composable
private fun LookRowView(
    row: NFLCompareLookRow,
    compare: NFLSchemeCompareResolved,
    overall: Double,
    opponent: String,
) {
    val digits = if (compare.mode == NFLSchemeCompareMode.RECEIVING) 1 else 2
    val delta = row.delta ?: (row.value - overall)
    val tone = when {
        delta >= row.deltaThreshold -> NflPropNumberLineTone.UP
        delta <= -row.deltaThreshold -> NflPropNumberLineTone.DOWN
        else -> NflPropNumberLineTone.NEUTRAL
    }
    val metricName = when (compare.mode) {
        NFLSchemeCompareMode.QB -> "EPA per dropback"
        NFLSchemeCompareMode.RUSH -> "EPA per rush"
        NFLSchemeCompareMode.RECEIVING -> "yards per target"
    }
    val direction = if (delta > 0) "higher" else if (delta < 0) "lower" else "the same"
    val lookLabel = row.label.removePrefix("vs ").lowercase()
    // Comparison values sit close together; half the gap keeps both markers
    // on the rail (web SchemeLinearComparison padding).
    val padding = maxOf(
        if (compare.mode == NFLSchemeCompareMode.RECEIVING) 0.1 else 0.01,
        abs(row.value - overall) * 0.5,
    )
    val (primaryFraction, secondaryFraction) =
        nflPropNumberLineFractions(row.value, overall, padding, floorAtZero = false)
    val deltaDigits = if (abs(delta) < 1) 2 else 1

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "He produces ${NFLPropFormat.perGame(row.value, digits)} $metricName against $lookLabel, " +
                "compared with ${NFLPropFormat.perGame(overall, digits)} across his career — " +
                "${NFLPropFormat.perGame(abs(delta), deltaDigits)} ${row.unit} $direction against the look $opponent prefers.",
            color = AppColors.appTextPrimary,
            fontSize = 13.sp,
            lineHeight = 18.sp,
            fontWeight = FontWeight.SemiBold,
        )

        NflPropNumberLine(
            primary = NflPropNumberLineMarker(
                label = "Vs $opponent's look",
                value = NFLPropFormat.perGame(row.value, digits),
                caption = row.unit,
            ),
            primaryFraction = primaryFraction,
            secondary = NflPropNumberLineMarker(
                label = "Career avg",
                value = NFLPropFormat.perGame(overall, digits),
                caption = compare.overallUnit,
            ),
            secondaryFraction = secondaryFraction,
            tone = tone,
            deltaText = "${if (delta > 0) "+" else if (delta < 0) "-" else ""}${NFLPropFormat.perGame(abs(delta), deltaDigits)} ${row.unit}",
            leadingCaption = "Lower production",
            trailingCaption = "Higher production",
            primaryValueSize = 15f,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(row.detail, color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            row.support?.let {
                Text(it, color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
            }
            if (row.sample == "thin") {
                Text("THIN SAMPLE", color = Amber, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun EmptyCompareBox(
    reason: NFLSchemeCompareResolved.EmptyReason,
    playerName: String,
    opponent: String,
) {
    val title = when (reason) {
        NFLSchemeCompareResolved.EmptyReason.THIN -> "Thin sample vs this look"
        NFLSchemeCompareResolved.EmptyReason.ROOKIE -> "No career scheme split yet"
        else -> "No scheme production split for this player yet"
    }
    val lastName = playerName.split(" ").lastOrNull() ?: playerName
    val body = when (reason) {
        NFLSchemeCompareResolved.EmptyReason.ROOKIE ->
            "No NFL sample yet — $lastName is listed as a rookie."
        NFLSchemeCompareResolved.EmptyReason.THIN ->
            "Sample is too thin to compare him to $opponent's scheme yet. Defense mix below is still useful context."
        else ->
            "We need career production vs the looks $opponent plays to compare him to that scheme. Below is how often that defense uses each look."
    }
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Amber.copy(alpha = 0.05f))
            .border(1.dp, Amber.copy(alpha = 0.3f), shape)
            .padding(horizontal = 16.dp, vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        Text(body, color = AppColors.appTextSecondary, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun GameSplitsBlock(split: NFLPropGameSplitResolved, opponent: String) {
    val overallV = split.overall.stats[split.statKey]
    val lookV = split.entry.stats[split.statKey]
    val delta = split.entry.delta[split.statKey]
    val tone = when {
        delta == null || delta == 0.0 -> AppColors.appTextPrimary
        delta > 0 -> AppColors.appWin
        else -> AppColors.appLoss
    }

    SubBlock(title = "Per-game avg vs defenses like $opponent") {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (overallV != null) {
                Text("${NFLPropFormat.perGame(overallV)} overall", color = AppColors.appTextSecondary, fontSize = 13.sp)
                Icon(
                    AppIcon.fromSystemName("arrow.right")?.imageVector ?: AppIcon.CHEVRON_RIGHT.imageVector,
                    null, tint = AppColors.appTextMuted, modifier = Modifier.width(12.dp),
                )
            }
            Text(
                NFLPropFormat.perGame(lookV),
                color = tone, fontSize = 15.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
            )
            Text(
                "vs ${split.bucketLabels.joinToString(" / ")}${split.entry.n?.let { " · n=$it" } ?: ""}",
                color = AppColors.appTextSecondary, fontSize = 12.sp,
            )
            delta?.let {
                Text(
                    "${if (it > 0) "+" else ""}${NFLPropFormat.perGame(it)}",
                    color = tone, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
                )
            }
        }
    }
}

@Composable
private fun LookHitRatesBlock(entries: List<NFLPropLookHitEntry>, opponent: String) {
    SubBlock(title = "Did he clear the line vs defenses like $opponent?") {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            entries.forEach { entry ->
                val pct = entry.record.pct
                val good = pct != null && pct >= 0.6
                val bad = pct != null && pct <= 0.4
                val shape = RoundedCornerShape(10.dp)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(AppColors.appSurfaceMuted.copy(alpha = 0.5f))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        NFLPropSchemeCompare.lookBucketLabels[entry.bucket] ?: entry.bucket,
                        color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "${entry.record.h}/${entry.record.n}${pct?.let { " · ${(it * 100).roundToInt()}%" } ?: ""}",
                        color = if (good) AppColors.appWin else if (bad) AppColors.appLoss else AppColors.appTextPrimary,
                        fontSize = 14.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
                    )
                }
            }
        }
    }
}

@Composable
private fun DefenseTilesBlock(tiles: List<NFLPropDefenseTile>, opponent: String) {
    SubBlock(title = "What $opponent actually plays") {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            tiles.chunked(3).forEach { rowTiles ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    rowTiles.forEach { tile ->
                        DefenseTile(tile, Modifier.weight(1f))
                    }
                    repeat(3 - rowTiles.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun DefenseTile(tile: NFLPropDefenseTile, modifier: Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier
            .clip(shape)
            .background(Amber.copy(alpha = 0.08f))
            .border(0.6.dp, Amber.copy(alpha = 0.3f), shape)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                tile.label.uppercase(),
                color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold, maxLines = 2,
                modifier = Modifier.weight(1f, fill = false),
            )
            Text(
                "KEY",
                color = Amber, fontSize = 7.sp, fontWeight = FontWeight.Black,
                modifier = Modifier
                    .background(Amber.copy(alpha = 0.18f), RoundedCornerShape(3.dp))
                    .padding(horizontal = 3.dp, vertical = 1.dp),
            )
        }
        Text(
            NFLPropFormat.ratePct(tile.rate),
            color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace,
        )
        Text(
            "${NFLPropFormat.pctileOrdinal(tile.pctile)} %ile",
            color = AppColors.appTextMuted, fontSize = 10.sp,
        )
    }
}

@Composable
private fun SubBlock(title: String, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.35f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.45f), shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            title.uppercase(),
            color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black,
        )
        content()
    }
}
