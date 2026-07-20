import Foundation
import OSLog
import WagerproofModels

/// Minimal App Group reader kept inside the widget extension. Importing the
/// app's service layer here would also link Supabase, RevenueCat, Facebook,
/// Google Sign-In, and Mixpanel into a process with a tight memory budget.
enum WidgetPayloadCache {
    private static let appGroupId = "group.com.wagerproof.mobile"
    private static let payloadKey = "widgetPayload"
    private static let logger = Logger(
        subsystem: "com.wagerproof.mobile.widget",
        category: "WidgetPayload"
    )

    static func read() -> WidgetDataPayload? {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let json = defaults.string(forKey: payloadKey),
              let data = json.data(using: .utf8) else {
            logger.error("No widget payload was available in the App Group")
            return nil
        }

        do {
            return try JSONDecoder().decode(WidgetDataPayload.self, from: data)
        } catch {
            logger.error("Failed to decode widget payload: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}
