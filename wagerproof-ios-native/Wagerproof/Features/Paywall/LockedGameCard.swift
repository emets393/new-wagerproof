import SwiftUI
import WagerproofDesign
import WagerproofServices

/// SwiftUI port of `wagerproof-mobile/components/LockedGameCard.tsx`.
///
/// Wraps a game card with a blurred overlay + lock pill. Tapping presents
/// the paywall. The wrapped content is what RN used as the locked silhouette
/// so layout stays stable.
struct LockedGameCard<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var isPaywallPresented = false

    let cardWidth: CGFloat?
    let content: Content

    init(cardWidth: CGFloat? = nil, @ViewBuilder content: () -> Content) {
        self.cardWidth = cardWidth
        self.content = content()
    }

    var body: some View {
        Button {
            isPaywallPresented = true
        } label: {
            ZStack {
                content
                    .opacity(0.4)
                    .allowsHitTesting(false)
                Color.clear
                    .background(.ultraThinMaterial)
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color(hex: colorScheme == .dark ? 0xF59E0B : 0xD97706))
                    Text("Pro")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(
                    colorScheme == .dark
                        ? Color.black.opacity(0.7)
                        : Color.white.opacity(0.9)
                )
                .clipShape(Capsule())
                .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
            }
            .frame(maxWidth: cardWidth)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $isPaywallPresented) {
            RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
        }
    }
}
