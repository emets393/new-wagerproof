import WidgetKit
import SwiftUI
import WagerproofModels
import WagerproofServices

struct TopOutliersEntry: TimelineEntry {
    let date: Date
    let alerts: [OutlierAlertForWidget]
    let lastUpdated: Date?
}

/// Reads the App Group payload `OutliersWidgetService.sync()` (called from
/// the main app) writes into. Deliberately does NOT run `OutliersService`'s
/// fetch pipeline itself as a cold-start fallback — that pipeline runs 4+
/// parallel Supabase queries per sport plus prediction hydration, which
/// risks exceeding the extension process's CPU/memory/time budget. Instead,
/// an empty cache just renders a "open the app to sync" placeholder.
struct TopOutliersProvider: TimelineProvider {
    func placeholder(in context: Context) -> TopOutliersEntry {
        TopOutliersEntry(date: Date(), alerts: WidgetSampleData.outlierAlerts, lastUpdated: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (TopOutliersEntry) -> Void) {
        if context.isPreview {
            completion(TopOutliersEntry(date: Date(), alerts: WidgetSampleData.outlierAlerts, lastUpdated: nil))
            return
        }
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TopOutliersEntry>) -> Void) {
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 60, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [currentEntry()], policy: .after(nextUpdate)))
    }

    private func currentEntry() -> TopOutliersEntry {
        guard let payload = TopAgentsWidgetService.readPayload() else {
            return TopOutliersEntry(date: Date(), alerts: [], lastUpdated: nil)
        }
        return TopOutliersEntry(
            date: Date(),
            alerts: payload.topOutliers,
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
        StaticConfiguration(kind: kind, provider: TopOutliersProvider()) { entry in
            TopOutliersWidgetEntryView(entry: entry)
                .widgetURL(URL(string: "wagerproof://outliers"))
                .containerBackground(for: .widget) { WidgetPalette.background }
        }
        .configurationDisplayName("Top Outliers")
        .description("The day's highest-confidence value and fade alerts.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
