package com.wagerproof.app.features.games.tools

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.analytics.MlbRegressionReportScreen
import com.wagerproof.app.features.analytics.PublicBettingScreen
import com.wagerproof.app.features.analytics.historical.HistoricalAnalysisScreen
import com.wagerproof.app.features.outliers.NCAABModelAccuracyView
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.stores.OutliersStore

/**
 * Maps a tool's [OutliersStore.Category] to its leaf page. iOS
 * `Games/Tools/ToolRouter`. Both entry points (Games banner + Outliers hub)
 * call this so they open the identical view. `value`/`fade` aren't tools.
 */
object ToolRouter {
    @Composable
    fun LeafView(category: OutliersStore.Category, modifier: Modifier = Modifier) {
        val sport = category.publicBettingSport()
        if (sport != null) {
            PublicBettingScreen(sport, modifier)
        } else {
            com.wagerproof.app.features.paywall.TieredAccessGate(com.wagerproof.core.models.SubscriptionTier.PREMIUM, "Advanced Research") {
                when (category) {
                    OutliersStore.Category.ncaabAccuracy -> NCAABModelAccuracyView(modifier)
                    OutliersStore.Category.mlbRegression -> MlbRegressionReportScreen(modifier)
                    OutliersStore.Category.mlbHistoricalAnalysis -> HistoricalAnalysisScreen(HistoricalAnalysisSport.MLB, modifier)
                    OutliersStore.Category.nflHistoricalAnalysis -> HistoricalAnalysisScreen(HistoricalAnalysisSport.NFL, modifier)
                    OutliersStore.Category.cfbHistoricalAnalysis -> HistoricalAnalysisScreen(HistoricalAnalysisSport.CFB, modifier)
                    OutliersStore.Category.nflPublicBetting,
                    OutliersStore.Category.cfbPublicBetting,
                    OutliersStore.Category.nbaPublicBetting,
                    OutliersStore.Category.ncaabPublicBetting,
                    OutliersStore.Category.`value`, OutliersStore.Category.fade -> Unit
                }
            }
        }
    }
}
