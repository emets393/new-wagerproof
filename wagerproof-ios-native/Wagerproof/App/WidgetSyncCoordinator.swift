import Foundation
import OSLog
import WidgetKit
import WagerproofModels
import WagerproofServices

/// App-target wrapper around the two Home Screen widget sync services.
/// `WidgetCenter` reload calls intentionally live here rather than inside
/// `WagerproofServices`. Only the main app performs network fetches; the
/// lightweight widget extension reads the resulting App Group snapshot.
enum WidgetSyncCoordinator {
    private static let logger = Logger(
        subsystem: "com.wagerproof.mobile",
        category: "WidgetSync"
    )

    /// Fetch fresh data for both widgets, merge it with the last-known-good
    /// payload, then write once. A single write is important: the two widget
    /// services share one JSON blob, so concurrent read-modify-write syncs can
    /// otherwise erase whichever result finishes first.
    static func syncAll(userId: String) async {
        async let agentsTask = fetchAgents(userId: userId)
        async let outliersTask = fetchOutliers()
        let (agents, outliers) = await (agentsTask, outliersTask)

        guard agents != nil || outliers != nil else {
            logger.error("Widget sync failed before any data could be fetched")
            return
        }

        var payload = TopAgentsWidgetService.readPayload() ?? WidgetDataPayload.empty()
        if let agents { payload.topAgentPicks = agents }
        if let alerts = outliers?.alerts { payload.topOutliers = alerts }
        if let markets = outliers?.markets { payload.outlierMarkets = markets }
        payload.lastUpdated = nowISO()

        do {
            try TopAgentsWidgetService.writePayload(payload)
        } catch {
            logger.error("Failed to persist widget payload: \(error.localizedDescription, privacy: .public)")
            return
        }

        logger.info(
            "Synced widget payload: \(payload.topAgentPicks.count) agents, \(payload.outlierMarkets.count) markets"
        )

        WidgetCenter.shared.reloadTimelines(ofKind: "AgentMonitorWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "TopOutliersWidget")
    }

    private static func fetchAgents(userId: String) async -> [TopAgentWidgetData]? {
        do {
            return try await TopAgentsWidgetService.fetchTopAgents(userId: userId)
        } catch {
            logger.error("Failed to fetch agent widget data: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private static func fetchOutliers() async -> OutliersWidgetService.Snapshot? {
        let snapshot = await OutliersWidgetService.fetchSnapshot()
        guard snapshot.alerts != nil || snapshot.markets != nil else {
            logger.error("Failed to fetch every outlier widget source")
            return nil
        }
        return snapshot
    }

    private static func nowISO() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }
}
