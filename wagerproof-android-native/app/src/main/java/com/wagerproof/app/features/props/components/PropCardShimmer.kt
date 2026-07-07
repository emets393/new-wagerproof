package com.wagerproof.app.features.props.components

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
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors

/**
 * Skeleton placeholder for [PropPlayerCard]. Reproduces the real card's chrome
 * and lays skeleton shapes exactly where the headshot / name+vs / O-U pills /
 * trend strip / bottom info row land, so the crossfade to loaded content never
 * shifts the layout. Port of iOS `PropCardShimmer.swift`.
 */
@Composable
fun PropCardShimmer(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(26.dp)
    Box(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape),
    ) {
        Column(
            Modifier
                .shimmering()
                .padding(start = 12.dp, end = 14.dp, top = 9.dp, bottom = 9.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SkeletonCircle(44.dp)
                Spacer(Modifier.width(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SkeletonBlock(height = 13.dp, width = 96.dp)
                    SkeletonBlock(height = 9.dp, width = 48.dp)
                }
                Spacer(Modifier.weight(1f))
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SkeletonCapsule(height = 20.dp, width = 58.dp)
                    SkeletonCapsule(height = 20.dp, width = 58.dp)
                }
                Spacer(Modifier.width(10.dp))
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    SkeletonBlock(height = 8.dp, width = 44.dp)
                    SkeletonBlock(height = 46.dp, width = 74.dp, cornerRadius = 4.dp)
                }
            }
            Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.5f)))
            Row(verticalAlignment = Alignment.CenterVertically) {
                repeat(3) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        SkeletonBlock(height = 8.dp, width = 24.dp)
                        SkeletonBlock(height = 11.dp, width = 40.dp)
                    }
                    Spacer(Modifier.width(16.dp))
                }
                Spacer(Modifier.weight(1f))
                SkeletonCapsule(height = 18.dp, width = 44.dp)
            }
        }
    }
}
