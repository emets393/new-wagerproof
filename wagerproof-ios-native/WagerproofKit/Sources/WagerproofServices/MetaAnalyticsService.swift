import AppTrackingTransparency
import Foundation
import UIKit
import FBSDKCoreKit

/// Advertising events and identity are sent only while ATT is authorized.
/// Automatic SDK logging stays disabled so a later Settings revocation cannot
/// leave background lifecycle observers sending events without consent.
public final class MetaAnalyticsService: @unchecked Sendable {
    public static let shared = MetaAnalyticsService()

    private var initialized = false

    /// Guards `fb_mobile_complete_registration` to once per install. Onboarding
    /// completion can be re-entered (Reset Onboarding in Secret Settings, a
    /// re-signup on the same device), and a duplicate registration event skews
    /// Meta's cost-per-registration reporting.
    private static let registrationFiredKey = "meta.completeRegistrationFired"

    private init() {}

    // MARK: - Lifecycle

    public func initialize() {
        updateTrackingAuthorization()
    }

    public func updateTrackingAuthorization() {
        Settings.shared.isAutoLogAppEventsEnabled = false
        let authorized = ATTrackingManager.trackingAuthorizationStatus == .authorized
        Settings.shared.isAdvertiserIDCollectionEnabled = authorized
        guard authorized else {
            clearUser()
            return
        }
        guard !initialized else { return }
        ApplicationDelegate.shared.application(
            UIApplication.shared,
            didFinishLaunchingWithOptions: nil
        )
        Settings.shared.setDataProcessingOptions([])
        initialized = true
        AppEvents.shared.activateApp()
    }

    private var canTrack: Bool {
        initialized && ATTrackingManager.trackingAuthorizationStatus == .authorized
    }

    /// SwiftUI `.onOpenURL` handler. Returns `true` when the Meta SDK consumed
    /// the URL (e.g. Facebook app-switch / ad-network callback) so the caller
    /// can short-circuit downstream deep-link routing.
    @discardableResult
    public func handleAppDelegate(url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        guard canTrack else { return false }
        return ApplicationDelegate.shared.application(
            UIApplication.shared,
            open: url,
            options: options
        )
    }

    // MARK: - Attribution IDs

    /// FB anonymous ID — fed to RevenueCat as the `fb_anon_id` subscriber
    /// attribute so server-side Meta CAPI events can join back to the install.
    /// Consumed by `RevenueCatService.bootstrap`.
    public func anonymousID() -> String? {
        guard canTrack else { return nil }
        return AppEvents.shared.anonymousID
    }

    // MARK: - Identity

    /// Associate advertising events only after tracking authorization.
    public func setUserID(_ userID: String) {
        guard canTrack else { return }
        AppEvents.shared.userID = userID
    }

    /// Facebook **Advanced Matching** — attach the user's PII to the Meta SDK so
    /// it rides on every event it sends. The SDK SHA-256-hashes each field
    /// on-device before upload; raw PII never leaves the phone.
    ///
    /// **Replaces, does not merge.** The FB SDK rebuilds its whole hashed
    /// user-data set from exactly the fields passed here — anything left `nil` is
    /// dropped, not preserved. Call it with the complete profile from a single
    /// source of truth, never with a partial set from a second call site.
    public func setAdvancedMatching(
        email: String?,
        displayName: String?,
        firstName: String? = nil,
        lastName: String? = nil,
        phoneNumber: String? = nil
    ) {
        guard canTrack else { return }
        let splitName = Self.splitDisplayName(displayName)
        AppEvents.shared.setUser(
            email: email,
            firstName: Self.nonEmpty(firstName) ?? splitName.0,
            lastName: Self.nonEmpty(lastName) ?? splitName.1,
            phone: phoneNumber,
            dateOfBirth: nil,
            gender: nil,
            city: nil,
            state: nil,
            zip: nil,
            country: nil
        )
    }

    /// Drop the previous user's hashed PII + external ID on sign-out so events
    /// from the next (anonymous or different) user aren't matched to the account
    /// that just left.
    public func clearUser() {
        guard initialized else { return }
        AppEvents.shared.clearUserData()
        AppEvents.shared.userID = nil
        // Release the registration guard as well. It's a per-install flag, so
        // without this a second person signing up on the same device (shared
        // phone, QA handset, a returning user creating a new account) would
        // never report a registration to Meta.
        UserDefaults.standard.removeObject(forKey: Self.registrationFiredKey)
    }

    // MARK: - Event Tracking

    /// Fire `fb_mobile_complete_registration` after onboarding finishes.
    /// `method` is the sign-in mechanism ("google", "apple", "email").
    /// No-ops if it already fired on this install — see `registrationFiredKey`.
    public func trackCompleteRegistration(method: String) {
        guard canTrack else { return }
        guard !UserDefaults.standard.bool(forKey: Self.registrationFiredKey) else { return }
        UserDefaults.standard.set(true, forKey: Self.registrationFiredKey)

        AppEvents.shared.logEvent(
            .completedRegistration,
            parameters: [
                .registrationMethod: method,
                AppEvents.ParameterName(rawValue: "fb_content_name"): "WagerProof Onboarding",
                AppEvents.ParameterName(rawValue: "fb_success"): "1",
            ]
        )
        // Flush so registration lands even if the user immediately backgrounds —
        // the SDK's default batch interval is a full minute.
        AppEvents.shared.flush()
    }

