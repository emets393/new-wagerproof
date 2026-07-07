package com.wagerproof.app.features.outliers

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.LoadState

/**
 * Outliers tab root — filterable betting-trends hub. Port of iOS
 * `Features/Outliers/OutliersView.swift`. Renders the large "Outliers" title
 * over the shared [OutliersTrendsView] surface (the tab shell provides the bar).
 *
 * The store is shell-hoisted (one fetch shared with Search's Outliers rail), so
 * we only kick a refresh from idle.
 *
 * TODO: iOS toolbar (leading WagerProof logo, trailing Settings gear + Chat) —
 * wire once the shared toolbar/nav host lands on Android.
 */
@Composable
fun OutliersScreen(modifier: Modifier = Modifier) {
    val store = appGraph().outliersTrends

    LaunchedEffect(Unit) {
        // Only fetch when nothing has loaded yet — matches iOS `.task { if .idle }`.
        if (store.loadState is LoadState.Idle) store.refresh()
    }

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        Text(
            text = "Outliers",
            color = AppColors.appTextPrimary,
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.sm),
        )
        OutliersTrendsView(
            store = store,
            modifier = Modifier.weight(1f).fillMaxWidth(),
        )
    }
}
