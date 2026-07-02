import WidgetKit
import SwiftUI
import WagerproofModels
import WagerproofServices

struct AgentMonitorEntry: TimelineEntry {
    let date: Date
    let agents: [TopAgentWidgetData]
    let lastUpdated: Date?
}

/// Reads the App Group payload `TopAgentsWidgetService.sync(userId:)`
/// (called from the main app) writes. No in-extension fallback fetch, same
/// reasoning as `TopOutliersProvider` — keeps the extension process light
/// and avoids needing an authenticated Supabase session inside the
/// extension. An empty cache renders a "open the app" placeholder instead.
struct AgentMonitorProvider: TimelineProvider {
    func placeholder(in context: Context) -> AgentMonitorEntry {
        AgentMonitorEntry(date: Date(), agents: WidgetSampleData.topAgents, lastUpdated: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (AgentMonitorEntry) -> Void) {
        if context.isPreview {
            completion(AgentMonitorEntry(date: Date(), agents: WidgetSampleData.topAgents, lastUpdated: nil))
            return
        }
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AgentMonitorEntry>) -> Void) {
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 60, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [currentEntry()], policy: .after(nextUpdate)))
    }

    private func currentEntry() -> AgentMonitorEntry {
        guard let payload = TopAgentsWidgetService.readPayload() else {
            return AgentMonitorEntry(date: Date(), agents: [], lastUpdated: nil)
        }
        return AgentMonitorEntry(
            date: Date(),
            agents: payload.topAgentPicks,
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

struct AgentMonitorWidget: Widget {
    let kind = "AgentMonitorWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AgentMonitorProvider()) { entry in
            AgentMonitorWidgetEntryView(entry: entry)
                .widgetURL(URL(string: "wagerproof://agents"))
                .containerBackground(for: .widget) { WidgetPalette.background }
        }
        .configurationDisplayName("Agent Monitor")
        .description("Track your favorite AI agents' record, streak, and latest picks.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
