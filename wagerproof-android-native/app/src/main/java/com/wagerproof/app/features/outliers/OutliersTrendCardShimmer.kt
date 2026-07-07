package com.wagerproof.app.features.outliers

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
 * Skeleton placeholder for [OutliersTrendCard]'s compact carousel layout —
 * reproduces the fixed 240dp chrome (header avatar + title block, a betting-line
 * chip, three trend rows, and the footer divider) so the crossfade to real cards
 * never shifts the carousel. Port of iOS `Components/OutliersTrendCardShimmer.swift`.
 *
 * The `.shimmering()` sweep applies to the inner placeholder group only — the
 * card chrome (fill + border) stays solid, added after.
 */
@Composable
fun OutliersTrendCardShimmer(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(16.dp)
    // Chrome (fill + border) stays solid on the outer node; the `.shimmering()`
    // sweep runs on the inner content group only — matching iOS.
    Column(
        modifier = modifier
            .fillMaxWidth()
            .height(240.dp)
            .clip(shape)
            .background(AppColors.appSurfaceElevated, shape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.35f), shape)
            .padding(12.dp)
            .shimmering(),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Header()
        SkeletonBlock(height = 36.dp, cornerRadius = 10.dp) // betting-line chip row
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            repeat(3) { TrendRow() }
        }
        Spacer(Modifier.weight(1f))
        Footer()
    }
}

@Composable
private fun Header() {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
        SkeletonCircle(36.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            SkeletonBlock(height = 13.dp, width = 150.dp)
            SkeletonBlock(height = 11.dp, width = 100.dp)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            SkeletonBlock(height = 9.dp, width = 36.dp)
            SkeletonBlock(height = 9.dp, width = 30.dp)
        }
    }
}

@Composable
private fun TrendRow() {
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
        SkeletonBlock(height = 14.dp, width = 14.dp, cornerRadius = 4.dp)
        SkeletonBlock(height = 10.dp, modifier = Modifier.weight(1f))
        SkeletonBlock(height = 10.dp, width = 26.dp)
    }
}

@Composable
private fun Footer() {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.25f)))
        Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
            SkeletonCapsule(height = 16.dp, width = 36.dp)
            SkeletonCapsule(height = 16.dp, width = 36.dp)
            SkeletonCapsule(height = 16.dp, width = 36.dp)
            Spacer(Modifier.weight(1f))
            SkeletonBlock(height = 11.dp, width = 60.dp)
        }
    }
}
