package com.wagerproof.app.features.settings

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.PlatformStatsStore
import kotlin.math.roundToInt

/**
 * Agents "Platform Statistics" — hidden admin surface reached from Secret
 * Settings (iOS `AgentStatsView`). Win-rate distribution across the whole agent
 * population: a 10-bucket histogram over each agent's decided win rate.
 *
 * The [PlatformStatsStore] is instantiated locally (matches iOS's `@State
 * PlatformStatsStore()`), fetches once on entry, and re-buckets in memory.
 */
@Composable
fun AgentStatsScreen(onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val store = remember { PlatformStatsStore() }
    BackHandler(onBack = onDismiss)

    LaunchedEffect(Unit) { store.refresh() }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.appSurface)
            .padding(top = Spacing.sm),
    ) {
        SettingsSubScreenBar(title = "Agents Platform Stats", onDismiss = onDismiss, large = true)

        when (val s = store.loadState) {
            LoadState.Loading, LoadState.Idle, LoadState.Refreshing -> LoadingState()
            is LoadState.Failed -> ErrorState(s.message)
            LoadState.Loaded -> {
                if (store.data.isEmpty()) {
                    ErrorState("No agent data yet")
                } else {
                    Distribution(store)
                }
            }
        }
    }
}

@Composable
private fun Distribution(store: PlatformStatsStore) {
    // Only agents with a decided win rate count toward the histogram.
    val rates = store.data.mapNotNull { it.winRate }.map { (it * 100).coerceIn(0.0, 100.0) }
    // 10 buckets: [0,10), [10,20) ... [90,100].
    val buckets = IntArray(10)
    rates.forEach { r ->
        val idx = (r / 10.0).toInt().coerceIn(0, 9)
        buckets[idx]++
    }
    val maxCount = (buckets.maxOrNull() ?: 0).coerceAtLeast(1)
    val avg = if (rates.isNotEmpty()) rates.average() else 0.0

    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Text(
            text = "${rates.size} agents with settled picks",
            style = AppTypography.headline,
            color = AppColors.appTextPrimary,
        )
        Text(
            text = "Average win rate ${avg.roundToInt()}%",
            style = AppTypography.caption,
            color = AppColors.appTextSecondary,
        )

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm), modifier = Modifier.padding(top = Spacing.md)) {
            buckets.forEachIndexed { i, count ->
                val lo = i * 10
                val hi = if (i == 9) 100 else lo + 10
                HistogramBar("$lo–$hi%", count, maxCount)
            }
        }
    }
}

@Composable
private fun HistogramBar(label: String, count: Int, maxCount: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = AppColors.appTextSecondary,
            modifier = Modifier.width(64.dp),
        )
        Box(modifier = Modifier.weight(1f).height(20.dp)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction = count.toFloat() / maxCount.toFloat())
                    .height(20.dp)
                    .background(AppColors.appPrimary, RoundedCornerShape(6.dp)),
            )
        }
        Text(
            text = "$count",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
            modifier = Modifier.width(28.dp),
        )
    }
}

@Composable
private fun LoadingState() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = AppColors.appPrimary)
    }
}

@Composable
private fun ErrorState(message: String) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = AppIcon.CHART_BAR_XAXIS.imageVector,
            contentDescription = null,
            tint = AppColors.appTextMuted,
        )
        Text(
            text = message,
            style = AppTypography.body,
            color = AppColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.md),
        )
    }
}
