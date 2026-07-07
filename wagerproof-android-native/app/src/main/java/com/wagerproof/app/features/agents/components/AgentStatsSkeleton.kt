package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.tokens.AppColors

/**
 * Loading placeholder for AgentStatsView — port of iOS `AgentStatsSkeleton.swift`.
 * Mirrors its layout (2×2 summary cards, 3 pills, tall hero chart, title, two
 * per-sport charts) so the swap to real content doesn't jump.
 */
@Composable
fun AgentStatsSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .padding(16.dp)
            .shimmering(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SummaryCard(Modifier.weight(1f))
            SummaryCard(Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SummaryCard(Modifier.weight(1f))
            SummaryCard(Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            repeat(3) { SkeletonCapsule(height = 30.dp, width = 74.dp) }
            Spacer(Modifier.weight(1f))
        }
        ChartCard(height = 220.dp)
        SkeletonBlock(height = 18.dp, width = 140.dp)
        ChartCard(height = 150.dp)
        ChartCard(height = 150.dp)
    }
}

@Composable
private fun SummaryCard(modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appSurfaceElevated)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        SkeletonBlock(height = 11.dp, width = 60.dp)
        SkeletonBlock(height = 24.dp, width = 80.dp)
    }
}

@Composable
private fun ChartCard(height: Dp) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AppColors.appSurfaceElevated)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SkeletonBlock(height = 15.dp, width = 160.dp)
        SkeletonBlock(height = height, cornerRadius = 12.dp)
    }
}
