import AppTrackingTransparency
import SwiftUI
import WagerproofDesign
import WagerproofServices

/// A tappable preview of the iOS 26 ATT dialog. Only the real system request
/// can record consent; arriving on this page never opens it automatically.
struct OnboardingATTPage: View {
    @Environment(\.onboardingPageIsActive) private var isActive
    @Environment(\.scenePhase) private var scenePhase
    @State private var isRequestingATT = false
    @State private var didRequestATT = false

    private var usageDescription: String {
        Bundle.main.object(forInfoDictionaryKey: "NSUserTrackingUsageDescription") as? String ?? ""
    }

    var body: some View {
        OnboardingPageScaffold(title: "One quick thing") {
            (Text("Please tap ")
                + Text("Allow").foregroundColor(Color.appPrimary).bold()
                + Text(" so that we can prevent you from seeing advertising in the future and also find more users that would like to use the app."))
                .font(.system(size: 16))
                .foregroundStyle(Color.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 24)
                .pageEntrance(index: 1)

            Button {
                Task { await requestATTIfNeeded() }
            } label: {
                permissionPreview
            }
            .buttonStyle(.plain)
            .disabled(isRequestingATT || didRequestATT)
            .accessibilityLabel("Tracking permission preview")
            .accessibilityHint("Opens the iOS permission request, where you can allow or decline tracking.")
            .padding(.horizontal, 24)
            .padding(.top, 40)
            .pageEntrance(index: 2)

            Text("Tap the preview to open the iOS permission request.")
                .font(.system(size: 14))
                .foregroundStyle(Color.white.opacity(0.5))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .pageEntrance(index: 3)
        }
    }

    private var permissionPreview: some View {
        VStack(alignment: .leading, spacing: 0) {
            trackingIcon
                .padding(.leading, 22)
                .padding(.top, 20)
                .padding(.bottom, 24)

            VStack(alignment: .leading, spacing: 10) {
                Text("Allow “WagerProof” to track your activity across other companies’ apps and websites?")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)

                Text(usageDescription)
                    .font(.system(size: 15))
                    .lineSpacing(2)
                    .foregroundStyle(Color.white.opacity(0.55))
            }
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 30)

            VStack(spacing: 8) {
                previewOption("Ask App Not to Track")
                previewOption("Allow")
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 16)
        }
        .frame(maxWidth: 320, alignment: .leading)
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 34, style: .continuous),
            tint: Color.black.opacity(0.15)
        )
        .contentShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
        .environment(\.colorScheme, .dark)
    }

    private func previewOption(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 17))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.white.opacity(0.12), in: Capsule())
    }

    /// The orange linked-activity glyph and blue privacy badge shown by iOS 26.
    private var trackingIcon: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(LinearGradient(
                    colors: [Color(red: 1, green: 0.70, blue: 0.32), Color(red: 1, green: 0.55, blue: 0)],
                    startPoint: .top, endPoint: .bottom
                ))
                .frame(width: 64, height: 64)
                .overlay(alignment: .topLeading) {
                    Path { path in
                        path.move(to: CGPoint(x: 21, y: 18))
                        path.addLine(to: CGPoint(x: 21, y: 26))
                        path.addCurve(to: CGPoint(x: 43, y: 41),
                                      control1: CGPoint(x: 21, y: 37),
                                      control2: CGPoint(x: 43, y: 29))
                        path.addLine(to: CGPoint(x: 43, y: 47))
                    }
                    .stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .frame(width: 64, height: 64)
                    .overlay(alignment: .topLeading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.white)
                            .frame(width: 13, height: 13)
                            .offset(x: 14.5, y: 11)
                    }
                }

            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color(red: 0, green: 0.62, blue: 1))
                .frame(width: 30, height: 30)
                .overlay {
                    Image(systemName: "hand.raised.fill")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(.white)
                }
                .offset(x: 40, y: 40)
        }
        .frame(width: 70, height: 70)
        .accessibilityHidden(true)
    }

    @MainActor
    private func requestATTIfNeeded() async {
        guard isActive, scenePhase == .active, !isRequestingATT, !didRequestATT else { return }
        isRequestingATT = true
        defer { isRequestingATT = false }
        let initialStatus = ATTrackingManager.trackingAuthorizationStatus
        let finalStatus: ATTrackingManager.AuthorizationStatus
        if initialStatus == .notDetermined {
            finalStatus = await ATTrackingManager.requestTrackingAuthorization()
        } else {
            finalStatus = initialStatus
        }
        guard finalStatus != .notDetermined else { return }
        didRequestATT = true
        await RevenueCatService.shared.refreshAttributionAfterTrackingAuthorization(
            isAuthorized: finalStatus == .authorized
        )
    }
}
