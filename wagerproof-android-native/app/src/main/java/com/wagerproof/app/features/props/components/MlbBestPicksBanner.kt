package com.wagerproof.app.features.props.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.props.PropHoneydewBanner
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.models.MLBPlayerPropPerformanceFormatting
import com.wagerproof.core.stores.MLBPlayerPropPicksStore

/**
 * Tappable banner on the MLB Props tab — opens the Best Picks hub. Rendered as a
 * Honeydew tool banner so it reads as a sibling of the Games-page tool banners;
 * the subtitle swaps in live graded performance once picks settle.
 * Port of iOS `MLBBestPicksBanner.swift`.
 */
@Composable
fun MlbBestPicksBanner(
    store: MLBPlayerPropPicksStore,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val overall = store.overall
    val subtitle = if (overall.settled > 0) {
        "${overall.settled} settled · " +
            "${MLBPlayerPropPerformanceFormatting.formatUnits(overall.unitsWon)} · " +
            "${MLBPlayerPropPerformanceFormatting.formatPct(overall.winPct)} win"
    } else {
        "Today's AI picks + track record"
    }

    PropHoneydewBanner(
        title = "Best MLB Props",
        subtitle = subtitle,
        actionWord = "View all",
        primary = hexColor(0x10B981),
        secondary = hexColor(0x6EE7B7),
        symbols = listOf(
            "target", "trophy.fill", "dollarsign.circle.fill", "chart.line.uptrend.xyaxis",
            "flame.fill", "baseball.fill", "checkmark.seal.fill", "rosette", "bolt.fill", "star.fill",
        ),
        onTap = onTap,
        modifier = modifier,
    )
}
