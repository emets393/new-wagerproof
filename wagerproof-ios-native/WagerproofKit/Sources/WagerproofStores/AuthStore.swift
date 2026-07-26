import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices
import WagerproofSharedKit

#if canImport(UIKit)
import UIKit
#endif

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

/// `AuthStore` mirrors the RN `contexts/AuthContext.tsx`. It owns the auth
/// lifecycle, the active `Profile`, and forwards sign-in / sign-up / reset
/// flows to the Supabase Auth client.
///
/// The store subscribes to `MainSupabase.shared.client.auth.authStateChanges`
/// via Swift Concurrency: a `Task` consumes the async sequence and updates
/// observable properties on the main actor.
@Observable
@MainActor
public final class AuthStore {
    public enum Phase: Equatable {
        case launching
        case unauthenticated
        case authenticated(userId: UUID)
    }

    public private(set) var phase: Phase = .launching
    public private(set) var profile: Profile?
    public private(set) var lastError: String?

    /// Monotonic counter used by views to drive `.sensoryFeedback(.success, …)`
    /// without needing access to the underlying session value.
    public private(set) var lastSuccessAt: Date?

    private var listenerTask: Task<Void, Never>?

    /// Which user we last pushed to the analytics/attribution SDKs. Guards
    /// against re-identifying on every hourly `.tokenRefreshed` event.
    private var lastIdentifiedUserId: String?

    /// Last auth provider Supabase reported ("email", "google", "apple").
    /// Persisted because onboarding can complete in a later app session than the
    /// sign-in that created the account, and Meta's CompleteRegistration wants
    /// the real registration method.
    static let lastAuthProviderKey = "auth.lastProvider"

    /// The provider the current user authenticated with, defaulting to "email"
    /// (the only method that existed before social sign-in shipped).
    public static var lastAuthProvider: String {
        UserDefaults.standard.string(forKey: lastAuthProviderKey) ?? "email"
    }

    public init() {}

    /// Begin listening for auth changes. Idempotent.
    public func start() {
        guard listenerTask == nil else { return }
        listenerTask = Task { [weak self] in
            guard let self else { return }
            let client = await MainSupabase.shared.client
            for await (event, session) in client.auth.authStateChanges {
                await self.handle(event: event, session: session)
            }
        }
    }

    public func stop() {
        listenerTask?.cancel()
        listenerTask = nil
    }

    public func clearError() {
        lastError = nil
    }

    // MARK: - Mutators

    public func signIn(email: String, password: String) async {
        do {
            let client = await MainSupabase.shared.client
            _ = try await client.auth.signIn(email: email, password: password)
            lastError = nil
            lastSuccessAt = Date()
        } catch {
            lastError = Self.message(from: error)
        }
    }

    public func signUp(email: String, password: String) async {
        do {
            let client = await MainSupabase.shared.client
            // Mirrors RN: `wagerproof://` as `emailRedirectTo`.
            let redirect = URL(string: "wagerproof://")
            _ = try await client.auth.signUp(
                email: email,
                password: password,
                redirectTo: redirect
            )
            lastError = nil
            lastSuccessAt = Date()
        } catch {
            lastError = Self.message(from: error)
        }
    }

    public func signOut() async {
        do {
            let client = await MainSupabase.shared.client
            try await client.auth.signOut()
            phase = .unauthenticated
            profile = nil
        } catch {
            lastError = Self.message(from: error)
        }
    }

    public func sendPasswordReset(email: String) async {
        do {
            let client = await MainSupabase.shared.client
            // RN passes `wagerproof://reset-password` — preserve byte-for-byte.
            let redirect = URL(string: "wagerproof://reset-password")
            try await client.auth.resetPasswordForEmail(email, redirectTo: redirect)
            lastError = nil
            lastSuccessAt = Date()
        } catch {
            lastError = Self.message(from: error)
        }
    }

    /// Apple Sign-In handoff. The view performs the `ASAuthorizationController`
    /// dance natively and passes us the resulting identity token. We trade it
    /// to Supabase via `signInWithIdToken(provider: .apple, …)` — same call
    /// the RN app makes after `expo-apple-authentication`.
    public func signInWithApple(idToken: String, nonce: String?) async {
        do {
            let client = await MainSupabase.shared.client
            _ = try await client.auth.signInWithIdToken(
                credentials: .init(
                    provider: .apple,
                    idToken: idToken,
                    nonce: nonce
                )
            )
            lastError = nil
            lastSuccessAt = Date()
        } catch {
            lastError = Self.message(from: error)
        }
    }

