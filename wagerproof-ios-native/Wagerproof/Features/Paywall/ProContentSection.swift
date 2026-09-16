import SwiftUI
import WagerproofDesign
import WagerproofServices
import WagerproofStores
import WagerproofModels

/// Prevent nested gates from drawing duplicate prompts inside a locked preview.
private struct FeatureGatePreviewKey: EnvironmentKey {
    static let defaultValue = false
}
extension EnvironmentValues {
    var isFeatureGatePreview: Bool {
        get { self[FeatureGatePreviewKey.self] }
        set { self[FeatureGatePreviewKey.self] = newValue }
    }
}

/// The paywall's artwork, reduced to one contextual unlock action.
struct TierUpgradeCard: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let minimum: SubscriptionTier
    let title: String
    var action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            let headerLayout = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10))
                : AnyLayout(HStackLayout(spacing: 14))
            headerLayout {
                Image(TierArtwork.bolt(for: minimum))
                    .resizable().scaledToFit().frame(width: 44, height: 64)
                    .blendMode(.screen).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    Text(dynamicTypeSize.isAccessibilitySize ? minimum.title.uppercased() : "WAGERPROOF \(minimum.title.uppercased())")
                        .font(.system(.caption2, design: .rounded, weight: .bold))
                        .tracking(1.4).foregroundStyle(Color.appPrimary)
                    Text(title)
                        .font(.system(.title3, design: .rounded, weight: .semibold))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !dynamicTypeSize.isAccessibilitySize { Spacer(minLength: 0) }
            }
            Button(action: action) {
                HStack(spacing: 8) {
                    if !dynamicTypeSize.isAccessibilitySize {
                        Image(systemName: "lock.open.fill").font(.system(.subheadline, weight: .semibold))
                    }
                    GateUnlockLabel(text: dynamicTypeSize.isAccessibilitySize ? "Unlock \(minimum.title)" : "Unlock with \(minimum.title)")
                    if !dynamicTypeSize.isAccessibilitySize {
                        Spacer(minLength: 4)
                        Image(systemName: "arrow.right").font(.system(.subheadline, weight: .semibold))
                    }
                }
                .foregroundStyle(.black).padding(.horizontal, 16).padding(.vertical, 15)
                .frame(maxWidth: .infinity)
                .background(Color.appPrimary.gradient, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("tierGate.explore.\(minimum.rawValue)")
        }
        .padding(20)
        .background {
            GeometryReader { proxy in
                Image(TierArtwork.background(for: minimum)).resizable().scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .opacity(0.28)
                    .overlay(Color.black.opacity(0.35))
            }
            .background(Color(white: 0.055))
            .accessibilityHidden(true)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
            .strokeBorder(.white.opacity(0.12), lineWidth: 1))
        .shadow(color: .black.opacity(0.3), radius: 24, y: 12)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("tierGate.\(minimum.rawValue)")
    }
}

/// Keep the button readable while the app's shared iOS shimmer sweeps only
/// across its lettering. Remount the overlay when the scene becomes active.
private struct GateUnlockLabel: View {
    let text: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    private var label: some View {
        Text(text)
            .font(.system(.subheadline, weight: .bold))
            .fixedSize(horizontal: false, vertical: true)
    }

    var body: some View {
        label.foregroundStyle(.black)
            .overlay {
                if !reduceMotion && scenePhase == .active {
                    label.foregroundStyle(.white.opacity(0.55))
                        .modifier(Shimmer(duration: 2.4))
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
    }
}

/// Keeps the feature's layout visible while blocking interaction and VoiceOver.
struct LockedFeaturePreview<Content: View>: View {
    let minimum: SubscriptionTier
    let title: String
    var action: () -> Void
    @ViewBuilder let content: () -> Content

    @ScaledMetric(relativeTo: .body) private var minimumHeight = 220.0

    var body: some View {
        content()
            .frame(minHeight: minimumHeight)
            .environment(\.isFeatureGatePreview, true)
            .disabled(true)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .blur(radius: 3)
            .overlay {
                Rectangle().fill(.black.opacity(0.28))
                    .contentShape(Rectangle())
                    .onTapGesture { } // The unlock button is the only action.
                    .accessibilityHidden(true)
            }
            .overlay {
                TierUpgradeCard(minimum: minimum, title: title, action: action)
                    .frame(maxWidth: 360).padding(24)
            }
    }
}

/// Inline gate. Protected content is excluded from accessibility while locked.
struct ProContentSection<Content: View>: View {
    @Environment(ProAccessStore.self) private var proAccess
    @Environment(\.isFeatureGatePreview) private var isFeaturePreview
    let title: String?
    let placementId: String
    let minimumTier: SubscriptionTier
    let minHeight: CGFloat
    let content: Content
    @State private var isPaywallPresented = false

    init(title: String? = nil, placementId: String = RevenueCatService.Placement.genericFeature,
         minHeight: CGFloat = 100, minimumTier: SubscriptionTier = .standard,
         @ViewBuilder content: () -> Content) {
        self.minimumTier = minimumTier
        self.title = title
        self.placementId = placementId
        self.minHeight = minHeight
        self.content = content()
    }
    var body: some View {
        if isFeaturePreview {
            content
        } else if proAccess.isLoading {
            ProgressView("Checking access…").frame(maxWidth: .infinity, minHeight: minHeight)
        } else if proAccess.hasAccess(to: minimumTier) {
            content
        } else {
            LockedFeaturePreview(minimum: minimumTier, title: title ?? "Game insights", action: {
                isPaywallPresented = true
            }) {
                content.frame(minHeight: max(minHeight, 210))
            }
            .sheet(isPresented: $isPaywallPresented) {
                RevenueCatPaywallView(placementId: minimumTier == .standard ? placementId : "tier_upgrade_\(minimumTier.rawValue)", minimumTier: minimumTier)
            }
        }
    }
}

/// New-catalog restrictions preserve legacy free previews and legacy Pro access.
struct TieredAccessGate<Content: View>: View {
    @Environment(ProAccessStore.self) private var access
    @Environment(\.isFeatureGatePreview) private var isFeaturePreview
    @State private var showPaywall = false
    let minimum: SubscriptionTier
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        if isFeaturePreview {
            content()
        } else if access.isLoading {
            ProgressView("Checking access…").frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if access.isTierRestricted(minimum) {
            LockedFeaturePreview(minimum: minimum, title: title, action: { showPaywall = true }) {
                content()
            }
            .sheet(isPresented: $showPaywall) {
                RevenueCatPaywallView(placementId: "tier_upgrade_\(minimum.rawValue)", minimumTier: minimum)
            }
        } else {
            content()
        }
    }
}
