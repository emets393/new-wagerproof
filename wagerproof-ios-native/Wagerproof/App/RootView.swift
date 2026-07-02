import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Top-level phase switch. Mirrors RN `app/_layout.tsx`'s `RootNavigator`.
/// Auth branch → `AuthRouter`. Onboarding wizard → `OnboardingView`. Ready
/// → `MainTabView` plus a `PostOnboardingPaywall` `fullScreenCover` for
/// users who finished onboarding without an active Pro entitlement.
///
/// The user-dismissed-paywall state lives HERE (not inside the paywall
/// child) so the `fullScreenCover` host can observe it. If we kept the
/// `dismissed` flag local to `PostOnboardingPaywall`, tapping the
/// dashboard X or the skip fallback would flip the inner body to
/// EmptyView but leave the cover up — a blank black modal trap. Lifting
/// to RootView keeps the binding round-trip: paywall calls
/// `onUserDismissed()` → state flips → predicate → false → cover slides
/// away.
struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(RootRouter.self) private var router
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(RevenueCatStore.self) private var revenueCat

    /// Set to `true` when the user purchases / restores / explicitly
    /// dismisses the post-onboarding paywall. Reset whenever the user
    /// signs out so the next sign-in cycle re-presents (handled via
    /// `onChange(of: auth.phase)`).
    @State private var paywallDismissed: Bool = false

    private var shouldPresentPaywall: Bool {
        guard router.phase == .ready else { return false }
        // Hold the predicate at false until BOTH paths that grant Pro
        // access have resolved: RevenueCat's `attachUser` (live customer
        // info) AND `AdminModeStore.roleResolved` (admin row lookup).
        // `proAccess.isLoading` already composes both — using it here
        // catches the case the earlier `revenueCat.isLoading == false`
        // gate missed: when the user is an admin, RC reports
        // `entitlementStatus == .denied` and resolves fast, while the
        // admin row lookup hasn't finished yet. `proAccess.isPro` is
        // briefly false → predicate fired → paywall flashed → admin
        // role lands → flipped to true → paywall dismissed. Combined
        // with `hasResolvedActiveUserEntitlement` we cover both the
        // RC stale-cache window and the admin-resolution lag.
        guard revenueCat.hasResolvedActiveUserEntitlement else { return false }
        guard !proAccess.isLoading else { return false }
        if paywallDismissed { return false }
        return !proAccess.isPro
    }

    /// Two-way binding so SwiftUI's own swipe / cover-management can also
    /// drive the dismiss. Reads the predicate; writes flip `paywallDismissed`.
    private var paywallBinding: Binding<Bool> {
        Binding(
            get: { shouldPresentPaywall },
            set: { newValue in
                if !newValue { paywallDismissed = true }
            }
        )
    }

    var body: some View {
        Group {
            switch router.phase {
            case .launching:
                SplashView()
            case .unauthenticated:
                AuthRouter()
            case .onboarding:
                OnboardingView()
            case .ready:
                MainTabView()
                    .fullScreenCover(isPresented: paywallBinding) {
                        PostOnboardingPaywall(onUserDismissed: {
                            paywallDismissed = true
                        })
                            // Re-inject the environment — `fullScreenCover` in
                            // SwiftUI doesn't always propagate `@Observable`
                            // values through the new presentation host, so the
                            // paywall needs the same stores as the parent.
                            .environment(auth)
                            .environment(onboarding)
                            .environment(revenueCat)
                            .environment(proAccess)
                    }
            }
        }
        .animation(.appStandard, value: router.phase)
        .onChange(of: auth.phase) { _, newPhase in
            // Sign-out resets the dismiss flag so the next user (or the same
            // user signing back in without Pro) sees the paywall again.
            if case .unauthenticated = newPhase { paywallDismissed = false }
        }
    }
}

/// Branded launch surface — the cold-start screen the user sees while
/// `RootRouter` resolves auth phase + RevenueCat hydrates. Ports the shape
/// of Honeydew's `LaunchView` / `LoadingSpinnerView`: solid splash backdrop
/// with a centered branded glyph + animated wordmark above a thin gradient
/// progress bar driven by readiness signals. The background is the same
/// `#0F1117` the onboarding flow uses so the handoff to subsequent screens
/// reads as one continuous surface.
private struct SplashView: View {
    @Environment(RootRouter.self) private var router
    @Environment(AuthStore.self) private var auth
    @Environment(RevenueCatStore.self) private var revenueCat

    @State private var launchStart: Date = .init()
    @State private var elapsed: TimeInterval = 0

    /// Same backdrop the onboarding ZStack paints — solid near-black with a
    /// faint brand-green glow rising from the bottom edge. Cold-launch
    /// hands off invisibly into onboarding since both share this base.
    private let splashBackground = Color(hex: 0x0F1117)

    /// Quarter-second tick keeps the progress bar moving smoothly without
    /// burning the CPU on a 60Hz timer.
    private let progressTick: UInt64 = 250_000_000

    /// Treat the launch as "done" when the router has resolved the auth
    /// phase AND RevenueCat is no longer mid-fetch. We don't actually
    /// dismiss the splash here — RootView's phase switch does — but the
    /// progress bar runs to 100% when this flips so the user sees a clean
    /// completion before the next screen swaps in.
    private var isReady: Bool {
        auth.phase != .launching && !revenueCat.isLoading
    }

    /// Mirrors Honeydew's gentle "progress climbs even before we know
    /// what's loading" curve: starts at 10%, climbs to ~36% over 2.6s,
    /// adds bumps as each major signal lands, caps at 96% until isReady.
    private var progress: Double {
        if isReady && elapsed >= 1.6 { return 1.0 }
        var value = 0.10 + min(elapsed / 2.6, 1.0) * 0.26
        if auth.phase != .launching { value += 0.30 }
        if revenueCat.isEntitlementResolved { value += 0.18 }
        if !revenueCat.isLoading { value += 0.18 }
        return min(max(value, 0.10), isReady ? 0.96 : 0.92)
    }

    var body: some View {
        ZStack {
            splashBackground.ignoresSafeArea()

            VStack(spacing: 18) {
                // Wordmark — "Wager" white + "Proof" brand green.
                // Composed via `Text` concatenation so the kerning + base
                // line are perfectly continuous (no HStack gap between
                // the two halves).
                (
                    Text("Wager").foregroundStyle(.white)
                    + Text("Proof").foregroundStyle(Color.appPrimary)
                )
                .font(.system(size: 20, weight: .heavy))
                .tracking(-0.5)

                SplashProgressBar(progress: progress)
                    .frame(width: 120, height: 4)
                    .accessibilityLabel("Loading")
                    .accessibilityValue("\(Int((progress * 100).rounded())) percent")
            }
        }
        .task(id: "splash-progress-clock") {
            launchStart = Date()
            while !Task.isCancelled {
                withAnimation(.linear(duration: 0.22)) {
                    elapsed = Date().timeIntervalSince(launchStart)
                }
                try? await Task.sleep(nanoseconds: progressTick)
            }
        }
    }
}

/// Thin gradient progress bar shown beneath the wordmark while the launch
/// gate resolves. Ports the geometry from Honeydew's
/// `SimpleLaunchProgressBar` with WagerProof brand colors.
private struct SplashProgressBar: View {
    let progress: Double

    var body: some View {
        GeometryReader { proxy in
            let width = max(proxy.size.width * progress, 6)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.white.opacity(0.10))

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.appPrimary,
                                Color(hex: 0x00B050),
                                Color(hex: 0xBEEB67)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: width)
            }
            .clipShape(Capsule())
        }
    }
}
