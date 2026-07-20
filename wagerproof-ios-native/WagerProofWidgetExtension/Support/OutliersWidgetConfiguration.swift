import AppIntents
import WagerproofModels

/// A live Outliers page header exposed in the widget's Edit sheet. Options are
/// read from the same cached payload as the timeline, so new market headers
/// automatically become selectable without an extension update.
struct OutliersMarketEntity: AppEntity, Hashable, Sendable {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Outliers Market")
    static var defaultQuery = OutliersMarketQuery()

    let id: String
    let title: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

struct OutliersMarketQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [OutliersMarketEntity] {
        let wanted = Set(identifiers)
        return availableMarkets.filter { wanted.contains($0.id) }
    }

    func suggestedEntities() async throws -> [OutliersMarketEntity] {
        availableMarkets
    }

    func defaultResult() async -> OutliersMarketEntity? {
        availableMarkets.first
    }

    private var availableMarkets: [OutliersMarketEntity] {
        (WidgetPayloadCache.read()?.outlierMarkets ?? []).map {
            OutliersMarketEntity(id: $0.id, title: $0.title)
        }
    }
}

struct OutliersWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choose Outliers Market"
    static var description = IntentDescription(
        "Select the Outliers header this widget follows, such as Parlay God or Moneyline."
    )

    @Parameter(title: "Market")
    var market: OutliersMarketEntity?

    init() {}

    init(market: OutliersMarketEntity?) {
        self.market = market
    }
}
