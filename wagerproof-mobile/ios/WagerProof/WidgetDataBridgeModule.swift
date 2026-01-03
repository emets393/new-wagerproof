import Foundation
import WidgetKit

/// Native module to sync data from React Native to the iOS widget via App Groups
@objc(WidgetDataBridgeModule)
class WidgetDataBridgeModule: NSObject {
    private let appGroupId = "group.com.wagerproof.mobile"
    private let dataKey = "widget_data"

    /// Sync widget data from React Native to shared App Group storage
    @objc
    func syncWidgetData(_ jsonString: String,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        print("WidgetDataBridge: syncWidgetData called with \(jsonString.count) bytes")

        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            print("WidgetDataBridge: ERROR - Failed to access App Group: \(appGroupId)")
            reject("APP_GROUP_ERROR", "Failed to access App Group UserDefaults", nil)
            return
        }

        guard let data = jsonString.data(using: .utf8) else {
            print("WidgetDataBridge: ERROR - Failed to encode JSON string")
            reject("ENCODING_ERROR", "Failed to encode JSON string to data", nil)
            return
        }

        // Validate and log JSON structure
        do {
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let picksCount = (json["editorPicks"] as? [[String: Any]])?.count ?? 0
                let fadesCount = (json["fadeAlerts"] as? [[String: Any]])?.count ?? 0
                let valuesCount = (json["polymarketValues"] as? [[String: Any]])?.count ?? 0
                print("WidgetDataBridge: Parsed JSON - \(picksCount) picks, \(fadesCount) fades, \(valuesCount) values")
            }
        } catch {
            print("WidgetDataBridge: ERROR - Invalid JSON: \(error.localizedDescription)")
            reject("JSON_ERROR", "Invalid JSON data: \(error.localizedDescription)", error)
            return
        }

        // Store the data
        defaults.set(data, forKey: dataKey)
        defaults.synchronize()
        print("WidgetDataBridge: Data saved to App Group successfully")

        // Trigger widget refresh
        WidgetCenter.shared.reloadAllTimelines()
        print("WidgetDataBridge: Widget timelines reloaded")

        resolve(true)
    }

    /// Force reload all widget timelines
    @objc
    func reloadWidgets(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
        WidgetCenter.shared.reloadAllTimelines()
        resolve(true)
    }

    /// Get the current widget data from App Group storage (for debugging)
    @objc
    func getWidgetData(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            reject("APP_GROUP_ERROR", "Failed to access App Group UserDefaults", nil)
            return
        }

        guard let data = defaults.data(forKey: dataKey),
              let jsonString = String(data: data, encoding: .utf8) else {
            resolve(NSNull())
            return
        }

        resolve(jsonString)
    }

    /// Clear widget data from App Group storage
    @objc
    func clearWidgetData(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            reject("APP_GROUP_ERROR", "Failed to access App Group UserDefaults", nil)
            return
        }

        defaults.removeObject(forKey: dataKey)
        defaults.synchronize()

        // Trigger widget refresh to show empty state
        WidgetCenter.shared.reloadAllTimelines()

        resolve(true)
    }

    /// Check if widgets are supported on this device
    @objc
    func isWidgetSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(true)
    }

    /// Required for React Native modules
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
