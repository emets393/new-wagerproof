import SwiftUI
import WagerproofDesign
import WagerproofServices

/// Reuses the approved explanation for accounts that already finished onboarding.
/// This is a root surface, so a paywall cannot cover the permission request.
struct TrackingPermissionGate: View {
    @State private var tracking = TrackingAuthorizationService.shared

    var body: some View {
        OnboardingPageShell(
            progress: nil,
            continueTitle: "Continue",
            isCTAEnabled: !tracking.isRequesting,
            isCTALoading: tracking.isRequesting,
            canGoBack: false,
            useNativeChrome: false,
            ctaButtonColor: .white,
            ctaButtonForeground: .black,
            ctaButtonSurfaceOpacity: 0.92,
            background: { Color(hex: 0x0F1117).ignoresSafeArea() },
            content: { OnboardingATTPage() },
            onContinue: { Task { await tracking.request() } },
            onBack: {}
        )
    }
}
