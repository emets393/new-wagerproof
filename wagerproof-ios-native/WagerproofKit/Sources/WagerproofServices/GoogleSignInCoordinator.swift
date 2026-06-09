// GoogleSignInCoordinator.swift
//
// Wraps GIDSignIn so AuthStore can stay UIKit-free.
//
// Mirrors the RN flow in `wagerproof-mobile/contexts/AuthContext.tsx` —
// the iOS client ID is the same one used in the RN app's
// `app.json` GoogleSignIn plugin and AuthContext.configureGoogleSignIn().
//
// Returns the Google idToken so AuthStore can call
// `supabase.auth.signInWithIdToken(provider: .google, idToken:)` —
// byte-identical to the RN payload.

#if canImport(GoogleSignIn) && canImport(UIKit)
import Foundation
import UIKit
import GoogleSignIn

@MainActor
public final class GoogleSignInCoordinator {
    public typealias Tokens = (idToken: String, accessToken: String)

    /// iOS client ID — must match the value in
    /// wagerproof-mobile/contexts/AuthContext.tsx so users with both apps
    /// installed see the same Google account picker behaviour.
    private static let iosClientId =
        "142325632215-agrfdkh87j01kgfa4uv4opuohl5l01lq.apps.googleusercontent.com"

    private static var configured = false

    public init() {}

    /// Call once at app launch (or lazily before signIn). Idempotent.
    public static func configureIfNeeded() {
        guard !configured else { return }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: iosClientId
        )
        configured = true
    }

    /// Run the GIDSignIn flow, presenting from `viewController`. Suspends
    /// until the user completes (or cancels) the Google browser sheet.
    public func signIn(presenting viewController: UIViewController) async throws -> Tokens {
        Self.configureIfNeeded()

        // Clear any cached account so the picker is shown — matches the
        // explicit `GoogleSignin.signOut()` the RN code performs before
        // each sign-in attempt.
        GIDSignIn.sharedInstance.signOut()

        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: viewController)

        guard let idToken = result.user.idToken?.tokenString else {
            throw GoogleSignInError.missingIDToken
        }

        return (idToken: idToken, accessToken: result.user.accessToken.tokenString)
    }
}

public enum GoogleSignInError: LocalizedError {
    case missingIDToken
    case cancelled
    case presenterUnavailable

    public var errorDescription: String? {
        switch self {
        case .missingIDToken:
            return "Google sign-in did not return an idToken."
        case .cancelled:
            return "User cancelled sign-in"
        case .presenterUnavailable:
            return "Could not present Google sign-in."
        }
    }
}

#endif
