import SwiftUI
import WagerproofDesign
import WagerproofServices
import WagerproofStores

/// SwiftUI port of `wagerproof-mobile/components/ProFeatureGate.tsx`.
///
/// Three render modes mirror RN:
///   1. Pro user → render `content`.
///   2. Non-Pro user with a `fallback` view → render the fallback.
///   3. Non-Pro user with `showUpgradePrompt = true` → render an inline
///      upgrade CTA that opens the paywall.
///
/// Loading is collapsed into a thin "Loading…" placeholder so consumers don't
/// have to differentiate.
struct ProFeatureGate<Content: View, Fallback: View>: View {
    @Environment(ProAccessStore.self) private var proAccess
    @State private var isPaywallPresented = false

    let content: Content
    let fallback: Fallback?
    let showUpgradePrompt: Bool

    init(
        showUpgradePrompt: Bool = false,
        @ViewBuilder content: () -> Content,
        @ViewBuilder fallback: () -> Fallback
    ) {
        self.content = content()
        self.fallback = fallback()
        self.showUpgradePrompt = showUpgradePrompt
    }

    init(
        showUpgradePrompt: Bool = false,
        @ViewBuilder content: () -> Content
    ) where Fallback == EmptyView {
        self.content = content()
        self.fallback = nil
        self.showUpgradePrompt = showUpgradePrompt
    }

    var body: some View {
        if proAccess.isLoading {
            HStack {
                ProgressView()
                Text("Loading…")
                    .font(AppFont.caption)
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding()
        } else if proAccess.isPro {
            content
        } else if let fallback {
            fallback
        } else if showUpgradePrompt {
            upgradePrompt
        } else {
            // RN: render nothing when `showUpgradePrompt = false` and no fallback.
            EmptyView()
        }
    }

    private var upgradePrompt: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "crown.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color(hex: 0xFFD700))
            Text("Pro Feature")
                .font(AppFont.title)
                .foregroundStyle(Color.appTextPrimary)
            Text("This feature is available for WagerProof Pro subscribers.")
                .font(AppFont.body)
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)

            Button {
                isPaywallPresented = true
            } label: {
                Text("Upgrade to Pro")
                    .font(AppFont.bodyEmphasized)
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.xl)
                    .padding(.vertical, Spacing.md)
                    .background(Color.appPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(Spacing.lg)
        .sheet(isPresented: $isPaywallPresented) {
            RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
        }
    }
}
