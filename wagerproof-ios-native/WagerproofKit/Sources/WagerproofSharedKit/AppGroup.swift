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
    /// Kept byte-for-byte compatible with the original RN widget bridge.
    /// Both the app and widget extension must use this exact key.
    public static let widgetPayload = "widgetPayload"
    /// DEBUG-only: when true, stores serve bundled real-data fixtures instead
    /// of hitting Supabase (offseason UI development). See `DummyDataMode`.
    public static let dummyDataMode = "dummy_data_mode_debug"
    // B08: coarse-grained subscription snapshot consumed by widgets + cold
    // launch UI so they don't flash a "free" state while RevenueCat reconciles
    // on the network. Source of truth remains RevenueCat; this is a mirror.
    public static let proEntitlementGranted = "pro_entitlement_granted_v1"
    public static let proSubscriptionType = "pro_subscription_type_v1"
    /// DEBUG-only: selected WagerBot chat model id (see `WagerBotModelSelection`).
    /// Non-default values route the chat to the parallel `wagerbot-agent` function.
    public static let wagerBotChatModel = "wagerbot_chat_model_debug"

    // Picks-expiry hold (`PicksExpiryService`). Persisted rather than held in
    // memory so the paywall pill and the Live Activity agree on one deadline
    // across relaunches — a countdown that restarts on cold launch reads as
    // fake and torches the urgency it exists to create.
    public static let picksExpiryStartedAt = "picks_expiry_started_at_v1"
    public static let picksExpiryPickCount = "picks_expiry_pick_count_v1"
    public static let picksExpiryAgentName = "picks_expiry_agent_name_v1"

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
