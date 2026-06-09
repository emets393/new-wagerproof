import Foundation
import Observation
import WagerproofServices
import WagerproofSharedKit

/// `SettingsStore` mirrors `wagerproof-mobile/contexts/SettingsContext.tsx`
/// and the screen-local state inside `app/(drawer)/(tabs)/settings.tsx`.
///
/// The RN side keeps very little global state under SettingsContext (it was
/// emptied during a refactor) but the Settings screen itself owns:
///   - notification permission status (granted/denied/undetermined)
///   - WagerBot suggestions toggle (from WagerBotSuggestionContext)
///   - dark-mode toggle (from ThemeContext — owned by `ThemeStore` here)
///
/// We collect these into `SettingsStore` so the SettingsView can stay
/// declarative.
@Observable
@MainActor
public final class SettingsStore {
    public enum NotificationPermission: String, Sendable {
        case granted
        case denied
        case undetermined
        case provisional
        case ephemeral

        public init(_ status: NotificationService.PermissionStatus) {
            switch status {
            case .granted: self = .granted
            case .denied: self = .denied
            case .undetermined: self = .undetermined
            case .provisional: self = .provisional
            case .ephemeral: self = .ephemeral
            }
        }

        public var isEnabled: Bool {
            self == .granted || self == .provisional || self == .ephemeral
        }
    }

    public private(set) var notificationPermission: NotificationPermission = .undetermined
    public private(set) var isCheckingNotificationPermission: Bool = true

    /// WagerBot suggestion toggle. Persisted to App Group user defaults so
    /// the iOS widget / chat extension can read it.
    public var wagerBotSuggestionsEnabled: Bool {
        didSet {
            AppGroup.defaults.set(wagerBotSuggestionsEnabled, forKey: AppGroupKey.wagerbotSuggestionsEnabled)
        }
    }

    public init() {
        // RN default: suggestions enabled unless the user has explicitly
        // turned them off. Match by reading the App Group default; missing
        // value defaults to `true`.
        if AppGroup.defaults.object(forKey: AppGroupKey.wagerbotSuggestionsEnabled) == nil {
            self.wagerBotSuggestionsEnabled = true
            AppGroup.defaults.set(true, forKey: AppGroupKey.wagerbotSuggestionsEnabled)
        } else {
            self.wagerBotSuggestionsEnabled = AppGroup.defaults.bool(forKey: AppGroupKey.wagerbotSuggestionsEnabled)
        }
    }

    /// Refresh the notification permission cache. Called whenever the
    /// settings view appears so a user who changed the system setting
    /// outside the app sees the right toggle state on return.
    public func refreshNotificationPermission() async {
        isCheckingNotificationPermission = true
        let status = await NotificationService.shared.permissionStatus()
        notificationPermission = NotificationPermission(status)
        isCheckingNotificationPermission = false
    }

    /// User flipped the toggle ON. If permission is undetermined we ask,
    /// otherwise we just register the token. Returns the resulting permission
    /// state so the view can decide whether to surface a "denied — open
    /// Settings" alert.
    @discardableResult
    public func enableNotifications(userId: UUID?) async -> NotificationPermission {
        let current = await NotificationService.shared.permissionStatus()
        switch current {
        case .granted, .provisional, .ephemeral:
            notificationPermission = NotificationPermission(current)
            if let userId {
                await NotificationService.shared.registerPushToken(userId: userId)
            }
            return notificationPermission
        case .undetermined:
            let next = await NotificationService.shared.requestPermission()
            notificationPermission = NotificationPermission(next)
            if next == .granted, let userId {
                await NotificationService.shared.registerPushToken(userId: userId)
            }
            return notificationPermission
        case .denied:
            notificationPermission = .denied
            return .denied
        }
    }

    /// User flipped the toggle OFF — deactivate every push token row for
    /// this user. Matches RN's `deactivatePushTokens(user.id)` byte-for-byte.
    public func disableNotifications(userId: UUID?) async {
        notificationPermission = .denied
        if let userId {
            await NotificationService.shared.deactivatePushTokens(userId: userId)
        }
    }

    // MARK: - DEBUG

    #if DEBUG
    public func debugSet(
        notificationPermission: NotificationPermission,
        wagerBotSuggestionsEnabled: Bool
    ) {
        self.notificationPermission = notificationPermission
        self.wagerBotSuggestionsEnabled = wagerBotSuggestionsEnabled
        self.isCheckingNotificationPermission = false
    }
    #endif
}
