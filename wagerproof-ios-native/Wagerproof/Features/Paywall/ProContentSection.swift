import SwiftUI
import WagerproofDesign
import WagerproofServices
import WagerproofStores

/// SwiftUI port of `wagerproof-mobile/components/ProContentSection.tsx`.
///
/// Wraps any content view, gating it behind the Pro entitlement. For non-Pro
/// users we render the content blurred + a "Tap to unlock" overlay; tapping
/// presents the paywall.
struct ProContentSection<Content: View>: View {
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(\.colorScheme) private var colorScheme

    let title: String?
    let placementId: String
    let minHeight: CGFloat
    let content: Content
    @State private var isPaywallPresented = false

    init(
        title: String? = nil,
        placementId: String = RevenueCatService.Placement.genericFeature,
        minHeight: CGFloat = 100,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.placementId = placementId
        self.minHeight = minHeight
        self.content = content()
    }

    var body: some View {
        if proAccess.isPro || proAccess.isLoading {
            content
        } else {
            Button {
                isPaywallPresented = true
            } label: {
                ZStack {
                    content
                        .opacity(0.3)
                        .allowsHitTesting(false)
                    Color.clear
                        .background(.ultraThinMaterial)
                    HStack(spacing: Spacing.md) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color(hex: colorScheme == .dark ? 0xF59E0B : 0xD97706))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title ?? "Pro Feature")
                                .font(AppFont.bodyEmphasized)
                                .foregroundStyle(Color.appTextPrimary)
                            Text("Tap to unlock")
                                .font(AppFont.caption)
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                    .padding(Spacing.md)
                    .background(
                        colorScheme == .dark
                            ? Color.black.opacity(0.8)
                            : Color.white.opacity(0.9)
                    )
                    .clipShape(Capsule())
                    .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
                }
                .frame(minHeight: minHeight)
            }
            .buttonStyle(.plain)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .sheet(isPresented: $isPaywallPresented) {
                RevenueCatPaywallView(placementId: placementId)
            }
        }
    }
}
