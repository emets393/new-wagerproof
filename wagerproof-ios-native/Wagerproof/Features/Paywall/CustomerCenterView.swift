import SwiftUI
import RevenueCat
import RevenueCatUI
import WagerproofDesign
import WagerproofStores

/// SwiftUI port of `wagerproof-mobile/components/CustomerCenter.tsx`.
///
/// Uses RevenueCatUI's native `CustomerCenterView` so customers can manage,
/// cancel, request refunds, or switch plans inside the app. The RC SDK
/// handles all the StoreKit interactions for us.
struct CustomerCenterView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(RevenueCatStore.self) private var revenueCat

    var body: some View {
        // RevenueCatUI's CustomerCenter is full-screen; we wrap in a
        // NavigationStack so the toolbar Close button is available even when
        // the underlying RC UI doesn't expose its own dismiss control.
        NavigationStack {
            CustomerCenterView_RCUI()
                .navigationTitle("Subscription Management")
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
            // Refresh customer info each time the sheet appears so the rest
            // of the app sees any plan changes the user made inside RC's UI.
            await revenueCat.refreshCustomerInfo()
        }
    }
}

/// Wrapper around `RevenueCatUI.CustomerCenterView` so the surrounding
/// SwiftUI stack can integrate cleanly. The RC component is itself a SwiftUI
/// View, but namespaced inside `RevenueCatUI` — we re-export it here to keep
/// imports tidy.
private struct CustomerCenterView_RCUI: View {
    var body: some View {
        RevenueCatUI.CustomerCenterView()
    }
}
