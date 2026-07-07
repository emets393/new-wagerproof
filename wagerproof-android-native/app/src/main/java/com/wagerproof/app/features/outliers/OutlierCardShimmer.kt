package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors

/**
 * Shimmer placeholder matching the OLD 160dp square `OutlierMatchupCardView` plus
 * the subtext label + pick-value lines beneath it. Port of iOS
 * `Components/OutlierCardShimmer.swift` (`OutlierCardShimmerView`).
 *
 * @param phase Retained for call-site compatibility with iOS; ignored now that
 *   all cards share one continuous [shimmering] sweep.
 */
@Composable
fun OutlierCardShimmerView(
    modifier: Modifier = Modifier,
    @Suppress("UNUSED_PARAMETER") phase: Int = 0,
) {
    val cardSize = 160.dp
    Column(
        modifier.width(cardSize).shimmering(),
        horizontalAlignment = Alignment.Start,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier
                .size(cardSize)
                .clip(RoundedCornerShape(14.dp))
                .background(AppColors.appSkeleton),
        )
        SkeletonBlock(height = 12.dp, width = 110.dp) // subtext label
        SkeletonBlock(height = 11.dp, width = 70.dp)  // pick value
    }
}
