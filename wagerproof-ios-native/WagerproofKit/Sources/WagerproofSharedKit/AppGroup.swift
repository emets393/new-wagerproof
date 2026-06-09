import Foundation

public enum AppGroup {
    public static let identifier = "group.com.wagerproof.mobile"

    public static var defaults: UserDefaults {
        guard let d = UserDefaults(suiteName: identifier) else {
            // Fall back to standard defaults if the app group isn't configured —
            // this lets unit tests run without the entitlement. In production
            // the entitlement is always present (declared in Wagerproof.entitlements).
            return .standard
        }
        return d
    }
}

public enum AppGroupKey {
    public static let lastNotificationRoute = "last_notification_route"
    public static let themePreference = "theme_pref"
    public static let adminModeEnabled = "admin_mode_enabled"
    public static let widgetPayload = "widget_payload_v1"
    /// DEBUG-only: when true, stores serve bundled real-data fixtures instead
    /// of hitting Supabase (offseason UI development). See `DummyDataMode`.
    public static let dummyDataMode = "dummy_data_mode_debug"
    // B08: coarse-grained subscription snapshot consumed by widgets + cold
    // launch UI so they don't flash a "free" state while RevenueCat reconciles
    // on the network. Source of truth remains RevenueCat; this is a mirror.
    public static let proEntitlementGranted = "pro_entitlement_granted_v1"
    public static let proSubscriptionType = "pro_subscription_type_v1"
    public static let wagerbotSuggestionsEnabled = "wagerbot_suggestions_enabled_v1"
    /// DEBUG-only: selected WagerBot chat model id (see `WagerBotModelSelection`).
    /// Non-default values route the chat to the parallel `wagerbot-agent` function.
    public static let wagerBotChatModel = "wagerbot_chat_model_debug"

    /// Per-user onboarding completion key. Matches RN's
    /// `@wagerproof/onboarding-completed/{userId}` AsyncStorage key. The
    /// previous global `onboarding_complete` key leaked completion state
    /// across user switches on shared devices, AND a fresh install on a
    /// new device with an already-onboarded profile would replay the flow
    /// because no Supabase round-trip was reading the server flag.
    public static func onboardingComplete(userId: String) -> String {
        "onboarding_complete/\(userId)"
    }
}
