import SwiftUI
import WagerproofStores

/// Single source of truth mapping a tool `OutliersStore.Category` to its leaf
/// page. Both entry points — the Games-page banner push and the Outliers hub
/// detail router — call this so they always open the identical (restyled) view.
/// `.value`/`.fade` are not tools; OutliersDetailView renders those inline.
enum ToolRouter {
    @ViewBuilder
    static func leafView(for category: OutliersStore.Category) -> some View {
        switch category {
        case .nbaAccuracy:        NBAModelAccuracyView()
        case .ncaabAccuracy:      NCAABModelAccuracyView()
        case .mlbRegression:      MlbRegressionReportView()
        case .nflHistoricalAnalysis: HistoricalAnalysisView(sport: .nfl)
        case .cfbHistoricalAnalysis: HistoricalAnalysisView(sport: .cfb)
        case .value, .fade:       EmptyView()
        }
    }
}
