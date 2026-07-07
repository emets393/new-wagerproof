package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors

/**
 * Feed-card skeleton — port of iOS `GameCardShimmer.swift`. Reproduces the
 * standard-row footprint; only the placeholder group shimmers (chrome solid).
 */
@Composable
fun GameCardShimmer(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(26.dp)
    Box(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.4f), shape)
            .padding(14.dp),
    ) {
        Column(Modifier.shimmering()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row {
                    SkeletonCircle(34.dp)
                    Spacer(Modifier.width((-10).dp))
                    SkeletonCircle(34.dp)
                }
                Spacer(Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SkeletonBlock(height = 22.dp, width = 70.dp, cornerRadius = 8.dp)
                    SkeletonBlock(height = 22.dp, width = 70.dp, cornerRadius = 8.dp)
                }
                Spacer(Modifier.width(10.dp))
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SkeletonBlock(height = 8.dp, width = 44.dp)
                    SkeletonBlock(height = 24.dp, width = 98.dp)
                }
            }
            Spacer(Modifier.height(10.dp))
            Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
            Spacer(Modifier.height(10.dp))
            Row {
                SkeletonBlock(height = 22.dp, width = 96.dp, cornerRadius = 8.dp)
                Spacer(Modifier.width(8.dp))
                SkeletonBlock(height = 22.dp, width = 80.dp, cornerRadius = 8.dp)
            }
        }
    }
}
