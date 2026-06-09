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
            } else if phase == .launching {
                phase = .unauthenticated
            }
        case .signedOut:
            phase = .unauthenticated
            profile = nil
        case .passwordRecovery, .userDeleted, .mfaChallengeVerified:
            break
        @unknown default:
            break
        }
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
