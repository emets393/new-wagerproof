import SwiftUI
import Network
import WagerproofDesign

/// Persistent banner pinned to the top of the tab shell that appears when
/// network connectivity is lost. Ports `wagerproof-mobile/components/OfflineBanner.tsx`.
///
/// Uses `NWPathMonitor` (Apple's native equivalent of RN `@react-native-community/netinfo`)
/// so we don't add a third-party dependency for connectivity. The banner
/// auto-hides when the path is `.satisfied` and stays dismissed for the
/// session if the user taps the X.
struct OfflineBanner: View {
    @State private var isConnected: Bool = true
    @State private var didDismiss: Bool = false
    @State private var monitor: NWPathMonitor?

    private var shouldShow: Bool { !isConnected && !didDismiss }

    var body: some View {
        Group {
            if shouldShow {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "wifi.slash")
                        .font(.system(size: 14, weight: .semibold))
                    Text("No internet connection — showing cached data")
                        .font(AppFont.caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button {
                        didDismiss = true
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.75))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Dismiss offline banner")
                }
                .foregroundStyle(.white)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.sm)
                .background(Color(hex: 0xB91C1C))
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.appStandard, value: shouldShow)
        .task {
            // NWPathMonitor must run on a background queue per Apple's API
            // contract. We re-publish path updates to MainActor via Task.
            let m = NWPathMonitor()
            monitor = m
            let queue = DispatchQueue(label: "wagerproof.offline-monitor")
            m.pathUpdateHandler = { path in
                Task { @MainActor in
                    let nowConnected = path.status == .satisfied
                    if nowConnected != isConnected {
                        isConnected = nowConnected
                        // Reset the manual dismiss when connection recovers
                        // so the next outage shows the banner again.
                        if nowConnected { didDismiss = false }
                    }
                }
            }
            m.start(queue: queue)
        }
        .onDisappear {
            monitor?.cancel()
            monitor = nil
        }
    }
}

#Preview {
    VStack(spacing: 0) {
        OfflineBanner()
        Spacer()
    }
}
