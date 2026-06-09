// PostOnboardingPaywall.swift
//
// SwiftUI port of `wagerproof-mobile/components/PostOnboardingPaywall.tsx`.
//
// Mounts above the main app shell once onboarding finishes and the user is
// not yet a Pro subscriber. Renders the native `RevenueCatUI.PaywallView`
// driven by the `onboarding` placement so the dashboard owns the offer
// layout, package selection, headline/copy, A/B variants, and the close
// button. We only own:
//   - Gating predicate (auth + onboarding complete + !isPro + !dismissed).
//   - Placement offering fetch + retry / skip fallbacks if RC is unreachable.
//   - Post-purchase finalization: refresh `RevenueCatStore` so the rest of
//     the app re-renders with the granted entitlement, then dismiss.
//   - Meta + (deferred) Mixpanel analytics fan-out on conversion.
//
// FIDELITY-WAIVER #053: Mixpanel `Subscription Purchased` event not fired
// here — AnalyticsStore wiring lands in a later wave. Meta SDK events fire
// in `finalize(transaction:customerInfo:)` since they're the attribution-
// critical path (ad-network LTV reporting).

import SwiftUI
import RevenueCat
import RevenueCatUI
import WagerproofDesign
import WagerproofServices
import WagerproofStores

struct PostOnboardingPaywall: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(ProAccessStore.self) private var proAccess

    /// Tells the host (`RootView`) the user is done with the paywall — fires
    /// after a successful purchase/restore, when the dashboard-configured
    /// close button is tapped, OR when the skip fallback is used. The host
    /// flips its own `paywallDismissed` flag, which drops the
    /// `fullScreenCover` binding to `false` and animates the cover away.
    /// Lifting this state out of the paywall avoids the blank-modal trap
    /// where flipping a local `dismissed` flag would render `EmptyView()`
    /// behind a cover the host doesn't know to close.
    let onUserDismissed: () -> Void

    @State private var offering: Offering?
    @State private var isLoadingOffering: Bool = true
    @State private var loadError: String?
    /// True while we're awaiting the post-purchase `refreshCustomerInfo()`.
    /// Forces a spinner over the paywall surface so the user doesn't see a
    /// flash of "free" before the entitlement applies.
    @State private var isFinalizing: Bool = false
    /// Flips after 10s if the offering fetch hasn't resolved — surfaces the
    /// retry/skip affordance so the user is never stuck on a spinner.
    @State private var timedOut: Bool = false

    var body: some View {
        paywallSurface
            .preferredColorScheme(.dark)
            .task { await loadOffering() }
            .task { await startTimeoutWatchdog() }
            // Block the swipe-to-dismiss gesture on the cover sheet so the
            // paywall stays "non-dismissible" unless the user purchases,
            // restores, or hits the dashboard X. Matches RN's
            // `onRequestClose={() => {}}` Modal behavior.
            .interactiveDismissDisabled(true)
    }

    @ViewBuilder
    private var paywallSurface: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let offering, !isLoadingOffering, loadError == nil {
                // `displayCloseButton: true` surfaces RevenueCatUI's native
                // top-left X. Tapping it fires `onRequestedDismissal` below,
                // which calls `onUserDismissed()` → host flips the cover.
                PaywallView(offering: offering, displayCloseButton: true)
                    .onPurchaseCompleted { transaction, customerInfo in
                        Task { await finalize(transaction: transaction, customerInfo: customerInfo) }
                    }
                    .onRestoreCompleted { customerInfo in
                        // Restore can complete WITHOUT a granted entitlement
                        // (e.g. user restored on a device with no purchase
                        // history). Only collapse the paywall when the WagerProof
                        // Pro entitlement is actually active. Matches the RN
                        // guard `customerInfo?.entitlements?.active?.['WagerProof Pro']`.
                        guard customerInfo.entitlements.active[RevenueCatService.entitlementIdentifier] != nil else {
                            return
                        }
                        Task { await finalize(transaction: nil, customerInfo: customerInfo) }
                    }
                    .onRequestedDismissal {
                        // Dashboard-configured close button — explicit user
                        // intent to bail. Let them through.
                        onUserDismissed()
                    }
            }

            if isLoadingOffering || isFinalizing {
                loadingOverlay
            } else if loadError != nil || offering == nil {
                errorOverlay
            }

            // Our own X overlay. `displayCloseButton: true` only renders on
            // V1 RevenueCatUI templates; V2 templates ignore the flag and use
            // whatever the dashboard configured. This overlay guarantees an
            // escape hatch regardless of template version. Pinned top-trailing
            // inside the safe area so it sits below the Dynamic Island.
            closeOverlay
        }
    }

    private var closeOverlay: some View {
        VStack {
            HStack {
                Spacer()
                Button(action: { onUserDismissed() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle().fill(Color.black.opacity(0.55))
                        )
                        .overlay(
                            Circle().strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
                        )
                }
                .padding(.trailing, 16)
                .padding(.top, 8)
                .accessibilityLabel("Close paywall")
            }
            Spacer()
        }
    }

    // MARK: - Overlays

    private var loadingOverlay: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(Color.appPrimary)
                .scaleEffect(1.4)

            Text(isFinalizing ? "Finalizing your subscription..." : "Loading subscription options...")
                .font(.system(size: 16))
                .foregroundStyle(Color.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.ignoresSafeArea())
    }

    private var errorOverlay: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(Color.appPrimary)

            VStack(spacing: 12) {
                Text("Unable to load subscription options")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)

                if let loadError {
                    Text(loadError)
                        .font(.system(size: 15))
                        .foregroundStyle(Color.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            }

            Spacer()

            VStack(spacing: 12) {
                OnboardingLiquidGlassButton(title: "Retry") {
                    Task { await loadOffering() }
                }
                OnboardingLiquidGlassButton(
                    title: "Continue without subscription",
                    tint: Color.white.opacity(0.18)
                ) {
                    // Same escape hatch as the RN "skip" button — keeps the
                    // user moving when the network is down so onboarding
                    // can't strand them on a dead paywall.
                    onUserDismissed()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.ignoresSafeArea())
    }

    // MARK: - Logic

    private func loadOffering() async {
        isLoadingOffering = true
        loadError = nil
        timedOut = false

        // Prefer the placement-specific offering so the dashboard can ship a
        // distinct post-onboarding variant; the service helper falls back to
        // the current offering when no placement is attached.
        if let placementOffering = await revenueCat.fetchOffering(forPlacement: RevenueCatService.Placement.onboarding) {
            offering = placementOffering
            isLoadingOffering = false
            return
        }

        // Last-resort fallback — use whatever offering RevenueCatStore already
        // cached from `refreshOffering()`. Keeps the paywall functional even
        // if the placement returns nil and the live fetch fails.
        if let fallback = revenueCat.offering {
            offering = fallback
            isLoadingOffering = false
            return
        }

        offering = nil
        loadError = "Couldn't reach the subscription service. Check your connection and try again."
        isLoadingOffering = false
    }

    /// Safety watchdog — if the offering fetch hasn't finished within 10s,
    /// flip into the error/retry surface so the user isn't trapped behind a
    /// spinner. Matches the RN `setTimeout(() => setTimedOut(true), 10000)`.
    private func startTimeoutWatchdog() async {
        try? await Task.sleep(nanoseconds: 10_000_000_000)
        guard !Task.isCancelled else { return }
        guard isLoadingOffering && offering == nil else { return }
        timedOut = true
        isLoadingOffering = false
        if loadError == nil {
            loadError = "Subscription options are taking longer than expected to load."
        }
    }

    private func finalize(transaction: StoreTransaction?, customerInfo: CustomerInfo) async {
        isFinalizing = true
        // Trusted refresh from RC servers — `RevenueCatStore.refreshCustomerInfo`
        // is allowed to flip granted/denied (the trust-downgrade guard only
        // protects against stream updates), so the rest of the app sees the
        // new entitlement immediately after this returns.
        await revenueCat.refreshCustomerInfo()

        // Fan out Meta analytics so ad-network LTV / Subscribe events fire
        // before the user is dropped into the main app. Best-effort — never
        // blocks the dismissal.
        if let transaction {
            trackMetaConversion(transaction: transaction, customerInfo: customerInfo)
        }

        isFinalizing = false
        onUserDismissed()
    }

    /// Fire Meta SDK Subscribe / Purchase events using the price + currency
    /// extracted from the matched RevenueCat package. Mirrors the RN mapping
    /// in `services/analytics.ts` `trackFacebookSubscriptionEvent` where
    /// trials map to `fb_mobile_purchase` and paid subs map to `Subscribe`.
    private func trackMetaConversion(transaction: StoreTransaction, customerInfo: CustomerInfo) {
        // Resolve the purchased package off the offering so we can pull
        // price + currency off the StoreProduct. StoreTransaction itself
        // doesn't expose the price (RC keeps it on the catalog side).
        guard let offering,
              let package = offering.availablePackages.first(where: { $0.storeProduct.productIdentifier == transaction.productIdentifier }) else {
            return
        }

        let product = package.storeProduct
        let amount = product.price
        let currency = product.currencyCode ?? "USD"

        // Subscription type derived from the active entitlement so the
        // dashboards roll up correctly under monthly / yearly / lifetime.
        let entitlement = customerInfo.entitlements.active[RevenueCatService.entitlementIdentifier]
        let productId = (entitlement?.productIdentifier ?? transaction.productIdentifier).lowercased()
        let subscriptionType: String = {
            if productId.contains("lifetime") { return "lifetime" }
            if productId.contains("annual") || productId.contains("yearly") { return "yearly" }
            if productId.contains("monthly") { return "monthly" }
            return "unknown"
        }()

        let contentId = "\(subscriptionType)_subscription"
        // RN computes a coarse LTV multiplier so Meta's optimization model
        // gets a forward-looking value rather than just the first month.
        let predictedLtv: Decimal = {
            switch subscriptionType {
            case "monthly": return amount * 4
            case "yearly": return amount * (Decimal(string: "1.3") ?? 1)
            default: return amount
            }
        }()

        let isTrial = entitlement?.periodType == .trial

        let metaParameters: [String: Any] = [
            "fb_currency": currency,
            "fb_content_type": "product",
            "fb_content_id": contentId,
            "fb_order_id": transaction.transactionIdentifier,
            "fb_predicted_ltv": NSDecimalNumber(decimal: predictedLtv).stringValue,
            "fb_success": "1",
            "fb_payment_info_available": "1",
        ]

        if isTrial {
            // Trial start → `fb_mobile_purchase` so Meta sees attribution at
            // the same point as the RevenueCat server-side mapping.
            MetaAnalyticsService.shared.trackPurchase(
                amount: amount,
                currency: currency,
                parameters: metaParameters
            )
        } else {
            // Paid first sub → `Subscribe` w/ valueToSum so revenue dashboards
            // attribute the LTV to the install cohort.
            MetaAnalyticsService.shared.trackSubscribe(
                amount: amount,
                currency: currency,
                parameters: metaParameters
            )
        }

        // Force-flush so the event hits Meta's pipeline before the user
        // backgrounds the app post-purchase.
        MetaAnalyticsService.shared.flush()
    }
}
