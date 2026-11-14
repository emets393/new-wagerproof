import SwiftUI
import WagerproofStores

/// Single source of truth mapping a tool `OutliersStore.Category` to its leaf
/// page. Both entry points — the Games-page banner push and the Outliers hub
/// detail router — call this so they always open the identical (restyled) view.
/// `.value`/`.fade` are not tools; OutliersDetailView renders those inline.
enum ToolRouter {
    @ViewBuilder
    static func leafView(for category: OutliersStore.Category) -> some View {
        if let sport = category.publicBettingSport {
            PublicBettingView(sport: sport)
        } else {
            TieredAccessGate(minimum: .premium, title: "Advanced Research") {
                toolContent(for: category)
            }
        }
    }

    @ViewBuilder
    private static func toolContent(for category: OutliersStore.Category) -> some View {
        switch category {
        case .ncaabAccuracy:      NCAABModelAccuracyView()
        case .mlbRegression:      MlbRegressionReportView()
        case .mlbHistoricalAnalysis: HistoricalAnalysisView(sport: .mlb)
        case .nflHistoricalAnalysis: HistoricalAnalysisView(sport: .nfl)
        case .cfbHistoricalAnalysis: HistoricalAnalysisView(sport: .cfb)
        case .nflRegression:      FootballRegressionReportView(sport: "nfl")
        case .cfbRegression:      FootballRegressionReportView(sport: "cfb")
        case .nflPublicBetting:   PublicBettingView(sport: .nfl)
        case .cfbPublicBetting:   PublicBettingView(sport: .cfb)
        case .nbaPublicBetting:   PublicBettingView(sport: .nba)
        case .ncaabPublicBetting: PublicBettingView(sport: .ncaab)
        case .value, .fade:       EmptyView()
        }
    }
}
