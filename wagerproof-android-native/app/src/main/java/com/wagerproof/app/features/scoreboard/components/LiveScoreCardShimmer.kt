package com.wagerproof.app.features.scoreboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors

/**
 * Shimmer placeholder matching [LiveScoreCard]'s compact-tile footprint so the
 * loaded-state crossfade doesn't shift the grid. iOS `LiveScoreCardShimmer`.
 */
@Composable
fun LiveScoreCardShimmer(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(8.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurface)
            .border(1.dp, AppColors.appBorder, shape),
    ) {
        Column(
            Modifier.shimmering().padding(horizontal = 10.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    SkeletonBlock(width = 26.dp, height = 12.dp)
                    SkeletonBlock(width = 18.dp, height = 14.dp)
                    SkeletonBlock(width = 18.dp, height = 14.dp)
                    SkeletonBlock(width = 26.dp, height = 12.dp)
                }
                Box(Modifier.weight(1f))
                SkeletonBlock(width = 34.dp, height = 10.dp)
            }
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.Center) {
                Box(Modifier.weight(1f))
                SkeletonCapsule(width = 64.dp, height = 10.dp)
                Box(Modifier.weight(1f))
            }
        }
    }
}
