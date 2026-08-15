import UIKit
import UserNotifications
import WagerproofServices
import WagerproofStores

/// Captures the APNs device token and notification taps. SwiftUI's `@main`
/// `App` never receives `didRegisterForRemoteNotificationsWithDeviceToken`,
/// so without this adaptor `NotificationService.cachedDeviceToken` stays nil
/// and Secret Settings shows `<none>`.
///
/// Created by `@UIApplicationDelegateAdaptor` *before* `WagerproofApp.init()`,
/// so `didFinishLaunching` must not touch stores.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    /// Buffered until `WagerproofApp` attaches a handler. Cold-start taps can
    /// arrive in `didReceive` before the SwiftUI scene exists. Do not
    /// `UIApplication.open` the URL — Meta / GoogleSignIn claim `.onOpenURL`
    /// first, so a synthetic open would never reach `RootRouter`.
    static var pendingPushURL: URL?
    static var onPushURL: ((URL) -> Void)?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                await MainActor.run {
                    application.registerForRemoteNotifications()
                }
            default:
                break
            }
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        NotificationService.shared.setDeviceToken(hex)
        Task {
            let client = await MainSupabase.shared.client
            guard let userId = client.auth.currentSession?.user.id else { return }
            await NotificationService.shared.registerPushToken(userId: userId)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Simulator always fails — expected. Device failures surface in Secret Settings.
        NotificationService.shared.recordRegistrationFailure(error.localizedDescription)
        print("[push] didFailToRegister: \(error.localizedDescription)")
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound, .badge]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
        let userInfo = response.notification.request.content.userInfo
        let raw = (userInfo["route"] as? String) ?? "feed"
        guard let route = DeepLinkRoute(pushRoute: raw) else { return }
        deliverPushURL(route.url)
    }

    private func deliverPushURL(_ url: URL) {
        if let handler = Self.onPushURL {
            handler(url)
        } else {
            Self.pendingPushURL = url
        }
    }
}
