import SwiftUI
import WagerproofDesign
import WagerproofServices

/// SwiftUI port of `wagerproof-mobile/components/LockedOverlay.tsx`.
///
/// A general-purpose overlay that blurs whatever content it wraps + shows a
/// lock icon with a configurable message. Tapping opens the paywall by
/// default, or invokes a custom `action`.
struct LockedOverlay<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var isPaywallPresented = false

    let message: String
    let placementId: String
    let blurIntensity: Material
    let action: (() -> Void)?
    let content: Content?

    init(
        message: String = "Unlock with Pro",
        placementId: String = RevenueCatService.Placement.genericFeature,
        action: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.message = message
        self.placementId = placementId
        self.blurIntensity = .ultraThinMaterial
        self.action = action
        self.content = content()
    }

    init(
        message: String = "Unlock with Pro",
        placementId: String = RevenueCatService.Placement.genericFeature,
        action: (() -> Void)? = nil
    ) where Content == EmptyView {
        self.message = message
        self.placementId = placementId
        self.blurIntensity = .ultraThinMaterial
        self.action = action
        self.content = nil
    }

    var body: some View {
        Button {
            if let action {
                action()
            } else {
                isPaywallPresented = true
            }
        } label: {
            ZStack {
                if let content {
                    content
                        .opacity(0.5)
                        .allowsHitTesting(false)
                }
                Color.clear
                    .background(blurIntensity)
                VStack(spacing: Spacing.sm) {
                    ZStack {
                        Circle()
                            .fill(
                                colorScheme == .dark
                                    ? Color.black.opacity(0.6)
                                    : Color.white.opacity(0.8)
                            )
                            .frame(width: 56, height: 56)
                            .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
                        Image(systemName: "lock.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(Color(hex: colorScheme == .dark ? 0xF59E0B : 0xD97706))
                    }
                    Text(message)
                        .font(AppFont.captionEmphasized)
                        .foregroundStyle(Color.appTextPrimary)
                        .shadow(color: .black.opacity(0.3), radius: 2, y: 1)
                }
            }
        }
        .buttonStyle(.plain)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .sheet(isPresented: $isPaywallPresented) {
            RevenueCatPaywallView(placementId: placementId)
        }
    }
}