    /// Fire `fb_mobile_content_view` on paywall impression. `amount` is the
    /// highlighted package's price so Meta's value optimization gets a dollar
    /// signal ahead of any purchase.
    ///
    /// Deliberately does NOT flush: paywall views vastly outnumber conversions,
    /// and the flush on the checkout/subscribe events that follow carries these
    /// along anyway. Flushing per-impression burns radio for no attribution gain.
    public func trackPaywallView(
        placement: String,
        productId: String?,
        amount: Decimal?,
        currency: String
    ) {
        guard canTrack else { return }
        let value = amount.map { NSDecimalNumber(decimal: $0).doubleValue } ?? 0
        AppEvents.shared.logEvent(
            .viewedContent,
            valueToSum: value,
            parameters: [
                AppEvents.ParameterName(rawValue: "fb_content_type"): "paywall",
                AppEvents.ParameterName(rawValue: "fb_content_id"): placement,
                AppEvents.ParameterName(rawValue: "fb_content_name"): "WagerProof Pro",
                AppEvents.ParameterName(rawValue: "fb_currency"): currency,
                AppEvents.ParameterName(rawValue: "wp_source"): placement,
                AppEvents.ParameterName(rawValue: "wp_product_id"): productId ?? "unknown",
            ]
        )
    }

    /// Fire `fb_mobile_initiated_checkout` when the purchase button is tapped.
    /// Runs before StoreKit resolves, so Meta sees checkout intent even when the
    /// Apple payment sheet is abandoned — which is the entire point of the event,
    /// hence the immediate flush (an abandoning user may force-quit).
    public func trackInitiateCheckout(
        source: String,
        productId: String,
        amount: Decimal,
        currency: String
    ) {
        guard canTrack else { return }
        AppEvents.shared.logEvent(
            .initiatedCheckout,
            valueToSum: NSDecimalNumber(decimal: amount).doubleValue,
            parameters: [
                AppEvents.ParameterName(rawValue: "fb_content_type"): "subscription",
                AppEvents.ParameterName(rawValue: "fb_content_id"): productId,
                AppEvents.ParameterName(rawValue: "fb_content_name"): "WagerProof Pro",
                AppEvents.ParameterName(rawValue: "fb_currency"): currency,
                AppEvents.ParameterName(rawValue: "fb_num_items"): 1,
                AppEvents.ParameterName(rawValue: "wp_source"): source,
                AppEvents.ParameterName(rawValue: "wp_product_id"): productId,
            ]
        )
        AppEvents.shared.flush()
    }

    /// Fire `StartTrial` when a free trial begins.
    ///
    /// This used to send `fb_mobile_purchase` (inherited from the RN app), which
    /// meant a trial start and a paid conversion landed in two different Meta
    /// standard events depending on platform — web/CAPI already sent
    /// `StartTrial`. Normalized so all four surfaces report the same event and
    /// Ads Manager columns roll up correctly.
    public func trackStartTrial(amount: Decimal, currency: String, parameters: [String: Any] = [:]) {
        guard canTrack else { return }
        // FB SDK's value bridge takes a Double. Funnel through NSDecimalNumber so
        // we don't lose precision before the final conversion.
        let nsd = NSDecimalNumber(decimal: amount)
        var typed = mapParameters(parameters)
        typed[AppEvents.ParameterName(rawValue: "fb_currency")] = currency
        // Typed SDK member, not a raw string: Meta is inconsistent about casing
        // (`fb_mobile_purchase` is snake_case but `StartTrial`/`Subscribe` are
        // PascalCase). A wrong literal silently lands as a CUSTOM event that
        // Meta never matches to the standard one, so campaign optimization and
        // reporting quietly miss it. The typed member is compiler-checked.
        AppEvents.shared.logEvent(
            .startTrial,
            valueToSum: nsd.doubleValue,
            parameters: typed
        )
    }

    /// Fire `Subscribe` for the initial paid subscription. Uses
    /// `valueToSum` so Meta's revenue dashboards roll the amount up correctly.
    public func trackSubscribe(amount: Decimal, currency: String, parameters: [String: Any] = [:]) {
        guard canTrack else { return }
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

    /// Route a closed sale to the right Meta event. Kept here (rather than at
    /// each call site) so the trial-vs-paid mapping has exactly one definition —
    /// getting it wrong silently splits a campaign's conversions across two
    /// events.
    ///
    /// Trials → `StartTrial`, paid first subs → `Subscribe`. This mapping is
    /// shared by iOS, Android, the web pixel, and the server-side Conversions
    /// API; see `.claude/docs/18_meta_attribution.md`.
    public func trackConversionEvent(
        isTrial: Bool,
        amount: Decimal,
        currency: String,
        parameters: [String: Any]
    ) {
        if isTrial {
            trackStartTrial(amount: amount, currency: currency, parameters: parameters)
        } else {
            trackSubscribe(amount: amount, currency: currency, parameters: parameters)
        }
    }

    /// Force-flush queued events. Useful after a paywall conversion when we
    /// want Meta to see the event before the user backgrounds the app.
    public func flush() {
        guard canTrack else { return }
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

    /// Split a display name into `(first, last)` — Meta hashes the two fields
    /// separately. Returns `(nil, nil)` for a blank name so we never hash empties.
    private static func splitDisplayName(_ displayName: String?) -> (String?, String?) {
        guard let displayName else { return (nil, nil) }
        let parts = displayName.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard let first = parts.first else { return (nil, nil) }
        let last = parts.count > 1 ? parts.dropFirst().joined(separator: " ") : nil
        return (first, last)
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }
        return value
    }
}
