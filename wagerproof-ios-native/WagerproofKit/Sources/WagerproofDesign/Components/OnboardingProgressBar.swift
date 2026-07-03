// OnboardingProgressBar.swift
//
// Standardized progress bar shown in the onboarding chrome band of every
// non-terminal screen. Owned by `OnboardingPageShell`; individual screens
// never render it directly.
//
// Visual: rounded pill BR=20, height=12, width=70% of screen. Background
// gray.opacity(0.15), fill gray.opacity(0.4). 300ms easeInOut on value change.
//
// The value is 0.0…1.0. `nil` is handled by the shell (paywall / final
// celebration), not this view.
//
// Ported from Honeydew's HoneydewDesign/Components/OnboardingProgressBar.swift
// on 2026-05-23 as part of the iOS 26 Liquid Glass onboarding refresh.

import SwiftUI

public struct OnboardingProgressBar: View {
    /// 0.0…1.0. Clamped internally so the view never overdraws.
    public let value: Double
    /// Width as a fraction of the parent. Defaults to 70% — matches Honeydew/Flutter.
    public let widthFraction: CGFloat
    public let height: CGFloat
    public let cornerRadius: CGFloat
    /// Track/fill tints. Defaults preserve the original gray-on-gray look;
    /// the onboarding v2 chrome passes its live accent as the fill so the
    /// bar reads against the dark pixelwave and recolors with the theme.
    public let trackColor: Color
    public let fillColor: Color

    public init(
        value: Double,
        widthFraction: CGFloat = 0.70,
        height: CGFloat = 12,
        cornerRadius: CGFloat = 20,
        trackColor: Color = Color.gray.opacity(0.15),
        fillColor: Color = Color.gray.opacity(0.40)
    ) {
        self.value = value
        self.widthFraction = widthFraction
        self.height = height
        self.cornerRadius = cornerRadius
        self.trackColor = trackColor
        self.fillColor = fillColor
    }

    public var body: some View {
        GeometryReader { proxy in
            let trackWidth = proxy.size.width * widthFraction
            let clamped = max(0, min(1, value))
            let fillWidth = trackWidth * clamped

            HStack {
                Spacer(minLength: 0)
                ZStack(alignment: .leading) {
                    // Track.
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .fill(trackColor)
                        .frame(width: trackWidth, height: height)
                    // Fill.
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .fill(fillColor)
                        .frame(width: fillWidth, height: height)
                        .animation(.easeInOut(duration: 0.3), value: clamped)
                }
                Spacer(minLength: 0)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityLabel("Onboarding progress")
        .accessibilityValue("\(Int(value * 100)) percent")
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        OnboardingProgressBar(value: 0.0)
        OnboardingProgressBar(value: 0.25)
        OnboardingProgressBar(value: 0.65)
        OnboardingProgressBar(value: 0.97)
        OnboardingProgressBar(value: 1.0)
    }
    .padding(.vertical, 20)
    .background(Color(hex: 0x0F1117))
}
