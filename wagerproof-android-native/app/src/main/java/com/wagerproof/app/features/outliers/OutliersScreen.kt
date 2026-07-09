package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.navigation.WagerProofTopBar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch

/**
 * Outliers tab root — filterable betting-trends hub. Port of iOS
 * `Features/Outliers/OutliersView.swift`. Renders the large "Outliers" title
 * over the shared [OutliersTrendsView] surface (the tab shell provides the bar).
 *
 * The store is shell-hoisted (one fetch shared with Search's Outliers rail), so
 * we only kick a refresh from idle.
 *
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutliersScreen(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val store = graph.outliersTrends
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        // Only fetch when nothing has loaded yet — matches iOS `.task { if .idle }`.
        if (store.loadState is LoadState.Idle) store.refresh()
    }

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        WagerProofTopBar(
            tabStore = graph.mainTab,
            modifier = Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars),
        )
        Text(
            text = "Outliers",
            color = AppColors.appTextPrimary,
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = Spacing.lg, vertical = 2.dp),
        )
        PullToRefreshBox(
            isRefreshing = store.isLoading,
            onRefresh = { scope.launch { store.refresh() } },
            modifier = Modifier.weight(1f).fillMaxWidth(),
        ) {
            OutliersTrendsView(store = store, modifier = Modifier.fillMaxSize())
        }
    }
}
