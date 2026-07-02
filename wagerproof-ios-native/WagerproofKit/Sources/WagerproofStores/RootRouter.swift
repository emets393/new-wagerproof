import Foundation
import Observation
import WagerproofSharedKit

/// Top-level router that drives the root view's phase switch
/// (launching / auth / onboarding / main app). Mirrors RN's
/// `RootNavigator` + `OnboardingGuard` double-check in `app/_layout.tsx`.
@Observable
@MainActor
public final class RootRouter {
    public enum Phase: Equatable {
        case launching
        case unauthenticated
        case onboarding
        case ready
    }

    /// TEMPORARY: hard-bypasses the onboarding wizard so authenticated users
    /// land straight in the app. Added 2026-05-29 to unblock a creator who was
    /// stuck on an onboarding screen during testing. Flip back to `false` (or
    /// delete this flag and restore the plain ternary in `resolve`) to
    /// re-enable onboarding.
    public static let temporarilyDisableOnboarding = true

    /// Set by Secret Settings' "Reset Onboarding" so testers can re-enter the
    /// wizard even while `temporarilyDisableOnboarding` is active. In-memory
    /// only — cleared when onboarding completes; a relaunch falls back to the
    /// bypass, so this can never leak the wizard to real users.
    public private(set) var forceOnboardingForTesting = false

    public private(set) var phase: Phase = .launching

    /// The deep-link path captured before auth resolved. After auth completes,
    /// the root view replays it via `consumePendingDeepLink()`.
    public private(set) var pendingDeepLinkRoute: DeepLinkRoute?

    public init() {}

    public func resolve(authPhase: AuthStore.Phase, onboardingComplete: Bool) {
        switch authPhase {
        case .launching:
            phase = .launching
        case .unauthenticated:
            // Sign-out ends a forced test run — the next account shouldn't
            // inherit the wizard override.
            forceOnboardingForTesting = false
            phase = .unauthenticated
        case .authenticated:
            // Completing the wizard ends a forced test run so subsequent
            // resolves fall back to normal (bypassed) routing.
            if onboardingComplete { forceOnboardingForTesting = false }
            // TEMPORARY onboarding bypass — see `temporarilyDisableOnboarding`.
            // The bypass yields to `forceOnboardingForTesting` so the Secret
            // Settings reset can still run the wizard end-to-end.
            let bypass = Self.temporarilyDisableOnboarding && !forceOnboardingForTesting
            phase = (onboardingComplete || bypass) ? .ready : .onboarding
        }
    }

    /// Debug affordance backing Secret Settings' "Reset Onboarding": flips the
    /// router straight into `.onboarding`, overriding the temporary bypass.
    /// Callers must reset `OnboardingStore` first so the wizard starts at
    /// step 1 with a clean draft.
    public func forceOnboardingForTestingNow() {
        forceOnboardingForTesting = true
        phase = .onboarding
    }

    public func handle(deepLink url: URL) {
        guard let route = DeepLinkRoute(url: url) else { return }
        switch phase {
        case .ready:
            pendingDeepLinkRoute = route
        default:
            // Queue until auth resolves.
            pendingDeepLinkRoute = route
        }
    }

    /// Read+clear. Called by the root view's onChange(of: phase) handler once
    /// `.ready` is reached.
    public func consumePendingDeepLink() -> DeepLinkRoute? {
        defer { pendingDeepLinkRoute = nil }
        return pendingDeepLinkRoute
    }
}

/// Mirrors the deep-link map in `app/(drawer)/_layout.tsx`.
public enum DeepLinkRoute: Equatable, Sendable {
    case agents
    case outliers
    case feed
    case resetPassword

    public init?(url: URL) {
        guard url.scheme == "wagerproof" else { return nil }
        let host = url.host ?? url.pathComponents.dropFirst().first
        switch host {
        case "agents": self = .agents
        case "outliers": self = .outliers
        case "feed": self = .feed
        case "reset-password": self = .resetPassword
        default: self = .feed   // matches RN's default
        }
    }
}
