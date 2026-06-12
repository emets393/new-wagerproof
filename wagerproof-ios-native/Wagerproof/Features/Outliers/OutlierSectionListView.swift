import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// "See all" destination for an Outliers hub rail: the full ranked set of one
/// primitive type as a vertical list of the same cards used in the rail. Tap
/// handlers come from `OutliersView` so navigation matches the rail (trends/F5
/// open a sheet, a prop pushes its detail). Inherits the env stores from the
/// pushing view, so the F5 badge resolves the same way it does in the rail.
struct OutlierSectionListView: View {
    let kind: OutlierSections.Kind
    let trends: [MLBGameTrends]
    let f5Games: [MLBF5Game]
    let props: [PlayerPropFeedItem]
    let onTrends: (MLBGameTrends) -> Void
    let onF5: (MLBF5Game) -> Void
    let onProp: (PlayerPropSelection) -> Void

    @Environment(MLBF5SplitsStore.self) private var f5Store: MLBF5SplitsStore?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                switch kind {
                case .trends:
                    ForEach(trends) { game in
                        OutlierCardBuilder.trends(game, stretches: true) { onTrends(game) }
                    }
                case .f5:
                    ForEach(f5Games) { game in
                        OutlierCardBuilder.f5(game, store: f5Store, stretches: true) { onF5(game) }
                    }
                case .props:
                    ForEach(props) { item in
                        OutlierPropCard(item: item, onTap: onProp)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, Spacing.md)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle(kind.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
