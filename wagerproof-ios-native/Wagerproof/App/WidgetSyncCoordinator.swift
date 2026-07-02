import WidgetKit
import WagerproofModels
import WagerproofServices

/// App-target wrapper around the two Home Screen widget sync services.
/// `WidgetCenter` reload calls intentionally live here rather than inside
/// `WagerproofServices` — that package is also linked into the widget
/// extension itself (for its cold-start fallback fetch), and a widget
/// reloading its own timeline from inside its own process would be
/// pointless. Only the main app ever calls this.
enum WidgetSyncCoordinator {
    /// Fetch fresh data for both widgets and reload their timelines. Safe to
    /// call opportunistically (app launch, foreground, sign-in) — both
    /// underlying services swallow their own fetch failures and simply skip
    /// the write, leaving the widget showing its last-known-good payload.
    static func syncAll(userId: String) async {
        async let agents: [TopAgentWidgetData] = {
            (try? await TopAgentsWidgetService.sync(userId: userId)) ?? []
        }()
        async let outliers = OutliersWidgetService.sync()
        _ = await (agents, outliers)

        WidgetCenter.shared.reloadTimelines(ofKind: "AgentMonitorWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "TopOutliersWidget")
    }
}
