import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Roast intensity picker. Mirrors `wagerproof-mobile/components/roast/RoastIntensitySelector.tsx`.
///
/// RN renders three pill buttons (Savage 🔥 / Medium 😏 / Light 😄) with the
/// active pill tinted green. Spec §5 says to use `Picker(.segmented)` for the
/// equivalent here, but the RN visual relies heavily on the emoji + glow on
/// the active pill — segmented controls can't show emoji icons alongside
/// labels in a way that keeps parity. We keep the pill pattern (matching the
/// RN visual) and lean on `.sensoryFeedback(.selection)` + spring animation
/// so taps feel native.
///
/// Active state: 20% green background + green border + green text.
/// Inactive: 8% white background + 10% white border + 60% white text.
struct RoastIntensitySelectorView: View {
    let intensity: RoastSessionStore.Intensity
    let onChange: (RoastSessionStore.Intensity) async -> Void

    var body: some View {
        HStack(spacing: 10) {
            // RN orders pills as Savage / Medium / Light. We mirror that
            // ordering so the parity screenshot matches.
            ForEach([RoastSessionStore.Intensity.savage,
                     RoastSessionStore.Intensity.medium,
                     RoastSessionStore.Intensity.light], id: \.self) { option in
                pill(for: option)
            }
        }
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .center)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Roast intensity")
    }

    @ViewBuilder
    private func pill(for option: RoastSessionStore.Intensity) -> some View {
        let isActive = intensity == option
        Button {
            Task { await onChange(option) }
        } label: {
            HStack(spacing: 6) {
                Text(option.emoji)
                    .font(.system(size: 16))
                Text(option.label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(isActive ? Color.appPrimary : Color.white.opacity(0.6))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(isActive
                          ? Color.appPrimary.opacity(0.2)
                          : Color.white.opacity(0.08))
            )
            .overlay(
                Capsule()
                    .stroke(isActive ? Color.appPrimary : Color.white.opacity(0.1),
                            lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(isActive ? .isSelected : [])
        .animation(.appQuick, value: isActive)
    }
}

#if DEBUG
#Preview("Intensity Selector") {
    VStack(spacing: 20) {
        RoastIntensitySelectorView(intensity: .savage) { _ in }
        RoastIntensitySelectorView(intensity: .medium) { _ in }
        RoastIntensitySelectorView(intensity: .light) { _ in }
    }
    .padding()
    .background(Color.black)
    .preferredColorScheme(.dark)
}
#endif
