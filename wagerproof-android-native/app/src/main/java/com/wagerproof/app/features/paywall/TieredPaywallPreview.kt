package com.wagerproof.app.features.paywall

import androidx.compose.runtime.*
import com.wagerproof.app.BuildConfig
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.models.*

/** A debug-only visual harness. Fixtures cannot enter Play Billing. */
@Composable
fun TieredPaywallPreview(target: String, access: String?, yearly: Boolean) {
    if (!BuildConfig.DEBUG) return
    val graph = appGraph()
    SideEffect { graph.proAccess.previewMode = EntitlementPreview.entries.firstOrNull { it.name.equals(access, true) } ?: EntitlementPreview.LEGACY_FREE }
    val navigator = remember { com.wagerproof.app.nav.AppNavigator(com.wagerproof.app.nav.TabBackStacks(), graph.mainTab) }
    CompositionLocalProvider(com.wagerproof.app.nav.LocalAppNavigator provides navigator) {
    when(target) {
        "historical" -> com.wagerproof.app.features.analytics.historical.HistoricalAnalysisScreen(HistoricalAnalysisSport.MLB)
        "agents" -> com.wagerproof.app.features.agents.AgentsScreen()
        "props" -> com.wagerproof.app.features.props.PropsScreen()
        "outliers" -> com.wagerproof.app.features.outliers.OutliersScreen()
        else -> TieredPaywallScreen(preview = true,
            initialTier = SubscriptionTier.entries.firstOrNull { it.slug == target } ?: SubscriptionTier.PRO,
            initialYearly = yearly, showsPicksExpiry = target == "onboarding", allowClose = target != "onboarding", onDismiss = {})
    }
}
}
