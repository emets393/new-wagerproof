import SwiftUI
import RevenueCat
import RevenueCatUI
import WagerproofDesign
import WagerproofServices
import WagerproofStores
import WagerproofModels

/// SwiftUI port of `wagerproof-mobile/components/RevenueCatPaywall.tsx`.
///
/// RN wrapped the JS bridge `react-native-purchases-ui` `<Paywall>` inside a
/// `<Modal>` with a custom header. iOS gets the native
/// `RevenueCatUI.PaywallView` directly — same code path the dashboard
/// designs against, with proper StoreKit 2 integration baked in.
///
/// Flow:
///   1. View mounts → fetch the placement-specific offering.
///   2. While loading → spinner.
///   3. On offering → present native `PaywallView(offering:)`.
///   4. Native paywall reports purchase / restore completion → we refresh the
///      RevenueCat store so the rest of the app updates immediately.
struct RevenueCatPaywallView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(RevenueCatStore.self) private var revenueCat
    @Environment(ProAccessStore.self) private var access

    let placementId: String
    var minimumTier: SubscriptionTier = .pro

    @State private var offering: Offering?
    @State private var loadState: LoadState = .loading
    @State private var didTrackPresented = false

    private enum LoadState {
        case loading
        case ready
        case empty
        case failed(String)
    }

    var body: some View {
        if access.isPreviewing || (isScreenshotPreview && revenueCat.isTieredCustomer) {
            TieredPaywallView(
                minimumTier: PaywallTier.allCases.first { $0.accessTier == minimumTier } ?? .pro,
                preview: true,
                source: placementId,
                onPurchaseFinalized: { _, _ in dismiss() },
                onRequestClose: { dismiss() }
            )
        } else if loadStateIsReady, let offering, offering.identifier == TieredPaywallConfiguration.offeringID {
            TieredPaywallView(
                minimumTier: PaywallTier.allCases.first { $0.accessTier == minimumTier } ?? .pro,
                source: placementId,
                placementID: placementId,
                offering: offering,
                onPurchaseFinalized: { _, _ in dismiss() },
                onRequestClose: { dismiss() }
            )
        } else {
            legacyPaywall
        }
    }

    private var loadStateIsReady: Bool {
        if case .ready = loadState { return true }
        return false
    }

    private var isScreenshotPreview: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains("-uiScreenshotMode")
        #else
        return false
        #endif
    }

    private var legacyPaywall: some View {
        NavigationStack {
            content
                .background(Color.appSurface.ignoresSafeArea())
                .navigationTitle("Upgrade to WagerProof Pro")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .tint(Color.appTextPrimary)
                        .accessibilityLabel("Close")
                    }
                }
        }
        .task {
            await loadOffering()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch loadState {
        case .loading:
            VStack(spacing: Spacing.md) {
                ProgressView()
                Text("Loading subscription options…")
                    .font(AppFont.body)
                    .foregroundStyle(Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            ContentUnavailableView {
                Label("Error", systemImage: "exclamationmark.triangle.fill")
            } description: {
                Text(message)
            } actions: {
                Button("Retry") {
                    Task { await loadOffering() }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
            }
        case .empty:
            ContentUnavailableView {
                Label("No options", systemImage: "shippingbox.fill")
            } description: {
                Text("No subscription options available at this time.")
            } actions: {
                Button("Retry") {
                    Task { await loadOffering() }
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.appPrimary)
            }
        case .ready:
            if let offering {
                // `displayCloseButton: true` surfaces the native top-left X.
                // Tap fires `onRequestedDismissal` → we call `dismiss()` so the
                // presenting sheet closes. Without this the user could only
                // exit via successful purchase / restore.
                PaywallView(offering: offering, displayCloseButton: true)
                    .onPurchaseStarted { package in
                        AnalyticsService.shared.track("paywall_checkout_started", properties: [
                            "source": placementId,
                            "variant": "revenuecat_template",
                            "product_id": package.storeProduct.productIdentifier,
                        ])
                        PaywallConversionTracker.shared.trackCheckoutStarted(
                            source: placementId,
                            package: package
                        )
                    }
                    .onPurchaseCompleted { transaction, customerInfo in
                        AnalyticsService.shared.track("paywall_converted", properties: [
                            "source": placementId,
                            "variant": "revenuecat_template",
                        ])
                        // Every in-app gate (Settings, Discord, WagerBot Voice,
                        // ProFeatureGate, LockedGameCard, LockedOverlay,
                        // ProContentSection) funnels through this view — these
                        // conversions were previously invisible to Meta entirely.
                        PaywallConversionTracker.shared.trackConversion(
                            source: placementId,
                            transaction: transaction,
                            customerInfo: customerInfo,
                            package: nil,
                            offering: offering
                        )
                        Task {
                            await revenueCat.refreshCustomerInfo()
                            dismiss()
                        }
                    }
                    .onRestoreCompleted { _ in
                        AnalyticsService.shared.track("paywall_restore_completed", properties: [
                            "source": placementId,
                        ])
                        Task {
                            await revenueCat.refreshCustomerInfo()
                            dismiss()
                        }
                    }
                    .onRequestedDismissal {
                        AnalyticsService.shared.track("paywall_dismissed", properties: [
                            "source": placementId,
                            "result": "closed",
                        ])
                        dismiss()
                    }
                    .onAppear {
                        guard !didTrackPresented else { return }
                        didTrackPresented = true
                        AnalyticsService.shared.track("paywall_presented", properties: [
                            "source": placementId,
                            "variant": "revenuecat_template",
                        ])
                        PaywallConversionTracker.shared.trackPaywallView(
                            source: placementId,
                            offering: offering
                        )
                    }
            } else {
                EmptyView()
            }
        }
    }

    private func loadOffering() async {
        if revenueCat.isPro && !isScreenshotPreview { dismiss(); return }
        loadState = .loading
        offering = nil
        #if DEBUG
        // Deterministic failure-screen QA without changing live targeting.
        // Both the screenshot harness and explicit launch argument are required.
        if isScreenshotPreview {
            switch UserDefaults.standard.string(forKey: "paywallTestResult") {
            case "none":
                loadState = .empty
                return
            case "error":
                loadState = .failed("Unable to load subscription options. Check your connection and try again.")
                return
            default: break
            }
        }
        #endif
        do {
            let fetched = try await revenueCat.fetchOffering(forPlacement: placementId)
            guard !Task.isCancelled else { return }
            switch PaywallPlacementRoute.resolve(
                offeringID: fetched?.identifier,
                tieredEnabled: TieredPaywallConfiguration.enabled,
                catalogReady: fetched?.metadata["tiered_catalog_ready"] as? Bool == true
            ) {
            case .none: loadState = .empty
            case .unavailable: loadState = .failed("These plans are not available yet. Please try again later.")
            case .legacy, .tiered:
                offering = fetched
                loadState = .ready
            }
        } catch {
            guard !Task.isCancelled else { return }
            loadState = .failed(error.localizedDescription)
        }
    }
}
