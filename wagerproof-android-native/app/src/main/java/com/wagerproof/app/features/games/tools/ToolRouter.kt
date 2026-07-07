package com.wagerproof.app.features.games.tools

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.wagerproof.app.features.analytics.MlbRegressionReportScreen
import com.wagerproof.app.features.outliers.NBAModelAccuracyView
import com.wagerproof.app.features.outliers.NCAABModelAccuracyView
import com.wagerproof.core.stores.OutliersStore

/**
 * Maps a tool's [OutliersStore.Category] to its leaf page. iOS
 * `Games/Tools/ToolRouter`. Both entry points (Games banner + Outliers hub)
 * call this so they open the identical view. `value`/`fade` aren't tools.
 */
object ToolRouter {
    @Composable
    fun LeafView(category: OutliersStore.Category, modifier: Modifier = Modifier) {
        when (category) {
            OutliersStore.Category.nbaAccuracy -> NBAModelAccuracyView(modifier)
            OutliersStore.Category.ncaabAccuracy -> NCAABModelAccuracyView(modifier)
            OutliersStore.Category.mlbRegression -> MlbRegressionReportScreen(modifier)
            OutliersStore.Category.`value`, OutliersStore.Category.fade -> Unit
        }
    }
}