    /// Google Sign-In handoff. Presents the GIDSignIn flow from the current
    /// key window (because UIKit requires a presenter). Trades the resulting
    /// idToken for a Supabase session via `signInWithIdToken(provider: .google, …)`.
    public func signInWithGoogle() async {
        #if canImport(GoogleSignIn) && canImport(UIKit)
        guard let presenter = Self.topViewController() else {
            lastError = GoogleSignInError.presenterUnavailable.errorDescription
            return
        }
        do {
            let coordinator = GoogleSignInCoordinator()
            let tokens = try await coordinator.signIn(presenting: presenter)
            let client = await MainSupabase.shared.client
            _ = try await client.auth.signInWithIdToken(
                credentials: .init(
                    provider: .google,
                    idToken: tokens.idToken,
                    accessToken: tokens.accessToken
                )
            )
            lastError = nil
            lastSuccessAt = Date()
        } catch {
            // Silently swallow user-cancelled errors (matches RN's
            // `SIGN_IN_CANCELLED` short-circuit). Prefer the typed error code
            // over a fragile localized-string match.
            if (error as? GIDSignInError)?.code == .canceled { return }
            lastError = Self.message(from: error)
        }
        #else
        lastError = "Google sign-in is not available in this build."
        #endif
    }

    // MARK: -

    private func handle(event: AuthChangeEvent, session: Session?) async {
        switch event {
        case .signedIn, .tokenRefreshed, .userUpdated, .initialSession:
            if let userId = session?.user.id {
                phase = .authenticated(userId: userId)
                await loadProfile(userId: userId)
                // Remember how they authenticated so onboarding's Meta
                // CompleteRegistration can report the real method instead of
                // always claiming "email".
                if let provider = session?.user.appMetadata["provider"]?.stringValue {
                    UserDefaults.standard.set(provider, forKey: Self.lastAuthProviderKey)
                }
                identifyForAnalytics(userId: userId, email: session?.user.email)
            } else if phase == .launching {
                phase = .unauthenticated
            }
        case .signedOut:
            phase = .unauthenticated
            profile = nil
            // Drop the departing user's hashed PII and external ID so the next
            // (anonymous or different) user's events aren't matched to them.
            MetaAnalyticsService.shared.clearUser()
            AnalyticsService.shared.reset()
            // Clear the identify guard too, or signing back in on the same
            // device would skip re-identification entirely.
            lastIdentifiedUserId = nil
        case .passwordRecovery, .userDeleted, .mfaChallengeVerified:
            break
        @unknown default:
            break
        }
    }

    /// Bind the signed-in user to every analytics/attribution SDK.
    ///
    /// Meta Advanced Matching is the single biggest match-rate lever on iOS:
    /// when a user declines ATT there is no IDFA, so device-graph matching
    /// fails and hashed email/name is the only way Meta can still attribute the
    /// conversion. Called after `loadProfile` so the profile's display name is
    /// available — `setAdvancedMatching` REPLACES the whole hashed set rather
    /// than merging, so this must be the one and only call site.
    private func identifyForAnalytics(userId: UUID, email: String?) {
        // Lowercased to match RevenueCat / web / Android, which all key on the
        // lowercase Supabase uuid.
        let id = userId.uuidString.lowercased()
        // `.tokenRefreshed` fires roughly hourly for the life of the app. Without
        // this guard every refresh would re-hash the user's PII for Meta and
        // re-run RevenueCat's device-identifier collection for no new information.
        guard id != lastIdentifiedUserId else { return }
        lastIdentifiedUserId = id
        let resolvedEmail = profile?.email ?? email
        let displayName = profile?.displayName ?? profile?.username

        AnalyticsService.shared.identify(userId: id)
        MetaAnalyticsService.shared.setUserID(id)
        MetaAnalyticsService.shared.setAdvancedMatching(
            email: resolvedEmail,
            displayName: displayName
        )
        RevenueCatService.shared.setSubscriberIdentity(
            email: resolvedEmail,
            displayName: displayName
        )
    }

    private func loadProfile(userId: UUID) async {
        do {
            let client = await MainSupabase.shared.client
            let row: Profile = try await client
                .from("profiles")
                .select()
                .eq("id", value: userId)
                .single()
                .execute()
                .value
            self.profile = row
        } catch {
            // Don't surface this — the profile may not exist yet for new sign-ups.
            // The onboarding flow is responsible for first-time profile creation.
        }
    }

    // MARK: - DEBUG

    #if DEBUG
    /// Stage a deterministic auth phase + profile for the screenshot harness.
    /// Never invoked in production code paths — gated behind `#if DEBUG` so
    /// release builds can't accidentally bypass the Supabase auth lifecycle.
    public func debugSet(phase: Phase, profile: Profile? = nil) {
        self.phase = phase
        self.profile = profile
    }
    #endif

    /// Extract a user-readable message. Supabase auth errors include a `message`
    /// field; we lean on `localizedDescription` which surfaces it.
    private static func message(from error: Error) -> String {
        let raw = error.localizedDescription
        return raw.isEmpty ? "An unexpected error occurred. Please try again." : raw
    }

    #if canImport(UIKit)
    /// Walk up to the topmost presented view controller — needed because
    /// GIDSignIn must be presented from a UIKit VC, but we live in SwiftUI.
    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
            ?? scenes.first as? UIWindowScene
        guard let window = windowScene?.windows.first(where: { $0.isKeyWindow })
                ?? windowScene?.windows.first,
              var top = window.rootViewController else {
            return nil
        }
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
    #endif
}
