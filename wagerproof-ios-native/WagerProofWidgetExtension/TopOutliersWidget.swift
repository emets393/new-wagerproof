import AppIntents
import WidgetKit
import SwiftUI
import WagerproofModels

struct TopOutliersEntry: TimelineEntry {
    let date: Date
    let market: OutliersWidgetMarketData?
    let selectedMarketTitle: String
    let lastUpdated: Date?
}

/// Reads the App Group payload the main app writes. Deliberately does NOT run
/// `OutliersService`'s
/// fetch pipeline itself as a cold-start fallback — that pipeline runs 4+
/// parallel Supabase queries per sport plus prediction hydration, which
/// risks exceeding the extension process's CPU/memory/time budget. Instead,
/// an empty cache just renders a "open the app to sync" placeholder.
struct TopOutliersProvider: AppIntentTimelineProvider {
    typealias Intent = OutliersWidgetConfigurationIntent

    func placeholder(in context: Context) -> TopOutliersEntry {
        TopOutliersEntry(
            date: Date(),
            market: WidgetSampleData.outlierMarkets[0],
            selectedMarketTitle: WidgetSampleData.outlierMarkets[0].title,
            lastUpdated: nil
        )
    }

    func snapshot(for configuration: Intent, in context: Context) async -> TopOutliersEntry {
        if context.isPreview {
            return placeholder(in: context)
        }
        return currentEntry(configuration: configuration)
    }

    func timeline(for configuration: Intent, in context: Context) async -> Timeline<TopOutliersEntry> {
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 60, to: Date()) ?? Date().addingTimeInterval(3600)
        return Timeline(entries: [currentEntry(configuration: configuration)], policy: .after(nextUpdate))
    }

    private func currentEntry(configuration: Intent) -> TopOutliersEntry {
        let requestedId = configuration.market?.id
        let requestedTitle = configuration.market?.title
        guard let payload = WidgetPayloadCache.read() else {
            return TopOutliersEntry(
                date: Date(),
                market: nil,
                selectedMarketTitle: requestedTitle ?? "Top Outliers",
                lastUpdated: nil
            )
        }

        let market = requestedId.flatMap { id in
            payload.outlierMarkets.first(where: { $0.id == id })
        } ?? payload.outlierMarkets.first
        return TopOutliersEntry(
            date: Date(),
            market: market,
            selectedMarketTitle: market?.title ?? requestedTitle ?? "Top Outliers",
            lastUpdated: Self.parseISO(payload.lastUpdated)
        )
    }

    private static func parseISO(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}

struct TopOutliersWidget: Widget {
    let kind = "TopOutliersWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: OutliersWidgetConfigurationIntent.self,
            provider: TopOutliersProvider()
        ) { entry in
            TopOutliersWidgetEntryView(entry: entry)
                .widgetURL(URL(string: "wagerproof://outliers"))
                .containerBackground(for: .widget) { WidgetPalette.background }
        }
        .configurationDisplayName("Top Outliers")
        .description("Follow the strongest streaks from a market you choose.")
        .supportedFamilies([.systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
