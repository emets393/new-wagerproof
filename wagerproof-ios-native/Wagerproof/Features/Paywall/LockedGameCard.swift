import SwiftUI
import WagerproofDesign
import WagerproofServices

/// SwiftUI port of `wagerproof-mobile/components/LockedGameCard.tsx`.
///
/// Wraps a game card with a blurred overlay + lock pill. Tapping presents
/// the paywall. The wrapped content is what RN used as the locked silhouette
/// so layout stays stable.
struct LockedGameCard<Content: View>: View {
    @State private var isPaywallPresented = false

    let cardWidth: CGFloat?
    let content: Content

    init(cardWidth: CGFloat? = nil, @ViewBuilder content: () -> Content) {
        self.cardWidth = cardWidth
        self.content = content()
    }

    var body: some View {
        LockedFeaturePreview(minimum: .standard, title: "Game insights", action: {
            isPaywallPresented = true
        }) { content }
        .frame(maxWidth: cardWidth)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $isPaywallPresented) {
            RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature, minimumTier: .standard)
        }
    }
}
