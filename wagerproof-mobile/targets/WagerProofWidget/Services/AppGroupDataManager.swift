import Foundation

/// Manages reading data from the shared App Group storage
/// This allows the widget to access data written by the main app
final class AppGroupDataManager {
    static let shared = AppGroupDataManager()

    private let appGroupId = "group.com.wagerproof.mobile"
    private let dataKey = "widget_data"
    private let staleThreshold: TimeInterval = 60 * 60 // 60 minutes (matches widget refresh interval)

    private init() {}

    /// Access to the shared UserDefaults container
    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    /// Load widget data from shared storage
    /// - Returns: The decoded WidgetDataContainer or nil if not available
    func loadData() -> WidgetDataContainer? {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: dataKey) else {
            print("Widget: No data in App Group")
            return nil
        }

        let decoder = JSONDecoder()
        // Use custom date formatter to handle JavaScript's ISO 8601 format with milliseconds
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try with fractional seconds first (JavaScript format)
            if let date = formatter.date(from: dateString) {
                return date
            }

            // Fallback to without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date from: \(dateString)"
            )
        }

        do {
            let container = try decoder.decode(WidgetDataContainer.self, from: data)
            print("Widget: Successfully decoded data - \(container.editorPicks.count) picks, \(container.fadeAlerts.count) fades, \(container.polymarketValues.count) values")
            return container
        } catch {
            print("Widget: Failed to decode data: \(error)")
            // Try to print raw JSON for debugging
            if let jsonString = String(data: data, encoding: .utf8) {
                print("Widget: Raw JSON: \(jsonString.prefix(500))")
            }
            return nil
        }
    }

    /// Check if the cached data is stale (older than threshold)
    /// - Returns: true if data is stale or unavailable
    func isDataStale() -> Bool {
        guard let data = loadData() else { return true }
        return Date().timeIntervalSince(data.lastUpdated) > staleThreshold
    }

    /// Get the last update time as a formatted string
    /// - Returns: Formatted date string or "Never" if no data
    func lastUpdateString() -> String {
        guard let data = loadData() else { return "Never" }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: data.lastUpdated, relativeTo: Date())
    }

    /// Get editor picks from storage, limited to a specific count
    func getEditorPicks(limit: Int = 5) -> [EditorPickWidgetData] {
        guard let data = loadData() else { return [] }
        return Array(data.editorPicks.prefix(limit))
    }

    /// Get fade alerts from storage, limited to a specific count
    func getFadeAlerts(limit: Int = 5) -> [FadeAlertWidgetData] {
        guard let data = loadData() else { return [] }
        return Array(data.fadeAlerts.prefix(limit))
    }

    /// Get polymarket values from storage, limited to a specific count
    func getPolymarketValues(limit: Int = 5) -> [PolymarketValueWidgetData] {
        guard let data = loadData() else { return [] }
        return Array(data.polymarketValues.prefix(limit))
    }

    /// Check if data exists in shared storage
    var hasData: Bool {
        loadData() != nil
    }
}
