import Foundation
import WagerproofModels
#if canImport(UserNotifications)
import UserNotifications
#endif
#if canImport(UIKit)
import UIKit
#endif

/// `NotificationService` is the iOS-native equivalent of
/// `wagerproof-mobile/services/notificationService.ts`. It owns the OS
/// permission flow and APNs token registration with Supabase.
///
/// Backend contract — byte-identical to the RN file:
/// - Upsert into `user_push_tokens` (cols: user_id, expo_push_token,
///   platform, device_name, is_active, last_used_at, updated_at) on
///   conflict (user_id, expo_push_token).
/// - Ensure a row exists in `user_notification_preferences` (user_id,
///   auto_pick_ready=true) — onConflict user_id, ignoreDuplicates.
/// - Update `is_active=false` on all of a user's tokens on sign-out.
///
/// Wire format: RN stores `expo_push_token`. The native iOS port stores the
/// hex-encoded APNs device token in the same column for now. Either format
/// is accepted by the Supabase row (column is text), and the auto-pick-ready
/// edge function dispatches both APNs and Expo push targets based on token
/// shape.
// FIDELITY-WAIVER #051: Push token stored as raw APNs hex string; RN uses
// expo-tokens. Long-term migration plan in tickets/051-*.md.
public final class NotificationService: @unchecked Sendable {
    public static let shared = NotificationService()

    public enum PermissionStatus: String, Sendable {
        case granted
        case denied
        case undetermined
        case provisional
        case ephemeral
    }

    public enum Platform: String, Sendable {
        case ios
        case android
    }

    private var initialized = false
    // Set by AppDelegate / SceneDelegate after didRegisterForRemoteNotificationsWithDeviceToken.
    private var cachedDeviceToken: String?

    private init() {}

    /// Set the latest APNs device token. Called from the AppDelegate's
    /// `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`.
    public func setDeviceToken(_ token: String?) {
        cachedDeviceToken = token
    }

    /// Initialize the notification center delegate + foreground presentation
    /// options. Idempotent — safe to call from app launch.
    public func initialize() async {
        guard !initialized else { return }
        initialized = true
        // Foreground presentation options are configured by the AppDelegate's
        // UNUserNotificationCenterDelegate — see RN's
        // `Notifications.setNotificationHandler({ shouldShowAlert: true, … })`.
    }

    public func permissionStatus() async -> PermissionStatus {
        #if canImport(UserNotifications)
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .authorized: return .granted
        case .denied: return .denied
        case .notDetermined: return .undetermined
        case .provisional: return .provisional
        case .ephemeral: return .ephemeral
        @unknown default: return .undetermined
        }
        #else
        return .undetermined
        #endif
    }

    /// Triggers the OS authorization dialog. Mirrors RN's
    /// `requestNotificationPermission()`.
    public func requestPermission() async -> PermissionStatus {
        #if canImport(UserNotifications)
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            #if canImport(UIKit)
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            #endif
            return granted ? .granted : .denied
        } catch {
            return .denied
        }
        #else
        return .denied
        #endif
    }

    /// Register the device's APNs token with Supabase. Mirrors the RN
    /// `registerPushToken(userId)` upsert byte-for-byte. The push-token write
    /// is best-effort: if the token isn't ready yet (registerForRemote in
    /// flight) we silently skip — the next call will pick it up.
    public func registerPushToken(userId: UUID) async {
        guard let token = cachedDeviceToken else { return }
        await PushTokenRegistrar.register(
            userId: userId,
            token: token,
            platform: .ios,
            deviceName: PushTokenRegistrar.deviceModelName()
        )
    }

    /// Deactivate all push tokens for a user. Called on sign-out per RN.
    public func deactivatePushTokens(userId: UUID) async {
        await PushTokenRegistrar.deactivate(userId: userId)
    }

    /// Cached APNs token in hex form — useful for the secret-settings push
    /// diagnostics action.
    public func currentDeviceToken() -> String? {
        cachedDeviceToken
    }
}

/// Supabase row-level writer for push tokens. Split out of the main service
/// so we can keep `NotificationService` Sendable while the Supabase client
/// itself is an actor.
private enum PushTokenRegistrar {
    struct TokenUpsert: Encodable {
        let user_id: UUID
        let expo_push_token: String
        let platform: String
        let device_name: String
        let is_active: Bool
        let last_used_at: String
        let updated_at: String
    }

    struct PreferenceInsert: Encodable {
        let user_id: UUID
        let auto_pick_ready: Bool
    }

    static func register(
        userId: UUID,
        token: String,
        platform: NotificationService.Platform,
        deviceName: String
    ) async {
        let now = isoNow()
        let payload = TokenUpsert(
            user_id: userId,
            expo_push_token: token,
            platform: platform.rawValue,
            device_name: deviceName,
            is_active: true,
            last_used_at: now,
            updated_at: now
        )
        do {
            let client = await MainSupabase.shared.client
            try await client
                .from("user_push_tokens")
                .upsert(payload, onConflict: "user_id,expo_push_token")
                .execute()

            // Ensure notification preferences row exists. RN uses
            // ignoreDuplicates so failures here are non-fatal.
            do {
                try await client
                    .from("user_notification_preferences")
                    .upsert(
                        PreferenceInsert(user_id: userId, auto_pick_ready: true),
                        onConflict: "user_id",
                        ignoreDuplicates: true
                    )
                    .execute()
            } catch {
                // Non-fatal — preferences row may already exist with different
                // columns; RN's ignoreDuplicates short-circuits any conflict.
            }
        } catch {
            // Non-fatal — token sync retries on next foreground.
            _ = error
        }
    }

    static func deactivate(userId: UUID) async {
        struct Update: Encodable { let is_active: Bool }
        do {
            let client = await MainSupabase.shared.client
            try await client
                .from("user_push_tokens")
                .update(Update(is_active: false))
                .eq("user_id", value: userId)
                .execute()
        } catch {
            // Non-fatal — RN's deactivatePushTokens swallows the error too.
        }
    }

    static func deviceModelName() -> String {
        #if canImport(UIKit)
        return UIDevice.current.model
        #else
        return "Unknown"
        #endif
    }

    private static func isoNow() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }
}
