import Foundation
import UIKit
import FBSDKCoreKit

/// Meta App Events / Facebook SDK fan-out for install→subscribe attribution.
/// Mirrors the RN `services/analytics.ts` Facebook block (lines 229–320) so
/// event names stay 1:1 with `react-native-fbsdk-next`:
///   - `fb_mobile_complete_registration` on onboarding finish
///   - `fb_mobile_purchase` for trial starts (logPurchase)
///   - `Subscribe` for initial paid subscriptions
///
/// Auto-logging is DISABLED so we only emit the events RevenueCat's server-side
/// Meta integration also receives — prevents double-counting on the Meta side.
public final class MetaAnalyticsService: @unchecked Sendable {
    public static let shared = MetaAnalyticsService()

    private var initialized = false

    private init() {}

    // MARK: - Lifecycle

    /// Boot the Meta SDK. Safe to call multiple times — guards with `initialized`.
    /// Equivalent to `ApplicationDelegate.shared.application(_:didFinishLaunchingWithOptions:)`
    /// in a UIKit AppDelegate. Run from `WagerproofApp.init()`.
    public func initialize() {
        guard !initialized else { return }
        // Forward to FB SDK's app-launch hook. SwiftUI apps don't have a
        // real AppDelegate, so we pass nil options — the SDK only uses them
        // to recover deferred-deep-link state which we don't rely on.
        ApplicationDelegate.shared.application(
            UIApplication.shared,
            didFinishLaunchingWithOptions: nil
        )
        // Mirror RN's `Settings.setAutoLogAppEventsEnabled(false)` — we only
        // want the explicit events we send (CompleteRegistration, Subscribe,
        // fb_mobile_purchase). RevenueCat handles server-side Meta CAPI.
        Settings.shared.isAutoLogAppEventsEnabled = false
        initialized = true
    }

    /// SwiftUI `.onOpenURL` handler. Returns `true` when the Meta SDK consumed
    /// the URL (e.g. Facebook app-switch / ad-network callback) so the caller
    /// can short-circuit downstream deep-link routing.
    @discardableResult
    public func handleAppDelegate(url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        guard initialized else { return false }
        return ApplicationDelegate.shared.application(
            UIApplication.shared,
            open: url,
            options: options
        )
    }

    // MARK: - Attribution IDs

    /// FB anonymous ID — fed to RevenueCat as the `fb_anon_id` subscriber
    /// attribute so server-side Meta CAPI events can join back to the install.
    /// RN equivalent: `AppEventsLogger.getAnonymousID()` (see
    /// `wagerproof-mobile/services/revenuecat.ts` line 369).
    public func anonymousID() -> String? {
        guard initialized else { return nil }
        return AppEvents.shared.anonymousID
    }

    // MARK: - Event Tracking

    /// Fire `fb_mobile_complete_registration` after onboarding finishes.
    /// `method` is the sign-in mechanism (e.g. "google", "email").
    public func trackCompleteRegistration(method: String) {
        guard initialized else { return }
        AppEvents.shared.logEvent(
            .completedRegistration,
            parameters: [
                .registrationMethod: method,
                AppEvents.ParameterName(rawValue: "fb_content_name"): "WagerProof Onboarding",
                AppEvents.ParameterName(rawValue: "fb_success"): "1",
            ]
        )
    }

    /// Fire `fb_mobile_purchase` for trial starts — matches the RN RevenueCat
    /// → Meta event mapping where trials map to Purchased.
    public func trackPurchase(amount: Decimal, currency: String, parameters: [String: Any] = [:]) {
        guard initialized else { return }
        // FB SDK's `logPurchase` is bridged from ObjC and takes a `Double`
        // amount. Funnel through NSDecimalNumber so we never lose precision
        // until the final bridge — call sites can keep using Decimal.
        let nsd = NSDecimalNumber(decimal: amount)
        let typed = mapParameters(parameters)
        AppEvents.shared.logPurchase(
            amount: nsd.doubleValue,
            currency: currency,
            parameters: typed
        )
    }

    /// Fire `Subscribe` for the initial paid subscription. Uses
    /// `valueToSum` so Meta's revenue dashboards roll the amount up correctly.
    public func trackSubscribe(amount: Decimal, currency: String, parameters: [String: Any] = [:]) {
        guard initialized else { return }
        let nsd = NSDecimalNumber(decimal: amount)
        var typed = mapParameters(parameters)
        // Meta expects the currency under the standard parameter name so the
        // event resolves to the right currency bucket in Ads Manager.
        typed[AppEvents.ParameterName(rawValue: "fb_currency")] = currency
        AppEvents.shared.logEvent(
            .subscribe,
            valueToSum: nsd.doubleValue,
            parameters: typed
        )
    }

    /// Force-flush queued events. Useful after a paywall conversion when we
    /// want Meta to see the event before the user backgrounds the app.
    public func flush() {
        guard initialized else { return }
        AppEvents.shared.flush()
    }

    // MARK: - Helpers

    /// Bridge a loose `[String: Any]` parameter bag to FB SDK's typed
    /// `[AppEvents.ParameterName: Any]` so call sites can stay RN-shaped
    /// (string keys) without leaking SDK types into the rest of the app.
    private func mapParameters(_ parameters: [String: Any]) -> [AppEvents.ParameterName: Any] {
        var out: [AppEvents.ParameterName: Any] = [:]
        for (key, value) in parameters {
            out[AppEvents.ParameterName(rawValue: key)] = value
        }
        return out
    }
}
