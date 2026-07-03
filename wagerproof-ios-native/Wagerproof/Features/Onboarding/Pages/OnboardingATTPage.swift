// OnboardingATTPage.swift
//
// Page 10: ATT priming — mock dialog explains the prompt, then the REAL
// `ATTrackingManager` request fires when the page becomes the ACTIVE
// carousel page. Firing on `onAppear` would be wrong here: the pager
// pre-mounts this page as a neighbor while the user is still reading the
// agent pitch, and the system dialog would pop a page early.

import AppTrackingTransparency
import SwiftUI
import WagerproofDesign
import WagerproofStores

struct OnboardingATTPage: View {
    @Environment(\.onboardingPageIsActive) private var isActive

    @State private var didRequestATT = false

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

            attMockup
                .padding(.horizontal, 40)
                .padding(.top, 16)
                .pageEntrance(index: 2)

            HStack(spacing: 6) {
                Image(systemName: "arrow.up")
                    .foregroundStyle(Color.white.opacity(0.5))
                Text("Tap Allow when the pop-up appears")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.5))
            }
            .padding(.top, 12)
            .pageEntrance(index: 3)
        }
        .onChange(of: isActive, initial: true) { _, active in
            guard active else { return }
            Task { await requestATTIfNeeded() }
        }
    }

    private var attMockup: some View {
        VStack(spacing: 0) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 28))
                .foregroundStyle(Color.appPrimary)
                .frame(width: 48, height: 48)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous),
                    tint: Color(hex: 0x0F1117).opacity(0.6)
                )
                .padding(.top, 24)
                .padding(.bottom, 12)

            Text("Allow \"WagerProof\" to track your\nactivity across other companies'\napps and websites?")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 24)
                .padding(.bottom, 8)

            Text("Your data will be used to deliver personalized ads to you.")
                .font(.system(size: 12))
                .foregroundStyle(Color.white.opacity(0.5))
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)

            Divider().background(Color.white.opacity(0.15))
            Text("Allow")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.appPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)

            Divider().background(Color.white.opacity(0.15))
            Text("Ask App Not to Track")
                .font(.system(size: 17))
                .foregroundStyle(Color.white.opacity(0.5))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        // Liquid Glass — fitting, since it's imitating a system alert.
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 14, style: .continuous),
            tint: Color.white.opacity(0.10)
        )
    }

    /// Fires once, only while this page is front. Result is ignored —
    /// onboarding always advances; ATT only controls IDFA.
    @MainActor
    private func requestATTIfNeeded() async {
        guard !didRequestATT else { return }
        didRequestATT = true
        let status = ATTrackingManager.trackingAuthorizationStatus
        if status == .notDetermined {
            _ = await ATTrackingManager.requestTrackingAuthorization()
        }
    }
}
