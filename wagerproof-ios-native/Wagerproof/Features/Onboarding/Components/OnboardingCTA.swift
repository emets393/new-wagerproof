// OnboardingCTA.swift
//
// Legacy onboarding CTA pill. Most onboarding screens have migrated to
// `OnboardingPageShell` + `OnboardingLiquidGlassButton` from WagerproofDesign,
// which own the Liquid Glass treatment. This file is now slim: it only keeps
// `OnboardingCTAButton`, which is still consumed by:
//   - `AgentBornView` (cinematic step, renders outside the shell)
//   - `OnboardingAgentBuilderView` (sub-flow with its own internal CTAs)
//   - `PostOnboardingPaywall` (paywall surface)
//
// `OnboardingBottomBar` and `OnboardingHeadline` were retired alongside the
// shell migration — every caller has been updated to either render the CTA
// via the shell or inline the headline pair directly.

import SwiftUI
import WagerproofDesign

/// Pill-shaped glass button matching RN's `variant="glass"` Button.
/// Background: rgba(34,197,94,0.15), border: 1.5px rgba(34,197,94,0.35).
struct OnboardingCTAButton: View {
    let title: String
    let isLoading: Bool
    let isDisabled: Bool
    let action: () -> Void

    init(
        title: String = "Continue",
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 50)
                    .fill(Color.appPrimary.opacity(0.15))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 50)
                    .strokeBorder(Color.appPrimary.opacity(0.35), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
        .opacity(isDisabled ? 0.45 : 1)
        .sensoryFeedback(.impact(weight: .light), trigger: isLoading)
    }
}
